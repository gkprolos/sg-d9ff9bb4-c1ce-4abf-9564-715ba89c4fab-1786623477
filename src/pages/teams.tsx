import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
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
  AlertDialogTitle } from
"@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Users, Plus, Edit, Trash2 } from "lucide-react";

const AGE_CATEGORIES = [
"Člani",
"Mladinci",
"Kadeti",
"Starejši dečki",
"Dečki",
"Članice",
"Mladinke",
"Kadetinje",
"Starejše deklice",
"Deklice",
"Začetniki"];


interface Team {
  id: string;
  name: string;
  short_name: string | null;
  age_category: string | null;
  gender: string | null;
  is_active: boolean;
  notes: string | null;
  season_id: string;
  head_coach_id: string | null;
  head_coach?: {full_name: string;} | null;
  coaches?: Array<{coach_id: string;}>;
}

export default function TeamsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamPlayers, setTeamPlayers] = useState<any[]>([]);
  const [allPlayers, setAllPlayers] = useState<any[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [genderFilter, setGenderFilter] = useState<string>("all");
  const [coaches, setCoaches] = useState<any[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [teamToDelete, setTeamToDelete] = useState<Team | null>(null);
  const [managePlayersDialogOpen, setManagePlayersDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    short_name: "",
    age_category: "",
    gender: "",
    is_active: true,
    notes: "",
    season_id: "",
    head_coach_id: ""
  });

  // Filter players by search term and team gender
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
    loadSeasons();
    loadCoaches();
  }, []);

  useEffect(() => {
    async function checkAdmin() {
      if (!user) return;
      const { data } = await supabase.
      from("user_roles").
      select("role").
      eq("user_id", user.id).
      eq("role", "admin").
      maybeSingle();
      setIsAdmin(!!data);
    }
    checkAdmin();
  }, [user]);

  // Check if current user is assigned as coach to a team
  function isAssignedCoach(teamId: string): boolean {
    if (isAdmin) return true;
    if (!user) return false;
    const team = teams.find((t) => t.id === teamId);
    if (!team) return false;
    return team.coaches?.some((tc: any) => tc.coach_id === user.id) || false;
  }

  async function loadCoaches() {
    try {
      const { data, error } = await supabase.
      from("profiles").
      select("id, full_name").
      order("full_name", { ascending: true });

      if (error) throw error;
      setCoaches(data || []);
    } catch (error: any) {
      console.error("Napaka pri nalaganju trenerjev:", error);
    }
  }

  async function loadSeasons() {
    try {
      const { data, error } = await supabase.
      from("seasons").
      select("*").
      eq("is_active", true).
      order("created_at", { ascending: false });

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

  async function loadTeamPlayers(teamId: string) {
    try {
      const { data, error } = await supabase.
      from("team_players").
      select(`
          id,
          player_id,
          players(first_name, last_name, date_of_birth)
        `).
      eq("team_id", teamId).
      order("created_at", { ascending: true });

      if (error) throw error;
      setTeamPlayers(data || []);
      setSelectedPlayers((data || []).map((tp: any) => tp.player_id));
    } catch (error: any) {
      console.error("Napaka pri nalaganju igralcev selekcije:", error);
    }
  }

  async function handleManagePlayers(team: Team) {
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

  async function loadTeams() {
    try {
      setLoading(true);
      const { data, error } = await supabase.
      from("teams").
      select(`
          *,
          head_coach:profiles!head_coach_id(full_name),
          coaches:team_coaches(coach_id),
          team_players(count)
        `).
      order("name", { ascending: true });

      if (error) throw error;
      // Map is_archived (DB) to is_active (UI)
      const mappedTeams = (data || []).map((team: any) => ({
        ...team,
        is_active: !team.is_archived
      }));
      setTeams(mappedTeams);
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
      head_coach_id: ""
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
      head_coach_id: team.head_coach_id || ""
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.name || !formData.season_id) {
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Naziv in sezona sta obvezna"
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
        is_archived: !formData.is_active,
        notes: formData.notes || null,
        season_id: formData.season_id,
        head_coach_id: formData.head_coach_id || null
      };

      let teamId = selectedTeam?.id;
      const oldHeadCoachId = selectedTeam?.head_coach_id;

      if (selectedTeam) {
        const { error } = await supabase.
        from("teams").
        update(payload).
        eq("id", selectedTeam.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase.
        from("teams").
        insert([payload]).
        select("id").
        single();

        if (error) throw error;
        teamId = data.id;
      }

      // Sync head_coach_id to team_coaches table
      if (teamId && formData.head_coach_id) {
        // Find existing head coach record for this team
        const { data: existingHeadCoachRecord } = await supabase.
        from("team_coaches").
        select("id, coach_id").
        eq("team_id", teamId).
        eq("can_be_head_coach", true).
        maybeSingle();

        if (existingHeadCoachRecord) {
          // Update existing head coach record with new coach_id
          const { error: updateError } = await supabase.
          from("team_coaches").
          update({ coach_id: formData.head_coach_id }).
          eq("id", existingHeadCoachRecord.id);

          if (updateError) {
            console.error("Napaka pri posodobitvi coach_id:", updateError);
          }
        } else {
          // No head coach record exists - create new one
          const { error: insertError } = await supabase.
          from("team_coaches").
          insert([{
            team_id: teamId,
            coach_id: formData.head_coach_id,
            can_be_head_coach: true,
            can_be_assistant: true,
            is_active: true
          }]);

          if (insertError) {
            console.error("Napaka pri sinhronizaciji team_coaches:", insertError);
          }
        }
      }

      toast({
        title: "Uspešno",
        description: selectedTeam ?
        "Selekcija uspešno posodobljena" :
        "Selekcija uspešno ustvarjena"
      });

      setDialogOpen(false);
      loadTeams();
    } catch (error: any) {
      console.error("Napaka pri shranjevanju selekcije:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Napaka pri shranjevanju selekcije"
      });
    } finally {
      setLoading(false);
    }
  }

  function handleDeleteClick(team: Team) {
    setTeamToDelete(team);
    setDeleteDialogOpen(true);
  }

  async function handleConfirmDelete() {
    if (!teamToDelete) return;

    try {
      setLoading(true);
      const { error } = await supabase.
      from("teams").
      delete().
      eq("id", teamToDelete.id);

      if (error) throw error;
      toast({
        title: "Uspešno",
        description: "Selekcija uspešno izbrisana"
      });

      setDeleteDialogOpen(false);
      setTeamToDelete(null);
      loadTeams();
    } catch (error: any) {
      console.error("Napaka pri brisanju selekcije:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Napaka pri brisanju selekcije"
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
              <p className="text-muted-foreground">Upravljanje ekip in njihovih članov</p>
            </div>
            <Button onClick={handleAdd} disabled={loading || !isAdmin}>
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
              {loading && teams.length === 0 ?
              <div className="text-center py-8 text-muted-foreground">Nalagam...</div> :
              teams.length === 0 ?
              <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Ni selekcij</p>
                  <p className="text-sm mt-2">Dodajte prvo selekcijo</p>
                </div> :

              <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Naziv</TableHead>
                        <TableHead>Oznaka</TableHead>
                        <TableHead>Starostna kategorija</TableHead>
                        <TableHead>Spol</TableHead>
                        <TableHead>Glavni trener</TableHead>
                        <TableHead>Št. igralcev</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Akcije</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teams.map((team) =>
                    <TableRow key={team.id}>
                          <TableCell className="font-medium">{team.name}</TableCell>
                          <TableCell>{team.short_name || "N/A"}</TableCell>
                          <TableCell>{team.age_category || "N/A"}</TableCell>
                          <TableCell>{team.gender || "N/A"}</TableCell>
                          <TableCell>{team.head_coach?.full_name || "Ni izbran"}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {(team as any).team_players?.[0]?.count || 0}
                            </Badge>
                          </TableCell>
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
                            disabled={loading || !isAssignedCoach(team.id)}
                            title={!isAssignedCoach(team.id) ? "Samo dodeljeni trenerji lahko urejajo igralce" : ""}>
                            
                                <Users className="h-4 w-4 mr-1" />
                                Igralci
                              </Button>
                              <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(team)}
                            disabled={loading || !isAssignedCoach(team.id)}
                            title={!isAssignedCoach(team.id) ? "Samo dodeljeni trenerji lahko urejajo selekcijo" : ""}>
                            
                                <Edit className="h-4 w-4 mr-1" />
                                Uredi
                              </Button>
                              <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteClick(team)}
                            disabled={loading || !isAdmin}>
                            
                                <Trash2 className="h-4 w-4 mr-1" />
                                Izbriši
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                    )}
                    </TableBody>
                  </Table>
                </div>
              }
            </CardContent>
          </Card>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {selectedTeam ? "Uredi selekcijo" : "Dodaj selekcijo"}
                </DialogTitle>
              </DialogHeader>

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
                    required />
                  
                </div>

                <div className="space-y-2">
                  <Label htmlFor="short_name">Oznaka / kratek naziv</Label>
                  <Input
                    id="short_name"
                    placeholder="npr. KAD1"
                    value={formData.short_name}
                    onChange={(e) => setFormData({ ...formData, short_name: e.target.value })} />
                  
                </div>

                <div className="space-y-2">
                  <Label htmlFor="age_category">Starostna kategorija</Label>
                  <Select
                    value={formData.age_category}
                    onValueChange={(value) => setFormData({ ...formData, age_category: value })}>
                    
                    <SelectTrigger id="age_category">
                      <SelectValue placeholder="Izberi starostno kategorijo" />
                    </SelectTrigger>
                    <SelectContent>
                      {AGE_CATEGORIES.map((cat) =>
                      <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gender">Spol</Label>
                  <Select
                    value={formData.gender}
                    onValueChange={(value) => setFormData({ ...formData, gender: value })}>
                    
                    <SelectTrigger id="gender">
                      <SelectValue placeholder="Izberi spol" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">M (Moški)</SelectItem>
                      <SelectItem value="F">F (Ženski)</SelectItem>
                      <SelectItem value="Mixed">Mixed (Mešano)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="head_coach_id">Glavni trener</Label>
                  <Select
                    value={formData.head_coach_id}
                    onValueChange={(value) => setFormData({ ...formData, head_coach_id: value })}>
                    
                    <SelectTrigger id="head_coach_id">
                      <SelectValue placeholder="Izberi glavnega trenerja" />
                    </SelectTrigger>
                    <SelectContent>
                      {coaches.map((coach) =>
                      <SelectItem key={coach.id} value={coach.id}>
                          {coach.full_name}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="is_active">Aktivna selekcija</Label>
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_active: checked })
                    } />
                  
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Opombe</Label>
                  <Textarea
                    id="notes"
                    placeholder="Dodatne opombe..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3} />
                  
                </div>

                <DialogFooter className="mt-6 sticky bottom-0 bg-background pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                    disabled={loading}>
                    
                    Prekliči
                  </Button>
                  <Button type="submit" disabled={loading} style={{ backgroundColor: "#3b82f6", backgroundImage: "none" }}>
                    {loading ? "Shranjujem..." : selectedTeam ? "Posodobi" : "Dodaj"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

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

          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Potrditev brisanja</AlertDialogTitle>
                <AlertDialogDescription>
                  Nameravaš izbrisati selekcijo <strong>{teamToDelete?.name}</strong>. Izbrišem?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Prekliči</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleConfirmDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  
                  Izbriši
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </AppLayout>
    </ProtectedRoute>);

}