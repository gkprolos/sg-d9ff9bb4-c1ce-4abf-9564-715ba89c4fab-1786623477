import { supabase } from "@/integrations/supabase/client";

export async function getActiveVenues() {
  const { data, error } = await supabase
    .from("venues")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) throw error;
  return data || [];
}

export function formatVenueName(venue: {
  name: string;
  city?: string;
  room_designation?: string;
}): string {
  const parts = [venue.name];
  if (venue.city) parts.push(venue.city);
  if (venue.room_designation) parts.push(`(${venue.room_designation})`);
  return parts.join(", ");
}