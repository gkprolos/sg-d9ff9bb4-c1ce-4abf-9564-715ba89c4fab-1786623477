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

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({ 
        error: "Geslo mora imeti najmanj 6 znakov" 
      });
    }

    // Verify that email belongs to a guardian
    const { data: guardian, error: guardianError } = await supabase
      .from("guardians")
      .select("id, email")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    if (guardianError || !guardian) {
      return res.status(404).json({ 
        error: "Email naslov ni registriran v sistemu" 
      });
    }

    // Hash password with bcrypt
    const passwordHash = await bcrypt.hash(password, 10);

    // Upsert parent credential (insert or update)
    const { data: credential, error: upsertError } = await supabase
      .from("parent_credentials")
      .upsert(
        {
          parent_email: email.toLowerCase().trim(),
          password_hash: passwordHash,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "parent_email",
        }
      )
      .select()
      .single();

    if (upsertError) {
      console.error("Password upsert error:", upsertError);
      return res.status(500).json({ error: "Napaka pri shranjevanju gesla" });
    }

    return res.status(200).json({
      success: true,
      message: "Geslo je bilo uspešno nastavljeno",
    });

  } catch (error: any) {
    console.error("Set password error:", error);
    return res.status(500).json({ 
      error: error.message || "Napaka pri nastavljanju gesla" 
    });
  }
}