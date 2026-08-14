import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Settings, User, Lock, Mail } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function SettingsPage() {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();

    if (!newPassword || !confirmPassword) {
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Vnesite novo geslo in potrditev",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Gesli se ne ujemata",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Geslo mora biti dolgo vsaj 6 znakov",
      });
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast({
        title: "Uspešno",
        description: "Geslo je bilo uspešno spremenjeno",
      });

      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      console.error("Password change error:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Napaka pri spreminjanju gesla",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="space-y-6 max-w-4xl">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Nastavitve</h2>
            <p className="text-muted-foreground">Upravljajte svoj račun in nastavitve</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Podatki o računu
              </CardTitle>
              <CardDescription>Informacije o vašem uporabniškem računu</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  E-pošta
                </Label>
                <Input value={user?.email || ""} disabled />
              </div>
              <div className="space-y-2">
                <Label>Vloga</Label>
                <Input
                  value={userRole === "admin" ? "Administrator" : "Trener"}
                  disabled
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Spremeni geslo
              </CardTitle>
              <CardDescription>
                Spremenite geslo za svoj račun. Novo geslo mora biti dolgo vsaj 6 znakov.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">Novo geslo</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={loading}
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Potrdi novo geslo</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                    minLength={6}
                  />
                </div>
                <Button type="submit" disabled={loading}>
                  {loading ? "Shranjujem..." : "Spremeni geslo"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Separator />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                O aplikaciji
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                <strong>Odbojkarski klub Lubnik Škofja Loka</strong>
              </p>
              <p>Aplikacija za upravljanje kluba - Različica 1.0</p>
              <p>© 2026 OK Lubnik</p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}