import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Users,
  Calendar,
  Building,
  Activity,
  TrendingDown,
  Clock,
  DollarSign,
  Car,
  Plus,
  ChevronDown,
  MapPin } from
"lucide-react";

interface DashboardStats {
  activePlayers: number;
  malePlayers: number;
  femalePlayers: number;
  activeTeams: number;
  activeVenues: number;
  totalActivities: number;
  monthlyActivities: number;
  monthlyHours: number;
  monthlyKilometers: number;
  monthlyAmount: number;
}

interface PlayerAttendance {
  player_id: string;
  player_name: string;
  team_name: string;
  head_coach_name: string;
  present: number;
  absent: number;
  excused: number;
  total_records: number;
  attendance_rate: number;
}

interface CoachHours {
  coach_id: string;
  coach_name: string;
  team_name: string;
  total_hours: number;
  activity_count: number;
}

interface CoachKilometers {
  coach_id: string;
  coach_name: string;
  team_name: string;
  total_kilometers: number;
  activity_count: number;
}

interface PlayerDetail {
  player_id: string;
  player_name: string;
  team_name: string;
  monthly_stats: Array<{
    month: string;
    total: number;
    present: number;
    absent: number;
    excused: number;
    rate: number;
  }>;
}

export default function DashboardPage() {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    activePlayers: 0,
    malePlayers: 0,
    femalePlayers: 0,
    activeTeams: 0,
    activeVenues: 0,
    totalActivities: 0,
    monthlyActivities: 0,
    monthlyHours: 0,
    monthlyKilometers: 0,
    monthlyAmount: 0
  });

  const [seasons, setSeasons] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedSeason, setSelectedSeason] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [selectedCoach, setSelectedCoach] = useState<string>("all");
  const [showMobilePlayerAttendance, setShowMobilePlayerAttendance] = useState(false);
  const [showMobileCoachHours, setShowMobileCoachHours] = useState(false);
  const [showMobileCoachKilometers, setShowMobileCoachKilometers] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const [coachHours, setCoachHours] = useState<any[]>([]);
  const [coachKilometers, setCoachKilometers] = useState<any[]>([]);
  const [playerAttendance, setPlayerAttendance] = useState<PlayerAttendance[]>([]);
  const [teamStats, setTeamStats] = useState<any[]>([]);
  const [showLowAttendanceOnly, setShowLowAttendanceOnly] = useState(true);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedPlayerDetail, setSelectedPlayerDetail] = useState<PlayerDetail | null>(null);
  const [coachRates, setCoachRates] = useState<any>(null);

  const isAdmin = userRole === "admin";

  useEffect(() => {
    loadInitialData();
    if (!isAdmin && user?.id) {
      loadCoachRates();
    }
  }, [user, userRole]);

  useEffect(() => {
    if (user) {
      loadTeams();
      loadCoaches();
      // Don't load stats until we have a valid season selected
      if (!selectedSeason || selectedSeason.length === 0) {
        console.log("Skipping loadStats - no valid season selected");
        return;
      }
      console.log("Loading stats with season:", selectedSeason);
      loadStats();
      loadPlayerAttendance();
      loadCoachHours();
      loadCoachKilometers();
      loadTeamStats();
    }
  }, [user, isAdmin, selectedMonth, selectedSeason, selectedTeam]);

  async function loadInitialData() {
    try {
      // Load seasons
      const { data: seasonsData } = await supabase.
      from("seasons").
      select("id, name, is_active").
      order("name", { ascending: false });

      setSeasons(seasonsData || []);

      // Set active season as default
      const activeSeason = seasonsData?.find((s) => s.is_active);
      if (activeSeason) {
        setSelectedSeason(activeSeason.id);
      }

      // Load teams - different approach for admin vs coach
      if (isAdmin) {
        // Admin: load all teams directly
        const { data: teamsData } = await supabase.
        from("teams").
        select("id, name").
        eq("is_archived", false).
        order("name", { ascending: true });

        setTeams(teamsData || []);
      } else if (user?.id) {
        // Coach: load only assigned teams via team_coaches
        const { data: coachTeamsData } = await supabase.
        from("team_coaches").
        select(`
            team_id,
            teams(id, name)
          `).
        eq("coach_id", user.id).
        eq("is_active", true);

        const teamsData = (coachTeamsData || []).
        map((ct) => ct.teams).
        filter(Boolean).
        sort((a, b) => a.name.localeCompare(b.name));

        setTeams(teamsData);
      }
    } catch (error: any) {
      console.error("Error loading initial data:", error);
    }
  }

  async function loadCoachRates() {
    try {
      if (!user?.id || !selectedSeason) return;

      const { data, error } = await supabase.
      from("coach_rates").
      select("*").
      eq("coach_id", user.id).
      eq("season_id", selectedSeason).
      maybeSingle();

      if (error) {
        console.error("Error loading coach rates:", error);
        return;
      }

      setCoachRates(data);
    } catch (error: any) {
      console.error("Error loading coach rates:", error);
    }
  }

  async function loadStats() {
    try {
      console.log("=== loadStats START ===");
      console.log("isAdmin:", isAdmin);
      console.log("selectedMonth:", selectedMonth);
      console.log("selectedSeason:", selectedSeason);
      console.log("user?.id:", user?.id);

      const now = new Date();
      const [year, month] = selectedMonth.split('-');
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();

      // Use full timestamp range to ensure we catch all activities on last day of month
      const statsMonthStart = `${year}-${month}-01T00:00:00.000`;
      const statsMonthEnd = `${year}-${month}-${String(lastDay).padStart(2, "0")}T23:59:59.999`;

      // Get active players count
      let playersQuery = supabase.
      from("players").
      select("id", { count: "exact", head: true }).
      eq("is_active", true);

      // For coaches, filter by their team's players
      if (!isAdmin && user?.id) {
        const { data: coachTeams } = await supabase.
        from("team_coaches").
        select("team_id").
        eq("coach_id", user.id).
        eq("is_active", true);

        const teamIds = (coachTeams || []).map((ct) => ct.team_id);

        if (teamIds.length > 0) {
          const { data: teamPlayers } = await supabase.
          from("team_players").
          select("player_id").
          in("team_id", teamIds);

          const playerIds = (teamPlayers || []).map((tp) => tp.player_id);

          if (playerIds.length > 0) {
            playersQuery = playersQuery.in("id", playerIds);
          } else {
            playersQuery = playersQuery.eq("id", "00000000-0000-0000-0000-000000000000");
          }
        } else {
          playersQuery = playersQuery.eq("id", "00000000-0000-0000-0000-000000000000");
        }
      }

      const { count: playersCount, error: playersError } = await playersQuery;
      console.log("playersCount:", playersCount, "error:", playersError);

      // Get male/female players count
      const { count: malePlayersCount } = await supabase.
      from("players").
      select("id", { count: "exact", head: true }).
      eq("is_active", true).
      eq("gender", "M");

      const { count: femalePlayersCount } = await supabase.
      from("players").
      select("id", { count: "exact", head: true }).
      eq("is_active", true).
      eq("gender", "F");

      console.log("playersCount:", playersCount, "error:", playersError);

      // Get active teams count
      let teamsQuery = supabase.
      from("teams").
      select("id", { count: "exact", head: true }).
      eq("is_archived", false);

      if (selectedSeason && selectedSeason.length > 0) {
        teamsQuery = teamsQuery.eq("season_id", selectedSeason);
      }

      // For coaches, only count their teams
      if (!isAdmin && user?.id) {
        const { data: coachTeams } = await supabase.
        from("team_coaches").
        select("team_id").
        eq("coach_id", user.id).
        eq("is_active", true);

        const teamIds = (coachTeams || []).map((ct) => ct.team_id);

        if (teamIds.length > 0) {
          teamsQuery = teamsQuery.in("id", teamIds);
        } else {
          teamsQuery = teamsQuery.eq("id", "00000000-0000-0000-0000-000000000000");
        }
      }

      const { count: teamsCount, error: teamsError } = await teamsQuery;
      console.log("teamsCount:", teamsCount, "error:", teamsError);

      // Get active venues count (same for all users)
      const { count: venuesCount, error: venuesError } = await supabase.
      from("venues").
      select("id", { count: "exact", head: true }).
      eq("is_active", true);
      console.log("venuesCount:", venuesCount, "error:", venuesError);

      // Get total activities count FOR SELECTED MONTH
      let totalActivitiesQuery = supabase.
      from("activities").
      select("id", { count: "exact", head: true }).
      gte("activity_date", statsMonthStart).
      lte("activity_date", statsMonthEnd);

      // Season filter is OPTIONAL - only apply if a season is selected
      if (selectedSeason && selectedSeason.length > 0) {
        totalActivitiesQuery = totalActivitiesQuery.eq("season_id", selectedSeason);
      }

      if (!isAdmin && user?.id) {
        const { data: coachActivities } = await supabase.
        from("activity_coaches").
        select("activity_id").
        eq("coach_id", user.id);

        const activityIds = (coachActivities || []).map((ca) => ca.activity_id);
        if (activityIds.length > 0) {
          totalActivitiesQuery = totalActivitiesQuery.in("id", activityIds);
        } else {
          totalActivitiesQuery = totalActivitiesQuery.eq("id", "00000000-0000-0000-0000-000000000000");
        }
      }

      const { count: totalActivitiesCount, error: totalActivitiesError } = await totalActivitiesQuery;
      console.log("totalActivitiesCount:", totalActivitiesCount, "error:", totalActivitiesError);

      // Load coach_rates for active season (same as billing.tsx)
      const { data: coachRatesData, error: ratesLoadError } = await supabase.
      from("coach_rates").
      select(`
          coach_id,
          head_type1_per_hour,
          head_type2_per_hour,
          head_type3_fixed,
          assistant_type1_per_hour,
          assistant_type2_per_hour,
          assistant_type3_fixed,
          rate_per_km,
          seasons!coach_rates_season_id_fkey(is_active)
        `).
      eq("seasons.is_active", true);

      if (ratesLoadError) {
        console.error("Error loading coach rates for dashboard:", ratesLoadError);
      }

      // Create coach rates map
      const dashboardCoachRatesMap = new Map(
        (coachRatesData || []).map((cr) => [cr.coach_id, cr])
      );

      console.log(`Dashboard: Loaded ${dashboardCoachRatesMap.size} coach rates for calculation`);

      // Get monthly activities with detailed data
      let monthlyActivitiesQuery = supabase.
      from("activities").
      select(`
          *,
          teams!inner (name),
          activity_coaches (
            coach_id,
            role,
            hours_worked,
            mileage_km,
            total_amount
          )
        `).
      gte("activity_date", statsMonthStart).
      lte("activity_date", statsMonthEnd);

      // Season filter is OPTIONAL - only apply if a season is selected
      if (selectedSeason && selectedSeason.length > 0) {
        monthlyActivitiesQuery = monthlyActivitiesQuery.eq("season_id", selectedSeason);
      }

      if (!isAdmin && user?.id) {
        const { data: coachActivities } = await supabase.
        from("activity_coaches").
        select("activity_id").
        eq("coach_id", user.id);

        const activityIds = (coachActivities || []).map((ca) => ca.activity_id);
        if (activityIds.length > 0) {
          monthlyActivitiesQuery = monthlyActivitiesQuery.in("id", activityIds);
        } else {
          monthlyActivitiesQuery = monthlyActivitiesQuery.eq("id", "00000000-0000-0000-0000-000000000000");
        }
      }

      const { data: monthlyActivities, error: monthlyActivitiesError } = await monthlyActivitiesQuery;

      if (monthlyActivitiesError) {
        console.error("Error loading monthly activities:", monthlyActivitiesError);
      }

      // Calculate monthly totals using coach_rates (same as billing.tsx)
      let totalHours = 0;
      let totalKilometers = 0;
      let totalAmount = 0;

      (monthlyActivities || []).forEach((activity) => {
        if (activity.activity_coaches) {
          activity.activity_coaches.forEach((ac: any) => {
            const isMyActivity = !isAdmin && ac.coach_id === user?.id;
            const isAdminView = isAdmin;

            if (isMyActivity || isAdminView) {
              const hours = ac.hours_worked || 0;
              totalHours += hours;

              const kilometers = ac.mileage_km || 0;
              totalKilometers += kilometers;

              // Calculate amount from coach_rates (NOT ac.total_amount!)
              const coachRate = dashboardCoachRatesMap.get(ac.coach_id);
              if (coachRate) {
                const isHead = ac.role === "head";
                const kmRate = coachRate.rate_per_km || 0;

                let amount = 0;

                if (activity.activity_type_id === 1) {
                  // Type 1: Training
                  const hourlyRate = isHead ? coachRate.head_type1_per_hour || 0 : coachRate.assistant_type1_per_hour || 0;
                  amount = hours * hourlyRate;
                } else if (activity.activity_type_id === 2) {
                  // Type 2: Training outside (fallback to type1 if NULL)
                  const type2Rate = isHead ? coachRate.head_type2_per_hour : coachRate.assistant_type2_per_hour;
                  const type1Fallback = isHead ? coachRate.head_type1_per_hour : coachRate.assistant_type1_per_hour;
                  const hourlyRate = type2Rate !== null ? type2Rate : type1Fallback || 0;
                  amount = hours * hourlyRate;
                } else if (activity.activity_type_id === 3) {
                  // Type 3: Match - use FIXED rate (not hourly!)
                  const matchRate = isHead ? coachRate.head_type3_fixed || 0 : coachRate.assistant_type3_fixed || 0;
                  amount = matchRate;
                }

                // Add kilometer amount
                amount += kilometers * kmRate;

                totalAmount += amount;
              } else {
                console.warn(`No coach_rates for coach ${ac.coach_id} - amount not calculated`);
              }
            }
          });
        }
      });

      console.log("Monthly calculations:");
      console.log("  totalHours:", totalHours);
      console.log("  totalKilometers:", totalKilometers);
      console.log("  totalAmount:", totalAmount);

      const finalStats = {
        activePlayers: playersCount || 0,
        malePlayers: malePlayersCount || 0,
        femalePlayers: femalePlayersCount || 0,
        activeTeams: teamsCount || 0,
        activeVenues: venuesCount || 0,
        totalActivities: totalActivitiesCount || 0,
        monthlyActivities: monthlyActivities?.length || 0,
        monthlyHours: Math.round(totalHours * 10) / 10,
        monthlyKilometers: Math.round(totalKilometers * 10) / 10,
        monthlyAmount: Math.round(totalAmount * 100) / 100
      };

      console.log("=== FINAL STATS ===");
      console.log(finalStats);
      console.log("=== loadStats END ===");

      setStats(finalStats);
    } catch (error: any) {
      console.error("Error loading stats:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Napaka pri nalaganju statistike"
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadPlayerAttendance() {
    try {
      const [year, month] = selectedMonth.split("-");
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();

      // Use full timestamp range to ensure we catch all activities on last day of month
      const startDate = `${year}-${month}-01T00:00:00.000`;
      const endDate = `${year}-${month}-${String(lastDay).padStart(2, "0")}T23:59:59.999`;

      let teamIds: string[] = [];

      // Determine which teams to load
      if (selectedTeam === "all") {
        if (isAdmin) {
          // Admin: load all active teams
          const { data: allTeams } = await supabase.
          from("teams").
          select("id").
          eq("is_archived", false);

          teamIds = (allTeams || []).map((t) => t.id);
        } else if (user?.id) {
          // Coach: load only their teams
          const { data: coachTeams } = await supabase.
          from("team_coaches").
          select("team_id").
          eq("coach_id", user.id).
          eq("is_active", true);

          teamIds = (coachTeams || []).map((ct) => ct.team_id);
        }
      } else {
        // Single team selected
        if (!isAdmin && user?.id) {
          // Verify coach has access to this team
          const { data: coachTeam } = await supabase.
          from("team_coaches").
          select("team_id").
          eq("coach_id", user.id).
          eq("team_id", selectedTeam).
          eq("is_active", true).
          maybeSingle();

          if (!coachTeam) {
            setPlayerAttendance([]);
            return;
          }
        }
        teamIds = [selectedTeam];
      }

      if (teamIds.length === 0) {
        setPlayerAttendance([]);
        return;
      }

      // Get all activities for selected teams in selected month
      const { data: activities, error: activitiesError } = await supabase.
      from("activities").
      select("id, activity_date, team_id").
      in("team_id", teamIds).
      gte("activity_date", startDate).
      lte("activity_date", endDate);

      if (activitiesError) throw activitiesError;

      if (!activities || activities.length === 0) {
        setPlayerAttendance([]);
        return;
      }

      // Get team info with head coach for all teams
      const { data: teamsData } = await supabase.
      from("teams").
      select(`
          id,
          name,
          head_coach_id,
          profiles!teams_head_coach_id_fkey(full_name)
        `).
      in("id", teamIds);

      const teamsMap = new Map(
        (teamsData || []).map((t) => [
        t.id,
        {
          name: t.name,
          headCoachName: t.profiles?.full_name || "Ni določen"
        }]
        )
      );

      // Get all players in these teams
      const { data: teamPlayers } = await supabase.
      from("team_players").
      select(`
          player_id,
          team_id,
          players(id, first_name, last_name)
        `).
      in("team_id", teamIds);

      if (!teamPlayers || teamPlayers.length === 0) {
        setPlayerAttendance([]);
        return;
      }

      const activityIds = activities.map((a) => a.id);

      // Get attendance records for these activities
      const { data: attendanceRecords } = await supabase.
      from("attendance_records").
      select("player_id, activity_id, status").
      in("activity_id", activityIds);

      // Build activity-to-team map
      const activityTeamMap = new Map(
        activities.map((a) => [a.id, a.team_id])
      );

      // Calculate stats per player per team
      const playerStatsArray: PlayerAttendance[] = [];

      teamPlayers.forEach((tp: any) => {
        const playerId = tp.player_id;
        const teamId = tp.team_id;
        const teamInfo = teamsMap.get(teamId);

        if (!teamInfo) return;

        // Get activities for this player's team
        const teamActivityIds = activities.
        filter((a) => a.team_id === teamId).
        map((a) => a.id);

        // Get attendance records for this player in this team's activities
        const playerRecords = (attendanceRecords || []).filter(
          (ar: any) => ar.player_id === playerId && teamActivityIds.includes(ar.activity_id)
        );

        const present = playerRecords.filter((r: any) => r.status === 1).length;
        const absent = playerRecords.filter((r: any) => r.status === 0).length;
        const excused = playerRecords.filter((r: any) => r.status === 2).length;
        const total = playerRecords.length;

        const attendanceRate = total > 0 ? present / total * 100 : 0;

        playerStatsArray.push({
          player_id: playerId,
          player_name: `${tp.players.first_name} ${tp.players.last_name}`,
          team_name: teamInfo.name,
          head_coach_name: teamInfo.headCoachName,
          present,
          absent,
          excused,
          total_records: total,
          attendance_rate: attendanceRate
        });
      });

      // Sort by team name, then player name
      playerStatsArray.sort((a, b) => {
        const teamCompare = a.team_name.localeCompare(b.team_name);
        if (teamCompare !== 0) return teamCompare;
        return a.player_name.localeCompare(b.player_name);
      });

      setPlayerAttendance(playerStatsArray);
    } catch (error: any) {
      console.error("Napaka pri nalaganju obiska igralcev:", error);
      setPlayerAttendance([]);
    }
  }

  async function loadTeams() {
    try {
      let query = supabase.
      from("teams").
      select(`
          id, 
          name, 
          short_name,
          head_coach_id,
          profiles!teams_head_coach_id_fkey(full_name)
        `).
      eq("is_archived", false).
      order("name", { ascending: true });

      // For coaches, only show their teams
      if (!isAdmin && user?.id) {
        const { data: coachTeams } = await supabase.
        from("team_coaches").
        select("team_id").
        eq("coach_id", user.id).
        eq("is_active", true);

        const teamIds = (coachTeams || []).map((ct) => ct.team_id);

        if (teamIds.length > 0) {
          query = query.in("id", teamIds);
        } else {
          setTeams([]);
          return;
        }
      }

      const { data, error } = await query;

      if (error) throw error;
      setTeams(data || []);
    } catch (error: any) {
      console.error("Napaka pri nalaganju selekcij:", error);
    }
  }

  async function loadCoaches() {
    try {
      // Get coaches from coach_rates table (anyone who has billing rates is a coach)
      const { data: coachRatesData, error } = await supabase.
      from("coach_rates").
      select(`
          coach_id,
          profiles!inner (
            id,
            full_name,
            email
          )
        `).
      eq("is_active", true);

      if (error) throw error;

      // Deduplicate coaches (same coach may have multiple rate records)
      const uniqueCoaches = new Map();
      (coachRatesData || []).forEach((rate: any) => {
        if (rate.profiles && !uniqueCoaches.has(rate.coach_id)) {
          uniqueCoaches.set(rate.coach_id, {
            id: rate.profiles.id,
            full_name: rate.profiles.full_name,
            email: rate.profiles.email
          });
        }
      });

      const coachesList = Array.from(uniqueCoaches.values()).sort((a: any, b: any) =>
      a.full_name.localeCompare(b.full_name)
      );

      setCoachRates(coachesList);
    } catch (error: any) {
      console.error("Napaka pri nalaganju trenerjev:", error);
    }
  }

  async function loadCoachHours() {
    try {
      const [year, month] = selectedMonth.split("-");
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();

      // Use full timestamp range to ensure we catch all activities on last day of month
      const startDate = `${year}-${month}-01T00:00:00.000`;
      const endDate = `${year}-${month}-${String(lastDay).padStart(2, "0")}T23:59:59.999`;

      let coachIds: string[] = [];
      let teamIds: string[] = [];

      // Determine filters
      if (isAdmin) {
        if (selectedCoach !== "all") {
          coachIds = [selectedCoach];
        }
        if (selectedTeam !== "all") {
          teamIds = [selectedTeam];
        }
      } else if (user?.id) {
        coachIds = [user.id];
        if (selectedTeam !== "all") {
          teamIds = [selectedTeam];
        }
      }

      // Build query for activities
      let activitiesQuery = supabase.
      from("activities").
      select(`
          id,
          team_id,
          start_time,
          end_time,
          activity_coaches(
            coach_id,
            hours_worked
          ),
          teams(name)
        `).
      gte("activity_date", startDate).
      lte("activity_date", endDate);

      if (teamIds.length > 0) {
        activitiesQuery = activitiesQuery.in("team_id", teamIds);
      }

      const { data: activities, error: activitiesError } = await activitiesQuery;
      if (activitiesError) throw activitiesError;

      if (!activities || activities.length === 0) {
        setCoachHours([]);
        return;
      }

      // Group by coach and team
      const hoursMap = new Map<string, CoachHours>();

      for (const activity of activities) {
        const activityCoaches = activity.activity_coaches || [];

        for (const ac of activityCoaches) {
          if (coachIds.length > 0 && !coachIds.includes(ac.coach_id)) continue;

          const key = `${ac.coach_id}-${activity.team_id}`;

          if (!hoursMap.has(key)) {
            hoursMap.set(key, {
              coach_id: ac.coach_id,
              coach_name: "", // Will fill later
              team_name: activity.teams?.name || "",
              total_hours: 0,
              activity_count: 0
            });
          }

          const entry = hoursMap.get(key)!;
          entry.total_hours += ac.hours_worked || 0;
          entry.activity_count += 1;
        }
      }

      // Get coach names
      const uniqueCoachIds = Array.from(new Set(Array.from(hoursMap.values()).map((h) => h.coach_id)));
      const { data: coachProfiles } = await supabase.
      from("profiles").
      select("id, full_name").
      in("id", uniqueCoachIds);

      const coachNameMap = new Map(
        (coachProfiles || []).map((p) => [p.id, p.full_name])
      );

      const hoursArray = Array.from(hoursMap.values()).map((h) => ({
        ...h,
        coach_name: coachNameMap.get(h.coach_id) || "Neznan trener"
      }));

      // Sort by coach name, then team name
      hoursArray.sort((a, b) => {
        const coachCompare = a.coach_name.localeCompare(b.coach_name);
        if (coachCompare !== 0) return coachCompare;
        return a.team_name.localeCompare(b.team_name);
      });

      setCoachHours(hoursArray);
    } catch (error: any) {
      console.error("Napaka pri nalaganju ur trenerjev:", error);
      setCoachHours([]);
    }
  }

  async function loadCoachKilometers() {
    try {
      const [year, month] = selectedMonth.split("-");
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();

      // Use full timestamp range to ensure we catch all activities on last day of month
      const startDate = `${year}-${month}-01T00:00:00.000`;
      const endDate = `${year}-${month}-${String(lastDay).padStart(2, "0")}T23:59:59.999`;

      let coachIds: string[] = [];
      let teamIds: string[] = [];

      // Determine filters
      if (isAdmin) {
        if (selectedCoach !== "all") {
          coachIds = [selectedCoach];
        }
        if (selectedTeam !== "all") {
          teamIds = [selectedTeam];
        }
      } else if (user?.id) {
        coachIds = [user.id];
        if (selectedTeam !== "all") {
          teamIds = [selectedTeam];
        }
      }

      // Build query for activities
      let activitiesQuery = supabase.
      from("activities").
      select(`
          id,
          team_id,
          activity_coaches(
            coach_id,
            mileage_km
          ),
          teams(name)
        `).
      gte("activity_date", startDate).
      lte("activity_date", endDate);

      if (teamIds.length > 0) {
        activitiesQuery = activitiesQuery.in("team_id", teamIds);
      }

      const { data: activities, error: activitiesError } = await activitiesQuery;
      if (activitiesError) throw activitiesError;

      if (!activities || activities.length === 0) {
        setCoachKilometers([]);
        return;
      }

      // Group by coach and team
      const kilometersMap = new Map<string, CoachKilometers>();

      for (const activity of activities) {
        const activityCoaches = activity.activity_coaches || [];

        for (const ac of activityCoaches) {
          if (coachIds.length > 0 && !coachIds.includes(ac.coach_id)) continue;
          if (!ac.mileage_km || ac.mileage_km === 0) continue; // Skip zero kilometers

          const key = `${ac.coach_id}-${activity.team_id}`;

          if (!kilometersMap.has(key)) {
            kilometersMap.set(key, {
              coach_id: ac.coach_id,
              coach_name: "", // Will fill later
              team_name: activity.teams?.name || "",
              total_kilometers: 0,
              activity_count: 0
            });
          }

          const entry = kilometersMap.get(key)!;
          entry.total_kilometers += ac.mileage_km || 0;
          entry.activity_count += 1;
        }
      }

      // Get coach names
      const uniqueCoachIds = Array.from(new Set(Array.from(kilometersMap.values()).map((k) => k.coach_id)));
      const { data: coachProfiles } = await supabase.
      from("profiles").
      select("id, full_name").
      in("id", uniqueCoachIds);

      const coachNameMap = new Map(
        (coachProfiles || []).map((p) => [p.id, p.full_name])
      );

      const kilometersArray = Array.from(kilometersMap.values()).map((k) => ({
        ...k,
        coach_name: coachNameMap.get(k.coach_id) || "Neznan trener"
      }));

      // Sort by coach name, then team name
      kilometersArray.sort((a, b) => {
        const coachCompare = a.coach_name.localeCompare(b.coach_name);
        if (coachCompare !== 0) return coachCompare;
        return a.team_name.localeCompare(b.team_name);
      });

      setCoachKilometers(kilometersArray);
    } catch (error: any) {
      console.error("Napaka pri nalaganju kilometrov trenerjev:", error);
      setCoachKilometers([]);
    }
  }

  async function loadTeamStats() {
    try {
      const [selectedYear, selectedMonthNum] = selectedMonth.split('-');
      const lastDay = new Date(parseInt(selectedYear), parseInt(selectedMonthNum), 0).getDate();

      // Use full timestamp range to ensure we catch all activities on last day of month
      const monthStart = `${selectedYear}-${selectedMonthNum}-01T00:00:00.000`;
      const monthEnd = `${selectedYear}-${selectedMonthNum}-${String(lastDay).padStart(2, "0")}T23:59:59.999`;

      let query = supabase.
      from("activities").
      select(`
          id,
          team_id,
          activity_type_id,
          teams!inner (name),
          activity_coaches!inner (
            hours_worked
          )
        `).
      gte("activity_date", monthStart).
      lte("activity_date", monthEnd);

      // Season filter is OPTIONAL - only apply if a season is selected
      if (selectedSeason && selectedSeason.length > 0) {
        query = query.eq("season_id", selectedSeason);
      }

      if (selectedTeam && selectedTeam !== "all") {
        query = query.eq("team_id", selectedTeam);
      }

      if (!isAdmin && user?.id) {
        const { data: coachActivities } = await supabase.
        from("activity_coaches").
        select("activity_id").
        eq("coach_id", user.id);

        const activityIds = (coachActivities || []).map((ca) => ca.activity_id);
        if (activityIds.length > 0) {
          query = query.in("id", activityIds);
        } else {
          setTeamStats([]);
          return;
        }
      }

      const { data: activities } = await query;

      const teamStatsMap = new Map<string, {
        team_id: string;
        team_name: string;
        activity_count: number;
        training_count: number;
        match_count: number;
        total_hours: number;
      }>();

      (activities || []).forEach((activity: any) => {
        const teamName = activity.teams.name;
        const existing = teamStatsMap.get(activity.team_id);

        const isTraining = activity.activity_type_id === 1 || activity.activity_type_id === 2;
        const isMatch = activity.activity_type_id === 3;

        let activityHours = 0;
        (activity.activity_coaches || []).forEach((ac: any) => {
          activityHours += ac.hours_worked || 0;
        });

        if (existing) {
          existing.activity_count += 1;
          if (isTraining) existing.training_count += 1;
          if (isMatch) existing.match_count += 1;
          existing.total_hours += activityHours;
        } else {
          teamStatsMap.set(activity.team_id, {
            team_id: activity.team_id,
            team_name: teamName,
            activity_count: 1,
            training_count: isTraining ? 1 : 0,
            match_count: isMatch ? 1 : 0,
            total_hours: activityHours
          });
        }
      });

      const teamStatsList = Array.from(teamStatsMap.values()).sort((a, b) =>
      a.team_name.localeCompare(b.team_name)
      );

      setTeamStats(teamStatsList);
    } catch (error: any) {
      console.error("Napaka pri nalaganju statistike po selekcijah:", error);
    }
  }

  async function handlePlayerClick(playerId: string) {
    try {
      const { data: playerData } = await supabase.
      from("players").
      select("first_name, last_name").
      eq("id", playerId).
      single();

      if (!playerData) return;

      const now = new Date();
      const monthlyStats = [];

      for (let i = 0; i < 12; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const detailYear = date.getFullYear();
        const detailMonth = date.getMonth() + 1;
        const daysInDetailMonth = new Date(detailYear, detailMonth, 0).getDate();

        // Use full timestamp range to ensure we catch all activities on last day of month
        const detailMonthStart = `${detailYear}-${String(detailMonth).padStart(2, "0")}-01T00:00:00.000`;
        const detailMonthEnd = `${detailYear}-${String(detailMonth).padStart(2, "0")}-${String(daysInDetailMonth).padStart(2, "0")}T23:59:59.999`;

        const { data: activities } = await supabase.
        from("activities").
        select("id").
        gte("activity_date", detailMonthStart).
        lte("activity_date", detailMonthEnd);

        if (!activities || activities.length === 0) {
          monthlyStats.push({
            month: `${detailYear}-${String(detailMonth).padStart(2, "0")}`,
            total: 0,
            present: 0,
            absent: 0,
            excused: 0,
            rate: 0
          });
          continue;
        }

        const activityIds = activities.map((a) => a.id);

        const { data: attendance } = await supabase.
        from("attendance_records").
        select("status").
        eq("player_id", playerId).
        in("activity_id", activityIds);

        const total = attendance?.length || 0;
        const present = attendance?.filter((a) => a.status === 1).length || 0;
        const absent = attendance?.filter((a) => a.status === 0).length || 0;
        const excused = attendance?.filter((a) => a.status === 2).length || 0;
        const rate = total > 0 ? Math.round(present / total * 100) : 0;

        monthlyStats.push({
          month: `${detailYear}-${String(detailMonth).padStart(2, "0")}`,
          total,
          present,
          absent,
          excused,
          rate
        });
      }

      setSelectedPlayerDetail({
        player_id: playerId,
        player_name: `${playerData.first_name} ${playerData.last_name}`,
        team_name: playerAttendance.find((p) => p.player_id === playerId)?.team_name || "",
        monthly_stats: monthlyStats
      });
      setDetailDialogOpen(true);
    } catch (error: any) {
      console.error("Error loading player detail:", error);
    }
  }

  const monthNames = [
  "Januar", "Februar", "Marec", "April", "Maj", "Junij",
  "Julij", "Avgust", "September", "Oktober", "November", "December"];


  const generateMonthOptions = () => {
    const options = [];
    const now = new Date();

    // Generate last 12 months
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const label = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
      options.push({ value, label });
    }

    return options;
  };

  const daysInSelectedMonth = () => {
    const [year, month] = selectedMonth.split("-");
    return new Date(parseInt(year), parseInt(month), 0).getDate();
  };

  return (
    <ProtectedRoute allowedRoles={["admin", "coach"]}>
      <AppLayout>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">
                {isAdmin ? "Nadzorna plošča" : "Moj pregled"}
              </h2>
              <p className="text-muted-foreground">
                {isAdmin ?
                "Pregled statistike kluba in aktivnosti" :
                "Pregled mojih aktivnosti in statistike"}
              </p>
            </div>

            {!isAdmin &&
            <Link href="/attendance">
                <Button size="lg" className="w-full sm:w-auto">
                  <Plus className="mr-2 h-5 w-5" />
                  Dodaj prisotnost
                </Button>
              </Link>
            }
          </div>

          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Aktivne selekcije</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.activeTeams}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Aktivni igralci</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.activePlayers}</div>
              </CardContent>
            </Card>

            {isAdmin &&
            <>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Dvorane</CardTitle>
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.activeVenues}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Skupaj aktivnosti</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.totalActivities}</div>
                    <p className="text-xs text-muted-foreground">v {selectedMonth}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Ure v mesecu</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.monthlyHours.toFixed(1)}</div>
                    <p className="text-xs text-muted-foreground">skupno ur</p>
                  </CardContent>
                </Card>
              </>
            }
          </div>

          {/* Second row - only for admin */}
          {isAdmin &&
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Kilometri v mesecu</CardTitle>
                  <Car className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.monthlyKilometers.toFixed(1)}</div>
                  <p className="text-xs text-muted-foreground">skupno km</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Mesečni obračun</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.monthlyAmount.toFixed(2)} €</div>
                  <p className="text-xs text-muted-foreground">skupni stroški</p>
                </CardContent>
              </Card>
            </div>
          }

          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="month_filter">Mesec</Label>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger id="month_filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {generateMonthOptions().map((option) =>
                      <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="team_filter">Selekcija</Label>
                  <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                    <SelectTrigger id="team_filter">
                      <SelectValue placeholder="Izberi selekcijo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Vse selekcije</SelectItem>
                      {teams.map((team) => {
                        const coachName = team.profiles?.full_name || "Brez trenerja";
                        const displayName = `${team.short_name || team.name} (Trener: ${coachName})`;
                        return (
                          <SelectItem key={team.id} value={team.id}>
                            {displayName}
                          </SelectItem>);

                      })}
                    </SelectContent>
                  </Select>
                </div>

                {isAdmin &&
                <div className="space-y-2">
                    <Label htmlFor="coach_filter">Trener</Label>
                    <Select value={selectedCoach} onValueChange={setSelectedCoach}>
                      <SelectTrigger id="coach_filter">
                        <SelectValue placeholder="Izberi trenerja" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Vsi trenerji</SelectItem>
                        {(coachRates || []).map((coach: any) =>
                      <SelectItem key={coach.id} value={coach.id}>
                            {coach.full_name}
                          </SelectItem>
                      )}
                      </SelectContent>
                    </Select>
                  </div>
                }
              </div>
            </CardContent>
          </Card>

          {/* Team Stats - Work Overview by Team */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                <CardTitle>Pregled dela po selekcijah</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {teamStats.length === 0 ?
              <p className="text-sm text-muted-foreground text-center py-8">
                  Ni podatkov o delu selekcij za izbrano obdobje
                </p> :

              <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Selekcija</TableHead>
                        <TableHead className="text-right">Število aktivnosti</TableHead>
                        <TableHead className="text-right">Treningi</TableHead>
                        <TableHead className="text-right">Tekme</TableHead>
                        <TableHead className="text-right">Skupaj ur</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teamStats.map((team, idx) =>
                    <TableRow key={`${team.team_id}-${idx}`}>
                          <TableCell className="font-medium">{team.team_name}</TableCell>
                          <TableCell className="text-right">{team.activity_count}</TableCell>
                          <TableCell className="text-right">{team.training_count}</TableCell>
                          <TableCell className="text-right">{team.match_count}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {team.total_hours.toFixed(1)} h
                          </TableCell>
                        </TableRow>
                    )}
                    </TableBody>
                  </Table>
                </div>
              }
            </CardContent>
          </Card>

          {/* Player Attendance by Team */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Pregled obiska po igralcih</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant={showLowAttendanceOnly ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowLowAttendanceOnly(!showLowAttendanceOnly)}
                    className="hidden md:inline-flex" style={{ backgroundColor: "#3b82f6", backgroundImage: "none" }}>
                    
                    {showLowAttendanceOnly ? "Prikaži vse" : "Samo nizka prisotnost"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowMobilePlayerAttendance(!showMobilePlayerAttendance)}
                    className="md:hidden">
                    
                    {showMobilePlayerAttendance ? "Skrij pregled" : "Prikaži pregled"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            {/* Desktop view - always visible */}
            <CardContent className="hidden md:block">
              {playerAttendance.length === 0 ?
              <p className="text-sm text-muted-foreground text-center py-8">
                  Ni podatkov o obisku za izbrano obdobje
                </p> :

              <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Igralec</TableHead>
                          <TableHead className="text-right">Prisotnosti</TableHead>
                          <TableHead className="text-right">Odsotnosti</TableHead>
                          <TableHead className="text-right">Javljene</TableHead>
                          <TableHead className="text-right">Odstotek</TableHead>
                          <TableHead>Selekcija</TableHead>
                          <TableHead>Glavni trener</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {playerAttendance.
                      filter((player) => !showLowAttendanceOnly || player.attendance_rate < 75).
                      map((player, idx) =>
                      <TableRow key={`${player.player_id}-${player.team_name}-${idx}`}>
                              <TableCell>{player.player_name}</TableCell>
                              <TableCell className="text-right">{player.present}</TableCell>
                              <TableCell className="text-right">{player.absent}</TableCell>
                              <TableCell className="text-right">{player.excused}</TableCell>
                              <TableCell className="text-right">
                                {player.attendance_rate.toFixed(1)}%
                              </TableCell>
                              <TableCell>{player.team_name}</TableCell>
                              <TableCell>{player.head_coach_name}</TableCell>
                            </TableRow>
                      )}
                      </TableBody>
                    </Table>
                  </div>
                  {showLowAttendanceOnly && playerAttendance.filter((p) => p.attendance_rate < 75).length === 0 &&
                <p className="text-sm text-muted-foreground text-center py-4 border-t mt-4">
                      Ni igralcev z nižjo prisotnostjo od 75%. Odlično delo! 🎉
                    </p>
                }
                </>
              }
            </CardContent>

            {/* Mobile view - toggle visibility */}
            {showMobilePlayerAttendance &&
            <CardContent className="block md:hidden">
                <div className="mb-4">
                  <Button
                  variant={showLowAttendanceOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowLowAttendanceOnly(!showLowAttendanceOnly)}
                  className="w-full">
                  
                    {showLowAttendanceOnly ? "Prikaži vse" : "Samo nizka prisotnost"}
                  </Button>
                </div>
                {playerAttendance.length === 0 ?
              <p className="text-sm text-muted-foreground text-center py-8">
                    Ni podatkov o obisku za izbrano obdobje
                  </p> :

              <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Igralec</TableHead>
                            <TableHead>Selekcija</TableHead>
                            <TableHead className="text-center">Skupaj</TableHead>
                            <TableHead className="text-center">Prisotnosti</TableHead>
                            <TableHead className="text-center">Odsotnosti</TableHead>
                            <TableHead className="text-center">Javljene</TableHead>
                            <TableHead className="text-center">Odstotek</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {playerAttendance.
                      filter((player) => !showLowAttendanceOnly || player.attendance_rate < 75).
                      map((player, idx) =>
                      <TableRow key={`${player.player_id}-${player.team_name}-${idx}`}>
                                <TableCell className="font-medium">
                                  {player.player_name}
                                </TableCell>
                                <TableCell>{player.team_name}</TableCell>
                                <TableCell className="text-center">
                                  {player.total_records}
                                </TableCell>
                                <TableCell className="text-center text-green-600">
                                  {player.present}
                                </TableCell>
                                <TableCell className="text-center text-red-600">
                                  {player.absent}
                                </TableCell>
                                <TableCell className="text-center text-orange-600">
                                  {player.excused}
                                </TableCell>
                                <TableCell className="text-center font-medium">
                                  {player.attendance_rate.toFixed(1)}%
                                </TableCell>
                              </TableRow>
                      )}
                        </TableBody>
                      </Table>
                    </div>
                    {showLowAttendanceOnly && playerAttendance.filter((p) => p.attendance_rate < 75).length === 0 &&
                <p className="text-sm text-muted-foreground text-center py-4 border-t mt-4">
                        Ni igralcev z nižjo prisotnostjo od 75%. Odlično delo! 🎉
                      </p>
                }
                  </>
              }
              </CardContent>
            }
          </Card>

          {/* Coach Hours */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Ure v mesecu</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMobileCoachHours(!showMobileCoachHours)}
                  className="md:hidden">
                  
                  {showMobileCoachHours ? "Skrij pregled" : "Prikaži pregled"}
                </Button>
              </CardTitle>
            </CardHeader>
            
            <CardContent className="hidden md:block">
              {coachHours.length === 0 ?
              <p className="text-sm text-muted-foreground text-center py-8">
                  Ni podatkov o urah za izbrano obdobje
                </p> :

              <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Trener</TableHead>
                          <TableHead>Selekcija</TableHead>
                          <TableHead className="text-right">Število aktivnosti</TableHead>
                          <TableHead className="text-right">Skupno ur</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {coachHours.map((coach, idx) =>
                      <TableRow key={`${coach.coach_id}-${coach.team_name}-${idx}`}>
                            <TableCell>{coach.coach_name}</TableCell>
                            <TableCell>{coach.team_name}</TableCell>
                            <TableCell className="text-right">{coach.activity_count}</TableCell>
                            <TableCell className="text-right">
                              {coach.total_hours.toFixed(1)} h
                            </TableCell>
                          </TableRow>
                      )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Summary by team */}
                  <div className="mt-6 pt-4 border-t">
                    <h4 className="text-sm font-semibold mb-3">Skupno po selekcijah</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Selekcija</TableHead>
                          <TableHead className="text-right">Skupno ur</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                        const teamTotals = new Map<string, number>();
                        coachHours.forEach((ch) => {
                          const current = teamTotals.get(ch.team_name) || 0;
                          teamTotals.set(ch.team_name, current + ch.total_hours);
                        });
                        return Array.from(teamTotals.entries()).
                        sort((a, b) => a[0].localeCompare(b[0])).
                        map(([teamName, totalHours]) =>
                        <TableRow key={teamName}>
                                <TableCell className="font-medium">{teamName}</TableCell>
                                <TableCell className="text-right font-semibold">
                                  {totalHours.toFixed(1)} h
                                </TableCell>
                              </TableRow>
                        );
                      })()}
                      </TableBody>
                    </Table>
                  </div>
                </>
              }
            </CardContent>

            {showMobileCoachHours &&
            <CardContent className="block md:hidden">
                {coachHours.length === 0 ?
              <p className="text-sm text-muted-foreground text-center py-8">
                    Ni podatkov o urah za izbrano obdobje
                  </p> :

              <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Trener</TableHead>
                            <TableHead>Selekcija</TableHead>
                            <TableHead className="text-right">Aktivnosti</TableHead>
                            <TableHead className="text-right">Skupno ur</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {coachHours.map((coach, idx) =>
                      <TableRow key={`${coach.coach_id}-${coach.team_name}-${idx}`}>
                              <TableCell>{coach.coach_name}</TableCell>
                              <TableCell>{coach.team_name}</TableCell>
                              <TableCell className="text-right">{coach.activity_count}</TableCell>
                              <TableCell className="text-right">
                                {coach.total_hours.toFixed(1)} h
                              </TableCell>
                            </TableRow>
                      )}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Summary by team - mobile */}
                    <div className="mt-6 pt-4 border-t">
                      <h4 className="text-sm font-semibold mb-3">Skupno po selekcijah</h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Selekcija</TableHead>
                            <TableHead className="text-right">Skupno ur</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(() => {
                        const teamTotals = new Map<string, number>();
                        coachHours.forEach((ch) => {
                          const current = teamTotals.get(ch.team_name) || 0;
                          teamTotals.set(ch.team_name, current + ch.total_hours);
                        });
                        return Array.from(teamTotals.entries()).
                        sort((a, b) => a[0].localeCompare(b[0])).
                        map(([teamName, totalHours]) =>
                        <TableRow key={teamName}>
                                  <TableCell className="font-medium">{teamName}</TableCell>
                                  <TableCell className="text-right font-semibold">
                                    {totalHours.toFixed(1)} h
                                  </TableCell>
                                </TableRow>
                        );
                      })()}
                        </TableBody>
                      </Table>
                    </div>
                  </>
              }
              </CardContent>
            }
          </Card>

          {/* Coach Kilometers */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Kilometri v mesecu</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMobileCoachKilometers(!showMobileCoachKilometers)}
                  className="md:hidden">
                  
                  {showMobileCoachKilometers ? "Skrij pregled" : "Prikaži pregled"}
                </Button>
              </CardTitle>
            </CardHeader>
            
            <CardContent className="hidden md:block">
              {coachKilometers.length === 0 ?
              <p className="text-sm text-muted-foreground text-center py-8">
                  Ni podatkov o kilometrih za izbrano obdobje
                </p> :

              <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Trener</TableHead>
                        <TableHead>Selekcija</TableHead>
                        <TableHead className="text-right">Aktivnosti s kilometri</TableHead>
                        <TableHead className="text-right">Skupno km</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {coachKilometers.map((coach, idx) =>
                    <TableRow key={`${coach.coach_id}-${coach.team_name}-${idx}`}>
                          <TableCell>{coach.coach_name}</TableCell>
                          <TableCell>{coach.team_name}</TableCell>
                          <TableCell className="text-right">{coach.activity_count}</TableCell>
                          <TableCell className="text-right">
                            {coach.total_kilometers.toFixed(1)} km
                          </TableCell>
                        </TableRow>
                    )}
                    </TableBody>
                  </Table>
                </div>
              }
            </CardContent>

            {showMobileCoachKilometers &&
            <CardContent className="block md:hidden">
                {coachKilometers.length === 0 ?
              <p className="text-sm text-muted-foreground text-center py-8">
                    Ni podatkov o kilometrih za izbrano obdobje
                  </p> :

              <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Trener</TableHead>
                          <TableHead>Selekcija</TableHead>
                          <TableHead className="text-right">Aktivnosti</TableHead>
                          <TableHead className="text-right">Skupaj km</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {coachKilometers.map((coach, idx) =>
                    <TableRow key={`mobile-${coach.coach_id}-${coach.team_name}-${idx}`}>
                            <TableCell>{coach.coach_name}</TableCell>
                            <TableCell>{coach.team_name}</TableCell>
                            <TableCell className="text-right">{coach.activity_count}</TableCell>
                            <TableCell className="text-right">
                              {coach.total_kilometers.toFixed(1)} km
                            </TableCell>
                          </TableRow>
                    )}
                      </TableBody>
                    </Table>
                  </div>
              }
              </CardContent>
            }
          </Card>
        </div>
      </AppLayout>
    </ProtectedRoute>);

}