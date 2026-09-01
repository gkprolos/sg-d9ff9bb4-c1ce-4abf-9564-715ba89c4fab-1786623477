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
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Save, Mail, Server } from "lucide-react";

interface SMTPSettings {
  id?: string;
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password: string;
  smtp_from_email: string;
  smtp_from_name: string;
  smtp_secure: boolean;
  is_active: boolean;
}

export default function SMTPSettings() {
  const router = useRouter();
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [smtpSettings, setSMTPSettings] = useState<SMTPSettings>({
    smtp_host: "",
    smtp_port: 587,
    smtp_username: "",
    smtp_password: "",
    smtp_from_email: "",
    smtp_from_name: "OK Lubnik",
    smtp_secure: false,
    is_active: true
  });
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }

    if (userRole !== "admin") {
      router.push("/dashboard");
      return;
    }

    loadSMTPSettings();
  }, [user, userRole, router]);

  async function loadSMTPSettings() {
    try {
      setLoading(true);
      const { data, error } = await supabase.
      from("smtp_settings").
      select("*").
      eq("is_active", true).
      maybeSingle(); // Use maybeSingle() instead of single() to handle 0 results

      if (error) {
        throw error;
      }

      if (data) {
        setSMTPSettings(data);
      }
    } catch (error: any) {
      console.error("Napaka pri nalaganju SMTP nastavitev:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Napaka pri nalaganju SMTP nastavitev"
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSMTPSettings(e: React.FormEvent) {
    e.preventDefault();

    try {
      setSaving(true);

      // Validate required fields
      if (!smtpSettings.smtp_host || !smtpSettings.smtp_username ||
      !smtpSettings.smtp_password || !smtpSettings.smtp_from_email) {
        toast({
          variant: "destructive",
          title: "Manjkajoči podatki",
          description: "Izpolnite vsa obvezna polja"
        });
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(smtpSettings.smtp_from_email)) {
        toast({
          variant: "destructive",
          title: "Neveljaven email",
          description: "Email naslov mora biti v pravilnem formatu"
        });
        return;
      }

      const settingsData = {
        smtp_host: smtpSettings.smtp_host.trim(),
        smtp_port: smtpSettings.smtp_port,
        smtp_username: smtpSettings.smtp_username.trim(),
        smtp_password: smtpSettings.smtp_password,
        smtp_from_email: smtpSettings.smtp_from_email.trim(),
        smtp_from_name: smtpSettings.smtp_from_name.trim() || "OK Lubnik",
        smtp_secure: smtpSettings.smtp_secure,
        is_active: true,
        updated_by: user?.id
      };

      if (smtpSettings.id) {
        // Update existing
        const { error } = await supabase.
        from("smtp_settings").
        update(settingsData).
        eq("id", smtpSettings.id);

        if (error) throw error;
      } else {
        // Insert new
        const { data, error } = await supabase.
        from("smtp_settings").
        insert([settingsData]).
        select().
        single();

        if (error) throw error;
        if (data) {
          setSMTPSettings(data);
        }
      }

      toast({
        title: "Uspešno",
        description: "SMTP nastavitve shranjene"
      });
    } catch (error: any) {
      console.error("Napaka pri shranjevanju SMTP nastavitev:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Napaka pri shranjevanju"
      });
    } finally {
      setSaving(false);
    }
  }

  if (!user || userRole !== "admin") {
    return null;
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>);

  }

  return (
    <AppLayout>
      <div className="container mx-auto py-6 px-4 max-w-4xl">
        <div className="flex items-center gap-2 mb-6">
          <Mail className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">SMTP Nastavitve</h1>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              <CardTitle>Konfiguracija Email Strežnika</CardTitle>
            </div>
            <CardDescription>
              Nastavitve za pošiljanje email obvestil (OTP kode, sporočila, opozorila)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className="mb-6">
              <Server className="h-4 w-4" />
              <AlertDescription>
                <strong>SMTP Server:</strong> Potrebujete SMTP strežnik za pošiljanje emailov. 
                Priporočamo uporabo Resend, SendGrid, Mailgun ali Gmail SMTP.
              </AlertDescription>
            </Alert>

            <form onSubmit={handleSaveSMTPSettings} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="smtp_host">
                    SMTP Server <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="smtp_host"
                    type="text"
                    placeholder="smtp.gmail.com"
                    value={smtpSettings.smtp_host}
                    onChange={(e) =>
                    setSMTPSettings({ ...smtpSettings, smtp_host: e.target.value })
                    }
                    required />
                  
                </div>

                <div className="space-y-2">
                  <Label htmlFor="smtp_port">
                    SMTP Port <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="smtp_port"
                    type="number"
                    placeholder="587"
                    value={smtpSettings.smtp_port}
                    onChange={(e) =>
                    setSMTPSettings({
                      ...smtpSettings,
                      smtp_port: parseInt(e.target.value) || 587
                    })
                    }
                    required />
                  
                  <p className="text-xs text-muted-foreground">
                    Običajno: 587 (TLS) ali 465 (SSL)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="smtp_username">
                    SMTP Uporabniško Ime <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="smtp_username"
                    type="text"
                    placeholder="username@example.com"
                    value={smtpSettings.smtp_username}
                    onChange={(e) =>
                    setSMTPSettings({ ...smtpSettings, smtp_username: e.target.value })
                    }
                    required />
                  
                </div>

                <div className="space-y-2">
                  <Label htmlFor="smtp_password">
                    SMTP Geslo <span className="text-red-500">*</span>
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="smtp_password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={smtpSettings.smtp_password}
                      onChange={(e) =>
                      setSMTPSettings({ ...smtpSettings, smtp_password: e.target.value })
                      }
                      required />
                    
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPassword(!showPassword)}>
                      
                      {showPassword ? "Skrij" : "Prikaži"}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="smtp_from_email">
                    Pošiljatelj Email <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="smtp_from_email"
                    type="email"
                    placeholder="obvestila@oklubnik.si"
                    value={smtpSettings.smtp_from_email}
                    onChange={(e) =>
                    setSMTPSettings({ ...smtpSettings, smtp_from_email: e.target.value })
                    }
                    required />
                  
                </div>

                <div className="space-y-2">
                  <Label htmlFor="smtp_from_name">Ime Pošiljatelja</Label>
                  <Input
                    id="smtp_from_name"
                    type="text"
                    placeholder="OK Lubnik"
                    value={smtpSettings.smtp_from_name}
                    onChange={(e) =>
                    setSMTPSettings({ ...smtpSettings, smtp_from_name: e.target.value })
                    } />
                  
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-4">
                <Switch
                  id="smtp_secure"
                  checked={smtpSettings.smtp_secure}
                  onCheckedChange={(checked) =>
                  setSMTPSettings({ ...smtpSettings, smtp_secure: checked })
                  } />
                
                <Label htmlFor="smtp_secure" className="cursor-pointer">
                  SSL/TLS Šifriranje (uporabi za port 465)
                </Label>
              </div>

              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={saving} style={{ backgroundColor: "#65a30d", backgroundImage: "none" }}>
                  {saving ?
                  <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Shranjevanje...
                    </> :

                  <>
                      <Save className="mr-2 h-4 w-4" />
                      Shrani SMTP Nastavitve
                    </>
                  }
                </Button>
              </div>
            </form>

            {smtpSettings.id &&
            <Alert className="mt-6">
                <AlertDescription>
                  ✅ SMTP nastavitve so konfigurirane. Aplikacija bo uporabljala te nastavitve za 
                  pošiljanje vseh emailov.
                </AlertDescription>
              </Alert>
            }
          </CardContent>
        </Card>
      </div>
    </AppLayout>);

}