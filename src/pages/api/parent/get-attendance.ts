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
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { child_id, start_date, end_date } = req.query;

    console.log("=== GET ATTENDANCE API ===");
    console.log("Received params:", { child_id, start_date, end_date });

    if (!child_id || !start_date || !end_date) {
      return res.status(400).json({ error: "child_id, start_date, and end_date so obvezni" });
    }

    console.log("Querying activities table...");

    // Query activities directly with inner join on attendance
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
        attendance!inner (
          id,
          player_id,
          status
        )
      `)
      .eq("attendance.player_id", child_id)
      .gte("activity_date", start_date)
      .lte("activity_date", end_date)
      .order("activity_date", { ascending: true });

    if (error) {
      console.error("Supabase query error:", error);
      return res.status(500).json({ 
        error: "Napaka pri nalaganju prisotnosti", 
        details: error.message,
        hint: error.hint,
        code: error.code
      });
    }

    console.log("Activities found:", activities?.length || 0);

    if (!activities || activities.length === 0) {
      console.log("No activities found for this player in date range");
      return res.status(200).json({
        success: true,
        attendance: [],
      });
    }

    console.log("Sample activity:", activities[0]);

    // Transform data to match expected format
    const attendance = activities.map(activity => {
      const attendanceRecord = Array.isArray(activity.attendance) 
        ? activity.attendance[0] 
        : activity.attendance;

      return {
        id: attendanceRecord.id,
        player_id: attendanceRecord.player_id,
        status: attendanceRecord.status,
        date: activity.activity_date,
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
      };
    });

    console.log("Transformed attendance records:", attendance.length);
    console.log("Sample transformed record:", attendance[0]);

    return res.status(200).json({
      success: true,
      attendance,
    });

  } catch (error: any) {
    console.error("=== GET ATTENDANCE ERROR ===");
    console.error("Error:", error);
    console.error("Stack:", error.stack);
    return res.status(500).json({ 
      error: error.message || "Napaka pri nalaganju prisotnosti",
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}