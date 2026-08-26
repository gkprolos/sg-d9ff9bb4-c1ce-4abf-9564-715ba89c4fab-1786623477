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
  ChevronDown
} from "lucide-react";

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

interface MonthlyBilling {
  coach_id: string;
  coach_name: string;
  month: string;
  training_count: number;
  training_hours: number;
  match_count: number;
  match_hours: number;
  total_hours: number;
  hourly_amount: number;
  total_kilometers: number;
  kilometer_amount: number;
  total_amount: number;
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
    monthlyAmount: 0,
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

  const [playerAttendance, setPlayerAttendance] = useState<PlayerAttendance[]>([]);
  const [coachHours, setCoachHours] = useState<CoachHours[]>([]);
  const [coachKilometers, setCoachKilometers] = useState<CoachKilometers[]>([]);
  const [monthlyBilling, setMonthlyBilling] = useState<MonthlyBilling[]>([]);
  const [billingExpanded, setBillingExpanded] = useState(false);
  const [coaches, setCoaches] = useState<any[]>([]);
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
      loadStats();
      loadPlayerAttendance();
      loadCoachHours();
      loadCoachKilometers();
      loadMonthlyBilling();
    }
  }, [user, isAdmin, selectedMonth, selectedTeam, selectedCoach]);

  async function loadInitialData() {
    try {
      // Load seasons
      const { data: seasonsData } = await supabase
        .from("seasons")
        .select("id, name, is_active")
        .order("name", { ascending: false });
      
      setSeasons(seasonsData || []);
      
      // Set active season as default
      const activeSeason = seasonsData?.find(s => s.is_active);
      if (activeSeason) {
        setSelectedSeason(activeSeason.id);
      }

      // Load teams - different approach for admin vs coach
      if (isAdmin) {
        // Admin: load all teams directly
        const { data: teamsData } = await supabase
          .from("teams")
          .select("id, name")
          .eq("is_archived", false)
          .order("name", { ascending: true });
        
        setTeams(teamsData || []);
      } else if (user?.id) {
        // Coach: load only assigned teams via team_coaches
        const { data: coachTeamsData } = await supabase
          .from("team_coaches")
          .select(`
            team_id,
            teams(id, name)
          `)
          .eq("coach_id", user.id)
          .eq("is_active", true);
        
        const teamsData = (coachTeamsData || [])
          .map(ct => ct.teams)
          .filter(Boolean)
          .sort((a, b) => a.name.localeCompare(b.name));
        
        setTeams(teamsData);
      }
    } catch (error: any) {
      console.error("Error loading initial data:", error);
    }
  }

  async function loadCoachRates() {
    try {
      if (!user?.id || !selectedSeason) return;

      const { data, error } = await supabase
        .from("coach_rates")
        .select("*")
        .eq("coach_id", user.id)
        .eq("season_id", selectedSeason)
        .maybeSingle();

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
      const now = new Date();
      const statsMonthStart = new Date(now.getFullYear(), parseInt(selectedMonth.split('-')[1]) - 1, 1)
        .toISOString().split('T')[0];
      const statsMonthEnd = new Date(now.getFullYear(), parseInt(selectedMonth.split('-')[1]), 0)
        .toISOString().split('T')[0];

      // Get active players count
      let playersQuery = supabase
        .from("players")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true);

      // For coaches, filter by their team's players
      if (!isAdmin && user?.id) {
        const { data: coachTeams } = await supabase
          .from("team_coaches")
          .select("team_id")
          .eq("coach_id", user.id)
          .eq("is_active", true);

        const teamIds = (coachTeams || []).map(ct => ct.team_id);
        
        if (teamIds.length > 0) {
          const { data: teamPlayers } = await supabase
            .from("team_players")
            .select("player_id")
            .in("team_id", teamIds);

          const playerIds = (teamPlayers || []).map(tp => tp.player_id);
          
          if (playerIds.length > 0) {
            playersQuery = playersQuery.in("id", playerIds);
          } else {
            playersQuery = playersQuery.eq("id", "00000000-0000-0000-0000-000000000000");
          }
        } else {
          playersQuery = playersQuery.eq("id", "00000000-0000-0000-0000-000000000000");
        }
      }

      const { count: playersCount } = await playersQuery;

      // Get male players count
      let malePlayersQuery = supabase
        .from("players")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("gender", "M");

      // For coaches, filter by their team's players
      if (!isAdmin && user?.id) {
        const { data: coachTeams } = await supabase
          .from("team_coaches")
          .select("team_id")
          .eq("coach_id", user.id)
          .eq("is_active", true);

        const teamIds = (coachTeams || []).map(ct => ct.team_id);
        
        if (teamIds.length > 0) {
          const { data: teamPlayers } = await supabase
            .from("team_players")
            .select("player_id")
            .in("team_id", teamIds);

          const playerIds = (teamPlayers || []).map(tp => tp.player_id);
          
          if (playerIds.length > 0) {
            malePlayersQuery = malePlayersQuery.in("id", playerIds);
          } else {
            malePlayersQuery = malePlayersQuery.eq("id", "00000000-0000-0000-0000-000000000000");
          }
        } else {
          malePlayersQuery = malePlayersQuery.eq("id", "00000000-0000-0000-0000-000000000000");
        }
      }

      const { count: malePlayersCount } = await malePlayersQuery;

      // Get female players count
      let femalePlayersQuery = supabase
        .from("players")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("gender", "F");

      // For coaches, filter by their team's players
      if (!isAdmin && user?.id) {
        const { data: coachTeams } = await supabase
          .from("team_coaches")
          .select("team_id")
          .eq("coach_id", user.id)
          .eq("is_active", true);

        const teamIds = (coachTeams || []).map(ct => ct.team_id);
        
        if (teamIds.length > 0) {
          const { data: teamPlayers } = await supabase
            .from("team_players")
            .select("player_id")
            .in("team_id", teamIds);

          const playerIds = (teamPlayers || []).map(tp => tp.player_id);
          
          if (playerIds.length > 0) {
            femalePlayersQuery = femalePlayersQuery.in("id", playerIds);
          } else {
            femalePlayersQuery = femalePlayersQuery.eq("id", "00000000-0000-0000-0000-000000000000");
          }
        } else {
          femalePlayersQuery = femalePlayersQuery.eq("id", "00000000-0000-0000-0000-000000000000");
        }
      }

      const { count: femalePlayersCount } = await femalePlayersQuery;

      // Get active teams count
      let teamsQuery = supabase
        .from("teams")
        .select("id", { count: "exact", head: true })
        .eq("is_archived", false);

      // For coaches, filter by their assigned teams
      if (!isAdmin && user?.id) {
        const { data: coachTeams } = await supabase
          .from("team_coaches")
          .select("team_id")
          .eq("coach_id", user.id)
          .eq("is_active", true);

        const teamIds = (coachTeams || []).map(ct => ct.team_id);
        
        if (teamIds.length > 0) {
          teamsQuery = teamsQuery.in("id", teamIds);
        } else {
          teamsQuery = teamsQuery.eq("id", "00000000-0000-0000-0000-000000000000");
        }
      }

      const { count: teamsCount } = await teamsQuery;

      // Get active venues count (same for all users)
      const { count: venuesCount } = await supabase
        .from("venues")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true);

      // Get total activities count
      let totalActivitiesQuery = supabase
        .from("activities")
        .select("id", { count: "exact", head: true });

      if (selectedSeason) {
        totalActivitiesQuery = totalActivitiesQuery.eq("season_id", selectedSeason);
      }

      if (!isAdmin && user?.id) {
        const { data: coachActivities } = await supabase
          .from("activity_coaches")
          .select("activity_id")
          .eq("coach_id", user.id);
        
        const activityIds = (coachActivities || []).map(ca => ca.activity_id);
        if (activityIds.length > 0) {
          totalActivitiesQuery = totalActivitiesQuery.in("id", activityIds);
        } else {
          totalActivitiesQuery = totalActivitiesQuery.eq("id", "00000000-0000-0000-0000-000000000000");
        }
      }

      const { count: totalActivitiesCount } = await totalActivitiesQuery;

      // Monthly activities and stats
      const [monthYear, monthNum] = selectedMonth.split("-");
      const monthlyStart = `${monthYear}-${monthNum}-01`;
      const monthlyEnd = new Date(parseInt(monthYear), parseInt(monthNum), 0).toISOString().split("T")[0];

      let monthlyQuery = supabase
        .from("activities")
        .select(`
          id,
          start_time,
          end_time,
          activity_type_id,
          activity_coaches(coach_id, role, hours_worked, mileage_km, total_amount)
        `)
        .gte("activity_date", monthlyStart)
        .lte("activity_date", monthlyEnd);

      if (selectedSeason) {
        monthlyQuery = monthlyQuery.eq("season_id", selectedSeason);
      }

      if (!isAdmin && user?.id) {
        const { data: coachActivities } = await supabase
          .from("activity_coaches")
          .select("activity_id")
          .eq("coach_id", user.id);
        
        const activityIds = (coachActivities || []).map(ca => ca.activity_id);
        if (activityIds.length > 0) {
          monthlyQuery = monthlyQuery.in("id", activityIds);
        }
      }

      const { data: monthlyActivities } = await monthlyQuery;

      let totalHours = 0;
      let totalKilometers = 0;
      let totalAmount = 0;

      (monthlyActivities || []).forEach((activity) => {
        if (activity.activity_coaches) {
          activity.activity_coaches.forEach((ac: any) => {
            const isMyActivity = !isAdmin && ac.coach_id === user?.id;
            const isAdminView = isAdmin;

            if (isMyActivity || isAdminView) {
              totalHours += ac.hours_worked || 0;
              totalKilometers += ac.mileage_km || 0;
              totalAmount += ac.total_amount || 0;
            }
          });
        }
      });

      setStats({
        activePlayers: playersCount || 0,
        malePlayers: malePlayersCount || 0,
        femalePlayers: femalePlayersCount || 0,
        activeTeams: teamsCount || 0,
        activeVenues: venuesCount || 0,
        totalActivities: totalActivitiesCount || 0,
        monthlyActivities: monthlyActivities?.length || 0,
        monthlyHours: Math.round(totalHours * 10) / 10,
        monthlyKilometers: Math.round(totalKilometers * 10) / 10,
        monthlyAmount: Math.round(totalAmount * 100) / 100,
      });
    } catch (error: any) {
      console.error("Error loading stats:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Napaka pri nalaganju statistike",
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadPlayerAttendance() {
    try {
      const [year, month] = selectedMonth.split("-");
      const startDate = `${year}-${month}-01`;
      const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split("T")[0];

      let teamIds: string[] = [];

      // Determine which teams to load
      if (selectedTeam === "all") {
        if (isAdmin) {
          // Admin: load all active teams
          const { data: allTeams } = await supabase
            .from("teams")
            .select("id")
            .eq("is_archived", false);
          
          teamIds = (allTeams || []).map(t => t.id);
        } else if (user?.id) {
          // Coach: load only their teams
          const { data: coachTeams } = await supabase
            .from("team_coaches")
            .select("team_id")
            .eq("coach_id", user.id)
            .eq("is_active", true);
          
          teamIds = (coachTeams || []).map(ct => ct.team_id);
        }
      } else {
        // Single team selected
        if (!isAdmin && user?.id) {
          // Verify coach has access to this team
          const { data: coachTeam } = await supabase
            .from("team_coaches")
            .select("team_id")
            .eq("coach_id", user.id)
            .eq("team_id", selectedTeam)
            .eq("is_active", true)
            .maybeSingle();

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
      const { data: activities, error: activitiesError } = await supabase
        .from("activities")
        .select("id, activity_date, team_id")
        .in("team_id", teamIds)
        .gte("activity_date", startDate)
        .lte("activity_date", endDate);

      if (activitiesError) throw activitiesError;

      if (!activities || activities.length === 0) {
        setPlayerAttendance([]);
        return;
      }

      // Get team info with head coach for all teams
      const { data: teamsData } = await supabase
        .from("teams")
        .select(`
          id,
          name,
          head_coach_id,
          profiles!teams_head_coach_id_fkey(full_name)
        `)
        .in("id", teamIds);

      const teamsMap = new Map(
        (teamsData || []).map(t => [
          t.id,
          {
            name: t.name,
            headCoachName: t.profiles?.full_name || "Ni določen"
          }
        ])
      );

      // Get all players in these teams
      const { data: teamPlayers } = await supabase
        .from("team_players")
        .select(`
          player_id,
          team_id,
          players(id, first_name, last_name)
        `)
        .in("team_id", teamIds);

      if (!teamPlayers || teamPlayers.length === 0) {
        setPlayerAttendance([]);
        return;
      }

      const activityIds = activities.map(a => a.id);

      // Get attendance records for these activities
      const { data: attendanceRecords } = await supabase
        .from("attendance_records")
        .select("player_id, activity_id, status")
        .in("activity_id", activityIds);

      // Build activity-to-team map
      const activityTeamMap = new Map(
        activities.map(a => [a.id, a.team_id])
      );

      // Calculate stats per player per team
      const playerStatsArray: PlayerAttendance[] = [];

      teamPlayers.forEach((tp: any) => {
        const playerId = tp.player_id;
        const teamId = tp.team_id;
        const teamInfo = teamsMap.get(teamId);

        if (!teamInfo) return;

        // Get activities for this player's team
        const teamActivityIds = activities
          .filter(a => a.team_id === teamId)
          .map(a => a.id);

        // Get attendance records for this player in this team's activities
        const playerRecords = (attendanceRecords || []).filter(
          (ar: any) => ar.player_id === playerId && teamActivityIds.includes(ar.activity_id)
        );

        const present = playerRecords.filter((r: any) => r.status === 1).length;
        const absent = playerRecords.filter((r: any) => r.status === 0).length;
        const excused = playerRecords.filter((r: any) => r.status === 2).length;
        const total = playerRecords.length;

        const attendanceRate = total > 0 ? (present / total) * 100 : 0;

        playerStatsArray.push({
          player_id: playerId,
          player_name: `${tp.players.first_name} ${tp.players.last_name}`,
          team_name: teamInfo.name,
          head_coach_name: teamInfo.headCoachName,
          present,
          absent,
          excused,
          total_records: total,
          attendance_rate: attendanceRate,
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
      let query = supabase
        .from("teams")
        .select(`
          id, 
          name, 
          short_name,
          head_coach_id,
          profiles!teams_head_coach_id_fkey(full_name)
        `)
        .eq("is_archived", false)
        .order("name", { ascending: true });

      // For coaches, only show their teams
      if (!isAdmin && user?.id) {
        const { data: coachTeams } = await supabase
          .from("team_coaches")
          .select("team_id")
          .eq("coach_id", user.id)
          .eq("is_active", true);

        const teamIds = (coachTeams || []).map(ct => ct.team_id);
        
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
      if (!isAdmin) {
        // Coaches only see themselves
        if (user?.id) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, full_name")
            .eq("id", user.id)
            .single();
          
          if (profile) {
            setCoaches([profile]);
            setSelectedCoach(profile.id); // Auto-select themselves
          }
        }
      } else {
        // Admin sees all coaches
        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name")
          .order("full_name", { ascending: true });

        if (error) throw error;
        setCoaches(data || []);
      }
    } catch (error: any) {
      console.error("Napaka pri nalaganju trenerjev:", error);
    }
  }

  async function loadCoachHours() {
    try {
      const [year, month] = selectedMonth.split("-");
      const startDate = `${year}-${month}-01`;
      const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split("T")[0];

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
      let activitiesQuery = supabase
        .from("activities")
        .select(`
          id,
          team_id,
          start_time,
          end_time,
          activity_coaches(
            coach_id,
            hours_worked
          ),
          teams(name)
        `)
        .gte("activity_date", startDate)
        .lte("activity_date", endDate);

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
              activity_count: 0,
            });
          }

          const entry = hoursMap.get(key)!;
          entry.total_hours += ac.hours_worked || 0;
          entry.activity_count += 1;
        }
      }

      // Get coach names
      const uniqueCoachIds = Array.from(new Set(Array.from(hoursMap.values()).map(h => h.coach_id)));
      const { data: coachProfiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", uniqueCoachIds);

      const coachNameMap = new Map(
        (coachProfiles || []).map(p => [p.id, p.full_name])
      );

      const hoursArray = Array.from(hoursMap.values()).map(h => ({
        ...h,
        coach_name: coachNameMap.get(h.coach_id) || "Neznan trener",
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
      const startDate = `${year}-${month}-01`;
      const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split("T")[0];

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
      let activitiesQuery = supabase
        .from("activities")
        .select(`
          id,
          team_id,
          activity_coaches(
            coach_id,
            mileage_km
          ),
          teams(name)
        `)
        .gte("activity_date", startDate)
        .lte("activity_date", endDate);

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
              activity_count: 0,
            });
          }

          const entry = kilometersMap.get(key)!;
          entry.total_kilometers += ac.mileage_km || 0;
          entry.activity_count += 1;
        }
      }

      // Get coach names
      const uniqueCoachIds = Array.from(new Set(Array.from(kilometersMap.values()).map(k => k.coach_id)));
      const { data: coachProfiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", uniqueCoachIds);

      const coachNameMap = new Map(
        (coachProfiles || []).map(p => [p.id, p.full_name])
      );

      const kilometersArray = Array.from(kilometersMap.values()).map(k => ({
        ...k,
        coach_name: coachNameMap.get(k.coach_id) || "Neznan trener",
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

  async function loadMonthlyBilling() {
    try {
      let coachIds: string[] = [];

      // Determine which coaches to load
      if (isAdmin) {
        if (selectedCoach !== "all") {
          coachIds = [selectedCoach];
        }
      } else if (user?.id) {
        coachIds = [user.id];
      }

      const billingArray: MonthlyBilling[] = [];
      const now = new Date();

      // Load last 6 months
      for (let i = 0; i < 6; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const monthStr = `${year}-${String(month).padStart(2, "0")}`;
        const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
        const endDate = new Date(year, month, 0).toISOString().split("T")[0];

        // Get activities for this month
        const activitiesQuery = supabase
          .from("activities")
          .select(`
            id,
            activity_type_id,
            activity_coaches(
              coach_id,
              hours_worked,
              mileage_km,
              total_amount
            )
          `)
          .gte("activity_date", startDate)
          .lte("activity_date", endDate);

        const { data: activities } = await activitiesQuery;

        if (!activities || activities.length === 0) continue;

        // Group by coach
        const coachBillingMap = new Map<string, {
          training_count: number;
          training_hours: number;
          match_count: number;
          match_hours: number;
          total_kilometers: number;
          hourly_amount: number;
          kilometer_amount: number;
        }>();

        for (const activity of activities) {
          const activityCoaches = activity.activity_coaches || [];
          const isTraining = activity.activity_type_id === 1 || activity.activity_type_id === 2;
          const isMatch = activity.activity_type_id === 3;

          for (const ac of activityCoaches) {
            if (coachIds.length > 0 && !coachIds.includes(ac.coach_id)) continue;

            if (!coachBillingMap.has(ac.coach_id)) {
              coachBillingMap.set(ac.coach_id, {
                training_count: 0,
                training_hours: 0,
                match_count: 0,
                match_hours: 0,
                total_kilometers: 0,
                hourly_amount: 0,
                kilometer_amount: 0,
              });
            }

            const entry = coachBillingMap.get(ac.coach_id)!;
            const hours = ac.hours_worked || 0;

            if (isTraining) {
              entry.training_count += 1;
              entry.training_hours += hours;
            } else if (isMatch) {
              entry.match_count += 1;
              entry.match_hours += hours * 4; // Matches count as 4x hours
            }

            entry.total_kilometers += ac.mileage_km || 0;
            
            // Calculate amounts from total_amount in activity_coaches
            // This already includes hourly and kilometer amounts
            const totalAmount = ac.total_amount || 0;
            const kilometerAmount = (ac.mileage_km || 0) * 0.37; // Estimate km rate
            entry.kilometer_amount += kilometerAmount;
            entry.hourly_amount += totalAmount - kilometerAmount;
          }
        }

        // Get coach names and create billing records
        const uniqueCoachIds = Array.from(coachBillingMap.keys());
        const { data: coachProfiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", uniqueCoachIds);

        const coachNameMap = new Map(
          (coachProfiles || []).map(p => [p.id, p.full_name])
        );

        for (const [coachId, billing] of coachBillingMap) {
          const totalHours = billing.training_hours + billing.match_hours;
          const totalAmount = billing.hourly_amount + billing.kilometer_amount;

          billingArray.push({
            coach_id: coachId,
            coach_name: coachNameMap.get(coachId) || "Neznan trener",
            month: monthStr,
            training_count: billing.training_count,
            training_hours: Math.round(billing.training_hours * 10) / 10,
            match_count: billing.match_count,
            match_hours: Math.round(billing.match_hours * 10) / 10,
            total_hours: Math.round(totalHours * 10) / 10,
            hourly_amount: Math.round(billing.hourly_amount * 100) / 100,
            total_kilometers: Math.round(billing.total_kilometers * 10) / 10,
            kilometer_amount: Math.round(billing.kilometer_amount * 100) / 100,
            total_amount: Math.round(totalAmount * 100) / 100,
          });
        }
      }

      // Sort by month (descending), then coach name
      billingArray.sort((a, b) => {
        const monthCompare = b.month.localeCompare(a.month);
        if (monthCompare !== 0) return monthCompare;
        return a.coach_name.localeCompare(b.coach_name);
      });

      setMonthlyBilling(billingArray);
    } catch (error: any) {
      console.error("Napaka pri nalaganju mesečnih obračunov:", error);
      setMonthlyBilling([]);
    }
  }

  async function handlePlayerClick(playerId: string) {
    try {
      const { data: playerData } = await supabase
        .from("players")
        .select("first_name, last_name")
        .eq("id", playerId)
        .single();

      if (!playerData) return;

      const now = new Date();
      const monthlyStats = [];

      for (let i = 0; i < 12; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const detailYear = date.getFullYear();
        const detailMonth = date.getMonth() + 1;
        const detailMonthStart = `${detailYear}-${String(detailMonth).padStart(2, "0")}-01`;
        const daysInDetailMonth = new Date(detailYear, detailMonth, 0).getDate();
        const detailMonthEnd = `${detailYear}-${String(detailMonth).padStart(2, "0")}-${String(daysInDetailMonth).padStart(2, "0")}`;

        const { data: activities } = await supabase
          .from("activities")
          .select("id")
          .gte("activity_date", detailMonthStart)
          .lte("activity_date", detailMonthEnd);

        if (!activities || activities.length === 0) {
          monthlyStats.push({
            month: `${detailYear}-${String(detailMonth).padStart(2, "0")}`,
            total: 0,
            present: 0,
            absent: 0,
            excused: 0,
            rate: 0,
          });
          continue;
        }

        const activityIds = activities.map(a => a.id);

        const { data: attendance } = await supabase
          .from("attendance_records")
          .select("status")
          .eq("player_id", playerId)
          .in("activity_id", activityIds);

        const total = attendance?.length || 0;
        const present = attendance?.filter(a => a.status === 1).length || 0;
        const absent = attendance?.filter(a => a.status === 0).length || 0;
        const excused = attendance?.filter(a => a.status === 2).length || 0;
        const rate = total > 0 ? Math.round((present / total) * 100) : 0;

        monthlyStats.push({
          month: `${detailYear}-${String(detailMonth).padStart(2, "0")}`,
          total,
          present,
          absent,
          excused,
          rate,
        });
      }

      setSelectedPlayerDetail({
        player_id: playerId,
        player_name: `${playerData.first_name} ${playerData.last_name}`,
        team_name: playerAttendance.find(p => p.player_id === playerId)?.team_name || "",
        monthly_stats: monthlyStats,
      });
      setDetailDialogOpen(true);
    } catch (error: any) {
      console.error("Error loading player detail:", error);
    }
  }

  const monthNames = [
    "Januar", "Februar", "Marec", "April", "Maj", "Junij",
    "Julij", "Avgust", "September", "Oktober", "November", "December"
  ];

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
                {isAdmin 
                  ? "Pregled statistike kluba in aktivnosti" 
                  : "Pregled mojih aktivnosti in statistike"}
              </p>
            </div>

            {!isAdmin && (
              <Link href="/attendance">
                <Button size="lg" className="w-full sm:w-auto">
                  <Plus className="mr-2 h-5 w-5" />
                  Dodaj prisotnost
                </Button>
              </Link>
            )}
          </div>

          {/* KPI Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Aktivni igralci</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.activePlayers}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  M: {stats.malePlayers} • F: {stats.femalePlayers}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {isAdmin ? "Aktivne selekcije" : "Moje selekcije"}
                </CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.activeTeams}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Dvorane</CardTitle>
                <Building className="h-4 w-4 text-muted-foreground" />
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
              </CardContent>
            </Card>
          </div>

          {/* Monthly Stats */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Aktivnosti v mesecu</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.monthlyActivities}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ure v mesecu</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.monthlyHours}h</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Kilometri v mesecu</CardTitle>
                <Car className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.monthlyKilometers} km</div>
              </CardContent>
            </Card>

            {!isAdmin && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Mesečni obračun</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.monthlyAmount.toFixed(2)} €</div>
                </CardContent>
              </Card>
            )}
          </div>

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
                      {generateMonthOptions().map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
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
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {isAdmin && (
                  <div className="space-y-2">
                    <Label htmlFor="coach_filter">Trener</Label>
                    <Select value={selectedCoach} onValueChange={setSelectedCoach}>
                      <SelectTrigger id="coach_filter">
                        <SelectValue placeholder="Izberi trenerja" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Vsi trenerji</SelectItem>
                        {coaches.map((coach) => (
                          <SelectItem key={coach.id} value={coach.id}>
                            {coach.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Player Attendance by Team */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Pregled obiska po igralcih</span>
                {/* Mobile toggle button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMobilePlayerAttendance(!showMobilePlayerAttendance)}
                  className="md:hidden"
                >
                  {showMobilePlayerAttendance ? "Skrij pregled" : "Prikaži pregled"}
                </Button>
              </CardTitle>
            </CardHeader>
            
            {/* Desktop view - always visible */}
            <CardContent className="hidden md:block">
              {playerAttendance.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Ni podatkov o obisku za izbrano obdobje
                </p>
              ) : (
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
                      {playerAttendance.map((player, idx) => (
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
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>

            {/* Mobile view - toggle visibility */}
            {showMobilePlayerAttendance && (
              <CardContent className="block md:hidden">
                {playerAttendance.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Ni podatkov o obisku za izbrano obdobje
                  </p>
                ) : (
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
                        {playerAttendance.map((player, idx) => (
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
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            )}
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
                  className="md:hidden"
                >
                  {showMobileCoachHours ? "Skrij pregled" : "Prikaži pregled"}
                </Button>
              </CardTitle>
            </CardHeader>
            
            <CardContent className="hidden md:block">
              {coachHours.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Ni podatkov o urah za izbrano obdobje
                </p>
              ) : (
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
                      {coachHours.map((coach, idx) => (
                        <TableRow key={`${coach.coach_id}-${coach.team_name}-${idx}`}>
                          <TableCell>{coach.coach_name}</TableCell>
                          <TableCell>{coach.team_name}</TableCell>
                          <TableCell className="text-right">{coach.activity_count}</TableCell>
                          <TableCell className="text-right">
                            {coach.total_hours.toFixed(1)} h
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>

            {showMobileCoachHours && (
              <CardContent className="block md:hidden">
                {coachHours.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Ni podatkov o urah za izbrano obdobje
                  </p>
                ) : (
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
                        {coachHours.map((coach, idx) => (
                          <TableRow key={`${coach.coach_id}-${coach.team_name}-${idx}`}>
                            <TableCell>{coach.coach_name}</TableCell>
                            <TableCell>{coach.team_name}</TableCell>
                            <TableCell className="text-right">{coach.activity_count}</TableCell>
                            <TableCell className="text-right">
                              {coach.total_hours.toFixed(1)} h
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            )}
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
                  className="md:hidden"
                >
                  {showMobileCoachKilometers ? "Skrij pregled" : "Prikaži pregled"}
                </Button>
              </CardTitle>
            </CardHeader>
            
            <CardContent className="hidden md:block">
              {coachKilometers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Ni podatkov o kilometrih za izbrano obdobje
                </p>
              ) : (
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
                      {coachKilometers.map((coach, idx) => (
                        <TableRow key={`${coach.coach_id}-${coach.team_name}-${idx}`}>
                          <TableCell>{coach.coach_name}</TableCell>
                          <TableCell>{coach.team_name}</TableCell>
                          <TableCell className="text-right">{coach.activity_count}</TableCell>
                          <TableCell className="text-right">
                            {coach.total_kilometers.toFixed(1)} km
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>

            {showMobileCoachKilometers && (
              <CardContent className="block md:hidden">
                {coachKilometers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Ni podatkov o kilometrih za izbrano obdobje
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Trener</TableHead>
                          <TableHead>Selekcija</TableHead>
                          <TableHead className="text-right">Aktivnosti</TableHead>
                          <TableHead className="text-right">Skupno km</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {coachKilometers.map((coach, idx) => (
                          <TableRow key={`${coach.coach_id}-${coach.team_name}-${idx}`}>
                            <TableCell>{coach.coach_name}</TableCell>
                            <TableCell>{coach.team_name}</TableCell>
                            <TableCell className="text-right">{coach.activity_count}</TableCell>
                            <TableCell className="text-right">
                              {coach.total_kilometers.toFixed(1)} km
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          {/* Monthly Billing */}
          <Collapsible open={billingExpanded} onOpenChange={setBillingExpanded}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                  <CardTitle className="flex items-center justify-between">
                    <span>Mesečni obračun</span>
                    <ChevronDown className={`h-5 w-5 transition-transform ${billingExpanded ? "rotate-180" : ""}`} />
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <CardContent>
                  {monthlyBilling.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Ni podatkov o obračunih
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Trener</TableHead>
                            <TableHead>Mesec</TableHead>
                            <TableHead className="text-right">Treningi</TableHead>
                            <TableHead className="text-right">Ure treningov</TableHead>
                            <TableHead className="text-right">Tekme</TableHead>
                            <TableHead className="text-right">Ure tekem (×4)</TableHead>
                            <TableHead className="text-right">Skupno ur</TableHead>
                            <TableHead className="text-right">Znesek ur</TableHead>
                            <TableHead className="text-right">Kilometri</TableHead>
                            <TableHead className="text-right">Znesek km</TableHead>
                            <TableHead className="text-right font-semibold">Skupaj</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {monthlyBilling.map((billing, idx) => {
                            const [year, month] = billing.month.split("-");
                            const monthName = monthNames[parseInt(month) - 1];
                            const displayMonth = `${monthName} ${year}`;
                            
                            return (
                              <TableRow key={`${billing.coach_id}-${billing.month}-${idx}`}>
                                <TableCell>{billing.coach_name}</TableCell>
                                <TableCell>{displayMonth}</TableCell>
                                <TableCell className="text-right">{billing.training_count}</TableCell>
                                <TableCell className="text-right">{billing.training_hours.toFixed(1)} h</TableCell>
                                <TableCell className="text-right">{billing.match_count}</TableCell>
                                <TableCell className="text-right">{billing.match_hours.toFixed(1)} h</TableCell>
                                <TableCell className="text-right font-medium">{billing.total_hours.toFixed(1)} h</TableCell>
                                <TableCell className="text-right">{billing.hourly_amount.toFixed(2)} €</TableCell>
                                <TableCell className="text-right">{billing.total_kilometers.toFixed(1)} km</TableCell>
                                <TableCell className="text-right">{billing.kilometer_amount.toFixed(2)} €</TableCell>
                                <TableCell className="text-right font-semibold">{billing.total_amount.toFixed(2)} €</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}