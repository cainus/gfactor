import { z } from 'zod';

// Content types
const TextContent = z.object({
  type: z.literal('text'),
  text: z.string()
});

const ToolResultContent = z.object({
  tool_use_id: z.string(),
  type: z.literal('tool_result'),
  content: z.string()
});

// User message schema
const UserMessage = z.object({
  role: z.literal('user'),
  content: z.array(ToolResultContent)
});

// Assistant message schema
const AssistantMessage = z.object({
  id: z.string(),
  type: z.literal('message'),
  role: z.literal('assistant'),
  model: z.string(),
  content: z.array(TextContent),
  stop_reason: z.null().optional(),
  stop_sequence: z.null().optional(),
  usage: z.object({
    input_tokens: z.number(),
    cache_creation_input_tokens: z.number(),
    cache_read_input_tokens: z.number(),
    output_tokens: z.number(),
    service_tier: z.string()
  })
});

// User type response
const UserResponse = z.object({
  type: z.literal('user'),
  message: UserMessage,
  parent_tool_use_id: z.null().optional(),
  session_id: z.string()
});

// Assistant type response
const AssistantResponse = z.object({
  type: z.literal('assistant'),
  message: AssistantMessage,
  parent_tool_use_id: z.null().optional(),
  session_id: z.string()
});

// Result type response
const ResultResponse = z.object({
  type: z.literal('result'),
  subtype: z.string(),
  is_error: z.boolean(),
  duration_ms: z.number(),
  duration_api_ms: z.number(),
  num_turns: z.number(),
  result: z.string(),
  session_id: z.string(),
  total_cost_usd: z.number(),
  usage: z.object({
    input_tokens: z.number(),
    cache_creation_input_tokens: z.number(),
    cache_read_input_tokens: z.number(),
    output_tokens: z.number(),
    server_tool_use: z.object({
      web_search_requests: z.number()
    }).optional()
  })
});

// Combined Claude response schema
export const ClaudeResponseSchema = z.discriminatedUnion('type', [
  UserResponse,
  AssistantResponse,
  ResultResponse
]);

// TypeScript type inference
export type ClaudeResponse = z.infer<typeof ClaudeResponseSchema>;
