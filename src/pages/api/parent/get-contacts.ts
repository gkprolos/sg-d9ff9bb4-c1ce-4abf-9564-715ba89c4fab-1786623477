import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client with service role key (bypasses RLS)
const supabaseAdmin = createClient(
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

  const { parent_email } = req.query;

  if (!parent_email || typeof parent_email !== "string") {
    return res.status(400).json({ error: "Manjka email starša" });
  }

  try {
    console.log("=== GET PARENT CONTACTS ===");
    console.log("Parent email:", parent_email);

    // 1. Pridobimo vse igralce, kjer je ta oseba skrbnik
    const { data: players, error: playersError } = await supabaseAdmin
      .from("players")
      .select("id")
      .or(`guardian1_email.ilike.${parent_email},guardian2_email.ilike.${parent_email}`)
      .eq("is_active", true);

    if (playersError) {
      console.error("Players query error:", playersError);
      throw playersError;
    }

    console.log("Players found:", players?.length || 0);

    if (!players || players.length === 0) {
      return res.status(200).json([]);
    }

    const playerIds = players.map((p) => p.id);

    // 2. Pridobimo vse ekipe, kjer so ti igralci vpisani
    const { data: teamPlayers, error: tpError } = await supabaseAdmin
      .from("team_players")
      .select("team_id")
      .in("player_id", playerIds);

    if (tpError) {
      console.error("Team players query error:", tpError);
      throw tpError;
    }

    console.log("Team players found:", teamPlayers?.length || 0);

    if (!teamPlayers || teamPlayers.length === 0) {
      return res.status(200).json([]);
    }

    const teamIds = [...new Set(teamPlayers.map((tp) => tp.team_id))];
    console.log("Unique teams:", teamIds.length);
    console.log("Team IDs:", teamIds);

    // 3. Pridobimo vse trenerje, ki so dodeljeni tem ekipam
    const { data: teamCoaches, error: tcError } = await supabaseAdmin
      .from("team_coaches")
      .select(`
        coach_id,
        profiles (
          id,
          full_name,
          email
        )
      `)
      .in("team_id", teamIds)
      .eq("is_active", true);

    if (tcError) {
      console.error("Team coaches query error:", tcError);
      throw tcError;
    }

    console.log("Team coaches raw result:", teamCoaches);
    console.log("Team coaches found:", teamCoaches?.length || 0);

    // Filter out null profiles and map to contacts
    const validCoaches = (teamCoaches || []).filter((tc: any) => tc.profiles);
    console.log("Valid coaches (with profiles):", validCoaches.length);

    const contacts = validCoaches.map((tc: any) => ({
      user_id: tc.profiles.id,
      email: tc.profiles.email,
      name: tc.profiles.full_name,
      contact_type: "coach",
    }));

    console.log("Mapped coach contacts:", contacts);

    // 4. Dodamo še vse admine
    const { data: admins, error: adminsError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, profiles!inner(id, full_name, email)")
      .eq("role", "admin");

    if (adminsError) {
      console.error("Admins query error:", adminsError);
    }

    console.log("Admins found:", admins?.length || 0);

    if (admins) {
      admins.forEach((admin: any) => {
        if (!contacts.find((c) => c.user_id === admin.profiles.id)) {
          contacts.push({
            user_id: admin.profiles.id,
            email: admin.profiles.email,
            name: admin.profiles.full_name,
            contact_type: "admin",
          });
        }
      });
    }

    console.log("Total contacts:", contacts.length);

    return res.status(200).json(contacts);
  } catch (error: any) {
    console.error("=== GET PARENT CONTACTS ERROR ===");
    console.error("Error:", error);
    return res.status(500).json({ error: error.message });
  }
}