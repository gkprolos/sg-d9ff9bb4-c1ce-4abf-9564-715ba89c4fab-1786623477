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
import { getTeamsByCoach } from "@/services/teamsService";
import { getSchedulesByTeam } from "@/services/schedulesService";
import { formatVenueName } from "@/services/venuesService";
import { Clock } from "lucide-react";

const DAYS_OF_WEEK = [
  { value: 1, label: "Ponedeljek" },
  { value: 2, label: "Torek" },
  { value: 3, label: "Sreda" },
  { value: 4, label: "Četrtek" },
  { value: 5, label: "Petek" },
  { value: 6, label: "Sobota" },
  { value: 7, label: "Nedelja" },
];

export default function MySchedulesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");

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
      const data = await getTeamsByCoach(user.id);
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
      const { data, error } = await supabase
        .from("schedule_templates")
        .select(`
          id,
          day_of_week,
          start_time,
          end_time,
          valid_from,
          valid_to,
          is_active,
          teams(name),
          venues(name),
          activity_types(name)
        `)
        .eq("is_active", true)
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) {
        console.error("Napaka pri nalaganju urnikov:", error);
        toast({
          variant: "destructive",
          title: "Napaka",
          description: error.message || "Ni mogoče naložiti urnikov",
        });
        throw error;
      }

      setSchedules(data || []);
    } catch (error: any) {
      console.error("Napaka pri nalaganju urnikov:", error);
    } finally {
      setLoading(false);
    }
  }

  function getDayName(dayNumber: number): string {
    return DAYS_OF_WEEK.find((d) => d.value === dayNumber)?.label || "N/A";
  }

  function getActivityTypeName(typeId: number): string {
    const types: Record<number, string> = {
      1: "Trening v dvorani",
      2: "Trening zunaj dvorane",
      3: "Uradna tekma",
    };
    return types[typeId] || "N/A";
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
                        <TableHead>Dvorana</TableHead>
                        <TableHead>Tip aktivnosti</TableHead>
                        <TableHead>Veljavnost</TableHead>
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
                            {schedule.venues ? formatVenueName(schedule.venues) : "N/A"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {getActivityTypeName(schedule.default_activity_type_id)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {schedule.valid_from || "-"}{" "}
                            -{" "}
                            {schedule.valid_to || "-"}
                          </TableCell>
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