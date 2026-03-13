import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { SessionControls } from "@/components/SessionControls";
import { useUser } from "@/contexts/UserContext";
import {
  ChatMessage as ChatMessageType,
  ClientInfo,
  ChatSession,
  createSessionObject,
  saveChatToBackend,
} from "@/utils/chatUtils";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare } from "lucide-react";

const ChatbotPage = () => {
  const navigate = useNavigate();
  const { isLoggedIn, guestName, phoneNumber, profile } = useUser();
  const { toast } = useToast();

  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [clientInfo, setClientInfo] = useState<ClientInfo>({
    id: profile?.id || "",
    name: guestName || "",
    email: profile?.email || "",
    phone: phoneNumber || ""
  });
  const [sessionStartTime, setSessionStartTime] = useState<Date>(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Regex patterns
  const emailRegex = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
  const phoneRegex = /(\+?\d{1,3}[-.\s]?)?(\(?\d{2,4}\)?[-.\s]?){1,2}\d{3,4}/g;

  // Initialize clientInfo from user context when login state changes
  useEffect(() => {
    if (isLoggedIn) {
      setClientInfo({
        id: profile?.id || "",
        name: guestName || "",
        email: profile?.email || "",
        phone: phoneNumber || ""
      });
    }
  }, [isLoggedIn, guestName, phoneNumber, profile]);

  // Initialize chat greeting
  useEffect(() => {
    const name = isLoggedIn && guestName && guestName !== "Guest" ? guestName : "";
    const content = name
      ? `Hello ${name}! Welcome back. I am your Restaurant concierge. How can I assist you today?`
      : `Hello! Welcome. I am your Restaurant concierge. Please provide your Name, Email, and Phone so I can assist you better.`;

    const greeting: ChatMessageType = {
      id: `msg-greet-${Date.now()}`,
      role: 'ai',
      content,
      timestamp: new Date()
    };
    setMessages([greeting]);
  }, [isLoggedIn, guestName]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const extractClientInfo = (content: string): ClientInfo => {
    let latestInfo = { ...clientInfo };
    let changed = false;

    if (!clientInfo.email) {
      const emailMatch = content.match(emailRegex);
      if (emailMatch) {
        latestInfo.email = emailMatch[0];
        changed = true;
      }
    }

    if (!clientInfo.phone) {
      const phoneMatch = content.match(phoneRegex);
      if (phoneMatch?.length) {
        latestInfo.phone = phoneMatch[0];
        changed = true;
      }
    }

    if (!clientInfo.name || clientInfo.name === "Guest") {
      const nameMatch = content.match(/\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)?\b/);
      if (nameMatch) {
        latestInfo.name = nameMatch[0];
        changed = true;
      }
    }

    if (changed) setClientInfo(latestInfo);
    return latestInfo;
  };

  const handleSendMessage = async (content: string) => {
    const userMessage: ChatMessageType = {
      id: `msg-user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);

    // Extract client info if user is a guest (and get the immediate result)
    let currentClient = clientInfo;
    if (!isLoggedIn) {
      currentClient = extractClientInfo(content);
    }

    setLoading(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL;
      const response = await fetch(`${API_URL}/chatbot/llm-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatHistory: messages.map(msg => ({ role: msg.role, text: msg.content })),
          userMessage: content,
          clientName: currentClient.name || "Guest",
          clientId: currentClient.id || null,
          clientEmail: currentClient.email || null,
          clientPhone: currentClient.phone || null
        })
      });

      if (!response.ok) throw new Error("Failed AI response");

      const data = await response.json();
      const aiMessage: ChatMessageType = {
        id: `msg-ai-${Date.now()}`,
        role: 'ai',
        content: data.response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      toast({
        title: "Error",
        description: "AI could not respond",
        variant: "destructive"
      });
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const resetChat = () => {
    const name = isLoggedIn && guestName && guestName !== "Guest" ? guestName : "";
    const content = name
      ? `Hello ${name}! Welcome back. I am your Restaurant concierge. How can I assist you today?`
      : `Hello! Welcome. I am your Restaurant concierge. Please provide your Name, Email, and Phone so I can assist you better.`;

    setMessages([{
      id: `msg-greet-${Date.now()}`,
      role: 'ai',
      content,
      timestamp: new Date()
    }]);

    if (!isLoggedIn) {
      setClientInfo({ id: "", name: "", email: "", phone: "" });
    } else {
      setClientInfo({
        id: profile?.id || "",
        name: guestName || "",
        email: profile?.email || "",
        phone: phoneNumber || ""
      });
    }

    setSessionStartTime(new Date());
  };

  const handleStartNew = () => {
    if (messages.length > 1) {
      if (!window.confirm("Start new chat? The current session will be lost.")) return;
    }
    resetChat();
    toast({ title: "New chat session started" });
  };

  const handleEndChat = () => {
    saveSession();
  };

  const saveSession = async () => {
    try {
      const session = createSessionObject(
        messages,
        clientInfo,
        sessionStartTime
      );

      const result = await saveChatToBackend(session);

      if (result.status === "success") {
        setCurrentSession(session);
        setIsModalOpen(true);
        resetChat(); // Clear history in background immediately
        toast({
          title: "Chat saved",
          description: `Chat ID: ${result.chatId}`
        });
      } else if (result.status === "ignored") {
        resetChat(); // Clear history even for guests
        toast({
          title: "Session Ended",
          description: "Chat history for guests is not saved. Sign up to keep track of your transcripts.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Error saving chat",
          description: result.message || "Unknown error",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error saving chat",
        description: "Unexpected failure",
        variant: "destructive"
      });
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    resetChat();
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="p-4">
        <button
          onClick={() => navigate("/home")}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/80 transition"
        >
          ← Back to Home
        </button>
      </div>

      <div className="border-b border-border bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">AI Chat Assistant</h1>
              <p className="text-sm text-muted-foreground">Personalized Concierge</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4">
        <SessionControls
          onStartNew={handleStartNew}
          onEndChat={handleEndChat}
          hasMessages={messages.length > 1}
        />
      </div>

      <div className="flex-1 overflow-y-auto container mx-auto px-4 py-6">
        <div className="max-w-4xl mx-auto">
          {messages.map(msg => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="container mx-auto px-4 pb-4">
        <div className="max-w-4xl mx-auto">
          <ChatInput onSend={handleSendMessage} disabled={loading} />
        </div>
      </div>
    </div>
  );
};

export default ChatbotPage;
