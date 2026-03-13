import { useState, useEffect } from "react";
import { DataTable } from "@/components/DataTable";
import { KPICard } from "@/components/KPICard";
import { ShoppingCart, Clock, CheckCircle, RefreshCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { parseGVizJson, parsePrice } from "@/utils/parseGVizJson";

type Order = {
  Order_ID: string;
  Customer_ID: string;
  Customer_Name: string;
  Order_Price: number | string;
  Order_Created_DateTime: string;
  Order_Status: string;
};

// Status colors mapping
const statusColors: Record<string, string> = {
  Delivered: "bg-green-600",
  Preparing: "bg-amber-500",
  Pending: "bg-blue-500",
  Cancelled: "bg-red-500",
};

export default function OrdersPage() {
  const [data, setData] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID;

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=Orders`
      );
      const text = await res.text();
      const json = JSON.parse(text.substr(47).slice(0, -2));

      const rows: Order[] = parseGVizJson(json, "Orders").map((r: any) => ({
        ...r,
        Order_Created_DateTime: r.Order_Created_DateTime
          ? new Date(r.Order_Created_DateTime).toLocaleString()
          : "",
        Order_Price: parsePrice(r.Order_Price),
      }));

      setData(rows);
    } catch (err) {
      console.error("Error fetching Orders:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const totalOrders = data.length;
  const pendingOrders = data.filter(
    (o) => o.Order_Status === "Pending" || o.Order_Status === "Preparing"
  ).length;
  const avgOrderValue =
    totalOrders > 0
      ? Math.round(
        data.reduce((sum, o) => sum + parsePrice(o.Order_Price), 0) / totalOrders
      )
      : 0;

  const columns = [
    { key: "Order_ID", label: "Order ID" },
    { key: "Customer_ID", label: "Customer ID" },
    { key: "Customer_Name", label: "Customer" },
    { key: "Order_Price", label: "Price", render: (v: number) => `KSh ${v}` },
    { key: "Order_Created_DateTime", label: "Created" },
    {
      key: "Order_Status",
      label: "Status",
      render: (v: string) => <Badge className={statusColors[v] || ""}>{v}</Badge>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-muted-foreground">All customer orders</p>
        </div>
        <Button
          onClick={fetchOrders}
          disabled={loading}
          className="flex items-center gap-2"
        >
          <RefreshCcw size={18} /> {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard title="Total Orders" value={totalOrders} icon={ShoppingCart} />
        <KPICard
          title="Pending / Preparing"
          value={pendingOrders}
          icon={Clock}
        />
        <KPICard title="Avg Order Value" value={`KSh ${avgOrderValue}`} icon={CheckCircle} />
      </div>

      <DataTable
        data={data}
        columns={columns}
        searchPlaceholder="Search orders..."
      />
    </div>
  );
}
