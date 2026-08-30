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
    if (password.length < 8) {
      return res.status(400).json({ error: "Geslo mora imeti vsaj 8 znakov" });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Check if parent credential already exists
    const { data: existing, error: checkError } = await supabase
      .from("parent_credentials")
      .select("parent_email")
      .eq("parent_email", email.toLowerCase().trim())
      .maybeSingle();

    if (checkError) {
      console.error("Check credential error:", checkError);
      return res.status(500).json({ error: "Napaka pri preverjanju obstoječega računa" });
    }

    if (existing) {
      // Update existing credential
      const { error: updateError } = await supabase
        .from("parent_credentials")
        .update({ 
          password_hash: passwordHash,
          updated_at: new Date().toISOString()
        })
        .eq("parent_email", email.toLowerCase().trim());

      if (updateError) {
        console.error("Update password error:", updateError);
        return res.status(500).json({ error: "Napaka pri posodabljanju gesla" });
      }
    } else {
      // Create new credential
      const { error: insertError } = await supabase
        .from("parent_credentials")
        .insert({
          parent_email: email.toLowerCase().trim(),
          password_hash: passwordHash,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (insertError) {
        console.error("Insert credential error:", insertError);
        return res.status(500).json({ error: "Napaka pri ustvarjanju računa" });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Geslo uspešno nastavljeno"
    });

  } catch (error: any) {
    console.error("Set password error:", error);
    return res.status(500).json({ 
      error: error.message || "Napaka pri nastavitvi gesla" 
    });
  }
}