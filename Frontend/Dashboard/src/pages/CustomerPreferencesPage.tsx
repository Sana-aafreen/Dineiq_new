import { useState, useEffect } from "react";
import { DataTable } from "@/components/DataTable";
import { KPICard } from "@/components/KPICard";
import { Heart, Salad, Coffee, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseGVizJson } from "@/utils/parseGVizJson";

type CustomerPreference = {
  Customer_ID: string;
  Customer_Name: string;
  Customer_Email: string;
  Dietary_Type: string;
  Preferred_Soup: string;
  Favorite_Bun: string;
  Dessert_Preference: string;
  Timestamp: string;
};

export default function CustomerPreferencesPage() {
  const [data, setData] = useState<CustomerPreference[]>([]);
  const [loading, setLoading] = useState(false);
  const SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID;

  const fetchPreferences = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=Customer_Preferences`
      );
      const text = await res.text();
      const json = JSON.parse(text.substr(47).slice(0, -2));

      const rows: CustomerPreference[] = parseGVizJson(json, "Customer_Preferences").map((r: any) => ({
        ...r,
        Timestamp: r.Timestamp ? new Date(r.Timestamp).toLocaleString() : "",
      }));
      setData(rows);
    } catch (err) {
      console.error("Error fetching Customer Preferences:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPreferences();
  }, []);

  const vegCount = data.filter(c => c.Dietary_Type === "Veg" || c.Dietary_Type === "Vegan").length;

  const columns = [
    { key: "Customer_ID", label: "ID" },
    { key: "Customer_Name", label: "Name" },
    { key: "Customer_Email", label: "Email" },
    { key: "Dietary_Type", label: "Dietary Type" },
    { key: "Preferred_Soup", label: "Soup" },
    { key: "Favorite_Bun", label: "Bun" },
    { key: "Dessert_Preference", label: "Dessert" },
    { key: "Timestamp", label: "Updated" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Customer Preferences</h1>
          <p className="text-muted-foreground">Dining preferences and favorites</p>
        </div>
        <Button onClick={fetchPreferences} disabled={loading} className="flex items-center gap-2">
          <RefreshCcw size={18} /> {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard title="Total Preferences" value={data.length} icon={Heart} />
        <KPICard title="Veg/Vegan" value={vegCount} icon={Salad} />
        <KPICard title="Non-Veg" value={data.length - vegCount} icon={Coffee} />
      </div>

      <DataTable data={data} columns={columns} searchPlaceholder="Search preferences..." />
    </div>
  );
}
