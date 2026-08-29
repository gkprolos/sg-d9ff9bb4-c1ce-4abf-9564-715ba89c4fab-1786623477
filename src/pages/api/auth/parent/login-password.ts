import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

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
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email in geslo sta obvezna" });
    }

    // Get parent credential
    const { data: credential, error: credError } = await supabase
      .from("parent_credentials")
      .select("password_hash")
      .eq("parent_email", email.toLowerCase().trim())
      .maybeSingle();

    if (credError) {
      console.error("Credential lookup error:", credError);
      return res.status(500).json({ error: "Napaka pri preverjanju gesla" });
    }

    if (!credential || !credential.password_hash) {
      return res.status(401).json({ 
        error: "Neveljavno geslo ali email" 
      });
    }

    // Verify password with bcrypt
    const passwordMatch = await bcrypt.compare(password, credential.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ 
        error: "Neveljavno geslo ali email" 
      });
    }

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

    // Update last login timestamp
    await supabase
      .from("parent_credentials")
      .update({ last_login_at: new Date().toISOString() })
      .eq("parent_email", email.toLowerCase().trim());

    return res.status(200).json({
      success: true,
      guardian: {
        id: guardian.id,
        email: guardian.email,
        name: guardian.name,
      },
      children,
    });

  } catch (error: any) {
    console.error("Login password error:", error);
    return res.status(500).json({ 
      error: error.message || "Napaka pri prijavi" 
    });
  }
}