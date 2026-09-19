import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// Initialize Supabase client with service role key (bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Generate secure random password
function generateSecurePassword(): string {
  return crypto.randomBytes(32).toString('hex');
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email, code } = req.body;

    console.log("Verify OTP request:", { email, code }); // Debug log

    if (!email || !code) {
      return res.status(400).json({ error: "Email in koda sta obvezna" });
    }

    // Validate code format (4 digits)
    if (!/^\d{4}$/.test(code)) {
      return res.status(400).json({ error: "Koda mora biti 4-mestna številka" });
    }

    // Find all valid OTP codes for this email (not used, not expired)
    const { data: otpCodes, error: otpError } = await supabase
      .from("parent_auth_codes")
      .select("*")
      .eq("parent_email", email.toLowerCase().trim())
      .eq("used", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (otpError) {
      console.error("OTP verification error:", otpError);
      return res.status(500).json({ error: "Napaka pri preverjanju kode" });
    }

    if (!otpCodes || otpCodes.length === 0) {
      return res.status(401).json({ 
        error: "Neveljavna ali potekla koda" 
      });
    }

    // Find matching code using bcrypt.compare()
    let matchedCode = null;
    for (const otpRecord of otpCodes) {
      const isMatch = await bcrypt.compare(code, otpRecord.code);
      if (isMatch) {
        matchedCode = otpRecord;
        break;
      }
    }

    if (!matchedCode) {
      return res.status(401).json({ 
        error: "Neveljavna ali potekla koda" 
      });
    }

    // Mark code as used
    const { error: updateError } = await supabase
      .from("parent_auth_codes")
      .update({ used: true })
      .eq("id", matchedCode.id);

    if (updateError) {
      console.error("OTP update error:", updateError);
    }

    // Find players where this email is guardian1_email or guardian2_email
    const { data: players, error: playersError } = await supabase
      .from("players")
      .select("id, first_name, last_name, date_of_birth, guardian1_email, guardian2_email")
      .or(`guardian1_email.eq.${email.toLowerCase().trim()},guardian2_email.eq.${email.toLowerCase().trim()}`)
      .eq("is_active", true);

    if (playersError) {
      console.error("Players lookup error:", playersError);
      return res.status(500).json({ error: "Napaka pri iskanju igralcev" });
    }

    if (!players || players.length === 0) {
      return res.status(404).json({ error: "Skrbnik ne obstaja" });
    }

    // ============================================
    // SUPABASE AUTH INTEGRATION - ELEGANT SOLUTION
    // ============================================
    
    const parentEmail = email.toLowerCase().trim();
    let authUserId: string;
    let accessToken: string;
    let refreshToken: string;

    // Check if user already exists in auth.users
    const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error("List users error:", listError);
    }

    const existingUser = listData?.users?.find((u: any) => u.email === parentEmail);

    if (existingUser) {
      // User exists - get their stored password from metadata or generate new one
      authUserId = existingUser.id;
      
      let userPassword = existingUser.user_metadata?.auto_generated_password;
      
      if (!userPassword) {
        // No stored password - generate new one and update metadata
        userPassword = generateSecurePassword();
        
        const { error: updateError } = await supabase.auth.admin.updateUserById(
          authUserId,
          {
            password: userPassword,
            user_metadata: {
              ...existingUser.user_metadata,
              auto_generated_password: userPassword,
              is_parent: true,
              verified_via_otp: true,
            },
          }
        );

        if (updateError) {
          console.error("Password update error:", updateError);
          return res.status(500).json({ error: "Napaka pri posodabljanju gesla" });
        }
      }

      // Sign in with password to get valid tokens
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: parentEmail,
        password: userPassword,
      });

      if (signInError || !signInData.session) {
        console.error("Sign in error:", signInError);
        return res.status(500).json({ error: "Napaka pri prijavi" });
      }

      accessToken = signInData.session.access_token;
      refreshToken = signInData.session.refresh_token;
      
    } else {
      // Create new auth user with auto-generated password
      const userPassword = generateSecurePassword();

      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: parentEmail,
        password: userPassword,
        email_confirm: true,
        user_metadata: {
          auto_generated_password: userPassword,
          is_parent: true,
          verified_via_otp: true,
        },
      });

      if (createError || !newUser.user) {
        console.error("User creation error:", createError);
        return res.status(500).json({ error: "Napaka pri ustvarjanju uporabnika" });
      }

      authUserId = newUser.user.id;

      // Create profile entry
      const { error: profileError } = await supabase
        .from("profiles")
        .insert({
          id: authUserId,
          email: parentEmail,
          full_name: `Starš (${parentEmail})`,
          role: "parent",
          created_at: new Date().toISOString(),
        });

      if (profileError) {
        console.error("Profile creation error:", profileError);
        // Continue even if profile creation fails - not critical
      }

      // Sign in to get session tokens
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: parentEmail,
        password: userPassword,
      });

      if (signInError || !signInData.session) {
        console.error("Sign in error:", signInError);
        return res.status(500).json({ error: "Napaka pri prijavi" });
      }

      accessToken = signInData.session.access_token;
      refreshToken = signInData.session.refresh_token;
    }

    // Ensure parent role exists in user_roles
    const { data: existingRole } = await supabase
      .from("user_roles")
      .select("*")
      .eq("user_id", authUserId)
      .eq("role", "parent")
      .maybeSingle();

    if (!existingRole) {
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: authUserId,
          role: "parent",
          created_at: new Date().toISOString(),
        });

      if (roleError) {
        console.error("Role creation error:", roleError);
        // Continue - role might already exist due to unique constraint
      }
    }

    console.log("Auth success for:", parentEmail, "User ID:", authUserId); // Debug log

    return res.status(200).json({
      success: true,
      session: {
        access_token: accessToken,
        refresh_token: refreshToken,
        user: {
          id: authUserId,
          email: parentEmail,
        },
      },
      parent: {
        email: parentEmail,
        auth_user_id: authUserId,
      },
      children: players,
    });

  } catch (error: any) {
    console.error("Verify OTP error:", error);
    return res.status(500).json({ 
      error: error.message || "Napaka pri preverjanju kode" 
    });
  }
}