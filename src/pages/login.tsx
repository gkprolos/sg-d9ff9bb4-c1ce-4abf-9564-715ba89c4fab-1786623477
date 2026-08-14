import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { LogIn } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { user, signIn, loading } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!email || !password) {
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Vpišite e-pošto in geslo",
      });
      return;
    }

    try {
      setSubmitting(true);
      await signIn(email, password);
      toast({
        title: "Uspešna prijava",
        description: "Dobrodošli!",
      });
      router.push("/dashboard");
    } catch (error: any) {
      console.error("Login error:", error);
      toast({
        variant: "destructive",
        title: "Napaka pri prijavi",
        description: error.message || "Napačna e-pošta ali geslo",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Nalagam...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4">
            <img 
              src="/LOGO-2015-C_B.gif" 
              alt="Odbojkarski klub Lubnik" 
              className="h-24 w-auto mx-auto"
            />
          </div>
          <CardTitle className="text-2xl font-bold">Odbojkarski klub Lubnik Škofja Loka</CardTitle>
          <CardDescription>Prijavite se v svoj račun</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-pošta</Label>
              <Input
                id="email"
                type="email"
                placeholder="ime@primer.si"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Geslo</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={submitting}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              <LogIn className="h-4 w-4 mr-2" />
              {submitting ? "Prijavljam..." : "Prijava"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}