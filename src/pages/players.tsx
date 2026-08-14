import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { useState, useEffect, useRef } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { UserCircle, Plus, Edit, Trash2, Upload, Download } from "lucide-react";
import {
  parseCSV,
  parseXLSX,
  validatePlayerRow,
  downloadXLSX,
  type ParsedData,
  type ImportRow,
  type ValidationError,
} from "@/lib/excelUtils";

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  gender: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  is_active: boolean;
  teams?: Array<{ teams: { name: string; short_name: string | null } }>;
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [playerToDelete, setPlayerToDelete] = useState<Player | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importData, setImportData] = useState<ParsedData | null>(null);
  const [importErrors, setImportErrors] = useState<ValidationError[]>([]);
  const [importMapping, setImportMapping] = useState<{ [key: string]: string }>({});
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    date_of_birth: "",
    gender: "",
    address: "",
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
        .select(`
          *,
          teams:team_players(
            teams(name, short_name)
          )
        `)
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
      gender: "",
      address: "",
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
      gender: player.gender || "",
      address: player.address || "",
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
        gender: formData.gender || null,
        address: formData.address || null,
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

  function handleDeleteClick(player: Player) {
    setPlayerToDelete(player);
    setDeleteDialogOpen(true);
  }

  async function handleConfirmDelete() {
    if (!playerToDelete) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from("players")
        .delete()
        .eq("id", playerToDelete.id);

      if (error) throw error;
      toast({
        title: "Uspešno",
        description: "Igralec uspešno izbrisan",
      });
      
      setDeleteDialogOpen(false);
      setPlayerToDelete(null);
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

  function handleImportClick() {
    setImportDialogOpen(true);
    setImportData(null);
    setImportErrors([]);
    setImportMapping({});
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      // Parse XLSX file
      parseXLSX(file)
        .then((parsed) => {
          if (parsed.headers.length === 0) {
            toast({
              variant: "destructive",
              title: "Napaka",
              description: "Datoteka je prazna ali neveljavna",
            });
            return;
          }

          setImportData(parsed);
          
          // Auto-map common column names
          const mapping: { [key: string]: string } = {};
          parsed.headers.forEach(header => {
            const lower = header.toLowerCase();
            if (lower.includes('ime') && !lower.includes('priimek')) mapping['first_name'] = header;
            if (lower.includes('priimek')) mapping['last_name'] = header;
            if (lower.includes('datum') || lower.includes('birth')) mapping['date_of_birth'] = header;
            if (lower.includes('spol') || lower.includes('gender')) mapping['gender'] = header;
            if (lower.includes('naslov') || lower.includes('address')) mapping['address'] = header;
            if (lower.includes('kraj') || lower.includes('city')) mapping['city'] = header;
            if (lower.includes('telefon') || lower.includes('phone')) mapping['phone'] = header;
          });
          setImportMapping(mapping);

          toast({
            title: "Datoteka naložena",
            description: `Prebrano ${parsed.rows.length} vrstic`,
          });
        })
        .catch((error: any) => {
          console.error("Napaka pri branju XLSX datoteke:", error);
          toast({
            variant: "destructive",
            title: "Napaka",
            description: error.message || "Napaka pri branju XLSX datoteke",
          });
        });
    } else if (fileExtension === 'csv') {
      // Parse CSV file
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const parsed = parseCSV(content);
          
          if (parsed.headers.length === 0) {
            toast({
              variant: "destructive",
              title: "Napaka",
              description: "Datoteka je prazna ali neveljavna",
            });
            return;
          }

          setImportData(parsed);
          
          // Auto-map common column names
          const mapping: { [key: string]: string } = {};
          parsed.headers.forEach(header => {
            const lower = header.toLowerCase();
            if (lower.includes('ime') && !lower.includes('priimek')) mapping['first_name'] = header;
            if (lower.includes('priimek')) mapping['last_name'] = header;
            if (lower.includes('datum') || lower.includes('birth')) mapping['date_of_birth'] = header;
            if (lower.includes('spol') || lower.includes('gender')) mapping['gender'] = header;
            if (lower.includes('naslov') || lower.includes('address')) mapping['address'] = header;
            if (lower.includes('kraj') || lower.includes('city')) mapping['city'] = header;
            if (lower.includes('telefon') || lower.includes('phone')) mapping['phone'] = header;
          });
          setImportMapping(mapping);

          toast({
            title: "Datoteka naložena",
            description: `Prebrano ${parsed.rows.length} vrstic`,
          });
        } catch (error: any) {
          console.error("Napaka pri branju CSV datoteke:", error);
          toast({
            variant: "destructive",
            title: "Napaka",
            description: error.message || "Napaka pri branju CSV datoteke",
          });
        }
      };
      reader.readAsText(file);
    } else {
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Podprte so samo XLSX in CSV datoteke",
      });
    }
  }

  async function handleImport() {
    if (!importData) return;

    // Validate all rows
    const errors: ValidationError[] = [];
    importData.rows.forEach((row, index) => {
      const rowErrors = validatePlayerRow(row, index, importMapping);
      errors.push(...rowErrors);
    });

    if (errors.length > 0) {
      setImportErrors(errors);
      toast({
        variant: "destructive",
        title: "Validacijske napake",
        description: `Najdenih ${errors.length} napak. Prosim popravite podatke.`,
      });
      return;
    }

    try {
      setImporting(true);
      let successCount = 0;
      let failCount = 0;

      for (const row of importData.rows) {
        try {
          const playerData = {
            first_name: row[importMapping['first_name']]?.toString().trim() || '',
            last_name: row[importMapping['last_name']]?.toString().trim() || '',
            date_of_birth: row[importMapping['date_of_birth']]?.toString().trim() || null,
            gender: row[importMapping['gender']]?.toString().toUpperCase().trim() || null,
            address: row[importMapping['address']]?.toString().trim() || null,
            city: row[importMapping['city']]?.toString().trim() || null,
            phone: row[importMapping['phone']]?.toString().trim() || null,
            is_active: true,
          };

          const { error } = await supabase
            .from("players")
            .insert([playerData]);

          if (error) throw error;
          successCount++;
        } catch (error) {
          console.error("Napaka pri uvozu vrstice:", error);
          failCount++;
        }
      }

      toast({
        title: "Uvoz zaključen",
        description: `Uspešno: ${successCount}, Neuspešno: ${failCount}`,
      });

      setImportDialogOpen(false);
      loadPlayers();
    } catch (error: any) {
      console.error("Napaka pri uvozu:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Napaka pri uvozu",
      });
    } finally {
      setImporting(false);
    }
  }

  function handleDownloadTemplate() {
    downloadXLSX('vzorcna_predloga_igralci.xlsx');
    toast({
      title: "Predloga prenesena",
      description: "Odprite datoteko v Excelu in izpolnite podatke",
    });
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
              <p className="text-muted-foreground">Upravljanje igralcev</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleImportClick}>
                <Upload className="h-4 w-4 mr-2" />
                Uvozi iz Excel
              </Button>
              <Button onClick={handleAdd}>
                <Plus className="h-4 w-4 mr-2" />
                Dodaj igralca
              </Button>
            </div>
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
                        <TableHead>Igralec</TableHead>
                        <TableHead>Selekcije</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Akcije</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {players.map((player) => (
                        <TableRow key={player.id}>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <span className="font-medium">
                                {player.first_name} {player.last_name}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                {player.date_of_birth && (
                                  <>
                                    {new Date(player.date_of_birth).toLocaleDateString("sl-SI")}
                                    {player.city && <> • {player.city}</>}
                                  </>
                                )}
                                {!player.date_of_birth && player.city && player.city}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {player.teams && player.teams.length > 0 ? (
                                player.teams.map((tp: any, idx: number) => (
                                  <Badge key={idx} variant="secondary" className="text-xs">
                                    {tp.teams.short_name || tp.teams.name}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-xs text-muted-foreground">Ni selekcije</span>
                              )}
                            </div>
                          </TableCell>
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
                                onClick={() => handleDeleteClick(player)}
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
                    <Label htmlFor="gender">Spol</Label>
                    <Select
                      value={formData.gender}
                      onValueChange={(value) => setFormData({ ...formData, gender: value })}
                    >
                      <SelectTrigger id="gender">
                        <SelectValue placeholder="Izberi spol" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="M">M (Moški)</SelectItem>
                        <SelectItem value="F">F (Ženski)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Naslov</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
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

          <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>Uvoz igralcev iz Excel</DialogTitle>
              </DialogHeader>

              <ScrollArea className="max-h-[70vh] pr-4">
                <div className="space-y-4">
                  {!importData ? (
                    <>
                      <div className="space-y-2">
                        <Label>1. Prenesite vzorčno predlogo</Label>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleDownloadTemplate}
                          className="w-full"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Prenesi vzorčno predlogo (XLSX)
                        </Button>
                        <p className="text-sm text-muted-foreground">
                          Odprite predlogo v Excelu, izpolnite podatke in shranite.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>2. Naložite datoteko</Label>
                        <Input
                          ref={fileInputRef}
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          onChange={handleFileSelect}
                        />
                        <p className="text-sm text-muted-foreground">
                          Podprte so XLSX in CSV datoteke. Obvezna polja: Ime, Priimek
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label>Predogled podatkov ({importData.rows.length} vrstic)</Label>
                        <div className="border rounded-lg overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                {importData.headers.slice(0, 5).map((header) => (
                                  <TableHead key={header}>{header}</TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {importData.rows.slice(0, 3).map((row, index) => (
                                <TableRow key={index}>
                                  {importData.headers.slice(0, 5).map((header) => (
                                    <TableCell key={header}>
                                      {row[header]?.toString() || '-'}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>

                      {importErrors.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-destructive">
                            Validacijske napake ({importErrors.length})
                          </Label>
                          <ScrollArea className="h-32 border rounded-lg p-2">
                            {importErrors.map((error, index) => (
                              <div key={index} className="text-sm text-destructive mb-1">
                                Vrstica {error.row}, {error.field}: {error.message}
                              </div>
                            ))}
                          </ScrollArea>
                        </div>
                      )}

                      <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
                        <div className="flex-1">
                          <p className="text-sm font-medium">Pripravljen na uvoz</p>
                          <p className="text-xs text-muted-foreground">
                            {importData.rows.length} igralcev bo dodanih
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </ScrollArea>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setImportDialogOpen(false);
                    setImportData(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  disabled={importing}
                >
                  Prekliči
                </Button>
                {importData && (
                  <Button
                    onClick={handleImport}
                    disabled={importing || importErrors.length > 0}
                  >
                    {importing ? "Uvažam..." : `Uvozi ${importData.rows.length} igralcev`}
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Potrditev brisanja</AlertDialogTitle>
                <AlertDialogDescription>
                  Nameravaš izbrisati igralca <strong>{playerToDelete?.first_name} {playerToDelete?.last_name}</strong>. Izbrišem?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Prekliči</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleConfirmDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Izbriši
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}