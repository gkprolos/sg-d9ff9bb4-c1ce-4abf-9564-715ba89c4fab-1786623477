import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import * as authService from "@/services/authService";
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
  
  const [selectedYear, setSelectedYear] = useState<string>(() => {
    const currentYear = new Date().getFullYear();
    return currentYear.toString();
  });
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const currentMonth = new Date().getMonth() + 1; // 1-12
    return currentMonth.toString();
  });
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [selectedCoach, setSelectedCoach] = useState<string>("all");
  const [teams, setTeams] = useState<any[]>([]);
  const [coaches, setCoaches] = useState<any[]>([]);
  const [monthlyBilling, setMonthlyBilling] = useState<MonthlyBilling[]>([]);

  useEffect(() => {
    async function checkAdmin() {
      if (user) {
        const adminStatus = await authService.isAdmin(user.id);
        setIsAdmin(adminStatus);
        console.log(`Admin status for ${user.id}: ${adminStatus}`);
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

      // Load coach profiles with rates
      let coachProfilesQuery = supabase
        .from("profiles")
        .select("id, full_name, hourly_rate, km_rate");

      if (coachIds.length > 0) {
        coachProfilesQuery = coachProfilesQuery.in("id", coachIds);
      }

      const { data: coachProfiles, error: profilesError } = await coachProfilesQuery;
      
      if (profilesError) {
        console.error("Error loading coach profiles:", profilesError);
        throw profilesError;
      }

      console.log(`Loaded ${(coachProfiles || []).length} coach profiles with rates`);
      
      // Debug: Show loaded profiles
      if (coachProfiles && coachProfiles.length > 0) {
        console.log("Coach profiles loaded:");
        coachProfiles.forEach(cp => {
          console.log(`  ${cp.full_name} (${cp.id}): hourly_rate=${cp.hourly_rate}, km_rate=${cp.km_rate}`);
        });
      } else {
        console.warn("⚠️ NO COACH PROFILES FOUND!");
      }

      // Create coach map: coach_id -> profile
      const coachProfileMap = new Map(
        (coachProfiles || []).map(cp => [cp.id, cp])
      );

      // Load months
      for (let i = startMonthOffset; i < startMonthOffset + monthsToLoad; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const monthStr = `${year}-${String(month).padStart(2, "0")}`;
        const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
        const endDate = new Date(year, month, 0).toISOString().split("T")[0];

        console.log(`Loading billing for ${monthStr}...`);

        // Get activities for this month with full details
        let activitiesQuery = supabase
          .from("activities")
          .select(`
            id,
            team_id,
            activity_type_id,
            start_time,
            end_time,
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

        const { data: activities, error: activitiesError } = await activitiesQuery;
        
        if (activitiesError) {
          console.error("Error loading activities:", activitiesError);
          throw activitiesError;
        }

        if (!activities || activities.length === 0) {
          console.log(`No activities found for ${monthStr}`);
          continue;
        }

        console.log(`Found ${activities.length} activities BEFORE coach filter for ${monthStr}`);

        // Filter activities by coach if specific coach selected
        let filteredActivities = activities;
        if (coachIds.length > 0) {
          filteredActivities = activities.filter(activity => {
            const activityCoaches = activity.activity_coaches || [];
            return activityCoaches.some(ac => coachIds.includes(ac.coach_id));
          });
          console.log(`Filtered to ${filteredActivities.length} activities for selected coach(es)`);
        }

        if (filteredActivities.length === 0) {
          console.log(`No activities found after coach filter for ${monthStr}`);
          continue;
        }

        console.log(`Processing ${filteredActivities.length} activities for ${monthStr}`);

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

        for (const activity of filteredActivities) {
          const activityCoaches = activity.activity_coaches || [];
          const isTraining = activity.activity_type_id === 1 || activity.activity_type_id === 2;
          const isMatch = activity.activity_type_id === 3;

          // Calculate hours from start_time and end_time if hours_worked is NULL
          let calculatedHours = 0;
          if (activity.start_time && activity.end_time) {
            const start = new Date(`2000-01-01T${activity.start_time}`);
            const end = new Date(`2000-01-01T${activity.end_time}`);
            const diffMs = end.getTime() - start.getTime();
            calculatedHours = diffMs / (1000 * 60 * 60); // Convert to hours
          }

          console.log(`Activity ${activity.id}: type=${activity.activity_type_id}, calculated_hours=${calculatedHours.toFixed(2)}`);

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
            
            // Use hours_worked if available, otherwise use calculated hours
            const hours = ac.hours_worked !== null && ac.hours_worked !== undefined 
              ? ac.hours_worked 
              : calculatedHours;

            console.log(`  Coach ${ac.coach_id}: role=${ac.role}, hours=${hours.toFixed(2)}`);

            // Get coach profile with rates
            const coachProfile = coachProfileMap.get(ac.coach_id);

            if (!coachProfile) {
              console.warn(`⚠️ No profile found for coach ${ac.coach_id} - using default rates (0)`);
            }

            const hourlyRate = coachProfile?.hourly_rate || 0;
            const kmRate = coachProfile?.km_rate || 0;

            console.log(`    Using rates: hourly=${hourlyRate}, km=${kmRate}`);

            if (isTraining) {
              entry.training_count += 1;
              entry.training_hours += hours;
              
              // Calculate hourly amount
              const amount = hours * hourlyRate;
              entry.hourly_amount += amount;
              console.log(`    Training: ${hours.toFixed(2)}h × ${hourlyRate} = ${amount.toFixed(2)} €`);
            } else if (isMatch) {
              entry.match_count += 1;
              entry.match_hours += 4; // Official match always counts as 4 hours (regardless of actual duration)
              
              // For matches, always use 4 hours × hourly rate
              const amount = 4 * hourlyRate;
              entry.hourly_amount += amount;
              console.log(`    Match: 4h (fixed) × ${hourlyRate} = ${amount.toFixed(2)} €`);
            }

            // Calculate kilometer amount
            const kilometers = ac.mileage_km || 0;
            entry.total_kilometers += kilometers;
            if (kilometers > 0) {
              const kmAmount = kilometers * kmRate;
              entry.kilometer_amount += kmAmount;
              console.log(`    Kilometers: ${kilometers}km × ${kmRate} = ${kmAmount.toFixed(2)} €`);
            }
          }
        }

        console.log(`Processed ${coachBillingMap.size} coaches for ${monthStr}`);

        // Create billing records
        for (const [coachId, billing] of coachBillingMap) {
          const coachProfile = coachProfileMap.get(coachId);
          const totalHours = billing.training_hours + billing.match_hours;
          const totalAmount = billing.hourly_amount + billing.kilometer_amount;

          const coachName = coachProfile?.full_name 
            ? coachProfile.full_name
            : `⚠️ Neznan trener (${coachId.substring(0, 8)}...)`;

          console.log(`Coach ${coachName}: training_hours=${billing.training_hours.toFixed(1)}, hourly_amount=${billing.hourly_amount.toFixed(2)}, km_amount=${billing.kilometer_amount.toFixed(2)}, total=${totalAmount.toFixed(2)}`);

          billingArray.push({
            coach_id: coachId,
            coach_name: coachName,
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

      console.log(`Total billing records: ${billingArray.length}`);

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