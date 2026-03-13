import { useState, useEffect } from "react";
import { DataTable } from "@/components/DataTable";
import { KPICard } from "@/components/KPICard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { MessageSquare, Star, Pencil, RefreshCcw, AlertCircle } from "lucide-react";
import { fetchReviews, updateReview } from "@/api";

interface CustomerReview {
    Review_ID: string;
    Customer_ID: string;
    Customer_Name: string;
    Customer_Email: string;
    Review_Date_Time: string;
    Food_Quality: number | string;
    Service: number | string;
    Cleanliness: number | string;
    Value_For_Money: number | string;
    Overall_Experience: number | string;
    Additional_Comments: string;
    Review_Type: string;
    Urgency: string;
    Assigned_To: string;
    Actions_Needed: string;
    Internal_Comments: string;
    Status: string;
}

const urgencyColors: Record<string, string> = {
    High: "bg-red-600",
    Medium: "bg-amber-500",
    Low: "bg-green-600",
};

const statusColors: Record<string, string> = {
    New: "bg-blue-500",
    In_Progress: "bg-amber-500",
    Resolved: "bg-green-600",
    Closed: "bg-gray-500",
};

export default function CustomerReviewsPage() {
    const [data, setData] = useState<CustomerReview[]>([]);
    const [loading, setLoading] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editItem, setEditItem] = useState<Partial<CustomerReview>>({});

    const loadReviews = async () => {
        setLoading(true);
        try {
            const reviews = await fetchReviews();
            // Sort: Newest reviews (by ID or Date) at the top
            const sortedReviews = [...reviews].sort((a, b) => {
                // First priority: Status "New"
                if (a.Status === "New" && b.Status !== "New") return -1;
                if (a.Status !== "New" && b.Status === "New") return 1;

                // Second priority: Date/Time descending
                return new Date(b.Review_Date_Time).getTime() - new Date(a.Review_Date_Time).getTime();
            });
            setData(sortedReviews);
        } catch (err) {
            console.error("Error fetching reviews:", err);
            toast.error("Failed to load reviews");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadReviews();
    }, []);

    const openEdit = (review: CustomerReview) => {
        setEditItem({ ...review });
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!editItem.Review_ID) return;

        setLoading(true);
        try {
            await updateReview(editItem.Review_ID, {
                Urgency: editItem.Urgency,
                Assigned_To: editItem.Assigned_To,
                Actions_Needed: editItem.Actions_Needed,
                Internal_Comments: editItem.Internal_Comments,
                Status: editItem.Status,
            });
            toast.success("Review updated successfully");
            setDialogOpen(false);
            loadReviews();
        } catch (err) {
            console.error("Error updating review:", err);
            toast.error("Failed to update review");
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        { key: "Review_ID", label: "ID" },
        { key: "Customer_Name", label: "Customer" },
        { key: "Review_Date_Time", label: "Date" },
        {
            key: "Overall_Experience", label: "Rating", render: (v: any) => (
                <div className="flex items-center gap-1">
                    <span className="font-bold">{v}</span>
                    <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                </div>
            )
        },
        { key: "Review_Type", label: "Type" },
        {
            key: "Urgency",
            label: "Urgency",
            render: (v: string) => <Badge className={urgencyColors[v] || ""}>{v}</Badge>,
        },
        {
            key: "Assigned_To",
            label: "Assigned To"
        },
        { key: "Actions_Needed", label: "Actions Needed" },
        { key: "Internal_Comments", label: "Internal Comments" },
        {
            key: "Status",
            label: "Status",
            render: (v: string) => <Badge className={statusColors[v] || ""}>{v}</Badge>,
        },
        {
            key: "_actions",
            label: "Actions",
            sortable: false,
            render: (_: any, row: CustomerReview) => (
                <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
                    <Pencil className="h-4 w-4" />
                </Button>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Customer Reviews</h1>
                    <p className="text-muted-foreground">Monitor and manage customer feedback</p>
                </div>
                <Button onClick={loadReviews} disabled={loading} variant="outline" className="gap-2">
                    <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    {loading ? "Refreshing..." : "Refresh"}
                </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <KPICard title="Total Reviews" value={data.length} icon={MessageSquare} />
                <KPICard title="New Reviews" value={data.filter(r => r.Status === "New").length} icon={AlertCircle} />
                <KPICard
                    title="Avg Rating"
                    value={data.length > 0 ? (data.reduce((acc, r) => acc + Number(r.Overall_Experience || 0), 0) / data.length).toFixed(1) : "0.0"}
                    icon={Star}
                />
            </div>

            <DataTable data={data} columns={columns} searchPlaceholder="Search reviews..." />

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Edit Review Status & Details</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Review ID</Label>
                                <Input value={editItem.Review_ID} disabled />
                            </div>
                            <div>
                                <Label>Customer</Label>
                                <Input value={editItem.Customer_Name} disabled />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Urgency</Label>
                                <Select value={editItem.Urgency} onValueChange={(v) => setEditItem({ ...editItem, Urgency: v })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Low">Low</SelectItem>
                                        <SelectItem value="Medium">Medium</SelectItem>
                                        <SelectItem value="High">High</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Status</Label>
                                <Select value={editItem.Status} onValueChange={(v) => setEditItem({ ...editItem, Status: v })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="New">New</SelectItem>
                                        <SelectItem value="In_Progress">In Progress</SelectItem>
                                        <SelectItem value="Resolved">Resolved</SelectItem>
                                        <SelectItem value="Closed">Closed</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Assigned To</Label>
                            <Input
                                value={editItem.Assigned_To || ""}
                                onChange={(e) => setEditItem({ ...editItem, Assigned_To: e.target.value })}
                                placeholder="Staff Name"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="actions">Actions Needed</Label>
                            <Select
                                value={editItem.Actions_Needed || "Internal Review"}
                                onValueChange={(val) => setEditItem((prev: any) => ({ ...prev, Actions_Needed: val }))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select action" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Contact Customer">Contact Customer</SelectItem>
                                    <SelectItem value="Compensation">Compensation</SelectItem>
                                    <SelectItem value="Internal Review">Internal Review</SelectItem>
                                    <SelectItem value="Staff Training">Staff Training</SelectItem>
                                    <SelectItem value="No Action">No Action</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Internal Comments</Label>
                            <Textarea
                                value={editItem.Internal_Comments || ""}
                                onChange={(e) => setEditItem({ ...editItem, Internal_Comments: e.target.value })}
                                placeholder="Staff internal notes..."
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleSave} disabled={loading}>
                            {loading ? "Saving..." : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
