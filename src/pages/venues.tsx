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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Plus, Edit, Trash2 } from "lucide-react";

interface Venue {
  id: string;
  name: string;
  city: string;
  address: string | null;
  postal_code: string | null;
  room_designation: string | null;
  is_active: boolean;
}

export default function VenuesPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    city: "",
    address: "",
    postal_code: "",
    room_designation: "",
    is_active: true,
  });

  useEffect(() => {
    loadVenues();
  }, []);

  async function loadVenues() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("venues")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      setVenues(data || []);
    } catch (error: any) {
      console.error("Napaka pri nalaganju dvoran:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Ni mogoče naložiti dvoran",
      });
    } finally {
      setLoading(false);
    }
  }

  function handleAdd() {
    setSelectedVenue(null);
    setFormData({
      name: "",
      city: "",
      address: "",
      postal_code: "",
      room_designation: "",
      is_active: true,
    });
    setDialogOpen(true);
  }

  function handleEdit(venue: Venue) {
    setSelectedVenue(venue);
    setFormData({
      name: venue.name,
      city: venue.city,
      address: venue.address || "",
      postal_code: venue.postal_code || "",
      room_designation: venue.room_designation || "",
      is_active: venue.is_active,
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.name || !formData.city) {
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Naziv in kraj sta obvezna",
      });
      return;
    }

    try {
      setLoading(true);

      const payload = {
        name: formData.name,
        city: formData.city,
        address: formData.address || null,
        postal_code: formData.postal_code || null,
        room_designation: formData.room_designation || null,
        is_active: formData.is_active,
      };

      if (selectedVenue) {
        const { error } = await supabase
          .from("venues")
          .update(payload)
          .eq("id", selectedVenue.id);

        if (error) throw error;
        toast({
          title: "Uspešno",
          description: "Dvorana uspešno posodobljena",
        });
      } else {
        const { error } = await supabase
          .from("venues")
          .insert([payload]);

        if (error) throw error;
        toast({
          title: "Uspešno",
          description: "Dvorana uspešno ustvarjena",
        });
      }

      setDialogOpen(false);
      loadVenues();
    } catch (error: any) {
      console.error("Napaka pri shranjevanju dvorane:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Napaka pri shranjevanju dvorane",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(venueId: string) {
    if (!confirm("Ali ste prepričani, da želite izbrisati to dvorano?")) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from("venues")
        .delete()
        .eq("id", venueId);

      if (error) throw error;
      toast({
        title: "Uspešno",
        description: "Dvorana uspešno izbrisana",
      });
      loadVenues();
    } catch (error: any) {
      console.error("Napaka pri brisanju dvorane:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Napaka pri brisanju dvorane",
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
              <h2 className="text-3xl font-bold tracking-tight">Dvorane</h2>
              <p className="text-muted-foreground">Upravljanje dvoran</p>
            </div>
            <Button onClick={handleAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Dodaj dvorano
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Seznam dvoran ({venues.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading && venues.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Nalagam...</div>
              ) : venues.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Ni dvoran</p>
                  <p className="text-sm mt-2">Dodajte prvo dvorano</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Naziv</TableHead>
                        <TableHead>Kraj</TableHead>
                        <TableHead>Naslov</TableHead>
                        <TableHead>Oznaka prostora</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Akcije</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {venues.map((venue) => (
                        <TableRow key={venue.id}>
                          <TableCell className="font-medium">{venue.name}</TableCell>
                          <TableCell>{venue.city}</TableCell>
                          <TableCell>{venue.address || "N/A"}</TableCell>
                          <TableCell>{venue.room_designation || "N/A"}</TableCell>
                          <TableCell>
                            <Badge variant={venue.is_active ? "default" : "secondary"}>
                              {venue.is_active ? "Aktivna" : "Neaktivna"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEdit(venue)}
                                disabled={loading}
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                Uredi
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDelete(venue.id)}
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
                  {selectedVenue ? "Uredi dvorano" : "Dodaj dvorano"}
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
                      placeholder="npr. Športna dvorana Poden"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="city">
                      Kraj <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="city"
                      placeholder="npr. Škofja Loka"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Naslov</Label>
                    <Input
                      id="address"
                      placeholder="npr. Podlubnik 1a"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="postal_code">Poštna številka</Label>
                    <Input
                      id="postal_code"
                      placeholder="npr. 4220"
                      value={formData.postal_code}
                      onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="room_designation">Oznaka prostora</Label>
                    <Input
                      id="room_designation"
                      placeholder="npr. Mala dvorana"
                      value={formData.room_designation}
                      onChange={(e) => setFormData({ ...formData, room_designation: e.target.value })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="is_active">Aktivna dvorana</Label>
                    <Switch
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, is_active: checked })
                      }
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
                      {loading ? "Shranjujem..." : selectedVenue ? "Posodobi" : "Dodaj"}
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