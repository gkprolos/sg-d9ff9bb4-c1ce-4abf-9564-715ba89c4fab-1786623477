import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Lock } from "lucide-react";

export default function Settings() {
  const router = useRouter();
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
  }, [user, router]);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();

    try {
      setLoading(true);

      // Validate passwords match
      if (newPassword !== confirmPassword) {
        toast({
          variant: "destructive",
          title: "Napaka",
          description: "Gesli se ne ujemata"
        });
        return;
      }

      // Validate password length
      if (newPassword.length < 6) {
        toast({
          variant: "destructive",
          title: "Napaka",
          description: "Geslo mora biti dolgo najmanj 6 znakov"
        });
        return;
      }

      // Update password
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast({
        title: "Uspešno",
        description: "Geslo uspešno spremenjeno"
      });

      // Clear form
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      console.error("Napaka pri spreminjanju gesla:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Napaka pri spreminjanju gesla"
      });
    } finally {
      setLoading(false);
    }
  }

  if (!user) {
    return null;
  }

  return (
    <AppLayout>
      <div className="container mx-auto py-6 px-4 max-w-4xl">
        <div className="flex items-center gap-2 mb-6">
          <h1 className="text-3xl font-bold">Nastavitve uporabnika</h1>
        </div>

        <div className="space-y-6">
          {/* User Info */}
          <Card>
            <CardHeader>
              <CardTitle>Informacije o uporabniku</CardTitle>
              <CardDescription>
                Vaš trenutni uporabniški račun
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={user?.email || ""}
                  disabled
                  className="bg-muted" />
                
              </div>
              <div className="space-y-2">
                <Label>Vloga</Label>
                <Input
                  type="text"
                  value={userRole === "admin" ? "Administrator" : "Trener"}
                  disabled
                  className="bg-muted" />
                
              </div>
            </CardContent>
          </Card>

          {/* Change Password */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                <CardTitle>Spremeni geslo</CardTitle>
              </div>
              <CardDescription>
                Posodobite svoje geslo za prijavo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new_password">
                    Novo Geslo <span className="text-red-500">*</span>
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="new_password"
                      type={showNewPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={6} />
                    
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowNewPassword(!showNewPassword)}>
                      
                      {showNewPassword ? "Skrij" : "Prikaži"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Geslo mora biti dolgo najmanj 6 znakov
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm_password">
                    Potrdi Novo Geslo <span className="text-red-500">*</span>
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="confirm_password"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6} />
                    
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                      
                      {showConfirmPassword ? "Skrij" : "Prikaži"}
                    </Button>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={loading} style={{ backgroundColor: "#65a30d", backgroundImage: "none" }}>Spremeni geslo











                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>);

}