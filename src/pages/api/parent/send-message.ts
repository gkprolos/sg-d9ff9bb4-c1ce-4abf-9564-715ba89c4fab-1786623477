import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { conversation_id, parent_email, content } = req.body;

  if (!conversation_id || !parent_email || !content) {
    return res.status(400).json({ error: "conversation_id, parent_email, and content are required" });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // Verify parent is participant
    const { data: participant } = await supabase
      .from("conversation_participants")
      .select("parent_email")
      .eq("conversation_id", conversation_id)
      .eq("parent_email", parent_email)
      .single();

    if (!participant) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Insert message
    const { data: message, error } = await supabase
      .from("messages")
      .insert({
        conversation_id,
        content: content.trim(),
        sender_id: null,
        sender_parent_email: parent_email
      })
      .select()
      .single();

    if (error) throw error;

    res.status(200).json(message);
  } catch (error: any) {
    console.error("Send parent message error:", error);
    res.status(500).json({ error: error.message });
  }
}