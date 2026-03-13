import { Button } from "@/components/ui/button";
import { RotateCcw, LogOut } from "lucide-react";

interface SessionControlsProps {
  onStartNew: () => void;
  onEndChat: () => void;
  hasMessages: boolean;
}

export function SessionControls({ onStartNew, onEndChat, hasMessages }: SessionControlsProps) {
  return (
    <div className="flex gap-2 p-4 border-b border-border bg-card">
      <Button
        onClick={onStartNew}
        variant="outline"
        size="sm"
        className="gap-2"
      >
        <RotateCcw className="h-4 w-4" />
        Start New Chat
      </Button>
      <Button
        onClick={onEndChat}
        variant="default"
        size="sm"
        disabled={!hasMessages}
        className="gap-2"
      >
        <LogOut className="h-4 w-4" />
        End Chat Session
      </Button>
    </div>
  );
}
