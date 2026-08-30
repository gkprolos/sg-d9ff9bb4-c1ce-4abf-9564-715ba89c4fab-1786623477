import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CalendarClock, Plus, Edit, Trash2, Clock, Loader2 } from "lucide-react";

const DAYS = [
  { value: "1", label: "Ponedeljek" },
  { value: "2", label: "Torek" },
  { value: "3", label: "Sreda" },
  { value: "4", label: "Četrtek" },
  { value: "5", label: "Petek" },
  { value: "6", label: "Sobota" },
  { value: "0", label: "Nedelja" },
];

interface ScheduleTemplate {
  id: string;
  team_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  venue_id: string | null;
  custom_venue: string | null;
  default_activity_type_id: number;
  valid_from: string | null;
  valid_to: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  teams: {
    id: string;
    name: string;
  } | null;
  venues: {
    id: string;
    name: string;
    city?: string;
  } | null;
}

export default function SchedulesPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [schedules, setSchedules] = useState<ScheduleTemplate[]>([]);
  const [filteredSchedules, setFilteredSchedules] = useState<ScheduleTemplate[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [venues, setVenues] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleTemplate | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<ScheduleTemplate | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [selectedDay, setSelectedDay] = useState<string>("");
  const [formData, setFormData] = useState({
    team_id: "",
    venue_id: "",
    day_of_week: "",
    start_time: "",
    end_time: "",
    default_activity_type_id: "1",
    is_active: true,
  });

  useEffect(() => {
    loadSchedules();
    loadTeams();
    loadVenues();
  }, []);

  useEffect(() => {
    async function checkAdmin() {
      if (!user) return;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!data);
    }
    checkAdmin();
  }, [user]);

  async function loadTeams() {
    try {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name")
        .order("name", { ascending: true });

      if (error) throw error;
      setTeams(data || []);
    } catch (error: any) {
      console.error("Napaka pri nalaganju selekcij:", error);
    }
  }

  async function loadVenues() {
    try {
      const { data, error } = await supabase
        .from("venues")
        .select("id, name, city")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) throw error;
      setVenues(data || []);
    } catch (error: any) {
      console.error("Napaka pri nalaganju dvoran:", error);
    }
  }

  async function loadSchedules() {
    try {
      setLoading(true);
      const { data, error } = await supabase
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

  function handleAdd() {
    setSelectedSchedule(null);
    setFormData({
      team_id: teams[0]?.id || "",
      venue_id: venues[0]?.id || "",
      day_of_week: "1",
      start_time: "",
      end_time: "",
      default_activity_type_id: "1",
      is_active: true,
    });
    setDialogOpen(true);
  }

  function handleEdit(schedule: ScheduleTemplate) {
    setSelectedSchedule(schedule);
    setFormData({
      team_id: schedule.team_id,
      venue_id: schedule.venue_id,
      day_of_week: schedule.day_of_week.toString(),
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      default_activity_type_id: schedule.default_activity_type_id.toString(),
      is_active: schedule.is_active,
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.team_id || !formData.venue_id || !formData.day_of_week || !formData.start_time || !formData.end_time) {
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Selekcija, dvorana, dan v tednu, začetek in konec so obvezni",
      });
      return;
    }

    try {
      setLoading(true);

      const payload = {
        team_id: formData.team_id,
        venue_id: formData.venue_id,
        day_of_week: parseInt(formData.day_of_week),
        start_time: formData.start_time,
        end_time: formData.end_time,
        default_activity_type_id: parseInt(formData.default_activity_type_id),
        is_active: formData.is_active,
      };

      if (selectedSchedule) {
        const { error } = await supabase
          .from("schedule_templates")
          .update(payload)
          .eq("id", selectedSchedule.id);

        if (error) throw error;
        toast({
          title: "Uspešno",
          description: "Termin uspešno posodobljen",
        });
      } else {
        const { error } = await supabase
          .from("schedule_templates")
          .insert([payload]);

        if (error) throw error;
        toast({
          title: "Uspešno",
          description: "Termin uspešno ustvarjen",
        });
      }

      setDialogOpen(false);
      loadSchedules();
    } catch (error: any) {
      console.error("Napaka pri shranjevanju termina:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Napaka pri shranjevanju termina",
      });
    } finally {
      setLoading(false);
    }
  }

  function handleDeleteClick(schedule: ScheduleTemplate) {
    setScheduleToDelete(schedule);
    setDeleteDialogOpen(true);
  }

  async function handleConfirmDelete() {
    if (!scheduleToDelete) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from("schedule_templates")
        .delete()
        .eq("id", scheduleToDelete.id);

      if (error) throw error;
      toast({
        title: "Uspešno",
        description: "Termin uspešno izbrisan",
      });
      
      setDeleteDialogOpen(false);
      setScheduleToDelete(null);
      loadSchedules();
    } catch (error: any) {
      console.error("Napaka pri brisanju termina:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Napaka pri brisanju termina",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(scheduleId: string) {
    if (!confirm("Ali ste prepričani, da želite izbrisati ta termin?")) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from("schedule_templates")
        .delete()
        .eq("id", scheduleId);

      if (error) throw error;
      toast({
        title: "Uspešno",
        description: "Termin uspešno izbrisan",
      });
      loadSchedules();
    } catch (error: any) {
      console.error("Napaka pri brisanju termina:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Napaka pri brisanju termina",
      });
    } finally {
      setLoading(false);
    }
  }

  function getDayLabel(dayOfWeek: number): string {
    return DAYS.find((d) => d.value === dayOfWeek.toString())?.label || "N/A";
  }

  function getDayName(day: number): string {
    const days = ["Ponedeljek", "Torek", "Sreda", "Četrtek", "Petek", "Sobota", "Nedelja"];
    return days[day] || "N/A";
  }

  function handleEditSchedule(schedule: ScheduleTemplate) {
    // TODO: Implement edit functionality
    console.log("Edit schedule:", schedule);
    toast({
      title: "Uredi urnik",
      description: "Funkcionalnost še ni implementirana",
    });
  }

  function handleDeleteSchedule(schedule: ScheduleTemplate) {
    // TODO: Implement delete functionality
    console.log("Delete schedule:", schedule);
    toast({
      title: "Izbriši urnik",
      description: "Funkcionalnost še ni implementirana",
    });
  }

  function renderScheduleRow(schedule: ScheduleTemplate) {
    const dayName = getDayName(schedule.day_of_week);
    
    return (
      <TableRow key={schedule.id}>
        <TableCell>{dayName}</TableCell>
        <TableCell>{schedule.teams?.name || "N/A"}</TableCell>
        <TableCell>{schedule.start_time} - {schedule.end_time}</TableCell>
        <TableCell>
          {schedule.venues?.name || schedule.custom_venue || "N/A"}
        </TableCell>
        <TableCell>
          {schedule.is_active ? (
            <Badge variant="default">Aktiven</Badge>
          ) : (
            <Badge variant="secondary">Neaktiven</Badge>
          )}
        </TableCell>
        <TableCell>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleEditSchedule(schedule)}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDeleteSchedule(schedule)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  function applyFilters() {
    let filtered = [...schedules];

    if (selectedTeam) {
      filtered = filtered.filter((s) => s.team_id === selectedTeam);
    }

    if (selectedDay) {
      filtered = filtered.filter(
        (s) => s.day_of_week === parseInt(selectedDay)
      );
    }

    setFilteredSchedules(filtered);
  }

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <AppLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Urniki</h2>
              <p className="text-muted-foreground">Upravljanje rednih terminov aktivnosti</p>
            </div>
            <Button onClick={handleAdd} disabled={loading || !isAdmin}>
              <Plus className="h-4 w-4 mr-2" />
              Dodaj urnik
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Seznam urnikov ({schedules.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading && schedules.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Nalagam...</div>
              ) : schedules.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Ni urnikov</p>
                  <p className="text-sm mt-2">Dodajte prvi urnik</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Selekcija</TableHead>
                        <TableHead>Dvorana</TableHead>
                        <TableHead>Dan</TableHead>
                        <TableHead>Čas</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Akcije</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {schedules.map((schedule) => (
                        <TableRow key={schedule.id}>
                          <TableCell className="font-medium">
                            {schedule.teams?.name || "N/A"}
                          </TableCell>
                          <TableCell>
                            {schedule.venues?.name || "N/A"}
                            {schedule.venues?.city && ` (${schedule.venues.city})`}
                          </TableCell>
                          <TableCell>{getDayLabel(schedule.day_of_week)}</TableCell>
                          <TableCell>
                            {schedule.start_time} - {schedule.end_time}
                          </TableCell>
                          <TableCell>
                            <Badge variant={schedule.is_active ? "default" : "secondary"}>
                              {schedule.is_active ? "Aktiven" : "Neaktiven"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEdit(schedule)}
                                disabled={loading || !isAdmin}
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                Uredi
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDeleteClick(schedule)}
                                disabled={loading || !isAdmin}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Izbriši
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {selectedSchedule ? "Uredi urnik" : "Dodaj urnik"}
                </DialogTitle>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="team_id">
                    Selekcija <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.team_id}
                    onValueChange={(value) => setFormData({ ...formData, team_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Izberite selekcijo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Vse</SelectItem>
                      {teams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="venue_id">
                    Dvorana <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.venue_id}
                    onValueChange={(value) => setFormData({ ...formData, venue_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Izberite dvorano" />
                    </SelectTrigger>
                    <SelectContent>
                      {venues.map((venue) => (
                        <SelectItem key={venue.id} value={venue.id}>
                          {venue.name} ({venue.city})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="day_of_week">
                    Dan <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.day_of_week}
                    onValueChange={(value) => setFormData({ ...formData, day_of_week: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Izberite dan" />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS.map((day) => (
                        <SelectItem key={day.value} value={day.value}>
                          {day.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start_time">Začetek *</Label>
                    <Input
                      id="start_time"
                      type="time"
                      step="900"
                      value={formData.start_time}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end_time">Konec *</Label>
                    <Input
                      id="end_time"
                      type="time"
                      step="900"
                      value={formData.end_time}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="is_active">Aktiven urnik</Label>
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_active: checked })
                    }
                  />
                </div>

                <DialogFooter className="mt-6 sticky bottom-0 bg-background pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                    disabled={loading}
                  >
                    Prekliči
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? "Shranjujem..." : selectedSchedule ? "Posodobi" : "Dodaj"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Potrditev brisanja</AlertDialogTitle>
                <AlertDialogDescription>
                  Nameravaš izbrisati redni termin{" "}
                  <strong>
                    {scheduleToDelete?.teams?.name} ({getDayName(scheduleToDelete?.day_of_week || 0)} {scheduleToDelete?.start_time})
                  </strong>
                  . Izbrišem?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Prekliči</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleConfirmDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Izbriši
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}