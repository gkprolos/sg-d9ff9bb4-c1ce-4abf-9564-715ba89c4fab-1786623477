import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Mail, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function ParentLogin() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  async function handleSendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const trimmedEmail = email.trim().toLowerCase();

      // Send magic link via Supabase
      const { error: magicLinkError } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          emailRedirectTo: "https://klub.oklubnik.si/my-children",
          shouldCreateUser: true, // Allow parent signup via magic link
        },
      });

      if (magicLinkError) {
        throw magicLinkError;
      }

      setEmailSent(true);
      toast({
        title: "Povezava poslana",
        description: `Preverite email ${trimmedEmail} in kliknite povezavo za prijavo.`,
      });
    } catch (err: any) {
      console.error("Magic link error:", err);
      
      // User-friendly error messages
      let errorMessage = "Napaka pri pošiljanju povezave";
      
      if (err.message?.includes("Email not allowed")) {
        errorMessage = "Ta email ni registriran kot skrbnik. Obrnite se na administratorja.";
      } else if (err.message?.includes("User not found")) {
        errorMessage = "Ta email ni registriran. Obrnite se na administratorja.";
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Prijava za Starše</CardTitle>
          <CardDescription className="text-center">
            {!emailSent ? (
              <p className="text-sm text-muted-foreground">
                Vnesite e-poštni naslov, ki je vnesen kot skrbnik pri vašem otroku
              </p>
            ) : (
              <div className="flex items-center gap-2 text-sm text-green-600 justify-center">
                <CheckCircle2 className="w-4 h-4" />
                <span>Povezava za prijavo poslana!</span>
              </div>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!emailSent ? (
            <form onSubmit={handleSendMagicLink} className="space-y-6">
              <div>
                <Label htmlFor="email">E-poštni naslov</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="vas.email@example.com"
                    className="pl-10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    autoComplete="email"
                  />
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button 
                type="submit" 
                className="w-full bg-lime-500 hover:bg-lime-600 text-white" 
                disabled={loading}
              >
                {loading ? "Pošiljam..." : "Pošlji povezavo za prijavo"}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                Povezava bo poslana na vaš email in bo veljavna 60 minut
              </p>
            </form>
          ) : (
            <div className="space-y-6">
              <Alert>
                <Mail className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium">Preverite vašo e-pošto!</p>
                    <p className="text-sm">
                      Povezavo za prijavo smo poslali na <strong>{email}</strong>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Kliknite povezavo v emailu za avtomatično prijavo. Povezava je veljavna 60 minut.
                    </p>
                  </div>
                </AlertDescription>
              </Alert>

              <Button
                variant="outline"
                onClick={() => {
                  setEmailSent(false);
                  setEmail("");
                  setError("");
                }}
                className="w-full"
              >
                Nazaj na vnos emaila
              </Button>
            </div>
          )}

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <Link href="/login" className="hover:text-primary underline">
              ← Nazaj na glavno prijavo
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}