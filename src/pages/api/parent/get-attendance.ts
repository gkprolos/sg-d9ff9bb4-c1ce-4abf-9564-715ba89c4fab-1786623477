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

    // Query activities directly with inner join on attendance_records
    // This is the correct Supabase syntax for filtering by related table
    const { data: activities, error } = await supabase
      .from("activities")
      .select(`
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
        ),
        attendance_records!inner (
          id,
          player_id,
          status
        )
      `)
      .eq("attendance_records.player_id", playerId)
      .gte("activity_date", startDate)
      .lte("activity_date", endDate)
      .order("activity_date", { ascending: true });

    if (error) {
      console.error("Get attendance error:", error);
      return res.status(500).json({ error: "Napaka pri nalaganju prisotnosti" });
    }

    // Transform data to match expected format
    const attendance = activities?.map(activity => ({
      id: activity.attendance_records[0].id,
      player_id: activity.attendance_records[0].player_id,
      status: activity.attendance_records[0].status,
      activities: {
        id: activity.id,
        activity_date: activity.activity_date,
        start_time: activity.start_time,
        end_time: activity.end_time,
        activity_type_id: activity.activity_type_id,
        home_game: activity.is_home_game,
        venue_id: activity.venue_id,
        venues: activity.venues
      }
    })) || [];

    return res.status(200).json({
      success: true,
      attendance,
    });

  } catch (error: any) {
    console.error("Get attendance error:", error);
    return res.status(500).json({ 
      error: error.message || "Napaka pri nalaganju prisotnosti" 
    });
  }
}