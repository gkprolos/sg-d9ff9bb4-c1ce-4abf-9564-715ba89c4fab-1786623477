import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar, LogOut, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

interface ScheduleTemplate {
  id: string;
  team_id: string;
  venue_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  default_activity_type_id: number;
  is_active: boolean;
  venues: {
    id: string;
    name: string;
    city?: string;
  } | null;
}

export default function MyChildren() {
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [children, setChildren] = useState<Player[]>([]);
  const [selectedChild, setSelectedChild] = useState<string>("");
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [schedules, setSchedules] = useState<ScheduleTemplate[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [parentEmail, setParentEmail] = useState<string>("");

  useEffect(() => {
    const session = getParentSession();
    if (!session) {
      router.push("/login/parent");
      return;
    }
    setParentEmail(session.email);
  }, [router]);

  useEffect(() => {
    if (parentEmail) {
      loadChildren();
    }
  }, [parentEmail]);

  useEffect(() => {
    if (selectedChild) {
      loadAttendance();
      loadSchedules();
    }
  }, [selectedChild, selectedMonth, selectedYear]);

  function getParentSession() {
    const session = localStorage.getItem("parentSession");
    return session ? JSON.parse(session) : null;
  }

  async function loadChildren() {
    try {
      setLoading(true);

      console.log("Loading children for email:", parentEmail);

      const response = await fetch("/api/parent/get-children", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentEmail }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Napaka pri nalaganju otrok");
      }

      console.log("Children from API:", data.children);

      setChildren(data.children as Player[]);
      if (data.children && data.children.length > 0) {
        console.log("Setting selected child to:", data.children[0].id);
        setSelectedChild(data.children[0].id);
      } else {
        console.log("No children found!");
      }
    } catch (error: any) {
      console.error("Napaka pri nalaganju otrok:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Ni mogoče naložiti podatkov o otrocih",
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadAttendance() {
    if (!selectedChild) return;

    try {
      setLoading(true);

      const startOfMonth = new Date(selectedYear, selectedMonth, 1);
      const endOfMonth = new Date(selectedYear, selectedMonth + 1, 0);

      const startDate = startOfMonth.toISOString().split("T")[0];
      const endDate = endOfMonth.toISOString().split("T")[0];

      console.log("Loading attendance for:", { 
        playerId: selectedChild, 
        startDate, 
        endDate 
      });

      const response = await fetch("/api/parent/get-attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          playerId: selectedChild,
          startDate,
          endDate
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Napaka pri nalaganju prisotnosti");
      }

      console.log("Attendance from API:", data.attendance);

      setAttendance((data.attendance || []) as AttendanceRecord[]);
    } catch (error: any) {
      console.error("Napaka pri nalaganju prisotnosti:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Ni mogoče naložiti prisotnosti",
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadSchedules() {
    if (!selectedChild) return;

    try {
      console.log("Loading schedules for:", selectedChild);

      const response = await fetch("/api/parent/get-child-schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: selectedChild }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Napaka pri nalaganju urnika");
      }

      console.log("Schedules from API:", data.schedules);

      setSchedules((data.schedules || []) as ScheduleTemplate[]);
    } catch (error: any) {
      console.error("Napaka pri nalaganju urnika:", error);
    }
  }

  function handleLogout() {
    localStorage.removeItem("parentSession");
    router.push("/login/parent");
  }

  function getStatusForDate(date: string): number | null {
    const record = attendance.find(
      (a) => a.activities?.activity_date === date
    );
    return record ? record.status : null;
  }

  function getScheduleForDate(date: string): ScheduleTemplate | null {
    const dateObj = new Date(date);
    // JavaScript getDay(): 0=Sunday, 1=Monday, ..., 6=Saturday
    // Database day_of_week: 1=Monday, 2=Tuesday, ..., 7=Sunday
    const jsDay = dateObj.getDay();
    const dbDay = jsDay === 0 ? 7 : jsDay;

    return schedules.find(s => s.day_of_week === dbDay) || null;
  }

  function formatScheduleInfo(schedule: ScheduleTemplate | null): string | null {
    if (!schedule) return null;
    
    const venue = schedule.venues?.name || "N/A";
    const city = schedule.venues?.city ? ` (${schedule.venues.city})` : "";
    return `${schedule.start_time.slice(0, 5)}-${schedule.end_time.slice(0, 5)}, ${venue}${city}`;
  }

  function getStatusBadge(status: number | null) {
    if (status === null) return null;
    if (status === 1) return <Badge className="bg-green-600 text-white">P</Badge>;
    if (status === 0) return <Badge className="bg-red-600 text-white">O</Badge>;
    if (status === 2) return <Badge className="bg-yellow-600 text-white">Op</Badge>;
    return null;
  }

  const stats = {
    present: attendance.filter(a => a.status === 1).length,
    absent: attendance.filter(a => a.status === 0).length,
    excused: attendance.filter(a => a.status === 2).length,
    total: attendance.length,
  };

  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(selectedYear, selectedMonth, 1).getDay();
  const adjustedFirstDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  const months = [
    "Januar", "Februar", "Marec", "April", "Maj", "Junij",
    "Julij", "Avgust", "September", "Oktober", "November", "December"
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  const selectedChildData = children.find(c => c.id === selectedChild);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold">Prisotnost Otrok</h1>
          </div>
          <Button onClick={handleLogout} variant="outline">
            <LogOut className="h-4 w-4 mr-2" />
            Odjava
          </Button>
        </div>

        {loading && children.length === 0 ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-center text-muted-foreground">Nalagam podatke...</p>
            </CardContent>
          </Card>
        ) : children.length === 0 ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-center text-muted-foreground">Ni najdenih otrok</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Izberi Otroka</CardTitle>
                <CardDescription>Prikaz prisotnosti za izbranega otroka</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Otrok</label>
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
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Mesec</label>
                    <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {months.map((month, idx) => (
                          <SelectItem key={idx} value={idx.toString()}>
                            {month}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Leto</label>
                    <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map((year) => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {selectedChildData && (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <User className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">
                        {selectedChildData.first_name} {selectedChildData.last_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Datum rojstva: {new Date(selectedChildData.date_of_birth).toLocaleDateString("sl-SI")}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 sm:grid-cols-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Prisoten</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{stats.present}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Odsoten</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{stats.absent}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Opravičen</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-600">{stats.excused}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Skupaj Aktivnosti</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.total}</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>
                  Prisotnost - {months[selectedMonth]} {selectedYear}
                </CardTitle>
                <CardDescription>
                  P = Prisoten, O = Odsoten, Op = Opravičen
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-2">
                  {["Pon", "Tor", "Sre", "Čet", "Pet", "Sob", "Ned"].map((day) => (
                    <div
                      key={day}
                      className="text-center text-sm font-medium p-2 bg-muted rounded"
                    >
                      {day}
                    </div>
                  ))}

                  {Array.from({ length: adjustedFirstDay }).map((_, i) => (
                    <div key={`empty-${i}`} className="p-2" />
                  ))}

                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    const status = getStatusForDate(dateStr);
                    const schedule = getScheduleForDate(dateStr);
                    const scheduleInfo = formatScheduleInfo(schedule);
                    const isToday =
                      day === new Date().getDate() &&
                      selectedMonth === new Date().getMonth() &&
                      selectedYear === new Date().getFullYear();

                    return (
                      <div
                        key={day}
                        className={`
                          relative p-3 rounded-lg border transition-colors min-h-[100px]
                          ${isToday ? "border-primary bg-primary/5" : "border-border"}
                          ${status !== null || schedule ? "bg-muted/50" : ""}
                        `}
                      >
                        <div className="flex flex-col h-full">
                          <div className="text-sm font-medium mb-2">{day}</div>
                          
                          {status !== null && (
                            <div className="mb-2 flex justify-center">
                              {getStatusBadge(status)}
                            </div>
                          )}
                          
                          {scheduleInfo && (
                            <div className="text-xs text-muted-foreground text-center space-y-1 mt-auto">
                              <div className="font-medium">
                                {schedule!.start_time.slice(0, 5)}-{schedule!.end_time.slice(0, 5)}
                              </div>
                              <div className="line-clamp-2">
                                {schedule!.venues?.name || "N/A"}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}