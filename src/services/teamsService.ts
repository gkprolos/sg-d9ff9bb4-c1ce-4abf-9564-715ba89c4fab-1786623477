import { supabase } from "@/integrations/supabase/client";

/**
 * Get all active (non-archived) teams
 * Any active coach can view all teams
 */
export async function getActiveTeams() {
  const { data, error } = await supabase
    .from("teams")
    .select(`
      id,
      name,
      short_name,
      season_id,
      age_category,
      gender,
      is_archived,
      seasons(name, is_active)
    `)
    .eq("is_archived", false)
    .order("name", { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Get team by ID
 */
export async function getTeamById(teamId: string) {
  const { data, error } = await supabase
    .from("teams")
    .select(`
      *,
      seasons(name, is_active)
    `)
    .eq("id", teamId)
    .single();

  if (error) throw error;
  return data;
}