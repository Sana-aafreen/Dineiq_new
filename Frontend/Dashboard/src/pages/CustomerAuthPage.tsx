import { useState, useEffect } from "react";
import { DataTable } from "@/components/DataTable";
import { KPICard } from "@/components/KPICard";
import { Users, Crown, Clock, RefreshCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { parseGVizJson } from "@/utils/parseGVizJson";

type CustomerAuth = {
  Customer_ID: string;
  Customer_Name: string;
  Customer_Email: string;
  Customer_Phone: string;
  Date_of_Birth: string;
  OTP_Hash?: string;
  OTP_Expires_At?: string;
  Creation_DateTime: string;
  Last_Login_DateTime: string;
  Customer_Category: string;
};

const categoryColors: Record<string, string> = {
  Platinum: "bg-purple-600",
  Gold: "bg-amber-500",
  Silver: "bg-gray-400",
  Bronze: "bg-orange-700",
};

export default function CustomerAuthPage() {
  const [data, setData] = useState<CustomerAuth[]>([]);
  const [loading, setLoading] = useState(false);
  const SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID;

  const fetchCustomerAuth = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=Customer_Auth`
      );
      const text = await res.text();
      const json = JSON.parse(text.substr(47).slice(0, -2));

      const rows: CustomerAuth[] = parseGVizJson(json, "Customer_Auth").map((r: any) => {
        // Store raw ISO strings for date-based calculations before converting to display format
        r._lastLoginRaw = r.Last_Login_DateTime || "";

        // Normalize date-time fields for display
        ["Date_of_Birth", "Creation_DateTime", "Last_Login_DateTime"].forEach((key) => {
          if (r[key]) {
            r[key] = new Date(r[key]).toLocaleString();
          }
        });

        // Ensure Customer_Category is string
        r.Customer_Category = r.Customer_Category ? String(r.Customer_Category) : "";
        return r;
      });

      setData(rows);
    } catch (err) {
      console.error("Error fetching Customer Auth:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCustomerAuth();
  }, []);

  const platinumCount = data.filter(c => c.Customer_Category === "Platinum").length;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentLoginsCount = data.filter(c => {
    const raw = (c as any)._lastLoginRaw;
    if (!raw) return false;
    return new Date(raw) >= sevenDaysAgo;
  }).length;

  const columns = [
    { key: "Customer_ID", label: "ID" },
    { key: "Customer_Name", label: "Name" },
    { key: "Customer_Email", label: "Email" },
    { key: "Customer_Phone", label: "Phone" },
    { key: "Date_of_Birth", label: "DOB" },
    { key: "Creation_DateTime", label: "Created" },
    { key: "Last_Login_DateTime", label: "Last Login" },
    {
      key: "Customer_Category",
      label: "Category",
      render: (v: string) => <Badge className={categoryColors[v] || ""}>{v}</Badge>,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header + Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Customer Auth</h1>
          <p className="text-muted-foreground">Customer authentication records</p>
        </div>
        <Button onClick={fetchCustomerAuth} disabled={loading} className="flex items-center gap-2">
          <RefreshCcw size={18} /> {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard title="Total Customers" value={data.length} icon={Users} />
        <KPICard title="Platinum Members" value={platinumCount} icon={Crown} />
        <KPICard title="Recent Logins (7d)" value={recentLoginsCount} icon={Clock} />
      </div>

      {/* Data Table */}
      <DataTable data={data} columns={columns} searchPlaceholder="Search customers..." />
    </div>
  );
}
