import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/database.types";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  ShoppingCart, Plus, Minus, Trash2, Package, AlertCircle, 
  ChevronDown, ChevronUp, Edit, Eye, Clock, CheckCircle, 
  XCircle, ArrowLeft, Search, ImageIcon, ExternalLink, 
  X, Pencil, Tag 
} from "lucide-react";
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
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type StoreOrder = Database["public"]["Tables"]["store_orders"]["Row"];
type StoreOrderItem = Database["public"]["Tables"]["store_order_items"]["Row"];
type StoreItem = Database["public"]["Tables"]["store_items"]["Row"];
type StoreCollectionPeriod = Database["public"]["Tables"]["store_collection_periods"]["Row"];
type Child = Database["public"]["Tables"]["children"]["Row"];

type StoreCategory = Database["public"]["Tables"]["store_categories"]["Row"];
type StoreCollection = Database["public"]["Tables"]["store_collections"]["Row"];
type StoreCollectionItem = Database["public"]["Tables"]["store_collection_items"]["Row"];

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
  parent_name?: string;
  parent_email?: string;
  parent_phone?: string;
}

interface CollectionWithStats extends StoreCollection {
  total_orders?: number;
  total_items?: number;
  total_amount?: number;
}

interface StoreStats {
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
  activeCollections: number;
  avgOrderValue: number;
}

interface TopItem {
  item_number: string;
  item_name: string;
  total_quantity: number;
  total_sold: number;
  total_revenue: number;
  collections_count?: number;
}

interface MonthlyRevenue {
  month: string;
  revenue: number;
  orders_count: number;
  total_revenue: number;
  avg_order_value: number;
}

const ORDER_STATUSES = [
  { value: "open", label: "Odprto" },
  { value: "sprejeto", label: "Sprejeto" },
  { value: "naročeno", label: "Naročeno" },
  { value: "dobavljeno", label: "Dobavljeno" },
  { value: "račun", label: "Račun" },
];

const AVAILABLE_SIZES = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL"];

export default function Store() {
  const router = useRouter();
  const { user, userRole } = useAuth();
  const { toast } = useToast();

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
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

  // Order Status Form Data
  const [orderStatusFormData, setOrderStatusFormData] = useState({
    status: "",
    ordered_at: "",
    delivered_at: "",
    invoiced_at: "",
  });

  // Collections State
  const [collections, setCollections] = useState<CollectionWithStats[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string>("");
  const [collectionFormData, setCollectionFormData] = useState({
    collection_number: "",
    collection_date: "",
    status: "draft",
    notes: "",
  });
  const [isCollectionDialogOpen, setIsCollectionDialogOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<StoreCollection | null>(null);

  // Collection Items State
  const [collectionItems, setCollectionItems] = useState<StoreCollectionItem[]>([]);
  const [selectedCollectionItems, setSelectedCollectionItems] = useState<string[]>([]);

  // Items State
  const [items, setItems] = useState<StoreItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<StoreItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedSize, setSelectedSize] = useState<string>("all");
  const [isAddItemDialogOpen, setIsAddItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StoreItem | null>(null);
  const [itemFormData, setItemFormData] = useState({
    item_number: "",
    name: "",
    description: "",
    price: 0,
    category_id: "",
    available_sizes: [] as string[],
    image_url: "",
  });

  // Articles Management State
  const [isArticleDialogOpen, setIsArticleDialogOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<StoreItem | null>(null);
  const [articleFormData, setArticleFormData] = useState({
    item_number: "",
    name: "",
    description: "",
    price: 0,
    category: "",
    available_sizes: [] as string[],
    image_url: "",
    external_link: "",
  });

  // Categories Management State
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<StoreCategory | null>(null);
  const [categoryFormData, setCategoryFormData] = useState({
    name: "",
    description: "",
  });
  const [categories, setCategories] = useState<StoreCategory[]>([]);

  // Collections Management State (for creating collections from orders)
  const [selectedOrdersForCollection, setSelectedOrdersForCollection] = useState<Set<string>>(new Set());

  // Children State
  const [children, setChildren] = useState<Child[]>([]);
  const [periods, setPeriods] = useState<StoreCollectionPeriod[]>([]);

  // Stats State
  const [stats, setStats] = useState<StoreStats>({
    totalOrders: 0,
    totalRevenue: 0,
    pendingOrders: 0,
    activeCollections: 0,
    avgOrderValue: 0,
  });
  const [topItems, setTopItems] = useState<TopItem[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyRevenue[]>([]);

  // Active Tab State
  const [activeTab, setActiveTab] = useState("orders");

  useEffect(() => {
    if (user) {
      loadCategories();
      loadItems();
      loadChildren();
      loadPeriods();
      loadCollections();
      fetchOrders();
      
      if (userRole === "admin" || userRole === "coach") {
        loadStats();
        loadTopItems();
        loadMonthlyRevenue();
      }
    }
  }, [user, userRole]);

  useEffect(() => {
    filterItems();
  }, [items, searchQuery, selectedCategory, selectedSize]);

  const filterItems = () => {
    let filtered = [...items];

    if (searchQuery) {
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.item_number.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedCategory) {
      filtered = filtered.filter((item) => item.category_id === selectedCategory);
    }

    if (selectedSize) {
      filtered = filtered.filter((item) =>
        item.available_sizes?.includes(selectedSize)
      );
    }

    setFilteredItems(filtered);
  };

  const loadStats = async () => {
    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from("store_orders")
        .select("total_amount");

      if (ordersError) throw ordersError;

      const totalOrders = ordersData?.length || 0;
      const totalRevenue = ordersData?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      setStats({
        totalOrders: totalOrders,
        totalRevenue: totalRevenue,
        pendingOrders: 0,
        activeCollections: 0,
        avgOrderValue: avgOrderValue,
      });
    } catch (error: any) {
      console.error("Error loading stats:", error);
    }
  };

  const loadTopItems = async () => {
    try {
      const { data, error } = await supabase
        .from("store_order_items")
        .select("item_id, item_number, item_name, quantity, unit_price");

      if (error) throw error;

      const aggregated: Record<string, any> = {};
      
      data?.forEach((item: any) => {
        const itemId = item.item_id || item.item_number;
        if (!aggregated[itemId]) {
          aggregated[itemId] = {
            item_number: item.item_number || "N/A",
            item_name: item.item_name || "Unknown",
            total_sold: 0,
            total_revenue: 0,
          };
        }
        aggregated[itemId].total_sold += item.quantity || 0;
        aggregated[itemId].total_revenue += (item.quantity || 0) * (item.unit_price || 0);
      });

      const topItemsArray = Object.values(aggregated)
        .map((item: any) => ({
          item_number: item.item_number,
          item_name: item.item_name,
          total_quantity: item.total_sold,
          total_sold: item.total_sold,
          total_revenue: item.total_revenue,
        }))
        .sort((a: any, b: any) => b.total_sold - a.total_sold)
        .slice(0, 10) as TopItem[];

      setTopItems(topItemsArray);
    } catch (error: any) {
      console.error("Error loading top items:", error);
    }
  };

  const loadMonthlyRevenue = async () => {
    try {
      const { data, error } = await supabase
        .from("store_orders")
        .select("created_at, total_amount");

      if (error) throw error;

      const monthlyData: Record<string, { total: number; count: number }> = {};
      
      data?.forEach((order) => {
        const date = new Date(order.created_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { total: 0, count: 0 };
        }
        
        monthlyData[monthKey].total += order.total_amount || 0;
        monthlyData[monthKey].count += 1;
      });

      const monthlyArray = Object.entries(monthlyData)
        .map(([month, data]) => {
          const [year, monthNum] = month.split("-");
          const monthName = new Date(parseInt(year), parseInt(monthNum) - 1).toLocaleDateString("sl-SI", { month: "short", year: "numeric" });
          const total_revenue = data.total;
          const orders_count = data.count;
          const avg_order_value = orders_count > 0 ? total_revenue / orders_count : 0;
          
          return {
            month: monthName,
            revenue: total_revenue,
            orders_count: orders_count,
            total_revenue: total_revenue,
            avg_order_value: avg_order_value,
          };
        })
        .sort((a, b) => a.month.localeCompare(b.month));

      setMonthlyRevenue(monthlyArray.slice(-12));
    } catch (error: any) {
      console.error("Error loading monthly revenue:", error);
    }
  };

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from("store_categories")
        .select("*")
        .order("name");

      if (error) throw error;
      setCategories(data || []);
    } catch (error: any) {
      toast({
        title: "Napaka",
        description: `Napaka pri nalaganju kategorij: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const loadItems = async () => {
    try {
      const { data, error } = await supabase
        .from("store_items")
        .select("*")
        .order("item_number");

      if (error) throw error;
      setItems(data || []);
    } catch (error: any) {
      toast({
        title: "Napaka",
        description: `Napaka pri nalaganju artiklov: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const loadChildren = async () => {
    try {
      // Children table is in internal schema, not public
      // Skip loading if user doesn't have access
      setChildren([]);
    } catch (error: any) {
      console.error("Error loading children:", error);
    }
  };

  const loadPeriods = async () => {
    try {
      const { data, error } = await supabase
        .from("store_collection_periods")
        .select("*")
        .order("period_date", { ascending: false });

      if (error) throw error;
      setPeriods(data || []);
    } catch (error: any) {
      console.error("Error loading periods:", error);
    }
  };

  const loadCollections = async () => {
    try {
      const { data, error } = await supabase
        .from("store_collections")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCollections(data || []);
    } catch (error: any) {
      toast({
        title: "Napaka",
        description: `Napaka pri nalaganju zbirnikov: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const fetchOrders = async () => {
    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from("store_orders")
        .select("*")
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
      console.error("Error fetching orders:", error);
      toast({
        title: "Napaka",
        description: `Napaka pri nalaganju naročil: ${error.message}`,
        variant: "destructive",
      });
    }
  };

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

  // Articles CRUD Functions
  const openArticleDialog = (article?: StoreItem) => {
    if (article) {
      setEditingArticle(article);
      setArticleFormData({
        item_number: article.item_number,
        name: article.name,
        description: article.description || "",
        price: article.price,
        category: article.category,
        available_sizes: Array.isArray(article.available_sizes) ? article.available_sizes : [],
        image_url: article.image_url || "",
        external_link: article.external_link || "",
      });
    } else {
      setEditingArticle(null);
      setArticleFormData({
        item_number: "",
        name: "",
        description: "",
        price: 0,
        category: "",
        available_sizes: [],
        image_url: "",
        external_link: "",
      });
    }
    setIsArticleDialogOpen(true);
  };

  const saveArticle = async () => {
    try {
      if (editingArticle) {
        // Update existing article
        const { error } = await supabase
          .from("store_items")
          .update({
            item_number: articleFormData.item_number,
            name: articleFormData.name,
            description: articleFormData.description,
            price: articleFormData.price,
            category: articleFormData.category,
            available_sizes: articleFormData.available_sizes,
            image_url: articleFormData.image_url,
            external_link: articleFormData.external_link,
          })
          .eq("id", editingArticle.id);

        if (error) throw error;

        toast({
          title: "Artikel posodobljen",
          description: `Artikel ${articleFormData.name} je bil uspešno posodobljen.`,
        });
      } else {
        // Create new article
        const { error } = await supabase
          .from("store_items")
          .insert({
            item_number: articleFormData.item_number,
            name: articleFormData.name,
            description: articleFormData.description,
            price: articleFormData.price,
            category: articleFormData.category,
            available_sizes: articleFormData.available_sizes,
            image_url: articleFormData.image_url,
            external_link: articleFormData.external_link,
          });

        if (error) throw error;

        toast({
          title: "Artikel ustvarjen",
          description: `Artikel ${articleFormData.name} je bil uspešno ustvarjen.`,
        });
      }

      setIsArticleDialogOpen(false);
      loadItems();
    } catch (error: any) {
      toast({
        title: "Napaka",
        description: `Napaka pri shranjevanju artikla: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const deleteArticle = async (articleId: string) => {
    if (!confirm("Ali ste prepričani, da želite izbrisati ta artikel?")) return;

    try {
      const { error } = await supabase
        .from("store_items")
        .delete()
        .eq("id", articleId);

      if (error) throw error;

      toast({
        title: "Artikel izbrisan",
        description: "Artikel je bil uspešno izbrisan.",
      });

      loadItems();
    } catch (error: any) {
      toast({
        title: "Napaka",
        description: `Napaka pri brisanju artikla: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  // Categories CRUD Functions
  const openCategoryDialog = (category?: StoreCategory) => {
    if (category) {
      setEditingCategory(category);
      setCategoryFormData({
        name: category.name,
        description: category.description || "",
      });
    } else {
      setEditingCategory(null);
      setCategoryFormData({
        name: "",
        description: "",
      });
    }
    setIsCategoryDialogOpen(true);
  };

  const saveCategory = async () => {
    try {
      if (editingCategory) {
        // Update existing category
        const { error } = await supabase
          .from("store_categories")
          .update({
            name: categoryFormData.name,
            description: categoryFormData.description,
          })
          .eq("id", editingCategory.id);

        if (error) throw error;

        toast({
          title: "Kategorija posodobljena",
          description: `Kategorija ${categoryFormData.name} je bila uspešno posodobljena.`,
        });
      } else {
        // Create new category
        const { error } = await supabase
          .from("store_categories")
          .insert({
            name: categoryFormData.name,
            description: categoryFormData.description,
          });

        if (error) throw error;

        toast({
          title: "Kategorija ustvarjena",
          description: `Kategorija ${categoryFormData.name} je bila uspešno ustvarjena.`,
        });
      }

      setIsCategoryDialogOpen(false);
      loadCategories();
    } catch (error: any) {
      toast({
        title: "Napaka",
        description: `Napaka pri shranjevanju kategorije: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const deleteCategory = async (categoryId: string) => {
    if (!confirm("Ali ste prepričani, da želite izbrisati to kategorijo?")) return;

    try {
      const { error } = await supabase
        .from("store_categories")
        .delete()
        .eq("id", categoryId);

      if (error) throw error;

      toast({
        title: "Kategorija izbrisana",
        description: "Kategorija je bila uspešno izbrisana.",
      });

      loadCategories();
    } catch (error: any) {
      toast({
        title: "Napaka",
        description: `Napaka pri brisanju kategorije: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  // Collections Management Functions
  const toggleOrderSelection = (orderId: string) => {
    const newSelection = new Set(selectedOrdersForCollection);
    if (newSelection.has(orderId)) {
      newSelection.delete(orderId);
    } else {
      newSelection.add(orderId);
    }
    setSelectedOrdersForCollection(newSelection);
  };

  const createCollection = async () => {
    if (selectedOrdersForCollection.size === 0) {
      toast({
        title: "Napaka",
        description: "Izberite vsaj eno naročilo za zbirnik.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Create collection
      const { data: collection, error: collectionError } = await supabase
        .from("store_collections")
        .insert({
          collection_number: collectionFormData.collection_number,
          notes: collectionFormData.notes,
          status: "sprejeto",
        })
        .select()
        .single();

      if (collectionError) throw collectionError;

      // Update selected orders to reference this collection
      const { error: ordersError } = await supabase
        .from("store_orders")
        .update({
          collection_id: collection.id,
          status: "sprejeto",
        })
        .in("id", Array.from(selectedOrdersForCollection));

      if (ordersError) throw ordersError;

      // Get all order items from selected orders
      const { data: orderItems, error: itemsError } = await supabase
        .from("store_order_items")
        .select("*")
        .in("order_id", Array.from(selectedOrdersForCollection));

      if (itemsError) throw itemsError;

      // Create collection items (aggregate by item_number + size)
      const itemsMap = new Map<string, any>();
      orderItems?.forEach(item => {
        const key = `${item.item_number}-${item.size}`;
        if (itemsMap.has(key)) {
          const existing = itemsMap.get(key);
          existing.total_quantity += item.quantity;
        } else {
          itemsMap.set(key, {
            collection_id: collection.id,
            item_id: item.item_id,
            item_number: item.item_number,
            item_name: item.item_name,
            size: item.size,
            total_quantity: item.quantity,
            unit_price: item.unit_price,
          });
        }
      });

      const collectionItems = Array.from(itemsMap.values());
      const { error: itemsInsertError } = await supabase
        .from("store_collection_items")
        .insert(collectionItems);

      if (itemsInsertError) throw itemsInsertError;

      toast({
        title: "Zbirnik ustvarjen",
        description: `Zbirnik ${collectionFormData.collection_number} je bil uspešno ustvarjen iz ${selectedOrdersForCollection.size} naročil.`,
      });

      setIsCollectionDialogOpen(false);
      setSelectedOrdersForCollection(new Set());
      setCollectionFormData({ collection_number: "", notes: "" });
      fetchOrders();
    } catch (error: any) {
      toast({
        title: "Napaka",
        description: `Napaka pri ustvarjanju zbirnika: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  // Parent cancel order function
  const cancelOrder = async (orderId: string) => {
    if (!confirm("Ali ste prepričani, da želite preklicati to naročilo?")) return;

    try {
      const { error } = await supabase
        .from("store_orders")
        .update({ status: "preklicano" })
        .eq("id", orderId);

      if (error) throw error;

      toast({
        title: "Naročilo preklicano",
        description: "Naročilo je bilo uspešno preklicano.",
      });

      fetchOrders();
    } catch (error: any) {
      toast({
        title: "Napaka",
        description: `Napaka pri preklicu naročila: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const addToCart = (item: StoreItem, size: string) => {
    const existingItem = cart.find(
      (cartItem) => cartItem.item_id === item.id && cartItem.size === size
    );

    if (existingItem) {
      setCart(
        cart.map((cartItem) =>
          cartItem.item_id === item.id && cartItem.size === size
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        )
      );
    } else {
      setCart([
        ...cart,
        {
          item_id: item.id,
          item_number: item.item_number,
          item_name: item.name,
          name: item.name,
          item_price: item.price,
          size,
          quantity: 1,
          price: item.price,
          image_url: item.image_url || "",
        },
      ]);
    }

    toast({
      title: "Dodano v košarico",
      description: `${item.name} (${size}) dodan v košarico`,
    });
  };

  const removeFromCart = (itemId: string, size: string) => {
    setCart(cart.filter((item) => !(item.item_id === itemId && item.size === size)));
  };

  const updateCartQuantity = (itemId: string, size: string, change: number) => {
    setCart(
      cart.map((item) =>
        item.item_id === itemId && item.size === size
          ? { ...item, quantity: Math.max(1, item.quantity + change) }
          : item
      )
    );
  };

  const submitOrder = async () => {
    if (!selectedChild || !selectedPeriod || cart.length === 0) {
      toast({
        title: "Napaka",
        description: "Prosimo izberite otroka, obdobje in dodajte artikle v košarico.",
        variant: "destructive",
      });
      return;
    }

    try {
      const totalAmount = cart.reduce((sum, item) => sum + item.item_price * item.quantity, 0);
      const orderNumber = `ORD-${Date.now()}`;

      const { data: orderData, error: orderError } = await supabase
        .from("store_orders")
        .insert({
          order_number: orderNumber,
          child_id: selectedChild,
          collection_period_id: selectedPeriod,
          total_amount: totalAmount,
          status: "open",
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = cart.map((item) => ({
        order_id: orderData.id,
        item_id: item.item_id,
        item_number: item.item_number,
        item_name: item.item_name,
        size: item.size,
        quantity: item.quantity,
        unit_price: item.item_price,
        subtotal: item.item_price * item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from("store_order_items")
        .insert(orderItems);

      if (itemsError) throw itemsError;

      toast({
        title: "Naročilo oddano",
        description: `Vaše naročilo ${orderNumber} je bilo uspešno oddano.`,
      });

      setCart([]);
      setSelectedChild("");
      setSelectedPeriod("");
      setIsCartOpen(false);
      fetchOrders();
    } catch (error: any) {
      toast({
        title: "Napaka pri oddaji naročila",
        description: error.message,
        variant: "destructive",
      });
    }
  };

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
              <h1 className="text-3xl font-bold">Oprema</h1>
              <p className="text-muted-foreground">
                Naročanje klubske opreme
              </p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="orders" className="space-y-4">
          <TabsList>
            <TabsTrigger value="orders">Naročila</TabsTrigger>
            <TabsTrigger value="collections">Zbirniki</TabsTrigger>
            <TabsTrigger value="reports">Poročila</TabsTrigger>
            <TabsTrigger value="articles">Artikli</TabsTrigger>
            <TabsTrigger value="categories">Kategorije</TabsTrigger>
          </TabsList>

          {/* CATALOG TAB */}
          <TabsContent value="catalog" className="space-y-4">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Išči po imenu ali šifri..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Vse kategorije" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Vse kategorije</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedSize} onValueChange={setSelectedSize}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Vse velikosti" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Vse velikosti</SelectItem>
                  {AVAILABLE_SIZES.map((size) => (
                    <SelectItem key={size} value={size}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredItems.map((item) => (
                <Card key={item.id}>
                  <CardHeader>
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-full h-48 object-cover rounded-md"
                      />
                    ) : (
                      <div className="w-full h-48 bg-muted flex items-center justify-center rounded-md">
                        <ImageIcon className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                    <CardTitle>{item.name}</CardTitle>
                    <CardDescription>
                      Šifra: {item.item_number}
                      <br />
                      Cena: {item.price.toFixed(2)} €
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {item.description && (
                      <p className="text-sm text-muted-foreground mb-4">
                        {item.description}
                      </p>
                    )}
                    {userRole === "parent" && (
                      <div className="space-y-2">
                        <Label>Velikost</Label>
                        <div className="flex flex-wrap gap-2">
                          {item.available_sizes?.map((size) => (
                            <Button
                              key={size}
                              variant="outline"
                              size="sm"
                              onClick={() => addToCart(item, size)}
                            >
                              {size}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredItems.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                Ni najdenih artiklov
              </div>
            )}
          </TabsContent>

          {/* MY ORDERS TAB (Parent) */}
          {userRole === "parent" && (
            <TabsContent value="my-orders" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Moja naročila</CardTitle>
                  <CardDescription>
                    Pregled vaših oddanih naročil
                  </CardDescription>
                </CardHeader>
                <CardContent>
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
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {myOrders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground">
                            Ni naročil
                          </TableCell>
                        </TableRow>
                      ) : (
                        myOrders.map((order) => {
                          const items = orderItems[order.id] || [];
                          const isExpanded = expandedOrders.has(order.id);
                          
                          return (
                            <>
                              <TableRow key={order.id}>
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
                                  {order.child_id ? `Otrok ID: ${order.child_id.slice(0, 8)}...` : "N/A"}
                                </TableCell>
                                <TableCell>
                                  {order.collection_id || "N/A"}
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
                              </TableRow>
                              {isExpanded && items.length > 0 && (
                                <TableRow key={`${order.id}-items`}>
                                  <TableCell colSpan={7} className="bg-muted/50 p-4">
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
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* ORDERS TAB (Admin/Coach) */}
          {(userRole === "admin" || userRole === "coach") && (
            <TabsContent value="orders" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Vsa naročila</CardTitle>
                  <CardDescription>
                    Upravljanje naročil klubske opreme
                  </CardDescription>
                </CardHeader>
                <CardContent>
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
                                  {order.child_id ? `Otrok ID: ${order.child_id.slice(0, 8)}...` : "N/A"}
                                </TableCell>
                                <TableCell>
                                  {order.collection_id || "N/A"}
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
                                        Postavke ({items.length})
                                      </Button>
                                    )}
                                    {(userRole === "coach" || userRole === "admin") && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => openEditStatusDialog(order)}
                                      >
                                        <Edit className="h-4 w-4 mr-1" />
                                        Uredi
                                      </Button>
                                    )}
                                    {userRole === "parent" && order.status === "open" && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => cancelOrder(order.id)}
                                      >
                                        <XCircle className="h-4 w-4 mr-1" />
                                        Prekliči
                                      </Button>
                                    )}
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
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Articles Tab */}
          <TabsContent value="articles" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Artikli</CardTitle>
                    <CardDescription>
                      Upravljanje artiklov v trgovini
                    </CardDescription>
                  </div>
                  <Button onClick={() => openArticleDialog()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nov artikel
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Slika</TableHead>
                      <TableHead>Šifra</TableHead>
                      <TableHead>Naziv</TableHead>
                      <TableHead>Kategorija</TableHead>
                      <TableHead>Cena</TableHead>
                      <TableHead>Velikosti</TableHead>
                      <TableHead className="text-right">Akcije</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          {item.image_url ? (
                            <img 
                              src={item.image_url} 
                              alt={item.name}
                              className="w-16 h-16 object-cover rounded-md border"
                              onError={(e) => {
                                e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Crect x='3' y='3' width='18' height='18' rx='2'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='M21 15l-5-5L5 21'/%3E%3C/svg%3E";
                              }}
                            />
                          ) : (
                            <div className="w-16 h-16 bg-muted rounded-md border flex items-center justify-center">
                              <ImageIcon className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-mono">{item.item_number}</TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{item.category}</TableCell>
                        <TableCell>{item.price.toFixed(2)} €</TableCell>
                        <TableCell className="text-sm">
                          {Array.isArray(item.available_sizes) 
                            ? item.available_sizes.join(", ") 
                            : "N/A"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openArticleDialog(item)}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Uredi
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteArticle(item.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Izbriši
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Categories Tab */}
          <TabsContent value="categories" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Kategorije</CardTitle>
                    <CardDescription>
                      Upravljanje kategorij artiklov
                    </CardDescription>
                  </div>
                  <Button onClick={() => openCategoryDialog()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nova kategorija
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Naziv</TableHead>
                      <TableHead>Opis</TableHead>
                      <TableHead className="text-right">Akcije</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map((category) => (
                      <TableRow key={category.id}>
                        <TableCell className="font-medium">{category.name}</TableCell>
                        <TableCell>{category.description || "-"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openCategoryDialog(category)}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Uredi
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteCategory(category.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Izbriši
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Collections Tab */}
          <TabsContent value="collections" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Zbirniki</CardTitle>
                    <CardDescription>
                      Ustvarite zbirnik iz odprtih naročil
                    </CardDescription>
                  </div>
                  <Button 
                    onClick={() => setIsCollectionDialogOpen(true)}
                    disabled={myOrders.filter(o => o.status === "open").length === 0}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Nov zbirnik
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground mb-4">
                  Odprtih naročil: {myOrders.filter(o => o.status === "open").length}
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Številka</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Število naročil</TableHead>
                      <TableHead>Opombe</TableHead>
                      <TableHead>Datum</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {collections.map((collection) => (
                      <TableRow key={collection.id}>
                        <TableCell className="font-medium">{collection.collection_number}</TableCell>
                        <TableCell>
                          <Badge>{collection.status}</Badge>
                        </TableCell>
                        <TableCell>{collection.total_orders || 0}</TableCell>
                        <TableCell>{collection.notes || "-"}</TableCell>
                        <TableCell>
                          {new Date(collection.created_at).toLocaleDateString("sl-SI")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* OTHER TABS - Placeholder for now */}
          {(userRole === "admin" || userRole === "coach") && (
            <>
              <TabsContent value="items">
                <Card>
                  <CardHeader>
                    <CardTitle>Artikli</CardTitle>
                    <CardDescription>Upravljanje artiklov</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">Artikli funkcionalnost - v pripravi</p>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="reports">
                <Card>
                  <CardHeader>
                    <CardTitle>Poročila</CardTitle>
                    <CardDescription>Statistika in poročila</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-sm font-medium">Skupaj naročil</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-3xl font-bold">{stats.totalOrders}</div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-sm font-medium">Skupni prihodek</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-3xl font-bold">
                              {stats.totalRevenue.toFixed(2)} €
                            </div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-sm font-medium">Povprečno naročilo</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-3xl font-bold">
                              {stats.avgOrderValue.toFixed(2)} €
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>

      {/* Cart Dialog */}
      {userRole === "parent" && (
        <Dialog open={isCartOpen} onOpenChange={setIsCartOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Košarica</DialogTitle>
              <DialogDescription>
                Pregled artiklov v košarici
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {cart.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Košarica je prazna
                </p>
              ) : (
                <>
                  <div className="space-y-2">
                    {cart.map((item) => (
                      <div
                        key={`${item.item_id}-${item.size}`}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="font-medium">{item.item_name}</div>
                          <div className="text-sm text-muted-foreground">
                            Velikost: {item.size} | Cena: {item.item_price.toFixed(2)} €
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateCartQuantity(item.item_id, item.size, -1)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateCartQuantity(item.item_id, item.size, 1)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFromCart(item.item_id, item.size)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-4 pt-4 border-t">
                    <div className="space-y-2">
                      <Label>Izberite otroka</Label>
                      <Select value={selectedChild} onValueChange={setSelectedChild}>
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

                    <div className="space-y-2">
                      <Label>Obdobje prevzema</Label>
                      <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                        <SelectTrigger>
                          <SelectValue placeholder="Izberite obdobje" />
                        </SelectTrigger>
                        <SelectContent>
                          {periods.map((period) => (
                            <SelectItem key={period.id} value={period.id}>
                              {new Date(period.period_date).toLocaleDateString("sl-SI")}
                              {period.notes && ` - ${period.notes}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t">
                      <span className="font-semibold">Skupaj:</span>
                      <span className="text-2xl font-bold">
                        {cart
                          .reduce((sum, item) => sum + item.item_price * item.quantity, 0)
                          .toFixed(2)}{" "}
                        €
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCartOpen(false)}>
                Zapri
              </Button>
              {cart.length > 0 && (
                <Button onClick={submitOrder}>Oddaj naročilo</Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

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
                Status "naročeno" pomeni, da je bil zbirnik poslan dobavitelju.
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

      {/* Article Dialog */}
      <Dialog open={isArticleDialogOpen} onOpenChange={setIsArticleDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingArticle ? "Uredi artikel" : "Nov artikel"}
            </DialogTitle>
            <DialogDescription>
              {editingArticle 
                ? "Posodobite podatke o artiklu" 
                : "Ustvarite nov artikel v trgovini"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="item_number">Šifra artikla</Label>
                <Input
                  id="item_number"
                  value={articleFormData.item_number}
                  onChange={(e) => setArticleFormData({ ...articleFormData, item_number: e.target.value })}
                  placeholder="npr. TS-001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Cena (€)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={articleFormData.price}
                  onChange={(e) => setArticleFormData({ ...articleFormData, price: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Naziv</Label>
              <Input
                id="name"
                value={articleFormData.name}
                onChange={(e) => setArticleFormData({ ...articleFormData, name: e.target.value })}
                placeholder="npr. Klubska majica"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Opis</Label>
              <Textarea
                id="description"
                value={articleFormData.description}
                onChange={(e) => setArticleFormData({ ...articleFormData, description: e.target.value })}
                placeholder="Podrobnejši opis artikla..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Kategorija</Label>
              <Select
                value={articleFormData.category}
                onValueChange={(value) => setArticleFormData({ ...articleFormData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Izberi kategorijo" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.name}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Razpoložljive velikosti</Label>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_SIZES.map((size) => (
                  <div key={size} className="flex items-center space-x-2">
                    <Checkbox
                      id={`size-${size}`}
                      checked={articleFormData.available_sizes.includes(size)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setArticleFormData({
                            ...articleFormData,
                            available_sizes: [...articleFormData.available_sizes, size],
                          });
                        } else {
                          setArticleFormData({
                            ...articleFormData,
                            available_sizes: articleFormData.available_sizes.filter((s) => s !== size),
                          });
                        }
                      }}
                    />
                    <Label htmlFor={`size-${size}`} className="text-sm font-normal">
                      {size}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="image_url">URL slike</Label>
              <Input
                id="image_url"
                value={articleFormData.image_url}
                onChange={(e) => setArticleFormData({ ...articleFormData, image_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="external_link">Zunanja povezava</Label>
              <Input
                id="external_link"
                value={articleFormData.external_link}
                onChange={(e) => setArticleFormData({ ...articleFormData, external_link: e.target.value })}
                placeholder="https://..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsArticleDialogOpen(false)}>
              Prekliči
            </Button>
            <Button onClick={saveArticle}>
              {editingArticle ? "Posodobi" : "Ustvari"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "Uredi kategorijo" : "Nova kategorija"}
            </DialogTitle>
            <DialogDescription>
              {editingCategory 
                ? "Posodobite podatke o kategoriji" 
                : "Ustvarite novo kategorijo"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cat_name">Naziv</Label>
              <Input
                id="cat_name"
                value={categoryFormData.name}
                onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                placeholder="npr. Majice"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat_description">Opis</Label>
              <Textarea
                id="cat_description"
                value={categoryFormData.description}
                onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                placeholder="Opis kategorije..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>
              Prekliči
            </Button>
            <Button onClick={saveCategory}>
              {editingCategory ? "Posodobi" : "Ustvari"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Collection Dialog */}
      <Dialog open={isCollectionDialogOpen} onOpenChange={setIsCollectionDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Nov zbirnik</DialogTitle>
            <DialogDescription>
              Izberite odprta naročila za zbirnik
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="collection_number">Številka zbirnika</Label>
                <Input
                  id="collection_number"
                  value={collectionFormData.collection_number}
                  onChange={(e) => setCollectionFormData({ ...collectionFormData, collection_number: e.target.value })}
                  placeholder="npr. ZBR-001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="collection_notes">Opombe</Label>
                <Input
                  id="collection_notes"
                  value={collectionFormData.notes}
                  onChange={(e) => setCollectionFormData({ ...collectionFormData, notes: e.target.value })}
                  placeholder="Dodatne opombe..."
                />
              </div>
            </div>
            <div className="border rounded-md p-4 max-h-[400px] overflow-y-auto">
              <div className="text-sm font-medium mb-2">
                Odprta naročila ({myOrders.filter(o => o.status === "open").length})
              </div>
              {myOrders
                .filter(o => o.status === "open")
                .map((order) => {
                  const items = orderItems[order.id] || [];
                  return (
                    <div
                      key={order.id}
                      className="flex items-start gap-3 p-3 border rounded-md mb-2 hover:bg-muted/50 cursor-pointer"
                      onClick={() => toggleOrderSelection(order.id)}
                    >
                      <Checkbox
                        checked={selectedOrdersForCollection.has(order.id)}
                        onCheckedChange={() => toggleOrderSelection(order.id)}
                      />
                      <div className="flex-1">
                        <div className="font-medium">{order.order_number}</div>
                        <div className="text-sm text-muted-foreground">
                          {items.length} postavk • {order.total_amount.toFixed(2)} €
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
            <div className="text-sm text-muted-foreground">
              Izbrano: {selectedOrdersForCollection.size} naročil
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCollectionDialogOpen(false)}>
              Prekliči
            </Button>
            <Button 
              onClick={createCollection}
              disabled={selectedOrdersForCollection.size === 0}
            >
              Ustvari zbirnik
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}