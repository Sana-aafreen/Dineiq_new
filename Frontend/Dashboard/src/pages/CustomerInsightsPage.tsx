import { useState, useEffect } from "react";
import { DataTable } from "@/components/DataTable";
import { KPICard } from "@/components/KPICard";
import { Brain, TrendingUp, Star, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type CustomerInsight = {
  Customer_ID: string;
  Customer_Name: string;
  Dietary: string;
  Favorites: string;
  AOV: string; // already a string
  Frequency: string;
  Attitude: string;
  Customer_Score: number;
};

const scoreColor = (score: number) => {
  if (score >= 80) return "text-green-600 font-bold";
  if (score >= 60) return "text-amber-600 font-semibold";
  return "text-red-500 font-semibold";
};

export default function CustomerInsightsPage() {
  const [data, setData] = useState<CustomerInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID;

  const fetchCustomerInsights = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=Customer_Insights`
      );
      const text = await res.text();
      const json = JSON.parse(text.substr(47).slice(0, -2));

      const cols = json.table.cols.map((c: any) => c.label);

      const rows: CustomerInsight[] = json.table.rows
        .map((row: any) => {
          const obj: any = {};
          cols.forEach((col: string, i: number) => {
            obj[col] = row.c[i]?.v ?? "";
          });
          return obj.Customer_ID ? obj : null;
        })
        .filter(Boolean);

      setData(rows as CustomerInsight[]);
    } catch (err) {
      console.error("Error fetching Customer Insights:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCustomerInsights();
  }, []);

  const avgScore =
    data.length > 0
      ? Math.round(data.reduce((sum, c) => sum + Number(c.Customer_Score || 0), 0) / data.length)
      : 0;

  // % of customers classified as high-value spenders (Premium or High AOV)
  const topAovCount = data.filter(c =>
    c.AOV === "Premium Spender" || c.AOV === "High Spender"
  ).length;
  const topAovPct = data.length > 0 ? Math.round((topAovCount / data.length) * 100) : 0;

  const columns = [
    { key: "Customer_ID", label: "ID" },
    { key: "Customer_Name", label: "Name" },
    { key: "Dietary", label: "Dietary" },
    { key: "Favorites", label: "Favorites" },
    { key: "AOV", label: "AOV" }, // display as string, no conversion
    { key: "Frequency", label: "Frequency" },
    { key: "Attitude", label: "Attitude" },
    {
      key: "Customer_Score",
      label: "Score",
      render: (v: number) => <span className={scoreColor(v)}>{v}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Customer Insights</h1>
          <p className="text-muted-foreground">Behavioral analytics and scoring</p>
        </div>
        <Button
          onClick={fetchCustomerInsights}
          disabled={loading}
          className="flex items-center gap-2"
        >
          <RefreshCcw size={18} /> {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard title="Avg Score" value={avgScore} icon={Star} subtitle="/100" />
        <KPICard title="Total Profiles" value={data.length} icon={Brain} />
        <KPICard title="% Top AOV" value={`${topAovPct}%`} icon={TrendingUp} subtitle="Premium + High" />
      </div>

      <DataTable data={data} columns={columns} searchPlaceholder="Search insights..." />
    </div>
  );
}
