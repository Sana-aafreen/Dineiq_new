// src/utils/chatUtils.ts
export interface ChatMessage {
  id: string;
  role: 'ai' | 'user';
  content: string;
  timestamp: Date;
}

export interface ClientInfo {
  id?: string;
  name: string;
  email: string;
  phone: string;
}

export interface ChatSession {
  clientId: string;
  chatId: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  date: string;
  time: string;
  transcriptText: string;
}

// export function generateClientId(): string {
//   const num = Math.floor(10000 + Math.random() * 90000); // 5-digit number
//   return `Cust_${num}`;
// }

// export function generateChatId(): string {
//   const num = Math.floor(10000 + Math.random() * 90000); // 5-digit number
//   return `Chat_${num}`;
// }

export function formatTranscript(messages: ChatMessage[], clientName: string): string {
  return messages
    .map(msg => {
      const sender = msg.role === 'ai' ? 'AI' : clientName || "Client";
      return `${sender}: ${msg.content}`;
    })
    .join('\n');
}

export function createSessionObject(
  messages: ChatMessage[],
  clientInfo: ClientInfo,
  sessionStartTime: Date
): ChatSession {
  const clientId = clientInfo.id || "";
  const chatId = "";

  const date = sessionStartTime.toLocaleDateString('en-US', {
    year: 'numeric', month: '2-digit', day: '2-digit'
  });
  const time = sessionStartTime.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });

  const transcriptText = formatTranscript(messages, clientInfo.name);

  return {
    clientId,
    chatId,
    clientName: clientInfo.name || "",
    clientEmail: clientInfo.email || "",
    clientPhone: clientInfo.phone || "",
    date,
    time,
    transcriptText
  };
}

/* -----------------------------------------------------------
   SAVE CHAT → backend (not Apps Script)
----------------------------------------------------------- */
export async function saveChatToBackend(sessionObject: ChatSession): Promise<any> {
  console.log("📤 Sending session to backend:", sessionObject);

  try {
    const API_URL = import.meta.env.VITE_API_URL + "/chatbot/save-chat";

    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sessionObject),
    });

    if (!response.ok) {
      console.error("❌ Backend save failed:", response.statusText);
      return { status: "error", message: "Backend error" };
    }

    const data = await response.json();
    console.log("✅ Backend save result:", data);

    return data;   // ✅ return response

  } catch (error) {
    console.error("❌ Error saving chat:", error);
    return { status: "error", message: "Network error" };
  }
}

/* -----------------------------------------------------------
   DOWNLOAD TRANSCRIPT (unchanged)
----------------------------------------------------------- */
export function downloadTranscript(sessionObject: ChatSession): void {
  const content = `Chat Transcript
================
Client ID: ${sessionObject.clientId}
Chat ID: ${sessionObject.chatId}
Client: ${sessionObject.clientName}
Email: ${sessionObject.clientEmail}
Phone: ${sessionObject.clientPhone}
Date: ${sessionObject.date}
Time: ${sessionObject.time}

Transcript:
-----------
${sessionObject.transcriptText}
`;

  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chat-${sessionObject.chatId}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
