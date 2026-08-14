import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
  team: { name: string; short_name: string | null };
  venue: { name: string } | null;
  activity_type: { name: string };
}

export default function ActivitiesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [dateFilter, setDateFilter] = useState("");

  useEffect(() => {
    loadActivities();
  }, [dateFilter]);

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
          team:teams(name, short_name),
          venue:venues(name),
          activity_type:activity_types(name)
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

  function handleEditActivity(activityId: string) {
    router.push(`/attendance?activity=${activityId}`);
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
                          <TableCell>{activity.activity_type.name}</TableCell>
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
                                onClick={() => handleEditActivity(activity.id)}
                              >
                                <Users className="h-4 w-4 mr-1" />
                                Prisotnost
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditActivity(activity.id)}
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
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}