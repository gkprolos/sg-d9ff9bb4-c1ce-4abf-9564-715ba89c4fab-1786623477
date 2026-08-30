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
import { UserCog, Plus, Edit, Trash2, Users } from "lucide-react";

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  guardian1_name: string | null;
  guardian1_phone: string | null;
  guardian1_email: string | null;
  guardian2_name: string | null;
  guardian2_phone: string | null;
  guardian2_email: string | null;
  is_active: boolean;
  team_players: Array<{
    id: string;
    team_id: string;
    teams: {
      id: string;
      name: string;
    };
  }>;
}

export default function MyPlayersPage() {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [availableTeams, setAvailableTeams] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [playerForm, setPlayerForm] = useState({
    first_name: "",
    last_name: "",
    date_of_birth: "",
    phone: "",
    address: "",
    city: "",
    postal_code: "",
    guardian1_name: "",
    guardian1_phone: "",
    guardian1_email: "",
    guardian2_name: "",
    guardian2_phone: "",
    guardian2_email: "",
    gender: "male" as "male" | "female",
  });
  const [selectedTeamForAdd, setSelectedTeamForAdd] = useState("");
  const [teamPlayerToRemove, setTeamPlayerToRemove] = useState<{ playerId: string; teamPlayerId: string; teamName: string } | null>(null);
  
  // Check if user is a parent (via localStorage)
  const [isParent, setIsParent] = useState(false);
  const [parentEmail, setParentEmail] = useState("");

  useEffect(() => {
    const parentSession = localStorage.getItem("parentSession");
    if (parentSession) {
      try {
        const session = JSON.parse(parentSession);
        setIsParent(true);
        setParentEmail(session.email);
      } catch (error) {
        console.error("Invalid parent session:", error);
      }
    }
  }, []);

  useEffect(() => {
    loadPlayers();
    loadTeams();
  }, [isParent, parentEmail]);

  async function loadPlayers() {
    try {
      setLoading(true);

      // Parent view: load their children
      if (isParent && parentEmail) {
        const { data, error } = await supabase
          .from("players")
          .select(`
            id,
            first_name,
            last_name,
            date_of_birth,
            phone,
            address,
            city,
            postal_code,
            guardian1_name,
            guardian1_phone,
            guardian1_email,
            guardian2_name,
            guardian2_phone,
            guardian2_email,
            gender,
            is_active,
            team_players(
              id,
              team_id,
              teams(
                id,
                name
              )
            )
          `)
          .or(`guardian1_email.eq.${parentEmail},guardian2_email.eq.${parentEmail}`)
          .eq("is_active", true)
          .order("last_name", { ascending: true })
          .order("first_name", { ascending: true });

        if (error) {
          console.error("Napaka pri nalaganju otrok:", error);
          toast({
            variant: "destructive",
            title: "Napaka",
            description: error.message || "Ni mogoče naložiti podatkov o otrocih",
          });
          throw error;
        }

        setPlayers(data || []);
        setLoading(false);
        return;
      }

      // Coach view: load their team's players
      let playerIds: string[] = [];
      if (user?.id && userRole === "coach") {
        const { data: coachTeams } = await supabase
          .from("team_coaches")
          .select("team_id")
          .eq("coach_id", user.id)
          .eq("is_active", true);

        const teamIds = (coachTeams || []).map(ct => ct.team_id);
        
        if (teamIds.length > 0) {
          const { data: teamPlayers } = await supabase
            .from("team_players")
            .select("player_id")
            .in("team_id", teamIds);

          playerIds = (teamPlayers || []).map(tp => tp.player_id);
        }

        if (playerIds.length === 0) {
          setPlayers([]);
          setLoading(false);
          return;
        }
      }

      let playersQuery = supabase
        .from("players")
        .select(`
          id,
          first_name,
          last_name,
          date_of_birth,
          phone,
          address,
          city,
          postal_code,
          guardian1_name,
          guardian1_phone,
          guardian1_email,
          guardian2_name,
          guardian2_phone,
          guardian2_email,
          gender,
          is_active,
          team_players(
            id,
            team_id,
            teams(
              id,
              name
            )
          )
        `)
        .eq("is_active", true)
        .order("last_name", { ascending: true })
        .order("first_name", { ascending: true });

      // Filter by coach's players
      if (userRole === "coach" && playerIds.length > 0) {
        playersQuery = playersQuery.in("id", playerIds);
      }

      const { data, error } = await playersQuery;

      if (error) {
        console.error("Napaka pri nalaganju igralcev:", error);
        toast({
          variant: "destructive",
          title: "Napaka",
          description: error.message || "Ni mogoče naložiti igralcev",
        });
        throw error;
      }

      setPlayers(data || []);
    } catch (error: any) {
      console.error("Napaka pri nalaganju igralcev:", error);
    } finally {
      setLoading(false);
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
      console.error("Napaka pri nalaganju selekcij:", error);
    }
  }

  async function loadTeamsForPlayer() {
    try {
      let teamsQuery = supabase
        .from("teams")
        .select("id, name")
        .eq("is_archived", false)
        .order("name", { ascending: true });

      // For coaches, filter by their assigned teams
      if (userRole === "coach" && user?.id) {
        const { data: coachTeams } = await supabase
          .from("team_coaches")
          .select("team_id")
          .eq("coach_id", user.id)
          .eq("is_active", true);

        const teamIds = (coachTeams || []).map(ct => ct.team_id);
        
        if (teamIds.length > 0) {
          teamsQuery = teamsQuery.in("id", teamIds);
        } else {
          setAvailableTeams([]);
          return;
        }
      }

      const { data, error } = await teamsQuery;

      if (error) throw error;

      setAvailableTeams(data || []);
    } catch (error: any) {
      console.error("Error loading teams:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Ni mogoče naložiti selekcij",
      });
    }
  }

  function resetForm() {
    setPlayerForm({
      first_name: "",
      last_name: "",
      date_of_birth: "",
      phone: "",
      address: "",
      city: "",
      postal_code: "",
      guardian1_name: "",
      guardian1_phone: "",
      guardian1_email: "",
      guardian2_name: "",
      guardian2_phone: "",
      guardian2_email: "",
      gender: "",
    });
  }

  function handleAddClick() {
    resetForm();
    setAddDialogOpen(true);
  }

  async function handleAddPlayer() {
    if (!playerForm.first_name || !playerForm.last_name) {
      toast({
        variant: "destructive",
        title: "Manjkajo podatki",
        description: "Ime in priimek sta obvezna",
      });
      return;
    }

    if (!playerForm.gender) {
      toast({
        variant: "destructive",
        title: "Manjkajo podatki",
        description: "Spol je obvezen",
      });
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase
        .from("players")
        .insert({
          first_name: playerForm.first_name.trim(),
          last_name: playerForm.last_name.trim(),
          date_of_birth: playerForm.date_of_birth || null,
          phone: playerForm.phone || null,
          address: playerForm.address || null,
          city: playerForm.city || null,
          postal_code: playerForm.postal_code || null,
          guardian1_name: playerForm.guardian1_name || null,
          guardian1_phone: playerForm.guardian1_phone || null,
          guardian1_email: playerForm.guardian1_email || null,
          guardian2_name: playerForm.guardian2_name || null,
          guardian2_phone: playerForm.guardian2_phone || null,
          guardian2_email: playerForm.guardian2_email || null,
          gender: playerForm.gender,
          is_active: true,
        });

      if (error) {
        console.error("Napaka pri dodajanju igralca:", error);
        toast({
          variant: "destructive",
          title: "Napaka",
          description: error.message || "Napaka pri dodajanju igralca",
        });
        throw error;
      }

      toast({
        title: "Uspešno",
        description: `Igralec ${playerForm.first_name} ${playerForm.last_name} uspešno dodan`,
      });

      setAddDialogOpen(false);
      loadPlayers();
    } catch (error: any) {
      console.error("Napaka pri dodajanju igralca:", error);
    } finally {
      setLoading(false);
    }
  }

  function handleEditClick(player: Player) {
    setSelectedPlayer(player);
    setPlayerForm({
      first_name: player.first_name,
      last_name: player.last_name,
      date_of_birth: player.date_of_birth || "",
      phone: player.phone || "",
      address: player.address || "",
      city: player.city || "",
      postal_code: player.postal_code || "",
      guardian1_name: player.guardian1_name || "",
      guardian1_phone: player.guardian1_phone || "",
      guardian1_email: player.guardian1_email || "",
      guardian2_name: player.guardian2_name || "",
      guardian2_phone: player.guardian2_phone || "",
      guardian2_email: player.guardian2_email || "",
      gender: (player as any).gender,
    });
    setEditDialogOpen(true);
  }

  async function handleUpdatePlayer() {
    if (!selectedPlayer) return;

    if (!playerForm.first_name || !playerForm.last_name) {
      toast({
        variant: "destructive",
        title: "Manjkajo podatki",
        description: "Ime in priimek sta obvezna",
      });
      return;
    }

    if (!playerForm.gender) {
      toast({
        variant: "destructive",
        title: "Manjkajo podatki",
        description: "Spol je obvezen",
      });
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase
        .from("players")
        .update({
          first_name: playerForm.first_name.trim(),
          last_name: playerForm.last_name.trim(),
          date_of_birth: playerForm.date_of_birth || null,
          phone: playerForm.phone || null,
          address: playerForm.address || null,
          city: playerForm.city || null,
          postal_code: playerForm.postal_code || null,
          guardian1_name: playerForm.guardian1_name || null,
          guardian1_phone: playerForm.guardian1_phone || null,
          guardian1_email: playerForm.guardian1_email || null,
          guardian2_name: playerForm.guardian2_name || null,
          guardian2_phone: playerForm.guardian2_phone || null,
          guardian2_email: playerForm.guardian2_email || null,
          gender: playerForm.gender,
        })
        .eq("id", selectedPlayer.id);

      if (error) {
        console.error("Napaka pri posodabljanju igralca:", error);
        toast({
          variant: "destructive",
          title: "Napaka",
          description: error.message || "Napaka pri posodabljanju igralca",
        });
        throw error;
      }

      toast({
        title: "Uspešno",
        description: `Igralec ${playerForm.first_name} ${playerForm.last_name} uspešno posodobljen`,
      });

      setEditDialogOpen(false);
      loadPlayers();
    } catch (error: any) {
      console.error("Napaka pri posodabljanju igralca:", error);
    } finally {
      setLoading(false);
    }
  }

  function handleAddToTeamClick(player: Player) {
    setSelectedPlayer(player);
    setSelectedTeamForAdd("");
    loadTeamsForPlayer();
    setTeamDialogOpen(true);
  }

  async function handleAddToTeam() {
    if (!selectedPlayer || !selectedTeamForAdd) {
      toast({
        variant: "destructive",
        title: "Manjkajo podatki",
        description: "Izberi selekcijo",
      });
      return;
    }

    // Check if player is already in this team
    const isAlreadyInTeam = selectedPlayer.team_players?.some(
      tp => tp.team_id === selectedTeamForAdd
    );

    if (isAlreadyInTeam) {
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Igralec je že v tej selekciji",
      });
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase
        .from("team_players")
        .insert({
          team_id: selectedTeamForAdd,
          player_id: selectedPlayer.id,
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

      const teamName = teams.find(t => t.id === selectedTeamForAdd)?.name || "";
      toast({
        title: "Uspešno",
        description: `Igralec ${selectedPlayer.first_name} ${selectedPlayer.last_name} uspešno dodan v ${teamName}`,
      });

      setTeamDialogOpen(false);
      loadPlayers();
    } catch (error: any) {
      console.error("Napaka pri dodajanju igralca v selekcijo:", error);
    } finally {
      setLoading(false);
    }
  }

  function handleRemoveFromTeamClick(player: Player, teamPlayerId: string, teamName: string) {
    setTeamPlayerToRemove({
      playerId: player.id,
      teamPlayerId: teamPlayerId,
      teamName: teamName,
    });
    setRemoveDialogOpen(true);
  }

  async function handleConfirmRemoveFromTeam() {
    if (!teamPlayerToRemove) return;

    try {
      setLoading(true);

      const { error } = await supabase
        .from("team_players")
        .delete()
        .eq("id", teamPlayerToRemove.teamPlayerId);

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
        description: `Igralec uspešno odstranjen iz ${teamPlayerToRemove.teamName}`,
      });

      setRemoveDialogOpen(false);
      setTeamPlayerToRemove(null);
      loadPlayers();
    } catch (error: any) {
      console.error("Napaka pri odstranjevanju igralca iz selekcije:", error);
    } finally {
      setLoading(false);
    }
  }

  const filteredPlayers = players.filter(player => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      player.first_name.toLowerCase().includes(query) ||
      player.last_name.toLowerCase().includes(query)
    );
  });

  return (
    <ProtectedRoute allowedRoles={isParent ? undefined : ["coach"]}>
      <AppLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">
                {isParent ? "Moji Otroci" : "Igralci"}
              </h2>
              <p className="text-muted-foreground">
                {isParent 
                  ? "Pregled podatkov in prisotnosti vaših otrok" 
                  : "Upravljanje igralcev in njihovih selekcij"
                }
              </p>
            </div>
            {!isParent && (
              <Button onClick={handleAddClick} disabled={loading}>
                <Plus className="h-4 w-4 mr-2" />
                Dodaj igralca
              </Button>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Filtri</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="search">Išči po imenu ali priimku</Label>
                <Input
                  id="search"
                  placeholder="Vnesi ime ali priimek..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCog className="h-5 w-5" />
                Seznam igralcev ({filteredPlayers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading && players.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Nalagam...</div>
              ) : filteredPlayers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <UserCog className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Ni igralcev</p>
                  <p className="text-sm mt-2">
                    {searchQuery ? "Iskanje ni vrnilo rezultatov" : "Dodajte prvega igralca"}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ime</TableHead>
                        <TableHead>Priimek</TableHead>
                        <TableHead>Datum rojstva</TableHead>
                        <TableHead>Selekcije</TableHead>
                        <TableHead>Telefon</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Akcije</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPlayers.map((player) => (
                        <TableRow key={player.id}>
                          <TableCell className="font-medium">{player.first_name}</TableCell>
                          <TableCell>{player.last_name}</TableCell>
                          <TableCell>
                            {player.date_of_birth
                              ? new Date(player.date_of_birth).toLocaleDateString("sl-SI")
                              : "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {player.team_players?.map((tp) => (
                                <Badge
                                  key={tp.id}
                                  variant="secondary"
                                  className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                                  onClick={() => handleRemoveFromTeamClick(player, tp.id, tp.teams.name)}
                                  title={`Klikni za odstranitev iz ${tp.teams.name}`}
                                >
                                  {tp.teams.name}
                                  <Trash2 className="h-3 w-3 ml-1" />
                                </Badge>
                              ))}
                              {(!player.team_players || player.team_players.length === 0) && (
                                <span className="text-sm text-muted-foreground">Ni v nobeni selekciji</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{player.phone || "-"}</TableCell>
                          <TableCell>
                            {player.is_active ? (
                              <Badge className="bg-green-600">Aktiven</Badge>
                            ) : (
                              <Badge variant="outline">Neaktiven</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2 justify-end">
                              {!isParent && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleEditClick(player)}
                                    title="Uredi igralca"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleAddToTeamClick(player)}
                                    title="Dodaj v selekcijo"
                                  >
                                    <Users className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
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

          {/* Add Player Dialog */}
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Dodaj novega igralca</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">Ime *</Label>
                    <Input
                      id="first_name"
                      value={playerForm.first_name}
                      onChange={(e) => setPlayerForm({ ...playerForm, first_name: e.target.value })}
                      placeholder="Janez"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Priimek *</Label>
                    <Input
                      id="last_name"
                      value={playerForm.last_name}
                      onChange={(e) => setPlayerForm({ ...playerForm, last_name: e.target.value })}
                      placeholder="Novak"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date_of_birth">Datum rojstva</Label>
                  <Input
                    id="date_of_birth"
                    type="date"
                    value={playerForm.date_of_birth}
                    onChange={(e) => setPlayerForm({ ...playerForm, date_of_birth: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gender">Spol *</Label>
                  <Select
                    value={playerForm.gender}
                    onValueChange={(value) => setPlayerForm({ ...playerForm, gender: value })}
                  >
                    <SelectTrigger id="gender">
                      <SelectValue placeholder="Izberi spol" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">Moški</SelectItem>
                      <SelectItem value="F">Ženski</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefon igralca</Label>
                  <Input
                    id="phone"
                    value={playerForm.phone}
                    onChange={(e) => setPlayerForm({ ...playerForm, phone: e.target.value })}
                    placeholder="+386 40 123 456"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Naslov</Label>
                  <Input
                    id="address"
                    value={playerForm.address}
                    onChange={(e) => setPlayerForm({ ...playerForm, address: e.target.value })}
                    placeholder="Glavna ulica 1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="postal_code">Poštna številka</Label>
                    <Input
                      id="postal_code"
                      value={playerForm.postal_code}
                      onChange={(e) => setPlayerForm({ ...playerForm, postal_code: e.target.value })}
                      placeholder="1000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">Kraj</Label>
                    <Input
                      id="city"
                      value={playerForm.city}
                      onChange={(e) => setPlayerForm({ ...playerForm, city: e.target.value })}
                      placeholder="Ljubljana"
                    />
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-lg font-semibold mb-4">Starš / skrbnik 1</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="guardian1_name">Ime in priimek</Label>
                      <Input
                        id="guardian1_name"
                        value={playerForm.guardian1_name}
                        onChange={(e) => setPlayerForm({ ...playerForm, guardian1_name: e.target.value })}
                        placeholder="Ana Novak"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="guardian1_phone">Telefon</Label>
                        <Input
                          id="guardian1_phone"
                          value={playerForm.guardian1_phone}
                          onChange={(e) => setPlayerForm({ ...playerForm, guardian1_phone: e.target.value })}
                          placeholder="+386 40 123 456"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="guardian1_email">E-pošta</Label>
                        <Input
                          id="guardian1_email"
                          type="email"
                          value={playerForm.guardian1_email}
                          onChange={(e) => setPlayerForm({ ...playerForm, guardian1_email: e.target.value })}
                          placeholder="ana.novak@example.com"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-lg font-semibold mb-4">Starš / skrbnik 2</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="guardian2_name">Ime in priimek</Label>
                      <Input
                        id="guardian2_name"
                        value={playerForm.guardian2_name}
                        onChange={(e) => setPlayerForm({ ...playerForm, guardian2_name: e.target.value })}
                        placeholder="Peter Novak"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="guardian2_phone">Telefon</Label>
                        <Input
                          id="guardian2_phone"
                          value={playerForm.guardian2_phone}
                          onChange={(e) => setPlayerForm({ ...playerForm, guardian2_phone: e.target.value })}
                          placeholder="+386 40 123 456"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="guardian2_email">E-pošta</Label>
                        <Input
                          id="guardian2_email"
                          type="email"
                          value={playerForm.guardian2_email}
                          onChange={(e) => setPlayerForm({ ...playerForm, guardian2_email: e.target.value })}
                          placeholder="peter.novak@example.com"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddDialogOpen(false)}
                  disabled={loading}
                >
                  Prekliči
                </Button>
                <Button onClick={handleAddPlayer} disabled={loading}>
                  {loading ? "Dodajam..." : "Dodaj igralca"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit Player Dialog */}
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Uredi igralca</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit_first_name">Ime *</Label>
                    <Input
                      id="edit_first_name"
                      value={playerForm.first_name}
                      onChange={(e) => setPlayerForm({ ...playerForm, first_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit_last_name">Priimek *</Label>
                    <Input
                      id="edit_last_name"
                      value={playerForm.last_name}
                      onChange={(e) => setPlayerForm({ ...playerForm, last_name: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit_date_of_birth">Datum rojstva</Label>
                  <Input
                    id="edit_date_of_birth"
                    type="date"
                    value={playerForm.date_of_birth}
                    onChange={(e) => setPlayerForm({ ...playerForm, date_of_birth: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit_gender">Spol *</Label>
                  <Select
                    value={playerForm.gender}
                    onValueChange={(value) => setPlayerForm({ ...playerForm, gender: value })}
                  >
                    <SelectTrigger id="edit_gender">
                      <SelectValue placeholder="Izberi spol" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">Moški</SelectItem>
                      <SelectItem value="F">Ženski</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit_phone">Telefon igralca</Label>
                  <Input
                    id="edit_phone"
                    value={playerForm.phone}
                    onChange={(e) => setPlayerForm({ ...playerForm, phone: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit_address">Naslov</Label>
                  <Input
                    id="edit_address"
                    value={playerForm.address}
                    onChange={(e) => setPlayerForm({ ...playerForm, address: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit_postal_code">Poštna številka</Label>
                    <Input
                      id="edit_postal_code"
                      value={playerForm.postal_code}
                      onChange={(e) => setPlayerForm({ ...playerForm, postal_code: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit_city">Kraj</Label>
                    <Input
                      id="edit_city"
                      value={playerForm.city}
                      onChange={(e) => setPlayerForm({ ...playerForm, city: e.target.value })}
                    />
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-lg font-semibold mb-4">Starš / skrbnik 1</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit_guardian1_name">Ime in priimek</Label>
                      <Input
                        id="edit_guardian1_name"
                        value={playerForm.guardian1_name}
                        onChange={(e) => setPlayerForm({ ...playerForm, guardian1_name: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit_guardian1_phone">Telefon</Label>
                        <Input
                          id="edit_guardian1_phone"
                          value={playerForm.guardian1_phone}
                          onChange={(e) => setPlayerForm({ ...playerForm, guardian1_phone: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit_guardian1_email">E-pošta</Label>
                        <Input
                          id="edit_guardian1_email"
                          type="email"
                          value={playerForm.guardian1_email}
                          onChange={(e) => setPlayerForm({ ...playerForm, guardian1_email: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-lg font-semibold mb-4">Starš / skrbnik 2</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit_guardian2_name">Ime in priimek</Label>
                      <Input
                        id="edit_guardian2_name"
                        value={playerForm.guardian2_name}
                        onChange={(e) => setPlayerForm({ ...playerForm, guardian2_name: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit_guardian2_phone">Telefon</Label>
                        <Input
                          id="edit_guardian2_phone"
                          value={playerForm.guardian2_phone}
                          onChange={(e) => setPlayerForm({ ...playerForm, guardian2_phone: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit_guardian2_email">E-pošta</Label>
                        <Input
                          id="edit_guardian2_email"
                          type="email"
                          value={playerForm.guardian2_email}
                          onChange={(e) => setPlayerForm({ ...playerForm, guardian2_email: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
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
                <Button onClick={handleUpdatePlayer} disabled={loading}>
                  {loading ? "Shranjujem..." : "Shrani spremembe"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Add to Team Dialog */}
          <Dialog open={teamDialogOpen} onOpenChange={setTeamDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Dodaj igralca v selekcijo</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <p className="text-sm text-muted-foreground">
                  Dodajanje igralca: <strong>{selectedPlayer?.first_name} {selectedPlayer?.last_name}</strong>
                </p>

                <div className="space-y-2">
                  <Label htmlFor="team_select">Selekcija *</Label>
                  <Select value={selectedTeamForAdd} onValueChange={setSelectedTeamForAdd}>
                    <SelectTrigger id="team_select">
                      <SelectValue placeholder="Izberi selekcijo" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTeams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
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
                  onClick={() => setTeamDialogOpen(false)}
                  disabled={loading}
                >
                  Prekliči
                </Button>
                <Button onClick={handleAddToTeam} disabled={loading}>
                  {loading ? "Dodajam..." : "Dodaj v selekcijo"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Remove from Team Dialog */}
          <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Potrditev odstranitve</AlertDialogTitle>
                <AlertDialogDescription>
                  Nameravaš odstraniti igralca iz selekcije{" "}
                  <strong>{teamPlayerToRemove?.teamName}</strong>. Odstranim?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Prekliči</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleConfirmRemoveFromTeam}
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