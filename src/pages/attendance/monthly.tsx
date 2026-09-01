import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Download, Calendar } from "lucide-react";
import * as XLSX from "xlsx";

interface Player {
  id: string;
  first_name: string;
  last_name: string;
}

interface Team {
  id: string;
  name: string;
}

interface AttendanceRecord {
  player_id: string;
  activity_date: string;
  status: number; // 0=absent, 1=present, 2=excused
}

interface MonthlyAttendance {
  player_id: string;
  player_name: string;
  daily_attendance: {[day: number]: number | null;}; // day (1-31) -> status
  total_activities: number;
  total_present: number;
  attendance_percentage: number;
}

export default function MonthlyAttendance() {
  const router = useRouter();
  const { user, userRole } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);

  // Filters
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [viewType, setViewType] = useState<string>("");
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");

  const [monthlyData, setMonthlyData] = useState<MonthlyAttendance[]>([]);
  const [daysInMonth, setDaysInMonth] = useState<number>(31);

  const months = [
  { value: 1, label: "Januar" },
  { value: 2, label: "Februar" },
  { value: 3, label: "Marec" },
  { value: 4, label: "April" },
  { value: 5, label: "Maj" },
  { value: 6, label: "Junij" },
  { value: 7, label: "Julij" },
  { value: 8, label: "Avgust" },
  { value: 9, label: "September" },
  { value: 10, label: "Oktober" },
  { value: 11, label: "November" },
  { value: 12, label: "December" }];


  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    loadTeams();
    loadPlayers();
  }, [user, router]);

  useEffect(() => {
    // Calculate days in selected month
    const days = new Date(selectedYear, selectedMonth, 0).getDate();
    setDaysInMonth(days);

    loadMonthlyAttendance();
  }, [selectedYear, selectedMonth, viewType, selectedTeamId, selectedPlayerId]);

  async function loadTeams() {
    try {
      let query = supabase.
      from("teams").
      select("id, name").
      order("name");

      if (userRole === "coach") {
        // Coach only sees their teams
        query = query.in("id", await getCoachTeamIds());
      }

      const { data, error } = await query;
      if (error) throw error;
      setTeams(data || []);
    } catch (error: any) {
      console.error("Napaka pri nalaganju selekcij:", error);
    }
  }

  async function loadPlayers() {
    try {
      let query = supabase.
      from("players").
      select("id, first_name, last_name").
      order("last_name");

      if (userRole === "coach") {
        // Coach only sees players from their teams
        const teamIds = await getCoachTeamIds();
        const { data: teamPlayers } = await supabase.
        from("team_players").
        select("player_id").
        in("team_id", teamIds);

        const playerIds = teamPlayers?.map((tp) => tp.player_id) || [];
        query = query.in("id", playerIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      setPlayers(data || []);
    } catch (error: any) {
      console.error("Napaka pri nalaganju igralcev:", error);
    }
  }

  async function getCoachTeamIds(): Promise<string[]> {
    if (!user?.id) return [];
    const { data } = await supabase.
    from("team_coaches").
    select("team_id").
    eq("coach_id", user.id);
    return data?.map((tc) => tc.team_id) || [];
  }

  async function loadMonthlyAttendance() {
    if (!selectedMonth || !selectedYear) return;

    try {
      setLoading(true);

      // Get start and end of selected month
      const startDate = `${selectedYear}-${selectedMonth.toString().padStart(2, "0")}-01`;

      // FIXED: Get last day of the month correctly
      // new Date(year, month, 0) gets last day of PREVIOUS month
      // new Date(year, month + 1, 0) gets last day of CURRENT month
      const lastDayOfMonth = new Date(selectedYear, selectedMonth, 0).getDate();
      const endDate = `${selectedYear}-${selectedMonth.toString().padStart(2, "0")}-${lastDayOfMonth.toString().padStart(2, "0")}`;

      console.log("🔍 Loading attendance:", {
        selectedTeamId,
        viewType,
        teamsCount: teams.length,
        startDate,
        endDate,
        lastDayOfMonth
      });

      // Build query
      let query = supabase.
      from("attendance_records").
      select(`
          *,
          players!inner (
            id,
            first_name,
            last_name
          ),
          activities!inner (
            id,
            activity_date,
            team_id
          )
        `).
      gte("activities.activity_date", startDate).
      lte("activities.activity_date", endDate);

      // Filter by team(s)
      if (selectedTeamId && selectedTeamId !== "" && viewType !== "all_teams") {
        // Single team selected
        query = query.eq("activities.team_id", selectedTeamId);
        console.log("📌 Filtering by single team:", selectedTeamId);
      } else if (teams.length > 0) {
        // All teams - filter by coach's assigned teams
        const teamIds = teams.map((t) => t.id);
        query = query.in("activities.team_id", teamIds);
        console.log("📌 Filtering by all teams:", teamIds);
        console.log("📌 Team names:", teams.map((t) => t.name));
      } else {
        console.log("⚠️ No teams available");
        setMonthlyData([]);
        setLoading(false);
        return;
      }

      // Execute query
      const { data, error } = await query;

      console.log("✅ Query result:", { count: data?.length, error });

      // Debug: Log first few records to see what teams they belong to
      if (data && data.length > 0) {
        console.log("🔍 First 5 records sample:", data.slice(0, 5).map((r: any) => ({
          player: `${r.players?.first_name} ${r.players?.last_name}`,
          activity_date: r.activities?.activity_date,
          team_id: r.activities?.team_id,
          status: r.status
        })));

        // Count records per team
        const teamCounts = data.reduce((acc: any, r: any) => {
          const teamId = r.activities?.team_id;
          acc[teamId] = (acc[teamId] || 0) + 1;
          return acc;
        }, {});
        console.log("📊 Records per team_id:", teamCounts);
      }

      if (error) throw error;

      // Transform data into monthly attendance format
      const playerMap = new Map<string, MonthlyAttendance>();

      (data || []).forEach((record: any) => {
        const playerId = record.player_id;
        const playerName = `${record.players.first_name} ${record.players.last_name}`;
        const day = new Date(record.activities.activity_date).getDate();

        if (!playerMap.has(playerId)) {
          playerMap.set(playerId, {
            player_id: playerId,
            player_name: playerName,
            daily_attendance: {},
            total_activities: 0,
            total_present: 0,
            attendance_percentage: 0
          });
        }

        const playerData = playerMap.get(playerId)!;
        playerData.daily_attendance[day] = record.status;
        playerData.total_activities++;
        if (record.status === 1) {
          playerData.total_present++;
        }
      });

      // Calculate attendance percentages
      const transformedData = Array.from(playerMap.values()).map((player) => ({
        ...player,
        attendance_percentage:
        player.total_activities > 0 ?
        Math.round(player.total_present / player.total_activities * 100) :
        0
      }));

      console.log("📊 Transformed data:", { playerCount: transformedData.length });

      setMonthlyData(transformedData);
    } catch (error: any) {
      console.error("Napaka pri nalaganju prisotnosti:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Ni mogoče naložiti prisotnosti"
      });
    } finally {
      setLoading(false);
    }
  }

  function handleExportExcel() {
    try {
      const monthName = months.find((m) => m.value === selectedMonth)?.label || "";
      const sheetName = `${monthName}_${selectedYear}`;

      // Prepare data for Excel
      const excelData: any[] = [];

      // Header row
      const headerRow: any = { Igralec: "Igralec" };
      for (let day = 1; day <= daysInMonth; day++) {
        headerRow[`Day${day}`] = day.toString();
      }
      headerRow["Skupaj"] = "Skupaj";
      headerRow["Prisotni"] = "Prisotni";
      headerRow["%"] = "%";
      excelData.push(headerRow);

      // Data rows
      monthlyData.forEach((player) => {
        const row: any = { Igralec: player.player_name };
        for (let day = 1; day <= daysInMonth; day++) {
          const status = player.daily_attendance[day];
          row[`Day${day}`] = status !== null && status !== undefined ? status : "";
        }
        row["Skupaj"] = player.total_activities;
        row["Prisotni"] = player.total_present;
        row["%"] = `${player.attendance_percentage}%`;
        excelData.push(row);
      });

      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sheetName);

      const fileName = `Prisotnost_${monthName}_${selectedYear}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast({
        title: "Izvoz uspešen",
        description: `Datoteka ${fileName} je prenesena`
      });
    } catch (error: any) {
      console.error("Napaka pri izvozu:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Napaka pri izvozu v Excel"
      });
    }
  }

  function getStatusColor(status: number | null): string {
    if (status === null || status === undefined) return "";
    if (status === 1) return "text-green-600 font-semibold"; // Present
    if (status === 0) return "text-red-600 font-semibold"; // Absent
    if (status === 2) return "text-orange-600 font-semibold"; // Excused
    return "";
  }

  function getStatusText(status: number | null): string {
    if (status === null || status === undefined) return "";
    if (status === 1) return "1";
    if (status === 0) return "0";
    if (status === 2) return "2";
    return "";
  }

  if (!user) {
    return null;
  }

  return (
    <AppLayout>
      <div className="container mx-auto py-6 px-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold">Mesečni pregled prisotnosti</h1>
          </div>
          <Button
            onClick={() => router.push("/attendance")}
            variant="outline">
            
            Nazaj na Prisotnost
          </Button>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filtri</CardTitle>
            <CardDescription>Izberite mesec, leto in prikaz</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Month */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Mesec</label>
                <Select
                  value={selectedMonth.toString()}
                  onValueChange={(value) => setSelectedMonth(parseInt(value))}>
                  
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((month) =>
                    <SelectItem key={month.value} value={month.value.toString()}>
                        {month.label}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Year */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Leto</label>
                <Select
                  value={selectedYear.toString()}
                  onValueChange={(value) => setSelectedYear(parseInt(value))}>
                  
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((year) =>
                    <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* View Type */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Prikaz</label>
                <Select
                  value={viewType}
                  onValueChange={(value) => {
                    setViewType(value);
                    if (value === "all_teams") {
                      setSelectedTeamId("");
                    } else if (value.startsWith("team:")) {
                      const teamId = value.split(":")[1];
                      setSelectedTeamId(teamId);
                    }
                  }}>
                  
                  <SelectTrigger className="w-[280px]">
                    <SelectValue placeholder="Izberi selekcijo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_teams">Vse selekcije</SelectItem>
                    {teams.map((team) =>
                    <SelectItem key={team.id} value={`team:${team.id}`}>
                        {team.name}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Export */}
              <div className="space-y-2">
                <label className="text-sm font-medium">&nbsp;</label>
                <Button
                  onClick={handleExportExcel}
                  disabled={loading || monthlyData.length === 0}
                  className="w-full">
                  
                  <Download className="mr-2 h-4 w-4" />
                  Izvozi Excel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Attendance Table */}
        <Card>
          <CardHeader>
            <CardTitle>
              {months.find((m) => m.value === selectedMonth)?.label} {selectedYear}
            </CardTitle>
            <CardDescription>
              Prisotnost: 1 = Prisoten (zelena), 0 = Odsoten (rdeča), 2 = Javljena odsotnost (oranžna)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ?
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div> :
            monthlyData.length === 0 ?
            <div className="text-center py-12 text-muted-foreground">
                Ni podatkov za izbran mesec
              </div> :

            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="sticky left-0 bg-muted/50 p-2 text-left font-semibold min-w-[150px]">
                        Igralec
                      </th>
                      {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) =>
                    <th key={day} className="p-2 text-center font-semibold w-8">
                          {day}
                        </th>
                    )}
                      <th className="p-2 text-center font-semibold bg-muted/50">Skupaj</th>
                      <th className="p-2 text-center font-semibold bg-muted/50">Prisotni</th>
                      <th className="p-2 text-center font-semibold bg-muted/50">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData.map((player) =>
                  <tr key={player.player_id} className="border-b hover:bg-muted/20">
                        <td className="sticky left-0 bg-background p-2 font-medium">
                          {player.player_name}
                        </td>
                        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                      const status = player.daily_attendance[day];
                      return (
                        <td
                          key={day}
                          className={`p-2 text-center ${getStatusColor(status)}`}>
                          
                              {getStatusText(status)}
                            </td>);

                    })}
                        <td className="p-2 text-center bg-muted/20 font-medium">
                          {player.total_activities}
                        </td>
                        <td className="p-2 text-center bg-muted/20 font-medium text-green-600">
                          {player.total_present}
                        </td>
                        <td className="p-2 text-center bg-muted/20 font-bold">
                          {player.attendance_percentage}%
                        </td>
                      </tr>
                  )}
                  </tbody>
                </table>
              </div>
            }
          </CardContent>
        </Card>
      </div>
    </AppLayout>);

}