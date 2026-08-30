import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

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
    const { playerId } = req.body;

    if (!playerId) {
      return res.status(400).json({ error: "Player ID is required" });
    }

    // Get player's current team(s)
    const { data: teamPlayers, error: teamError } = await supabase
      .from("team_players")
      .select("team_id")
      .eq("player_id", playerId);

    if (teamError) throw teamError;

    if (!teamPlayers || teamPlayers.length === 0) {
      return res.status(200).json({ schedules: [] });
    }

    const teamIds = teamPlayers.map(tp => tp.team_id);

    // Get schedule templates for these teams
    const { data: schedules, error: schedulesError } = await supabase
      .from("schedule_templates")
      .select(`
        id,
        team_id,
        venue_id,
        day_of_week,
        start_time,
        end_time,
        default_activity_type_id,
        is_active,
        venues (
          id,
          name,
          city
        )
      `)
      .in("team_id", teamIds)
      .eq("is_active", true);

    if (schedulesError) throw schedulesError;

    return res.status(200).json({ schedules: schedules || [] });
  } catch (error: any) {
    console.error("Error fetching child schedules:", error);
    return res.status(500).json({ 
      error: error.message || "Napaka pri nalaganju urnika" 
    });
  }
}