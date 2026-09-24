import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, generateNewMessageEmailHTML } from "@/lib/emailService";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { conversation_id, sender_name, message_content } = req.body;

  if (!conversation_id || !sender_name || !message_content) {
    return res.status(400).json({ 
      error: "conversation_id, sender_name, and message_content are required" 
    });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // Get conversation details
    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .select("subject, team_id")
      .eq("id", conversation_id)
      .single();

    if (convError || !conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Get parent participants (those with parent_email)
    const { data: participants, error: partError } = await supabase
      .from("conversation_participants")
      .select("parent_email")
      .eq("conversation_id", conversation_id)
      .not("parent_email", "is", null);

    if (partError) {
      console.error("Error fetching participants:", partError);
      return res.status(500).json({ error: "Failed to fetch participants" });
    }

    if (!participants || participants.length === 0) {
      return res.status(200).json({ 
        message: "No parent participants to notify",
        emailsSent: 0 
      });
    }

    // Prepare email content
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://klub.oklubnik.si";
    const conversationLink = `${siteUrl}/messaging`;
    const messagePreview = message_content.length > 100 
      ? message_content.substring(0, 100) + "..." 
      : message_content;

    const emailHTML = generateNewMessageEmailHTML(
      sender_name,
      conversation.subject,
      messagePreview,
      conversationLink
    );

    // Send email to each parent participant
    let successCount = 0;
    const emailPromises = participants.map(async (participant) => {
      if (!participant.parent_email) return false;

      const success = await sendEmail({
        to: participant.parent_email,
        subject: `Novo sporočilo: ${conversation.subject}`,
        html: emailHTML
      });

      if (success) successCount++;
      return success;
    });

    await Promise.all(emailPromises);

    console.log(`Sent ${successCount}/${participants.length} notification emails`);

    res.status(200).json({ 
      message: "Notifications sent",
      emailsSent: successCount,
      totalParticipants: participants.length
    });
  } catch (error: any) {
    console.error("Notification error:", error);
    res.status(500).json({ error: error.message });
  }
}