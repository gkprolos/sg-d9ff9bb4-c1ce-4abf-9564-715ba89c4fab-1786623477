import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
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
  Car
} from "lucide-react";

interface DashboardStats {
  activePlayers: number;
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
  const [selectedTeam, setSelectedTeam] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(() => {
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

      // Load teams
      const { data: teamsData } = await supabase
        .from("teams")
        .select("id, name")
        .eq("is_archived", false)
        .order("name", { ascending: true });
      
      setTeams(teamsData || []);
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
      setLoading(true);

      // Active players
      const { count: playersCount } = await supabase
        .from("players")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      // Active teams
      const { count: teamsCount } = await supabase
        .from("teams")
        .select("*", { count: "exact", head: true })
        .eq("is_archived", false);

      // Active venues
      const { count: venuesCount } = await supabase
        .from("venues")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      // Total activities
      let activitiesQuery = supabase
        .from("activities")
        .select("*", { count: "exact", head: true });
      
      if (selectedSeason) {
        activitiesQuery = activitiesQuery.eq("season_id", selectedSeason);
      }

      const { count: totalActivitiesCount } = await activitiesQuery;

      // Monthly activities and stats
      const [year, month] = selectedMonth.split("-");
      const monthStart = `${year}-${month}-01`;
      const monthEnd = new Date(parseInt(year), parseInt(month), 0).toISOString().split("T")[0];

      let monthlyQuery = supabase
        .from("activities")
        .select(`
          id,
          start_time,
          end_time,
          activity_type_id,
          activity_coaches(coach_id, role, hours_worked, amount_paid)
        `)
        .gte("activity_date", monthStart)
        .lte("activity_date", monthEnd);

      if (selectedSeason) {
        monthlyQuery = monthlyQuery.eq("season_id", selectedSeason);
      }

      if (!isAdmin && user?.id) {
        // Filter by coach's activities
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
      const totalKilometers = 0;
      let totalAmount = 0;

      (monthlyActivities || []).forEach((activity) => {
        if (activity.activity_coaches) {
          activity.activity_coaches.forEach((ac: any) => {
            const isMyActivity = !isAdmin && ac.coach_id === user?.id;
            const isAdminView = isAdmin;

            if (isMyActivity || isAdminView) {
              // Use hours_worked from activity_coaches if available
              totalHours += ac.hours_worked || 0;
              totalAmount += ac.amount_paid || 0;
            }
          });
        }
      });

      setStats({
        activePlayers: playersCount || 0,
        activeTeams: teamsCount || 0,
        activeVenues: venuesCount || 0,
        totalActivities: totalActivitiesCount || 0,
        monthlyActivities: monthlyActivities?.length || 0,
        monthlyHours: Math.round(totalHours * 10) / 10,
        monthlyKilometers: 0, // Will calculate separately from a dedicated kilometers table/field
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
      const monthStart = `${year}-${month}-01`;
      const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
      const monthEnd = `${year}-${month}-${String(daysInMonth).padStart(2, "0")}`;

      // Get activities in selected month
      let activitiesQuery = supabase
        .from("activities")
        .select(`
          id,
          activity_date,
          team_id,
          teams(name)
        `)
        .gte("activity_date", monthStart)
        .lte("activity_date", monthEnd);

      if (selectedSeason) {
        activitiesQuery = activitiesQuery.eq("season_id", selectedSeason);
      }

      if (selectedTeam) {
        activitiesQuery = activitiesQuery.eq("team_id", selectedTeam);
      }

      if (!isAdmin && user?.id) {
        // Filter by coach's activities
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

      // Sort by attendance rate (worst first)
      playerList.sort((a, b) => a.attendance_rate - b.attendance_rate);

      setPlayerAttendance(playerList);
    } catch (error: any) {
      console.error("Error loading player attendance:", error);
    }
  }

  async function handlePlayerClick(playerId: string) {
    try {
      // Load detailed monthly stats for this player
      const { data: playerData } = await supabase
        .from("players")
        .select("first_name, last_name")
        .eq("id", playerId)
        .single();

      if (!playerData) return;

      // Get attendance across all months (past 12 months)
      const now = new Date();
      const monthlyStats = [];

      for (let i = 0; i < 12; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
        const daysInMonth = new Date(year, month, 0).getDate();
        const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

        const { data: activities } = await supabase
          .from("activities")
          .select("id")
          .gte("activity_date", monthStart)
          .lte("activity_date", monthEnd);

        if (!activities || activities.length === 0) {
          monthlyStats.push({
            month: `${year}-${String(month).padStart(2, "0")}`,
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
          month: `${year}-${String(month).padStart(2, "0")}`,
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

          {/* KPI Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Aktivni igralci</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.activePlayers}</div>
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
                      <Label htmlFor="season">Sezona</Label>
                      <Select value={selectedSeason} onValueChange={setSelectedSeason}>
                        <SelectTrigger id="season">
                          <SelectValue placeholder="Vse sezone" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Vse sezone</SelectItem>
                          {seasons.map((season) => (
                            <SelectItem key={season.id} value={season.id}>
                              {season.name}
                              {season.is_active && <Badge className="ml-2" variant="outline">Aktivna</Badge>}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="team">Selekcija</Label>
                      <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                        <SelectTrigger id="team">
                          <SelectValue placeholder="Vse selekcije" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Vse selekcije</SelectItem>
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

          {/* Player Attendance Table */}
          {playerAttendance.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingDown className="h-5 w-5" />
                    Pregled obiska po igralcih
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Razvrstitev po najslabšem obisku
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky left-0 bg-background z-10">Igralec</TableHead>
                        <TableHead>Selekcija</TableHead>
                        {Array.from({ length: daysInSelectedMonth() }, (_, i) => (
                          <TableHead key={i + 1} className="text-center min-w-[40px]">
                            {i + 1}
                          </TableHead>
                        ))}
                        <TableHead className="text-center">Skupaj</TableHead>
                        <TableHead className="text-center">Prisoten</TableHead>
                        <TableHead className="text-center">Odsoten</TableHead>
                        <TableHead className="text-center">Opravičeno</TableHead>
                        <TableHead className="text-center">Obisk %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {playerAttendance.map((player) => (
                        <TableRow 
                          key={player.player_id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handlePlayerClick(player.player_id)}
                        >
                          <TableCell className="sticky left-0 bg-background font-medium">
                            {player.player_name}
                          </TableCell>
                          <TableCell>{player.team_name}</TableCell>
                          {Array.from({ length: daysInSelectedMonth() }, (_, i) => {
                            const status = player.daily_attendance[i + 1];
                            return (
                              <TableCell key={i + 1} className="text-center">
                                {status === 1 && (
                                  <Badge className="bg-green-600 w-6 h-6 rounded-full p-0 flex items-center justify-center">
                                    1
                                  </Badge>
                                )}
                                {status === 0 && (
                                  <Badge variant="destructive" className="w-6 h-6 rounded-full p-0 flex items-center justify-center">
                                    0
                                  </Badge>
                                )}
                                {status === 2 && (
                                  <Badge className="bg-orange-600 w-6 h-6 rounded-full p-0 flex items-center justify-center">
                                    2
                                  </Badge>
                                )}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center font-medium">
                            {player.total_activities}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-green-600">{player.present}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="destructive">{player.absent}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-orange-600">{player.excused}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge 
                              variant={player.attendance_rate < 70 ? "destructive" : "default"}
                              className={player.attendance_rate >= 70 ? "bg-green-600" : ""}
                            >
                              {player.attendance_rate}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-600">1</Badge>
                    <span>Prisoten</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive">0</Badge>
                    <span>Odsoten</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-orange-600">2</Badge>
                    <span>Javljena odsotnost</span>
                  </div>
                </div>
              </CardContent>
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