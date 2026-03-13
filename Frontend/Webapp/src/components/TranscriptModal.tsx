import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Download, CheckCircle2 } from "lucide-react";
import { ChatSession } from "@/utils/chatUtils";

interface TranscriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: ChatSession | null;
  onDownload: () => void;
}

export function TranscriptModal({ isOpen, onClose, session, onDownload }: TranscriptModalProps) {
  if (!session) return null;

  const jsonPayload = JSON.stringify(session, null, 2);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <DialogTitle>Chat Session Saved</DialogTitle>
          </div>
          <DialogDescription>
            The chat transcript is ready to be sent to your backend.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto">
          <div>
            <h4 className="text-sm font-semibold mb-2">Session Details</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-muted-foreground">Client ID:</div>
              <div className="font-mono">{session.clientId}</div>
              <div className="text-muted-foreground">Chat ID:</div>
              <div className="font-mono">{session.chatId}</div>
              <div className="text-muted-foreground">Name:</div>
              <div>{session.clientName}</div>
              <div className="text-muted-foreground">Email:</div>
              <div>{session.clientEmail}</div>
              <div className="text-muted-foreground">Phone:</div>
              <div>{session.clientPhone}</div>
              <div className="text-muted-foreground">Date:</div>
              <div>{session.date}</div>
              <div className="text-muted-foreground">Time:</div>
              <div>{session.time}</div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-2">Transcript Preview</h4>
            <Textarea
              value={session.transcriptText}
              readOnly
              className="min-h-[200px] font-mono text-xs"
            />
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-2">JSON Payload (for Apps Script)</h4>
            <Textarea
              value={jsonPayload}
              readOnly
              className="min-h-[200px] font-mono text-xs"
            />
          </div>
        </div>

        <DialogFooter className="flex-row gap-2 sm:gap-2">
          <Button onClick={onDownload} variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Download Transcript
          </Button>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
