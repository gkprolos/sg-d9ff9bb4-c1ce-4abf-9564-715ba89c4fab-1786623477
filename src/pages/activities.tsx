import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Edit, Trash2, Plus, ClipboardCheck } from "lucide-react";
import { useRouter } from "next/router";

interface Activity {
  id: string;
  activity_date: string;
  start_time: string;
  end_time: string;
  is_completed: boolean;
  activity_type_id: number;
  is_home_game: boolean;
  teams: { id: string; name: string; short_name: string | null };
  venues: { name: string } | null;
  activity_coaches: Array<{
    role: string;
    coach_id: string;
    profiles: {
      id: string;
      full_name: string;
    };
  }>;
}

const ACTIVITY_TYPE_NAMES: Record<number, string> = {
  1: "Trening v dvorani",
  2: "Trening ali pripravljalna tekma zunaj dvorane",
  3: "Uradna tekma"
};

export default function ActivitiesPage() {
  const router = useRouter();
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [activities, setActivities] = useState<any[]>([]);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [coaches, setCoaches] = useState<any[]>([]);
  const [selectedSeason, setSelectedSeason] = useState("");
  const [selectedTeam, setSelectedTeam] = useState("");
  const [selectedCoach, setSelectedCoach] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [venues, setVenues] = useState<any[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [activityToDelete, setActivityToDelete] = useState<Activity | null>(null);
  const [editForm, setEditForm] = useState({
    activity_date: "",
    start_time: "",
    end_time: "",
    venue_id: "",
    mileage_km: 0,
    activity_type_id: 1,
    is_home_game: null as boolean | null,
  });

  const isAdmin = userRole === "admin";

  useEffect(() => {
    loadSeasons();
    loadTeams();
    loadCoaches();
    loadVenues();
  }, []);

  useEffect(() => {
    loadActivities();
  }, [selectedSeason, selectedTeam, selectedCoach, dateFrom, dateTo]);

  async function loadSeasons() {
    try {
      const { data, error } = await supabase
        .from("seasons")
        .select("id, name, is_active")
        .order("name", { ascending: false });

      if (error) throw error;

      setSeasons(data || []);

      // Set active season as default
      const activeSeason = data?.find(s => s.is_active);
      if (activeSeason) {
        setSelectedSeason(activeSeason.id);
      }
    } catch (error: any) {
      console.error("Error loading seasons:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Ni mogoče naložiti sezon",
      });
    }
  }

  async function loadTeams() {
    try {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name")
        .eq("is_archived", false)
        .order("name", { ascending: true });

      if (error) throw error;

      setTeams(data || []);
    } catch (error: any) {
      console.error("Error loading teams:", error);
    }
  }

  async function loadCoaches() {
    try {
      // Get coach user IDs from user_roles
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "coach");

      if (rolesError) throw rolesError;

      const coachIds = (userRoles || []).map(ur => ur.user_id);

      if (coachIds.length === 0) {
        setCoaches([]);
        return;
      }

      // Get profiles for those coaches
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", coachIds)
        .order("full_name", { ascending: true });

      if (error) throw error;

      setCoaches(data || []);
    } catch (error: any) {
      console.error("Error loading coaches:", error);
    }
  }

  async function loadVenues() {
    try {
      const { data, error } = await supabase
        .from("venues")
        .select("id, name")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) throw error;
      setVenues(data || []);
    } catch (error: any) {
      console.error("Napaka pri nalaganju dvoran:", error);
    }
  }

  function handleAdd() {
    router.push("/attendance");
  }

  async function loadActivities() {
    try {
      setLoading(true);

      let query = supabase
        .from("activities")
        .select(`
          id,
          activity_date,
          start_time,
          end_time,
          activity_type_id,
          is_home_game,
          notes,
          season_id,
          team_id,
          teams(name),
          venues(name),
          activity_coaches(
            id,
            role,
            mileage_km,
            hours_worked,
            total_amount,
            profiles(full_name)
          )
        `)
        .order("activity_date", { ascending: false });

      // Apply filters
      if (selectedSeason) {
        query = query.eq("season_id", selectedSeason);
      }

      if (selectedTeam) {
        query = query.eq("team_id", selectedTeam);
      }

      if (dateFrom) {
        query = query.gte("activity_date", dateFrom);
      }

      if (dateTo) {
        query = query.lte("activity_date", dateTo);
      }

      // RLS policy already filters activities for coaches based on their team assignments
      // No need for additional frontend filtering - let RLS handle it

      const { data, error } = await query;

      if (error) throw error;

      // Get season names for activities
      let activitiesWithSeasons = data || [];
      if (activitiesWithSeasons.length > 0) {
        const seasonIds = [...new Set(activitiesWithSeasons.map(a => a.season_id).filter(Boolean))];
        
        if (seasonIds.length > 0) {
          const { data: seasonsData } = await supabase
            .from("seasons")
            .select("id, name")
            .in("id", seasonIds);

          const seasonMap = new Map((seasonsData || []).map(s => [s.id, s.name]));
          
          activitiesWithSeasons = activitiesWithSeasons.map(activity => ({
            ...activity,
            season_name: seasonMap.get(activity.season_id) || "N/A",
          }));
        }
      }

      // Filter by coach if selected
      let filteredData = activitiesWithSeasons;
      if (selectedCoach) {
        filteredData = filteredData.filter(activity => 
          activity.activity_coaches?.some((ac: any) => ac.profiles?.id === selectedCoach)
        );
      }

      setActivities(filteredData);
    } catch (error: any) {
      console.error("Error loading activities:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Ni mogoče naložiti aktivnosti",
      });
    } finally {
      setLoading(false);
    }
  }

  function getActivityTypeName(typeId: number): string {
    return ACTIVITY_TYPE_NAMES[typeId] || "N/A";
  }

  async function handleEditClick(activity: Activity) {
    try {
      setLoading(true);
      setSelectedActivity(activity);

      // Get the full activity data including venue_id and coach mileage
      const { data, error } = await supabase
        .from("activities")
        .select(`
          venue_id,
          activity_type_id,
          is_home_game,
          activity_coaches(coach_id, mileage_km)
        `)
        .eq("id", activity.id)
        .single();

      if (error) throw error;

      // Get mileage for the first coach (or 0 if none)
      const firstCoachMileage = data?.activity_coaches?.[0]?.mileage_km || 0;

      // Set the form with the loaded venue_id and mileage
      setEditForm({
        activity_date: activity.activity_date,
        start_time: activity.start_time,
        end_time: activity.end_time,
        venue_id: data?.venue_id || "",
        mileage_km: firstCoachMileage,
        activity_type_id: data?.activity_type_id || 1,
        is_home_game: data?.is_home_game ?? null,
      });

      // Now open the dialog with all data loaded
      setEditDialogOpen(true);
    } catch (error: any) {
      console.error("Napaka pri nalaganju podatkov aktivnosti:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Ni mogoče naložiti podatkov aktivnosti",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateActivity() {
    if (!selectedActivity) return;

    if (!editForm.activity_date || !editForm.start_time || !editForm.end_time) {
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Datum, začetek in konec so obvezni",
      });
      return;
    }

    // Validate is_home_game for type 3
    if (editForm.activity_type_id === 3 && editForm.is_home_game === null) {
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Za uradno tekmo je obvezna izbira doma/gostovanje",
      });
      return;
    }

    try {
      setLoading(true);

      // Update activity basic info
      const { error: activityError } = await supabase
        .from("activities")
        .update({
          activity_date: editForm.activity_date,
          start_time: editForm.start_time,
          end_time: editForm.end_time,
          venue_id: editForm.venue_id || null,
          activity_type_id: editForm.activity_type_id,
          is_home_game: editForm.is_home_game,
        })
        .eq("id", selectedActivity.id);

      if (activityError) throw activityError;

      // Update mileage for all coaches if mileage_km is provided and > 0
      if (editForm.mileage_km && editForm.mileage_km > 0) {
        const { error: mileageError } = await supabase
          .from("activity_coaches")
          .update({ mileage_km: editForm.mileage_km })
          .eq("activity_id", selectedActivity.id);

        if (mileageError) throw mileageError;
      }

      toast({
        title: "Uspešno",
        description: "Aktivnost uspešno posodobljena",
      });

      setEditDialogOpen(false);
      loadActivities();
    } catch (error: any) {
      console.error("Napaka pri posodabljanju aktivnosti:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Napaka pri posodabljanju aktivnosti",
      });
    } finally {
      setLoading(false);
    }
  }

  function handleDeleteClick(activity: Activity) {
    setActivityToDelete(activity);
    setDeleteDialogOpen(true);
  }

  async function handleConfirmDelete() {
    if (!activityToDelete) return;

    try {
      setLoading(true);

      const { error } = await supabase
        .from("activities")
        .delete()
        .eq("id", activityToDelete.id);

      if (error) {
        console.error("Napaka pri brisanju aktivnosti:", error);
        toast({
          variant: "destructive",
          title: "Napaka pri brisanju",
          description: error.message || "Napaka pri brisanju aktivnosti",
        });
        throw error;
      }

      toast({
        title: "Uspešno",
        description: "Aktivnost uspešno izbrisana",
      });

      setDeleteDialogOpen(false);
      setActivityToDelete(null);
      loadActivities();
    } catch (error: any) {
      console.error("Napaka pri brisanju aktivnosti:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">
                {isAdmin ? "Aktivnosti" : "Moje aktivnosti"}
              </h2>
              <p className="text-muted-foreground">
                {isAdmin 
                  ? "Upravljanje vseh aktivnosti kluba" 
                  : "Pregled aktivnosti kjer si glavni trener ali sotrener"
                }
              </p>
            </div>
            <Button onClick={handleAdd} disabled={loading}>
              <Plus className="h-4 w-4 mr-2" />
              Dodaj aktivnost
            </Button>
          </div>

          <div>
            <h2 className="text-3xl font-bold tracking-tight">Aktivnosti</h2>
            <p className="text-muted-foreground">
              Pregled vseh aktivnosti in treningov
            </p>
          </div>

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Filtri</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <div className="space-y-2">
                  <Label htmlFor="date_from">Datum od</Label>
                  <Input
                    id="date_from"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date_to">Datum do</Label>
                  <Input
                    id="date_to"
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="season_filter">Sezona</Label>
                  <Select value={selectedSeason || ""} onValueChange={(val) => setSelectedSeason(val || "")}>
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
                  <Select value={selectedTeam || ""} onValueChange={(val) => setSelectedTeam(val || "")}>
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

                <div className="space-y-2">
                  <Label htmlFor="coach_filter">Trener</Label>
                  <Select value={selectedCoach || ""} onValueChange={(val) => setSelectedCoach(val || "")}>
                    <SelectTrigger id="coach_filter">
                      <SelectValue placeholder="Vsi trenerji" />
                    </SelectTrigger>
                    <SelectContent>
                      {coaches.map((coach) => (
                        <SelectItem key={coach.id} value={coach.id}>
                          {coach.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {(dateFrom || dateTo || selectedTeam || selectedCoach) && (
                <div className="mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDateFrom("");
                      setDateTo("");
                      setSelectedTeam("");
                      setSelectedCoach("");
                    }}
                  >
                    Počisti filtre
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activities List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Seznam aktivnosti ({activities.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading && activities.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Nalagam...</div>
              ) : activities.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Ni aktivnosti</p>
                  <p className="text-sm mt-2">Dodajte aktivnost preko "Vnos prisotnosti"</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Datum</TableHead>
                        <TableHead>Selekcija</TableHead>
                        <TableHead>Čas</TableHead>
                        <TableHead>Dvorana</TableHead>
                        <TableHead>Trenerji</TableHead>
                        <TableHead>Tip</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Akcije</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activities.map((activity) => {
                        const headCoach = activity.activity_coaches?.find((ac) => ac.role === 'head');
                        const assistants = activity.activity_coaches?.filter((ac) => ac.role === 'assistant') || [];
                        
                        return (
                          <TableRow key={activity.id}>
                            <TableCell className="font-medium">
                              {new Date(activity.activity_date).toLocaleDateString("sl-SI")}
                            </TableCell>
                            <TableCell>{activity.teams?.name || "N/A"}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {activity.season_name || "N/A"}
                            </TableCell>
                            <TableCell>
                              {activity.venues?.name || "-"}
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                {headCoach && (
                                  <div className="text-sm">
                                    <Badge variant="default" className="mr-1">Glavni</Badge>
                                    {headCoach.profiles?.full_name}
                                  </div>
                                )}
                                {assistants.map((assistant, idx) => (
                                  <div key={idx} className="text-sm">
                                    <Badge variant="secondary" className="mr-1">Sotrener</Badge>
                                    {assistant.profiles?.full_name}
                                  </div>
                                ))}
                                {!headCoach && assistants.length === 0 && (
                                  <span className="text-sm text-muted-foreground">Ni trenerjev</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {getActivityTypeName(activity.activity_type_id)}
                              {activity.activity_type_id === 3 && (
                                <Badge variant="outline" className="ml-2">
                                  {activity.is_home_game ? "Doma" : "Gostovanje"}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={activity.is_completed ? "default" : "secondary"}>
                                {activity.is_completed ? "Zaključena" : "Odprta"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2 justify-end">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => router.push(`/attendance?activity=${activity.id}`)}
                                >
                                  <ClipboardCheck className="h-4 w-4" />
                                </Button>
                                {isAdmin && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleEditClick(activity)}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => handleDeleteClick(activity)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent className="max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Uredi aktivnost</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_date">Datum *</Label>
                  <Input
                    id="edit_date"
                    type="date"
                    value={editForm.activity_date}
                    onChange={(e) => setEditForm({ ...editForm, activity_date: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit_start_time">Začetek *</Label>
                    <Input
                      id="edit_start_time"
                      type="time"
                      step="900"
                      value={editForm.start_time}
                      onChange={(e) => setEditForm({ ...editForm, start_time: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit_end_time">Konec *</Label>
                    <Input
                      id="edit_end_time"
                      type="time"
                      step="900"
                      value={editForm.end_time}
                      onChange={(e) => setEditForm({ ...editForm, end_time: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit_mileage">Kilometri</Label>
                  <Input
                    id="edit_mileage"
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="0"
                    value={editForm.mileage_km || ""}
                    onChange={(e) => setEditForm({ ...editForm, mileage_km: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit_venue">Dvorana</Label>
                  <Select
                    value={editForm.venue_id}
                    onValueChange={(value) => setEditForm({ ...editForm, venue_id: value })}
                  >
                    <SelectTrigger id="edit_venue">
                      <SelectValue placeholder="Izberi dvorano (ni obvezno)" />
                    </SelectTrigger>
                    <SelectContent>
                      {venues.map((venue) => (
                        <SelectItem key={venue.id} value={venue.id}>
                          {venue.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit_activity_type">Vrsta aktivnosti *</Label>
                  <Select
                    value={editForm.activity_type_id.toString()}
                    onValueChange={(value) => setEditForm({ ...editForm, activity_type_id: parseInt(value), is_home_game: value === "3" ? editForm.is_home_game : null })}
                  >
                    <SelectTrigger id="edit_activity_type">
                      <SelectValue placeholder="Izberi vrsto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 - Trening v dvorani</SelectItem>
                      <SelectItem value="2">2 - Trening ali pripravljalna tekma zunaj dvorane</SelectItem>
                      <SelectItem value="3">3 - Uradna tekma</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {editForm.activity_type_id === 3 && (
                  <div className="space-y-2">
                    <Label>Lokacija tekme *</Label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="edit_is_home_game"
                          checked={editForm.is_home_game === true}
                          onChange={() => setEditForm({ ...editForm, is_home_game: true })}
                          className="w-4 h-4"
                        />
                        <span>Domača tekma</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="edit_is_home_game"
                          checked={editForm.is_home_game === false}
                          onChange={() => setEditForm({ ...editForm, is_home_game: false })}
                          className="w-4 h-4"
                        />
                        <span>Gostovanje</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="sticky bottom-0 bg-background pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditDialogOpen(false)}
                  disabled={loading}
                >
                  Prekliči
                </Button>
                <Button onClick={handleUpdateActivity} disabled={loading}>
                  {loading ? "Shranjujem..." : "Shrani spremembe"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Potrditev brisanja</AlertDialogTitle>
                <AlertDialogDescription>
                  Nameravaš izbrisati aktivnost{" "}
                  <strong>
                    {activityToDelete?.teams.name} ({new Date(activityToDelete?.activity_date || "").toLocaleDateString("sl-SI")})
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