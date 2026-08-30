import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// Initialize Supabase client with service role key (bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
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

    // Check if parent has password set
    const { data: credential, error: credError } = await supabase
      .from("parent_credentials")
      .select("password_hash")
      .eq("parent_email", email.toLowerCase().trim())
      .maybeSingle();

    if (credError) {
      console.error("Credential check error:", credError);
    }

    const hasPassword = credential && credential.password_hash !== null;

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

    // Update last login timestamp if credential exists
    if (credential) {
      await supabase
        .from("parent_credentials")
        .update({ last_login_at: new Date().toISOString() })
        .eq("parent_email", email.toLowerCase().trim());
    }

    return res.status(200).json({
      success: true,
      hasPassword,
      parent: {
        email: email.toLowerCase().trim(),
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