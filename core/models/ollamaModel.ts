import { ChatOllama } from "@langchain/ollama";
import {
  HumanMessage,
  AIMessage,
  BaseMessage,
  ToolMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { getTools } from "../tools";
import { readFileSync } from "fs";
import { join } from "path";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface StreamChunk {
  type: "content" | "thinking" | "error";
  content?: string;
  error?: string;
}

export class OllamaModel {
  private model: ReturnType<ChatOllama["bindTools"]>;
  private baseModel: ChatOllama;
  private tools: ReturnType<typeof getTools>;
  private toolMap: Map<string, any>;
  private systemPrompt: string;

  constructor() {
    // Ollama 是本地运行的，不需要 API key
    // 保留参数以保持向后兼容性

    // Load system prompt from markdown file
    try {
      const promptPath = join(process.cwd(), "static", "SYSTEM_PROMPT.md");
      this.systemPrompt = readFileSync(promptPath, "utf-8");
      // Remove markdown headers and keep only the content
      this.systemPrompt = this.systemPrompt.replace(/^#+\s+.*$/gm, "").trim();
    } catch (error) {
      console.warn("Failed to load SYSTEM_PROMPT.md, using default prompt");
      this.systemPrompt = "You are a helpful AI assistant.";
    }

    this.tools = getTools();
    this.toolMap = new Map();
    this.tools.forEach((tool) => {
      this.toolMap.set(tool.name, tool);
    });

    this.baseModel = new ChatOllama({
      model: process.env.OLLAMA_MODEL,
      temperature: 0.7,
      baseUrl: process.env.OLLAMA_BASE_URL,
    });

    this.model = this.baseModel.bindTools(this.tools);
  }

  /**
   * Convert chat messages to LangChain format
   */
  private convertToLangChainMessages(messages: ChatMessage[]): BaseMessage[] {
    const langchainMessages: BaseMessage[] = [
      new SystemMessage(this.systemPrompt),
    ];

    messages.forEach((msg) => {
      if (msg.role === "user") {
        langchainMessages.push(new HumanMessage(msg.content));
      } else if (msg.role === "assistant") {
        langchainMessages.push(new AIMessage(msg.content));
      }
    });

    return langchainMessages;
  }

  /**
   * Stream chat completion with callback
   */
  async streamChat(
    messages: ChatMessage[],
    onChunk: (chunk: StreamChunk) => void
  ): Promise<void> {
    const langchainMessages = this.convertToLangChainMessages(messages);
    try {
      const stream = await this.model.stream(langchainMessages);

      for await (const chunk of stream) {
        const content = chunk.content;
        if (typeof content === "string" && content) {
          // Check if chunk has additional fields (like thinking/reasoning)
          const chunkAny = chunk as any;

          // Emit content
          onChunk({ type: "content", content });

          // Check for thinking/reasoning content in the chunk
          if (chunkAny.reasoning_content || chunkAny.thinking) {
            const thinkingContent =
              chunkAny.reasoning_content || chunkAny.thinking;
            if (thinkingContent) {
              onChunk({ type: "thinking", content: thinkingContent });
            }
          }
        }
      }
    } catch (error) {
      console.error("Stream error:", error);
      onChunk({
        type: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Execute tool calls
   */
  private async executeToolCalls(toolCalls: any[]): Promise<ToolMessage[]> {
    const toolMessages: ToolMessage[] = [];

    for (const toolCall of toolCalls) {
      const tool = this.toolMap.get(toolCall.name);
      if (tool) {
        try {
          const result = await tool.invoke(toolCall.args || {});
          toolMessages.push(
            new ToolMessage({
              content: String(result),
              tool_call_id: toolCall.id,
            })
          );
        } catch (error) {
          toolMessages.push(
            new ToolMessage({
              content: `Error: ${
                error instanceof Error ? error.message : String(error)
              }`,
              tool_call_id: toolCall.id,
            })
          );
        }
      }
    }

    return toolMessages;
  }

  /**
   * Create a streaming response for HTTP
   */
  async createStreamingResponse(
    messages: ChatMessage[]
  ): Promise<ReadableStream<Uint8Array>> {
    const encoder = new TextEncoder();
    const model = this.model;
    const toolMap = this.toolMap;
    let langchainMessages = this.convertToLangChainMessages(messages);

    // Helper function to execute tool calls
    const executeToolCalls = async (
      toolCalls: any[]
    ): Promise<ToolMessage[]> => {
      const toolMessages: ToolMessage[] = [];

      for (const toolCall of toolCalls) {
        const tool = toolMap.get(toolCall.name);
        if (tool) {
          try {
            const result = await tool.invoke(toolCall.args || {});
            toolMessages.push(
              new ToolMessage({
                content: String(result),
                tool_call_id: toolCall.id,
              })
            );
          } catch (error) {
            toolMessages.push(
              new ToolMessage({
                content: `Error: ${
                  error instanceof Error ? error.message : String(error)
                }`,
                tool_call_id: toolCall.id,
              })
            );
          }
        }
      }

      return toolMessages;
    };

    return new ReadableStream({
      async start(controller) {
        try {
          // First, invoke the model to check for tool calls
          const response = await model.invoke(langchainMessages);
          const responseAny = response as any;

          // Check if the response has tool calls
          if (responseAny.tool_calls && responseAny.tool_calls.length > 0) {
            // Execute tools
            const toolMessages = await executeToolCalls(responseAny.tool_calls);

            // Add AI message and tool messages to history
            langchainMessages = [
              ...langchainMessages,
              response,
              ...toolMessages,
            ];

            // Stream the final response with tool results
            const finalStream = await model.stream(langchainMessages);
            for await (const chunk of finalStream) {
              const content = chunk.content;
              if (typeof content === "string" && content) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: "content", content })}\n\n`
                  )
                );
              }
            }
          } else {
            // No tool calls, stream the response directly
            const stream = await model.stream(langchainMessages);
            for await (const chunk of stream) {
              const content = chunk.content;
              if (typeof content === "string" && content) {
                const chunkAny = chunk as any;

                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: "content", content })}\n\n`
                  )
                );

                if (chunkAny.reasoning_content || chunkAny.thinking) {
                  const thinkingContent =
                    chunkAny.reasoning_content || chunkAny.thinking;
                  if (thinkingContent) {
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({
                          type: "thinking",
                          content: thinkingContent,
                        })}\n\n`
                      )
                    );
                  }
                }
              }
            }
          }

          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        } catch (error) {
          console.error("Stream error:", error);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "error",
                error: String(error),
              })}\n\n`
            )
          );
          controller.close();
        }
      },
    });
  }
}
