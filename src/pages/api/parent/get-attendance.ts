import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { child_id, start_date, end_date } = req.query;

  if (!child_id || !start_date || !end_date) {
    return res.status(400).json({ error: "Missing required parameters: child_id, start_date, end_date" });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get child's team assignments
    const { data: teamPlayers, error: teamError } = await supabase
      .from("team_players")
      .select("team_id")
      .eq("player_id", child_id);

    if (teamError) throw teamError;

    if (!teamPlayers || teamPlayers.length === 0) {
      return res.status(200).json({ attendance: [] });
    }

    const teamIds = teamPlayers.map((tp) => tp.team_id);

    // Get attendance records for the date range
    const { data: attendanceData, error: attendanceError } = await supabase
      .from("attendance")
      .select(`
        id,
        player_id,
        activity_id,
        status,
        activities!inner(
          id,
          activity_date,
          start_time,
          end_time,
          team_id
        )
      `)
      .eq("player_id", child_id)
      .in("activities.team_id", teamIds)
      .gte("activities.activity_date", start_date)
      .lte("activities.activity_date", end_date)
      .order("activities.activity_date", { ascending: true });

    if (attendanceError) throw attendanceError;

    // Transform data to include date field
    const attendance = (attendanceData || []).map((record: any) => ({
      id: record.id,
      player_id: record.player_id,
      activity_id: record.activity_id,
      status: record.status,
      date: record.activities?.activity_date || "",
      activities: record.activities
    }));

    console.log("Attendance records found:", attendance.length);

    return res.status(200).json({ attendance });
  } catch (error: any) {
    console.error("Error fetching attendance:", error);
    return res.status(500).json({ 
      error: "Failed to fetch attendance",
      details: error.message 
    });
  }
}