/**
 * Placeholder module removed AI logic
 * Now types only for chat session management
 */

export interface ChatMessage {
  id: string;
  role: 'ai' | 'user';
  content: string;
  timestamp: Date;
}

export interface ClientInfo {
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

/**
 * This module no longer generates AI responses.
 * Frontend now calls FastAPI /llm-chat endpoint.
 */
