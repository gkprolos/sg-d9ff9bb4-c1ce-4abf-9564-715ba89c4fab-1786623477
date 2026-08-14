import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Search } from "lucide-react";

interface PlayerWithTeams {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  is_active: boolean;
  teams: string[];
}

export default function MyPlayersPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [players, setPlayers] = useState<PlayerWithTeams[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadPlayers();
  }, []);

  async function loadPlayers() {
    try {
      setLoading(true);

      // Get all active players with their team memberships
      const { data: playersData, error: playersError } = await supabase
        .from("players")
        .select(`
          id,
          first_name,
          last_name,
          date_of_birth,
          is_active
        `)
        .eq("is_active", true)
        .order("last_name", { ascending: true })
        .order("first_name", { ascending: true });

      if (playersError) {
        console.error("Napaka pri nalaganju igralcev:", playersError);
        toast({
          variant: "destructive",
          title: "Napaka",
          description: playersError.message || "Ni mogoče naložiti igralcev",
        });
        throw playersError;
      }

      // Get team memberships for all players
      const { data: membershipsData, error: membershipsError } = await supabase
        .from("team_players")
        .select(`
          player_id,
          teams(name)
        `)
        .eq("membership_status", "active");

      if (membershipsError) {
        console.error("Napaka pri nalaganju članstev:", membershipsError);
        toast({
          variant: "destructive",
          title: "Napaka",
          description: membershipsError.message || "Ni mogoče naložiti članstev",
        });
        throw membershipsError;
      }

      // Map teams to players
      const playersWithTeams: PlayerWithTeams[] = (playersData || []).map(player => {
        const playerMemberships = (membershipsData || [])
          .filter((m: any) => m.player_id === player.id)
          .map((m: any) => m.teams?.name)
          .filter(Boolean);

        return {
          ...player,
          teams: playerMemberships,
        };
      });

      setPlayers(playersWithTeams);
    } catch (error: any) {
      console.error("Napaka pri nalaganju igralcev:", error);
    } finally {
      setLoading(false);
    }
  }

  const filteredPlayers = players.filter(player => {
    const searchLower = searchTerm.toLowerCase();
    return (
      player.first_name.toLowerCase().includes(searchLower) ||
      player.last_name.toLowerCase().includes(searchLower) ||
      player.teams.some(team => team.toLowerCase().includes(searchLower))
    );
  });

  return (
    <ProtectedRoute allowedRoles={["coach"]}>
      <AppLayout>
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Igralci</h2>
            <p className="text-muted-foreground">Pregled vseh aktivnih igralcev</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Seznam igralcev ({filteredPlayers.length})</CardTitle>
              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Išči po imenu, priimku ali selekciji..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p>Nalaganje...</p>
              ) : filteredPlayers.length === 0 ? (
                <p className="text-muted-foreground">
                  {searchTerm ? "Ni rezultatov iskanja." : "Ni aktivnih igralcev."}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ime</TableHead>
                      <TableHead>Priimek</TableHead>
                      <TableHead>Datum rojstva</TableHead>
                      <TableHead>Selekcije</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPlayers.map((player) => (
                      <TableRow key={player.id}>
                        <TableCell className="font-medium">{player.first_name}</TableCell>
                        <TableCell>{player.last_name}</TableCell>
                        <TableCell>
                          {player.date_of_birth 
                            ? new Date(player.date_of_birth).toLocaleDateString('sl-SI')
                            : "-"
                          }
                        </TableCell>
                        <TableCell>
                          {player.teams.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {player.teams.map((team, idx) => (
                                <Badge key={idx} variant="outline">{team}</Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Brez selekcije</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {player.is_active ? (
                            <Badge className="bg-green-600">Aktiven</Badge>
                          ) : (
                            <Badge variant="outline">Neaktiven</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}