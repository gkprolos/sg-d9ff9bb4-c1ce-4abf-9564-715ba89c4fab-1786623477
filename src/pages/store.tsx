import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/database.types";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ShoppingCart, Plus, Minus, Trash2, Package, AlertCircle, ChevronDown, ChevronUp, Edit, Eye } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type StoreOrder = Database["public"]["Tables"]["store_orders"]["Row"];
type StoreOrderItem = Database["public"]["Tables"]["store_order_items"]["Row"];
type StoreItem = Database["public"]["Tables"]["store_items"]["Row"];
type StoreCollectionPeriod = Database["public"]["Tables"]["store_collection_periods"]["Row"];
type Child = Database["public"]["Tables"]["children"]["Row"];

interface CartItem {
  item_id: string;
  item_number: string;
  item_name: string;
  name: string;
  item_price: number;
  price: number;
  size: string;
  quantity: number;
  image_url: string;
}

interface Order extends StoreOrder {
  children?: { first_name: string; last_name: string };
  store_collection_periods?: { period_name: string };
}

const ORDER_STATUSES = [
  { value: "open", label: "Odprto" },
  { value: "sprejeto", label: "Sprejeto" },
  { value: "naročeno", label: "Naročeno" },
  { value: "dobavljeno", label: "Dobavljeno" },
  { value: "račun", label: "Račun" },
];

export default function Store() {
  const { user, userRole } = useAuth();
  const router = useRouter();
  
  // Parent session detection (for OTP login)
  const [parentEmail, setParentEmail] = useState<string | null>(null);
  const [effectiveRole, setEffectiveRole] = useState<"admin" | "coach" | "parent" | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (user && userRole) {
        setEffectiveRole(userRole);
        setParentEmail(null);
      } else {
        // Check localStorage for parent email (set during OTP login)
        const storedEmail = localStorage.getItem("parent_email");
        if (storedEmail) {
          setParentEmail(storedEmail);
          setEffectiveRole("parent");
          console.log("Parent session detected from localStorage:", storedEmail);
        }
      }
    }
  }, [user, userRole]);

  const isParent = effectiveRole === "parent";
  const isAdminOrCoach = effectiveRole === "admin" || effectiveRole === "coach";

  // Admin/Coach State
  const [items, setItems] = useState<StoreItem[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showDeleted, setShowDeleted] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<StoreItem | null>(null);
  const [editingItem, setEditingItem] = useState<StoreItem | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  // Categories State
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<StoreCategory | null>(null);
  const [categoryFormData, setCategoryFormData] = useState({
    name: "",
    description: "",
    display_order: "0",
  });

  // Parent State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedChild, setSelectedChild] = useState<string>("");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<Record<string, StoreOrderItem[]>>({});
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [isItemsDialogOpen, setIsItemsDialogOpen] = useState(false);
  const [selectedOrderItems, setSelectedOrderItems] = useState<StoreOrderItem[]>([]);
  const [isEditStatusDialogOpen, setIsEditStatusDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [newStatus, setNewStatus] = useState<string>("");
  const [selectedSize, setSelectedSize] = useState<{ [key: string]: string }>({});
  const [parentSearchQuery, setParentSearchQuery] = useState("");
  const [parentCategoryFilter, setParentCategoryFilter] = useState<string>("all");

  // Admin Orders State
  const [allOrders, setAllOrders] = useState<StoreOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>("all");
  const [orderParentFilter, setOrderParentFilter] = useState<string>("all");
  const [isOrderStatusDialogOpen, setIsOrderStatusDialogOpen] = useState(false);
  const [isOrderItemsDialogOpen, setIsOrderItemsDialogOpen] = useState(false);
  const [orderStatusFormData, setOrderStatusFormData] = useState({
    status: "",
    ordered_at: "",
    delivered_at: "",
    invoiced_at: "",
  });
  const [isItemsDialogOpen, setIsItemsDialogOpen] = useState(false);
  const [selectedOrderItems, setSelectedOrderItems] = useState<StoreOrderItem[]>([]);
  const [isEditStatusDialogOpen, setIsEditStatusDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<string>("");

  // Collections State
  const [collections, setCollections] = useState<StoreCollection[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [isCreateCollectionDialogOpen, setIsCreateCollectionDialogOpen] = useState(false);
  const [isCollectionItemsDialogOpen, setIsCollectionItemsDialogOpen] = useState(false);
  const [isCollectionStatusDialogOpen, setIsCollectionStatusDialogOpen] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<StoreCollection | null>(null);
  const [collectionItems, setCollectionItems] = useState<StoreCollectionItem[]>([]);
  const [openOrdersPreview, setOpenOrdersPreview] = useState<StoreOrder[]>([]);
  const [collectionFormData, setCollectionFormData] = useState({
    collection_date: "",
    notes: "",
  });
  const [collectionStatusFormData, setCollectionStatusFormData] = useState({
    status: "",
    ordered_at: "",
    notes: "",
  });

  // Stats State
  const [stats, setStats] = useState<StoreStats>({
    total_orders: 0,
    total_revenue: 0,
    avg_order_value: 0,
  });
  const [topItems, setTopItems] = useState<TopItem[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyRevenue[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    item_number: "",
    name: "",
    description: "",
    category: "",
    available_sizes: [] as string[],
    price: "",
    quantity_in_stock: "0",
    low_stock_threshold: "5",
    external_link: "",
  });

  // Load data based on role
  useEffect(() => {
    if (effectiveRole) {
      loadCategories();
      if (isAdminOrCoach) {
        loadItems();
      } else if (isParent) {
        loadActiveItems();
        if (user?.id) {
          loadMyOrders(); // Only load orders if we have actual Supabase user
        }
      }
    }
  }, [effectiveRole, isAdminOrCoach, isParent, user]);

  // Load categories
  async function loadCategories() {
    try {
      const { data, error } = await supabase
        .from("store_categories")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (error: any) {
      console.error("Napaka pri nalaganju kategorij:", error);
    }
  }

  // Admin/Coach: Load all categories (including inactive)
  async function loadAllCategories() {
    try {
      const { data, error } = await supabase
        .from("store_categories")
        .select("*")
        .order("display_order", { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (error: any) {
      console.error("Napaka pri nalaganju kategorij:", error);
    }
  }

  // Admin/Coach: Save category
  async function handleCategorySubmit() {
    if (!categoryFormData.name) {
      toast({
        variant: "destructive",
        title: "Manjkajoči podatki",
        description: "Vnesi naziv kategorije",
      });
      return;
    }

    try {
      const categoryData = {
        name: categoryFormData.name.trim(),
        description: categoryFormData.description.trim() || null,
        display_order: parseInt(categoryFormData.display_order) || 0,
        updated_at: new Date().toISOString(),
        updated_by: user?.id,
      };

      if (editingCategory) {
        // Update
        const { error } = await supabase
          .from("store_categories")
          .update(categoryData)
          .eq("id", editingCategory.id);

        if (error) throw error;

        toast({
          title: "Uspešno",
          description: "Kategorija posodobljena",
        });
      } else {
        // Insert
        const { error } = await supabase
          .from("store_categories")
          .insert({
            ...categoryData,
            created_by: user?.id,
          });

        if (error) throw error;

        toast({
          title: "Uspešno",
          description: "Kategorija dodana",
        });
      }

      setIsCategoryDialogOpen(false);
      resetCategoryForm();
      loadAllCategories();
      loadCategories(); // Reload active categories
    } catch (error: any) {
      console.error("Napaka pri shranjevanju kategorije:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Ni mogoče shraniti kategorije",
      });
    }
  }

  // Admin/Coach: Toggle category active status
  async function toggleCategoryActive(category: StoreCategory) {
    try {
      const { error } = await supabase
        .from("store_categories")
        .update({
          is_active: !category.is_active,
          updated_at: new Date().toISOString(),
          updated_by: user?.id,
        })
        .eq("id", category.id);

      if (error) throw error;

      toast({
        title: "Uspešno",
        description: category.is_active ? "Kategorija deaktivirana" : "Kategorija aktivirana",
      });

      loadAllCategories();
      loadCategories();
    } catch (error: any) {
      console.error("Napaka pri spreminjanju statusa:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Ni mogoče spremeniti statusa",
      });
    }
  }

  // Admin/Coach: Edit category
  function handleEditCategory(category: StoreCategory) {
    setEditingCategory(category);
    setCategoryFormData({
      name: category.name,
      description: category.description || "",
      display_order: category.display_order.toString(),
    });
    setIsCategoryDialogOpen(true);
  }

  function resetCategoryForm() {
    setCategoryFormData({
      name: "",
      description: "",
      display_order: "0",
    });
    setEditingCategory(null);
  }

  // Admin/Coach: Load all items
  async function loadItems() {
    try {
      setLoading(true);
      let query = supabase
        .from("store_items")
        .select("*")
        .order("created_at", { ascending: false });

      // Filter out deleted items unless showDeleted is true
      if (!showDeleted) {
        query = query.is("deleted_at", null);
      }

      const { data, error } = await query;

      if (error) throw error;
      setItems(data || []);
    } catch (error: any) {
      console.error("Napaka pri nalaganju artiklov:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Ni mogoče naložiti artiklov",
      });
    } finally {
      setLoading(false);
    }
  }

  // Admin: Soft delete item
  async function handleDelete() {
    if (!itemToDelete) return;

    try {
      const { error } = await supabase
        .from("store_items")
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user?.id,
        })
        .eq("id", itemToDelete.id);

      if (error) throw error;

      toast({
        title: "Uspešno",
        description: `Artikel "${itemToDelete.name}" je bil pobrisan`,
      });

      setIsDeleteDialogOpen(false);
      setItemToDelete(null);
      loadItems();
    } catch (error: any) {
      console.error("Napaka pri brisanju artikla:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Ni mogoče pobrisati artikla",
      });
    }
  }

  // Reload items when showDeleted changes
  useEffect(() => {
    if (isAdminOrCoach && user) {
      loadItems();
    }
  }, [showDeleted]);

  // Parent: Load only active items
  // Load active items (for parents)
  async function loadActiveItems() {
    try {
      setLoading(true);
      console.log("loadActiveItems() called for parent user");
      console.log("Parent email:", parentEmail);
      console.log("Effective role:", effectiveRole);

      const { data, error } = await supabase
        .from("store_items")
        .select("*")
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("name");

      console.log("store_items query result:", { data, error });

      if (error) {
        console.error("Error loading active items:", error);
        throw error;
      }

      setItems(data || []);
      console.log("Active items loaded:", data?.length || 0);
    } catch (error) {
      console.error("loadActiveItems error:", error);
      toast({
        title: "Napaka",
        description: "Napaka pri nalaganju artiklov.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  // Parent: Load my orders
  async function loadMyOrders() {
    try {
      const { data, error } = await supabase
        .from("store_orders")
        .select("*")
        .eq("parent_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setMyOrders(data || []);
    } catch (error: any) {
      console.error("Napaka pri nalaganju naročil:", error);
    }
  }

  // Admin/Coach: Load all orders with parent info
  async function loadAllOrders() {
    try {
      setOrdersLoading(true);
      
      // Get all orders
      const { data: ordersData, error: ordersError } = await supabase
        .from("store_orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (ordersError) throw ordersError;

      // Get parent profiles for each order
      const parentIds = [...new Set(ordersData?.map(o => o.parent_id) || [])];
      
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone")
        .in("id", parentIds);

      if (profilesError) throw profilesError;

      // Merge parent info into orders
      const ordersWithParents = (ordersData || []).map(order => {
        const parent = profilesData?.find(p => p.id === order.parent_id);
        return {
          ...order,
          parent_name: parent?.full_name || "Neznan starš",
          parent_email: parent?.email || "",
          parent_phone: parent?.phone || "",
        };
      });

      setAllOrders(ordersWithParents);
    } catch (error: any) {
      console.error("Napaka pri nalaganju naročil:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Ni mogoče naložiti naročil",
      });
    } finally {
      setOrdersLoading(false);
    }
  }

  // Admin/Coach: Load order items
  async function loadOrderItems(orderId: string) {
    try {
      const { data, error } = await supabase
        .from("store_order_items")
        .select("*")
        .eq("order_id", orderId)
        .order("item_name", { ascending: true });

      if (error) throw error;
      setOrderItems({ [orderId]: data || [] });
    } catch (error: any) {
      console.error("Napaka pri nalaganju postavk:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Ni mogoče naložiti postavk naročila",
      });
    }
  }

  const fetchOrders = async () => {
    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from("store_orders")
        .select(`
          *,
          children (first_name, last_name),
          store_collection_periods (period_name)
        `)
        .order("created_at", { ascending: false });

      if (ordersError) throw ordersError;

      setMyOrders(ordersData || []);

      // Fetch items for all orders
      if (ordersData && ordersData.length > 0) {
        const orderIds = ordersData.map(o => o.id);
        const { data: itemsData, error: itemsError } = await supabase
          .from("store_order_items")
          .select("*")
          .in("order_id", orderIds);

        if (itemsError) throw itemsError;

        // Group items by order_id
        const itemsByOrder: Record<string, StoreOrderItem[]> = {};
        itemsData?.forEach(item => {
          if (!itemsByOrder[item.order_id]) {
            itemsByOrder[item.order_id] = [];
          }
          itemsByOrder[item.order_id].push(item as StoreOrderItem);
        });

        setOrderItems(itemsByOrder);
      }
    } catch (error: any) {
      toast({
        title: "Napaka",
        description: `Napaka pri nalaganju naročil: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  // Admin/Coach: Update order status
  async function handleOrderStatusUpdate() {
    if (!editingOrder) return;

    try {
      const updateData: any = {
        status: orderStatusFormData.status,
        updated_at: new Date().toISOString(),
        updated_by: user?.id,
      };

      // Update dates based on status
      if (orderStatusFormData.status === "ordered" && orderStatusFormData.ordered_at) {
        updateData.ordered_at = new Date(orderStatusFormData.ordered_at).toISOString();
      }

      if (orderStatusFormData.status === "delivered" && orderStatusFormData.delivered_at) {
        updateData.delivered_at = new Date(orderStatusFormData.delivered_at).toISOString();
      }

      if (orderStatusFormData.invoiced_at) {
        updateData.invoiced_at = new Date(orderStatusFormData.invoiced_at).toISOString();
      } else {
        updateData.invoiced_at = null;
      }

      const { error } = await supabase
        .from("store_orders")
        .update(updateData)
        .eq("id", editingOrder.id);

      if (error) throw error;

      toast({
        title: "Uspešno",
        description: "Status naročila posodobljen",
      });

      setIsOrderStatusDialogOpen(false);
      setEditingOrder(null);
      loadAllOrders();
    } catch (error: any) {
      console.error("Napaka pri posodabljanju statusa:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Ni mogoče posodobiti statusa",
      });
    }
  }

  const updateOrderStatus = async () => {
    if (!editingOrder || !newStatus) return;

    try {
      // Update order status
      const { error: orderError } = await supabase
        .from("store_orders")
        .update({ status: newStatus })
        .eq("id", editingOrder.id);

      if (orderError) throw orderError;

      toast({
        title: "Status posodobljen",
        description: `Status naročila ${editingOrder.order_number} je bil spremenjen v "${ORDER_STATUSES.find(s => s.value === newStatus)?.label}".`,
      });

      setIsEditStatusDialogOpen(false);
      setEditingOrder(null);
      setNewStatus("");
      fetchOrders(); // Refresh orders
    } catch (error: any) {
      toast({
        title: "Napaka",
        description: `Napaka pri posodabljanju statusa: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const toggleOrderExpand = (orderId: string) => {
    const newExpanded = new Set(expandedOrders);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
    }
    setExpandedOrders(newExpanded);
  };

  const openItemsDialog = (orderId: string) => {
    setSelectedOrderItems(orderItems[orderId] || []);
    setIsItemsDialogOpen(true);
  };

  const openEditStatusDialog = (order: Order) => {
    setEditingOrder(order);
    setNewStatus(order.status);
    setIsEditStatusDialogOpen(true);
  };

  function handleEditOrderStatus(order: StoreOrder) {
    setEditingOrder(order);
    setOrderStatusFormData({
      status: order.status,
      ordered_at: order.ordered_at ? new Date(order.ordered_at).toISOString().split("T")[0] : "",
      delivered_at: order.delivered_at ? new Date(order.delivered_at).toISOString().split("T")[0] : "",
      invoiced_at: order.invoiced_at ? new Date(order.invoiced_at).toISOString().split("T")[0] : "",
    });
    setIsOrderStatusDialogOpen(true);
  }

  function handleViewOrderItems(order: StoreOrder) {
    setEditingOrder(order);
    loadOrderItems(order.id);
    setIsOrderItemsDialogOpen(true);
  }

  // Admin: Load all collections
  async function loadCollections() {
    try {
      setCollectionsLoading(true);

      const { data: collectionsData, error: collectionsError } = await supabase
        .from("store_collections")
        .select("*")
        .order("collection_date", { ascending: false });

      if (collectionsError) throw collectionsError;

      // Get stats for each collection
      const collectionsWithStats = await Promise.all(
        (collectionsData || []).map(async (collection) => {
          // Count orders in collection
          const { count: ordersCount } = await supabase
            .from("store_orders")
            .select("*", { count: "exact", head: true })
            .eq("collection_id", collection.id);

          // Get total items and amount
          const { data: itemsData } = await supabase
            .from("store_collection_items")
            .select("total_quantity, unit_price")
            .eq("collection_id", collection.id);

          const totalItems = itemsData?.reduce((sum, item) => sum + item.total_quantity, 0) || 0;
          const totalAmount = itemsData?.reduce((sum, item) => sum + (item.total_quantity * item.unit_price), 0) || 0;

          return {
            ...collection,
            total_orders: ordersCount || 0,
            total_items: totalItems,
            total_amount: totalAmount,
          };
        })
      );

      setCollections(collectionsWithStats);
    } catch (error: any) {
      console.error("Napaka pri nalaganju zbirnikov:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Ni mogoče naložiti zbirnikov",
      });
    } finally {
      setCollectionsLoading(false);
    }
  }

  // Admin: Load open orders for preview
  async function loadOpenOrdersPreview() {
    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from("store_orders")
        .select("*")
        .eq("status", "open")
        .is("collection_id", null)
        .order("created_at", { ascending: false });

      if (ordersError) throw ordersError;

      // Get parent profiles
      const parentIds = [...new Set(ordersData?.map(o => o.parent_id) || [])];
      
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", parentIds);

      const ordersWithParents = (ordersData || []).map(order => {
        const parent = profilesData?.find(p => p.id === order.parent_id);
        return {
          ...order,
          parent_name: parent?.full_name || "Neznan",
          parent_email: parent?.email || "",
        };
      });

      setOpenOrdersPreview(ordersWithParents);
    } catch (error: any) {
      console.error("Napaka pri nalaganju odprtih naročil:", error);
    }
  }

  // Admin: Create collection
  async function handleCreateCollection() {
    if (!collectionFormData.collection_date) {
      toast({
        variant: "destructive",
        title: "Manjkajoči podatki",
        description: "Vnesi datum zbirnika",
      });
      return;
    }

    try {
      // Create collection
      const { data: collectionData, error: collectionError } = await supabase
        .from("store_collections")
        .insert({
          collection_number: "", // Auto-generated by trigger
          collection_date: collectionFormData.collection_date,
          notes: collectionFormData.notes || null,
          status: "draft",
          created_by: user?.id,
        })
        .select()
        .single();

      if (collectionError) throw collectionError;

      // Get all open orders (not yet in a collection)
      const { data: openOrders, error: ordersError } = await supabase
        .from("store_orders")
        .select("id")
        .eq("status", "open")
        .is("collection_id", null);

      if (ordersError) throw ordersError;

      if (!openOrders || openOrders.length === 0) {
        toast({
          variant: "destructive",
          title: "Ni odprtih naročil",
          description: "Ni naročil za združevanje v zbirnik",
        });
        return;
      }

      // Link orders to collection
      const { error: linkError } = await supabase
        .from("store_orders")
        .update({ collection_id: collectionData.id })
        .in("id", openOrders.map(o => o.id));

      if (linkError) throw linkError;

      // Aggregate order items
      const { data: orderItems, error: itemsError } = await supabase
        .from("store_order_items")
        .select("*")
        .in("order_id", openOrders.map(o => o.id));

      if (itemsError) throw itemsError;

      // Group by item_number + size
      const aggregated = (orderItems || []).reduce((acc: any, item) => {
        const key = `${item.item_number}-${item.size}`;
        if (!acc[key]) {
          acc[key] = {
            collection_id: collectionData.id,
            item_id: item.item_id,
            item_number: item.item_number,
            item_name: item.item_name,
            size: item.size,
            total_quantity: 0,
            unit_price: item.unit_price,
          };
        }
        acc[key].total_quantity += item.quantity;
        return acc;
      }, {});

      // Insert aggregated items
      const aggregatedItems: any[] = Object.values(aggregated);
      
      if (aggregatedItems.length > 0) {
        const { error: insertError } = await supabase
          .from("store_collection_items")
          .insert(aggregatedItems);

        if (insertError) throw insertError;
      }

      toast({
        title: "Uspešno",
        description: `Zbirnik ${collectionData.collection_number} ustvarjen z ${openOrders.length} naročili`,
      });

      setIsCreateCollectionDialogOpen(false);
      setCollectionFormData({ collection_date: "", notes: "" });
      setOpenOrdersPreview([]);
      loadCollections();
    } catch (error: any) {
      console.error("Napaka pri ustvarjanju zbirnika:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Ni mogoče ustvariti zbirnika",
      });
    }
  }

  // Admin: Load collection items
  async function loadCollectionItems(collectionId: string) {
    try {
      const { data, error } = await supabase
        .from("store_collection_items")
        .select("*")
        .eq("collection_id", collectionId)
        .order("item_number", { ascending: true })
        .order("size", { ascending: true });

      if (error) throw error;
      setCollectionItems(data || []);
    } catch (error: any) {
      console.error("Napaka pri nalaganju postavk zbirnika:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Ni mogoče naložiti postavk zbirnika",
      });
    }
  }

  // Admin: Update collection status
  async function handleCollectionStatusUpdate() {
    if (!selectedCollection) return;

    try {
      const updateData: any = {
        status: collectionStatusFormData.status,
        notes: collectionStatusFormData.notes || null,
        updated_at: new Date().toISOString(),
        updated_by: user?.id,
      };

      if (collectionStatusFormData.status === "ordered" && collectionStatusFormData.ordered_at) {
        updateData.ordered_at = new Date(collectionStatusFormData.ordered_at).toISOString();
        updateData.ordered_by = user?.id;

        // Update all orders in this collection to "ordered" status
        const { error: ordersError } = await supabase
          .from("store_orders")
          .update({ 
            status: "ordered",
            ordered_at: updateData.ordered_at,
          })
          .eq("collection_id", selectedCollection.id);

        if (ordersError) throw ordersError;
      }

      const { error } = await supabase
        .from("store_collections")
        .update(updateData)
        .eq("id", selectedCollection.id);

      if (error) throw error;

      toast({
        title: "Uspešno",
        description: "Status zbirnika posodobljen",
      });

      setIsCollectionStatusDialogOpen(false);
      setSelectedCollection(null);
      loadCollections();
    } catch (error: any) {
      console.error("Napaka pri posodabljanju statusa:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Ni mogoče posodobiti statusa",
      });
    }
  }

  function handleViewCollectionItems(collection: StoreCollection) {
    setSelectedCollection(collection);
    loadCollectionItems(collection.id);
    setIsCollectionItemsDialogOpen(true);
  }

  function handleEditCollectionStatus(collection: StoreCollection) {
    setSelectedCollection(collection);
    setCollectionStatusFormData({
      status: collection.status,
      ordered_at: collection.ordered_at ? new Date(collection.ordered_at).toISOString().split("T")[0] : "",
      notes: collection.notes || "",
    });
    setIsCollectionStatusDialogOpen(true);
  }

  // Export collection to CSV
  function exportCollectionToCSV(collection: StoreCollection) {
    if (collectionItems.length === 0) {
      toast({
        variant: "destructive",
        title: "Ni podatkov",
        description: "Naloži postavke zbirnika najprej",
      });
      return;
    }

    const headers = ["Številka", "Artikel", "Velikost", "Količina", "Cena", "Skupaj"];
    const rows = collectionItems.map(item => [
      item.item_number,
      item.item_name,
      item.size,
      item.total_quantity,
      item.unit_price.toFixed(2),
      (item.total_quantity * item.unit_price).toFixed(2),
    ]);

    const csvContent = [
      `Zbirnik: ${collection.collection_number}`,
      `Datum: ${new Date(collection.collection_date).toLocaleDateString("sl-SI")}`,
      "",
      headers.join(","),
      ...rows.map(row => row.join(",")),
      "",
      `Skupaj artiklov: ${collectionItems.reduce((sum, item) => sum + item.total_quantity, 0)}`,
      `Skupaj znesek: ${collectionItems.reduce((sum, item) => sum + (item.total_quantity * item.unit_price), 0).toFixed(2)} EUR`,
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${collection.collection_number}.csv`;
    link.click();

    toast({
      title: "Izvoženo",
      description: "CSV datoteka prenesena",
    });
  }

  // Admin: Load stats
  async function loadStats() {
    try {
      setStatsLoading(true);

      // Overall stats
      const { data: ordersData, error: ordersError } = await supabase
        .from("store_orders")
        .select("total_amount")
        .in("status", ["ordered", "delivered"]);

      if (ordersError) throw ordersError;

      const totalOrders = ordersData?.length || 0;
      const totalRevenue = ordersData?.reduce((sum, o) => sum + o.total_amount, 0) || 0;
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      setStats({
        total_orders: totalOrders,
        total_revenue: totalRevenue,
        avg_order_value: avgOrderValue,
      });

      // Top items
      const { data: topItemsData, error: topItemsError } = await supabase
        .from("store_collection_items")
        .select("item_number, item_name, total_quantity, unit_price, collection_id")
        .order("total_quantity", { ascending: false });

      if (topItemsError) throw topItemsError;

      // Aggregate by item_number
      const aggregated = (topItemsData || []).reduce((acc: any, item) => {
        if (!acc[item.item_number]) {
          acc[item.item_number] = {
            item_number: item.item_number,
            item_name: item.item_name,
            total_sold: 0,
            collections_count: new Set(),
            total_revenue: 0,
          };
        }
        acc[item.item_number].total_sold += item.total_quantity;
        acc[item.item_number].collections_count.add(item.collection_id);
        acc[item.item_number].total_revenue += item.total_quantity * item.unit_price;
        return acc;
      }, {});

      const topItemsArray = Object.values(aggregated).map((item: any) => ({
        item_number: item.item_number,
        item_name: item.item_name,
        total_sold: item.total_sold,
        collections_count: item.collections_count.size,
        total_revenue: item.total_revenue,
      })) as TopItem[];

      topItemsArray.sort((a, b) => b.total_sold - a.total_sold);
      setTopItems(topItemsArray.slice(0, 5));

      // Monthly revenue (last 6 months)
      const { data: collectionsData, error: collectionsError } = await supabase
        .from("store_collections")
        .select("id, collection_date, status")
        .in("status", ["ordered", "received"])
        .gte("collection_date", new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString())
        .order("collection_date", { ascending: true });

      if (collectionsError) throw collectionsError;

      const monthlyData: { [key: string]: MonthlyRevenue } = {};

      for (const collection of collectionsData || []) {
        const month = new Date(collection.collection_date).toLocaleDateString("sl-SI", {
          month: "short",
          year: "numeric",
        });

        if (!monthlyData[month]) {
          monthlyData[month] = {
            month,
            orders_count: 0,
            total_revenue: 0,
            avg_order_value: 0,
          };
        }

        // Get orders for this collection
        const { data: ordersInCollection } = await supabase
          .from("store_orders")
          .select("total_amount")
          .eq("collection_id", collection.id);

        const ordersCount = ordersInCollection?.length || 0;
        const revenue = ordersInCollection?.reduce((sum, o) => sum + o.total_amount, 0) || 0;

        monthlyData[month].orders_count += ordersCount;
        monthlyData[month].total_revenue += revenue;
      }

      // Calculate avg order value
      const monthlyArray = Object.values(monthlyData).map((m) => ({
        ...m,
        avg_order_value: m.orders_count > 0 ? m.total_revenue / m.orders_count : 0,
      }));

      setMonthlyRevenue(monthlyArray);
    } catch (error: any) {
      console.error("Napaka pri nalaganju statistike:", error);
    } finally {
      setStatsLoading(false);
    }
  }

  // Print collection
  function printCollection() {
    window.print();
  }

  // Parent: Add to cart
  function addToCart(item: StoreItem) {
    const size = selectedSize[item.id];
    if (!size) {
      toast({
        variant: "destructive",
        title: "Izberi velikost",
        description: "Prosim izberi velikost artikla",
      });
      return;
    }

    const existingIndex = cart.findIndex(
      (c) => c.item_id === item.id && c.size === size
    );

    if (existingIndex >= 0) {
      // Update quantity
      const newCart = [...cart];
      newCart[existingIndex].quantity += 1;
      setCart(newCart);
    } else {
      // Add new item
      setCart([
        ...cart,
        {
          item_id: item.id,
          item_number: item.item_number,
          name: item.name,
          size,
          quantity: 1,
          price: item.price,
          image_url: item.image_url,
        },
      ]);
    }

    toast({
      title: "Dodano v košarico",
      description: `${item.name} (${size})`,
    });
  }

  // Parent: Update cart quantity
  function updateCartQuantity(index: number, delta: number) {
    const newCart = [...cart];
    newCart[index].quantity += delta;
    if (newCart[index].quantity <= 0) {
      newCart.splice(index, 1);
    }
    setCart(newCart);
  }

  // Parent: Remove from cart
  function removeFromCart(index: number) {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
  }

  // Parent: Place order
  async function placeOrder() {
    if (cart.length === 0) {
      toast({
        variant: "destructive",
        title: "Prazna košarica",
        description: "Dodaj artikle v košarico",
      });
      return;
    }

    try {
      const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

      // Create order
      const { data: orderData, error: orderError } = await supabase
        .from("store_orders")
        .insert({
          parent_id: user?.id,
          total_amount: totalAmount,
          status: "open",
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Insert order items
      const orderItems = cart.map((item) => ({
        order_id: orderData.id,
        item_id: item.item_id,
        item_number: item.item_number,
        item_name: item.name,
        size: item.size,
        quantity: item.quantity,
        unit_price: item.price,
        subtotal: item.price * item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from("store_order_items")
        .insert(orderItems);

      if (itemsError) throw itemsError;

      toast({
        title: "Naročilo oddano",
        description: `Številka naročila: ${orderData.order_number}`,
      });

      // Clear cart and reload orders
      setCart([]);
      setIsCartOpen(false);
      loadMyOrders();
    } catch (error: any) {
      console.error("Napaka pri oddaji naročila:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Ni mogoče oddati naročila",
      });
    }
  }

  // Parent: Cancel order
  async function cancelOrder(orderId: string) {
    try {
      const { error } = await supabase
        .from("store_orders")
        .update({ status: "cancelled" })
        .eq("id", orderId);

      if (error) throw error;

      toast({
        title: "Naročilo preklicano",
      });

      loadMyOrders();
    } catch (error: any) {
      console.error("Napaka pri preklicu naročila:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Ni mogoče preklicati naročila",
      });
    }
  }

  // Admin/Coach: Handle form submission
  async function handleSubmit() {
    if (!formData.item_number || !formData.name || !formData.price) {
      toast({
        variant: "destructive",
        title: "Manjkajoči podatki",
        description: "Prosim izpolni vse obvezne podatke",
      });
      return;
    }

    try {
      let imageUrl = editingItem?.image_url || "";

      // Upload new image if provided
      if (imageFile) {
        const fileExt = imageFile.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = fileName;

        const { error: uploadError } = await supabase.storage
          .from("store-items")
          .upload(filePath, imageFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("store-items")
          .getPublicUrl(filePath);

        imageUrl = urlData.publicUrl;
      }

      const itemData = {
        item_number: formData.item_number.trim(),
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        category: formData.category,
        available_sizes: formData.available_sizes,
        price: parseFloat(formData.price),
        quantity_in_stock: parseInt(formData.quantity_in_stock) || 0,
        low_stock_threshold: parseInt(formData.low_stock_threshold) || 5,
        image_url: imageUrl,
        external_link: formData.external_link.trim() || null,
        updated_at: new Date().toISOString(),
        updated_by: user?.id,
      };

      if (editingItem) {
        // Update existing item
        const { error } = await supabase
          .from("store_items")
          .update(itemData)
          .eq("id", editingItem.id);

        if (error) throw error;

        toast({
          title: "Uspešno",
          description: "Artikel je bil posodobljen",
        });
        setIsEditDialogOpen(false);
      } else {
        // Create new item
        const { error } = await supabase
          .from("store_items")
          .insert({
            ...itemData,
            created_by: user?.id,
          });

        if (error) throw error;

        toast({
          title: "Uspešno",
          description: "Artikel je bil dodan",
        });
        setIsAddDialogOpen(false);
      }

      // Reset form and reload
      resetForm();
      loadItems();
    } catch (error: any) {
      console.error("Napaka pri shranjevanju:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: error.message || "Ni mogoče shraniti artikla",
      });
    }
  }

  // Admin/Coach: Toggle active status
  async function toggleActive(item: StoreItem) {
    try {
      const { error } = await supabase
        .from("store_items")
        .update({
          is_active: !item.is_active,
          updated_at: new Date().toISOString(),
          updated_by: user?.id,
        })
        .eq("id", item.id);

      if (error) throw error;

      toast({
        title: "Uspešno",
        description: item.is_active ? "Artikel deaktiviran" : "Artikel aktiviran",
      });

      loadItems();
    } catch (error: any) {
      console.error("Napaka pri spreminjanju statusa:", error);
      toast({
        variant: "destructive",
        title: "Napaka",
        description: "Ni mogoče spremeniti statusa",
      });
    }
  }

  function handleEdit(item: StoreItem) {
    setEditingItem(item);

    const sizes = Array.isArray(item.available_sizes)
      ? (item.available_sizes as string[])
      : [];

    setFormData({
      item_number: item.item_number,
      name: item.name,
      description: item.description || "",
      category: item.category || "",
      available_sizes: sizes,
      price: item.price.toString(),
      quantity_in_stock: item.quantity_in_stock?.toString() || "0",
      low_stock_threshold: item.low_stock_threshold?.toString() || "5",
      external_link: item.external_link || "",
    });
    setImagePreview(item.image_url || "");
    setImageFile(null);
    setIsEditDialogOpen(true);
  }

  function resetForm() {
    setFormData({
      item_number: "",
      name: "",
      description: "",
      category: "",
      available_sizes: [],
      price: "",
      quantity_in_stock: "0",
      low_stock_threshold: "5",
      external_link: "",
    });
    setImagePreview("");
    setImageFile(null);
    setEditingItem(null);
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  // Filter items (Admin/Coach)
  const filteredItems = items.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.item_number.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Filter items (Parent)
  const filteredParentItems = items.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(parentSearchQuery.toLowerCase()) ||
      item.item_number.toLowerCase().includes(parentSearchQuery.toLowerCase());
    const matchesCategory = parentCategoryFilter === "all" || item.category === parentCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Cart total
  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Status badge helper
  function getStatusBadge(status: string) {
    switch (status) {
      case "open":
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Odprto</Badge>;
      case "ordered":
        return <Badge className="bg-blue-500"><Package className="w-3 h-3 mr-1" />Naročeno</Badge>;
      case "delivered":
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Predano</Badge>;
      case "cancelled":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Preklicano</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  }

  // Parent UI (continue existing parent code with categories from database)
  if (isParent) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/dashboard")}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Nazaj
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Oprema</h1>
              <p className="text-muted-foreground mt-1">
                Naroči opremo za svojega otroka
              </p>
            </div>
          </div>
          <Button
            size="lg"
            onClick={() => setIsCartOpen(true)}
            className="relative"
          >
            <ShoppingCart className="w-5 h-5 mr-2" />
            Košarica
            {cartCount > 0 && (
              <Badge className="absolute -top-2 -right-2 bg-red-500">
                {cartCount}
              </Badge>
            )}
          </Button>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <Input
              placeholder="Iskanje po nazivu ali številki..."
              value={parentSearchQuery}
              onChange={(e) => setParentSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={parentCategoryFilter} onValueChange={setParentCategoryFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Vse kategorije</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Product Grid - rest of parent UI remains the same */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Nalaganje...</p>
          </div>
        ) : filteredParentItems.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Ni artiklov</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredParentItems.map((item) => (
              <Card key={item.id} className="flex flex-col">
                <CardHeader className="p-0">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-full h-48 object-cover rounded-t-lg cursor-pointer hover:opacity-90 transition"
                      onClick={() => setZoomImage(item.image_url)}
                    />
                  ) : (
                    <div className="w-full h-48 bg-muted flex items-center justify-center rounded-t-lg">
                      <ImageIcon className="w-12 h-12 text-muted-foreground" />
                    </div>
                  )}
                </CardHeader>
                <CardContent className="flex-1 p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg leading-tight">{item.name}</h3>
                      <p className="text-sm text-muted-foreground">Št. {item.item_number}</p>
                    </div>
                    {item.external_link && (
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                      >
                        <a href={item.external_link} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {item.description}
                    </p>
                  )}
                  {item.category && (
                    <Badge variant="secondary" className="mb-3">{item.category}</Badge>
                  )}
                  <p className="text-2xl font-bold mb-3">{item.price.toFixed(2)} €</p>

                  {/* Size Selector */}
                  {Array.isArray(item.available_sizes) && item.available_sizes.length > 0 && (
                    <div className="mb-3">
                      <Label className="text-xs mb-2 block">Velikost:</Label>
                      <Select
                        value={selectedSize[item.id] || ""}
                        onValueChange={(value) =>
                          setSelectedSize({ ...selectedSize, [item.id]: value })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Izberi velikost" />
                        </SelectTrigger>
                        <SelectContent>
                          {(item.available_sizes as string[]).map((size) => (
                            <SelectItem key={size} value={size}>{size}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="p-4 pt-0">
                  <Button
                    className="w-full"
                    onClick={() => addToCart(item)}
                    disabled={
                      Array.isArray(item.available_sizes) &&
                      item.available_sizes.length > 0 &&
                      !selectedSize[item.id]
                    }
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Dodaj v košarico
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}

        {/* My Orders Section - remains the same */}
        {myOrders.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-4">Moja naročila</h2>
            <div className="grid gap-4">
              {myOrders.map((order) => (
                <Card key={order.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{order.order_number}</CardTitle>
                        <CardDescription>
                          {new Date(order.created_at).toLocaleDateString("sl-SI", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </CardDescription>
                      </div>
                      <div className="text-right">
                        {getStatusBadge(order.status)}
                        <p className="text-2xl font-bold mt-2">
                          {order.total_amount.toFixed(2)} €
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  {order.status === "open" && (
                    <CardFooter>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => cancelOrder(order.id)}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Prekliči naročilo
                      </Button>
                    </CardFooter>
                  )}
                  {order.delivered_at && (
                    <CardFooter className="text-sm text-muted-foreground">
                      Predano: {new Date(order.delivered_at).toLocaleDateString("sl-SI")}
                    </CardFooter>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Cart Dialog - remains the same */}
        <Dialog open={isCartOpen} onOpenChange={setIsCartOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Košarica</DialogTitle>
              <DialogDescription>
                {cart.length === 0 ? "Košarica je prazna" : `${cartCount} artikel(i) v košarici`}
              </DialogDescription>
            </DialogHeader>

            {cart.length > 0 && (
              <div className="space-y-4">
                {cart.map((item, index) => (
                  <div key={`${item.item_id}-${item.size}`} className="flex items-center gap-4 border-b pb-4">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-20 h-20 object-cover rounded"
                      />
                    ) : (
                      <div className="w-20 h-20 bg-muted rounded flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1">
                      <h4 className="font-semibold">{item.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        Velikost: {item.size} • Št. {item.item_number}
                      </p>
                      <p className="text-sm font-medium mt-1">{item.price.toFixed(2)} €</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateCartQuantity(index, -1)}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <span className="w-8 text-center font-medium">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateCartQuantity(index, 1)}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFromCart(index)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="text-right font-semibold">
                      {(item.price * item.quantity).toFixed(2)} €
                    </div>
                  </div>
                ))}

                <div className="flex items-center justify-between pt-4 border-t">
                  <span className="text-lg font-semibold">Skupaj:</span>
                  <span className="text-2xl font-bold">{cartTotal.toFixed(2)} €</span>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCartOpen(false)}>
                Nadaljuj z nakupovanjem
              </Button>
              <Button onClick={placeOrder} disabled={cart.length === 0}>
                Oddaj naročilo
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Image Zoom Dialog */}
        <Dialog open={!!zoomImage} onOpenChange={() => setZoomImage(null)}>
          <DialogContent className="max-w-4xl">
            <img src={zoomImage || ""} alt="Povečana slika" className="w-full h-auto object-contain rounded" />
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Admin/Coach UI
  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Nazaj
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Trgovina - Oprema</h1>
            <p className="text-muted-foreground mt-1">
              Upravljanje artiklov in naročil
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="artikli" className="w-full" onValueChange={(value) => {
        if (value === "kategorije") {
          loadAllCategories(); // Load all categories (including inactive) for admin
        }
      }}>
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="artikli">Artikli</TabsTrigger>
          <TabsTrigger value="kategorije">Kategorije</TabsTrigger>
          <TabsTrigger value="narocila">Naročila</TabsTrigger>
          <TabsTrigger value="zbirniki">Zbirniki</TabsTrigger>
        </TabsList>

        <TabsContent value="artikli">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Artikli</CardTitle>
                  <CardDescription>Upravljanje kataloga opreme</CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  {userRole === "admin" && (
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="show-deleted"
                        checked={showDeleted}
                        onCheckedChange={(checked) => setShowDeleted(checked as boolean)}
                      />
                      <label
                        htmlFor="show-deleted"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Prikaži pobrisane
                      </label>
                    </div>
                  )}
                  <Button onClick={() => setIsAddDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Dodaj artikel
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Search and Filter */}
              <div className="flex gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                  <Input
                    placeholder="Iskanje po nazivu ali številki..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Vse kategorije</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Nalaganje...</p>
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Ni artiklov</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Št.</TableHead>
                      <TableHead>Slika</TableHead>
                      <TableHead>Naziv</TableHead>
                      <TableHead>Kategorija</TableHead>
                      <TableHead>Velikosti</TableHead>
                      <TableHead>Zaloga</TableHead>
                      <TableHead>Cena</TableHead>
                      <TableHead className="text-right">Akcije</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((item) => (
                      <TableRow 
                        key={item.id}
                        className={(item as any).deleted_at ? "bg-muted/50" : ""}
                      >
                        <TableCell className="font-mono text-sm">
                          {item.item_number}
                        </TableCell>
                        <TableCell>
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="w-16 h-12 object-cover rounded cursor-pointer hover:opacity-80 transition"
                              onClick={() => setZoomImage(item.image_url)}
                            />
                          ) : (
                            <div className="w-16 h-12 bg-muted rounded flex items-center justify-center">
                              <ImageIcon className="w-6 h-6 text-muted-foreground" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.name}</p>
                            <div className="flex gap-2 mt-1">
                              {!item.is_active && (
                                <Badge variant="secondary">Neaktiven</Badge>
                              )}
                              {(item as any).deleted_at && (
                                <Badge variant="destructive">Pobrisan</Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {item.category ? (
                            <Badge variant="outline">{item.category}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {Array.isArray(item.available_sizes) && item.available_sizes.length > 0
                            ? (item.available_sizes as string[]).join(", ")
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.quantity_in_stock || 0}</p>
                            {item.quantity_in_stock !== null &&
                              item.low_stock_threshold !== null &&
                              item.quantity_in_stock <= item.low_stock_threshold && (
                                <Badge variant="destructive" className="text-xs mt-1">
                                  Nizka zaloga
                                </Badge>
                              )}
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold">
                          {item.price.toFixed(2)} €
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {!(item as any).deleted_at && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(item)}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant={item.is_active ? "destructive" : "default"}
                                  size="sm"
                                  onClick={() => toggleActive(item)}
                                >
                                  {item.is_active ? "Deaktiviraj" : "Aktiviraj"}
                                </Button>
                                {userRole === "admin" && (
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => {
                                      setItemToDelete(item);
                                      setIsDeleteDialogOpen(true);
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                )}
                              </>
                            )}
                            {(item as any).deleted_at && (
                              <span className="text-xs text-muted-foreground">
                                Pobrisan {new Date((item as any).deleted_at).toLocaleDateString("sl-SI")}
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kategorije">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Kategorije</CardTitle>
                  <CardDescription>Upravljanje kategorij artiklov</CardDescription>
                </div>
                <Button onClick={() => {
                  resetCategoryForm();
                  setIsCategoryDialogOpen(true);
                }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Dodaj kategorijo
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {categories.length === 0 ? (
                <div className="text-center py-12">
                  <Tag className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Ni kategorij</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Naziv</TableHead>
                      <TableHead>Opis</TableHead>
                      <TableHead>Vrstni red</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Akcije</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map((category) => (
                      <TableRow key={category.id}>
                        <TableCell className="font-medium">{category.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {category.description || "-"}
                        </TableCell>
                        <TableCell>{category.display_order}</TableCell>
                        <TableCell>
                          {category.is_active ? (
                            <Badge variant="default">Aktivna</Badge>
                          ) : (
                            <Badge variant="secondary">Neaktivna</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditCategory(category)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant={category.is_active ? "destructive" : "default"}
                              size="sm"
                              onClick={() => toggleCategoryActive(category)}
                            >
                              {category.is_active ? "Deaktiviraj" : "Aktiviraj"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="narocila" onFocus={() => loadAllOrders()}>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Naročila</CardTitle>
                  <CardDescription>Pregled vseh naročil staršev</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex gap-4 mb-6">
                <Select value={orderStatusFilter} onValueChange={setOrderStatusFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Vsi statusi</SelectItem>
                    <SelectItem value="open">Odprto</SelectItem>
                    <SelectItem value="ordered">Naročeno</SelectItem>
                    <SelectItem value="delivered">Predano</SelectItem>
                    <SelectItem value="cancelled">Preklicano</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={orderParentFilter} onValueChange={setOrderParentFilter}>
                  <SelectTrigger className="w-[250px]">
                    <SelectValue placeholder="Vsi starši" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Vsi starši</SelectItem>
                    {[...new Set(allOrders.map(o => o.parent_name))].sort().map((name) => (
                      <SelectItem key={name} value={name || ""}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button variant="outline" onClick={loadAllOrders}>
                  Osveži
                </Button>
              </div>

              {ordersLoading ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Nalaganje...</p>
                </div>
              ) : allOrders.filter(order => {
                const matchesStatus = orderStatusFilter === "all" || order.status === orderStatusFilter;
                const matchesParent = orderParentFilter === "all" || order.parent_name === orderParentFilter;
                return matchesStatus && matchesParent;
              }).length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Ni naročil</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Številka</TableHead>
                      <TableHead>Otrok</TableHead>
                      <TableHead>Obdobje</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Znesek</TableHead>
                      <TableHead>Datum</TableHead>
                      <TableHead className="text-right">Akcije</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                          Ni naročil
                        </TableCell>
                      </TableRow>
                    ) : (
                      myOrders.map((order) => {
                        const items = orderItems[order.id] || [];
                        const isExpanded = expandedOrders.has(order.id);
                        
                        return (
                          <>
                            <TableRow key={order.id} className="group">
                              <TableCell>
                                {items.length > 0 && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleOrderExpand(order.id)}
                                  >
                                    {isExpanded ? (
                                      <ChevronUp className="h-4 w-4" />
                                    ) : (
                                      <ChevronDown className="h-4 w-4" />
                                    )}
                                  </Button>
                                )}
                              </TableCell>
                              <TableCell className="font-medium">{order.order_number}</TableCell>
                              <TableCell>
                                {order.children ? `${order.children.first_name} ${order.children.last_name}` : "N/A"}
                              </TableCell>
                              <TableCell>
                                {order.store_collection_periods?.period_name || "N/A"}
                              </TableCell>
                              <TableCell>
                                <Badge variant={
                                  order.status === "račun" ? "default" :
                                  order.status === "dobavljeno" ? "secondary" :
                                  order.status === "naročeno" ? "outline" :
                                  "destructive"
                                }>
                                  {ORDER_STATUSES.find(s => s.value === order.status)?.label || order.status}
                                </Badge>
                              </TableCell>
                              <TableCell>{order.total_amount.toFixed(2)} €</TableCell>
                              <TableCell>{new Date(order.created_at).toLocaleDateString("sl-SI")}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  {items.length > 0 && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openItemsDialog(order.id)}
                                    >
                                      <Eye className="h-4 w-4 mr-1" />
                                      Postavke
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openEditStatusDialog(order)}
                                  >
                                    <Edit className="h-4 w-4 mr-1" />
                                    Uredi
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                            {isExpanded && items.length > 0 && (
                              <TableRow key={`${order.id}-items`}>
                                <TableCell colSpan={8} className="bg-muted/50 p-4">
                                  <div className="space-y-1 text-sm">
                                    <div className="font-semibold mb-2">Postavke naročila:</div>
                                    {items.map((item, idx) => (
                                      <div key={item.id} className="flex items-center gap-2">
                                        <span className="text-muted-foreground">#{idx + 1}</span>
                                        <span className="font-mono">{item.item_number}</span>
                                        <span>-</span>
                                        <span>{item.item_name}</span>
                                        <span className="text-muted-foreground">|</span>
                                        <span>Velikost: {item.size}</span>
                                        <span className="text-muted-foreground">|</span>
                                        <span>Količina: {item.quantity}</span>
                                        <span className="text-muted-foreground">|</span>
                                        <span className="font-semibold">{(item.unit_price * item.quantity).toFixed(2)} €</span>
                                      </div>
                                    ))}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="zbirniki" onFocus={() => {
          loadCollections();
          loadStats();
        }}>
          <div className="space-y-6">
            {/* Stats Dashboard */}
            {isAdminOrCoach && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Skupno naročil</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{stats.total_orders}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Naročena in predana
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Skupni promet</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">
                      {stats.total_revenue.toFixed(2)} €
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Vsi potrjeni zbirniki
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Povprečno naročilo</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">
                      {stats.avg_order_value.toFixed(2)} €
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Na naročilo
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Top Items & Revenue Chart */}
            {isAdminOrCoach && (topItems.length > 0 || monthlyRevenue.length > 0) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Items */}
                {topItems.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Top 5 Artiklov</CardTitle>
                      <CardDescription>Najbolj prodajani po količini</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {topItems.map((item, index) => (
                          <div key={item.item_number} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                                {index + 1}
                              </div>
                              <div>
                                <p className="font-medium">{item.item_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {item.item_number}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold">{item.total_sold} kos</p>
                              <p className="text-xs text-muted-foreground">
                                {item.total_revenue.toFixed(2)} €
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Monthly Revenue Chart */}
                {monthlyRevenue.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Mesečni promet</CardTitle>
                      <CardDescription>Zadnjih 6 mesecev</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={monthlyRevenue}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip
                            formatter={(value: number) => `${value.toFixed(2)} €`}
                            labelStyle={{ color: "#000" }}
                          />
                          <Legend />
                          <Bar
                            dataKey="total_revenue"
                            fill="hsl(var(--primary))"
                            name="Promet"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Collections Table */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Zbirniki</CardTitle>
                    <CardDescription>
                      Periodično združevanje naročil (1. in 15. dan v mesecu)
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        loadOpenOrdersPreview();
                        setIsCreateCollectionDialogOpen(true);
                      }}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Ustvari zbirnik
                    </Button>
                    <Button variant="outline" onClick={() => {
                      loadCollections();
                      loadStats();
                    }}>
                      Osveži
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {collectionsLoading ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">Nalaganje...</p>
                  </div>
                ) : collections.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">Ni zbirnikov</p>
                    <Button
                      onClick={() => {
                        loadOpenOrdersPreview();
                        setIsCreateCollectionDialogOpen(true);
                      }}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Ustvari prvi zbirnik
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Številka</TableHead>
                        <TableHead>Datum</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Naročil</TableHead>
                        <TableHead>Artiklov</TableHead>
                        <TableHead>Znesek</TableHead>
                        <TableHead>Naročeno</TableHead>
                        <TableHead className="text-right">Akcije</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {collections.map((collection) => (
                        <TableRow key={collection.id}>
                          <TableCell className="font-mono text-sm font-medium">
                            {collection.collection_number}
                          </TableCell>
                          <TableCell>
                            {new Date(collection.collection_date).toLocaleDateString("sl-SI", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })}
                          </TableCell>
                          <TableCell>
                            {collection.status === "draft" && (
                              <Badge variant="outline">
                                <Clock className="w-3 h-3 mr-1" />
                                Osnutek
                              </Badge>
                            )}
                            {collection.status === "ordered" && (
                              <Badge className="bg-blue-500">
                                <Package className="w-3 h-3 mr-1" />
                                Naročeno
                              </Badge>
                            )}
                            {collection.status === "received" && (
                              <Badge className="bg-green-500">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Prejeto
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">
                            {collection.total_orders || 0}
                          </TableCell>
                          <TableCell className="font-medium">
                            {collection.total_items || 0}
                          </TableCell>
                          <TableCell className="font-semibold">
                            {(collection.total_amount || 0).toFixed(2)} €
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {collection.ordered_at
                              ? new Date(collection.ordered_at).toLocaleDateString("sl-SI")
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewCollectionItems(collection)}
                              >
                                Postavke
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  handleViewCollectionItems(collection);
                                  setTimeout(() => exportCollectionToCSV(collection), 500);
                                }}
                              >
                                Export
                              </Button>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleEditCollectionStatus(collection)}
                              >
                                <Pencil className="w-4 h-4 mr-2" />
                                Uredi
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Category Add/Edit Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsCategoryDialogOpen(false);
          resetCategoryForm();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "Uredi kategorijo" : "Dodaj kategorijo"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="cat_name">Naziv *</Label>
              <Input
                id="cat_name"
                value={categoryFormData.name}
                onChange={(e) =>
                  setCategoryFormData({ ...categoryFormData, name: e.target.value })
                }
                placeholder="npr. Dresi"
              />
            </div>

            <div>
              <Label htmlFor="cat_description">Opis</Label>
              <Textarea
                id="cat_description"
                value={categoryFormData.description}
                onChange={(e) =>
                  setCategoryFormData({ ...categoryFormData, description: e.target.value })
                }
                placeholder="Kratek opis kategorije..."
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="cat_order">Vrstni red</Label>
              <Input
                id="cat_order"
                type="number"
                value={categoryFormData.display_order}
                onChange={(e) =>
                  setCategoryFormData({ ...categoryFormData, display_order: e.target.value })
                }
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Nižja številka = višje v seznamu
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCategoryDialogOpen(false);
                resetCategoryForm();
              }}
            >
              Prekliči
            </Button>
            <Button onClick={handleCategorySubmit}>
              {editingCategory ? "Posodobi" : "Dodaj"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Item Dialog */}
      <Dialog
        open={isAddDialogOpen || isEditDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddDialogOpen(false);
            setIsEditDialogOpen(false);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Uredi artikel" : "Dodaj artikel"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="item_number">Številka artikla *</Label>
                <Input
                  id="item_number"
                  value={formData.item_number}
                  onChange={(e) =>
                    setFormData({ ...formData, item_number: e.target.value })
                  }
                  placeholder="npr. ART-001"
                />
              </div>
              <div>
                <Label htmlFor="category">Kategorija</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) =>
                    setFormData({ ...formData, category: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Izberi kategorijo" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="name">Naziv artikla *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="npr. Klubski dres"
              />
            </div>

            <div>
              <Label htmlFor="description">Opis</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Kratek opis artikla..."
                rows={3}
              />
            </div>

            <div>
              <Label className="mb-2 block">Razpoložljive velikosti</Label>
              <div className="grid grid-cols-5 gap-2">
                {AVAILABLE_SIZES.map((size) => (
                  <div key={size} className="flex items-center space-x-2">
                    <Checkbox
                      id={`size-${size}`}
                      checked={formData.available_sizes.includes(size)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFormData({
                            ...formData,
                            available_sizes: [...formData.available_sizes, size],
                          });
                        } else {
                          setFormData({
                            ...formData,
                            available_sizes: formData.available_sizes.filter(
                              (s) => s !== size
                            ),
                          });
                        }
                      }}
                    />
                    <label
                      htmlFor={`size-${size}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {size}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="price">Cena (€) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData({ ...formData, price: e.target.value })
                  }
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label htmlFor="quantity">Zaloga</Label>
                <Input
                  id="quantity"
                  type="number"
                  value={formData.quantity_in_stock}
                  onChange={(e) =>
                    setFormData({ ...formData, quantity_in_stock: e.target.value })
                  }
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="threshold">Prag opozorila</Label>
                <Input
                  id="threshold"
                  type="number"
                  value={formData.low_stock_threshold}
                  onChange={(e) =>
                    setFormData({ ...formData, low_stock_threshold: e.target.value })
                  }
                  placeholder="5"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="external_link">Zunanja povezava</Label>
              <Input
                id="external_link"
                type="url"
                value={formData.external_link}
                onChange={(e) =>
                  setFormData({ ...formData, external_link: e.target.value })
                }
                placeholder="https://..."
              />
            </div>

            <div>
              <Label htmlFor="image">Slika artikla</Label>
              <Input
                id="image"
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="mt-2"
              />
              {imagePreview && (
                <div className="mt-4">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-32 h-24 object-cover rounded border"
                  />
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddDialogOpen(false);
                setIsEditDialogOpen(false);
                resetForm();
              }}
            >
              Prekliči
            </Button>
            <Button onClick={handleSubmit}>
              {editingItem ? "Posodobi" : "Dodaj"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pobriši artikel?</DialogTitle>
            <DialogDescription>
              Ali ste prepričani, da želite pobrisati artikel &quot;{itemToDelete?.name}&quot;?
              <br />
              <br />
              Artikel bo označen kot pobrisan in ne bo več viden strašem in trenerjem.
              Podatki bodo ohranjeni v bazi za revizijske namene.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setItemToDelete(null);
              }}
            >
              Prekliči
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="w-4 h-4 mr-2" />
              Pobriši
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Order Status Edit Dialog */}
      <Dialog open={isOrderStatusDialogOpen} onOpenChange={setIsOrderStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Uredi status naročila</DialogTitle>
            <DialogDescription>
              Naročilo: {editingOrder?.order_number} • {editingOrder?.parent_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="order_status">Status *</Label>
              <Select
                value={orderStatusFormData.status}
                onValueChange={(value) =>
                  setOrderStatusFormData({ ...orderStatusFormData, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Odprto</SelectItem>
                  <SelectItem value="ordered">Naročeno</SelectItem>
                  <SelectItem value="delivered">Predano</SelectItem>
                  <SelectItem value="cancelled">Preklicano</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {orderStatusFormData.status === "ordered" && (
              <div>
                <Label htmlFor="ordered_at">Datum naročila pri dobavitelju</Label>
                <Input
                  id="ordered_at"
                  type="date"
                  value={orderStatusFormData.ordered_at}
                  onChange={(e) =>
                    setOrderStatusFormData({ ...orderStatusFormData, ordered_at: e.target.value })
                  }
                />
              </div>
            )}

            {orderStatusFormData.status === "delivered" && (
              <div>
                <Label htmlFor="delivered_at">Datum predaje</Label>
                <Input
                  id="delivered_at"
                  type="date"
                  value={orderStatusFormData.delivered_at}
                  onChange={(e) =>
                    setOrderStatusFormData({ ...orderStatusFormData, delivered_at: e.target.value })
                  }
                />
              </div>
            )}

            <div>
              <Label htmlFor="invoiced_at">Datum računa</Label>
              <Input
                id="invoiced_at"
                type="date"
                value={orderStatusFormData.invoiced_at}
                onChange={(e) =>
                  setOrderStatusFormData({ ...orderStatusFormData, invoiced_at: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground mt-1">
                Če pustite prazno, račun še ni izdelan
              </p>
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm font-medium mb-2">Skupni znesek naročila:</p>
              <p className="text-2xl font-bold">{editingOrder?.total_amount.toFixed(2)} €</p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsOrderStatusDialogOpen(false);
                setEditingOrder(null);
              }}
            >
              Prekliči
            </Button>
            <Button onClick={handleOrderStatusUpdate}>
              Shrani
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Order Items Dialog */}
      <Dialog open={isOrderItemsDialogOpen} onOpenChange={setIsOrderItemsDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Postavke naročila</DialogTitle>
            <DialogDescription>
              Naročilo: {editingOrder?.order_number} • {editingOrder?.parent_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {orderItems.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Ni postavk</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Št.</TableHead>
                    <TableHead>Artikel</TableHead>
                    <TableHead>Velikost</TableHead>
                    <TableHead className="text-right">Količina</TableHead>
                    <TableHead className="text-right">Cena</TableHead>
                    <TableHead className="text-right">Skupaj</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-sm">
                        {item.item_number}
                      </TableCell>
                      <TableCell className="font-medium">{item.item_name}</TableCell>
                      <TableCell>{item.size}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">
                        {item.unit_price.toFixed(2)} €
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {item.subtotal.toFixed(2)} €
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={5} className="text-right font-semibold">
                      Skupaj:
                    </TableCell>
                    <TableCell className="text-right font-bold text-lg">
                      {orderItems.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2)} €
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                setIsOrderItemsDialogOpen(false);
                setEditingOrder(null);
                setOrderItems([]);
              }}
            >
              Zapri
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Collection Dialog */}
      <Dialog open={isCreateCollectionDialogOpen} onOpenChange={setIsCreateCollectionDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ustvari nov zbirnik</DialogTitle>
            <DialogDescription>
              Združi vsa odprta naročila v zbirnik
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="collection_date">Datum zbirnika *</Label>
              <Input
                id="collection_date"
                type="date"
                value={collectionFormData.collection_date}
                onChange={(e) =>
                  setCollectionFormData({ ...collectionFormData, collection_date: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground mt-1">
                Priporočeno: 1. ali 15. dan v mesecu
              </p>
            </div>

            <div>
              <Label htmlFor="collection_notes">Opombe</Label>
              <Textarea
                id="collection_notes"
                value={collectionFormData.notes}
                onChange={(e) =>
                  setCollectionFormData({ ...collectionFormData, notes: e.target.value })
                }
                placeholder="Dodatne opombe za ta zbirnik..."
                rows={2}
              />
            </div>

            <div className="border rounded-lg p-4 bg-muted/50">
              <h4 className="font-semibold mb-3">
                Predogled odprtih naročil ({openOrdersPreview.length})
              </h4>
              {openOrdersPreview.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Ni odprtih naročil za združevanje
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {openOrdersPreview.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between p-2 bg-background rounded"
                    >
                      <div>
                        <p className="font-mono text-sm">{order.order_number}</p>
                        <p className="text-xs text-muted-foreground">{order.parent_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{order.total_amount.toFixed(2)} €</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString("sl-SI")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {openOrdersPreview.length > 0 && (
              <div className="bg-primary/10 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Skupaj:</span>
                  <div className="text-right">
                    <p className="text-2xl font-bold">
                      {openOrdersPreview
                        .reduce((sum, order) => sum + order.total_amount, 0)
                        .toFixed(2)}{" "}
                      €
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {openOrdersPreview.length} naročil
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateCollectionDialogOpen(false);
                setCollectionFormData({ collection_date: "", notes: "" });
                setOpenOrdersPreview([]);
              }}
            >
              Prekliči
            </Button>
            <Button
              onClick={handleCreateCollection}
              disabled={openOrdersPreview.length === 0}
            >
              Ustvari zbirnik
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Collection Items Dialog */}
      <Dialog open={isCollectionItemsDialogOpen} onOpenChange={setIsCollectionItemsDialogOpen}>
        <DialogContent className="max-w-4xl print:max-w-full">
          <DialogHeader className="print:block">
            <DialogTitle className="print:text-2xl">Postavke zbirnika</DialogTitle>
            <DialogDescription className="print:text-base print:text-foreground">
              Zbirnik: {selectedCollection?.collection_number} •{" "}
              {selectedCollection?.collection_date &&
                new Date(selectedCollection.collection_date).toLocaleDateString("sl-SI")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 print-content">
            {collectionItems.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Ni postavk</p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Št. artikla</TableHead>
                      <TableHead>Naziv</TableHead>
                      <TableHead>Velikost</TableHead>
                      <TableHead className="text-right">Skupna količina</TableHead>
                      <TableHead className="text-right">Cena</TableHead>
                      <TableHead className="text-right">Skupaj</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {collectionItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-sm">
                          {item.item_number}
                        </TableCell>
                        <TableCell className="font-medium">{item.item_name}</TableCell>
                        <TableCell>{item.size}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {item.total_quantity}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.unit_price.toFixed(2)} €
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {(item.total_quantity * item.unit_price).toFixed(2)} €
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={3} className="text-right font-semibold">
                        Skupaj:
                      </TableCell>
                      <TableCell className="text-right font-bold text-lg">
                        {collectionItems.reduce((sum, item) => sum + item.total_quantity, 0)}
                      </TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-right font-bold text-lg">
                        {collectionItems
                          .reduce((sum, item) => sum + item.total_quantity * item.unit_price, 0)
                          .toFixed(2)}{" "}
                        €
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>

                <div className="flex items-center justify-between p-4 bg-muted rounded-lg print:bg-white print:border">
                  <div>
                    <p className="text-sm text-muted-foreground print:text-foreground">Naročil v zbirniku:</p>
                    <p className="text-2xl font-bold">{selectedCollection?.total_orders || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground print:text-foreground">Različnih artiklov:</p>
                    <p className="text-2xl font-bold">{collectionItems.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground print:text-foreground">Skupaj kosov:</p>
                    <p className="text-2xl font-bold">
                      {collectionItems.reduce((sum, item) => sum + item.total_quantity, 0)}
                    </p>
                  </div>
                </div>

                <div className="print:hidden text-sm text-muted-foreground border-t pt-4">
                  <p>Datum tiska: {new Date().toLocaleString("sl-SI")}</p>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="print:hidden">
            <Button
              variant="outline"
              onClick={printCollection}
            >
              🖨️ Natisni
            </Button>
            <Button
              variant="outline"
              onClick={() => selectedCollection && exportCollectionToCSV(selectedCollection)}
            >
              Izvozi CSV
            </Button>
            <Button
              onClick={() => {
                setIsCollectionItemsDialogOpen(false);
                setSelectedCollection(null);
                setCollectionItems([]);
              }}
            >
              Zapri
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Collection Status Edit Dialog */}
      <Dialog open={isCollectionStatusDialogOpen} onOpenChange={setIsCollectionStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Uredi status zbirnika</DialogTitle>
            <DialogDescription>
              Zbirnik: {selectedCollection?.collection_number}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="collection_status">Status *</Label>
              <Select
                value={collectionStatusFormData.status}
                onValueChange={(value) =>
                  setCollectionStatusFormData({ ...collectionStatusFormData, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Osnutek</SelectItem>
                  <SelectItem value="ordered">Naročeno</SelectItem>
                  <SelectItem value="received">Prejeto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {collectionStatusFormData.status === "ordered" && (
              <div>
                <Label htmlFor="coll_ordered_at">Datum naročila pri dobavitelju *</Label>
                <Input
                  id="coll_ordered_at"
                  type="date"
                  value={collectionStatusFormData.ordered_at}
                  onChange={(e) =>
                    setCollectionStatusFormData({
                      ...collectionStatusFormData,
                      ordered_at: e.target.value,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Vsa naročila v zbirniku bodo označena kot &quot;naročena&quot;
                </p>
              </div>
            )}

            <div>
              <Label htmlFor="coll_notes">Opombe</Label>
              <Textarea
                id="coll_notes"
                value={collectionStatusFormData.notes}
                onChange={(e) =>
                  setCollectionStatusFormData({
                    ...collectionStatusFormData,
                    notes: e.target.value,
                  })
                }
                placeholder="Dodatne opombe..."
                rows={3}
              />
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Naročil:</p>
                  <p className="text-xl font-bold">{selectedCollection?.total_orders || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Znesek:</p>
                  <p className="text-xl font-bold">
                    {(selectedCollection?.total_amount || 0).toFixed(2)} €
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCollectionStatusDialogOpen(false);
                setSelectedCollection(null);
              }}
            >
              Prekliči
            </Button>
            <Button onClick={handleCollectionStatusUpdate}>Shrani</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Zoom Dialog */}
      <Dialog open={!!zoomImage} onOpenChange={() => setZoomImage(null)}>
        <DialogContent className="max-w-4xl">
          <img src={zoomImage || ""} alt="Povečana slika" className="w-full h-auto object-contain rounded" />
        </DialogContent>
      </Dialog>

      {/* Items Detail Dialog */}
      <Dialog open={isItemsDialogOpen} onOpenChange={setIsItemsDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Postavke naročila</DialogTitle>
            <DialogDescription>
              Pregled vseh artiklov v naročilu
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Šifra</TableHead>
                  <TableHead>Naziv</TableHead>
                  <TableHead>Velikost</TableHead>
                  <TableHead>Količina</TableHead>
                  <TableHead>Cena/kos</TableHead>
                  <TableHead>Skupaj</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedOrderItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono">{item.item_number}</TableCell>
                    <TableCell>{item.item_name}</TableCell>
                    <TableCell>{item.size}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>{item.unit_price.toFixed(2)} €</TableCell>
                    <TableCell className="font-semibold">
                      {(item.unit_price * item.quantity).toFixed(2)} €
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsItemsDialogOpen(false)}>Zapri</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Status Dialog */}
      <Dialog open={isEditStatusDialogOpen} onOpenChange={setIsEditStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Uredi status naročila</DialogTitle>
            <DialogDescription>
              Spremeni status naročila {editingOrder?.order_number}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Trenutni status</Label>
              <div>
                <Badge variant="outline">
                  {ORDER_STATUSES.find(s => s.value === editingOrder?.status)?.label || editingOrder?.status}
                </Badge>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Nov status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="Izberi status" />
                </SelectTrigger>
                <SelectContent>
                  {ORDER_STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {newStatus === "naročeno" && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-900">
                <AlertCircle className="h-4 w-4 inline mr-2" />
                Vse postavke v tem naročilu bodo označene kot "naročeno".
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditStatusDialogOpen(false)}>
              Prekliči
            </Button>
            <Button onClick={updateOrderStatus} disabled={!newStatus || newStatus === editingOrder?.status}>
              Shrani
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}