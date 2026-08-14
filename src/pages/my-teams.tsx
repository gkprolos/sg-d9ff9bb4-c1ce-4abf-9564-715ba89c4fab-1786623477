import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { getTeamsByCoach } from "@/services/teamsService";
import { Users } from "lucide-react";

export default function MyTeamsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState<any[]>([]);

  useEffect(() => {
    loadTeams();
  }, [user]);

  async function loadTeams() {
    if (!user) return;

    try {
      setLoading(true);
      const data = await getTeamsByCoach(user.id);
      setTeams(data);
    } catch (error: any) {
      console.error("Napaka pri nalaganju selekcij:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Ni mogoče naložiti selekcij",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <ProtectedRoute allowedRoles={["coach"]}>
      <AppLayout>
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Moje selekcije</h2>
            <p className="text-muted-foreground">
              Pregled selekcij, ki so vam dodeljene
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Seznam selekcij ({teams.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Nalagam...</div>
              ) : teams.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Ni dodeljenih selekcij</p>
                  <p className="text-sm mt-2">
                    Kontaktirajte administratorja za dodelitev selekcij
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Naziv</TableHead>
                        <TableHead>Starostna kategorija</TableHead>
                        <TableHead>Spol</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teams.map((team) => (
                        <TableRow key={team.id}>
                          <TableCell className="font-medium">{team.name}</TableCell>
                          <TableCell>{team.age_category || "N/A"}</TableCell>
                          <TableCell>{team.gender || "N/A"}</TableCell>
                          <TableCell>
                            <Badge variant={team.is_active ? "default" : "secondary"}>
                              {team.is_active ? "Aktivna" : "Neaktivna"}
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