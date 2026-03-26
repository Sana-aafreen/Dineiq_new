import { useState, useEffect } from "react";
import { DataTable } from "@/components/DataTable";
import { KPICard } from "@/components/KPICard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, UtensilsCrossed, CheckCircle, XCircle, RefreshCcw } from "lucide-react";
import { fetchDashboardDataset, ONLINE_API_BASE_URL } from "@/api";

interface MenuItem {
  Item_ID: string;
  Item_Name: string;
  Item_Category: string;
  Base_Price: number;
  Low_Cap_Price: number;
  High_Cap_Price: number;
  Current_Price: number;
  Is_Active: string; // "ACTIVE" | "INACTIVE"
}

const emptyItem: MenuItem = {
  Item_ID: "",
  Item_Name: "",
  Item_Category: "",
  Base_Price: 0,
  Low_Cap_Price: 0,
  High_Cap_Price: 0,
  Current_Price: 0,
  Is_Active: "ACTIVE",
};

export default function MenuPage() {
  const [data, setData] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<MenuItem>(emptyItem);
  const [isNew, setIsNew] = useState(false);

  const fetchMenu = async () => {
    setLoading(true);
    try {
      const rows: any[] = await fetchDashboardDataset("/dashboard/menu", "items");

      // Normalize Is_Active to uppercase string "ACTIVE"/"INACTIVE"
      const normalizedData: MenuItem[] = rows.map((i: any) => ({
        ...i,
        Base_Price: Number(i.Base_Price || 0),
        Low_Cap_Price: Number(i.Low_Cap_Price || 0),
        High_Cap_Price: Number(i.High_Cap_Price || 0),
        Current_Price: Number(i.Current_Price || 0),
        Is_Active:
          i.Is_Active !== undefined && i.Is_Active !== null
            ? String(i.Is_Active).toUpperCase()
            : "INACTIVE",
      }));

      setData(normalizedData);
    } catch (err) {
      console.error("Error fetching Menu:", err);
      toast({ title: "Error", description: "Failed to fetch menu from Google Sheets", variant: "destructive" });
    }
    setLoading(false);
  };

  const handleSyncHarvest = async () => {
    setLoading(true);
    toast({ title: "Syncing...", description: "Extracting menu from Harvest Kenya website..." });
    try {
      const response = await fetch(`${ONLINE_API_BASE_URL}/menu/sync-external`, {
        method: "POST"
      });
      const result = await response.json();

      if (result.status === "SUCCESS") {
        toast({
          title: "Sync Success",
          description: `Added: ${result.new_items}, Updated: ${result.updated_prices}, Deactivated: ${result.deactivated}`
        });
        fetchMenu();
      } else if (result.status === "NO_CHANGE") {
        toast({ title: "No Changes", description: "Menu is already up to date." });
      } else {
        toast({ title: "Error", description: result.detail || "Failed to sync menu", variant: "destructive" });
      }
    } catch (err) {
      console.error("Error syncing menu:", err);
      toast({ title: "Error", description: "Backend server connection failed", variant: "destructive" });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMenu();
  }, []);

  const openAdd = () => {
    // Generate next ID in format Item_0001
    const ids = data.map(i => {
      const match = i.Item_ID.match(/\d+/);
      return match ? parseInt(match[0]) : 0;
    });
    const nextId = Math.max(0, ...ids) + 1;
    const formattedId = `Item_${String(nextId).padStart(4, "0")}`;

    setEditItem({ ...emptyItem, Item_ID: formattedId });
    setIsNew(true);
    setDialogOpen(true);
  };

  const openEdit = (item: MenuItem) => {
    setEditItem({ ...item });
    setIsNew(false);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setData((d) => d.filter((r) => r.Item_ID !== id));
    toast({ title: "Deleted", description: `Item ${id} removed` });
  };

  const handleSave = () => {
    if (!editItem.Item_Name) {
      toast({ title: "Error", description: "Item name is required", variant: "destructive" });
      return;
    }
    if (isNew) setData((d) => [...d, editItem]);
    else setData((d) => d.map((r) => (r.Item_ID === editItem.Item_ID ? editItem : r)));
    setDialogOpen(false);
    toast({ title: isNew ? "Added" : "Updated", description: `${editItem.Item_Name} saved` });
  };

  const columns = [
    { key: "Item_ID", label: "ID" },
    { key: "Item_Name", label: "Name" },
    { key: "Item_Category", label: "Category" },
    { key: "Base_Price", label: "Base Price", render: (v: number) => `KSh ${v}` },
    { key: "Low_Cap_Price", label: "Low Cap", render: (v: number) => `KSh ${v}` },
    { key: "High_Cap_Price", label: "High Cap", render: (v: number) => `KSh ${v}` },
    { key: "Current_Price", label: "Current", render: (v: number) => <span className="font-semibold">KSh {v}</span> },
    {
      key: "Is_Active",
      label: "Active",
      render: (v: string) =>
        v === "ACTIVE" ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>,
    },
    {
      key: "_actions",
      label: "Actions",
      sortable: false,
      render: (_: any, row: MenuItem) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleDelete(row.Item_ID)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Menu</h1>
          <p className="text-muted-foreground">Manage your restaurant menu items</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleSyncHarvest}
            disabled={true}
            className="flex items-center gap-2 bg-gray-200 text-gray-500 cursor-not-allowed hover:bg-gray-200"
          >
            <RefreshCcw size={18} />
            Sync from Harvest
          </Button>
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1" /> Add Item
          </Button>
          <Button
            onClick={fetchMenu}
            disabled={loading}
            className="flex items-center gap-2 bg-blue-500 text-white hover:bg-blue-600"
          >
            <RefreshCcw size={18} /> {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard title="Total Items" value={data.length} icon={UtensilsCrossed} />
        <KPICard title="Active Items" value={data.filter((i) => i.Is_Active === "ACTIVE").length} icon={CheckCircle} />
        <KPICard title="Inactive Items" value={data.filter((i) => i.Is_Active !== "ACTIVE").length} icon={XCircle} />
      </div>

      <DataTable data={data} columns={columns} searchPlaceholder="Search menu items..." />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isNew ? "Add Menu Item" : "Edit Menu Item"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Item ID</Label>
                <Input value={editItem.Item_ID} disabled />
              </div>
              <div>
                <Label>Name</Label>
                <Input value={editItem.Item_Name} onChange={(e) => setEditItem({ ...editItem, Item_Name: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Category</Label>
              <Input
                value={editItem.Item_Category}
                onChange={(e) => setEditItem({ ...editItem, Item_Category: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Base Price</Label>
                <Input
                  type="number"
                  value={editItem.Base_Price}
                  onChange={(e) => setEditItem({ ...editItem, Base_Price: +e.target.value })}
                />
              </div>
              <div>
                <Label>Current Price</Label>
                <Input
                  type="number"
                  value={editItem.Current_Price}
                  onChange={(e) => setEditItem({ ...editItem, Current_Price: +e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Low Cap</Label>
                <Input
                  type="number"
                  value={editItem.Low_Cap_Price}
                  onChange={(e) => setEditItem({ ...editItem, Low_Cap_Price: +e.target.value })}
                />
              </div>
              <div>
                <Label>High Cap</Label>
                <Input
                  type="number"
                  value={editItem.High_Cap_Price}
                  onChange={(e) => setEditItem({ ...editItem, High_Cap_Price: +e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={editItem.Is_Active === "ACTIVE"}
                onCheckedChange={(c) => setEditItem({ ...editItem, Is_Active: c ? "ACTIVE" : "INACTIVE" })}
              />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
