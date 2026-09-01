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

  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [canResend, setCanResend] = useState(true);

  const otpRefs = [
  useRef<HTMLInputElement>(null),
  useRef<HTMLInputElement>(null),
  useRef<HTMLInputElement>(null),
  useRef<HTMLInputElement>(null)];


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
        description: "Vnesite veljaven email naslov"
      });
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/auth/parent/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
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
        description: `4-mestna koda poslana na ${email}`
      });

      // Focus first OTP input
      setTimeout(() => otpRefs[0].current?.focus(), 100);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Napaka pri pošiljanju kode"
      });
    } finally {
      setLoading(false);
    }
  }

  function handleOtpChange(index: number, value: string) {
    if (value.length <= 1 && /^\d*$/.test(value)) {
      const newOtp = [...otp];
      newOtp[index] = value;
      setOtp(newOtp);

      if (value && index < 3) {
        const nextInput = document.getElementById(`otp-${index + 1}`);
        nextInput?.focus();
      }
    }
  }

  function handleOTPKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs[index - 1].current?.focus();
    }
  }

  async function handleVerifyOtp() {
    setLoading(true);

    try {
      const code = otp.join("");
      const response = await fetch("/api/auth/parent/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Napaka pri preverjanju kode");
      }

      // Store parent session in sessionStorage (not localStorage)
      sessionStorage.setItem("parentSession", JSON.stringify({
        email: email.toLowerCase().trim(),
        loginTime: new Date().toISOString()
      }));

      toast({
        title: "Uspešna prijava",
        description: "Dobrodošli!"
      });

      // Redirect to parent dashboard
      router.push("/my-children");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Prijava za starše</h1>
          <p className="text-muted-foreground">
            Sledite prisotnosti vašega otroka
          </p>
        </div>

        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Prijava za starše</CardTitle>
            <CardDescription>
              {step === "email" && "Vnesite vaš email naslov"}
              {step === "otp" && "Vnesite 4-mestno kodo"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === "email" &&
            <>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                  id="email"
                  type="email"
                  placeholder="vas.email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading} />
                
                </div>
                <Button
                onClick={handleSendOTP}
                disabled={loading || !email}
                className="w-full" style={{ backgroundColor: "#65a30d", backgroundImage: "none" }}>
                
                  {loading ? "Pošiljam..." : "Pošlji kodo"}
                </Button>
              </>
            }

            {step === "otp" &&
            <>
                <div className="space-y-2">
                  <Label>Vnesite 4-mestno kodo</Label>
                  <div className="flex gap-2 justify-center">
                    {otp.map((digit, index) =>
                  <Input
                    key={index}
                    id={`otp-${index}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    className="w-12 h-12 text-center text-lg"
                    disabled={loading} />

                  )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Button
                  onClick={handleVerifyOtp}
                  disabled={loading || otp.some((d) => !d)}
                  className="w-full">
                  
                    {loading ? "Preverjam..." : "Preveri kodo"}
                  </Button>
                  <Button
                  onClick={() => setStep("email")}
                  variant="outline"
                  className="w-full"
                  disabled={loading}>
                  
                    Nazaj
                  </Button>
                </div>
              </>
            }
          </CardContent>
        </Card>

        <div className="text-center mt-6">
          <Link href="/login" className="text-sm text-muted-foreground hover:text-primary">
            <ArrowLeft className="inline h-4 w-4 mr-1" />
            Nazaj na glavno prijavo
          </Link>
        </div>
      </div>
    </div>);

}