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
import { useToast } from "@/hooks/use-toast";
import {
  getAllSeasons,
  createSeason,
  updateSeason,
  setActiveSeason,
  deleteSeason,
  type Season } from
"@/services/seasonsService";
import { Calendar, Plus, Edit, Trash2, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export default function SeasonsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<Season | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    start_date: "",
    end_date: ""
  });

  useEffect(() => {
    loadSeasons();
  }, []);

  async function loadSeasons() {
    try {
      setLoading(true);
      const data = await getAllSeasons();
      setSeasons(data);
    } catch (error: any) {
      console.error("Napaka pri nalaganju sezon:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Ni mogoče naložiti sezon"
      });
    } finally {
      setLoading(false);
    }
  }

  function handleAdd() {
    setSelectedSeason(null);
    setFormData({
      name: "",
      start_date: "",
      end_date: ""
    });
    setDialogOpen(true);
  }

  function handleEdit(season: Season) {
    setSelectedSeason(season);
    setFormData({
      name: season.name,
      start_date: season.start_date,
      end_date: season.end_date
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.name || !formData.start_date || !formData.end_date) {
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Vsa polja so obvezna"
      });
      return;
    }

    try {
      setLoading(true);

      if (selectedSeason) {
        await updateSeason(selectedSeason.id, formData);
        toast({
          title: "Uspešno",
          description: "Sezona uspešno posodobljena"
        });
      } else {
        // First season created should be active by default
        const isFirstSeason = seasons.length === 0;
        await createSeason({
          ...formData,
          is_active: isFirstSeason
        });
        toast({
          title: "Uspešno",
          description: `Sezona uspešno ustvarjena${isFirstSeason ? " in aktivirana" : ""}`
        });
      }

      setDialogOpen(false);
      loadSeasons();
    } catch (error: any) {
      console.error("Napaka pri shranjevanju sezone:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Napaka pri shranjevanju sezone"
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSetActive(seasonId: string) {
    try {
      setLoading(true);
      await setActiveSeason(seasonId);
      toast({
        title: "Uspešno",
        description: "Aktivna sezona je bila spremenjena"
      });
      loadSeasons();
    } catch (error: any) {
      console.error("Napaka pri aktiviranju sezone:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Napaka pri aktiviranju sezone"
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(seasonId: string) {
    if (!confirm("Ali ste prepričani, da želite izbrisati to sezono?")) return;

    try {
      setLoading(true);
      await deleteSeason(seasonId);
      toast({
        title: "Uspešno",
        description: "Sezona uspešno izbrisana"
      });
      loadSeasons();
    } catch (error: any) {
      console.error("Napaka pri brisanju sezone:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Napaka pri brisanju sezone"
      });
    } finally {
      setLoading(false);
    }
  }

  const activeSeason = seasons.find((s) => s.is_active);

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <AppLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Sezone</h2>
              <p className="text-muted-foreground">
                Upravljanje sezon in aktiviranje trenutne sezone
              </p>
            </div>
            <Button onClick={handleAdd} style={{ backgroundColor: "#3b82f6", backgroundImage: "none" }}>
              <Plus className="h-4 w-4 mr-2" />
              Dodaj sezono
            </Button>
          </div>

          {!activeSeason && seasons.length > 0 &&
          <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Ni aktivne sezone! Aktivirajte eno od spodnjih sezon.
              </AlertDescription>
            </Alert>
          }

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Seznam sezon ({seasons.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading && seasons.length === 0 ?
              <div className="text-center py-8 text-muted-foreground">Nalagam...</div> :
              seasons.length === 0 ?
              <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Ni sezon</p>
                  <p className="text-sm mt-2">Dodajte prvo sezono</p>
                </div> :

              <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Naziv</TableHead>
                        <TableHead>Datum začetka</TableHead>
                        <TableHead>Datum konca</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Akcije</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {seasons.map((season) =>
                    <TableRow key={season.id}>
                          <TableCell className="font-medium">{season.name}</TableCell>
                          <TableCell>
                            {new Date(season.start_date).toLocaleDateString("sl-SI")}
                          </TableCell>
                          <TableCell>
                            {new Date(season.end_date).toLocaleDateString("sl-SI")}
                          </TableCell>
                          <TableCell>
                            {season.is_active ?
                        <Badge className="bg-green-600">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Aktivna
                              </Badge> :

                        <Badge variant="secondary">Neaktivna</Badge>
                        }
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              {!season.is_active &&
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleSetActive(season.id)}
                            disabled={loading}>
                            
                                  <CheckCircle2 className="h-4 w-4 mr-1" />
                                  Aktiviraj
                                </Button>
                          }
                              <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(season)}
                            disabled={loading}>
                            
                                <Edit className="h-4 w-4 mr-1" />
                                Uredi
                              </Button>
                              <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(season.id)}
                            disabled={loading}>
                            
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
            <DialogContent className="max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>
                  {selectedSeason ? "Uredi sezono" : "Dodaj sezono"}
                </DialogTitle>
              </DialogHeader>

              <ScrollArea className="max-h-[60vh] pr-4">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">
                      Naziv sezone <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="name"
                      placeholder="npr. 2026/2027"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required />
                    
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="start_date">
                      Datum začetka <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      required />
                    
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="end_date">
                      Datum konca <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="end_date"
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      required />
                    
                  </div>

                  <DialogFooter className="mt-6">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDialogOpen(false)}
                      disabled={loading}>
                      
                      Prekliči
                    </Button>
                    <Button type="submit" disabled={loading}>
                      {loading ? "Shranjujem..." : selectedSeason ? "Posodobi" : "Dodaj"}
                    </Button>
                  </DialogFooter>
                </form>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </div>
      </AppLayout>
    </ProtectedRoute>);

}