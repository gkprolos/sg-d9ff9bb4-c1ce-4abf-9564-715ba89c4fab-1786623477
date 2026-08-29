import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Lock, ArrowLeft, CheckCircle } from "lucide-react";
import Link from "next/link";

type AuthStep = "email" | "otp" | "password" | "complete";

export default function ParentLogin() {
  const router = useRouter();
  const { toast } = useToast();
  
  const [step, setStep] = useState<AuthStep>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [canResend, setCanResend] = useState(true);
  
  const otpRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // OTP expiry countdown
  useEffect(() => {
    if (timeRemaining > 0) {
      const timer = setTimeout(() => setTimeRemaining(timeRemaining - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeRemaining]);

  // Format time remaining (MM:SS)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  async function handleSendOTP(e?: React.FormEvent) {
    if (e) e.preventDefault();
    
    if (!email || !email.includes("@")) {
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Vnesite veljaven email naslov",
      });
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/auth/parent/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Napaka pri pošiljanju kode");
      }

      setStep("otp");
      setTimeRemaining(180); // 3 minutes
      setCanResend(false);
      setTimeout(() => setCanResend(true), 60000); // Allow resend after 1 min
      
      toast({
        title: "Koda poslana",
        description: `4-mestna koda poslana na ${email}`,
      });

      // Focus first OTP input
      setTimeout(() => otpRefs[0].current?.focus(), 100);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Napaka pri pošiljanju kode",
      });
    } finally {
      setLoading(false);
    }
  }

  function handleOTPChange(index: number, value: string) {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 3) {
      otpRefs[index + 1].current?.focus();
    }

    // Auto-submit when all 4 digits entered
    if (index === 3 && value && newOtp.every(d => d)) {
      handleVerifyOTP(newOtp.join(""));
    }
  }

  function handleOTPKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs[index - 1].current?.focus();
    }
  }

  async function handleVerifyOTP(code?: string) {
    const otpCode = code || otp.join("");
    
    if (otpCode.length !== 4) {
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Vnesite vseh 4 številk kode",
      });
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/auth/parent/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: otpCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Neveljavna koda");
      }

      // Set Supabase session
      if (data.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      }

      // Check if parent already has password
      if (data.hasPassword) {
        // Redirect to parent dashboard
        toast({
          title: "Uspešna prijava",
          description: "Dobrodošli nazaj!",
        });
        router.push("/attendance/monthly");
      } else {
        // Offer password setup
        setStep("password");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Neveljavna koda",
      });
      setOtp(["", "", "", ""]);
      otpRefs[0].current?.focus();
    } finally {
      setLoading(false);
    }
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();

    if (password.length < 6) {
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Geslo mora imeti vsaj 6 znakov",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Gesli se ne ujemata",
      });
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/auth/parent/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Napaka pri nastavljanju gesla");
      }

      toast({
        title: "Geslo nastavljeno",
        description: "Naslednjič se lahko prijavite z geslom",
      });

      setStep("complete");
      setTimeout(() => router.push("/attendance/monthly"), 2000);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Napaka pri nastavljanju gesla",
      });
    } finally {
      setLoading(false);
    }
  }

  function handleSkipPassword() {
    toast({
      title: "Prijava uspešna",
      description: "Pri naslednji prijavi boste ponovno prejeli OTP kodo",
    });
    router.push("/attendance/monthly");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Prijava za Starše</h1>
          <p className="text-muted-foreground">
            Sledite prisotnosti vašega otroka
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {step === "email" && "Vnesite email naslov"}
              {step === "otp" && "Vnesite kodo"}
              {step === "password" && "Nastavitev gesla"}
              {step === "complete" && "Prijava uspešna"}
            </CardTitle>
            <CardDescription>
              {step === "email" && "Poslali vam bomo 4-mestno kodo"}
              {step === "otp" && `Koda poslana na ${email}`}
              {step === "password" && "Nastavite geslo za hitrejše prihodnje prijave"}
              {step === "complete" && "Preusmeritev na nadzorno ploščo..."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === "email" && (
              <form onSubmit={handleSendOTP} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email naslov</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="vas.email@primer.si"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <Alert>
                  <Mail className="h-4 w-4" />
                  <AlertDescription>
                    Uporabite email naslov, ki je vpisan pri vašem otroku kot kontakt starša.
                  </AlertDescription>
                </Alert>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Pošiljanje...
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      Pošlji kodo
                    </>
                  )}
                </Button>
              </form>
            )}

            {step === "otp" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Vnesite 4-mestno kodo</Label>
                  <div className="flex gap-2 justify-center">
                    {otp.map((digit, index) => (
                      <Input
                        key={index}
                        ref={otpRefs[index]}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOTPChange(index, e.target.value)}
                        onKeyDown={(e) => handleOTPKeyDown(index, e)}
                        className="w-14 h-14 text-center text-2xl font-bold"
                        disabled={loading}
                      />
                    ))}
                  </div>
                </div>

                {timeRemaining > 0 && (
                  <Alert>
                    <AlertDescription className="text-center">
                      ⏱️ Veljavnost: <strong>{formatTime(timeRemaining)}</strong>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep("email")}
                    disabled={loading}
                    className="flex-1"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Nazaj
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSendOTP}
                    disabled={loading || !canResend}
                    className="flex-1"
                  >
                    {loading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      "Pošlji novo kodo"
                    )}
                  </Button>
                </div>
              </div>
            )}

            {step === "password" && (
              <form onSubmit={handleSetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Novo geslo</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Najmanj 6 znakov"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Potrditev gesla</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Ponovite geslo"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>

                <Alert>
                  <Lock className="h-4 w-4" />
                  <AlertDescription>
                    Geslo omogoča hitrejšo prijavo brez OTP kode. To je opcijsko - lahko tudi preskočite.
                  </AlertDescription>
                </Alert>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSkipPassword}
                    disabled={loading}
                    className="flex-1"
                  >
                    Preskoči
                  </Button>
                  <Button type="submit" disabled={loading} className="flex-1">
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Shranjevanje...
                      </>
                    ) : (
                      <>
                        <Lock className="mr-2 h-4 w-4" />
                        Nastavi geslo
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}

            {step === "complete" && (
              <div className="text-center space-y-4">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
                <p className="text-lg font-medium">Prijava uspešna!</p>
                <p className="text-sm text-muted-foreground">
                  Preusmeritev na nadzorno ploščo...
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-center mt-6">
          <Link href="/login" className="text-sm text-muted-foreground hover:text-primary">
            <ArrowLeft className="inline h-4 w-4 mr-1" />
            Nazaj na glavno prijavo
          </Link>
        </div>
      </div>
    </div>
  );
}