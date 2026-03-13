import { useState, useEffect } from "react";
import { DataTable } from "@/components/DataTable";
import { KPICard } from "@/components/KPICard";
import { Activity, Users, Clock, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseGVizJson } from "@/utils/parseGVizJson";

type CustomerActivity = {
    Customer_ID: string;
    Customer_Name: string;
    Customer_Email: string;
    Activities: string;
    Timestamp: string;
    Insights: string;
};

export default function CustomerActivitiesPage() {
    const [data, setData] = useState<CustomerActivity[]>([]);
    const [loading, setLoading] = useState(false);
    const SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID;

    const fetchActivities = async () => {
        setLoading(true);
        try {
            const res = await fetch(
                `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=Customer_Activities`
            );
            const text = await res.text();
            // Safely parse JSON from GViz format
            const jsonStr = text.substring(text.indexOf("(") + 1, text.lastIndexOf(")"));
            const json = JSON.parse(jsonStr);

            const rows: CustomerActivity[] = parseGVizJson(json, "Customer_Activities").map((r: any) => ({
                ...r,
                Timestamp: r.Timestamp ? new Date(r.Timestamp).toLocaleString() : "",
            }));
            setData(rows);
        } catch (err) {
            console.error("Error fetching Customer Activities:", err);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchActivities();
    }, []);

    const uniqueCustomers = new Set(data.map(d => d.Customer_Email)).size;

    const columns = [
        { key: "Customer_ID", label: "ID" },
        { key: "Customer_Name", label: "Name" },
        { key: "Customer_Email", label: "Email" },
        { key: "Activities", label: "Activity Log" },
        { key: "Timestamp", label: "Logged At" },
        { key: "Insights", label: "AI Insights" },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Customer Activities</h1>
                    <p className="text-muted-foreground">Real-time engagement logs</p>
                </div>
                <Button onClick={fetchActivities} disabled={loading} className="flex items-center gap-2">
                    <RefreshCcw size={18} /> {loading ? "Refreshing..." : "Refresh"}
                </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <KPICard title="Total Logs" value={data.length} icon={Activity} />
                <KPICard title="Active Customers" value={uniqueCustomers} icon={Users} />
                <KPICard title="Tracking Active" value="Live" icon={Clock} />
            </div>

            <DataTable data={data} columns={columns} searchPlaceholder="Search logs..." />
        </div>
    );
}
