import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
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

    // Hash the submitted code
    const codeHash = crypto.createHash("sha256").update(code).digest("hex");

    // Find valid OTP code
    const { data: otpCodes, error: otpError } = await supabase
      .from("parent_auth_codes")
      .select("*")
      .eq("parent_email", email.toLowerCase().trim())
      .eq("code", codeHash)
      .eq("used", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1);

    if (otpError) {
      console.error("OTP verification error:", otpError);
      return res.status(500).json({ error: "Napaka pri preverjanju kode" });
    }

    if (!otpCodes || otpCodes.length === 0) {
      return res.status(401).json({ 
        error: "Neveljavna ali potekla koda" 
      });
    }

    const otpCode = otpCodes[0];

    // Mark code as used
    const { error: updateError } = await supabase
      .from("parent_auth_codes")
      .update({ used: true })
      .eq("id", otpCode.id);

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

    // Get guardian info
    const { data: guardian, error: guardianError } = await supabase
      .from("guardians")
      .select("id, email, name")
      .eq("email", email.toLowerCase().trim())
      .single();

    if (guardianError || !guardian) {
      return res.status(404).json({ error: "Guardian ne obstaja" });
    }

    // Get children for this parent
    const { data: playerGuardians, error: pgError } = await supabase
      .from("player_guardians")
      .select(`
        player_id,
        players:player_id (
          id,
          first_name,
          last_name,
          date_of_birth
        )
      `)
      .eq("guardian_id", guardian.id);

    if (pgError) {
      console.error("Player guardians error:", pgError);
    }

    const children = playerGuardians?.map(pg => pg.players).filter(Boolean) || [];

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
      guardian: {
        id: guardian.id,
        email: guardian.email,
        name: guardian.name,
      },
      children,
    });

  } catch (error: any) {
    console.error("Verify OTP error:", error);
    return res.status(500).json({ 
      error: error.message || "Napaka pri preverjanju kode" 
    });
  }
}