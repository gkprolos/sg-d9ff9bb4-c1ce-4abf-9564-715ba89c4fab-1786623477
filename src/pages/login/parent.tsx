import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, ArrowLeft, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export default function ParentLogin() {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Countdown timer for resend button
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  async function handleSendOTP(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/parent/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Napaka pri pošiljanju kode");
      }

      if (data.success) {
        setStep("code");
        setOtpCode("");
        setCountdown(60);
        toast({
          title: "Koda poslana",
          description: `4-mestna koda je bila poslana na ${email}`,
        });
      }
    } catch (err: any) {
      console.error("Send OTP error:", err);
      setError(err.message || "Napaka pri pošiljanju kode");
      toast({
        variant: "destructive",
        title: "Napaka",
        description: err.message || "Napaka pri pošiljanju kode",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      console.log("Verifying OTP:", { email, code: otpCode });

      const response = await fetch("/api/auth/parent/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email: email.trim(), 
          code: otpCode.trim() 
        }),
      });

      const data = await response.json();
      console.log("Verify response:", data);

      if (!response.ok) {
        throw new Error(data.error || "Napaka pri preverjanju kode");
      }

      if (data.success && data.session) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });

        if (sessionError) {
          console.error("Session error:", sessionError);
          throw new Error("Napaka pri nastavitvi seje");
        }

        // Wait for session to be fully established in AuthContext
        await new Promise(resolve => setTimeout(resolve, 500));

        localStorage.setItem("parent_email", data.parent.email);
        localStorage.setItem("parent_children", JSON.stringify(data.children));

        toast({
          title: "Prijava uspešna",
          description: `Dobrodošli! Najdenih ${data.children.length} otrok.`,
        });

        // Use window.location for hard navigation to ensure session is recognized
        window.location.href = "/my-children";
      }
    } catch (err: any) {
      console.error("Verification error:", err);
      setError(err.message || "Napaka pri preverjanju kode");
      toast({
        variant: "destructive",
        title: "Napaka",
        description: err.message || "Napaka pri preverjanju kode",
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
            {step === "email" ? (
              <p className="text-sm text-muted-foreground">
                Vnesite e-poštni naslov, ki je vnesen kot skrbnik pri vašem otroku
              </p>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center">
                <AlertCircle className="w-4 h-4" />
                <span>4-mestna koda je veljavna 5 minut</span>
              </div>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "email" ? (
            <form onSubmit={handleSendOTP} className="space-y-6">
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
                {loading ? "Pošiljam..." : "Pošlji kodo"}
              </Button>
            </form>
          ) : (
            <div className="space-y-6">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStep("email");
                  setOtpCode("");
                  setError("");
                }}
                className="mb-4"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Nazaj
              </Button>

              <form onSubmit={handleVerifyCode} className="space-y-6">
                <div>
                  <Label htmlFor="otp">Vnesite 4-mestno kodo</Label>
                  <div className="flex justify-center mt-2">
                    <InputOTP
                      maxLength={4}
                      value={otpCode}
                      onChange={(value) => setOtpCode(value)}
                      onComplete={(value) => setOtpCode(value)}
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2 text-center">
                    Koda je bila poslana na {email}
                  </p>
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
                  disabled={loading || otpCode.length !== 4}
                >
                  {loading ? "Preverjam..." : "Preveri kodo"}
                </Button>

                <div className="text-center">
                  <Button
                    type="button"
                    variant="link"
                    onClick={handleSendOTP}
                    disabled={countdown > 0 || loading}
                    className="text-sm"
                  >
                    {countdown > 0
                      ? `Ponovno pošlji kodo čez ${countdown}s`
                      : "Ponovno pošlji kodo"}
                  </Button>
                </div>
              </form>
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