import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { conversation_id, parent_email } = req.body;

  if (!conversation_id || !parent_email) {
    return res.status(400).json({ error: "conversation_id and parent_email are required" });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // Update last_read_at
    const { error } = await supabase
      .from("conversation_participants")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", conversation_id)
      .eq("parent_email", parent_email);

    if (error) throw error;

    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("Mark read error:", error);
    res.status(500).json({ error: error.message });
  }
}