import { useMemo, useState } from "react";
import { MessageCircle, Send, RotateCcw, RefreshCw, DollarSign, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { streamChat } from "@/lib/api";
import type { Itinerary } from "@/types/itinerary";

type ChatMessage = { role: "user" | "assistant"; content: string };

const QUICK_ACTIONS = [
  { label: "Replan Day 1", icon: RotateCcw, command: "replan_day(1)" },
  { label: "Swap Stop", icon: RefreshCw, command: "swap_stop(stop_1)" },
  { label: "Find Cafes", icon: MessageCircle, command: "suggest_nearby(cafes,2000)" },
  { label: "Adjust Budget", icon: DollarSign, command: "adjust_budget(300)" },
  { label: "Relaxed Pace", icon: Gauge, command: "change_pace(Relaxed)" }
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
    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: messageText },
      { role: "assistant", content: "" }
    ];
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
            <TooltipProvider>
              {QUICK_ACTIONS.map((action) => (
                <Tooltip key={action.command}>
                  <TooltipTrigger asChild>
                    <button
                      className="flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 text-xs font-medium text-slate-700 transition-all hover:bg-white/90 hover:shadow-md"
                      onClick={() => send(action.command)}
                    >
                      <action.icon className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{action.label}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={8}>
                    {action.command}
                  </TooltipContent>
                </Tooltip>
              ))}
            </TooltipProvider>
          </div>

          <div className="h-[calc(100%-7.5rem)] overflow-y-auto rounded-xl bg-white/45 p-3">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                <MessageCircle className="h-10 w-10 text-slate-400" />
                <p className="text-sm text-slate-600">Ask for swaps, budget edits, or day replans.</p>
              </div>
            ) : null}
            {messages.map((message, idx) => (
              <div
                key={idx}
                className={`mb-3 rounded-2xl px-4 py-3 text-sm ${
                  message.role === "user"
                    ? "ml-auto bg-primary text-white shadow-md max-w-[85%]"
                    : "mr-auto bg-white/90 text-slate-700 shadow-sm max-w-[90%]"
                }`}
              >
                {message.content}
              </div>
            ))}
          </div>

          <div className="mt-2 flex gap-2">
            <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask Wayfare Assistant..." onKeyDown={(e) => e.key === "Enter" && !disabled && send()} />
            <Button onClick={() => send()} disabled={disabled}>
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </Card>
      ) : (
        <Button className="w-full md:w-auto" onClick={() => setOpen(true)}><MessageCircle className="h-4 w-4" /> Wayfare Assistant</Button>
      )}
    </aside>
  );
}

