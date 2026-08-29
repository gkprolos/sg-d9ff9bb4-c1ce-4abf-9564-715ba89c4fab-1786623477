import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { getActiveTeams } from "@/services/teamsService";
import { getSchedulesByTeam } from "@/services/schedulesService";
import { formatVenueName } from "@/services/venuesService";
import { Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const DAYS_OF_WEEK = [
  { value: 1, label: "Ponedeljek" },
  { value: 2, label: "Torek" },
  { value: 3, label: "Sreda" },
  { value: 4, label: "Četrtek" },
  { value: 5, label: "Petek" },
  { value: 6, label: "Sobota" },
  { value: 0, label: "Nedelja" },
];

const ACTIVITY_TYPE_NAMES: Record<number, string> = {
  1: "Trening v dvorani",
  2: "Trening ali pripravljalna tekma zunaj dvorane",
  3: "Uradna tekma"
};

export default function MySchedulesPage() {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [activities, setActivities] = useState<any[]>([]);

  const isAdmin = userRole === "admin";

  useEffect(() => {
    loadTeams();
  }, [user]);

  useEffect(() => {
    if (selectedTeamId) {
      loadSchedules();
    }
  }, [selectedTeamId]);

  async function loadTeams() {
    if (!user) return;

    try {
      const data = await getActiveTeams();
      setTeams(data);
      if (data.length > 0) {
        setSelectedTeamId(data[0].id);
      }
    } catch (error: any) {
      console.error("Napaka pri nalaganju selekcij:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Ni mogoče naložiti selekcij",
      });
    }
  }

  async function loadSchedules() {
    try {
      setLoading(true);
      let query = supabase
        .from("schedule_templates")
        .select(`
          *,
          teams (
            id,
            name
          ),
          venues (
            id,
            name
          )
        `)
        .order("day_of_week")
        .order("start_time");

      if (userRole === "coach") {
        const coachId = (user as any)?.id;
        if (!coachId) {
          throw new Error("Coach ID not found");
        }

        const { data: teamCoaches, error: teamCoachError } = await supabase
          .from("team_coaches")
          .select("team_id")
          .eq("coach_id", coachId);

        if (teamCoachError) throw teamCoachError;

        const teamIds = teamCoaches?.map((tc) => tc.team_id) || [];
        if (teamIds.length === 0) {
          setSchedules([]);
          setFilteredSchedules([]);
          return;
        }

        query = query.in("team_id", teamIds);
      }

      const { data, error } = await query;
      if (error) throw error;

      setSchedules(data || []);
      setFilteredSchedules(data || []);
    } catch (error: any) {
      console.error("Napaka pri nalaganju urnikov:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Napaka pri nalaganju urnikov",
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadActivities() {
    if (!selectedDate || !user?.id) {
      setActivities([]);
      return;
    }

    try {
      setLoading(true);

      // Get coach's teams
      const { data: coachTeams, error: teamsError } = await supabase
        .from("team_coaches")
        .select("team_id")
        .eq("coach_id", user.id)
        .eq("is_active", true);

      if (teamsError) throw teamsError;

      const teamIds = (coachTeams || []).map(ct => ct.team_id);

      if (teamIds.length === 0) {
        setActivities([]);
        setLoading(false);
        return;
      }

      // Get activities for selected date and coach's teams
      const { data, error } = await supabase
        .from("activities")
        .select(`
          id,
          activity_date,
          start_time,
          end_time,
          activity_type_id,
          is_home_game,
          is_completed,
          team_id,
          teams(name),
          venues(name),
          activity_coaches(
            role,
            profiles(full_name)
          )
        `)
        .in("team_id", teamIds)
        .eq("activity_date", selectedDate)
        .order("start_time", { ascending: true });

      if (error) throw error;

      setActivities(data || []);
    } catch (error: any) {
      console.error("Error loading activities:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Ni mogoče naložiti aktivnosti",
      });
    } finally {
      setLoading(false);
    }
  }

  function getDayName(dayNumber: number): string {
    return DAYS_OF_WEEK.find((d) => d.value === dayNumber)?.label || "N/A";
  }

  function getActivityTypeName(typeId: number): string {
    return ACTIVITY_TYPE_NAMES[typeId] || "N/A";
  }

  return (
    <ProtectedRoute allowedRoles={["coach"]}>
      <AppLayout>
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Urniki</h2>
            <p className="text-muted-foreground">
              Pregled rednih urnikov za vaše selekcije
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Filtri</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="team">Selekcija</Label>
                <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Izberi selekcijo" />
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Redni termini ({schedules.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Nalagam...</div>
              ) : schedules.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Ni urnikov</p>
                  <p className="text-sm mt-2">
                    {selectedTeamId ? "Selekcija nima rednih terminov" : "Izberite selekcijo"}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Dan</TableHead>
                        <TableHead>Čas</TableHead>
                        <TableHead>Selekcija</TableHead>
                        <TableHead>Dvorana</TableHead>
                        <TableHead>Tip aktivnosti</TableHead>
                        <TableHead>Veljavnost od</TableHead>
                        <TableHead>Veljavnost do</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {schedules.map((schedule) => (
                        <TableRow key={schedule.id}>
                          <TableCell className="font-medium">
                            {getDayName(schedule.day_of_week)}
                          </TableCell>
                          <TableCell>
                            {schedule.start_time} - {schedule.end_time}
                          </TableCell>
                          <TableCell>
                            {schedule.teams?.name || "-"}
                          </TableCell>
                          <TableCell>
                            {schedule.venues?.name || "-"}
                          </TableCell>
                          <TableCell>
                            {ACTIVITY_TYPE_NAMES[schedule.activity_type] || "-"}
                          </TableCell>
                          <TableCell>{schedule.valid_from || "-"}</TableCell>
                          <TableCell>{schedule.valid_to || "-"}</TableCell>
                          <TableCell>
                            <Badge variant={schedule.is_active ? "default" : "secondary"}>
                              {schedule.is_active ? "Aktiven" : "Neaktiven"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}