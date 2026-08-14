import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ClipboardCheck, Plus, Save } from "lucide-react";

interface Activity {
  id: string;
  activity_date: string;
  team: { name: string };
  venue: { name: string } | null;
  start_time: string;
  end_time: string;
}

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  attendance_status?: number | null;
}

export default function AttendancePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<string>("");
  const [teams, setTeams] = useState<any[]>([]);
  const [venues, setVenues] = useState<any[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [showNewActivity, setShowNewActivity] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  const [newActivityForm, setNewActivityForm] = useState({
    team_id: "",
    venue_id: "",
    start_time: "",
    end_time: "",
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
      console.error("Napaka pri nalaganju selekcij:", error);
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

  async function loadActivitiesForDate() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("activities")
        .select(`
          id,
          activity_date,
          start_time,
          end_time,
          team:teams(name),
          venue:venues(name)
        `)
        .eq("activity_date", selectedDate)
        .order("start_time", { ascending: true });

      if (error) throw error;
      setActivities(data || []);
      
      if (data && data.length === 1) {
        setSelectedActivity(data[0].id);
      }
    } catch (error: any) {
      console.error("Napaka pri nalaganju aktivnosti:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Ni mogoče naložiti aktivnosti",
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadPlayersForActivity() {
    try {
      setLoading(true);
      
      // Get team_id from selected activity
      const activity = activities.find(a => a.id === selectedActivity);
      if (!activity) return;

      // Get activity details to find team_id
      const { data: activityData, error: actError } = await supabase
        .from("activities")
        .select("team_id")
        .eq("id", selectedActivity)
        .single();

      if (actError) throw actError;

      // Get players for this team
      const { data: teamPlayers, error: playersError } = await supabase
        .from("team_players")
        .select(`
          player_id,
          players(id, first_name, last_name)
        `)
        .eq("team_id", activityData.team_id);

      if (playersError) throw playersError;

      // Get existing attendance records
      const { data: attendanceData, error: attendanceError } = await supabase
        .from("attendance_records")
        .select("player_id, status")
        .eq("activity_id", selectedActivity);

      if (attendanceError) throw attendanceError;

      // Map attendance to players
      const attendanceMap = new Map(
        (attendanceData || []).map(a => [a.player_id, a.status])
      );

      const playersList = (teamPlayers || []).map((tp: any) => ({
        id: tp.players.id,
        first_name: tp.players.first_name,
        last_name: tp.players.last_name,
        attendance_status: attendanceMap.get(tp.players.id) ?? null,
      }));

      setPlayers(playersList);
    } catch (error: any) {
      console.error("Napaka pri nalaganju igralcev:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Ni mogoče naložiti igralcev",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateActivity() {
    if (!newActivityForm.team_id || !newActivityForm.start_time || !newActivityForm.end_time) {
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Selekcija, začetek in konec so obvezni",
      });
      return;
    }

    try {
      setLoading(true);

      // Check if activity already exists for this team and date
      const { data: existing, error: checkError } = await supabase
        .from("activities")
        .select("id")
        .eq("team_id", newActivityForm.team_id)
        .eq("activity_date", selectedDate)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existing) {
        toast({
          variant: "destructive",
          title: "Aktivnost že obstaja",
          description: "Za to selekcijo in datum že obstaja aktivnost",
        });
        setSelectedActivity(existing.id);
        setShowNewActivity(false);
        await loadActivitiesForDate();
        return;
      }

      const { data, error } = await supabase
        .from("activities")
        .insert([{
          team_id: newActivityForm.team_id,
          activity_date: selectedDate,
          venue_id: newActivityForm.venue_id || null,
          start_time: newActivityForm.start_time,
          end_time: newActivityForm.end_time,
          activity_type_id: 1, // Default to training
          status: "draft",
        }])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Uspešno",
        description: "Aktivnost ustvarjena",
      });

      setSelectedActivity(data.id);
      setShowNewActivity(false);
      await loadActivitiesForDate();
    } catch (error: any) {
      console.error("Napaka pri ustvarjanju aktivnosti:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Napaka pri ustvarjanju aktivnosti",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleAttendanceChange(playerId: string, status: number) {
    if (![0, 1, 2].includes(status)) return;

    try {
      // Upsert attendance record
      const { error } = await supabase
        .from("attendance_records")
        .upsert({
          activity_id: selectedActivity,
          player_id: playerId,
          status: status,
          recorded_by: user?.id,
        }, {
          onConflict: "activity_id,player_id"
        });

      if (error) throw error;

      // Update local state
      setPlayers(prev => prev.map(p => 
        p.id === playerId ? { ...p, attendance_status: status } : p
      ));
    } catch (error: any) {
      console.error("Napaka pri shranjevanju prisotnosti:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Napaka pri shranjevanju prisotnosti",
      });
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, index: number, playerId: string) {
    const value = e.key;
    
    if (value === "Enter") {
      e.preventDefault();
      const input = e.currentTarget;
      const numValue = parseInt(input.value);
      
      if ([0, 1, 2].includes(numValue)) {
        handleAttendanceChange(playerId, numValue);
      }
      
      // Move to next player
      if (index < players.length - 1) {
        inputRefs.current[index + 1]?.focus();
        inputRefs.current[index + 1]?.select();
      }
    } else if (!["0", "1", "2", "Tab", "Shift", "Backspace", "Delete", "ArrowUp", "ArrowDown"].includes(value)) {
      e.preventDefault();
    }
  }

  const presentCount = players.filter(p => p.attendance_status === 1).length;
  const absentCount = players.filter(p => p.attendance_status === 0).length;
  const excusedCount = players.filter(p => p.attendance_status === 2).length;

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Vnos prisotnosti</h2>
              <p className="text-muted-foreground">Evidentiranje prisotnosti igralcev</p>
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
                    }}
                  />
                </div>

                {activities.length > 0 ? (
                  <div className="space-y-2">
                    <Label>Obstoječe aktivnosti na ta dan</Label>
                    <div className="space-y-2">
                      {activities.map((activity) => (
                        <div
                          key={activity.id}
                          className={`p-3 border rounded-lg cursor-pointer hover:bg-muted/50 ${
                            selectedActivity === activity.id ? "bg-primary/10 border-primary" : ""
                          }`}
                          onClick={() => {
                            setSelectedActivity(activity.id);
                            setShowNewActivity(false);
                          }}
                        >
                          <p className="font-medium">{activity.team.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {activity.start_time} - {activity.end_time}
                            {activity.venue && ` • ${activity.venue.name}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Ni aktivnosti na ta dan</p>
                )}

                {!showNewActivity ? (
                  <Button onClick={() => setShowNewActivity(true)} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Nova aktivnost
                  </Button>
                ) : (
                  <div className="space-y-4 p-4 border rounded-lg">
                    <div className="space-y-2">
                      <Label htmlFor="team">Selekcija *</Label>
                      <Select
                        value={newActivityForm.team_id}
                        onValueChange={(value) => setNewActivityForm({ ...newActivityForm, team_id: value })}
                      >
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

                    <div className="space-y-2">
                      <Label htmlFor="venue">Dvorana</Label>
                      <Select
                        value={newActivityForm.venue_id}
                        onValueChange={(value) => setNewActivityForm({ ...newActivityForm, venue_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Izberi dvorano" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Ni izbrana</SelectItem>
                          {venues.map((venue) => (
                            <SelectItem key={venue.id} value={venue.id}>
                              {venue.name}
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
                          value={newActivityForm.start_time}
                          onChange={(e) => setNewActivityForm({ ...newActivityForm, start_time: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="end_time">Konec *</Label>
                        <Input
                          id="end_time"
                          type="time"
                          value={newActivityForm.end_time}
                          onChange={(e) => setNewActivityForm({ ...newActivityForm, end_time: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={handleCreateActivity} disabled={loading} className="flex-1">
                        Ustvari
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowNewActivity(false);
                          setNewActivityForm({ team_id: "", venue_id: "", start_time: "", end_time: "" });
                        }}
                      >
                        Prekliči
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {selectedActivity && players.length > 0 && (
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
            )}
          </div>

          {selectedActivity && players.length > 0 && (
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
                    {players.map((player, index) => (
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
                            ref={el => inputRefs.current[index] = el}
                            type="text"
                            inputMode="numeric"
                            className="w-16 text-center"
                            maxLength={1}
                            defaultValue={player.attendance_status ?? ""}
                            onKeyDown={(e) => handleKeyDown(e, index, player.id)}
                            autoFocus={index === 0}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}