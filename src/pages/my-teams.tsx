import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle } from
"@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { getActiveTeams } from "@/services/teamsService";
import { supabase } from "@/integrations/supabase/client";
import { Users, UserPlus, Trash2 } from "lucide-react";
import type React from "react";

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
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamPlayers, setTeamPlayers] = useState<TeamPlayer[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<any[]>([]);
  const [selectedPlayerToAdd, setSelectedPlayerToAdd] = useState("");
  const [playerToRemove, setPlayerToRemove] = useState<{teamPlayerId: string;playerName: string;} | null>(null);
  const [allPlayers, setAllPlayers] = useState<any[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [genderFilter, setGenderFilter] = useState<string>("all");

  // Filter players by search term and gender
  const filteredPlayers = allPlayers.filter((player) => {
    // Search filter
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
    player.first_name.toLowerCase().includes(searchLower) ||
    player.last_name.toLowerCase().includes(searchLower);

    if (!matchesSearch) return false;

    // Gender filter from dropdown
    if (genderFilter !== "all") {
      if (!player.gender || player.gender.toUpperCase() !== genderFilter.toUpperCase()) {
        return false;
      }
    }

    return true;
  });

  // Check if exactly one player matches search
  const exactMatch = filteredPlayers.length === 1 ? filteredPlayers[0] : null;

  useEffect(() => {
    loadTeams();
  }, []);

  async function loadTeams() {
    try {
      setLoading(true);

      // Fetch teams with player count
      const { data, error } = await supabase.
      from("teams").
      select(`
          *,
          seasons(name, is_active),
          team_players(count)
        `).
      eq("is_archived", false).
      order("name", { ascending: true });

      if (error) throw error;
      setTeams(data || []);
    } catch (error: any) {
      console.error("Napaka pri nalaganju selekcij:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Ni mogoče naložiti selekcij"
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadTeamPlayers(teamId: string) {
    try {
      const { data, error } = await supabase.
      from("team_players").
      select(`
          id,
          player_id,
          players(
            id,
            first_name,
            last_name,
            date_of_birth
          )
        `).
      eq("team_id", teamId).
      order("players(last_name)", { ascending: true });

      if (error) {
        console.error("Napaka pri nalaganju igralcev selekcije:", error);
        toast({
          variant: "destructive",
          title: "Napaka",
          description: error.message || "Ni mogoče naložiti igralcev selekcije"
        });
        throw error;
      }

      setTeamPlayers(data || []);
      setSelectedPlayers((data || []).map((tp: any) => tp.player_id));
    } catch (error: any) {
      console.error("Napaka pri nalaganju igralcev selekcije:", error);
    }
  }

  async function loadAllPlayers() {
    try {
      const { data, error } = await supabase.
      from("players").
      select(`
          id, 
          first_name, 
          last_name, 
          date_of_birth, 
          gender,
          teams:team_players(
            teams(id, name, short_name)
          )
        `).
      eq("is_active", true).
      order("last_name", { ascending: true });

      if (error) throw error;
      setAllPlayers(data || []);
    } catch (error: any) {
      console.error("Napaka pri nalaganju igralcev:", error);
    }
  }

  async function handleManagePlayersClick(team: Team) {
    setSelectedTeam(team);
    setSearchTerm(""); // Reset search when opening dialog
    setGenderFilter("all"); // Reset gender filter when opening dialog
    await loadAllPlayers();
    await loadTeamPlayers(team.id);
    setManagePlayersDialogOpen(true);
  }

  async function togglePlayer(playerId: string) {
    if (!selectedTeam) return;

    const isCurrentlySelected = selectedPlayers.includes(playerId);

    try {
      if (isCurrentlySelected) {
        // Remove player - delete from DB immediately
        const { error } = await supabase.
        from("team_players").
        delete().
        eq("team_id", selectedTeam.id).
        eq("player_id", playerId);

        if (error) throw error;

        // Update local state
        setSelectedPlayers((prev) => prev.filter((id) => id !== playerId));
        setTeamPlayers((prev) => prev.filter((tp) => tp.player_id !== playerId));

        toast({
          title: "Odstranjen",
          description: "Igralec odstranjen iz selekcije"
        });
      } else {
        // Add player - insert to DB immediately
        const { error } = await supabase.
        from("team_players").
        insert([{
          team_id: selectedTeam.id,
          player_id: playerId
        }]);

        if (error) throw error;

        // Update local state
        setSelectedPlayers((prev) => [...prev, playerId]);

        // Reload team players to get full data
        await loadTeamPlayers(selectedTeam.id);

        toast({
          title: "Dodan",
          description: "Igralec dodan v selekcijo"
        });
      }
    } catch (error: any) {
      console.error("Napaka pri upravljanju igralca:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Napaka pri shranjevanju"
      });
    }
  }

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && exactMatch) {
      e.preventDefault();
      togglePlayer(exactMatch.id);
      setSearchTerm(""); // Clear search after adding
    }
  }

  function handleAddPlayerClick() {
    setSelectedPlayerToAdd("");
    setAddPlayerDialogOpen(true);
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
              {loading && teams.length === 0 ?
              <p>Nalaganje...</p> :
              teams.length === 0 ?
              <p className="text-muted-foreground">Ni aktivnih selekcij.</p> :

              <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Naziv</TableHead>
                      <TableHead>Kratka oznaka</TableHead>
                      <TableHead>Starostna kategorija</TableHead>
                      <TableHead>Spol</TableHead>
                      <TableHead>Št. igralcev</TableHead>
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
                            <Badge variant="outline">
                              {(team as any).team_players?.[0]?.count || 0}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {team.seasons?.name || "-"}
                            {team.seasons?.is_active === false &&
                          <Badge variant="outline" className="ml-2">Arhivirana sezona</Badge>
                          }
                          </TableCell>
                          <TableCell>
                            {isActive ?
                          <Badge className="" style={{ backgroundColor: "#bababa", backgroundImage: "none" }}>Aktivna</Badge> :

                          <Badge variant="outline">Arhivirana</Badge>
                          }
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleManagePlayersClick(team)}
                            title="Upravljaj igralce" style={{ backgroundColor: "#06b6d4", backgroundImage: "none" }}>
                            
                              <Users className="h-4 w-4 mr-2" />
                              Igralci
                            </Button>
                          </TableCell>
                        </TableRow>);

                  })}
                  </TableBody>
                </Table>
              }
            </CardContent>
          </Card>

          {/* Manage Players Dialog */}
          <Dialog open={managePlayersDialogOpen} onOpenChange={setManagePlayersDialogOpen}>
            <DialogContent className="max-w-4xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  Upravljanje igralcev - {selectedTeam?.name}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="gender_filter">Filter po spolu</Label>
                  <Select value={genderFilter} onValueChange={setGenderFilter}>
                    <SelectTrigger id="gender_filter">
                      <SelectValue placeholder="Vsi igralci" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Vsi igralci</SelectItem>
                      <SelectItem value="M">Samo moški (M)</SelectItem>
                      <SelectItem value="F">Samo ženske (F)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="player_search">Iskanje igralca</Label>
                  <Input
                    id="player_search"
                    placeholder="Ime ali priimek..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={handleSearchKeyDown} />
                  
                </div>

                <div className="space-y-2">
                  <Label>Igralci ({filteredPlayers.length})</Label>
                  <div className="border rounded-lg">
                    <ScrollArea className="h-[300px] sm:h-[400px]">
                      <Table>
                        <TableHeader>
                          <TableRow className="text-xs">
                            <TableHead className="w-[50px]"></TableHead>
                            <TableHead>Ime</TableHead>
                            <TableHead>Priimek</TableHead>
                            <TableHead>Datum rojstva</TableHead>
                            <TableHead>Druge selekcije</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredPlayers.map((player) => {
                            const isSelected = selectedPlayers.includes(player.id);
                            const otherTeams = player.teams?.
                            filter((tp: any) => tp.teams.id !== selectedTeam?.id).
                            map((tp: any) => tp.teams) || [];

                            return (
                              <TableRow key={player.id} className="text-sm">
                                <TableCell className="py-2">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => togglePlayer(player.id)}
                                    className="h-4 w-4" />
                                  
                                </TableCell>
                                <TableCell className="font-medium py-2">
                                  {player.first_name}
                                </TableCell>
                                <TableCell className="py-2">{player.last_name}</TableCell>
                                <TableCell className="py-2">
                                  {player.date_of_birth ?
                                  new Date(player.date_of_birth).toLocaleDateString("sl-SI") :
                                  "N/A"}
                                </TableCell>
                                <TableCell className="py-2">
                                  <div className="flex flex-wrap gap-1">
                                    {otherTeams.length > 0 ?
                                    otherTeams.map((team: any, idx: number) =>
                                    <Badge key={idx} variant="outline" className="text-xs">
                                          {team.short_name || team.name}
                                        </Badge>
                                    ) :

                                    <span className="text-xs text-muted-foreground">-</span>
                                    }
                                  </div>
                                </TableCell>
                              </TableRow>);

                          })}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </div>
                </div>
              </div>

              <DialogFooter className="mt-6 sticky bottom-0 bg-background pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setManagePlayersDialogOpen(false)}
                  disabled={loading}>
                  
                  Zapri
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </AppLayout>
    </ProtectedRoute>);

}