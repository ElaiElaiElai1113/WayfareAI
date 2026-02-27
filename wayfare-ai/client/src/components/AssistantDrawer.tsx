import { useMemo, useState } from "react";
import { MessageCircle, Send, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { streamChat } from "@/lib/api";
import type { Itinerary } from "@/types/itinerary";

type ChatMessage = { role: "user" | "assistant"; content: string };

const QUICK_ACTIONS = [
  "replan_day(1)",
  "swap_stop(stop_1)",
  "suggest_nearby(cafes,2000)",
  "adjust_budget(300)",
  "change_pace(Relaxed)"
];

export function AssistantDrawer({ itinerary, onUpdateItinerary, openDefault }: { itinerary: Itinerary | null; onUpdateItinerary: (next: Itinerary) => void; openDefault?: boolean }) {
  const [messages, setMessages] = useLocalStorage<ChatMessage[]>("wayfare-chat-memory", []);
  const [open, setOpen] = useState(Boolean(openDefault));
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const disabled = useMemo(() => !itinerary || loading || !input.trim(), [itinerary, input, loading]);

  const send = async (content?: string) => {
    if (!itinerary) return;
    const messageText = (content ?? input).trim();
    if (!messageText) return;

    setLoading(true);
    setInput("");
    const nextMessages = [...messages, { role: "user", content: messageText }, { role: "assistant", content: "" }];
    setMessages(nextMessages);

    try {
      const { updatedItinerary } = await streamChat(
        { message: messageText, itinerary, preferences: itinerary.preferences },
        (chunk) => {
          setMessages((prev) => {
            const copy = [...prev];
            const idx = copy.length - 1;
            if (copy[idx]?.role === "assistant") {
              copy[idx] = { ...copy[idx], content: `${copy[idx].content}${chunk}` };
            }
            return copy;
          });
        }
      );

      if (updatedItinerary) {
        onUpdateItinerary(updatedItinerary);
      }
    } catch (e) {
      const text = e instanceof Error ? e.message : "Chat failed";
      setMessages((prev) => [...prev, { role: "assistant", content: text }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <aside className="fixed bottom-4 right-4 top-4 z-30 w-[calc(100%-2rem)] max-w-md">
      {open ? (
        <Card className="h-full p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-800">Wayfare Assistant</h3>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Close</Button>
          </div>

          <div className="mb-2 flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((action) => (
              <button key={action} className="rounded-full bg-white/70 px-3 py-1 text-xs text-slate-700" onClick={() => send(action)}>
                <Wrench className="mr-1 inline h-3.5 w-3.5" />{action}
              </button>
            ))}
          </div>

          <div className="h-[calc(100%-7.5rem)] overflow-y-auto rounded-xl bg-white/45 p-3">
            {messages.length === 0 ? <p className="text-sm text-slate-600">Ask for swaps, budget edits, or day replans.</p> : null}
            {messages.map((message, idx) => (
              <div key={idx} className={`mb-2 rounded-xl px-3 py-2 text-sm ${message.role === "user" ? "ml-8 bg-primary text-white" : "mr-8 bg-white/80 text-slate-700"}`}>
                {message.content}
              </div>
            ))}
          </div>

          <div className="mt-2 flex gap-2">
            <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask Wayfare Assistant" onKeyDown={(e) => e.key === "Enter" && send()} />
            <Button onClick={() => send()} disabled={disabled}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      ) : (
        <Button className="w-full md:w-auto" onClick={() => setOpen(true)}><MessageCircle className="h-4 w-4" /> Wayfare Assistant</Button>
      )}
    </aside>
  );
}

