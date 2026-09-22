import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Clock, MapPin, Users } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface Child {
    id: string;
    parent_id: string;
    first_name: string;
    last_name: string;
    date_of_birth: string;
    gender: string;
}

interface ScheduleTemplate {
    id: number;
    activity_name: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    location: string;
    venue_id?: string;
    venues?: {
        name: string;
        location?: string;
        city?: string;
    };
    teams?: {
        name: string;
    };
    activities?: {
        name: string;
        start_time?: string;
        end_time?: string;
    };
}

interface AttendanceRecord {
    id: string;
    player_id: string;
    status: string;
    date: string;
    activities?: {
        id: string;
        activity_date: string;
        start_time?: string;
        end_time?: string;
    };
}

export default function MyChildren() {
    const router = useRouter();
    const { user } = useAuth();
    const { toast } = useToast();

    const [loading, setLoading] = useState(true);
    const [children, setChildren] = useState < Child[] > ([]);
    const [selectedChildId, setSelectedChildId] = useState < string > ("");
    const [attendance, setAttendance] = useState < AttendanceRecord[] > ([]);
    const [schedules, setSchedules] = useState < ScheduleTemplate[] > ([]);

    // Default to current month and year
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    useEffect(() => {
        if (user?.email) {
            loadChildren();
        }
    }, [user?.email]);

    // Auto-select first child
    useEffect(() => {
        if (children.length > 0 && !selectedChildId) {
            setSelectedChildId(children[0].id);
        }
    }, [children, selectedChildId]);

    // Load data when filters change
    useEffect(() => {
        if (selectedChildId) {
            loadSchedules(selectedChildId);
            loadAttendance();
        } else {
            setSchedules([]);
            setAttendance([]);
        }
    }, [selectedChildId, selectedMonth, selectedYear]);

    const loadChildren = async () => {
        try {
            const response = await fetch("/api/parent/get-children", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ parentEmail: user?.email }),
            });

            if (!response.ok) {
                throw new Error("Failed to load children");
            }
            const data = await response.json();
            setChildren(data.children || []);
        } catch (error) {
            console.error("Error loading children:", error);
            toast({
                title: "Napaka",
                description: "Napaka pri nalaganju podatkov o otrocih",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const loadAttendance = async () => {
        if (!selectedChild) return;

        try {
            const startDate = new Date(selectedYear, selectedMonth, 1);
            const endDate = new Date(selectedYear, selectedMonth + 1, 0);

            console.log("Loading attendance for:", {
                child_id: selectedChild.id,
                start_date: startDate.toISOString().split("T")[0],
                end_date: endDate.toISOString().split("T")[0],
            });

            const response = await fetch(
                `/api/parent/get-attendance?child_id=${selectedChild.id}&start_date=${startDate.toISOString().split("T")[0]}&end_date=${endDate.toISOString().split("T")[0]}`
            );

            if (!response.ok) {
                const errorData = await response.json();
                console.error("Failed to load attendance:", errorData);
                setAttendance([]);
                return;
            }

            const data = await response.json();
            console.log("Attendance data loaded:", data);
            setAttendance(data.attendance || []);
        } catch (error) {
            console.error("Error loading attendance:", error);
            setAttendance([]);
        }
    };

    const loadSchedules = async (playerId: string) => {
        try {
            const response = await fetch("/api/parent/get-child-schedules", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ playerId: playerId }),
            });

            if (!response.ok) {
                console.error("Failed to load schedules:", response.statusText);
                return;
            }
            const data = await response.json();

            const schedules = (data.schedules || []).map((s: any) => ({
                ...s,
                day_of_week: typeof s.day_of_week === 'string' ? parseInt(s.day_of_week, 10) : s.day_of_week
            }));

            setSchedules(schedules);
        } catch (error) {
            console.error("Error loading schedules:", error);
        }
    };

    const daysOfWeek = ["Ponedeljek", "Torek", "Sreda", "Četrtek", "Petek", "Sobota", "Nedelja"];
    const months = ["Januar", "Februar", "Marec", "April", "Maj", "Junij", "Julij", "Avgust", "September", "Oktober", "November", "December"];

    const groupedSchedules = schedules.reduce((acc, schedule) => {
        const dayNum = schedule.day_of_week;
        const day = daysOfWeek[dayNum] || `Dan ${dayNum}`;
        if (!acc[day]) acc[day] = [];
        acc[day].push(schedule);
        return acc;
    }, {} as Record<string, ScheduleTemplate[]>);

    const sortedDays = Object.keys(groupedSchedules).sort((a, b) => {
        const aIndex = daysOfWeek.indexOf(a);
        const bIndex = daysOfWeek.indexOf(b);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
    });

    function getScheduleForDate(date: string): ScheduleTemplate | null {
        const dateObj = new Date(date);
        const jsDay = dateObj.getDay();
        const dbDay = jsDay === 0 ? 7 : jsDay;
        return schedules.find((s) => s.day_of_week === jsDay || s.day_of_week === dbDay) || null;
    }

    const getDaysInMonth = () => {
        const lastDay = new Date(selectedYear, selectedMonth + 1, 0);
        const days: Date[] = [];
        for (let i = 1; i <= lastDay.getDate(); i++) {
            days.push(new Date(selectedYear, selectedMonth, i));
        }
        return days;
    };

    const getAttendanceForDate = (date: string) => {
        return attendance.find((a) => a.date === date);
    };

    // Helper function to get status color
    const getStatusColor = (status: string) => {
        switch (status) {
            case "P": // Prisoten
                return "bg-green-500 text-white";
            case "O": // Odsoten
                return "bg-red-500 text-white";
            case "Op": // Opravičen
                return "bg-orange-500 text-white";
            default:
                return "bg-gray-200 text-gray-600";
        }
    };

    // Helper function to get status label
    const getStatusLabel = (status: string) => {
        switch (status) {
            case "P":
                return "Prisoten";
            case "O":
                return "Odsoten";
            case "Op":
                return "Opravičen";
            default:
                return status;
        }
    };

    // Calculate statistics
    const calculateStats = () => {
        const total = attendance.length;
        const present = attendance.filter((a) => a.status === "P").length;
        const absent = attendance.filter((a) => a.status === "O").length;
        const excused = attendance.filter((a) => a.status === "Op").length;

        return {
            total,
            present,
            absent,
            excused,
            presentPercentage: total > 0 ? Math.round((present / total) * 100) : 0,
        };
    };

    const stats = calculateStats();

    // Statistics calculation
    const presentCount = attendance.filter((a) => a.status === "present").length;
    const absentCount = attendance.filter((a) => a.status === "absent").length;
    const excusedCount = attendance.filter((a) => a.status === "excused").length;
    const totalTrainings = getDaysInMonth().filter(date => getScheduleForDate(date.toISOString().split("T")[0]) !== null).length;

    if (loading) {
        return (
            <AppLayout>
                <div className="flex items-center justify-center h-64">
                    <div className="text-muted-foreground">Nalaganje...</div>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}>
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Nazaj
                        </Button>
                        <div>
                            <h1 className="text-3xl font-bold">Moji otroci</h1>
                            <p className="text-muted-foreground">
                                Pregled treningov in prisotnosti
                            </p>
                        </div>
                    </div>
                </div>

                {children.length === 0 ? (
                    <Card>
                        <CardContent className="py-12">
                            <p className="text-center text-muted-foreground">
                                Nimate dodanih otrok. Kontaktirajte administratorja za dodajanje otrok.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        {/* Filters Section */}
                        <Card>
                            <CardContent className="pt-6">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <Label className="mb-2 block">Otrok</Label>
                                        <Select value={selectedChildId} onValueChange={setSelectedChildId}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Izberite otroka" />
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
                                        <Label className="mb-2 block">Mesec</Label>
                                        <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Izberite mesec" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {months.map((month, index) => (
                                                    <SelectItem key={index} value={String(index)}>
                                                        {month}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label className="mb-2 block">Leto</Label>
                                        <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Izberite leto" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value={String(selectedYear - 1)}>{selectedYear - 1}</SelectItem>
                                                <SelectItem value={String(selectedYear)}>{selectedYear}</SelectItem>
                                                <SelectItem value={String(selectedYear + 1)}>{selectedYear + 1}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Attendance Statistics */}
                        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="p-4 bg-gray-50 rounded-lg">
                                <div className="text-sm text-muted-foreground">Skupaj treningov</div>
                                <div className="text-2xl font-bold">{stats.total}</div>
                            </div>
                            <div className="p-4 bg-green-50 rounded-lg">
                                <div className="text-sm text-green-700">Prisotnost</div>
                                <div className="text-2xl font-bold text-green-700">
                                    {stats.present}
                                    <span className="text-sm ml-2">({stats.presentPercentage}%)</span>
                                </div>
                            </div>
                            <div className="p-4 bg-red-50 rounded-lg">
                                <div className="text-sm text-red-700">Odsotnost</div>
                                <div className="text-2xl font-bold text-red-700">{stats.absent}</div>
                            </div>
                            <div className="p-4 bg-orange-50 rounded-lg">
                                <div className="text-sm text-orange-700">Opravičeno</div>
                                <div className="text-2xl font-bold text-orange-700">{stats.excused}</div>
                            </div>
                        </div>

                        {/* Legend */}
                        <div className="mt-4 flex flex-wrap gap-4 text-sm">
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 bg-green-500 rounded"></div>
                                <span>P - Prisoten</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 bg-red-500 rounded"></div>
                                <span>O - Odsoten</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 bg-orange-500 rounded"></div>
                                <span>Op - Opravičen</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 bg-blue-50 border border-blue-200 rounded"></div>
                                <span>Načrtovan trening</span>
                            </div>
                        </div>

                        {/* Calendar Section */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Koledar prisotnosti - {months[selectedMonth]} {selectedYear}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-7 gap-2 mb-2">
                                    {["Pon", "Tor", "Sre", "Čet", "Pet", "Sob", "Ned"].map((day) => (
                                        <div key={day} className="text-center text-sm font-medium text-muted-foreground">
                                            {day}
                                        </div>
                                    ))}
                                </div>

                                <div className="grid grid-cols-7 gap-2">
                                    {getDaysInMonth().map((date) => {
                                        const dateStr = date.toISOString().split("T")[0];
                                        const dayAttendance = getAttendanceForDate(dateStr);
                                        const schedule = getScheduleForDate(dateStr);
                                        const hasActivity = schedule !== null;

                                        return (
                                            <div
                                                key={dateStr}
                                                className={`
                          min-h-[90px] p-2 border rounded-lg flex flex-col relative transition-colors
                          ${dayAttendance 
                            ? dayAttendance.status === "P" 
                              ? "bg-green-100 border-green-300" 
                              : dayAttendance.status === "O"
                              ? "bg-red-100 border-red-300"
                              : "bg-orange-100 border-orange-300"
                            : hasActivity 
                            ? "bg-blue-50 border-blue-200" 
                            : "bg-gray-50 border-gray-200"}
                        `}
                                            >
                                                {/* Dan v mesecu */}
                                                <div className="text-xs font-semibold text-gray-600 mb-1">
                                                    {date.getDate()}
                                                </div>

                                                <div className="flex-1 flex flex-col items-center justify-center gap-1">
                                                    {dayAttendance ? (
                                                        <>
                                                            {/* Velika črka za status */}
                                                            <div className={`
                                text-2xl font-bold rounded-full w-10 h-10 flex items-center justify-center
                                ${dayAttendance.status === "P" 
                                  ? "bg-green-500 text-white" 
                                  : dayAttendance.status === "O"
                                  ? "bg-red-500 text-white"
                                  : "bg-orange-500 text-white"}
                              `}>
                                                                {dayAttendance.status}
                                                            </div>
                                                            {/* Ime aktivnosti */}
                                                            <div className="text-[10px] text-center text-gray-600 font-medium">
                                                                {schedule?.activity_name || "Trening"}
                                                            </div>
                                                        </>
                                                    ) : hasActivity ? (
                                                        <div className="text-center">
                                                            <div className="text-xs font-medium text-blue-700 mb-1">
                                                                {schedule?.activity_name || "Trening"}
                                                            </div>
                                                            <div className="flex items-center gap-1 justify-center text-[10px] text-blue-600">
                                                                <Clock className="h-3 w-3" />
                                                                <span>{schedule.start_time.slice(0, 5)}</span>
                                                            </div>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Statistika in legenda */}
                                <div className="mt-6 space-y-4">
                                    {/* Statistika */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <div className="p-4 bg-gray-100 rounded-lg">
                                            <div className="text-xs text-gray-600 mb-1">Skupaj treningov</div>
                                            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
                                        </div>
                                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                                            <div className="text-xs text-green-700 mb-1">Prisotnost</div>
                                            <div className="text-2xl font-bold text-green-700">
                                                {stats.present}
                                                <span className="text-sm ml-2 font-normal">({stats.presentPercentage}%)</span>
                                            </div>
                                        </div>
                                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                                            <div className="text-xs text-red-700 mb-1">Odsotnost</div>
                                            <div className="text-2xl font-bold text-red-700">{stats.absent}</div>
                                        </div>
                                        <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                                            <div className="text-xs text-orange-700 mb-1">Opravičeno</div>
                                            <div className="text-2xl font-bold text-orange-700">{stats.excused}</div>
                                        </div>
                                    </div>

                                    {/* Legenda */}
                                    <div className="flex flex-wrap gap-4 text-sm">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold">P</div>
                                            <span className="text-gray-700">Prisoten</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold">O</div>
                                            <span className="text-gray-700">Odsoten</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs font-bold">Op</div>
                                            <span className="text-gray-700">Opravičen</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 bg-blue-50 border border-blue-200 rounded"></div>
                                            <span className="text-gray-700">Načrtovan trening</span>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Weekly Schedule Section */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Urnik treningov</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {schedules && schedules.length > 0 ? (
                                    <div className="space-y-3">
                                        {sortedDays.map((day) => {
                                            const daySchedules = groupedSchedules[day] || [];
                                            if (daySchedules.length === 0) return null;

                                            return (
                                                <div key={day} className="space-y-1">
                                                    <div className="text-sm font-medium">{day}</div>
                                                    {daySchedules.map((schedule) => (
                                                        <div key={schedule.id} className="flex items-center gap-2 text-sm text-muted-foreground pl-4">
                                                            <Clock className="h-3 w-3" />
                                                            <span>
                                                                {schedule.start_time.slice(0, 5)} - {schedule.end_time.slice(0, 5)}
                                                            </span>
                                                            {schedule.venues?.name && (
                                                                <>
                                                                    <span>•</span>
                                                                    <MapPin className="h-3 w-3" />
                                                                    <span>{schedule.venues.name}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        Ni določenega urnika
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>
        </AppLayout>
    );
}