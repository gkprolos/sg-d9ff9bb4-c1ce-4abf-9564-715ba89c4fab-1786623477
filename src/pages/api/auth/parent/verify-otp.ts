import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email, code } = req.body;

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
    // SUPABASE AUTH INTEGRATION
    // ============================================
    
    const parentEmail = email.toLowerCase().trim();
    let authUserId: string;
    let sessionData: any;

    // Check if user already exists in auth.users
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === parentEmail);

    if (existingUser) {
      // User exists - create session for existing user
      authUserId = existingUser.id;
      
      const { data: sessionResponse, error: sessionError } = await supabase.auth.admin.createSession({
        user_id: authUserId,
      });

      if (sessionError) {
        console.error("Session creation error:", sessionError);
        return res.status(500).json({ error: "Napaka pri ustvarjanju seje" });
      }

      sessionData = sessionResponse;
    } else {
      // Create new auth user (anonymous-style with email metadata)
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: parentEmail,
        email_confirm: true,
        user_metadata: {
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

      // Create session for new user
      const { data: sessionResponse, error: sessionError } = await supabase.auth.admin.createSession({
        user_id: authUserId,
      });

      if (sessionError) {
        console.error("Session creation error:", sessionError);
        return res.status(500).json({ error: "Napaka pri ustvarjanju seje" });
      }

      sessionData = sessionResponse;
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

    return res.status(200).json({
      success: true,
      session: {
        access_token: sessionData.access_token,
        refresh_token: sessionData.refresh_token,
        expires_in: sessionData.expires_in,
        expires_at: sessionData.expires_at,
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