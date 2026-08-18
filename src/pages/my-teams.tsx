import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { getActiveTeams } from "@/services/teamsService";
import { supabase } from "@/integrations/supabase/client";
import { Users, UserPlus, Trash2 } from "lucide-react";

interface Team {
  id: string;
  name: string;
  short_name: string | null;
  age_category: string | null;
  gender: string | null;
  is_archived: boolean;
  seasons?: {
    name: string;
    is_active: boolean;
  };
}

interface TeamPlayer {
  id: string;
  player_id: string;
  players: {
    id: string;
    first_name: string;
    last_name: string;
    date_of_birth: string | null;
  };
}

export default function MyTeamsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [managePlayersDialogOpen, setManagePlayersDialogOpen] = useState(false);
  const [addPlayerDialogOpen, setAddPlayerDialogOpen] = useState(false);
  const [removePlayerDialogOpen, setRemovePlayerDialogOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamPlayers, setTeamPlayers] = useState<TeamPlayer[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<any[]>([]);
  const [selectedPlayerToAdd, setSelectedPlayerToAdd] = useState("");
  const [playerToRemove, setPlayerToRemove] = useState<{ teamPlayerId: string; playerName: string } | null>(null);

  useEffect(() => {
    loadTeams();
  }, []);

  async function loadTeams() {
    try {
      setLoading(true);
      const data = await getActiveTeams();
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

  async function loadTeamPlayers(teamId: string) {
    try {
      const { data, error } = await supabase
        .from("team_players")
        .select(`
          id,
          player_id,
          players(
            id,
            first_name,
            last_name,
            date_of_birth
          )
        `)
        .eq("team_id", teamId)
        .order("players(last_name)", { ascending: true });

      if (error) {
        console.error("Napaka pri nalaganju igralcev selekcije:", error);
        toast({
          variant: "destructive",
          title: "Napaka",
          description: error.message || "Ni mogoče naložiti igralcev selekcije",
        });
        throw error;
      }

      setTeamPlayers(data || []);
    } catch (error: any) {
      console.error("Napaka pri nalaganju igralcev selekcije:", error);
    }
  }

  async function loadAvailablePlayers(teamId: string) {
    try {
      // Get all active players
      const { data: allPlayers, error: playersError } = await supabase
        .from("players")
        .select("id, first_name, last_name")
        .eq("is_active", true)
        .order("last_name", { ascending: true })
        .order("first_name", { ascending: true });

      if (playersError) throw playersError;

      // Get players already in this team
      const { data: teamPlayerIds, error: teamError } = await supabase
        .from("team_players")
        .select("player_id")
        .eq("team_id", teamId);

      if (teamError) throw teamError;

      const assignedPlayerIds = new Set((teamPlayerIds || []).map(tp => tp.player_id));
      
      // Filter out players already in team
      const available = (allPlayers || []).filter(p => !assignedPlayerIds.has(p.id));
      setAvailablePlayers(available);
    } catch (error: any) {
      console.error("Napaka pri nalaganju razpoložljivih igralcev:", error);
    }
  }

  async function handleManagePlayersClick(team: Team) {
    setSelectedTeam(team);
    await loadTeamPlayers(team.id);
    await loadAvailablePlayers(team.id);
    setManagePlayersDialogOpen(true);
  }

  function handleAddPlayerClick() {
    setSelectedPlayerToAdd("");
    setAddPlayerDialogOpen(true);
  }

  async function handleConfirmAddPlayer() {
    if (!selectedTeam || !selectedPlayerToAdd) {
      toast({
        variant: "destructive",
        title: "Manjkajo podatki",
        description: "Izberi igralca",
      });
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase
        .from("team_players")
        .insert({
          team_id: selectedTeam.id,
          player_id: selectedPlayerToAdd,
        });

      if (error) {
        console.error("Napaka pri dodajanju igralca v selekcijo:", error);
        toast({
          variant: "destructive",
          title: "Napaka",
          description: error.message || "Napaka pri dodajanju igralca v selekcijo",
        });
        throw error;
      }

      const playerName = availablePlayers.find(p => p.id === selectedPlayerToAdd);
      toast({
        title: "Uspešno",
        description: `Igralec ${playerName?.first_name} ${playerName?.last_name} uspešno dodan v ${selectedTeam.name}`,
      });

      setAddPlayerDialogOpen(false);
      await loadTeamPlayers(selectedTeam.id);
      await loadAvailablePlayers(selectedTeam.id);
    } catch (error: any) {
      console.error("Napaka pri dodajanju igralca v selekcijo:", error);
    } finally {
      setLoading(false);
    }
  }

  function handleRemovePlayerClick(teamPlayerId: string, playerName: string) {
    setPlayerToRemove({ teamPlayerId, playerName });
    setRemovePlayerDialogOpen(true);
  }

  async function handleConfirmRemovePlayer() {
    if (!playerToRemove || !selectedTeam) return;

    try {
      setLoading(true);

      const { error } = await supabase
        .from("team_players")
        .delete()
        .eq("id", playerToRemove.teamPlayerId);

      if (error) {
        console.error("Napaka pri odstranjevanju igralca iz selekcije:", error);
        toast({
          variant: "destructive",
          title: "Napaka",
          description: error.message || "Napaka pri odstranjevanju igralca iz selekcije",
        });
        throw error;
      }

      toast({
        title: "Uspešno",
        description: `Igralec ${playerToRemove.playerName} uspešno odstranjen iz ${selectedTeam.name}`,
      });

      setRemovePlayerDialogOpen(false);
      setPlayerToRemove(null);
      await loadTeamPlayers(selectedTeam.id);
      await loadAvailablePlayers(selectedTeam.id);
    } catch (error: any) {
      console.error("Napaka pri odstranjevanju igralca iz selekcije:", error);
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
            <p className="text-muted-foreground">Pregled vseh aktivnih selekcij in upravljanje igralcev</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Seznam selekcij ({teams.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {loading && teams.length === 0 ? (
                <p>Nalaganje...</p>
              ) : teams.length === 0 ? (
                <p className="text-muted-foreground">Ni aktivnih selekcij.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Naziv</TableHead>
                      <TableHead>Kratka oznaka</TableHead>
                      <TableHead>Starostna kategorija</TableHead>
                      <TableHead>Spol</TableHead>
                      <TableHead>Sezona</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Akcije</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teams.map((team) => {
                      const isActive = !team.is_archived;
                      return (
                        <TableRow key={team.id}>
                          <TableCell className="font-medium">{team.name}</TableCell>
                          <TableCell>{team.short_name || "-"}</TableCell>
                          <TableCell>{team.age_category || "-"}</TableCell>
                          <TableCell>{team.gender || "-"}</TableCell>
                          <TableCell>
                            {team.seasons?.name || "-"}
                            {team.seasons?.is_active === false && (
                              <Badge variant="outline" className="ml-2">Arhivirana sezona</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {isActive ? (
                              <Badge className="bg-green-600">Aktivna</Badge>
                            ) : (
                              <Badge variant="outline">Arhivirana</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleManagePlayersClick(team)}
                              title="Upravljaj igralce"
                            >
                              <Users className="h-4 w-4 mr-2" />
                              Igralci
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Manage Players Dialog */}
          <Dialog open={managePlayersDialogOpen} onOpenChange={setManagePlayersDialogOpen}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Upravljanje igralcev - {selectedTeam?.name}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6 py-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">
                    Igralci v selekciji ({teamPlayers.length})
                  </h3>
                  <Button onClick={handleAddPlayerClick} size="sm">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Dodaj igralca
                  </Button>
                </div>

                {teamPlayers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>V selekciji še ni igralcev</p>
                    <p className="text-sm mt-2">Dodajte prvega igralca</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ime</TableHead>
                        <TableHead>Priimek</TableHead>
                        <TableHead>Datum rojstva</TableHead>
                        <TableHead className="text-right">Akcije</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teamPlayers.map((tp) => (
                        <TableRow key={tp.id}>
                          <TableCell className="font-medium">{tp.players.first_name}</TableCell>
                          <TableCell>{tp.players.last_name}</TableCell>
                          <TableCell>
                            {tp.players.date_of_birth
                              ? new Date(tp.players.date_of_birth).toLocaleDateString("sl-SI")
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() =>
                                handleRemovePlayerClick(
                                  tp.id,
                                  `${tp.players.first_name} ${tp.players.last_name}`
                                )
                              }
                              title="Odstrani iz selekcije"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setManagePlayersDialogOpen(false)}
                >
                  Zapri
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Add Player to Team Dialog */}
          <Dialog open={addPlayerDialogOpen} onOpenChange={setAddPlayerDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Dodaj igralca v {selectedTeam?.name}</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {availablePlayers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Vsi igralci so že v tej selekciji ali ni razpoložljivih igralcev.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="player_select">Izberi igralca *</Label>
                    <Select value={selectedPlayerToAdd} onValueChange={setSelectedPlayerToAdd}>
                      <SelectTrigger id="player_select">
                        <SelectValue placeholder="Izberi igralca" />
                      </SelectTrigger>
                      <SelectContent>
                        {availablePlayers.map((player) => (
                          <SelectItem key={player.id} value={player.id}>
                            {player.first_name} {player.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddPlayerDialogOpen(false)}
                  disabled={loading}
                >
                  Prekliči
                </Button>
                <Button
                  onClick={handleConfirmAddPlayer}
                  disabled={loading || availablePlayers.length === 0}
                >
                  {loading ? "Dodajam..." : "Dodaj"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Remove Player Confirmation Dialog */}
          <AlertDialog open={removePlayerDialogOpen} onOpenChange={setRemovePlayerDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Potrditev odstranitve</AlertDialogTitle>
                <AlertDialogDescription>
                  Nameravaš odstraniti igralca <strong>{playerToRemove?.playerName}</strong> iz
                  selekcije <strong>{selectedTeam?.name}</strong>. Odstranim?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Prekliči</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleConfirmRemovePlayer}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Odstrani
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}