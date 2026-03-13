import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Star, ChevronLeft, Send, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useUser } from "@/contexts/UserContext";
import { api } from "@/api";
import { useToast } from "@/components/ui/use-toast";

const categories = [
    { id: "Food_Quality", label: "Food Quality" },
    { id: "Service", label: "Service" },
    { id: "Cleanliness", label: "Cleanliness" },
    { id: "Value_For_Money", label: "Value for Money" },
    { id: "Overall_Experience", label: "Overall Experience" },
];

export default function ReviewPage() {
    const navigate = useNavigate();
    const { profile } = useUser();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [reviewId, setReviewId] = useState<string | null>(null);
    const [ratings, setRatings] = useState<Record<string, number>>({
        Food_Quality: 0,
        Service: 0,
        Cleanliness: 0,
        Value_For_Money: 0,
        Overall_Experience: 0,
    });
    const [comment, setComment] = useState("");
    const [reviewType, setReviewType] = useState("Appreciation");

    // Fetch latest review on mount
    useEffect(() => {
        const loadLatestReview = async () => {
            if (!profile.email) return;
            setFetching(true);
            const data = await api.fetchLatestReview(profile.email);
            if (data && data.Review_ID) {
                setReviewId(data.Review_ID);
                setRatings({
                    Food_Quality: Number(data.Food_Quality) || 0,
                    Service: Number(data.Service) || 0,
                    Cleanliness: Number(data.Cleanliness) || 0,
                    Value_For_Money: Number(data.Value_For_Money) || 0,
                    Overall_Experience: Number(data.Overall_Experience) || 0,
                });
                setComment(data.Additional_Comments || "");
                setReviewType(data.Review_Type || "Appreciation");

                if (data.Status !== "New") {
                    toast({
                        title: "Review in Progress",
                        description: "Staff is already looking into this. You can still update your feedback.",
                        duration: 3000,
                    });
                } else {
                    toast({
                        title: "Welcome Back!",
                        description: "You can update your previous feedback here.",
                        duration: 3000,
                    });
                }
            }
            setFetching(false);
        };
        loadLatestReview();
    }, [profile.email]);

    const handleRating = (catId: string, value: number) => {
        setRatings((prev) => ({ ...prev, [catId]: value }));
    };

    const handleSubmit = async () => {
        // Basic validation
        if (ratings.Overall_Experience === 0) {
            toast({
                title: "Please provide an overall rating",
                variant: "destructive",
            });
            return;
        }

        setLoading(true);
        const reviewData = {
            Review_ID: reviewId, // Pass ID if updating
            Customer_ID: profile.id || "",
            Customer_Name: profile.name || "Guest",
            Customer_Email: profile.email || "",
            ...ratings,
            Additional_Comments: comment,
            Review_Type: reviewType,
        };

        const result = await api.submitReview(reviewData);
        setLoading(false);

        if (result && result.status === "success") {
            toast({
                title: reviewId ? "Feedback Updated!" : "Feedback Submitted!",
                description: "Thank you for sharing your experience with us.",
            });
            navigate("/home");
        } else {
            toast({
                title: "Submission Failed",
                description: "Could not submit your review. Please try again.",
                variant: "destructive",
            });
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <div className="bg-white px-4 py-4 flex items-center gap-4 sticky top-0 z-10 shadow-sm border-b border-gray-100">
                <button onClick={() => navigate(-1)} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                    <ChevronLeft className="w-6 h-6 text-gray-700" />
                </button>
                <h1 className="text-xl font-bold text-gray-900">Rate your experience</h1>
            </div>

            <div className="flex-1 p-4 space-y-6 max-w-md mx-auto w-full pb-24">
                {/* Rating Categories */}
                <div className="bg-white rounded-2xl p-5 shadow-sm space-y-6">
                    {categories.map((cat) => (
                        <div key={cat.id} className="space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-semibold text-gray-700">{cat.label}</span>
                                <span className="text-xs font-bold text-[#E23744] bg-red-50 px-2 py-0.5 rounded-full">
                                    {ratings[cat.id] > 0 ? `${ratings[cat.id]}/5` : "Rate"}
                                </span>
                            </div>
                            <div className="flex gap-2">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        onClick={() => handleRating(cat.id, star)}
                                        className="p-1 transition-transform active:scale-95"
                                    >
                                        <Star
                                            className={`w-8 h-8 ${star <= ratings[cat.id]
                                                ? "text-yellow-400 fill-yellow-400"
                                                : "text-gray-200"
                                                }`}
                                        />
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Review Type & Comments */}
                <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700">Review Type</label>
                        <Select value={reviewType} onValueChange={setReviewType}>
                            <SelectTrigger className="w-full h-12 rounded-xl focus:ring-red-500 border-gray-200 bg-gray-50/50">
                                <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Appreciation">Appreciation 👋</SelectItem>
                                <SelectItem value="Suggestion">Suggestion 💡</SelectItem>
                                <SelectItem value="Complaint">Complaint ⚠️</SelectItem>
                                <SelectItem value="General Feedback">General Feedback 📝</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center gap-2 px-1">
                            <MessageSquare className="w-4 h-4 text-gray-400" />
                            <label className="text-sm font-semibold text-gray-700">Additional Comments</label>
                        </div>
                        <Textarea
                            placeholder="What did you like? What can we improve?"
                            className="min-h-[120px] rounded-xl focus:ring-red-500 resize-none border-gray-200 bg-gray-50/50"
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Floating Submit Button */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-gray-100 flex justify-center">
                <div className="max-w-md w-full">
                    <Button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="w-full h-14 bg-[#E23744] hover:bg-[#c92c37] text-white text-lg font-bold rounded-2xl shadow-lg shadow-red-200 transition-all active:scale-[0.98]"
                    >
                        {loading ? (
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Submitting...
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Send className="w-5 h-5" />
                                Submit Review
                            </div>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
