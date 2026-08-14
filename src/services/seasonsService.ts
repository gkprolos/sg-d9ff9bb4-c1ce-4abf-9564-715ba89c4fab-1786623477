import { supabase } from "@/integrations/supabase/client";

export interface Season {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function getActiveSeason(): Promise<Season | null> {
  const { data, error } = await supabase
    .from("seasons")
    .select("*")
    .eq("is_active", true)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No active season found
      return null;
    }
    throw error;
  }

  return data;
}

export async function getAllSeasons(): Promise<Season[]> {
  const { data, error } = await supabase
    .from("seasons")
    .select("*")
    .order("start_date", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createSeason(seasonData: {
  name: string;
  start_date: string;
  end_date: string;
  is_active?: boolean;
}) {
  const { data, error } = await supabase
    .from("seasons")
    .insert([seasonData])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateSeason(id: string, updates: Partial<Season>) {
  const { data, error } = await supabase
    .from("seasons")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function setActiveSeason(seasonId: string) {
  // First, deactivate all seasons
  const { error: deactivateError } = await supabase
    .from("seasons")
    .update({ is_active: false })
    .neq("id", "00000000-0000-0000-0000-000000000000"); // Update all

  if (deactivateError) throw deactivateError;

  // Then activate the selected season
  const { data, error } = await supabase
    .from("seasons")
    .update({ is_active: true })
    .eq("id", seasonId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteSeason(id: string) {
  const { error } = await supabase
    .from("seasons")
    .delete()
    .eq("id", id);

  if (error) throw error;
}