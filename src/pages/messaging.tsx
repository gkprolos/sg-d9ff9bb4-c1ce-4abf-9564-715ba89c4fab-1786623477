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

interface Conversation {
  id: string;
  subject: string;
  team_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  teams?: { name: string };
  unread_count?: number;
  last_message?: {
    content: string;
    created_at: string;
    sender_name: string;
  };
  participants?: Array<{
    user_id: string | null;
    parent_email: string | null;
    profiles?: { full_name: string };
  }>;
}

interface Message {
  id: string;
  content: string;
  created_at: string;
  sender_id: string | null;
  sender_parent_email: string | null;
  profiles?: { full_name: string };
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
  const [teams, setTeams] = useState<Array<{ id: string; name: string }>>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check if parent is logged in via session storage
  const [parentEmail, setParentEmail] = useState<string | null>(null);
  const [effectiveRole, setEffectiveRole] = useState<"admin" | "coach" | "parent" | null>(null);

  useEffect(() => {
    // Check parent session
    if (typeof window !== "undefined") {
      const parentSession = sessionStorage.getItem("parentSession");
      if (parentSession) {
        try {
          const session = JSON.parse(parentSession);
          setParentEmail(session.email);
          setEffectiveRole("parent");
          console.log("Parent session detected:", session.email);
        } catch (e) {
          console.error("Invalid parent session", e);
        }
      } else if (userRole) {
        setEffectiveRole(userRole);
        console.log("User role detected:", userRole);
      } else {
        console.log("No role detected - user:", user, "userRole:", userRole);
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
        .filter(tc => tc.teams)
        .map(tc => ({ id: tc.teams!.id, name: tc.teams!.name }));
      setTeams(teamList);
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
        const query = supabase
          .from("conversations")
          .select(`
            id,
            subject,
            team_id,
            status,
            created_at,
            updated_at,
            teams(name),
            conversation_participants(
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
          `)
          .eq("status", statusFilter)
          .order("updated_at", { ascending: false });

        const { data, error } = await query;

        if (error) throw error;

        if (data) {
          const conversationsWithUnread = data.map((conv: any) => {
            const myParticipant = conv.conversation_participants.find((p: any) =>
              p.user_id === user?.id
            );
            
            const lastReadAt = myParticipant?.last_read_at;
            const unreadCount = lastReadAt
              ? conv.messages.filter((m: any) => new Date(m.created_at) > new Date(lastReadAt)).length
              : conv.messages.length;

            const lastMessage = conv.messages[conv.messages.length - 1];
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
        const { data, error } = await supabase
          .from("messages")
          .select(`
            id,
            content,
            created_at,
            sender_id,
            sender_parent_email,
            profiles(full_name)
          `)
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true });

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
        await supabase
          .from("conversation_participants")
          .update({ last_read_at: new Date().toISOString() })
          .eq("conversation_id", conversationId)
          .eq("user_id", user?.id);
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

  async function loadAvailableContacts(teamId?: string) {
    if (isParent) {
      const { data } = await supabase.rpc("get_allowed_contacts_for_parent", {
        parent_email_param: parentEmail
      });
      
      if (data) {
        setAvailableContacts(data.map((c: any) => ({
          id: c.user_id,
          email: c.email,
          name: c.name,
          type: c.contact_type
        })));
      }
    } else if (isCoach && user?.id) {
      const { data } = await supabase.rpc("get_allowed_contacts_for_coach", {
        coach_id_param: user.id,
        team_id_param: teamId || null
      });
      
      if (data) {
        setAvailableContacts(data.map((c: any) => ({
          id: c.user_id,
          email: c.email,
          name: c.name,
          type: c.contact_type
        })));
      }
    } else if (isAdmin) {
      const { data: coaches } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("is_active", true);
      
      const { data: parents } = await supabase
        .from("players")
        .select("guardian1_email, guardian1_name, guardian2_email, guardian2_name")
        .eq("is_active", true);
      
      const contacts: Contact[] = [];
      
      if (coaches) {
        coaches.forEach(c => contacts.push({
          id: c.id,
          name: c.full_name,
          type: "coach"
        }));
      }
      
      if (parents) {
        // De-duplicate parents by email
        const parentMap = new Map<string, Contact>();
        
        parents.forEach(p => {
          if (p.guardian1_email && !parentMap.has(p.guardian1_email)) {
            parentMap.set(p.guardian1_email, {
              email: p.guardian1_email,
              name: p.guardian1_name || p.guardian1_email,
              type: "parent"
            });
          }
          if (p.guardian2_email && !parentMap.has(p.guardian2_email)) {
            parentMap.set(p.guardian2_email, {
              email: p.guardian2_email,
              name: p.guardian2_name || p.guardian2_email,
              type: "parent"
            });
          }
        });
        
        // Add unique parents to contacts
        parentMap.forEach(contact => contacts.push(contact));
      }
      
      setAvailableContacts(contacts);
    }
  }

  async function createConversation() {
    if (!newSubject.trim() || !newContent.trim() || selectedContacts.length === 0) {
      toast({
        title: "Manjkajoči podatki",
        description: "Prosim izpolnite naslov, sporočilo in izberite vsaj enega prejemnika.",
        variant: "destructive"
      });
      return;
    }

    try {
      // For parents, we need a system user to create the conversation
      // Get first admin user as system creator for parent conversations
      let creatorId = user?.id;
      
      console.log("Creating conversation - user:", user, "user?.id:", user?.id, "effectiveRole:", effectiveRole);
      
      if (isParent) {
        const { data: admins } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin")
          .limit(1)
          .single();
        
        creatorId = admins?.user_id || null;
        console.log("Parent conversation - using admin as creator:", creatorId);
      }

      if (!creatorId) {
        throw new Error("Ni mogoče določiti ustvarjalca pogovora. Prosim poskusite znova.");
      }

      console.log("INSERT payload:", {
        subject: newSubject.trim(),
        team_id: selectedTeam || null,
        created_by: creatorId,
        status: "active"
      });

      const { data: conversation, error: convError } = await supabase
        .from("conversations")
        .insert({
          subject: newSubject.trim(),
          team_id: selectedTeam || null,
          created_by: creatorId,
          status: "active"
        })
        .select()
        .single();

      if (convError) {
        console.error("Conversation insert error:", convError);
        throw convError;
      }

      console.log("Conversation created:", conversation);

      const participants = [
        ...(isParent 
          ? [{ conversation_id: conversation.id, user_id: null, parent_email: parentEmail }]
          : [{ conversation_id: conversation.id, user_id: user?.id, parent_email: null }]
        ),
        ...selectedContacts.map(contactId => {
          const contact = availableContacts.find(c => 
            (c.id && c.id === contactId) || (c.email && c.email === contactId)
          );
          return {
            conversation_id: conversation.id,
            user_id: contact?.type === "coach" ? contact.id : null,
            parent_email: contact?.type === "parent" ? contact.email : null
          };
        })
      ];

      console.log("INSERT participants:", participants);

      const { error: partError } = await supabase
        .from("conversation_participants")
        .insert(participants);

      if (partError) {
        console.error("Participants insert error:", partError);
        throw partError;
      }

      const { error: msgError } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversation.id,
          content: newContent.trim(),
          sender_id: isParent ? null : user?.id,
          sender_parent_email: isParent ? parentEmail : null
        });

      if (msgError) {
        console.error("Message insert error:", msgError);
        throw msgError;
      }

      toast({
        title: "Pogovor ustvarjen",
        description: "Nov pogovor je bil uspešno ustvarjen."
      });

      setShowNewDialog(false);
      setNewSubject("");
      setNewContent("");
      setSelectedContacts([]);
      setSelectedTeam("");
      loadConversations();
    } catch (error: any) {
      console.error("Create conversation failed:", error);
      toast({
        title: "Napaka",
        description: error.message,
        variant: "destructive"
      });
    }
  }

  const filteredConversations = conversations.filter(conv =>
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
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Nazaj
          </Button>
          <h1 className="text-2xl font-bold">
            {isAdmin ? "Sporočila" : isCoach ? "Moja Sporočila" : "Sporočila"}
          </h1>
        </div>

        <div className="h-[calc(100vh-12rem)] flex gap-4">
          <div className="w-1/3 flex flex-col gap-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    {isAdmin ? "Sporočila" : isCoach ? "Moja Sporočila" : "Sporočila"}
                  </CardTitle>
                  <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
                    <DialogTrigger asChild>
                      <Button size="sm" onClick={() => loadAvailableContacts()}>
                        <Plus className="h-4 w-4 mr-2" />
                        Nov Pogovor
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Nov Pogovor</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        {(isCoach || isAdmin) && teams.length > 0 && (
                          <div>
                            <label className="text-sm font-medium">Selekcija (opcijsko)</label>
                            <Select value={selectedTeam} onValueChange={(val) => {
                              setSelectedTeam(val);
                              loadAvailableContacts(val);
                            }}>
                              <SelectTrigger>
                                <SelectValue placeholder="Izberi selekcijo..." />
                              </SelectTrigger>
                              <SelectContent>
                                {teams.map(team => (
                                  <SelectItem key={team.id} value={team.id}>
                                    {team.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        
                        <div>
                          <label className="text-sm font-medium">Naslov</label>
                          <Input
                            value={newSubject}
                            onChange={(e) => setNewSubject(e.target.value)}
                            placeholder="Naslov pogovora..."
                          />
                        </div>

                        <div>
                          <label className="text-sm font-medium">Prejemniki</label>
                          <ScrollArea className="h-48 border rounded-md p-4">
                            <div className="space-y-2">
                              {availableContacts.map(contact => {
                                const contactId = contact.id || contact.email || "";
                                return (
                                  <div key={contactId} className="flex items-center gap-2">
                                    <Checkbox
                                      checked={selectedContacts.includes(contactId)}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          setSelectedContacts([...selectedContacts, contactId]);
                                        } else {
                                          setSelectedContacts(selectedContacts.filter(id => id !== contactId));
                                        }
                                      }}
                                    />
                                    <label className="text-sm">
                                      {contact.name}
                                      <Badge variant="outline" className="ml-2 text-xs">
                                        {contact.type === "coach" ? "Trener" : "Starš"}
                                      </Badge>
                                    </label>
                                  </div>
                                );
                              })}
                            </div>
                          </ScrollArea>
                          <p className="text-xs text-muted-foreground mt-2">
                            Izbrano: {selectedContacts.length}
                          </p>
                        </div>

                        <div>
                          <label className="text-sm font-medium">Sporočilo</label>
                          <Textarea
                            value={newContent}
                            onChange={(e) => setNewContent(e.target.value)}
                            placeholder="Napišite sporočilo..."
                            rows={4}
                          />
                        </div>

                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setShowNewDialog(false)}>
                            Prekliči
                          </Button>
                          <Button onClick={createConversation}>
                            Ustvari Pogovor
                          </Button>
                        </div>
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
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
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
                {loading ? (
                  <p className="text-center text-muted-foreground py-8">Nalaganje...</p>
                ) : filteredConversations.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Ni pogovorov</p>
                ) : (
                  filteredConversations.map(conv => (
                    <Card
                      key={conv.id}
                      className={`cursor-pointer transition-colors ${
                        selectedConversation?.id === conv.id ? "bg-accent" : "hover:bg-accent/50"
                      }`}
                      onClick={() => setSelectedConversation(conv)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-medium">{conv.subject}</h3>
                          {conv.unread_count! > 0 && (
                            <Badge variant="destructive" className="ml-2">
                              {conv.unread_count}
                            </Badge>
                          )}
                        </div>
                        
                        {conv.teams && (
                          <p className="text-xs text-muted-foreground mb-2">
                            {conv.teams.name}
                          </p>
                        )}

                        {conv.last_message && (
                          <>
                            <p className="text-sm text-muted-foreground truncate">
                              {conv.last_message.sender_name}: {conv.last_message.content}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(conv.last_message.created_at), "d. M. yyyy HH:mm", { locale: sl })}
                            </p>
                          </>
                        )}

                        <div className="flex items-center gap-2 mt-2">
                          <Users className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {conv.participants?.length || 0} udeležencev
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          <Card className="flex-1 flex flex-col">
            {selectedConversation ? (
              <>
                <CardHeader className="border-b">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{selectedConversation.subject}</CardTitle>
                      {selectedConversation.teams && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {selectedConversation.teams.name}
                        </p>
                      )}
                    </div>
                    {isAdmin && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await supabase
                            .from("conversations")
                            .update({ status: selectedConversation.status === "active" ? "archived" : "active" })
                            .eq("id", selectedConversation.id);
                          loadConversations();
                          setSelectedConversation(null);
                        }}
                      >
                        <Archive className="h-4 w-4 mr-2" />
                        {selectedConversation.status === "active" ? "Arhiviraj" : "Aktiviraj"}
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                    <Users className="h-4 w-4" />
                    <span>
                      {selectedConversation.participants?.map(p => 
                        p.profiles?.full_name || p.parent_email
                      ).join(", ")}
                    </span>
                  </div>
                </CardHeader>

                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {messages.map(msg => {
                      const isMine = isParent 
                        ? msg.sender_parent_email === parentEmail
                        : msg.sender_id === user?.id;
                      
                      const senderName = msg.sender_parent_email || msg.profiles?.full_name || "Sistem";

                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                        >
                          <div className={`max-w-[70%] ${isMine ? "bg-primary text-primary-foreground" : "bg-muted"} rounded-lg p-3`}>
                            {!isMine && (
                              <p className="text-xs font-medium mb-1 opacity-70">
                                {senderName}
                              </p>
                            )}
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            <p className={`text-xs mt-1 ${isMine ? "opacity-70" : "text-muted-foreground"}`}>
                              {format(new Date(msg.created_at), "d. M. yyyy HH:mm", { locale: sl })}
                            </p>
                          </div>
                        </div>
                      );
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
                      }}
                    />
                    <Button onClick={sendMessage} disabled={sendingMessage || !newMessage.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Pritisnite Enter za pošiljanje, Shift + Enter za novo vrstico
                  </p>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Izberite pogovor za prikaz sporočil</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}