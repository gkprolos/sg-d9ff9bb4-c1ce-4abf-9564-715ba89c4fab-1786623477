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
import { UserCircle, Plus, Edit, Trash2, Upload, Download, Users } from "lucide-react";
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
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  emergency_contact: string | null;
  medical_notes: string | null;
  is_active: boolean;
  guardian1_name: string | null;
  guardian1_email: string | null;
  guardian1_phone: string | null;
  guardian2_name: string | null;
  guardian2_email: string | null;
  guardian2_phone: string | null;
  joined_date: string | null;
  left_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export default function PlayersPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState<Player[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
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
  const [searchQuery, setSearchQuery] = useState("");

  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
    date_of_birth: "",
    gender: "male" as "male" | "female",
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

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredPlayers(players);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = players.filter(
      (player) =>
        player.first_name.toLowerCase().includes(query) ||
        player.last_name.toLowerCase().includes(query)
    );
    setFilteredPlayers(filtered);
  }, [searchQuery, players]);

  async function loadPlayers() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("players")
        .select("*")
        .order("last_name");

      if (error) throw error;
      setPlayers(data || []);
      setFilteredPlayers(data || []);
    } catch (error: any) {
      console.error("Napaka pri nalaganju igralcev:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Napaka pri nalaganju igralcev",
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

  function handleEditPlayer(player: Player) {
    setSelectedPlayer(player);
    setFirstName(player.first_name);
    setLastName(player.last_name);
    setDateOfBirth(player.date_of_birth || "");
    setGender(player.gender || "male");
    setEmail(player.email || "");
    setPhone(player.phone || "");
    setAddress(player.address || "");
    setEmergencyContact(player.emergency_contact || "");
    setMedicalNotes(player.medical_notes || "");
    setIsActive(player.is_active);
    
    // Guardian 1 fields
    setGuardian1Name(player.guardian1_name || "");
    setGuardian1Email(player.guardian1_email || "");
    setGuardian1Phone(player.guardian1_phone || "");
    
    // Guardian 2 fields
    setGuardian2Name(player.guardian2_name || "");
    setGuardian2Email(player.guardian2_email || "");
    setGuardian2Phone(player.guardian2_phone || "");
    
    setDialogOpen(true);
  }

  async function handleSubmit() {
    if (!firstName.trim() || !lastName.trim()) {
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Ime in priimek sta obvezna",
      });
      return;
    }

    try {
      const playerData = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        date_of_birth: dateOfBirth || null,
        gender,
        email: email.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        emergency_contact: emergencyContact.trim() || null,
        medical_notes: medicalNotes.trim() || null,
        is_active: isActive,
        guardian1_name: guardian1Name.trim() || null,
        guardian1_email: guardian1Email.trim() || null,
        guardian1_phone: guardian1Phone.trim() || null,
        guardian2_name: guardian2Name.trim() || null,
        guardian2_email: guardian2Email.trim() || null,
        guardian2_phone: guardian2Phone.trim() || null,
      };

      if (selectedPlayer) {
        const { error } = await supabase
          .from("players")
          .update(playerData)
          .eq("id", selectedPlayer.id);

        if (error) throw error;

        toast({
          title: "Uspešno",
          description: "Igralec posodobljen",
        });
      } else {
        const { error } = await supabase.from("players").insert([playerData]);

        if (error) throw error;

        toast({
          title: "Uspešno",
          description: "Igralec dodan",
        });
      }

      setDialogOpen(false);
      resetForm();
      loadPlayers();
    } catch (error: any) {
      console.error("Napaka pri shranjevanju:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Napaka pri shranjevanju igralca",
      });
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
      const { data, error } = await supabase
        .from("players")
        .delete()
        .eq("id", playerToDelete.id);

      console.log("DELETE response:", { data, error });

      if (error) {
        console.error("DELETE error details:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        throw error;
      }

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
        title: "Napaka pri brisanju",
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
      let skippedCount = 0;

      for (const row of importData.rows) {
        try {
          const firstName = row[importMapping['first_name']]?.toString().trim() || '';
          const lastName = row[importMapping['last_name']]?.toString().trim() || '';

          // Check if player already exists (by first_name + last_name)
          const { data: existingPlayers, error: checkError } = await supabase
            .from("players")
            .select("id")
            .eq("first_name", firstName)
            .eq("last_name", lastName)
            .limit(1);

          if (checkError) throw checkError;

          if (existingPlayers && existingPlayers.length > 0) {
            console.log(`Preskok: ${firstName} ${lastName} že obstaja`);
            skippedCount++;
            continue; // Skip this player - already exists
          }

          // Parse date of birth - handle multiple formats, default to '1800-01-01' if empty
          let dateOfBirth: string = '1800-01-01'; // Default value for empty/null
          const dobRaw = row[importMapping['date_of_birth']]?.toString().trim();
          
          if (dobRaw) {
            // If Excel serial number (e.g., 44317), convert to YYYY-MM-DD
            if (/^\d+(\.\d+)?$/.test(dobRaw)) {
              const excelEpoch = new Date(1899, 11, 30);
              const daysOffset = parseFloat(dobRaw);
              const date = new Date(excelEpoch.getTime() + daysOffset * 86400000);
              dateOfBirth = date.toISOString().split('T')[0];
            }
            // If DD.MM.YYYY or DD/MM/YYYY format, convert to YYYY-MM-DD
            else if (/^\d{2}[./]\d{2}[./]\d{4}$/.test(dobRaw)) {
              const parts = dobRaw.split(/[./]/);
              dateOfBirth = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
            // Otherwise assume it's already YYYY-MM-DD
            else {
              dateOfBirth = dobRaw;
            }
          }
          // If dobRaw is empty/null, dateOfBirth stays '1800-01-01'

          const playerData = {
            first_name: firstName,
            last_name: lastName,
            date_of_birth: dateOfBirth,
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

      const message = skippedCount > 0 
        ? `Uspešno: ${successCount}, Neuspešno: ${failCount}, Preskočeno: ${skippedCount}`
        : `Uspešno: ${successCount}, Neuspešno: ${failCount}`;

      toast({
        title: "Uvoz zaključen",
        description: message,
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

  function resetForm() {
    setSelectedPlayer(null);
    setFirstName("");
    setLastName("");
    setDateOfBirth("");
    setGender("male");
    setEmail("");
    setPhone("");
    setAddress("");
    setEmergencyContact("");
    setMedicalNotes("");
    setIsActive(true);
    
    // Guardian fields
    setGuardian1Name("");
    setGuardian1Email("");
    setGuardian1Phone("");
    setGuardian2Name("");
    setGuardian2Email("");
    setGuardian2Phone("");
  }

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <AppLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              <h1 className="text-3xl font-bold">Igralci</h1>
            </div>
            <div className="flex gap-2 items-center flex-1 max-w-md">
              <Input
                placeholder="Išči po imenu ali priimku..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
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
                      <TableRow className="text-xs">
                        <TableHead className="w-[120px]">Ime</TableHead>
                        <TableHead className="w-[120px]">Priimek</TableHead>
                        <TableHead className="w-[110px]">Datum rojstva</TableHead>
                        <TableHead className="w-[60px]">Spol</TableHead>
                        <TableHead className="w-[120px]">Kraj</TableHead>
                        <TableHead className="w-[110px]">Telefon</TableHead>
                        <TableHead className="w-[150px]">Selekcije</TableHead>
                        <TableHead className="w-[90px]">Status</TableHead>
                        <TableHead className="text-right w-[160px]">Akcije</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPlayers.map((player) => (
                        <TableRow key={player.id} className="text-sm">
                          <TableCell className="font-medium py-2">{player.first_name}</TableCell>
                          <TableCell className="py-2">{player.last_name}</TableCell>
                          <TableCell className="py-2">
                            {player.date_of_birth
                              ? new Date(player.date_of_birth).toLocaleDateString("sl-SI")
                              : "N/A"}
                          </TableCell>
                          <TableCell className="py-2">{player.gender || "N/A"}</TableCell>
                          <TableCell className="py-2">{player.city || "N/A"}</TableCell>
                          <TableCell className="py-2">{player.phone || "N/A"}</TableCell>
                          <TableCell className="py-2">
                            <div className="flex flex-wrap gap-1">
                              {player.teams && player.teams.length > 0 ? (
                                player.teams.map((tp: any, idx: number) => (
                                  <Badge key={idx} variant="secondary" className="text-xs">
                                    {tp.teams.short_name || tp.teams.name}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-2">
                            <Badge variant={player.is_active ? "default" : "secondary"} className="text-xs">
                              {player.is_active ? "Aktiven" : "Neaktiven"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right py-2">
                            <div className="flex gap-1 justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditPlayer(player)}
                                disabled={loading}
                                className="h-7 text-xs"
                              >
                                <Edit className="h-3 w-3 mr-1" />
                                Uredi
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDeleteClick(player)}
                                disabled={loading}
                                className="h-7 text-xs"
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
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
            <DialogContent className="max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {selectedPlayer ? "Uredi igralca" : "Dodaj igralca"}
                </DialogTitle>
              </DialogHeader>

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

                <div className="grid gap-2">
                  <Label htmlFor="medicalNotes">Zdravstvene opombe</Label>
                  <Textarea
                    id="medicalNotes"
                    value={formData.medicalNotes}
                    onChange={(e) => setFormData({ ...formData, medicalNotes: e.target.value })}
                    placeholder="Zdravstvene opombe..."
                  />
                </div>

                {/* Guardian 1 */}
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="font-semibold">Podatki starša 1</h3>
                  <div className="grid gap-2">
                    <Label htmlFor="guardian1Name">Ime in priimek</Label>
                    <Input
                      id="guardian1Name"
                      value={formData.guardian1Name}
                      onChange={(e) => setFormData({ ...formData, guardian1Name: e.target.value })}
                      placeholder="Ime in priimek starša 1"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="guardian1Email">Email</Label>
                    <Input
                      id="guardian1Email"
                      type="email"
                      value={formData.guardian1Email}
                      onChange={(e) => setFormData({ ...formData, guardian1Email: e.target.value })}
                      placeholder="starš1@email.com"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="guardian1Phone">Telefon</Label>
                    <Input
                      id="guardian1Phone"
                      value={formData.guardian1Phone}
                      onChange={(e) => setFormData({ ...formData, guardian1Phone: e.target.value })}
                      placeholder="+386 ..."
                    />
                  </div>
                </div>

                {/* Guardian 2 */}
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="font-semibold">Podatki starša 2</h3>
                  <div className="grid gap-2">
                    <Label htmlFor="guardian2Name">Ime in priimek</Label>
                    <Input
                      id="guardian2Name"
                      value={formData.guardian2Name}
                      onChange={(e) => setFormData({ ...formData, guardian2Name: e.target.value })}
                      placeholder="Ime in priimek starša 2"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="guardian2Email">Email</Label>
                    <Input
                      id="guardian2Email"
                      type="email"
                      value={formData.guardian2Email}
                      onChange={(e) => setFormData({ ...formData, guardian2Email: e.target.value })}
                      placeholder="starš2@email.com"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="guardian2Phone">Telefon</Label>
                    <Input
                      id="guardian2Phone"
                      value={formData.guardian2Phone}
                      onChange={(e) => setFormData({ ...formData, guardian2Phone: e.target.value })}
                      placeholder="+386 ..."
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="emergencyContact">Kontakt za nujne primere</Label>
                  <Input
                    id="emergencyContact"
                    value={formData.emergencyContact}
                    onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                    placeholder="+386 ..."
                  />
                </div>

                <DialogFooter className="mt-6 sticky bottom-0 bg-background pt-4 border-t">
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
            </DialogContent>
          </Dialog>

          <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
            <DialogContent className="max-w-4xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Uvoz igralcev iz Excel</DialogTitle>
              </DialogHeader>

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
                        <ScrollArea className="h-[200px]">
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
                        </ScrollArea>
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

              <DialogFooter className="mt-6 sticky bottom-0 bg-background pt-4 border-t">
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