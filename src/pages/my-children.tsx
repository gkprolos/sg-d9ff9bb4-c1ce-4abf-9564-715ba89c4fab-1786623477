import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, ChevronLeft, ChevronRight, Users, LogOut } from "lucide-react";

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: "male" | "female";
}

interface AttendanceRecord {
  id: string;
  player_id: string;
  status: number;
  activities: {
    id: string;
    activity_date: string;
  } | null;
}

// Check for parent session
function getParentSession() {
  if (typeof window === "undefined") return null;
  try {
    const session = localStorage.getItem("parentSession");
    return session ? JSON.parse(session) : null;
  } catch (error) {
    console.error("Invalid parent session:", error);
    return null;
  }
}

export default function MyChildrenPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [children, setChildren] = useState<Player[]>([]);
  const [selectedChild, setSelectedChild] = useState<string>("");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  
  const parentSession = getParentSession();
  const parentEmail = parentSession?.email || "";

  useEffect(() => {
    if (!parentSession) {
      router.push("/login/parent");
      return;
    }
    loadChildren();
  }, []);

  useEffect(() => {
    if (selectedChild) {
      loadAttendance();
    }
  }, [selectedChild, currentMonth]);

  async function loadChildren() {
    try {
      setLoading(true);

      const emailLower = parentEmail.toLowerCase().trim();
      console.log("Loading children for email:", emailLower);

      const { data, error } = await supabase
        .from("players")
        .select(`
          id,
          first_name,
          last_name,
          date_of_birth,
          gender
        `)
        .or(`guardian1_email.eq."${emailLower}",guardian2_email.eq."${emailLower}"`)
        .eq("is_active", true)
        .order("last_name", { ascending: true })
        .order("first_name", { ascending: true });

      console.log("Children query result:", { data, error });

      if (error) {
        console.error("Napaka pri nalaganju otrok:", error);
        toast({
          variant: "destructive",
          title: "Napaka",
          description: "Ni mogoče naložiti podatkov o otrocih",
        });
        throw error;
      }

      setChildren((data || []) as Player[]);
      if (data && data.length > 0) {
        console.log("Setting selected child to:", data[0].id);
        setSelectedChild(data[0].id);
      } else {
        console.log("No children found!");
      }
    } catch (error: any) {
      console.error("Napaka pri nalaganju otrok:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadAttendance() {
    if (!selectedChild) return;

    try {
      setLoading(true);

      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

      const { data, error } = await supabase
        .from("attendance_records")
        .select(`
          id,
          player_id,
          status,
          activities(
            id,
            activity_date
          )
        `)
        .eq("player_id", selectedChild)
        .gte("activities.activity_date", startOfMonth.toISOString().split("T")[0])
        .lte("activities.activity_date", endOfMonth.toISOString().split("T")[0])
        .order("activities(activity_date)", { ascending: true });

      if (error) {
        console.error("Napaka pri nalaganju prisotnosti:", error);
        toast({
          variant: "destructive",
          title: "Napaka",
          description: "Ni mogoče naložiti prisotnosti",
        });
        throw error;
      }

      setAttendance((data || []) as AttendanceRecord[]);
    } catch (error: any) {
      console.error("Napaka pri nalaganju prisotnosti:", error);
    } finally {
      setLoading(false);
    }
  }

  function handlePreviousMonth() {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  }

  function handleNextMonth() {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  }

  function handleLogout() {
    localStorage.removeItem("parentSession");
    router.push("/login/parent");
  }

  const selectedChildData = children.find(c => c.id === selectedChild);
  const monthName = currentMonth.toLocaleDateString("sl-SI", { month: "long", year: "numeric" });

  const stats = {
    present: attendance.filter(a => a.status === 1).length,
    absent: attendance.filter(a => a.status === 0).length,
    excused: attendance.filter(a => a.status === 2).length,
    total: attendance.length,
  };

  if (!parentSession) {
    return null;
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Prisotnost Otrok</h2>
            <p className="text-muted-foreground">
              Pregled mesečne prisotnosti na aktivnostih
            </p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Odjava
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Izbira Otroka</CardTitle>
          </CardHeader>
          <CardContent>
            {loading && children.length === 0 ? (
              <Skeleton className="h-10 w-full" />
            ) : children.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>Ni najdenih otrok</p>
              </div>
            ) : (
              <Select value={selectedChild} onValueChange={setSelectedChild}>
                <SelectTrigger>
                  <SelectValue placeholder="Izberi otroka" />
                </SelectTrigger>
                <SelectContent>
                  {children.map((child) => (
                    <SelectItem key={child.id} value={child.id}>
                      {child.first_name} {child.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>

        {selectedChild && (
          <>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      {monthName}
                    </CardTitle>
                    <CardDescription>
                      {selectedChildData?.first_name} {selectedChildData?.last_name}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={handlePreviousMonth}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setCurrentMonth(new Date())}
                      disabled={
                        currentMonth.getMonth() === new Date().getMonth() &&
                        currentMonth.getFullYear() === new Date().getFullYear()
                      }
                    >
                      Danes
                    </Button>
                    <Button variant="outline" size="icon" onClick={handleNextMonth}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-green-600">{stats.present}</div>
                      <p className="text-xs text-muted-foreground">Prisoten</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-red-600">{stats.absent}</div>
                      <p className="text-xs text-muted-foreground">Odsoten</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-yellow-600">{stats.excused}</div>
                      <p className="text-xs text-muted-foreground">Opravičen</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">{stats.total}</div>
                      <p className="text-xs text-muted-foreground">Skupaj aktivnosti</p>
                    </CardContent>
                  </Card>
                </div>

                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : attendance.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p className="text-lg font-medium">Ni zapisov prisotnosti</p>
                    <p className="text-sm mt-2">
                      Za ta mesec ni evidentiranih aktivnosti
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Datum</TableHead>
                          <TableHead>Aktivnost</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {attendance.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell>
                              {record.activities?.activity_date ? new Date(record.activities.activity_date).toLocaleDateString("sl-SI", {
                                weekday: "short",
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              }) : "N/A"}
                            </TableCell>
                            <TableCell className="font-medium">
                              {record.activities?.id || "N/A"}
                            </TableCell>
                            <TableCell>
                              {record.status === 1 && (
                                <Badge className="bg-green-600">Prisoten</Badge>
                              )}
                              {record.status === 0 && (
                                <Badge className="bg-red-600">Odsoten</Badge>
                              )}
                              {record.status === 2 && (
                                <Badge className="bg-yellow-600">Opravičen</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}