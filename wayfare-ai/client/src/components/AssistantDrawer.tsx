import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { streamChat } from "@/lib/api";
import type { Itinerary } from "@/types/itinerary";

type ChatMessage = { role: "user" | "assistant"; content: string };

const QUICK_SUGGESTIONS = [
  "Less walking",
  "Add more food",
  "More culture",
  "Relaxing options"
];

export function AssistantDrawer({ itinerary, onUpdateItinerary, openDefault }: { itinerary: Itinerary | null; onUpdateItinerary: (next: Itinerary) => void; openDefault?: boolean }) {
  const [messages, setMessages] = useLocalStorage<ChatMessage[]>("wayfare-chat-memory", []);
  const [open, setOpen] = useState(Boolean(openDefault));
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const disabled = useMemo(() => !itinerary || loading || !input.trim(), [itinerary, input, loading]);

  useEffect(() => {
    setOpen(Boolean(openDefault));
  }, [openDefault]);

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

  if (!itinerary || !open) {
    return null;
  }

  return (
    <div className="absolute right-0 top-0 bottom-0 w-80 glass-card border-l border-white/50 flex flex-col shadow-2xl z-10 backdrop-blur-md bg-white/70">
      <div className="p-4 border-b border-slate-200 flex items-center gap-2">
        <div className="bg-primary/20 text-primary p-1.5 rounded-lg">
          <span className="material-symbols-outlined text-lg">smart_toy</span>
        </div>
        <h4 className="font-bold text-sm">Travel Assistant</h4>
        <span className="size-2 rounded-full bg-green-500 animate-pulse ml-auto"></span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <>
            <div className="bg-white/60 p-3 rounded-2xl rounded-tl-none text-xs leading-relaxed border border-white">
              Hi! I've organized your {itinerary.city} trip to balance relaxation and exploration. Would you like me to adjust anything?
            </div>
            <div className="flex flex-wrap gap-2">
              {QUICK_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => send(suggestion)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold hover:border-primary transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </>
        ) : null}

        {messages.map((message, idx) => (
          <div
            key={idx}
            className={`text-xs leading-relaxed ${
              message.role === "user"
                ? "bg-primary text-white p-3 rounded-2xl rounded-tr-none ml-auto max-w-[80%]"
                : "bg-white/60 p-3 rounded-2xl rounded-tl-none mr-auto border border-white"
            }`}
          >
            {message.content}
          </div>
        ))}
      </div>

      <div className="p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {QUICK_SUGGESTIONS.slice(0, 2).map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => send(suggestion)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold hover:border-primary transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
        <div className="relative">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask AI to change plan..."
            className="w-full pl-4 pr-10 py-3 bg-white rounded-xl border-slate-200 text-xs focus:ring-primary focus:border-primary"
            onKeyDown={(e) => e.key === "Enter" && !disabled && send()}
          />
          <button
            onClick={() => send()}
            disabled={disabled}
            className="absolute right-2 top-2 p-1.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-sm">send</span>
          </button>
        </div>
      </div>
    </div>
  );
}
