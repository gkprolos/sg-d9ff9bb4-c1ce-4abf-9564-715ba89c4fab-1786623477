import { supabase } from "@/integrations/supabase/client";

export async function getTeamsByCoach(coachId: string) {
  const { data, error } = await supabase
    .from("team_coaches")
    .select(`
      teams(
        id,
        name,
        season_id,
        age_category,
        gender,
        is_archived
      )
    `)
    .eq("coach_id", coachId)
    .eq("teams.is_archived", false);

  if (error) throw error;

  // Flatten the nested structure
  return (data?.map((item: any) => item.teams).filter(Boolean) || []);
}

export async function getTeamPlayers(teamId: string) {
  const { data, error } = await supabase
    .from("team_players")
    .select(`
      players(
        id,
        first_name,
        last_name,
        birth_date,
        jersey_number,
        is_active
      )
    `)
    .eq("team_id", teamId)
    .eq("players.is_active", true);

  if (error) throw error;

  return (data?.map((item: any) => item.players).filter(Boolean) || []);
}