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
  Plus
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
  total_activities: number;
  present: number;
  absent: number;
  excused: number;
  attendance_rate: number;
  daily_attendance: { [day: number]: number | null };
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
  const [showMobilePlayerAttendance, setShowMobilePlayerAttendance] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const [playerAttendance, setPlayerAttendance] = useState<PlayerAttendance[]>([]);
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
    if (selectedMonth) {
      loadStats();
      loadPlayerAttendance();
      if (!isAdmin && user?.id) {
        loadCoachRates();
      }
    }
  }, [selectedMonth, selectedSeason, selectedTeam, userRole]);

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
    // Skip if no specific team selected
    if (selectedTeam === "all") {
      setPlayerAttendance([]);
      return;
    }

    try {
      const [year, month] = selectedMonth.split("-");
      const startDate = `${year}-${month}-01`;
      const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split("T")[0];

      const now = new Date();
      const attYear = now.getFullYear();
      const attMonth = parseInt(selectedMonth.split('-')[1]);
      const attMonthStart = new Date(attYear, attMonth - 1, 1).toISOString().split('T')[0];
      const attMonthEnd = new Date(attYear, attMonth, 0).toISOString().split('T')[0];

      // Get all players
      let playersQuery = supabase
        .from("players")
        .select(`
          id,
          first_name,
          last_name,
          team_players(
            team_id,
            teams(id, name)
          )
        `)
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
            setPlayerAttendance([]);
            setLoading(false);
            return;
          }
        } else {
          setPlayerAttendance([]);
          setLoading(false);
          return;
        }
      }

      const { data: playersData, error: playersError } = await playersQuery;

      if (playersError) throw playersError;

      const [yearStr, monthStr] = selectedMonth.split("-");
      const tableMonthStart = `${yearStr}-${monthStr}-01`;
      const daysInMonth = new Date(parseInt(yearStr), parseInt(monthStr), 0).getDate();
      const tableMonthEnd = `${yearStr}-${monthStr}-${String(daysInMonth).padStart(2, "0")}`;

      // Get activities in selected month
      let activitiesQuery = supabase
        .from("activities")
        .select(`
          id,
          activity_date,
          team_id,
          teams(name)
        `)
        .gte("activity_date", tableMonthStart)
        .lte("activity_date", tableMonthEnd);

      if (selectedSeason) {
        activitiesQuery = activitiesQuery.eq("season_id", selectedSeason);
      }

      if (selectedTeam) {
        activitiesQuery = activitiesQuery.eq("team_id", selectedTeam);
      }

      if (!isAdmin && user?.id) {
        const { data: coachActivities } = await supabase
          .from("activity_coaches")
          .select("activity_id")
          .eq("coach_id", user.id);
        
        const activityIds = (coachActivities || []).map(ca => ca.activity_id);
        if (activityIds.length > 0) {
          activitiesQuery = activitiesQuery.in("id", activityIds);
        }
      }

      const { data: activities } = await activitiesQuery;

      if (!activities || activities.length === 0) {
        setPlayerAttendance([]);
        return;
      }

      const activityIds = activities.map(a => a.id);

      // Get attendance records
      const { data: attendanceRecords } = await supabase
        .from("attendance_records")
        .select(`
          activity_id,
          player_id,
          status,
          players(first_name, last_name)
        `)
        .in("activity_id", activityIds);

      // Group by player
      const playerMap = new Map<string, any>();

      (attendanceRecords || []).forEach((record: any) => {
        if (!playerMap.has(record.player_id)) {
          playerMap.set(record.player_id, {
            player_id: record.player_id,
            player_name: `${record.players.first_name} ${record.players.last_name}`,
            team_name: "",
            total_activities: 0,
            present: 0,
            absent: 0,
            excused: 0,
            daily_attendance: {},
          });
        }

        const player = playerMap.get(record.player_id);
        const activity = activities.find(a => a.id === record.activity_id);
        
        if (activity) {
          player.team_name = activity.teams?.name || "";
          const day = new Date(activity.activity_date).getDate();
          player.daily_attendance[day] = record.status;
          player.total_activities++;

          if (record.status === 1) player.present++;
          else if (record.status === 0) player.absent++;
          else if (record.status === 2) player.excused++;
        }
      });

      const playerList = Array.from(playerMap.values()).map(p => ({
        ...p,
        attendance_rate: p.total_activities > 0 
          ? Math.round((p.present / p.total_activities) * 100) 
          : 0,
      }));

      playerList.sort((a, b) => a.attendance_rate - b.attendance_rate);

      setPlayerAttendance(playerList);
    } catch (error: any) {
      console.error("Error loading player attendance:", error);
    } finally {
      setLoading(false);
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
            <CardHeader>
              <CardTitle>Filtri</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="month">Mesec</Label>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger id="month">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {generateMonthOptions().map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {isAdmin && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="season_filter">Sezona</Label>
                      <Select value={selectedSeason || ""} onValueChange={(val) => setSelectedSeason(val || null)}>
                        <SelectTrigger id="season_filter">
                          <SelectValue placeholder="Vse sezone" />
                        </SelectTrigger>
                        <SelectContent>
                          {seasons.map((season) => (
                            <SelectItem key={season.id} value={season.id}>
                              {season.name} {season.is_active && "(Aktivna)"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="team_filter">Selekcija</Label>
                      <Select value={selectedTeam || ""} onValueChange={(val) => setSelectedTeam(val || null)}>
                        <SelectTrigger id="team_filter">
                          <SelectValue placeholder="Vse selekcije" />
                        </SelectTrigger>
                        <SelectContent>
                          {teams.map((team) => (
                            <SelectItem key={team.id} value={team.id}>
                              {team.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Player Attendance by Team */}
          {isAdmin && selectedTeam !== "all" && (
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
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Igralec</TableHead>
                        <TableHead className="text-right">Prisotnosti</TableHead>
                        <TableHead className="text-right">Odsotnosti</TableHead>
                        <TableHead className="text-right">Javljene</TableHead>
                        <TableHead className="text-right">Odstotek</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {playerAttendance.map((player) => (
                        <TableRow key={player.player_id}>
                          <TableCell>{player.player_name}</TableCell>
                          <TableCell className="text-right">{player.present}</TableCell>
                          <TableCell className="text-right">{player.absent}</TableCell>
                          <TableCell className="text-right">{player.excused}</TableCell>
                          <TableCell className="text-right">
                            {player.attendance_rate.toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>

              {/* Mobile view - toggle visibility */}
              {showMobilePlayerAttendance && (
                <CardContent className="block md:hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Igralec</TableHead>
                          <TableHead className="text-right">Prisotnosti</TableHead>
                          <TableHead className="text-right">Odsotnosti</TableHead>
                          <TableHead className="text-right">Javljene</TableHead>
                          <TableHead className="text-right">Odstotek</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {playerAttendance.map((player) => (
                          <TableRow key={player.player_id}>
                            <TableCell>{player.player_name}</TableCell>
                            <TableCell className="text-right">{player.present}</TableCell>
                            <TableCell className="text-right">{player.absent}</TableCell>
                            <TableCell className="text-right">{player.excused}</TableCell>
                            <TableCell className="text-right">
                              {player.attendance_rate.toFixed(1)}%
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* Player Detail Dialog */}
          <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  Podrobnosti obiska - {selectedPlayerDetail?.player_name}
                </DialogTitle>
              </DialogHeader>

              {selectedPlayerDetail && (
                <div className="space-y-6 py-4">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Selekcija: <strong>{selectedPlayerDetail.team_name}</strong>
                    </p>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mesec</TableHead>
                        <TableHead className="text-center">Skupaj</TableHead>
                        <TableHead className="text-center">Prisoten</TableHead>
                        <TableHead className="text-center">Odsoten</TableHead>
                        <TableHead className="text-center">Opravičeno</TableHead>
                        <TableHead className="text-center">Obisk %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedPlayerDetail.monthly_stats.map((stat) => {
                        const [year, month] = stat.month.split("-");
                        const monthName = monthNames[parseInt(month) - 1];
                        
                        return (
                          <TableRow key={stat.month}>
                            <TableCell className="font-medium">
                              {monthName} {year}
                            </TableCell>
                            <TableCell className="text-center">{stat.total}</TableCell>
                            <TableCell className="text-center">
                              <Badge className="bg-green-600">{stat.present}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="destructive">{stat.absent}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className="bg-orange-600">{stat.excused}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge 
                                variant={stat.rate < 70 ? "destructive" : "default"}
                                className={stat.rate >= 70 ? "bg-green-600" : ""}
                              >
                                {stat.rate}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}