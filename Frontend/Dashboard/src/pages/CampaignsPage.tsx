import { useState, useEffect, useMemo } from "react";
import { DataTable } from "@/components/DataTable";
import { KPICard } from "@/components/KPICard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Megaphone, CheckCircle, Clock, RefreshCcw, Plus } from "lucide-react";
import { parseGVizJson } from "@/utils/parseGVizJson";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { CampaignForm } from "@/components/CampaignForm";

type Campaign = {
  Campaign_ID: string;
  Campaign_Text: string;
  Target_Customer_Category: string;
  Campaign_Start_DateTime: string;
  Campaign_End_DateTime: string;
  Campaign_Message_Count: number;
  Campaign_Type: string;
  Campaign_Status: string;
  [key: string]: any; // for Message_Template #1..#10 and Message_Send_Timing #1..#10
};

const statusColors: Record<string, string> = {
  ACTIVE: "bg-green-600",
  UPCOMING: "bg-blue-500",
  INACTIVE: "bg-gray-500",
};

export default function CampaignsPage() {
  const [data, setData] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID;

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=Campaigns&headers=1`
      );
      const text = await res.text();
      const match = text.match(/google\.visualization\.Query\.setResponse\((.*)\);/s);
      if (!match) throw new Error("Could not parse GViz response");

      const json = JSON.parse(match[1]);
      const rows: Campaign[] = parseGVizJson(json, "Campaigns").map((r: any) => {
        const obj = { ...r };

        // Parse date-time columns to local format for display
        ["Campaign_Start_DateTime", "Campaign_End_DateTime"].forEach(key => {
          if (obj[key]) {
            const d = new Date(obj[key]);
            if (!isNaN(d.getTime())) {
              obj[key] = d.toLocaleString();
            }
          }
        });

        return obj;
      });
      setData(rows);
    } catch (err) {
      console.error("❌ Error fetching Campaigns:", err);
    }
    setLoading(false);
  };

  useEffect(() => { fetchCampaigns(); }, []);

  const handleCreateSuccess = () => {
    setIsSheetOpen(false);
    fetchCampaigns();
  };

  const active = data.filter(c => String(c.Campaign_Status).toUpperCase() === "ACTIVE").length;
  const scheduled = data.filter(c => String(c.Campaign_Status).toUpperCase() === "UPCOMING").length;

  // Build columns dynamically
  const columns = useMemo(() => {
    const base = [
      { key: "Campaign_ID", label: "ID" },
      { key: "Campaign_Text", label: "Campaign Text", render: (v: string) => <div className="max-w-[250px] overflow-auto max-h-[80px] text-sm">{v}</div> },
      { key: "Target_Customer_Category", label: "Target" },
      { key: "Campaign_Start_DateTime", label: "Start" },
      { key: "Campaign_End_DateTime", label: "End" },
      { key: "Campaign_Message_Count", label: "Messages" },
      { key: "Campaign_Type", label: "Type" },
      { key: "Campaign_Status", label: "Status", render: (v: string) => <Badge className={statusColors[v] || ""}>{v}</Badge> },
    ];

    for (let i = 1; i <= 10; i++) {
      const tKey = `Message_Template #${i}`;
      const sKey = `Message_Send_Timing #${i}`;
      const hasData = data.some((c) => c[tKey]);
      if (hasData) {
        base.push({
          key: tKey,
          label: `Template #${i}`,
          render: (v: string) => <div className="max-w-[200px] overflow-auto max-h-[80px] text-sm">{v || "—"}</div>,
        });
        base.push({
          key: sKey,
          label: `Timing #${i}`,
          render: (v: string) => <span>{v || "—"}</span>, // HH:mm as-is
        });
      }
    }
    return base;
  }, [data]);

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Campaigns</h1>
          <p className="text-muted-foreground">Marketing campaigns and messaging</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={fetchCampaigns} disabled={loading} variant="outline" className="flex items-center gap-2">
            <RefreshCcw size={18} /> {loading ? "Refreshing..." : "Refresh"}
          </Button>

          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus size={18} /> Create Campaigns
              </Button>
            </SheetTrigger>
            <SheetContent className="sm:max-w-[700px] overflow-y-auto w-[90vw]">
              <SheetHeader className="mb-6">
                <SheetTitle>Create New Campaign</SheetTitle>
                <SheetDescription>
                  Fill out the details below to launch a new marketing campaign.
                </SheetDescription>
              </SheetHeader>
              <CampaignForm onSuccess={handleCreateSuccess} />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard title="Total Campaigns" value={data.length} icon={Megaphone} />
        <KPICard title="Active" value={active} icon={CheckCircle} />
        <KPICard title="Scheduled" value={scheduled} icon={Clock} />
      </div>

      <DataTable data={data} columns={columns} searchPlaceholder="Search campaigns..." />
    </div>
  );
}
