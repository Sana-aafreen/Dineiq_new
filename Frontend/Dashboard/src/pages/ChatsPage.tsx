import { useState, useEffect } from "react";
import { DataTable } from "@/components/DataTable";
import { KPICard } from "@/components/KPICard";
import { MessageCircle, Users, Calendar, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseGVizJson } from "@/utils/parseGVizJson";

type Chat = {
  Chat_ID: string;
  Customer_ID: string;
  Customer_Name: string;
  Customer_Phone: string;
  Customer_Email: string;
  Chat_Date_Time: string;
  Chat_Session_Text: string;
};

export default function ChatsPage() {
  const [data, setData] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(false);
  const SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID;

  const fetchChats = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=Chats`
      );
      const text = await res.text();
      const json = JSON.parse(text.substr(47).slice(0, -2));
      const rows: Chat[] = parseGVizJson(json, "Chats").map((r: any) => ({
        ...r,
        Chat_Date_Time: r.Chat_Date_Time ? new Date(r.Chat_Date_Time).toLocaleString() : "",
      }));
      setData(rows);
    } catch (err) {
      console.error("Error fetching Chats:", err);
    }
    setLoading(false);
  };

  useEffect(() => { fetchChats(); }, []);

  const totalChats = data.length;
  const uniqueCustomers = new Set(data.map(c => c.Customer_ID)).size;
  const todayChats = data.filter(c => {
    const chatDate = new Date(c.Chat_Date_Time);
    const today = new Date();
    return (
      chatDate.getDate() === today.getDate() &&
      chatDate.getMonth() === today.getMonth() &&
      chatDate.getFullYear() === today.getFullYear()
    );
  }).length;

  const columns = [
    { key: "Chat_ID", label: "Chat ID" },
    { key: "Customer_ID", label: "Customer ID" },
    { key: "Customer_Name", label: "Name" },
    { key: "Customer_Phone", label: "Phone" },
    { key: "Customer_Email", label: "Email" },
    { key: "Chat_Date_Time", label: "Date/Time" },
    {
      key: "Chat_Session_Text",
      label: "Chat Text",
      render: (v: string) => (
        <div className="max-w-[300px] overflow-auto max-h-[80px] text-sm">{v}</div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Chats</h1>
          <p className="text-muted-foreground">Customer chat sessions</p>
        </div>
        <Button onClick={fetchChats} disabled={loading} className="flex items-center gap-2">
          <RefreshCcw size={18} /> {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard title="Total Chats" value={totalChats} icon={MessageCircle} />
        <KPICard title="Unique Customers" value={uniqueCustomers} icon={Users} />
        <KPICard title="Today" value={todayChats} icon={Calendar} />
      </div>

      <DataTable data={data} columns={columns} searchPlaceholder="Search chats..." />
    </div>
  );
}
