"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageSquare,
  X,
  Send,
  Loader2,
  Minimize2,
  Maximize2,
  Sparkles,
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function ChatPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Check onboarding status when chat opens
  useEffect(() => {
    if (isOpen && needsOnboarding === null) {
      checkOnboardingStatus();
    }
  }, [isOpen, needsOnboarding]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const checkOnboardingStatus = async () => {
    try {
      const response = await fetch("/api/orchestrate");
      if (response.ok) {
        const data = await response.json();
        setNeedsOnboarding(data.needsOnboarding);

        if (data.needsOnboarding) {
          setMessages([
            {
              id: "welcome",
              role: "assistant",
              content:
                "Welcome. I'll help you track your finances.\n\nFirst, tell me about your financial situation so I can give you relevant insights.",
            },
          ]);
        } else {
          setMessages([
            {
              id: "welcome",
              role: "assistant",
              content:
                "How can I help with your finances today?",
            },
          ]);
        }
      }
    } catch (err) {
      console.error("Failed to check onboarding status:", err);
      setNeedsOnboarding(false);
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: "How can I help?",
        },
      ]);
    }
  };

  const sendMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: messageText,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageText,
          conversationId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const data = await response.json();

      if (data.conversationId) {
        setConversationId(data.conversationId);
      }

      if (data.contextUpdated) {
        setNeedsOnboarding(false);
      }

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.response,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const getInsight = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/insight");
      if (!response.ok) throw new Error("Failed to get insight");

      const data = await response.json();

      const insightMessage: Message = {
        id: `insight-${Date.now()}`,
        role: "assistant",
        content: data.insight,
      };

      setMessages((prev) => [...prev, insightMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get insight");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-12 w-12 rounded-full bg-foreground text-background flex items-center justify-center hover:bg-foreground/90 transition-colors"
      >
        <MessageSquare className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div
      className={cn(
        "fixed bottom-0 right-0 z-50 flex flex-col bg-background border-l transition-all duration-200",
        isExpanded
          ? "h-screen w-[480px]"
          : "h-[500px] w-[360px] m-4 rounded-md border"
      )}
    >
      {/* Header */}
      <div className="flex h-12 items-center justify-between border-b px-4">
        <span className="text-sm font-medium">
          {needsOnboarding ? "Setup" : "Assistant"}
        </span>
        <div className="flex items-center gap-1">
          {!needsOnboarding && (
            <button
              onClick={getInsight}
              disabled={isLoading}
              className="h-8 w-8 flex items-center justify-center rounded hover:bg-muted disabled:opacity-50 transition-colors"
              title="Get insight"
            >
              <Sparkles className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 w-8 flex items-center justify-center rounded hover:bg-muted transition-colors"
          >
            {isExpanded ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="h-8 w-8 flex items-center justify-center rounded hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "rounded-md px-3 py-2 text-sm max-w-[85%]",
                  message.role === "user"
                    ? "bg-foreground text-background"
                    : "bg-muted"
                )}
              >
                <div className="whitespace-pre-wrap">{message.content}</div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="rounded-md bg-muted px-3 py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your finances..."
            disabled={isLoading}
            className="flex-1 h-9"
          />
          <Button
            type="submit"
            size="icon"
            disabled={isLoading || !input.trim()}
            className="h-9 w-9"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
