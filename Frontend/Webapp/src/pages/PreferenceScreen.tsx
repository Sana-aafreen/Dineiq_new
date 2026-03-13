import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight, Loader2, Utensils, Coffee, IceCream, Pizza, Moon, Activity, Bell, Sandwich, Flame, DoorOpen, Soup, Beef } from "lucide-react";
import { toast } from "sonner";

// Questions List with Icons
const questions = [
  { id: 1, q: "Dietary Type?", icon: <Utensils className="text-red-500" />, options: ["Vegetarian", "Non-Vegetarian", "Vegan", "Eggetarian", "No-Restrictions"] },
  { id: 2, q: "Preferred Soup?", icon: <Soup className="text-amber-600" />, options: ["Tuscan White Bean", "Mulligatawny Soup", "Green Soup", "Bone Broth & Mushroom Soup"] },
  { id: 3, q: "Favorite Bun?", icon: <Beef className="text-amber-700" />, options: ["Pressed Pork Belly", "Paneer Bao", "Slow-Cooked Beef Brisket"] },
  { id: 4, q: "Dessert Preference?", icon: <IceCream className="text-pink-500" />, options: ["Basque Cheesecake", "Chocolate Overload", "Cyclic Churros", "Lavender Parfait", "Vanilla Millefeuille", "Fresh Fruit Salad", "Sorbet of the Day", "Ice Cream of the Day"] },
];

import { api } from "@/api";

// ...

export default function PreferenceScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const userEmail = location.state?.email || "";
  // const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbziwt_310-tDnkzPTpgbgW89M6jxjDXQVbRIn7k-JzBiezCzoDcjhPjDDbZDjVrLf4N5w/exec";

  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const handleOptionSelect = (option: string) => {
    const newAnswers = { ...answers, [questions[currentStep].id]: option };
    setAnswers(newAnswers);

    if (currentStep < questions.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      submitPreferences(newAnswers);
    }
  };

  const submitPreferences = async (finalAnswers: any) => {
    setIsLoading(true);
    try {
      if (userEmail) {
        await api.savePreferences(userEmail, finalAnswers);
        toast.success("Preferences saved! Customizing menu...");
      } else {
        toast.error("User email missing. Preferences saved locally.");
      }
      navigate('/home');
    } catch (error) {
      toast.error("Failed to connect. Proceeding to Home.");
      navigate('/home');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">

      {/* Top Header Section */}
      <div className="bg-white px-6 pt-12 pb-6 shadow-sm">
        <div className="max-w-md mx-auto">
          <h1 className="text-xl font-black text-gray-900 mb-1">DineIQ <span className="text-[#E23744]">Kitchen</span></h1>
          <p className="text-gray-500 text-xs font-medium">Personalizing your dining experience</p>

          {/* Progress Bar */}
          <div className="mt-6">
            <div className="flex justify-between items-end mb-2">
              <span className="text-[#E23744] font-bold text-xs">Question {currentStep + 1}/4</span>
              <span className="text-gray-400 text-[10px] uppercase tracking-wider font-bold">{Math.round(((currentStep + 1) / 4) * 100)}% Done</span>
            </div>
            <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-[#E23744] h-full transition-all duration-700 ease-out"
                style={{ width: `${((currentStep + 1) / 4) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 px-6 py-10 max-w-md mx-auto w-full">
        <div className="bg-white rounded-[24px] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-50 animate-in fade-in zoom-in-95 duration-500">

          {/* Icon Badge */}
          <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
            {React.cloneElement(questions[currentStep].icon as React.ReactElement, { size: 28 })}
          </div>

          <h2 className="text-2xl font-extrabold text-gray-900 leading-tight mb-8">
            {questions[currentStep].q}
          </h2>

          <div className="space-y-4">
            {questions[currentStep].options.map((option, index) => (
              <button
                key={index}
                disabled={isLoading}
                onClick={() => handleOptionSelect(option)}
                className="w-full py-4 px-6 text-left text-sm font-bold text-gray-700 border-2 border-gray-50 bg-gray-50/50 rounded-2xl hover:border-[#E23744] hover:bg-red-50 hover:text-[#E23744] transition-all duration-200 flex justify-between items-center group active:scale-[0.97]"
              >
                {option}
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm group-hover:bg-[#E23744] transition-colors">
                  <ArrowRight className="text-gray-300 group-hover:text-white transition-colors" size={14} />
                </div>
              </button>
            ))}
          </div>
        </div>

        <p className="text-center text-gray-400 text-[10px] mt-8 uppercase tracking-[2px] font-bold">
          DineIQ Preference Engine
        </p>
      </div>

      {/* Modern Loader */}
      {isLoading && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-md flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center border border-gray-100">
            <div className="relative w-16 h-16 mb-4">
              <div className="absolute inset-0 border-4 border-red-100 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-[#E23744] rounded-full border-t-transparent animate-spin"></div>
            </div>
            <p className="text-sm font-black text-gray-800">SAVING TASTE PROFILE</p>
            <p className="text-[10px] text-gray-400 mt-1 font-bold">PLEASE WAIT...</p>
          </div>
        </div>
      )}
    </div>
  );
}