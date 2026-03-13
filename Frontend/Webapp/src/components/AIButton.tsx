import { Bot, Sparkles } from "lucide-react";
import { useState } from "react";

import { useNavigate } from "react-router-dom";

export default function AIButton() {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate("/chatbot")} // Navigate to chatbot page
      className="floating-button w-14 h-14 bg-primary bottom-24 right-4 animate-bounce-subtle"
    >
      <Bot className="w-7 h-7 text-primary-foreground" />
      <span className="absolute -top-1 -right-1">
        <Sparkles className="w-4 h-4 text-gold" />
      </span>
    </button>
  );
}
