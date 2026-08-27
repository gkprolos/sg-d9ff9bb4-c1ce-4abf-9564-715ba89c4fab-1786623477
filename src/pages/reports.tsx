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

interface MonthlyStats {
  month: number;
  attendance_count: number;
  total_hours: number;
}

interface TeamReport {
  team_id: string;
  team_name: string;
  head_coach_name: string;
  monthly_stats: MonthlyStats[];
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
  const [selectedSeason, setSelectedSeason] = useState("");

  useEffect(() => {
    checkUserRole();
    loadSeasons();
  }, [user]);

  useEffect(() => {
    if (selectedSeason) {
      loadTeamReports();
    }
  }, [selectedSeason]);

  async function checkUserRole() {
    if (!user) return;
    
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .single();

      const { data: adminRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .single();

      setIsAdmin(!!adminRole);
    } catch (error: any) {
      console.error("Napaka pri preverjanju vloge:", error);
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
    if (!selectedSeason) return;
    
    setLoading(true);
    try {
      // Get all teams for selected season
      let teamsQuery = supabase
        .from("teams")
        .select(`
          id,
          name,
          team_coaches!inner (
            is_head_coach,
            profiles!inner (
              full_name
            )
          )
        `)
        .eq("season_id", selectedSeason)
        .eq("is_archived", false)
        .eq("team_coaches.is_head_coach", true);

      if (!isAdmin && user?.id) {
        teamsQuery = teamsQuery.eq("team_coaches.coach_id", user.id);
      }

      const { data: teams, error: teamsError } = await teamsQuery;

      if (teamsError) throw teamsError;

      // Get selected season details for date range
      const { data: season } = await supabase
        .from("seasons")
        .select("start_date, end_date")
        .eq("id", selectedSeason)
        .single();

      const startYear = season ? new Date(season.start_date).getFullYear() : new Date().getFullYear();
      const endYear = season ? new Date(season.end_date).getFullYear() : startYear + 1;

      // For each team, calculate monthly stats
      const reportsPromises = (teams || []).map(async (team: any) => {
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
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">Sezona</label>
                  <Select value={selectedSeason} onValueChange={setSelectedSeason}>
                    <SelectTrigger>
                      <SelectValue placeholder="Izberi sezono" />
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
              </div>
            </CardContent>
          </Card>

          {/* Team Reports */}
          {loading ? (
            <Card>
              <CardContent className="py-12">
                <p className="text-center text-muted-foreground">Nalaganje poročil...</p>
              </CardContent>
            </Card>
          ) : teamReports.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <p className="text-center text-muted-foreground">
                  Ni podatkov za izbrano sezono
                </p>
              </CardContent>
            </Card>
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