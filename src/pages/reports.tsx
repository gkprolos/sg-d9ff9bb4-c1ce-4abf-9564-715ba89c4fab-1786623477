import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface MonthData {
  month: number;
  attendees: number;
  hours: number;
}

interface MonthlyStats {
  month: number;
  attendance_count: number;
  total_hours: number;
}

interface TeamReport {
  team_id: string;
  team_name: string;
  head_coach_name: string;
  monthly_data: MonthData[];
}

const MONTHS = [
  { value: 1, label: "JAN" },
  { value: 2, label: "FEB" },
  { value: 3, label: "MAR" },
  { value: 4, label: "APR" },
  { value: 5, label: "MAJ" },
  { value: 6, label: "JUN" },
  { value: 7, label: "JUL" },
  { value: 8, label: "AVG" },
  { value: 9, label: "SEP" },
  { value: 10, label: "OKT" },
  { value: 11, label: "NOV" },
  { value: 12, label: "DEC" },
];

export default function ReportsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [teamReports, setTeamReports] = useState<TeamReport[]>([]);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>(() => {
    const currentYear = new Date().getFullYear();
    return currentYear.toString();
  });

  // Generate years array (2024 to current year + 2)
  const years = Array.from(
    { length: new Date().getFullYear() - 2024 + 3 },
    (_, i) => (2024 + i).toString()
  );

  useEffect(() => {
    if (user) {
      checkAdminStatus();
    }
  }, [user]);

  useEffect(() => {
    if (user && selectedYear) {
      loadReports();
    }
  }, [user, isAdmin, selectedYear]);

  async function checkAdminStatus() {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      setIsAdmin(data?.is_admin || false);
    } catch (error: any) {
      console.error("Napaka pri preverjanju admin statusa:", error);
      setIsAdmin(false);
    }
  }

  async function loadSeasons() {
    try {
      const { data, error } = await supabase
        .from("seasons")
        .select("id, name, start_date, end_date, is_active")
        .order("start_date", { ascending: false });

      if (error) throw error;

      setSeasons(data || []);
      
      const activeSeason = data?.find(s => s.is_active);
      if (activeSeason) {
        setSelectedSeason(activeSeason.id);
      } else if (data && data.length > 0) {
        setSelectedSeason(data[0].id);
      }
    } catch (error: any) {
      console.error("Napaka pri nalaganju sezon:", error);
      toast({
        title: "Napaka",
        description: "Sezon ni bilo mogoče naložiti.",
        variant: "destructive",
      });
    }
  }

  async function loadTeamReports() {
    if (!selectedYear) return;
    
    setLoading(true);
    try {
      // Get all teams for selected season
      let teamsQuery = supabase
        .from("teams")
        .select(`
          id,
          name,
          team_coaches (
            is_head_coach,
            coach_id,
            profiles (
              full_name
            )
          )
        `)
        .eq("season_id", selectedSeason)
        .eq("is_archived", false);

      // If not admin, filter to only teams where user is a coach
      if (!isAdmin && user?.id) {
        const { data: userTeams } = await supabase
          .from("team_coaches")
          .select("team_id")
          .eq("coach_id", user.id);

        const teamIds = (userTeams || []).map(ut => ut.team_id);
        if (teamIds.length > 0) {
          teamsQuery = teamsQuery.in("id", teamIds);
        } else {
          setTeamReports([]);
          setLoading(false);
          return;
        }
      }

      const { data: teams, error: teamsError } = await teamsQuery;

      if (teamsError) throw teamsError;

      if (!teams || teams.length === 0) {
        setTeamReports([]);
        setLoading(false);
        return;
      }

      // Process teams and get head coach
      const processedTeams = teams.map((team: any) => {
        const headCoach = (team.team_coaches || []).find((tc: any) => tc.is_head_coach);
        return {
          team_id: team.id,
          team_name: team.name,
          head_coach_name: headCoach?.profiles?.full_name || "Ni glavnega trenerja",
        };
      });

      // Get selected season details for date range
      const { data: season } = await supabase
        .from("seasons")
        .select("start_date, end_date")
        .eq("id", selectedSeason)
        .single();

      const startYear = season ? new Date(season.start_date).getFullYear() : new Date().getFullYear();
      const endYear = season ? new Date(season.end_date).getFullYear() : startYear + 1;

      // For each team, calculate monthly stats
      const reportsPromises = (processedTeams || []).map(async (team: any) => {
        const monthlyStats: MonthlyStats[] = [];

        for (let month = 1; month <= 12; month++) {
          // Determine which year this month belongs to based on season dates
          let year = startYear;
          if (season) {
            const seasonStartMonth = new Date(season.start_date).getMonth() + 1;
            if (month < seasonStartMonth) {
              year = endYear;
            }
          }

          const monthStart = new Date(year, month - 1, 1).toISOString().split("T")[0];
          const monthEnd = new Date(year, month, 0).toISOString().split("T")[0];

          // Get activities for this team and month
          const { data: activities } = await supabase
            .from("activities")
            .select(`
              id,
              attendance_records!inner (
                status
              ),
              activity_coaches!inner (
                hours_worked
              )
            `)
            .eq("team_id", team.id)
            .eq("season_id", selectedSeason)
            .gte("activity_date", monthStart)
            .lte("activity_date", monthEnd);

          let attendanceCount = 0;
          let totalHours = 0;

          (activities || []).forEach((activity: any) => {
            // Count present attendance (status = 1)
            const presentCount = (activity.attendance_records || []).filter(
              (ar: any) => ar.status === 1
            ).length;
            attendanceCount += presentCount;

            // Sum hours from all coaches
            (activity.activity_coaches || []).forEach((ac: any) => {
              totalHours += ac.hours_worked || 0;
            });
          });

          monthlyStats.push({
            month,
            attendance_count: attendanceCount,
            total_hours: totalHours,
          });
        }

        return {
          team_id: team.id,
          team_name: team.name,
          head_coach_name: team.team_coaches[0]?.profiles?.full_name || "Ni določenega",
          monthly_stats: monthlyStats,
        };
      });

      const reports = await Promise.all(reportsPromises);
      setTeamReports(reports.sort((a, b) => a.team_name.localeCompare(b.team_name)));
    } catch (error: any) {
      console.error("Napaka pri nalaganju poročil:", error);
      toast({
        title: "Napaka",
        description: "Poročil ni bilo mogoče naložiti.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadReports() {
    if (!selectedYear) return;

    try {
      setLoading(true);

      // Get all teams (not filtered by season, just not archived)
      let teamsQuery = supabase
        .from("teams")
        .select(`
          id,
          name,
          season_id,
          team_coaches (
            is_head_coach,
            coach_id,
            profiles (
              full_name
            )
          )
        `)
        .eq("is_archived", false);

      // If not admin, filter to only teams where user is a coach
      if (!isAdmin && user?.id) {
        const { data: userTeams } = await supabase
          .from("team_coaches")
          .select("team_id")
          .eq("coach_id", user.id);

        const teamIds = (userTeams || []).map(ut => ut.team_id);
        if (teamIds.length > 0) {
          teamsQuery = teamsQuery.in("id", teamIds);
        } else {
          setTeamReports([]);
          setLoading(false);
          return;
        }
      }

      const { data: teams, error: teamsError } = await teamsQuery;

      if (teamsError) throw teamsError;

      if (!teams || teams.length === 0) {
        setTeamReports([]);
        setLoading(false);
        return;
      }

      // Process teams and get head coach
      const processedTeams = teams.map((team: any) => {
        const headCoach = (team.team_coaches || []).find((tc: any) => tc.is_head_coach);
        return {
          team_id: team.id,
          team_name: team.name,
          head_coach_name: headCoach?.profiles?.full_name || "Ni glavnega trenerja",
        };
      });

      // Get all activities for selected year
      const yearStart = `${selectedYear}-01-01`;
      const yearEnd = `${selectedYear}-12-31`;

      const { data: activities, error: activitiesError } = await supabase
        .from("activities")
        .select(`
          id,
          team_id,
          activity_date,
          activity_type_id,
          activity_coaches (
            hours_worked
          ),
          attendance_records (
            status
          )
        `)
        .gte("activity_date", yearStart)
        .lte("activity_date", yearEnd)
        .eq("is_completed", true);

      if (activitiesError) throw activitiesError;

      // Build monthly stats for each team
      const reportsData: TeamReport[] = processedTeams.map((team) => {
        const monthlyData: MonthData[] = [];

        // Initialize all 12 months
        for (let month = 1; month <= 12; month++) {
          const monthActivities = (activities || []).filter(
            (a: any) => a.team_id === team.team_id && new Date(a.activity_date).getMonth() + 1 === month
          );

          let totalAttendees = 0;
          let totalHours = 0;

          monthActivities.forEach((activity: any) => {
            // Count present attendees (status = 1)
            const presentCount = (activity.attendance_records || []).filter(
              (ar: any) => ar.status === 1
            ).length;
            totalAttendees += presentCount;

            // Sum hours from all coaches
            (activity.activity_coaches || []).forEach((ac: any) => {
              totalHours += ac.hours_worked || 0;
            });
          });

          monthlyData.push({
            month,
            attendees: totalAttendees,
            hours: totalHours,
          });
        }

        return {
          team_id: team.team_id,
          team_name: team.team_name,
          head_coach_name: team.head_coach_name,
          monthly_data: monthlyData,
        };
      });

      setTeamReports(reportsData);
    } catch (error: any) {
      console.error("Napaka pri nalaganju poročil:", error);
      toast({
        title: "Napaka",
        description: error.message || "Napaka pri nalaganju poročil",
        variant: "destructive",
      });
      setTeamReports([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8" />
              <h1 className="text-3xl font-bold">Poročila</h1>
            </div>
          </div>

          {/* Filters */}
          <div className="mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Filtriranje</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Leto</label>
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                      <SelectTrigger>
                        <SelectValue placeholder="Izberi leto" />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map((year) => (
                          <SelectItem key={year} value={year}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Team Reports */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <p className="text-muted-foreground">Nalaganje poročil...</p>
              </div>
            </div>
          ) : teamReports.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Ni podatkov za izbrano leto</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {teamReports.map((report) => (
                <Card key={report.team_id}>
                  <CardHeader>
                    <CardTitle className="text-xl">
                      {report.team_name}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Glavni trener: {report.head_coach_name}
                    </p>
                  </CardHeader>
                  <CardContent>
                    {/* Desktop view */}
                    <div className="hidden md:block overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-32"></TableHead>
                            {MONTHS.map((month) => (
                              <TableHead key={month.value} className="text-center">
                                {month.label}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="font-medium">Vključenih</TableCell>
                            {report.monthly_stats.map((stat) => (
                              <TableCell key={stat.month} className="text-center">
                                {stat.attendance_count}
                              </TableCell>
                            ))}
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">Ur vadbe</TableCell>
                            {report.monthly_stats.map((stat) => (
                              <TableCell key={stat.month} className="text-center">
                                {stat.total_hours.toFixed(0)}
                              </TableCell>
                            ))}
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>

                    {/* Mobile view */}
                    <div className="block md:hidden space-y-4">
                      {MONTHS.map((month) => {
                        const stat = report.monthly_stats.find((s) => s.month === month.value);
                        if (!stat || (stat.attendance_count === 0 && stat.total_hours === 0)) {
                          return null;
                        }
                        return (
                          <div key={month.value} className="border rounded-lg p-4">
                            <h4 className="font-semibold mb-2">{month.label}</h4>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-muted-foreground">Vključenih:</span>
                                <span className="ml-2 font-medium">{stat.attendance_count}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Ur vadbe:</span>
                                <span className="ml-2 font-medium">{stat.total_hours.toFixed(0)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}