import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { UserCircle, Plus, Edit, Trash2 } from "lucide-react";

interface Coach {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  hourly_rate: number | null;
  km_rate: number | null;
}

export default function CoachesPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCoach, setSelectedCoach] = useState<Coach | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [coachToDelete, setCoachToDelete] = useState<Coach | null>(null);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    phone: "",
    hourly_rate: "",
    km_rate: "",
  });

  useEffect(() => {
    loadCoaches();
  }, []);

  async function loadCoaches() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, hourly_rate, km_rate")
        .order("full_name", { ascending: true });

      if (error) throw error;
      
      // Split full_name into first_name and last_name for display
      const coaches = (data || []).map(coach => {
        const nameParts = coach.full_name?.split(' ') || ['', ''];
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        return {
          ...coach,
          first_name: firstName,
          last_name: lastName,
        };
      });
      
      setCoaches(coaches);
    } catch (error: any) {
      console.error("Napaka pri nalaganju trenerjev:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Ni mogoče naložiti trenerjev",
      });
    } finally {
      setLoading(false);
    }
  }

  function handleAdd() {
    setSelectedCoach(null);
    setFormData({
      first_name: "",
      last_name: "",
      email: "",
      password: "",
      phone: "",
      hourly_rate: "",
      km_rate: "",
    });
    setDialogOpen(true);
  }

  function handleEdit(coach: Coach) {
    setSelectedCoach(coach);
    setFormData({
      first_name: coach.first_name,
      last_name: coach.last_name,
      email: coach.email,
      password: "", // Not used for editing, but required by formData type
      phone: coach.phone || "",
      hourly_rate: coach.hourly_rate?.toString() || "",
      km_rate: coach.km_rate?.toString() || "",
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.first_name || !formData.last_name || !formData.email) {
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Ime, priimek in e-pošta so obvezni",
      });
      return;
    }

    // Password required for new coaches
    if (!selectedCoach && !formData.password) {
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Geslo je obvezno za novega trenerja",
      });
      return;
    }

    try {
      setLoading(true);

      const payload = {
        full_name: `${formData.first_name} ${formData.last_name}`.trim(),
        email: formData.email,
        phone: formData.phone || null,
        hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : null,
        km_rate: formData.km_rate ? parseFloat(formData.km_rate) : null,
      };

      if (selectedCoach) {
        // Update existing coach
        const { error } = await supabase
          .from("profiles")
          .update(payload)
          .eq("id", selectedCoach.id);

        if (error) throw error;
        toast({
          title: "Uspešno",
          description: "Trener uspešno posodobljen",
        });
      } else {
        // Create new coach via Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              full_name: `${formData.first_name} ${formData.last_name}`.trim(),
              phone: formData.phone || null,
              hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : null,
              km_rate: formData.km_rate ? parseFloat(formData.km_rate) : null,
            },
          },
        });

        if (authError) throw authError;

        // Update profile with additional data
        if (authData.user) {
          const { error: profileError } = await supabase
            .from("profiles")
            .update(payload)
            .eq("id", authData.user.id);

          if (profileError) throw profileError;
        }

        toast({
          title: "Uspešno",
          description: "Trener uspešno ustvarjen. Poslano je bilo potrditveno e-poštno sporočilo.",
        });
      }

      setDialogOpen(false);
      loadCoaches();
    } catch (error: any) {
      console.error("Napaka pri shranjevanju trenerja:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Napaka pri shranjevanju trenerja",
      });
    } finally {
      setLoading(false);
    }
  }

  function handleDeleteClick(coach: Coach) {
    setCoachToDelete(coach);
    setDeleteDialogOpen(true);
  }

  async function handleConfirmDelete() {
    if (!coachToDelete) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", coachToDelete.id);

      if (error) throw error;
      toast({
        title: "Uspešno",
        description: "Trener uspešno izbrisan",
      });
      
      setDeleteDialogOpen(false);
      setCoachToDelete(null);
      loadCoaches();
    } catch (error: any) {
      console.error("Napaka pri brisanju trenerja:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Napaka pri brisanju trenerja",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    if (!formData.email) {
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "E-poštni naslov je obvezen",
      });
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      toast({
        title: "Uspešno",
        description: `E-poštno sporočilo za ponastavitev gesla poslano na ${formData.email}`,
      });
    } catch (error: any) {
      console.error("Napaka pri pošiljanju emaila:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Napaka pri pošiljanju emaila",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(coachId: string) {
    if (!confirm("Ali ste prepričani, da želite izbrisati tega trenerja?")) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", coachId);

      if (error) throw error;
      toast({
        title: "Uspešno",
        description: "Trener uspešno izbrisan",
      });
      loadCoaches();
    } catch (error: any) {
      console.error("Napaka pri brisanju trenerja:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Napaka pri brisanju trenerja",
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
              <h2 className="text-3xl font-bold tracking-tight">Trenerji</h2>
              <p className="text-muted-foreground">Upravljanje trenerjev kluba</p>
            </div>
            <Button onClick={handleAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Dodaj trenerja
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCircle className="h-5 w-5" />
                Seznam trenerjev ({coaches.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading && coaches.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Nalagam...</div>
              ) : coaches.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <UserCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Ni trenerjev</p>
                  <p className="text-sm mt-2">Dodajte trenerje preko Supabase Dashboard</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ime</TableHead>
                        <TableHead>Priimek</TableHead>
                        <TableHead>E-pošta</TableHead>
                        <TableHead>Telefon</TableHead>
                        <TableHead className="text-right">Vrednost ure (€)</TableHead>
                        <TableHead className="text-right">Vrednost km (€)</TableHead>
                        <TableHead className="text-right">Akcije</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {coaches.map((coach) => (
                        <TableRow key={coach.id}>
                          <TableCell className="font-medium">{coach.first_name}</TableCell>
                          <TableCell>{coach.last_name}</TableCell>
                          <TableCell>{coach.email}</TableCell>
                          <TableCell>{coach.phone || "N/A"}</TableCell>
                          <TableCell className="text-right">
                            {coach.hourly_rate ? `${coach.hourly_rate.toFixed(2)} €` : "N/A"}
                          </TableCell>
                          <TableCell className="text-right">
                            {coach.km_rate ? `${coach.km_rate.toFixed(2)} €` : "N/A"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEdit(coach)}
                                disabled={loading}
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                Uredi
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDeleteClick(coach)}
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
                  {selectedCoach ? "Uredi trenerja" : "Dodaj trenerja"}
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
                        placeholder="Janez"
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
                        placeholder="Novak"
                        value={formData.last_name}
                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">
                      E-pošta <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="ime.priimek@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>

                  {!selectedCoach && (
                    <div className="space-y-2">
                      <Label htmlFor="password">
                        Geslo <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="Minimalno 6 znakov"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required
                        minLength={6}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefon</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+386 ..."
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>

                  {selectedCoach && (
                    <div className="space-y-2">
                      <Label>Geslo</Label>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleResetPassword}
                        disabled={loading}
                        className="w-full"
                      >
                        Ponastavi geslo
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Trener bo prejel e-poštno sporočilo s povezavo za ponastavitev gesla
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="hourly_rate">Vrednost ure (€)</Label>
                      <Input
                        id="hourly_rate"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="npr. 15.00"
                        value={formData.hourly_rate}
                        onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="km_rate">Vrednost kilometra (€)</Label>
                      <Input
                        id="km_rate"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="npr. 0.37"
                        value={formData.km_rate}
                        onChange={(e) => setFormData({ ...formData, km_rate: e.target.value })}
                      />
                    </div>
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
                      {loading ? "Shranjujem..." : selectedCoach ? "Posodobi" : "Dodaj"}
                    </Button>
                  </DialogFooter>
                </form>
              </ScrollArea>
            </DialogContent>
          </Dialog>

          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Potrditev brisanja</AlertDialogTitle>
                <AlertDialogDescription>
                  Nameravaš izbrisati trenerja <strong>{coachToDelete?.first_name} {coachToDelete?.last_name}</strong>. Izbrišem?
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