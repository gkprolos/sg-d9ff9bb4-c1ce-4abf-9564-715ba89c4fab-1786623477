import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  ClipboardCheck,
  Plus,
  Loader2,
  Edit,
  Trash2,
  ChevronDown,
  ChevronRight,
  Calendar,
  Save } from
"lucide-react";

interface Activity {
  id: string;
  activity_date: string;
  team: {name: string;};
  venue: {name: string;} | null;
  start_time: string;
  end_time: string;
}

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  attendance_status?: number | null;
}

interface CreateActivityResult {
  activity_id: string;
  is_new: boolean;
  role: string;
}

export default function AttendancePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<string>("");
  const [teams, setTeams] = useState<any[]>([]);
  const [venues, setVenues] = useState<any[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [showNewActivity, setShowNewActivity] = useState(false);
  const [newActivityOpen, setNewActivityOpen] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [newActivityForm, setNewActivityForm] = useState({
    team_id: "",
    venue_id: "",
    start_time: "",
    end_time: "",
    mileage_km: "",
    activity_type_id: "1", // Default to "Trening v dvorani"
    is_home_game: null as boolean | null
  });

  useEffect(() => {
    loadTeams();
    loadVenues();
  }, []);

  useEffect(() => {
    if (selectedDate) {
      loadActivitiesForDate();
    }
  }, [selectedDate]);

  useEffect(() => {
    if (selectedActivity) {
      loadPlayersForActivity();
    } else {
      setPlayers([]);
    }
  }, [selectedActivity]);

  // Handle URL parameter for direct activity selection
  useEffect(() => {
    if (router.query.activity && typeof router.query.activity === "string") {
      const activityId = router.query.activity;

      // Load activity details to get date
      supabase.
      from("activities").
      select("activity_date").
      eq("id", activityId).
      single().
      then(({ data, error }) => {
        if (!error && data) {
          setSelectedDate(data.activity_date);
          setSelectedActivity(activityId);
        }
      });
    }
  }, [router.query.activity]);

  async function loadTeams() {
    try {
      console.log('[DEBUG ATTENDANCE] Loading teams...');
      const { data, error } = await supabase.
      from("teams").
      select("id, name, short_name").
      eq("is_archived", false).
      order("name", { ascending: true });

      console.log('[DEBUG ATTENDANCE] Teams response:', { data, error, count: data?.length || 0 });
      if (error) throw error;
      setTeams(data || []);
    } catch (error: any) {
      console.error("Napaka pri nalaganju selekcij:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: `Napaka pri nalaganju selekcij: ${error.message}`
      });
    }
  }

  async function loadVenues() {
    try {
      console.log('[DEBUG ATTENDANCE] Loading venues...');
      const { data, error } = await supabase.
      from("venues").
      select("id, name, city").
      eq("is_active", true).
      order("name", { ascending: true });

      console.log('[DEBUG ATTENDANCE] Venues response:', { data, error, count: data?.length || 0 });
      if (error) throw error;
      setVenues(data || []);
    } catch (error: any) {
      console.error("Napaka pri nalaganju dvoran:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: `Napaka pri nalaganju dvoran: ${error.message}`
      });
    }
  }

  async function loadActivitiesForDate() {
    try {
      setLoading(true);
      const { data, error } = await supabase.
      from("activities").
      select(`
          id,
          activity_date,
          start_time,
          end_time,
          team:teams(name),
          venue:venues(name)
        `).
      eq("activity_date", selectedDate).
      order("start_time", { ascending: true });

      if (error) throw error;
      setActivities(data || []);

      // Auto-select if only one activity and nothing is selected yet
      if (data && data.length === 1 && !selectedActivity) {
        setSelectedActivity(data[0].id);
      }
    } catch (error: any) {
      console.error("Napaka pri nalaganju aktivnosti:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Ni mogoče naložiti aktivnosti"
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadPlayersForActivity(activityId?: string) {
    try {
      setLoading(true);

      const targetActivityId = activityId || selectedActivity;
      if (!targetActivityId) return;

      // Get activity details to find team_id
      const { data: activityData, error: actError } = await supabase.
      from("activities").
      select("team_id").
      eq("id", targetActivityId).
      single();

      if (actError) throw actError;

      // Get players for this team
      const { data: teamPlayers, error: playersError } = await supabase.
      from("team_players").
      select(`
          player_id,
          players(id, first_name, last_name)
        `).
      eq("team_id", activityData.team_id);

      if (playersError) throw playersError;

      // Get existing attendance records
      const { data: attendanceData, error: attendanceError } = await supabase.
      from("attendance_records").
      select("player_id, status").
      eq("activity_id", targetActivityId);

      if (attendanceError) throw attendanceError;

      // Map attendance to players
      const attendanceMap = new Map(
        (attendanceData || []).map((a) => [a.player_id, a.status])
      );

      const playersList = (teamPlayers || []).map((tp: any) => ({
        id: tp.players.id,
        first_name: tp.players.first_name,
        last_name: tp.players.last_name,
        attendance_status: attendanceMap.get(tp.players.id) ?? null
      }));

      setPlayers(playersList);
    } catch (error: any) {
      console.error("Napaka pri nalaganju igralcev:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Ni mogoče naložiti igralcev"
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateActivity() {
    if (!newActivityForm.team_id || !newActivityForm.start_time || !newActivityForm.end_time) {
      toast({
        variant: "destructive",
        title: "Manjkajo podatki",
        description: "Selekcija, začetek in konec so obvezni"
      });
      return;
    }

    // Validate is_home_game for type 3
    if (newActivityForm.activity_type_id === "3" && newActivityForm.is_home_game === null) {
      toast({
        variant: "destructive",
        title: "Manjkajo podatki",
        description: "Za uradno tekmo je obvezna izbira doma/gostovanje"
      });
      return;
    }

    if (!user?.id) {
      toast({
        variant: "destructive",
        title: "Napaka pri avtentikaciji",
        description: "Uporabnik ni prijavljen. Prosim, odjavi se in se ponovno prijavi."
      });
      return;
    }

    try {
      setLoading(true);

      // Get team name for toast messages
      const selectedTeam = teams.find((t) => t.id === newActivityForm.team_id);
      const teamName = selectedTeam?.name || "izbrano selekcijo";

      console.log('[DEBUG] Calling create_or_open_activity RPC for team:', teamName, 'on date:', selectedDate);

      // Call atomic RPC function
      const { data: result, error } = await supabase.rpc(
        "create_or_open_activity",
        {
          p_team_id: newActivityForm.team_id,
          p_activity_date: selectedDate,
          p_activity_type_id: parseInt(newActivityForm.activity_type_id),
          p_venue_id: newActivityForm.venue_id || null,
          p_custom_venue: null,
          p_start_time: newActivityForm.start_time || null,
          p_end_time: newActivityForm.end_time || null,
          p_is_home_game: newActivityForm.is_home_game
        }
      );

      if (error) {
        console.error("RPC create_or_open_activity error:", error);
        toast({
          variant: "destructive",
          title: "Napaka pri ustvarjanju aktivnosti",
          description: error.message
        });
        throw new Error(error.message);
      }

      console.log('[DEBUG] RPC result:', result);

      const typedResult = result as unknown as CreateActivityResult;
      const activityId = typedResult.activity_id;
      const isNew = typedResult.is_new;
      const role = typedResult.role;

      if (isNew) {
        toast({
          title: "Uspešno ustvarjena aktivnost!",
          description: `Aktivnost za ${teamName} na ${new Date(selectedDate).toLocaleDateString('sl-SI')} je bila uspešno ustvarjena. Ti si glavni trener.`
        });
      } else {
        if (role === 'head') {
          toast({
            title: "Aktivnost že obstaja",
            description: `Za ${teamName} na ${new Date(selectedDate).toLocaleDateString('sl-SI')} že obstaja aktivnost. Odprta kot glavni trener.`
          });
        } else if (role === 'assistant') {
          toast({
            title: "Pridružil si se aktivnosti",
            description: `Za ${teamName} na ${new Date(selectedDate).toLocaleDateString('sl-SI')} že obstaja aktivnost. Pridružil si se kot sotrener.`
          });
        } else {
          toast({
            title: "Aktivnost že obstaja",
            description: `Za ${teamName} na ${new Date(selectedDate).toLocaleDateString('sl-SI')} že obstaja aktivnost. Odprta.`
          });
        }
      }

      setSelectedActivity(activityId);
      setShowNewActivity(false);
      setNewActivityForm({ team_id: "", venue_id: "", start_time: "", end_time: "", mileage_km: "", activity_type_id: "1", is_home_game: null });
      await loadActivitiesForDate();

      // Update mileage if provided
      if (newActivityForm.mileage_km && parseFloat(newActivityForm.mileage_km) > 0) {
        const mileageValue = parseFloat(newActivityForm.mileage_km);

        const { error: mileageError } = await supabase.
        from("activity_coaches").
        update({ mileage_km: mileageValue }).
        eq("activity_id", activityId).
        eq("coach_id", user.id);

        if (mileageError) {
          console.error("Napaka pri shranjevanju kilometrov:", mileageError);
          toast({
            variant: "destructive",
            title: "Opozorilo",
            description: "Aktivnost je bila ustvarjena, vendar kilometri niso bili shranjeni."
          });
        } else {
          console.log(`Kilometri shranjeni: ${mileageValue} km za trenerja ${user.id}`);
        }
      }

      // Explicitly load players for the newly created/opened activity
      await loadPlayersForActivity(activityId);
    } catch (error: any) {
      console.error("Napaka pri ustvarjanju aktivnosti:", error);
      // Error toast already shown above
    } finally {
      setLoading(false);
    }
  }

  async function handleAttendanceChange(playerId: string, status: number | null) {
    if (![0, 1, 2].includes(status ?? 0)) return;

    try {
      // Upsert attendance record
      const { error } = await supabase.
      from("attendance_records").
      upsert({
        activity_id: selectedActivity,
        player_id: playerId,
        status: status ?? 0,
        recorded_by: user?.id
      }, {
        onConflict: "activity_id,player_id"
      });

      if (error) throw error;

      // Update local state
      setPlayers((prev) => prev.map((p) =>
      p.id === playerId ? { ...p, attendance_status: status } : p
      ));
    } catch (error: any) {
      console.error("Napaka pri shranjevanju prisotnosti:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Napaka pri shranjevanju prisotnosti"
      });
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, index: number, playerId: string) {
    if (e.key === "Enter") {
      e.preventDefault();

      // Move to next player
      if (index < players.length - 1) {
        const nextInput = inputRefs.current[index + 1];
        if (nextInput) {
          nextInput.focus();
          nextInput.select(); // Select text for immediate replacement
        }
      } else {
        // Last player - focus save button or blur
        const saveButton = document.querySelector('button[type="submit"]') as HTMLElement;
        if (saveButton) {
          saveButton.focus();
        }
      }
    } else if (e.key === "Backspace") {
      e.preventDefault();

      // Clear the input
      const currentPlayer = players.find((p) => p.id === playerId);
      if (currentPlayer && currentPlayer.attendance_status !== null) {
        handleAttendanceChange(playerId, null);
      }
    } else if (e.key === "Tab") {
      // Let default Tab behavior work
      return;
    }
  }

  const presentCount = players.filter((p) => p.attendance_status === 1).length;
  const absentCount = players.filter((p) => p.attendance_status === 0).length;
  const excusedCount = players.filter((p) => p.attendance_status === 2).length;

  async function handleCompleteAttendance() {
    if (!selectedActivity) return;

    try {
      setLoading(true);

      // Call RPC function to complete activity and calculate amounts
      const { data, error } = await supabase.rpc('complete_activity_with_rates', {
        p_activity_id: selectedActivity
      });

      if (error) {
        console.error("Napaka pri zaključevanju aktivnosti:", error);
        toast({
          variant: "destructive",
          title: "Napaka pri zaključevanju",
          description: error.message
        });
        throw error;
      }

      toast({
        title: "Aktivnost uspešno zaključena!",
        description: `Prisotnost shranjena: ${presentCount} prisotnih, ${absentCount} odsotnih, ${excusedCount} opravičenih. Obračun je bil avtomatsko izračunan.`
      });

      // Redirect back to activities
      setTimeout(() => {
        router.push("/activities");
      }, 1500);
    } catch (error: any) {
      console.error("Napaka pri zaključevanju vnosa:", error);
      // Error toast already shown above
    } finally {
      setLoading(false);
    }
  }

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-6 w-6 text-primary" />
              <h1 className="text-3xl font-bold">Prisotnost</h1>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => router.push("/attendance/monthly")}
                variant="outline" style={{ backgroundColor: "#fbbf24", backgroundImage: "none" }}>
                
                <Calendar className="mr-2 h-4 w-4" />
                Mesečni Pregled
              </Button>
              {/* Top right action button */}
              <Button
                onClick={handleCreateActivity}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nova Aktivnost
              </Button>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Izbira aktivnosti</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Datum</Label>
                  <Input
                    id="date"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      setSelectedActivity("");
                      setShowNewActivity(false);
                    }} />
                  
                </div>

                {activities.length > 0 ?
                <div className="space-y-2">
                    <Label>Obstoječe aktivnosti na ta dan</Label>
                    <div className="space-y-2">
                      {activities.map((activity) =>
                    <div
                      key={activity.id}
                      className={`p-3 border rounded-lg cursor-pointer hover:bg-muted/50 ${
                      selectedActivity === activity.id ? "bg-primary/10 border-primary" : ""}`
                      }
                      onClick={() => {
                        setSelectedActivity(activity.id);
                        setShowNewActivity(false);
                      }}>
                      
                          <p className="font-medium">{activity.team.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {activity.start_time} - {activity.end_time}
                            {activity.venue && ` • ${activity.venue.name}`}
                          </p>
                        </div>
                    )}
                    </div>
                  </div> :

                <p className="text-sm text-muted-foreground">Ni aktivnosti na ta dan</p>
                }

                {!showNewActivity ?
                <Button onClick={() => setShowNewActivity(true)} className="w-full" style={{ backgroundColor: "#3b82f6", backgroundImage: "none" }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nova aktivnost
                  </Button> :

                <div className="space-y-4 p-4 border rounded-lg">
                    <div className="space-y-2">
                      <Label htmlFor="team">Selekcija *</Label>
                      <Select
                      value={newActivityForm.team_id}
                      onValueChange={(value) => setNewActivityForm({ ...newActivityForm, team_id: value })}>
                      
                        <SelectTrigger>
                          <SelectValue placeholder="Izberi selekcijo" />
                        </SelectTrigger>
                        <SelectContent>
                          {teams.map((team) =>
                        <SelectItem key={team.id} value={team.id}>
                              {team.name}
                            </SelectItem>
                        )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="venue">Dvorana</Label>
                      <Select
                      value={newActivityForm.venue_id}
                      onValueChange={(value) => setNewActivityForm({ ...newActivityForm, venue_id: value })}>
                      
                        <SelectTrigger>
                          <SelectValue placeholder="Izberi dvorano (ni obvezno)" />
                        </SelectTrigger>
                        <SelectContent>
                          {venues.map((venue) =>
                        <SelectItem key={venue.id} value={venue.id}>
                              {venue.name}
                            </SelectItem>
                        )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="activity_type">Vrsta aktivnosti *</Label>
                      <Select
                      value={newActivityForm.activity_type_id}
                      onValueChange={(value) => setNewActivityForm({ ...newActivityForm, activity_type_id: value, is_home_game: value === "3" ? null : null })}>
                      
                        <SelectTrigger id="activity_type">
                          <SelectValue placeholder="Izberi vrsto" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 - Trening v dvorani</SelectItem>
                          <SelectItem value="2">2 - Trening ali pripravljalna tekma zunaj dvorane</SelectItem>
                          <SelectItem value="3">3 - Uradna tekma</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {newActivityForm.activity_type_id === "3" &&
                  <div className="space-y-2">
                        <Label>Lokacija tekme *</Label>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                          type="radio"
                          name="is_home_game"
                          checked={newActivityForm.is_home_game === true}
                          onChange={() => setNewActivityForm({ ...newActivityForm, is_home_game: true })}
                          className="w-4 h-4" />
                        
                            <span>Domača tekma</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                          type="radio"
                          name="is_home_game"
                          checked={newActivityForm.is_home_game === false}
                          onChange={() => setNewActivityForm({ ...newActivityForm, is_home_game: false })}
                          className="w-4 h-4" />
                        
                            <span>Gostovanje</span>
                          </label>
                        </div>
                      </div>
                  }

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="start_time">Začetek *</Label>
                        <Input
                        id="start_time"
                        type="time"
                        step="900"
                        value={newActivityForm.start_time}
                        onChange={(e) => setNewActivityForm({ ...newActivityForm, start_time: e.target.value })} />
                      
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="end_time">Konec *</Label>
                        <Input
                        id="end_time"
                        type="time"
                        step="900"
                        value={newActivityForm.end_time}
                        onChange={(e) => setNewActivityForm({ ...newActivityForm, end_time: e.target.value })} />
                      
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="mileage_km">Kilometri (opcijsko)</Label>
                      <Input
                      id="mileage_km"
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="0"
                      value={newActivityForm.mileage_km}
                      onChange={(e) => setNewActivityForm({ ...newActivityForm, mileage_km: e.target.value })} />
                    
                      <p className="text-xs text-muted-foreground">Tvoji prevoženi kilometri za to aktivnost</p>
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={handleCreateActivity} disabled={loading} className="flex-1" style={{ backgroundColor: "#65a30d", backgroundImage: "none" }}>
                        Ustvari
                      </Button>
                      <Button
                      variant="outline"
                      onClick={() => {
                        setShowNewActivity(false);
                        setNewActivityForm({ team_id: "", venue_id: "", start_time: "", end_time: "", mileage_km: "", activity_type_id: "1", is_home_game: null });
                      }}>
                      
                        Prekliči
                      </Button>
                    </div>
                  </div>
                }
              </CardContent>
            </Card>

            {selectedActivity && players.length > 0 &&
            <Card>
                <CardHeader>
                  <CardTitle>Statistika prisotnosti</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-600">{presentCount}</div>
                      <div className="text-sm text-muted-foreground">Prisotni</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-red-600">{absentCount}</div>
                      <div className="text-sm text-muted-foreground">Odsotni</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-orange-600">{excusedCount}</div>
                      <div className="text-sm text-muted-foreground">Javljeni</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            }
          </div>

          {selectedActivity && players.length > 0 &&
          <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5" />
                  Prisotnost igralcev ({players.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4 p-3 bg-muted rounded-lg text-sm">
                  <p><strong>Navodila:</strong></p>
                  <p>Vnesi številko (0 = Odsoten, 1 = Prisoten, 2 = Javljena odsotnost) in pritisni Enter za naslednjega igralca.</p>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Ime</TableHead>
                      <TableHead>Priimek</TableHead>
                      <TableHead className="w-32">Status</TableHead>
                      <TableHead className="w-24">Vnos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {players.map((player, index) =>
                  <TableRow key={player.id}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell className="font-medium">{player.first_name}</TableCell>
                        <TableCell>{player.last_name}</TableCell>
                        <TableCell>
                          {player.attendance_status === 1 && <Badge className="bg-green-600">Prisoten</Badge>}
                          {player.attendance_status === 0 && <Badge variant="destructive">Odsoten</Badge>}
                          {player.attendance_status === 2 && <Badge className="bg-orange-600">Javljena odsotnost</Badge>}
                          {player.attendance_status === null && <Badge variant="outline">Ni vnešeno</Badge>}
                        </TableCell>
                        <TableCell>
                          <Input
                        ref={(el) => {inputRefs.current[index] = el;}}
                        type="text"
                        inputMode="numeric"
                        className="w-16 text-center"
                        maxLength={1}
                        value={player.attendance_status !== null ? String(player.attendance_status) : ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "" || ["0", "1", "2"].includes(val)) {
                            const numVal = val === "" ? null : parseInt(val);
                            if (numVal !== null) {
                              handleAttendanceChange(player.id, numVal);
                            }
                          }
                        }}
                        onFocus={(e) => {
                          // Select text when input is focused for immediate replacement
                          e.target.select();
                        }}
                        onKeyDown={(e) => handleKeyDown(e, index, player.id)}
                        autoFocus={index === 0} />
                      
                        </TableCell>
                      </TableRow>
                  )}
                  </TableBody>
                </Table>

                <div className="flex gap-2 mt-6 justify-between items-center">
                  <div className="flex gap-2">
                    <Button
                    variant="outline"
                    onClick={() => {
                      players.forEach((player) => {
                        if (player.attendance_status !== 1) {
                          handleAttendanceChange(player.id, 1);
                        }
                      });
                      toast({
                        title: "Vsi igralci označeni kot prisotni"
                      });
                    }}
                    disabled={loading}>
                    
                      Vse označi kot prisotne
                    </Button>
                    <Button
                    variant="outline"
                    onClick={() => {
                      players.forEach((player) => {
                        handleAttendanceChange(player.id, 0);
                      });
                      setPlayers((prev) => prev.map((p) => ({ ...p, attendance_status: null })));
                      toast({
                        title: "Prisotnost počiščena"
                      });
                    }}
                    disabled={loading}>
                    
                      Počisti vse
                    </Button>
                  </div>

                  <Button
                  onClick={handleCompleteAttendance}
                  disabled={loading}
                  size="lg"
                  className="gap-2" style={{ backgroundColor: "#65a30d", backgroundImage: "none" }}>
                  
                    <Save className="h-5 w-5" />
                    Shrani in zaključi
                  </Button>
                </div>
              </CardContent>
            </Card>
          }
        </div>
      </AppLayout>
    </ProtectedRoute>);

}