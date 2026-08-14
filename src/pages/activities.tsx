import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Edit, Users } from "lucide-react";
import { useRouter } from "next/router";

interface Activity {
  id: string;
  activity_date: string;
  start_time: string;
  end_time: string;
  is_completed: boolean;
  activity_type_id: number;
  team: { name: string; short_name: string | null };
  venue: { name: string } | null;
}

export default function ActivitiesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [dateFilter, setDateFilter] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [venues, setVenues] = useState<any[]>([]);
  const [editForm, setEditForm] = useState({
    activity_date: "",
    start_time: "",
    end_time: "",
    venue_id: "",
  });

  useEffect(() => {
    loadActivities();
    loadVenues();
  }, [dateFilter]);

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
          is_completed,
          activity_type_id,
          team:teams(name, short_name),
          venue:venues(name)
        `)
        .order("activity_date", { ascending: false })
        .order("start_time", { ascending: true });

      if (dateFilter) {
        query = query.eq("activity_date", dateFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setActivities(data || []);
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

  function handleAttendance(activityId: string) {
    router.push(`/attendance?activity=${activityId}`);
  }

  function handleEditClick(activity: Activity) {
    setSelectedActivity(activity);
    setEditForm({
      activity_date: activity.activity_date,
      start_time: activity.start_time,
      end_time: activity.end_time,
      venue_id: activity.venue?.name ? "" : "", // We need venue_id, not name
    });
    
    // Load full activity details including venue_id
    supabase
      .from("activities")
      .select("venue_id")
      .eq("id", activity.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setEditForm(prev => ({ ...prev, venue_id: data.venue_id || "" }));
        }
      });
    
    setEditDialogOpen(true);
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

    try {
      setLoading(true);

      const { error } = await supabase
        .from("activities")
        .update({
          activity_date: editForm.activity_date,
          start_time: editForm.start_time,
          end_time: editForm.end_time,
          venue_id: editForm.venue_id || null,
        })
        .eq("id", selectedActivity.id);

      if (error) throw error;

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

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Aktivnosti</h2>
              <p className="text-muted-foreground">Pregled vseh aktivnosti</p>
            </div>
          </div>

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
                        <TableHead>Vrsta</TableHead>
                        <TableHead>Začetek</TableHead>
                        <TableHead>Konec</TableHead>
                        <TableHead>Dvorana</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Akcije</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activities.map((activity) => (
                        <TableRow key={activity.id}>
                          <TableCell className="font-medium">
                            {new Date(activity.activity_date).toLocaleDateString("sl-SI")}
                          </TableCell>
                          <TableCell>
                            {activity.team.short_name || activity.team.name}
                          </TableCell>
                          <TableCell>
                            {activity.activity_type_id === 1 ? "Trening" : activity.activity_type_id === 2 ? "Tekma" : "Drugo"}
                          </TableCell>
                          <TableCell>{activity.start_time}</TableCell>
                          <TableCell>{activity.end_time}</TableCell>
                          <TableCell>{activity.venue?.name || "N/A"}</TableCell>
                          <TableCell>
                            <Badge variant={activity.is_completed ? "default" : "secondary"}>
                              {activity.is_completed ? "Zaključeno" : "Osnutek"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAttendance(activity.id)}
                              >
                                <Users className="h-4 w-4 mr-1" />
                                Prisotnost
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditClick(activity)}
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                Uredi
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

          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent>
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
                      value={editForm.start_time}
                      onChange={(e) => setEditForm({ ...editForm, start_time: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit_end_time">Konec *</Label>
                    <Input
                      id="edit_end_time"
                      type="time"
                      value={editForm.end_time}
                      onChange={(e) => setEditForm({ ...editForm, end_time: e.target.value })}
                    />
                  </div>
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
              </div>

              <DialogFooter>
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
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}