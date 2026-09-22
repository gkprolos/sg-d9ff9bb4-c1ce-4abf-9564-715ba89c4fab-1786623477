import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Clock, MapPin, Users, Eye, Calendar } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

interface Child {
    id: string;
    parent_id: string;
    first_name: string;
    last_name: string;
    birth_date: string;
    gender: string;
}

interface Team {
    id: string;
    name: string;
    age_group: string;
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
    date: string;
    status: string;
    activity_id: string;
    activities?: {
        name: string;
    };
}

export default function MyChildren() {
    const router = useRouter();
    const { user } = useAuth();
    const { toast } = useToast();

    const [loading, setLoading] = useState(true);
    const [children, setChildren] = useState < Child[] > ([]);
    const [selectedChild, setSelectedChild] = useState < Child | null > (null);
    const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
    const [attendance, setAttendance] = useState < AttendanceRecord[] > ([]);
    const [schedules, setSchedules] = useState < ScheduleTemplate[] > ([]);
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    useEffect(() => {
        if (user?.email) {
            loadChildren();
        }
    }, [user?.email]);

    useEffect(() => {
        if (selectedChild) {
            loadAttendance();
            loadSchedules(selectedChild.id);
        }
    }, [selectedChild, selectedMonth, selectedYear]);

    const loadChildren = async () => {
        try {
            // Spremenimo v POST in pošljemo email, ki ga API pričakuje
            const response = await fetch("/api/parent/get-children", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
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

            // Spremenimo v POST in pošljemo playerId, startDate in endDate
            const response = await fetch("/api/parent/get-attendance", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    playerId: selectedChild.id,
                    startDate: startDate.toISOString().split("T")[0],
                    endDate: endDate.toISOString().split("T")[0],
                }),
            });

            if (!response.ok) {
                throw new Error("Failed to load attendance");
            }

            const data = await response.json();
            setAttendance(data.attendance || []);
        } catch (error) {
            console.error("Error loading attendance:", error);
        }
    };

    const loadSchedules = async (childId: string) => {
        try {
            // Spremenimo v POST in pošljemo playerId, ki ga API pričakuje
            const response = await fetch("/api/parent/get-child-schedules", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ playerId: childId }),
            });

            if (!response.ok) {
                console.error("Failed to load schedules:", response.statusText);
                return;
            }
            const data = await response.json();

            // Convert day_of_week to number if it's a string
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

    // Group schedules by day
    const groupedSchedules = schedules.reduce((acc, schedule) => {
        const dayNum = schedule.day_of_week;
        const day = daysOfWeek[dayNum] || `Dan ${dayNum}`;
        if (!acc[day]) acc[day] = [];
        acc[day].push(schedule);
        return acc;
    }, {} as Record<string, ScheduleTemplate[]>);

    // Sort days by their index in daysOfWeek
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

        return schedules.find((s) => s.day_of_week === dbDay) || null;
    }

    const getDaysInMonth = () => {
        const firstDay = new Date(selectedYear, selectedMonth, 1);
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

    const getAttendanceColor = (status: string) => {
        switch (status) {
            case "present":
                return "bg-green-100 text-green-800 border-green-300";
            case "absent":
                return "bg-red-100 text-red-800 border-red-300";
            case "excused":
                return "bg-yellow-100 text-yellow-800 border-yellow-300";
            default:
                return "bg-gray-100 text-gray-800 border-gray-300";
        }
    };

    const getAttendanceLabel = (status: string) => {
        switch (status) {
            case "present":
                return "Prisoten";
            case "absent":
                return "Odsoten";
            case "excused":
                return "Opravičen";
            default:
                return status;
        }
    };

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
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push("/dashboard")}
                        >
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Nazaj
                        </Button>
                        <div>
                            <h1 className="text-3xl font-bold">Moji otroci</h1>
                            <p className="text-muted-foreground">
                                Pregled treningov in prisotnosti vaših otrok
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid gap-6">
                    {children.map((child) => (
                        <Card key={child.id}>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle>
                                            {child.first_name} {child.last_name}
                                        </CardTitle>
                                        <CardDescription>
                                            Rojstni datum: {new Date(child.birth_date).toLocaleDateString("sl-SI")}
                                        </CardDescription>
                                    </div>
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setSelectedChild(child);
                                            setIsDetailsDialogOpen(true);
                                        }}
                                    >
                                        <Eye className="h-4 w-4 mr-2" />
                                        Podrobnosti
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Teams */}
                                <div>
                                    <h3 className="text-sm font-semibold mb-2">Ekipe</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Informacije o ekipah so na voljo na drugi strani
                                    </p>
                                </div>

                                {/* Schedules */}
                                <div>
                                    <h3 className="text-sm font-semibold mb-2">Urnik treningov</h3>
                                    {schedules && schedules.length > 0 ? (
                                        <div className="space-y-3">
                                            {sortedDays.map((day) => {
                                                const daySchedules = groupedSchedules[day] || [];
                                                if (daySchedules.length === 0) return null;

                                                return (
                                                    <div key={day} className="space-y-1">
                                                        <div className="text-sm font-medium">{day}</div>
                                                        {daySchedules.map((schedule) => {
                                                            return (
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
                                                                    {schedule.teams?.name && (
                                                                        <>
                                                                            <span>•</span>
                                                                            <Users className="h-3 w-3" />
                                                                            <span>{schedule.teams.name}</span>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">
                                            Ni določenega urnika
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}

                    {children.length === 0 && (
                        <Card>
                            <CardContent className="py-12">
                                <p className="text-center text-muted-foreground">
                                    Nimate dodanih otrok. Kontaktirajte administratorja za dodajanje otrok.
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            {/* Details Dialog */}
            <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>
                            {selectedChild?.first_name} {selectedChild?.last_name}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="overflow-y-auto flex-1 px-1">
                        {selectedChild && (
                            <div className="space-y-6">
                                {/* Calendar View */}
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-semibold">Prisotnost</h3>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    if (selectedMonth === 0) {
                                                        setSelectedMonth(11);
                                                        setSelectedYear(selectedYear - 1);
                                                    } else {
                                                        setSelectedMonth(selectedMonth - 1);
                                                    }
                                                }}
                                            >
                                                Prejšnji mesec
                                            </Button>
                                            <span className="text-sm font-medium">
                                                {new Date(selectedYear, selectedMonth).toLocaleDateString("sl-SI", {
                                                    month: "long",
                                                    year: "numeric",
                                                })}
                                            </span>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    if (selectedMonth === 11) {
                                                        setSelectedMonth(0);
                                                        setSelectedYear(selectedYear + 1);
                                                    } else {
                                                        setSelectedMonth(selectedMonth + 1);
                                                    }
                                                }}
                                            >
                                                Naslednji mesec
                                            </Button>
                                        </div>
                                    </div>

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
                                            const attendance = getAttendanceForDate(dateStr);
                                            const schedule = getScheduleForDate(dateStr);
                                            const hasActivity = schedule !== null;

                                            return (
                                                <div
                                                    key={dateStr}
                                                    className={`
                            min-h-[80px] p-2 border rounded-lg
                            ${!hasActivity ? "bg-muted/30" : ""}
                            ${attendance ? getAttendanceColor(attendance.status) : ""}
                          `}
                                                >
                                                    <div className="text-sm font-medium mb-1">
                                                        {date.getDate()}
                                                    </div>
                                                    {hasActivity && (
                                                        <div className="text-xs text-muted-foreground">
                                                            {schedule?.activity_name || "Trening"}
                                                        </div>
                                                    )}
                                                    {attendance && (
                                                        <Badge variant="outline" className="mt-1 text-xs">
                                                            {getAttendanceLabel(attendance.status)}
                                                        </Badge>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Attendance Statistics */}
                                <div>
                                    <h3 className="text-lg font-semibold mb-4">Statistika prisotnosti</h3>
                                    <div className="grid grid-cols-3 gap-4">
                                        <Card>
                                            <CardContent className="pt-6">
                                                <div className="text-2xl font-bold text-green-600">
                                                    {attendance.filter((a) => a.status === "present").length}
                                                </div>
                                                <div className="text-sm text-muted-foreground">Prisoten</div>
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardContent className="pt-6">
                                                <div className="text-2xl font-bold text-red-600">
                                                    {attendance.filter((a) => a.status === "absent").length}
                                                </div>
                                                <div className="text-sm text-muted-foreground">Odsoten</div>
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardContent className="pt-6">
                                                <div className="text-2xl font-bold text-yellow-600">
                                                    {attendance.filter((a) => a.status === "excused").length}
                                                </div>
                                                <div className="text-sm text-muted-foreground">Opravičen</div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
} 