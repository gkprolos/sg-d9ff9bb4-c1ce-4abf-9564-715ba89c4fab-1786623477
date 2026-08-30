import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { parent_email, status = "active" } = req.query;

  if (!parent_email || typeof parent_email !== "string") {
    return res.status(400).json({ error: "parent_email is required" });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // Get conversations where parent is a participant
    const { data: conversations, error } = await supabase
      .from("conversations")
      .select(`
        id,
        subject,
        team_id,
        status,
        created_at,
        updated_at,
        teams(name),
        conversation_participants!inner(
          user_id,
          parent_email,
          last_read_at,
          profiles(full_name)
        ),
        messages(
          content,
          created_at,
          sender_id,
          sender_parent_email,
          profiles(full_name)
        )
      `)
      .eq("status", status)
      .eq("conversation_participants.parent_email", parent_email)
      .order("updated_at", { ascending: false });

    if (error) throw error;

    // Calculate unread counts and format last message
    const conversationsWithUnread = conversations?.map((conv: any) => {
      const myParticipant = conv.conversation_participants.find(
        (p: any) => p.parent_email === parent_email
      );
      
      const lastReadAt = myParticipant?.last_read_at;
      const unreadCount = lastReadAt
        ? conv.messages.filter((m: any) => new Date(m.created_at) > new Date(lastReadAt)).length
        : conv.messages.length;

      const lastMessage = conv.messages[conv.messages.length - 1];
      const senderName = lastMessage?.sender_parent_email || lastMessage?.profiles?.full_name || "Sistem";

      return {
        ...conv,
        unread_count: unreadCount,
        last_message: lastMessage ? {
          content: lastMessage.content,
          created_at: lastMessage.created_at,
          sender_name: senderName
        } : undefined
      };
    }) || [];

    res.status(200).json(conversationsWithUnread);
  } catch (error: any) {
    console.error("Get parent conversations error:", error);
    res.status(500).json({ error: error.message });
  }
}