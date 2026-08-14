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
import { UserCircle, Plus, Edit, Trash2 } from "lucide-react";

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  phone: string | null;
  is_active: boolean;
  joined_date: string | null;
  left_date: string | null;
  notes: string | null;
}

export default function PlayersPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    date_of_birth: "",
    address: "",
    postal_code: "",
    city: "",
    phone: "",
    is_active: true,
    joined_date: "",
    left_date: "",
    notes: "",
  });

  useEffect(() => {
    loadPlayers();
  }, []);

  async function loadPlayers() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("players")
        .select("*")
        .order("last_name", { ascending: true });

      if (error) throw error;
      setPlayers(data || []);
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

  function handleAdd() {
    setSelectedPlayer(null);
    setFormData({
      first_name: "",
      last_name: "",
      date_of_birth: "",
      address: "",
      postal_code: "",
      city: "",
      phone: "",
      is_active: true,
      joined_date: "",
      left_date: "",
      notes: "",
    });
    setDialogOpen(true);
  }

  function handleEdit(player: Player) {
    setSelectedPlayer(player);
    setFormData({
      first_name: player.first_name,
      last_name: player.last_name,
      date_of_birth: player.date_of_birth || "",
      address: player.address || "",
      postal_code: player.postal_code || "",
      city: player.city || "",
      phone: player.phone || "",
      is_active: player.is_active,
      joined_date: player.joined_date || "",
      left_date: player.left_date || "",
      notes: player.notes || "",
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.first_name || !formData.last_name) {
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Ime in priimek sta obvezna",
      });
      return;
    }

    try {
      setLoading(true);

      const payload = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        date_of_birth: formData.date_of_birth || null,
        address: formData.address || null,
        postal_code: formData.postal_code || null,
        city: formData.city || null,
        phone: formData.phone || null,
        is_active: formData.is_active,
        joined_date: formData.joined_date || null,
        left_date: formData.left_date || null,
        notes: formData.notes || null,
      };

      if (selectedPlayer) {
        const { error } = await supabase
          .from("players")
          .update(payload)
          .eq("id", selectedPlayer.id);

        if (error) throw error;
        toast({
          title: "Uspešno",
          description: "Igralec uspešno posodobljen",
        });
      } else {
        const { error } = await supabase
          .from("players")
          .insert([payload]);

        if (error) throw error;
        toast({
          title: "Uspešno",
          description: "Igralec uspešno ustvarjen",
        });
      }

      setDialogOpen(false);
      loadPlayers();
    } catch (error: any) {
      console.error("Napaka pri shranjevanju igralca:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Napaka pri shranjevanju igralca",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(playerId: string) {
    if (!confirm("Ali ste prepričani, da želite izbrisati tega igralca?")) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from("players")
        .delete()
        .eq("id", playerId);

      if (error) throw error;
      toast({
        title: "Uspešno",
        description: "Igralec uspešno izbrisan",
      });
      loadPlayers();
    } catch (error: any) {
      console.error("Napaka pri brisanju igralca:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Napaka pri brisanju igralca",
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
              <h2 className="text-3xl font-bold tracking-tight">Igralci</h2>
              <p className="text-muted-foreground">Upravljanje igralcev kluba</p>
            </div>
            <Button onClick={handleAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Dodaj igralca
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCircle className="h-5 w-5" />
                Seznam igralcev ({players.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading && players.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Nalagam...</div>
              ) : players.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <UserCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Ni igralcev</p>
                  <p className="text-sm mt-2">Dodajte prvega igralca</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Priimek in ime</TableHead>
                        <TableHead>Datum rojstva</TableHead>
                        <TableHead>Kraj</TableHead>
                        <TableHead>Telefon</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Akcije</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {players.map((player) => (
                        <TableRow key={player.id}>
                          <TableCell className="font-medium">
                            {player.last_name} {player.first_name}
                          </TableCell>
                          <TableCell>
                            {player.date_of_birth
                              ? new Date(player.date_of_birth).toLocaleDateString("sl-SI")
                              : "N/A"}
                          </TableCell>
                          <TableCell>{player.city || "N/A"}</TableCell>
                          <TableCell>{player.phone || "N/A"}</TableCell>
                          <TableCell>
                            <Badge variant={player.is_active ? "default" : "secondary"}>
                              {player.is_active ? "Aktiven" : "Neaktiven"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEdit(player)}
                                disabled={loading}
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                Uredi
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDelete(player.id)}
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
                  {selectedPlayer ? "Uredi igralca" : "Dodaj igralca"}
                </DialogTitle>
              </DialogHeader>

              <ScrollArea className="max-h-[60vh] pr-4">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="first_name">
                        Ime <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="first_name"
                        value={formData.first_name}
                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last_name">
                        Priimek <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="last_name"
                        value={formData.last_name}
                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="date_of_birth">Datum rojstva</Label>
                    <Input
                      id="date_of_birth"
                      type="date"
                      value={formData.date_of_birth}
                      onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Naslov</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="postal_code">Poštna številka</Label>
                      <Input
                        id="postal_code"
                        value={formData.postal_code}
                        onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city">Kraj</Label>
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefon</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="joined_date">Datum vključitve</Label>
                      <Input
                        id="joined_date"
                        type="date"
                        value={formData.joined_date}
                        onChange={(e) => setFormData({ ...formData, joined_date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="left_date">Datum izstopa</Label>
                      <Input
                        id="left_date"
                        type="date"
                        value={formData.left_date}
                        onChange={(e) => setFormData({ ...formData, left_date: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="is_active">Aktiven igralec</Label>
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
                      {loading ? "Shranjujem..." : selectedPlayer ? "Posodobi" : "Dodaj"}
                    </Button>
                  </DialogFooter>
                </form>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}