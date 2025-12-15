// lib/agents/chat.ts
// Context-aware chat agent for ad-hoc questions

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { transactionTools, contextTools, executeTool } from "@/lib/tools";
import { getUserContext } from "@/lib/tools/context";

const client = new Anthropic();

export interface ChatResult {
  response: string;
  conversationId?: string;
}

export async function runChatAgent(
  userId: string,
  userMessage: string,
  conversationId?: string
): Promise<ChatResult> {
  const supabase = await createClient();

  // Load user's context
  const context = await getUserContext(userId);

  const systemPrompt = `You're helping a user understand their spending. You have deep context about their financial situation and access to their transaction data.

## Their Financial Context
${context.context_narrative || "No context narrative set yet."}

## Deliberate Trade-offs (respect these, don't question)
${JSON.stringify(context.deliberate_tradeoffs, null, 2)}

## Non-negotiables (don't suggest cutting these)
${JSON.stringify(context.non_negotiables, null, 2)}

## Watch Patterns (flag if you see these)
${JSON.stringify(context.watch_patterns, null, 2)}

## Their Spending Targets
${JSON.stringify(context.spending_targets, null, 2)}

---

## Guidelines
- Answer their questions directly with specific numbers and transactions
- Use the tools to get real data - never guess or make up numbers
- Reference specific merchants, amounts, and dates when relevant
- If they correct you about a categorization or trade-off, use update_user_context to remember it
- Never flag deliberate trade-offs as problems
- Don't suggest cutting non-negotiables
- If you see a watch pattern triggered, mention it

## Currency & Locale
- All amounts are in Australian Dollars (AUD)
- Format currency as $X,XXX.XX
- Dates in Australian format (DD/MM/YYYY)

## Tone
Direct, specific, helpful. Not preachy or guilt-inducing. You're their financial ally who knows their situation.

Today's date: ${new Date().toLocaleDateString("en-AU", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`;

  // Load or create conversation
  let convId = conversationId;
  if (!convId) {
    // Create new conversation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newConv } = await (supabase.from("conversations") as any)
      .insert({
        user_id: userId,
        agent_type: "chat",
        title: userMessage.slice(0, 50) + (userMessage.length > 50 ? "..." : ""),
      })
      .select("id")
      .single();
    convId = (newConv as { id: string } | null)?.id;
  }

  // Load conversation history
  const history = await getConversationHistory(supabase, convId);

  const messages: Anthropic.MessageParam[] = [
    ...history,
    { role: "user", content: userMessage },
  ];

  let response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: systemPrompt,
    tools: [...transactionTools, ...contextTools],
    messages,
  });

  // Agentic loop for tool use
  while (response.stop_reason === "tool_use") {
    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );

    const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolUseBlocks.map(async (toolUse) => {
        const result = await executeTool(
          userId,
          toolUse.name,
          toolUse.input as Record<string, unknown>
        );
        return {
          type: "tool_result" as const,
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        };
      })
    );

    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: toolResults });

    response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      tools: [...transactionTools, ...contextTools],
      messages,
    });
  }

  // Extract text response
  const textContent = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );

  // Save conversation messages
  if (convId) {
    await saveConversationMessages(supabase, convId, userMessage, response.content);
  }

  return {
    response: textContent?.text || "",
    conversationId: convId,
  };
}

// Helper to get conversation history
async function getConversationHistory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  conversationId?: string
): Promise<Anthropic.MessageParam[]> {
  if (!conversationId) return [];

  const { data } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (!data) return [];

  const messages = data as Array<{ role: string; content: string }>;

  // Filter to only user/assistant messages for the API
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
}

// Helper to save conversation messages
async function saveConversationMessages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  conversationId: string,
  userMessage: string,
  assistantContent: Anthropic.ContentBlock[]
): Promise<void> {
  // Save user message
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("messages") as any).insert({
    conversation_id: conversationId,
    role: "user",
    content: userMessage,
  });

  // Save assistant response
  const textContent = assistantContent.find(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );

  if (textContent) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("messages") as any).insert({
      conversation_id: conversationId,
      role: "assistant",
      content: textContent.text,
    });
  }
}
