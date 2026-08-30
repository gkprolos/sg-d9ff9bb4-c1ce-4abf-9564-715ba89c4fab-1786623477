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
    const { playerId, startDate, endDate } = req.body;

    if (!playerId || !startDate || !endDate) {
      return res.status(400).json({ error: "playerId, startDate, and endDate so obvezni" });
    }

    // Query attendance records with activities JOIN
    const { data: attendance, error } = await supabase
      .from("attendance_records")
      .select(`
        id,
        player_id,
        status,
        activities (
          id,
          activity_date,
          start_time,
          end_time,
          activity_type_id,
          is_home_game,
          venue_id,
          venues (
            id,
            name,
            city
          )
        )
      `)
      .eq("player_id", playerId)
      .gte("activities.activity_date", startDate)
      .lte("activities.activity_date", endDate)
      .order("activities(activity_date)", { ascending: true });

    if (error) {
      console.error("Get attendance error:", error);
      return res.status(500).json({ error: "Napaka pri nalaganju prisotnosti" });
    }

    return res.status(200).json({
      success: true,
      attendance: attendance || [],
    });

  } catch (error: any) {
    console.error("Get attendance error:", error);
    return res.status(500).json({ 
      error: error.message || "Napaka pri nalaganju prisotnosti" 
    });
  }
}