import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { conversation_id, parent_email } = req.query;

  if (!conversation_id || !parent_email) {
    return res.status(400).json({ error: "conversation_id and parent_email are required" });
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

    // Get messages
    const { data: messages, error } = await supabase
      .from("messages")
      .select(`
        id,
        content,
        created_at,
        sender_id,
        sender_parent_email,
        profiles(full_name)
      `)
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: true });

    if (error) throw error;

    res.status(200).json(messages || []);
  } catch (error: any) {
    console.error("Get parent messages error:", error);
    res.status(500).json({ error: error.message });
  }
}