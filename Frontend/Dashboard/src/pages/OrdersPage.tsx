import { useState, useEffect } from "react";
import { DataTable } from "@/components/DataTable";
import { KPICard } from "@/components/KPICard";
import { ShoppingCart, Clock, CheckCircle, RefreshCcw, Cloud, HardDrive } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { LOCAL_API_BASE_URL, ONLINE_API_BASE_URL } from "@/api";

type Order = {
  id: string;
  order_id: string;
  customer_email: string;
  customer_name: string;
  total_amount: number;
  created_at: string;
  status: string;
  sync_status: string;
  table_number: string;
  source: "local" | "online" | "both";
  cloud_order_id?: string | null;
};

type BackendOrder = {
  Order_ID: string;
  Customer_ID: string;
  Order_Price: number | string;
  Order_Created_DateTime: string;
  Order_Status: string;
  Table_Number?: string;
};

type Customer = {
  Customer_ID: string;
  Customer_Name: string;
  Customer_Email: string;
};

const statusColors: Record<string, string> = {
  delivered: "bg-green-600",
  ready: "bg-green-600",
  created: "bg-blue-500",
  preparing: "bg-amber-500",
  pending: "bg-blue-500",
  cancelled: "bg-red-500",
};

const syncBadgeStyles: Record<string, string> = {
  synced: "bg-green-100 text-green-700 border-green-200",
  pending_sync: "bg-amber-100 text-amber-700 border-amber-200",
  failed: "bg-red-100 text-red-700 border-red-200",
  conflict: "bg-purple-100 text-purple-700 border-purple-200",
  online: "bg-sky-100 text-sky-700 border-sky-200",
};

const sourceBadgeStyles: Record<Order["source"], string> = {
  local: "bg-amber-100 text-amber-800 border-amber-200",
  online: "bg-sky-100 text-sky-800 border-sky-200",
  both: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

const normalizeLocalOrder = (order: any): Order => ({
  id: order.id || order.order_id,
  order_id: order.order_id || order.id,
  customer_email: order.customer_email || "",
  customer_name: order.customer_name || "",
  total_amount: Number(order.total_amount || 0),
  created_at: order.created_at || "",
  status: String(order.status || "pending").toLowerCase(),
  sync_status: String(order.sync_status || "pending_sync").toLowerCase(),
  table_number: String(order.table_number || order.table_no || ""),
  source: "local",
  cloud_order_id: order.cloud_order_id || null,
});

const normalizeOnlineOrder = (
  order: BackendOrder,
  customersById: Map<string, Customer>
): Order => {
  const customer = customersById.get(order.Customer_ID);
  return {
    id: order.Order_ID,
    order_id: order.Order_ID,
    customer_email: customer?.Customer_Email || "",
    customer_name: customer?.Customer_Name || order.Customer_ID || "Guest",
    total_amount: Number(order.Order_Price || 0),
    created_at: order.Order_Created_DateTime || "",
    status: String(order.Order_Status || "created").toLowerCase(),
    sync_status: "online",
    table_number: String(order.Table_Number || ""),
    source: "online",
    cloud_order_id: order.Order_ID,
  };
};

const mergeOrders = (localOrders: Order[], onlineOrders: Order[]) => {
  const merged = new Map<string, Order>();

  for (const onlineOrder of onlineOrders) {
    merged.set(onlineOrder.order_id, onlineOrder);
  }

  for (const localOrder of localOrders) {
    const matchKey = localOrder.cloud_order_id || localOrder.order_id;
    const existing = merged.get(matchKey);

    if (existing) {
      merged.set(matchKey, {
        ...existing,
        customer_email: existing.customer_email || localOrder.customer_email,
        customer_name: existing.customer_name || localOrder.customer_name,
        table_number: existing.table_number || localOrder.table_number,
        status: localOrder.status || existing.status,
        sync_status:
          localOrder.sync_status === "synced" ? existing.sync_status : localOrder.sync_status,
        source: "both",
        cloud_order_id: localOrder.cloud_order_id || existing.cloud_order_id,
      });
    } else {
      merged.set(matchKey, localOrder);
    }
  }

  return Array.from(merged.values()).sort(
    (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  );
};

export default function OrdersPage() {
  const [data, setData] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const [localRes, onlineRes, customersRes] = await Promise.all([
        fetch(`${LOCAL_API_BASE_URL}/orders`).catch(() => null),
        fetch(`${ONLINE_API_BASE_URL}/dashboard/orders`).catch(() => null),
        fetch(`${ONLINE_API_BASE_URL}/dashboard/customers`).catch(() => null),
      ]);

      const localRows = localRes && localRes.ok ? await localRes.json() : [];
      const onlinePayload = onlineRes && onlineRes.ok ? await onlineRes.json() : { orders: [] };
      const customerPayload =
        customersRes && customersRes.ok ? await customersRes.json() : { customers: [] };

      const customersById = new Map<string, Customer>(
        (customerPayload.customers || []).map((customer: Customer) => [
          customer.Customer_ID,
          customer,
        ])
      );

      const normalizedLocal = Array.isArray(localRows)
        ? localRows.map(normalizeLocalOrder)
        : [];
      const normalizedOnline = Array.isArray(onlinePayload.orders)
        ? onlinePayload.orders.map((order: BackendOrder) =>
            normalizeOnlineOrder(order, customersById)
          )
        : [];

      setData(mergeOrders(normalizedLocal, normalizedOnline));
    } catch (err) {
      console.error("Error fetching merged orders:", err);
      toast.error("Could not load online and offline orders for the Dashboard");
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const updateOrderStatus = async (row: Order, status: string) => {
    if (row.source === "online") {
      toast.info("Online-only rows are read from backend history. Update the local order stream or backend flow first.");
      return;
    }

    setUpdatingId(row.order_id);
    try {
      const targetId = row.id;
      const res = await fetch(`${LOCAL_API_BASE_URL}/orders/${targetId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(`Status update failed: ${res.status}`);

      setData((current) =>
        current.map((order) =>
          order.id === row.id ? { ...order, status } : order
        )
      );
      toast.success(`Order marked ${status}`);
    } catch (err) {
      console.error("Error updating local order status:", err);
      toast.error("Failed to update order status");
    } finally {
      setUpdatingId(null);
    }
  };

  const totalOrders = data.length;
  const pendingOrders = data.filter((o) =>
    ["pending", "preparing", "created"].includes((o.status || "").toLowerCase())
  ).length;
  const awaitingSync = data.filter(
    (o) => (o.sync_status || "pending_sync").toLowerCase() === "pending_sync"
  ).length;
  const onlineOrders = data.filter((o) => o.source === "online" || o.source === "both").length;
  const avgOrderValue =
    totalOrders > 0
      ? Math.round(
          data.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) / totalOrders
        )
      : 0;

  const columns = [
    { key: "order_id", label: "Order ID" },
    {
      key: "source",
      label: "Source",
      render: (v: Order["source"]) => (
        <Badge variant="outline" className={sourceBadgeStyles[v] || sourceBadgeStyles.local}>
          {v === "local" ? "local" : v === "online" ? "online" : "both"}
        </Badge>
      ),
    },
    { key: "table_number", label: "Table" },
    {
      key: "customer_name",
      label: "Customer",
      render: (_: string, row: Order) => row.customer_name || row.customer_email || "Guest",
    },
    {
      key: "total_amount",
      label: "Price",
      render: (v: number) => `KSh ${Number(v || 0)}`,
    },
    {
      key: "created_at",
      label: "Created",
      render: (v: string) => (v ? new Date(v).toLocaleString() : ""),
    },
    {
      key: "status",
      label: "Status",
      render: (v: string) => {
        const normalized = (v || "pending").toLowerCase();
        return <Badge className={statusColors[normalized] || ""}>{normalized}</Badge>;
      },
    },
    {
      key: "sync_status",
      label: "Sync",
      render: (v: string) => {
        const normalized = (v || "pending_sync").toLowerCase();
        return (
          <Badge
            variant="outline"
            className={syncBadgeStyles[normalized] || "bg-slate-100 text-slate-700 border-slate-200"}
          >
            {normalized}
          </Badge>
        );
      },
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      render: (_: unknown, row: Order) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={updatingId === row.order_id || row.source === "online"}
            onClick={() => updateOrderStatus(row, "preparing")}
          >
            Preparing
          </Button>
          <Button
            size="sm"
            disabled={updatingId === row.order_id || row.source === "online"}
            onClick={() => updateOrderStatus(row, "ready")}
          >
            Ready
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-muted-foreground">
            Merged view of backend online orders and local Wi-Fi/offline orders
          </p>
        </div>
        <Button
          onClick={fetchOrders}
          disabled={loading}
          className="flex items-center gap-2"
        >
          <RefreshCcw size={18} /> {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <KPICard title="Total Orders" value={totalOrders} icon={ShoppingCart} />
        <KPICard title="Pending / Preparing" value={pendingOrders} icon={Clock} />
        <KPICard title="Awaiting Sync" value={awaitingSync} icon={RefreshCcw} />
        <KPICard title="Online Reflected" value={onlineOrders} icon={Cloud} />
        <KPICard title="Avg Order Value" value={`KSh ${avgOrderValue}`} icon={CheckCircle} />
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="font-semibold text-foreground">Visibility guide:</span>
          <Badge variant="outline" className={sourceBadgeStyles.local}>
            <HardDrive className="mr-1 h-3 w-3" />
            local
          </Badge>
          <span className="text-muted-foreground">Saved on local Wi-Fi server only.</span>
          <Badge variant="outline" className={sourceBadgeStyles.online}>
            <Cloud className="mr-1 h-3 w-3" />
            online
          </Badge>
          <span className="text-muted-foreground">Came from backend SQLite directly.</span>
          <Badge variant="outline" className={sourceBadgeStyles.both}>both</Badge>
          <span className="text-muted-foreground">Seen in both local and backend data.</span>
          <Badge variant="outline" className={syncBadgeStyles.pending_sync}>pending_sync</Badge>
          <span className="text-muted-foreground">Local order is waiting to sync upstream.</span>
        </div>
      </div>

      <DataTable
        data={data}
        columns={columns}
        searchPlaceholder="Search merged orders..."
      />
    </div>
  );
}
