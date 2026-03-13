import { ChatMessage as ChatMessageType } from "@/utils/chatUtils";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isAI = message.role === 'ai';
  
  return (
    <div
      className={cn(
        "flex w-full mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300",
        isAI ? "justify-start" : "justify-end"
      )}
    >
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3 shadow-sm",
          isAI
            ? "bg-chat-ai-bg text-chat-ai-text rounded-tl-sm"
            : "bg-chat-user-bg text-chat-user-text border border-chat-border rounded-tr-sm"
        )}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
          {message.content}
        </p>
        <span className={cn(
          "text-xs mt-1 block opacity-70",
          isAI ? "text-chat-ai-text" : "text-muted-foreground"
        )}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}
