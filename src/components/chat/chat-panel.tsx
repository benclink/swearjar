"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  MessageSquare,
  X,
  Send,
  Loader2,
  User,
  Bot,
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
  const [currentRoute, setCurrentRoute] = useState<string | null>(null);
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

        // Set welcome message based on status
        if (data.needsOnboarding) {
          setMessages([
            {
              id: "welcome",
              role: "assistant",
              content:
                "Welcome! I'm your personal finance assistant. Before I can give you tailored insights, I'd like to learn about your financial situation.\n\nThis will help me understand your priorities, deliberate trade-offs, and what to watch vs. what to ignore.\n\nReady to get started? Just say hi!",
            },
          ]);
        } else {
          setMessages([
            {
              id: "welcome",
              role: "assistant",
              content:
                "Hi! I'm your finance assistant. I can help you:\n\n- Check your spending\n- Generate insights\n- Manage budgets\n- Answer questions about your finances\n\nWhat would you like to know?",
            },
          ]);
        }
      }
    } catch (err) {
      console.error("Failed to check onboarding status:", err);
      // Fallback to regular chat
      setNeedsOnboarding(false);
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: "Hi! I'm your finance assistant. How can I help you today?",
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

      // Update conversation ID if provided
      if (data.conversationId) {
        setConversationId(data.conversationId);
      }

      // Track current route for UI hints
      setCurrentRoute(data.route);

      // Check if onboarding was completed
      if (data.contextUpdated) {
        setNeedsOnboarding(false);
      }

      // Add assistant response
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
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg"
        size="icon"
      >
        <MessageSquare className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <div
      className={cn(
        "fixed bottom-0 right-0 z-50 flex flex-col border-l bg-background shadow-xl transition-all duration-300",
        isExpanded
          ? "h-screen w-[600px]"
          : "h-[600px] w-[400px] m-4 rounded-lg border"
      )}
    >
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <span className="font-semibold">
            {needsOnboarding ? "Financial Setup" : "Finance Assistant"}
          </span>
          {currentRoute === "onboarding" && (
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              Setting up
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!needsOnboarding && (
            <Button
              variant="ghost"
              size="icon"
              onClick={getInsight}
              disabled={isLoading}
              className="h-8 w-8"
              title="Get spending insight"
            >
              <Sparkles className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 w-8"
          >
            {isExpanded ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3",
                message.role === "user" ? "flex-row-reverse" : ""
              )}
            >
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback
                  className={cn(
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  {message.role === "user" ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </AvatarFallback>
              </Avatar>
              <div
                className={cn(
                  "rounded-lg px-3 py-2 text-sm max-w-[80%]",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                <div className="whitespace-pre-wrap">{message.content}</div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-muted">
                  <Bot className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="rounded-lg bg-muted px-3 py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              Error: {error}
            </div>
          )}
        </div>
      </ScrollArea>

      <Separator />

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              needsOnboarding
                ? "Tell me about your finances..."
                : "Ask about your finances..."
            }
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            type="submit"
            size="icon"
            disabled={isLoading || !input.trim()}
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
