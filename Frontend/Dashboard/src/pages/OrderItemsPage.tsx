import { useState, useEffect } from "react";
import { DataTable } from "@/components/DataTable";
import { KPICard } from "@/components/KPICard";
import { ShoppingCart, Clock, CheckCircle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchDashboardDataset } from "@/api";

type OrderItem = {
  Order_Item_ID: string;
  Order_ID: string;
  Item_ID: string;
  Item_Name: string;
  Item_Quantity: number;
  Item_Price: number;
};

export default function OrderItemsPage() {
  const [data, setData] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchOrderItems = async () => {
    setLoading(true);
    try {
      const rows: OrderItem[] = (await fetchDashboardDataset("/dashboard/order-items", "order_items")).map((r: any) => ({
        ...r,
        Item_Quantity: Number(r.Quantity || r.Item_Quantity || 0),
        Item_Price: Number(r.Price || r.Item_Price || 0),
        Item_Name: r.Item_Name || r.name || "Unknown",
      }));
      setData(rows);
    } catch (err) {
      console.error("Error fetching Order Items:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrderItems();
  }, []);

  const totalItems = data.length;
  const totalQuantity = data.reduce((sum, i) => sum + i.Item_Quantity, 0);
  const totalRevenue = data.reduce((sum, i) => sum + i.Item_Price * i.Item_Quantity, 0);

  const columns = [
    { key: "Order_Item_ID", label: "Item ID" },
    { key: "Order_ID", label: "Order ID" },
    { key: "Item_ID", label: "Menu Item ID" },
    { key: "Item_Name", label: "Name" },
    { key: "Item_Quantity", label: "Quantity" },
    { key: "Item_Price", label: "Price", render: (v: number) => `KSh ${v}` },
    { key: "Total", label: "Total", render: (_: any, row: OrderItem) => `KSh ${row.Item_Price * row.Item_Quantity}` },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Order Items</h1>
          <p className="text-muted-foreground">All items for customer orders</p>
        </div>
        <Button onClick={fetchOrderItems} disabled={loading} className="flex items-center gap-2">
          <RefreshCcw size={18} /> {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard title="Total Items" value={totalItems} icon={ShoppingCart} />
        <KPICard title="Total Quantity" value={totalQuantity} icon={Clock} />
        <KPICard title="Total Revenue" value={`KSh ${totalRevenue}`} icon={CheckCircle} />
      </div>

      <DataTable data={data} columns={columns} searchPlaceholder="Search order items..." />
    </div>
  );
}
