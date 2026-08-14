import { supabase } from "@/integrations/supabase/client";

export async function getSchedulesByTeam(teamId: string) {
  const { data, error } = await supabase
    .from("schedule_templates")
    .select(`
      *,
      venues(name, city, address, room_designation)
    `)
    .eq("team_id", teamId)
    .eq("is_active", true)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) throw error;
  return data || [];
}