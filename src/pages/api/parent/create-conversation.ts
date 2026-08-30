import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { parentEmail, subject, teamId, participantIds, initialMessage } = req.body;

  if (!parentEmail || !subject || !participantIds || !Array.isArray(participantIds) || participantIds.length === 0 || !initialMessage) {
    return res.status(400).json({ 
      error: "Manjkajo obvezni podatki: parentEmail, subject, participantIds, initialMessage" 
    });
  }

  try {
    // Use service role key to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get first admin to use as technical creator
    const { data: adminUser, error: adminError } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1)
      .single();

    if (adminError || !adminUser) {
      console.error("Failed to get admin user:", adminError);
      return res.status(500).json({ error: "Ni mogoče določiti administratorja" });
    }

    const creatorId = adminUser.user_id;

    // Create conversation
    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .insert({
        subject,
        team_id: teamId || null,
        created_by: creatorId,
        is_archived: false
      })
      .select()
      .single();

    if (convError || !conversation) {
      console.error("Failed to create conversation:", convError);
      return res.status(500).json({ error: "Napaka pri ustvarjanju pogovora" });
    }

    // Add participants
    const participants = participantIds.map(id => ({
      conversation_id: conversation.id,
      user_id: id.includes('@') ? null : id,
      parent_email: id.includes('@') ? id : null
    }));

    // Always add creator (admin) as participant if not already included
    const creatorAlreadyIncluded = participants.some(p => p.user_id === creatorId);
    if (!creatorAlreadyIncluded) {
      participants.push({
        conversation_id: conversation.id,
        user_id: creatorId,
        parent_email: null
      });
    }

    // Always add parent as participant
    const parentAlreadyIncluded = participants.some(p => p.parent_email === parentEmail);
    if (!parentAlreadyIncluded) {
      participants.push({
        conversation_id: conversation.id,
        user_id: null,
        parent_email: parentEmail
      });
    }

    const { error: participantsError } = await supabase
      .from("conversation_participants")
      .insert(participants);

    if (participantsError) {
      console.error("Failed to add participants:", participantsError);
      // Rollback - delete conversation
      await supabase.from("conversations").delete().eq("id", conversation.id);
      return res.status(500).json({ error: "Napaka pri dodajanju prejemnikov" });
    }

    // Create initial message (from parent perspective)
    const { error: messageError } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversation.id,
        sender_id: null,
        sender_parent_email: parentEmail,
        content: initialMessage
      });

    if (messageError) {
      console.error("Failed to create initial message:", messageError);
      return res.status(500).json({ error: "Napaka pri ustvarjanju prvega sporočila" });
    }

    return res.status(200).json({ 
      success: true,
      conversationId: conversation.id 
    });
  } catch (error: any) {
    console.error("Create conversation error:", error);
    return res.status(500).json({ 
      error: error.message || "Napaka pri ustvarjanju pogovora" 
    });
  }
}