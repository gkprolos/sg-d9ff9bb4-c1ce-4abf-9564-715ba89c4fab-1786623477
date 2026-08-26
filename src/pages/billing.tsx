import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface MonthlyBilling {
  coach_id: string;
  coach_name: string;
  month: string;
  training_count: number;
  training_hours: number;
  match_count: number;
  match_hours: number;
  total_hours: number;
  hourly_amount: number;
  total_kilometers: number;
  kilometer_amount: number;
  total_amount: number;
}

const monthNames = [
  "Januar", "Februar", "Marec", "April", "Maj", "Junij",
  "Julij", "Avgust", "September", "Oktober", "November", "December"
];

export default function BillingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [selectedCoach, setSelectedCoach] = useState<string>("all");
  const [teams, setTeams] = useState<any[]>([]);
  const [coaches, setCoaches] = useState<any[]>([]);
  const [monthlyBilling, setMonthlyBilling] = useState<MonthlyBilling[]>([]);

  useEffect(() => {
    async function checkAdmin() {
      if (user) {
        const { data, error } = await supabase
          .rpc("is_admin" as any, { user_id: user.id });
        
        if (!error && typeof data === "boolean") {
          setIsAdmin(data);
        }
      }
    }
    checkAdmin();
  }, [user]);

  useEffect(() => {
    if (user) {
      loadTeams();
      loadCoaches();
      loadMonthlyBilling();
    }
  }, [user, isAdmin, selectedMonth, selectedTeam, selectedCoach]);

  function generateMonthOptions() {
    const options = [{ value: "all", label: "Vsi meseci" }];
    const now = new Date();
    
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const value = `${year}-${String(month).padStart(2, "0")}`;
      const label = `${monthNames[date.getMonth()]} ${year}`;
      options.push({ value, label });
    }
    
    return options;
  }

  async function loadTeams() {
    try {
      let query = supabase
        .from("teams")
        .select(`
          id, 
          name, 
          short_name,
          head_coach_id,
          profiles!teams_head_coach_id_fkey(full_name)
        `)
        .eq("is_archived", false)
        .order("name", { ascending: true });

      // For coaches, only show their teams
      if (!isAdmin && user?.id) {
        const { data: coachTeams } = await supabase
          .from("team_coaches")
          .select("team_id")
          .eq("coach_id", user.id)
          .eq("is_active", true);

        const teamIds = (coachTeams || []).map(ct => ct.team_id);
        
        if (teamIds.length > 0) {
          query = query.in("id", teamIds);
        } else {
          setTeams([]);
          return;
        }
      }

      const { data, error } = await query;

      if (error) throw error;
      setTeams(data || []);
    } catch (error: any) {
      console.error("Napaka pri nalaganju selekcij:", error);
    }
  }

  async function loadCoaches() {
    try {
      if (!isAdmin) {
        // Coaches only see themselves
        if (user?.id) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, full_name")
            .eq("id", user.id)
            .single();
          
          if (profile) {
            setCoaches([profile]);
            setSelectedCoach(profile.id); // Auto-select themselves
          }
        }
      } else {
        // Admin sees all coaches
        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name")
          .order("full_name", { ascending: true });

        if (error) throw error;
        setCoaches(data || []);
      }
    } catch (error: any) {
      console.error("Napaka pri nalaganju trenerjev:", error);
    }
  }

  async function loadMonthlyBilling() {
    try {
      setLoading(true);
      let coachIds: string[] = [];
      let teamIds: string[] = [];

      // Determine filters
      if (isAdmin) {
        if (selectedCoach !== "all") {
          coachIds = [selectedCoach];
        }
        if (selectedTeam !== "all") {
          teamIds = [selectedTeam];
        }
      } else if (user?.id) {
        coachIds = [user.id];
        if (selectedTeam !== "all") {
          teamIds = [selectedTeam];
        }
      }

      const billingArray: MonthlyBilling[] = [];
      const now = new Date();

      // Determine months to load
      const monthsToLoad = selectedMonth === "all" ? 12 : 1;
      const startMonthOffset = selectedMonth === "all" ? 0 : 
        (() => {
          const [year, month] = selectedMonth.split("-").map(Number);
          const targetDate = new Date(year, month - 1, 1);
          const diffMonths = (now.getFullYear() - targetDate.getFullYear()) * 12 + 
                            (now.getMonth() - targetDate.getMonth());
          return diffMonths;
        })();

      // Load coach_rates for all coaches in advance
      let coachRatesQuery = supabase
        .from("coach_rates")
        .select("*");

      if (coachIds.length > 0) {
        coachRatesQuery = coachRatesQuery.in("coach_id", coachIds);
      }

      const { data: coachRatesData } = await coachRatesQuery;
      const coachRatesMap = new Map(
        (coachRatesData || []).map(cr => [cr.coach_id, cr])
      );

      // Load months
      for (let i = startMonthOffset; i < startMonthOffset + monthsToLoad; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const monthStr = `${year}-${String(month).padStart(2, "0")}`;
        const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
        const endDate = new Date(year, month, 0).toISOString().split("T")[0];

        // Get activities for this month
        let activitiesQuery = supabase
          .from("activities")
          .select(`
            id,
            team_id,
            activity_type_id,
            activity_coaches(
              coach_id,
              role,
              hours_worked,
              mileage_km
            )
          `)
          .gte("activity_date", startDate)
          .lte("activity_date", endDate);

        if (teamIds.length > 0) {
          activitiesQuery = activitiesQuery.in("team_id", teamIds);
        }

        const { data: activities } = await activitiesQuery;

        if (!activities || activities.length === 0) continue;

        // Group by coach
        const coachBillingMap = new Map<string, {
          training_count: number;
          training_hours: number;
          match_count: number;
          match_hours: number;
          total_kilometers: number;
          hourly_amount: number;
          kilometer_amount: number;
        }>();

        for (const activity of activities) {
          const activityCoaches = activity.activity_coaches || [];
          const isTraining = activity.activity_type_id === 1 || activity.activity_type_id === 2;
          const isMatch = activity.activity_type_id === 3;

          for (const ac of activityCoaches) {
            if (coachIds.length > 0 && !coachIds.includes(ac.coach_id)) continue;

            if (!coachBillingMap.has(ac.coach_id)) {
              coachBillingMap.set(ac.coach_id, {
                training_count: 0,
                training_hours: 0,
                match_count: 0,
                match_hours: 0,
                total_kilometers: 0,
                hourly_amount: 0,
                kilometer_amount: 0,
              });
            }

            const entry = coachBillingMap.get(ac.coach_id)!;
            const hours = ac.hours_worked || 0;
            const coachRates = coachRatesMap.get(ac.coach_id);
            const isHead = ac.role === "head";

            if (isTraining) {
              entry.training_count += 1;
              entry.training_hours += hours;
              
              // Calculate hourly amount based on role and activity type
              if (coachRates) {
                const hourlyRate = activity.activity_type_id === 1
                  ? (isHead ? coachRates.head_type1_per_hour : coachRates.assistant_type1_per_hour)
                  : (isHead ? coachRates.head_type2_per_hour : coachRates.assistant_type2_per_hour);
                entry.hourly_amount += hours * (hourlyRate || 0);
              }
            } else if (isMatch) {
              entry.match_count += 1;
              entry.match_hours += hours * 4; // Matches count as 4x hours for display
              
              // Calculate match amount (fixed rate per match)
              if (coachRates) {
                const matchRate = isHead ? coachRates.head_type3_fixed : coachRates.assistant_type3_fixed;
                entry.hourly_amount += matchRate || 0;
              }
            }

            // Calculate kilometer amount
            const kilometers = ac.mileage_km || 0;
            entry.total_kilometers += kilometers;
            if (coachRates && kilometers > 0) {
              entry.kilometer_amount += kilometers * (coachRates.mileage_per_km || 0);
            }
          }
        }

        // Get coach names and create billing records
        const uniqueCoachIds = Array.from(coachBillingMap.keys());
        if (uniqueCoachIds.length === 0) continue;

        const { data: coachProfiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", uniqueCoachIds);

        const coachNameMap = new Map(
          (coachProfiles || []).map(p => [p.id, p.full_name])
        );

        for (const [coachId, billing] of coachBillingMap) {
          const totalHours = billing.training_hours + billing.match_hours;
          const totalAmount = billing.hourly_amount + billing.kilometer_amount;

          billingArray.push({
            coach_id: coachId,
            coach_name: coachNameMap.get(coachId) || "Neznan trener",
            month: monthStr,
            training_count: billing.training_count,
            training_hours: Math.round(billing.training_hours * 10) / 10,
            match_count: billing.match_count,
            match_hours: Math.round(billing.match_hours * 10) / 10,
            total_hours: Math.round(totalHours * 10) / 10,
            hourly_amount: Math.round(billing.hourly_amount * 100) / 100,
            total_kilometers: Math.round(billing.total_kilometers * 10) / 10,
            kilometer_amount: Math.round(billing.kilometer_amount * 100) / 100,
            total_amount: Math.round(totalAmount * 100) / 100,
          });
        }
      }

      // Sort by month (descending), then coach name
      billingArray.sort((a, b) => {
        const monthCompare = b.month.localeCompare(a.month);
        if (monthCompare !== 0) return monthCompare;
        return a.coach_name.localeCompare(b.coach_name);
      });

      setMonthlyBilling(billingArray);
    } catch (error: any) {
      console.error("Napaka pri nalaganju mesečnih obračunov:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Napaka pri nalaganju obračunov",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Mesečni obračun</h2>
            <p className="text-muted-foreground">
              Pregled mesečnih obračunov trenerjev
            </p>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="month_filter">Mesec</Label>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger id="month_filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {generateMonthOptions().map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="team_filter">Selekcija</Label>
                  <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                    <SelectTrigger id="team_filter">
                      <SelectValue placeholder="Izberi selekcijo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Vse selekcije</SelectItem>
                      {teams.map((team) => {
                        const coachName = team.profiles?.full_name || "Brez trenerja";
                        const displayName = `${team.short_name || team.name} (Trener: ${coachName})`;
                        return (
                          <SelectItem key={team.id} value={team.id}>
                            {displayName}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {isAdmin && (
                  <div className="space-y-2">
                    <Label htmlFor="coach_filter">Trener</Label>
                    <Select value={selectedCoach} onValueChange={setSelectedCoach}>
                      <SelectTrigger id="coach_filter">
                        <SelectValue placeholder="Izberi trenerja" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Vsi trenerji</SelectItem>
                        {coaches.map((coach) => (
                          <SelectItem key={coach.id} value={coach.id}>
                            {coach.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Billing Table */}
          <Card>
            <CardHeader>
              <CardTitle>Pregled obračunov</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nalaganje...
                </p>
              ) : monthlyBilling.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Ni podatkov o obračunih za izbrano obdobje
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Trener</TableHead>
                        <TableHead>Mesec</TableHead>
                        <TableHead className="text-right">Treningi</TableHead>
                        <TableHead className="text-right">Ure treningov</TableHead>
                        <TableHead className="text-right">Tekme</TableHead>
                        <TableHead className="text-right">Ure tekem (×4)</TableHead>
                        <TableHead className="text-right">Skupno ur</TableHead>
                        <TableHead className="text-right">Znesek ur</TableHead>
                        <TableHead className="text-right">Kilometri</TableHead>
                        <TableHead className="text-right">Znesek km</TableHead>
                        <TableHead className="text-right font-semibold">Skupaj</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthlyBilling.map((billing, idx) => {
                        const [year, month] = billing.month.split("-");
                        const monthName = monthNames[parseInt(month) - 1];
                        const displayMonth = `${monthName} ${year}`;
                        
                        return (
                          <TableRow key={`${billing.coach_id}-${billing.month}-${idx}`}>
                            <TableCell>{billing.coach_name}</TableCell>
                            <TableCell>{displayMonth}</TableCell>
                            <TableCell className="text-right">{billing.training_count}</TableCell>
                            <TableCell className="text-right">{billing.training_hours.toFixed(1)} h</TableCell>
                            <TableCell className="text-right">{billing.match_count}</TableCell>
                            <TableCell className="text-right">{billing.match_hours.toFixed(1)} h</TableCell>
                            <TableCell className="text-right font-medium">{billing.total_hours.toFixed(1)} h</TableCell>
                            <TableCell className="text-right">{billing.hourly_amount.toFixed(2)} €</TableCell>
                            <TableCell className="text-right">{billing.total_kilometers.toFixed(1)} km</TableCell>
                            <TableCell className="text-right">{billing.kilometer_amount.toFixed(2)} €</TableCell>
                            <TableCell className="text-right font-semibold">{billing.total_amount.toFixed(2)} €</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}