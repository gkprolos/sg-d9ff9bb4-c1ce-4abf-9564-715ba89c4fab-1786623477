import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

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
    const { parentEmail } = req.body;

    if (!parentEmail) {
      return res.status(400).json({ error: "Parent email je obvezen" });
    }

    const emailLower = parentEmail.toLowerCase().trim();

    // Query for guardian1_email matches
    const { data: data1, error: error1 } = await supabase
      .from("players")
      .select(`
        id,
        first_name,
        last_name,
        date_of_birth,
        gender
      `)
      .eq("guardian1_email", emailLower)
      .eq("is_active", true);

    // Query for guardian2_email matches
    const { data: data2, error: error2 } = await supabase
      .from("players")
      .select(`
        id,
        first_name,
        last_name,
        date_of_birth,
        gender
      `)
      .eq("guardian2_email", emailLower)
      .eq("is_active", true);

    if (error1 || error2) {
      console.error("Get children error:", error1 || error2);
      return res.status(500).json({ error: "Napaka pri nalaganju otrok" });
    }

    // Combine results and remove duplicates by ID
    const combined = [...(data1 || []), ...(data2 || [])];
    const unique = combined.filter((child, index, self) =>
      index === self.findIndex((c) => c.id === child.id)
    );

    // Sort by last name, then first name
    unique.sort((a, b) => {
      const lastNameCompare = a.last_name.localeCompare(b.last_name);
      if (lastNameCompare !== 0) return lastNameCompare;
      return a.first_name.localeCompare(b.first_name);
    });

    return res.status(200).json({
      success: true,
      children: unique,
    });

  } catch (error: any) {
    console.error("Get children error:", error);
    return res.status(500).json({ 
      error: error.message || "Napaka pri nalaganju otrok" 
    });
  }
}