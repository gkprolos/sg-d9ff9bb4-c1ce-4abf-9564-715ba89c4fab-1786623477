import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Send, Plus, Users, Search, Archive, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { sl } from "date-fns/locale";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";

interface Conversation {
  id: string;
  subject: string;
  team_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  unread_count?: number;
  last_message?: {
    content: string;
    created_at: string;
    sender_name: string;
  };
  teams?: {
    name: string;
  };
  conversation_participants?: Array<{
    user_id: string | null;
    parent_email: string | null;
    last_read_at: string | null;
    profiles?: {
      full_name: string;
    };
  }>;
  messages?: Array<{
    content: string;
    created_at: string;
    sender_id: string | null;
    sender_parent_email: string | null;
    profiles?: {
      full_name: string;
    };
  }>;
}

interface Message {
  id: string;
  content: string;
  created_at: string;
  sender_id: string | null;
  sender_parent_email: string | null;
  profiles?: {full_name: string;};
}

interface Contact {
  id?: string;
  email?: string;
  name: string;
  type: string;
}

export default function MessagingPage() {
  const router = useRouter();
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");

  // New conversation state
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newContent, setNewContent] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [availableContacts, setAvailableContacts] = useState<Contact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [teams, setTeams] = useState<Array<{id: string;name: string;}>>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check if parent is logged in via session storage
  const [parentEmail, setParentEmail] = useState<string | null>(null);
  const [effectiveRole, setEffectiveRole] = useState<"admin" | "coach" | "parent" | null>(null);

  useEffect(() => {
    // Priority: Supabase Auth user > Parent session
    if (typeof window !== "undefined") {
      // If Supabase Auth user exists, use their role (admin/coach)
      if (user && userRole) {
        setEffectiveRole(userRole);
        // Clear parent session when admin/coach logs in
        sessionStorage.removeItem("parentSession");
        setParentEmail(null);
        console.log("Supabase Auth user detected - role:", userRole);
      } else {
        // No Supabase user - check for parent session
        const parentSession = sessionStorage.getItem("parentSession");
        if (parentSession) {
          try {
            const session = JSON.parse(parentSession);
            setParentEmail(session.email);
            setEffectiveRole("parent");
            console.log("Parent session detected:", session.email);
          } catch (e) {
            console.error("Invalid parent session", e);
            sessionStorage.removeItem("parentSession");
          }
        } else {
          console.log("No role detected - user:", user, "userRole:", userRole);
        }
      }
    }
  }, [user, userRole]);

  const isAdmin = effectiveRole === "admin";
  const isCoach = effectiveRole === "coach";
  const isParent = effectiveRole === "parent";

  console.log("Effective role:", effectiveRole, "isAdmin:", isAdmin, "isCoach:", isCoach, "isParent:", isParent);

  useEffect(() => {
    if (effectiveRole) {
      loadConversations();
      if (isCoach) {
        loadCoachTeams();
      } else if (isAdmin) {
        loadAllTeams();
      }
    }
  }, [user, effectiveRole, parentEmail, statusFilter]);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
      markAsRead(selectedConversation.id);
    }
  }, [selectedConversation]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  async function loadCoachTeams() {
    if (!user?.id) return;

    const { data } = await supabase
      .from("team_coaches")
      .select("team_id, teams(id, name)")
      .eq("coach_id", user.id)
      .eq("is_active", true);

    if (data) {
      const teamList = data
        .filter((tc) => tc.teams)
        .map((tc) => ({ id: tc.teams!.id, name: tc.teams!.name }));
      setTeams(teamList);
      console.log("Coach teams loaded:", teamList);
    }
  }

  async function loadAllTeams() {
    // Za admin-a - naloži vse ekipe
    const { data, error } = await supabase
      .from("teams")
      .select("id, name")
      .order("name");

    if (error) {
      console.error("Error loading teams:", error);
      return;
    }

    if (data) {
      setTeams(data);
      console.log("Admin teams loaded:", data.length, "teams");
    }
  }

  async function loadConversations() {
    setLoading(true);
    try {
      if (isParent && parentEmail) {
        // Parent: Use API route (service role key, no RLS)
        const response = await fetch(`/api/parent/get-conversations?parent_email=${encodeURIComponent(parentEmail)}&status=${statusFilter}`);
        const data = await response.json();

        if (!response.ok) throw new Error(data.error || "Failed to load conversations");

        setConversations(data);
      } else {
        // Admin/Coach: Use Supabase client (RLS policies)
        const query = supabase.
        from("conversations").
        select(`
            id,
            subject,
            team_id,
            status,
            created_at,
            updated_at,
            teams(name),
            conversation_participants!inner(
              user_id,
              parent_email,
              last_read_at,
              profiles(full_name)
            ),
            messages(
              content,
              created_at,
              sender_id,
              sender_parent_email,
              profiles(full_name)
            )
          `).
        eq("status", statusFilter).
        order("updated_at", { ascending: false });

        const { data, error } = await query;

        if (error) {
          console.error("Load conversations error:", error);
          throw error;
        }

        if (data) {
          const conversationsWithUnread = data.map((conv: any) => {
            const myParticipant = conv.conversation_participants.find((p: any) =>
            p.user_id === user?.id
            );

            const lastReadAt = myParticipant?.last_read_at;
            const unreadCount = lastReadAt ?
            conv.messages.filter((m: any) => new Date(m.created_at) > new Date(lastReadAt)).length :
            conv.messages.length;

            const lastMessage = conv.messages.sort((a: any, b: any) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )[0];

            const senderName = lastMessage?.sender_parent_email || lastMessage?.profiles?.full_name || "Sistem";

            return {
              ...conv,
              unread_count: unreadCount,
              last_message: lastMessage ? {
                content: lastMessage.content,
                created_at: lastMessage.created_at,
                sender_name: senderName
              } : undefined
            };
          });

          setConversations(conversationsWithUnread);
        }
      }
    } catch (error: any) {
      console.error("Load conversations error:", error);
      toast({
        title: "Napaka",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadMessages(conversationId: string) {
    try {
      if (isParent && parentEmail) {
        // Parent: Use API route
        const response = await fetch(`/api/parent/get-messages?conversation_id=${conversationId}&parent_email=${encodeURIComponent(parentEmail)}`);
        const data = await response.json();

        if (!response.ok) throw new Error(data.error || "Failed to load messages");

        setMessages(data);
      } else {
        // Admin/Coach: Use Supabase client
        const { data, error } = await supabase.
        from("messages").
        select(`
            id,
            content,
            created_at,
            sender_id,
            sender_parent_email,
            profiles(full_name)
          `).
        eq("conversation_id", conversationId).
        order("created_at", { ascending: true });

        if (error) throw error;

        setMessages(data || []);
      }
    } catch (error: any) {
      toast({
        title: "Napaka",
        description: error.message,
        variant: "destructive"
      });
    }
  }

  async function markAsRead(conversationId: string) {
    try {
      if (isParent && parentEmail) {
        // Parent: Use API route
        await fetch("/api/parent/mark-read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversation_id: conversationId,
            parent_email: parentEmail
          })
        });
      } else {
        // Admin/Coach: Use Supabase client
        await supabase.
        from("conversation_participants").
        update({ last_read_at: new Date().toISOString() }).
        eq("conversation_id", conversationId).
        eq("user_id", user?.id);
      }

      loadConversations();
    } catch (error: any) {
      console.error("Mark read error:", error);
    }
  }

  async function sendMessage() {
    if (!newMessage.trim() || !selectedConversation) return;

    setSendingMessage(true);
    try {
      if (isParent && parentEmail) {
        // Parent: Use API route
        const response = await fetch("/api/parent/send-message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversation_id: selectedConversation.id,
            parent_email: parentEmail,
            content: newMessage.trim()
          })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to send message");
      } else {
        // Admin/Coach: Use Supabase client
        const { error } = await supabase.from("messages").insert({
          conversation_id: selectedConversation.id,
          content: newMessage.trim(),
          sender_id: user?.id,
          sender_parent_email: null
        });

        if (error) throw error;
      }

      setNewMessage("");
      await loadMessages(selectedConversation.id);
      await loadConversations();

      toast({
        title: "Sporočilo poslano",
        description: "Vaše sporočilo je bilo uspešno poslano."
      });
    } catch (error: any) {
      toast({
        title: "Napaka",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSendingMessage(false);
    }
  }

  const loadAvailableContacts = async () => {
    try {
      if (effectiveRole === "parent") {
        // Za starše - pridobi kontakte preko API
        const response = await fetch(`/api/parent/get-contacts?parent_email=${parentEmail}`);
        if (!response.ok) throw new Error("Failed to load contacts");
        
        const data = await response.json();
        console.log("Parent contacts loaded:", data);
        
        const formattedContacts = data.map((contact: any) => ({
          id: contact.user_id,
          email: contact.email,
          name: contact.name,
          type: contact.contact_type,
        }));
        
        setAvailableContacts(formattedContacts);
        return;
      }

      // Za trenerje in admine
      const contacts: Contact[] = [];

      if (effectiveRole === "coach") {
        // Pridobi igralce trenerjeve ekipe
        const { data: teamPlayers } = await supabase
          .from("team_players")
          .select(
            `
            player_id,
            players!inner (
              id,
              first_name,
              last_name,
              guardian1_email,
              guardian2_email
            ),
            teams!inner (
              id,
              name,
              team_coaches!inner (
                coach_id
              )
            )
          `
          )
          .eq("teams.team_coaches.coach_id", user?.id)
          .eq("teams.team_coaches.is_active", true)
          .eq("players.is_active", true);

        if (teamPlayers) {
          const parentEmails = new Map<string, string[]>(); // email -> [otrokova imena]
          
          // Najprej zberemo vse starše in njihove otroke
          teamPlayers.forEach((tp: any) => {
            const player = tp.players;
            const childName = `${player.first_name} ${player.last_name}`;
            
            // Guardian 1
            if (player.guardian1_email) {
              if (!parentEmails.has(player.guardian1_email)) {
                parentEmails.set(player.guardian1_email, []);
              }
              if (!parentEmails.get(player.guardian1_email)!.includes(childName)) {
                parentEmails.get(player.guardian1_email)!.push(childName);
              }
            }
            
            // Guardian 2
            if (player.guardian2_email) {
              if (!parentEmails.has(player.guardian2_email)) {
                parentEmails.set(player.guardian2_email, []);
              }
              if (!parentEmails.get(player.guardian2_email)!.includes(childName)) {
                parentEmails.get(player.guardian2_email)!.push(childName);
              }
            }
          });
          
          // Sedaj dodamo starše brez duplikatov
          parentEmails.forEach((childNames, email) => {
            const displayName = childNames.length === 1 
              ? `Starš: ${childNames[0]}` 
              : `Starš: ${childNames.join(", ")}`;
              
            contacts.push({
              id: `parent-${email}`,
              email: email,
              name: displayName,
              type: "parent",
            });
          });
        }

        // Pridobi vse aktivne trenerje iz team_coaches (razen prijavljen)
        const { data: allCoaches } = await supabase
          .from("team_coaches")
          .select(
            `
            coach_id,
            profiles!inner (
              id,
              full_name,
              email
            )
          `
          )
          .eq("is_active", true)
          .neq("profiles.id", user?.id);

        console.log("All coaches query result:", allCoaches);

        if (allCoaches) {
          // Deduplikacija po ID
          const uniqueCoaches = new Map();
          allCoaches.forEach((tc: any) => {
            const profile = tc.profiles;
            if (!uniqueCoaches.has(profile.id)) {
              uniqueCoaches.set(profile.id, profile);
            }
          });

          uniqueCoaches.forEach((profile: any) => {
            console.log("Processing coach profile:", profile.full_name);
            
            // Preveri podvajanje po ID in emailu
            if (!contacts.find(c => c.id === profile.id || c.email === profile.email)) {
              console.log("  -> Adding as: coach");
              
              contacts.push({
                id: profile.id,
                email: profile.email,
                name: profile.full_name,
                type: "coach",
              });
            } else {
              console.log("  -> Skipping (duplicate)");
            }
          });
        }

        // Pridobi vse admine
        const { data: admins } = await supabase
          .from("user_roles")
          .select(
            `
            user_id,
            profiles!inner (
              id,
              full_name,
              email
            )
          `
          )
          .eq("role", "admin")
          .neq("profiles.id", user?.id);

        console.log("Admins query result:", admins);

        if (admins) {
          admins.forEach((admin: any) => {
            const profile = admin.profiles;
            console.log("Processing admin profile:", profile.full_name);
            
            // Preveri podvajanje po ID in emailu
            if (!contacts.find(c => c.id === profile.id || c.email === profile.email)) {
              console.log("  -> Adding as: admin");
              
              contacts.push({
                id: profile.id,
                email: profile.email,
                name: profile.full_name,
                type: "admin",
              });
            } else {
              console.log("  -> Skipping (duplicate)");
            }
          });
        }
      }

      if (effectiveRole === "admin") {
        // Admin vidi vse (razen samega sebe)
        console.log("Loading contacts for admin - user.id:", user?.id);
        
        const { data: allUsers, error: queryError } = await supabase
          .from("profiles")
          .select(
            `
            id,
            full_name,
            email,
            user_roles (
              role
            )
          `
          )
          .neq("id", user?.id);

        console.log("All users query - error:", queryError, "data count:", allUsers?.length);
        console.log("All users for admin:", allUsers);

        if (allUsers) {
          allUsers.forEach((profile: any) => {
            console.log("Processing profile:", profile.full_name, "roles:", profile.user_roles);
            
            // Preveri podvajanje po ID in emailu
            if (contacts.find(c => c.id === profile.id || c.email === profile.email)) {
              console.log("  -> Skipping (duplicate)");
              return;
            }
            
            // Preveri če je user_roles array ali single object
            const rolesArray = Array.isArray(profile.user_roles) ? profile.user_roles : [profile.user_roles];
            
            console.log("  -> rolesArray:", rolesArray);
            
            // Če ima user_roles, določi primarno vlogo (prioriteta: admin > coach > parent)
            let contactType = "parent";
            if (rolesArray && rolesArray.length > 0 && rolesArray[0]) {
              if (rolesArray.some((ur: any) => ur?.role === "admin")) {
                contactType = "admin";
              } else if (rolesArray.some((ur: any) => ur?.role === "coach")) {
                contactType = "coach";
              } else if (rolesArray.some((ur: any) => ur?.role === "parent")) {
                contactType = "parent";
              }
            }
            
            console.log("  -> Adding as:", contactType);
            
            contacts.push({
              id: profile.id,
              email: profile.email,
              name: profile.full_name,
              type: contactType,
            });
          });
        }
      }

      console.log("Available contacts loaded:", contacts);
      setAvailableContacts(contacts);
    } catch (error) {
      console.error("Error loading contacts:", error);
      toast({
        title: "Napaka",
        description: "Napaka pri nalaganju kontaktov",
        variant: "destructive",
      });
    }
  };

  const filterContactsByTeam = async (teamId: string) => {
    if (!teamId || teamId === "all") {
      loadAvailableContacts();
      return;
    }

    try {
      const contacts: Contact[] = [];
      const parentEmails = new Map<string, string[]>(); // email -> [otrokova imena]

      if (effectiveRole === "coach" || effectiveRole === "admin") {
        // Pridobi igralce izbrane ekipe
        const { data: teamPlayers } = await supabase
          .from("team_players")
          .select(
            `
            player_id,
            players!inner (
              id,
              first_name,
              last_name,
              guardian1_email,
              guardian2_email
            )
          `
          )
          .eq("team_id", teamId)
          .eq("players.is_active", true);

        if (teamPlayers) {
          // Najprej zberemo vse starše in njihove otroke
          teamPlayers.forEach((tp: any) => {
            const player = tp.players;
            const childName = `${player.first_name} ${player.last_name}`;
            
            // Guardian 1
            if (player.guardian1_email) {
              if (!parentEmails.has(player.guardian1_email)) {
                parentEmails.set(player.guardian1_email, []);
              }
              if (!parentEmails.get(player.guardian1_email)!.includes(childName)) {
                parentEmails.get(player.guardian1_email)!.push(childName);
              }
            }
            
            // Guardian 2
            if (player.guardian2_email) {
              if (!parentEmails.has(player.guardian2_email)) {
                parentEmails.set(player.guardian2_email, []);
              }
              if (!parentEmails.get(player.guardian2_email)!.includes(childName)) {
                parentEmails.get(player.guardian2_email)!.push(childName);
              }
            }
          });
          
          // Sedaj dodamo starše brez duplikatov
          parentEmails.forEach((childNames, email) => {
            const displayName = childNames.length === 1 
              ? `Starš: ${childNames[0]}` 
              : `Starš: ${childNames.join(", ")}`;
              
            contacts.push({
              id: `parent-${email}`,
              email: email,
              name: displayName,
              type: "parent",
            });
          });
        }

        // Pridobi trenerje te ekipe (razen tistih z user_roles.role='parent' brez coach/admin role)
        const { data: teamCoaches } = await supabase
          .from("team_coaches")
          .select(
            `
            coach_id,
            profiles!inner (
              id,
              full_name,
              email,
              user_roles (
                role
              )
            )
          `
          )
          .eq("team_id", teamId)
          .eq("is_active", true)
          .neq("profiles.id", user?.id);

        console.log("Team coaches query result:", teamCoaches);

        if (teamCoaches) {
          teamCoaches.forEach((tc: any) => {
            const profile = tc.profiles;
            
            console.log("Processing team coach:", profile.full_name, "user_roles:", profile.user_roles);
            
            // Samo profili z user_roles vnosom
            if (!profile.user_roles || profile.user_roles.length === 0) {
              console.log("  -> Skipping (no user_roles)");
              return;
            }
            
            // Preveri če je user_roles array
            const rolesArray = Array.isArray(profile.user_roles) ? profile.user_roles : [profile.user_roles];
            
            // Preveri če je ta oseba označena kot 'parent' v user_roles
            const hasParentRole = rolesArray.some((ur: any) => ur.role === "parent");
            const hasCoachOrAdminRole = rolesArray.some((ur: any) => ur.role === "coach" || ur.role === "admin");
            
            console.log("  -> hasParentRole:", hasParentRole, "hasCoachOrAdminRole:", hasCoachOrAdminRole);
            
            // Če je SAMO parent (brez coach/admin role), ga ne dodajaj
            if (hasParentRole && !hasCoachOrAdminRole) {
              console.log("  -> Skipping (only parent role)");
              return;
            }
            
            // Preveri podvajanje po ID in emailu
            if (!contacts.find(c => c.id === profile.id || c.email === profile.email)) {
              const contactType = hasCoachOrAdminRole ? "coach" : "parent";
              console.log("  -> Adding as:", contactType);
              
              contacts.push({
                id: profile.id,
                email: profile.email,
                name: profile.full_name,
                type: contactType,
              });
            } else {
              console.log("  -> Skipping (duplicate)");
            }
          });
        }

        // Dodaj še vse admine
        const { data: admins } = await supabase
          .from("user_roles")
          .select(
            `
            user_id,
            profiles!inner (
              id,
              full_name,
              email
            )
          `
          )
          .eq("role", "admin")
          .neq("profiles.id", user?.id);

        if (admins) {
          admins.forEach((admin: any) => {
            const profile = admin.profiles;
            // Preveri podvajanje po ID in emailu
            if (!contacts.find(c => c.id === profile.id || c.email === profile.email)) {
              contacts.push({
                id: profile.id,
                email: profile.email,
                name: profile.full_name,
                type: "admin",
              });
            }
          });
        }
      }

      console.log("Filtered contacts by team:", contacts);
      setAvailableContacts(contacts);
    } catch (error) {
      console.error("Error filtering contacts:", error);
      toast({
        title: "Napaka",
        description: "Napaka pri filtriranju kontaktov",
        variant: "destructive",
      });
    }
  };

  async function createConversation() {
    if (!newSubject.trim() || !newContent.trim() || selectedContacts.length === 0) {
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Prosim izpolnite naslov, sporočilo in izberite vsaj enega prejemnika."
      });
      return;
    }

    console.log("Creating conversation - user:", user, "user?.id:", user?.id, "effectiveRole:", effectiveRole);

    setSendingMessage(true);

    try {
      if (isParent && parentEmail) {
        // Parent: Use API route to bypass RLS
        console.log("Parent creating conversation via API route...");

        const response = await fetch("/api/parent/create-conversation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parentEmail,
            subject: newSubject,
            teamId: selectedTeam || null,
            participantIds: selectedContacts,
            initialMessage: newContent
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Napaka pri ustvarjanju pogovora");
        }

        console.log("Parent conversation created successfully:", data.conversationId);

        toast({
          title: "Uspešno",
          description: "Pogovor ustvarjen"
        });

        setShowNewDialog(false);
        setNewSubject("");
        setNewContent("");
        setSelectedContacts([]);
        setSelectedTeam(null);

        // Reload conversations
        await loadConversations();
      } else {
        // Coach/Admin: Use Supabase client directly
        const creatorId = user?.id || null;

        if (!creatorId) {
          toast({
            variant: "destructive",
            title: "Napaka",
            description: "Ni mogoče določiti ustvarjalca pogovora. Prosim poskusite znova."
          });
          return;
        }

        console.log("Coach/Admin creating conversation - creator:", creatorId);

        // Create conversation
        const { data: conversation, error: convError } = await supabase.
        from("conversations").
        insert({
          subject: newSubject,
          team_id: selectedTeam || null,
          created_by: creatorId
        }).
        select().
        single();

        if (convError || !conversation) {
          console.error("Conversation insert error:", convError);
          throw new Error("Napaka pri ustvarjanju pogovora");
        }

        console.log("Conversation created:", conversation.id);

        // Add participants
        const participants = selectedContacts.map((id) => ({
          conversation_id: conversation.id,
          user_id: id.includes('@') ? null : id,
          parent_email: id.includes('@') ? id : null
        }));

        // Always add creator as participant
        participants.push({
          conversation_id: conversation.id,
          user_id: creatorId,
          parent_email: null
        });

        const { error: participantsError } = await supabase.
        from("conversation_participants").
        insert(participants);

        if (participantsError) {
          console.error("Participants insert error:", participantsError);
          throw new Error("Napaka pri dodajanju prejemnikov");
        }

        console.log("Participants added");

        // Create initial message
        const { error: messageError } = await supabase.
        from("messages").
        insert({
          conversation_id: conversation.id,
          sender_id: creatorId,
          sender_parent_email: null,
          content: newContent
        });

        if (messageError) {
          console.error("Message insert error:", messageError);
          throw new Error("Napaka pri ustvarjanju prvega sporočila");
        }

        console.log("Initial message created");

        toast({
          title: "Uspešno",
          description: "Pogovor ustvarjen"
        });

        setShowNewDialog(false);
        setNewSubject("");
        setNewContent("");
        setSelectedContacts([]);
        setSelectedTeam(null);

        await loadConversations();
      }
    } catch (error: any) {
      console.error("Create conversation failed:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Ni mogoče ustvariti pogovora"
      });
    } finally {
      setSendingMessage(false);
    }
  }

  async function archiveConversation(conversationId: string) {
    try {
      const { error } = await supabase.
      from("conversations").
      update({ status: "archived" }).
      eq("id", conversationId);

      if (error) throw error;

      toast({
        title: "Pogovor arhiviran",
        description: "Pogovor je bil uspešno arhiviran."
      });

      setSelectedConversation(null);
      loadConversations();
    } catch (error: any) {
      toast({
        title: "Napaka",
        description: error.message,
        variant: "destructive"
      });
    }
  }

  async function unarchiveConversation(conversationId: string) {
    try {
      const { error } = await supabase.
      from("conversations").
      update({ status: "active" }).
      eq("id", conversationId);

      if (error) throw error;

      toast({
        title: "Pogovor obnovljen",
        description: "Pogovor je bil uspešno obnovljen."
      });

      loadConversations();
    } catch (error: any) {
      toast({
        title: "Napaka",
        description: error.message,
        variant: "destructive"
      });
    }
  }

  const filteredConversations = conversations.filter((conv) =>
  conv.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
  conv.teams?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="flex items-center gap-2">
            
            <ArrowLeft className="h-4 w-4" />
            Nazaj
          </Button>
          <h1 className="text-2xl font-bold">Moja sporočila

          </h1>
        </div>

        <div className="h-[calc(100vh-12rem)] flex gap-4">
          <div className="w-1/3 flex flex-col gap-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 flex-1 min-w-0">
                    <MessageSquare className="h-5 w-5 flex-shrink-0" />
                    <span className="truncate">
                      {isAdmin ? "Sporočila" : isCoach ? "Moja Sporočila" : "Sporočila"}
                    </span>
                  </CardTitle>
                  <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
                    <DialogTrigger asChild>
                      <Button size="sm" onClick={loadAvailableContacts} className="flex-shrink-0" style={{ backgroundColor: "#3b82f6", backgroundImage: "none" }}>
                        <Plus className="h-4 w-4 mr-2" />
                        Nov Pogovor
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Nov Pogovor</DialogTitle>
                      </DialogHeader>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium mb-2 block">Naslov</label>
                          <Input
                            value={newSubject}
                            onChange={(e) => setNewSubject(e.target.value)}
                            placeholder="Vnesi naslov pogovora" />
                          
                        </div>

                        {/* Show team selector only for coaches and admins */}
                        {(isCoach || isAdmin) && (
                          <div>
                            <label className="text-sm font-medium mb-2 block">Selekcija (Opcijsko)</label>
                            <Select
                              value={selectedTeam || undefined}
                              onValueChange={(value) => {
                                setSelectedTeam(value);
                                filterContactsByTeam(value);
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Brez selekcije" />
                              </SelectTrigger>
                              <SelectContent>
                                {teams.map((team) => (
                                  <SelectItem key={team.id} value={team.id}>
                                    {team.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        <div>
                          <label className="text-sm font-medium mb-2 block">Prvo Sporočilo</label>
                          <Textarea
                            value={newContent}
                            onChange={(e) => setNewContent(e.target.value)}
                            placeholder="Napišite svoje sporočilo..."
                            rows={3} />
                          
                        </div>

                        <div>
                          <label className="text-sm font-medium mb-2 block">Prejemniki</label>
                          <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                            {availableContacts.map((contact) => {
                              const contactId = contact.id || contact.email || "";
                              return (
                                <div key={contactId} className="flex items-center gap-2">
                                  <Checkbox
                                    checked={selectedContacts.includes(contactId)}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setSelectedContacts([...selectedContacts, contactId]);
                                      } else {
                                        setSelectedContacts(selectedContacts.filter((id) => id !== contactId));
                                      }
                                    }} />
                                  
                                  <label className="text-sm cursor-pointer flex-1">
                                    {contact.name}
                                    {contact.type === "parent" && " (Starš)"}
                                    {contact.type === "coach" && " (Trener)"}
                                    {contact.type === "admin" && " (Admin)"}
                                  </label>
                                </div>);

                            })}
                            {availableContacts.length === 0 &&
                            <p className="text-sm text-muted-foreground">
                                {isCoach ? "Izberite selekcijo za prikaz staršev igralcev" : "Ni kontaktov"}
                              </p>
                            }
                          </div>
                        </div>

                        <Button
                          onClick={createConversation}
                          disabled={!newSubject || !newContent || selectedContacts.length === 0 || sendingMessage}
                          className="w-full">
                          
                          {sendingMessage ? "Ustvarjam..." : "Ustvari Pogovor"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Iskanje..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)} />
                  
                </div>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Aktivni</SelectItem>
                    <SelectItem value="archived">Arhivirani</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <ScrollArea className="flex-1">
              <div className="space-y-2">
                {loading ?
                <p className="text-center text-muted-foreground py-8">Nalaganje...</p> :
                filteredConversations.length === 0 ?
                <p className="text-center text-muted-foreground py-8">Ni pogovorov</p> :

                conversations.map((conv) =>
                <div
                  key={conv.id}
                  onClick={() => {
                    setSelectedConversation(conv);
                    loadMessages(conv.id);
                    markAsRead(conv.id);
                  }}
                  className={cn(
                    "p-3 rounded-lg cursor-pointer transition-colors border",
                    selectedConversation?.id === conv.id ?
                    "bg-primary/10 border-primary" :
                    "hover:bg-muted border-transparent"
                  )}>
                  
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium truncate">{conv.subject}</h3>
                          {conv.team_id && conv.teams &&
                      <p className="text-xs text-muted-foreground">{conv.teams.name}</p>
                      }
                        </div>
                        {conv.unread_count > 0 &&
                    <Badge variant="destructive" className="text-xs">
                            {conv.unread_count}
                          </Badge>
                    }
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <Users className="h-3 w-3" />
                        <span>{conv.conversation_participants?.length || 0} prejemnikov</span>
                      </div>
                      
                      {conv.last_message &&
                  <div className="text-sm text-muted-foreground">
                          <p className="truncate">
                            <span className="font-medium">{conv.last_message.sender_name}:</span>{" "}
                            {conv.last_message.content}
                          </p>
                          <p className="text-xs mt-1">
                            {format(new Date(conv.last_message.created_at), "d. M. yyyy HH:mm", { locale: sl })}
                          </p>
                        </div>
                  }
                    </div>
                )
                }
              </div>
            </ScrollArea>
          </div>

          <Card className="flex-1 flex flex-col">
            {selectedConversation ?
            <>
                <CardHeader className="border-b">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{selectedConversation.subject}</CardTitle>
                      {selectedConversation.teams &&
                    <p className="text-sm text-muted-foreground mt-1">
                          {selectedConversation.teams.name}
                        </p>
                    }
                    </div>
                    {isAdmin &&
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await supabase.
                      from("conversations").
                      update({ status: selectedConversation.status === "active" ? "archived" : "active" }).
                      eq("id", selectedConversation.id);
                      loadConversations();
                      setSelectedConversation(null);
                    }}>
                    
                        <Archive className="h-4 w-4 mr-2" />
                        {selectedConversation.status === "active" ? "Arhiviraj" : "Aktiviraj"}
                      </Button>
                  }
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                    <Users className="h-4 w-4" />
                    <span>
                      {selectedConversation.conversation_participants?.map((p) =>
                    p.profiles?.full_name || p.parent_email
                    ).join(", ")}
                    </span>
                  </div>
                </CardHeader>

                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {messages.map((message: any) => {
                    const isMine = isParent ?
                    message.sender_parent_email === parentEmail :
                    message.sender_id === user?.id;

                    const senderName = message.sender_parent_email ?
                    message.sender_parent_email :
                    message.profiles?.full_name || "Sistem";

                    return (
                      <div
                        key={message.id}
                        className={cn(
                          "flex flex-col gap-1",
                          isMine ? "items-end" : "items-start"
                        )}>
                        
                          <div className="text-xs text-muted-foreground px-1">
                            {senderName}
                          </div>
                          <div
                          className={cn(
                            "max-w-[70%] rounded-lg p-3",
                            isMine ?
                            "bg-primary text-primary-foreground" :
                            "bg-muted"
                          )} style={{ backgroundColor: "#bababa", backgroundImage: "none" }}>
                          
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                            <p className="text-xs mt-1 opacity-70">
                              {format(new Date(message.created_at), "d. M. yyyy HH:mm", { locale: sl })}
                            </p>
                          </div>
                        </div>);

                  })}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                <div className="p-4 border-t">
                  <div className="flex gap-2">
                    <Textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Napišite sporočilo..."
                    rows={2}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }} />
                  
                    <Button onClick={sendMessage} disabled={sendingMessage || !newMessage.trim()} style={{ backgroundColor: "#3b82f6", backgroundImage: "none" }}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Pritisnite Enter za pošiljanje, Shift + Enter za novo vrstico
                  </p>
                </div>
              </> :

            <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Izberite pogovor za prikaz sporočil</p>
                </div>
              </div>
            }
          </Card>
        </div>
      </div>
    </AppLayout>);

}