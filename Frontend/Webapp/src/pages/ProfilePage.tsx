import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, User, Phone, Mail, Calendar, Check } from "lucide-react";
import { toast } from "sonner";

export default function ProfilePage() {
  const navigate = useNavigate();
  const { profile, updateProfile, guestName, phoneNumber } = useUser();
  
  const [formData, setFormData] = useState({
    name: profile.name || guestName,
    phone: profile.phone || phoneNumber,
    email: profile.email,
    dateOfBirth: profile.dateOfBirth,
  });

  useEffect(() => {
    setFormData({
      name: profile.name || guestName,
      phone: profile.phone || phoneNumber,
      email: profile.email,
      dateOfBirth: profile.dateOfBirth,
    });
  }, [profile, guestName, phoneNumber]);

  const handleSave = () => {
    updateProfile(formData);
    toast.success("Profile updated successfully!");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-4 px-4 py-4">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-xl font-bold text-foreground">My Profile</h1>
        </div>
      </header>

      {/* Profile Avatar */}
      <div className="flex justify-center py-8">
        <div className="relative">
          <div className="w-24 h-24 rounded-full gradient-primary flex items-center justify-center">
            <User className="w-12 h-12 text-white" />
          </div>
          <button className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-gold text-gold-foreground flex items-center justify-center shadow-lg">
            <span className="text-lg">📷</span>
          </button>
        </div>
      </div>

      {/* Form */}
      <div className="px-5 space-y-5">
        {/* Name */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <User className="w-4 h-4" />
            Full Name
          </label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="h-14 text-lg font-medium bg-secondary border-0 rounded-xl"
            placeholder="Enter your name"
          />
        </div>

        {/* Phone */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Phone className="w-4 h-4" />
            Mobile Number
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
              +91
            </span>
            <Input
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="h-14 text-lg font-medium bg-secondary border-0 rounded-xl pl-14"
              placeholder="Enter mobile number"
            />
          </div>
        </div>

        {/* Email */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Email Address
          </label>
          <Input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="h-14 text-lg font-medium bg-secondary border-0 rounded-xl"
            placeholder="Enter email address"
          />
        </div>

        {/* Date of Birth */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Date of Birth
            <span className="text-xs text-gold ml-auto">🎂 For birthday offers!</span>
          </label>
          <Input
            type="date"
            value={formData.dateOfBirth}
            onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
            className="h-14 text-lg font-medium bg-secondary border-0 rounded-xl"
          />
        </div>
      </div>

      {/* Save Button */}
      <div className="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-background via-background to-transparent">
        <Button
          onClick={handleSave}
          className="w-full h-14 text-lg font-bold rounded-xl gradient-primary text-primary-foreground shadow-lg flex items-center justify-center gap-2"
        >
          <Check className="w-5 h-5" />
          Save Changes
        </Button>
      </div>
    </div>
  );
}
