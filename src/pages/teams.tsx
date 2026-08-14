import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Users, Plus, Edit, Trash2 } from "lucide-react";

interface Team {
  id: string;
  name: string;
  short_name: string | null;
  age_category: string | null;
  gender: string | null;
  is_active: boolean;
  notes: string | null;
  season_id: string;
}

export default function TeamsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [playersDialogOpen, setPlayersDialogOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamPlayers, setTeamPlayers] = useState<any[]>([]);
  const [allPlayers, setAllPlayers] = useState<any[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    short_name: "",
    age_category: "",
    gender: "",
    is_active: true,
    notes: "",
    season_id: "",
  });

  useEffect(() => {
    loadSeasons();
    loadTeams();
  }, []);

  async function loadSeasons() {
    try {
      const { data, error } = await supabase
        .from("seasons")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSeasons(data || []);
      if (data && data.length > 0) {
        setFormData((prev) => ({ ...prev, season_id: data[0].id }));
      }
    } catch (error: any) {
      console.error("Napaka pri nalaganju sezon:", error);
    }
  }

  async function loadAllPlayers() {
    try {
      const { data, error } = await supabase
        .from("players")
        .select("id, first_name, last_name, date_of_birth")
        .eq("is_active", true)
        .order("last_name", { ascending: true });

      if (error) throw error;
      setAllPlayers(data || []);
    } catch (error: any) {
      console.error("Napaka pri nalaganju igralcev:", error);
    }
  }

  async function loadTeamPlayers(teamId: string) {
    try {
      const { data, error } = await supabase
        .from("team_players")
        .select(`
          id,
          player_id,
          players(first_name, last_name, date_of_birth)
        `)
        .eq("team_id", teamId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setTeamPlayers(data || []);
      setSelectedPlayers((data || []).map((tp: any) => tp.player_id));
    } catch (error: any) {
      console.error("Napaka pri nalaganju igralcev selekcije:", error);
    }
  }

  async function handleManagePlayers(team: Team) {
    setSelectedTeam(team);
    await loadAllPlayers();
    await loadTeamPlayers(team.id);
    setPlayersDialogOpen(true);
  }

  async function handleSavePlayers() {
    if (!selectedTeam) return;

    try {
      setLoading(true);

      // Get current player IDs
      const currentPlayerIds = teamPlayers.map((tp: any) => tp.player_id);
      
      // Find players to add (in selectedPlayers but not in currentPlayerIds)
      const playersToAdd = selectedPlayers.filter(id => !currentPlayerIds.includes(id));
      
      // Find players to remove (in currentPlayerIds but not in selectedPlayers)
      const playersToRemove = currentPlayerIds.filter(id => !selectedPlayers.includes(id));

      // Add new players
      if (playersToAdd.length > 0) {
        const { error: addError } = await supabase
          .from("team_players")
          .insert(playersToAdd.map(playerId => ({
            team_id: selectedTeam.id,
            player_id: playerId,
          })));

        if (addError) throw addError;
      }

      // Remove players
      if (playersToRemove.length > 0) {
        const { error: removeError } = await supabase
          .from("team_players")
          .delete()
          .eq("team_id", selectedTeam.id)
          .in("player_id", playersToRemove);

        if (removeError) throw removeError;
      }

      toast({
        title: "Uspešno",
        description: "Igralci selekcije uspešno posodobljeni",
      });

      setPlayersDialogOpen(false);
    } catch (error: any) {
      console.error("Napaka pri shranjevanju igralcev:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Napaka pri shranjevanju igralcev",
      });
    } finally {
      setLoading(false);
    }
  }

  function togglePlayer(playerId: string) {
    setSelectedPlayers(prev => 
      prev.includes(playerId) 
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId]
    );
  }

  async function loadTeams() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("teams")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      // Map is_archived (DB) to is_active (UI)
      const mappedTeams = (data || []).map((team: any) => ({
        ...team,
        is_active: !team.is_archived,
      }));
      setTeams(mappedTeams);
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

  function handleAdd() {
    setSelectedTeam(null);
    setFormData({
      name: "",
      short_name: "",
      age_category: "",
      gender: "",
      is_active: true,
      notes: "",
      season_id: seasons[0]?.id || "",
    });
    setDialogOpen(true);
  }

  function handleEdit(team: Team) {
    setSelectedTeam(team);
    setFormData({
      name: team.name,
      short_name: team.short_name || "",
      age_category: team.age_category || "",
      gender: team.gender || "",
      is_active: team.is_active,
      notes: team.notes || "",
      season_id: team.season_id,
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.name || !formData.season_id) {
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Naziv in sezona sta obvezna",
      });
      return;
    }

    try {
      setLoading(true);

      const payload = {
        name: formData.name,
        short_name: formData.short_name || null,
        age_category: formData.age_category || null,
        gender: formData.gender || null,
        is_archived: !formData.is_active, // Map UI is_active to DB is_archived
        notes: formData.notes || null,
        season_id: formData.season_id,
      };

      if (selectedTeam) {
        const { error } = await supabase
          .from("teams")
          .update(payload)
          .eq("id", selectedTeam.id);

        if (error) throw error;
        toast({
          title: "Uspešno",
          description: "Selekcija uspešno posodobljena",
        });
      } else {
        const { error } = await supabase
          .from("teams")
          .insert([payload]);

        if (error) throw error;
        toast({
          title: "Uspešno",
          description: "Selekcija uspešno ustvarjena",
        });
      }

      setDialogOpen(false);
      loadTeams();
    } catch (error: any) {
      console.error("Napaka pri shranjevanju selekcije:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Napaka pri shranjevanju selekcije",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(teamId: string) {
    if (!confirm("Ali ste prepričani, da želite izbrisati to selekcijo?")) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from("teams")
        .delete()
        .eq("id", teamId);

      if (error) throw error;
      toast({
        title: "Uspešno",
        description: "Selekcija uspešno izbrisana",
      });
      loadTeams();
    } catch (error: any) {
      console.error("Napaka pri brisanju selekcije:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Napaka pri brisanju selekcije",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <AppLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Selekcije</h2>
              <p className="text-muted-foreground">Upravljanje selekcij kluba</p>
            </div>
            <Button onClick={handleAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Dodaj selekcijo
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Seznam selekcij ({teams.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading && teams.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Nalagam...</div>
              ) : teams.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Ni selekcij</p>
                  <p className="text-sm mt-2">Dodajte prvo selekcijo</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Naziv</TableHead>
                        <TableHead>Oznaka</TableHead>
                        <TableHead>Starostna kategorija</TableHead>
                        <TableHead>Spol</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Akcije</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teams.map((team) => (
                        <TableRow key={team.id}>
                          <TableCell className="font-medium">{team.name}</TableCell>
                          <TableCell>{team.short_name || "N/A"}</TableCell>
                          <TableCell>{team.age_category || "N/A"}</TableCell>
                          <TableCell>{team.gender || "N/A"}</TableCell>
                          <TableCell>
                            <Badge variant={team.is_active ? "default" : "secondary"}>
                              {team.is_active ? "Aktivna" : "Neaktivna"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleManagePlayers(team)}
                                disabled={loading}
                              >
                                <Users className="h-4 w-4 mr-1" />
                                Igralci
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEdit(team)}
                                disabled={loading}
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                Uredi
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDelete(team.id)}
                                disabled={loading}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Izbriši
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

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>
                  {selectedTeam ? "Uredi selekcijo" : "Dodaj selekcijo"}
                </DialogTitle>
              </DialogHeader>

              <ScrollArea className="max-h-[60vh] pr-4">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">
                      Naziv <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="name"
                      placeholder="npr. Kadetinje 1"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="short_name">Oznaka / kratek naziv</Label>
                    <Input
                      id="short_name"
                      placeholder="npr. KAD1"
                      value={formData.short_name}
                      onChange={(e) => setFormData({ ...formData, short_name: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="age_category">Starostna kategorija</Label>
                    <Input
                      id="age_category"
                      placeholder="npr. U15, U17"
                      value={formData.age_category}
                      onChange={(e) => setFormData({ ...formData, age_category: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gender">Spol</Label>
                    <Input
                      id="gender"
                      placeholder="npr. Ž, M, Mešano"
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="is_active">Aktivna selekcija</Label>
                    <Switch
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, is_active: checked })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Opombe</Label>
                    <Textarea
                      id="notes"
                      placeholder="Dodatne opombe..."
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={3}
                    />
                  </div>

                  <DialogFooter className="mt-6">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDialogOpen(false)}
                      disabled={loading}
                    >
                      Prekliči
                    </Button>
                    <Button type="submit" disabled={loading}>
                      {loading ? "Shranjujem..." : selectedTeam ? "Posodobi" : "Dodaj"}
                    </Button>
                  </DialogFooter>
                </form>
              </ScrollArea>
            </DialogContent>
          </Dialog>

          <Dialog open={playersDialogOpen} onOpenChange={setPlayersDialogOpen}>
            <DialogContent className="max-h-[90vh] max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  Upravljanje igralcev - {selectedTeam?.name}
                </DialogTitle>
              </DialogHeader>

              <ScrollArea className="max-h-[60vh] pr-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b">
                    <p className="text-sm text-muted-foreground">
                      Izbranih: {selectedPlayers.length} / {allPlayers.length}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedPlayers(allPlayers.map(p => p.id))}
                    >
                      Izberi vse
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {allPlayers.map((player) => (
                      <div
                        key={player.id}
                        className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${
                          selectedPlayers.includes(player.id) ? "bg-primary/5 border-primary" : ""
                        }`}
                        onClick={() => togglePlayer(player.id)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            selectedPlayers.includes(player.id) 
                              ? "bg-primary border-primary" 
                              : "border-muted-foreground"
                          }`}>
                            {selectedPlayers.includes(player.id) && (
                              <svg className="w-3 h-3 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                          <div>
                            <p className="font-medium">
                              {player.first_name} {player.last_name}
                            </p>
                            {player.date_of_birth && (
                              <p className="text-xs text-muted-foreground">
                                {new Date(player.date_of_birth).toLocaleDateString("sl-SI")}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </ScrollArea>

              <DialogFooter className="mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPlayersDialogOpen(false)}
                  disabled={loading}
                >
                  Prekliči
                </Button>
                <Button onClick={handleSavePlayers} disabled={loading}>
                  {loading ? "Shranjujem..." : "Shrani"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}