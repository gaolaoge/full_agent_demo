import { OllamaModel, ChatMessage, StreamChunk } from "./ollamaModel";
import { searchSimilarDocuments } from "../rag/vectorStore";
import { EmbeddingModelType } from "../rag/embedding";

/**
 * RAG 模型配置选项
 */
export interface RAGModelOptions {
  // 检索配置
  collectionName?: string;
  embeddingType?: EmbeddingModelType;
  k?: number; // 检索的文档数量
  chromaHost?: string;
  chromaPort?: number;
  embeddingModel?: string;
  embeddingApiKey?: string;
  embeddingBaseUrl?: string;
  // RAG 模式
  enableRAG?: boolean; // 是否启用 RAG，默认 true
  ragThreshold?: number; // RAG 触发阈值（消息长度），超过此长度才启用 RAG
}

/**
 * 构建 RAG 提示
 */
function buildRAGPrompt(
  query: string,
  retrievedDocs: Array<{ content: string; metadata: Record<string, any> }>
): string {
  if (retrievedDocs.length === 0) {
    return query; // 如果没有检索到文档，直接返回原问题
  }

  const contextSections = retrievedDocs
    .map((doc, index) => {
      return `[文档 ${index + 1}]\n${doc.content}`;
    })
    .join("\n\n");

  return `基于以下检索到的文档内容回答用户的问题。如果文档中没有相关信息，请如实说明。

检索到的文档内容：
${contextSections}

用户问题：${query}

请基于上述文档内容回答问题，并引用相关的文档编号。`;
}

/**
 * RAG 增强的模型类
 * 将向量检索与 LLM 绑定，自动进行检索增强生成
 */
export class RAGModel extends OllamaModel {
  private ragOptions: Required<
    Omit<
      RAGModelOptions,
      "embeddingApiKey" | "embeddingBaseUrl" | "embeddingModel"
    >
  > & {
    embeddingApiKey?: string;
    embeddingBaseUrl?: string;
    embeddingModel?: string;
  };

  constructor(options: RAGModelOptions = {}) {
    super();

    this.ragOptions = {
      collectionName:
        options.collectionName ||
        process.env.CHROMA_COLLECTION ||
        "rag-documents",
      embeddingType:
        options.embeddingType ||
        (process.env.EMBEDDING_TYPE as EmbeddingModelType) ||
        "ollama",
      k: options.k || 4,
      chromaHost: options.chromaHost || process.env.CHROMA_HOST || "localhost",
      chromaPort:
        options.chromaPort || parseInt(process.env.CHROMA_PORT || "8000"),
      embeddingModel: options.embeddingModel || process.env.EMBEDDING_MODEL,
      embeddingApiKey: options.embeddingApiKey,
      embeddingBaseUrl: options.embeddingBaseUrl,
      enableRAG: options.enableRAG !== false, // 默认启用
      ragThreshold: options.ragThreshold || 0, // 默认所有消息都启用 RAG
    };
  }

  /**
   * 判断是否应该使用 RAG
   */
  private shouldUseRAG(message: string): boolean {
    if (!this.ragOptions.enableRAG) {
      console.log("RAG 未启用");
      return false;
    }
    // 如果设置了阈值，只有消息长度超过阈值才使用 RAG
    if (this.ragOptions.ragThreshold > 0) {
      console.log(
        `RAG ${
          message.length >= this.ragOptions.ragThreshold ? "启用" : "未启用"
        }`
      );
      return message.length >= this.ragOptions.ragThreshold;
    }
    console.log("RAG 启用");
    return true;
  }

  /**
   * 执行检索并增强消息
   */
  private async enhanceMessageWithRAG(message: string): Promise<string> {
    try {
      console.log("开始 RAG 检索...", {
        query: message.substring(0, 50) + "...",
        collectionName: this.ragOptions.collectionName,
        k: this.ragOptions.k,
        host: this.ragOptions.chromaHost,
        port: this.ragOptions.chromaPort,
      });

      // 检索相关文档
      const retrievedDocs = await searchSimilarDocuments(
        message,
        this.ragOptions.k,
        this.ragOptions.collectionName,
        this.ragOptions.embeddingType,
        {
          host: this.ragOptions.chromaHost,
          port: this.ragOptions.chromaPort,
          apiKey: this.ragOptions.embeddingApiKey,
          model: this.ragOptions.embeddingModel,
          baseUrl: this.ragOptions.embeddingBaseUrl,
        }
      );

      console.log("检索完成，找到文档数:", retrievedDocs?.length || 0);

      // 验证检索结果
      if (!Array.isArray(retrievedDocs)) {
        console.warn("检索结果不是数组:", typeof retrievedDocs);
        return message;
      }

      // 转换为检索结果格式
      const retrievedDocuments = retrievedDocs
        .filter((doc) => doc && doc.pageContent) // 过滤无效文档
        .map((doc) => ({
          content: doc.pageContent,
          metadata: doc.metadata || {},
        }));

      console.log("有效文档数:", retrievedDocuments.length);

      // 构建 RAG 提示
      return buildRAGPrompt(message, retrievedDocuments);
    } catch (error: any) {
      console.error("RAG 检索失败:", {
        message: error.message,
        stack: error.stack,
        errorType: error.constructor.name,
      });
      console.warn("使用原始消息，不进行 RAG 增强");
      return message; // 如果检索失败，返回原始消息
    }
  }

  /**
   * 流式聊天（RAG 增强版本）
   */
  async streamChat(
    messages: ChatMessage[],
    onChunk: (chunk: StreamChunk) => void
  ): Promise<void> {
    // 获取最后一条用户消息
    const lastMessage = messages[messages.length - 1];

    if (
      lastMessage &&
      lastMessage.role === "user" &&
      this.shouldUseRAG(lastMessage.content)
    ) {
      // 使用 RAG 增强最后一条消息
      const enhancedContent = await this.enhanceMessageWithRAG(
        lastMessage.content
      );

      // 创建增强后的消息列表
      const enhancedMessages: ChatMessage[] = [
        ...messages.slice(0, -1),
        { role: "user", content: enhancedContent },
      ];

      // 调用父类的 streamChat
      return super.streamChat(enhancedMessages, onChunk);
    } else {
      // 不使用 RAG，直接调用父类方法
      return super.streamChat(messages, onChunk);
    }
  }

  /**
   * 创建流式响应（RAG 增强版本）
   */
  async createStreamingResponse(
    messages: ChatMessage[]
  ): Promise<ReadableStream<Uint8Array>> {
    // 获取最后一条用户消息
    const lastMessage = messages[messages.length - 1];

    if (
      lastMessage &&
      lastMessage.role === "user" &&
      this.shouldUseRAG(lastMessage.content)
    ) {
      // 使用 RAG 增强最后一条消息
      const enhancedContent = await this.enhanceMessageWithRAG(
        lastMessage.content
      );

      // 创建增强后的消息列表
      const enhancedMessages: ChatMessage[] = [
        ...messages.slice(0, -1),
        { role: "user", content: enhancedContent },
      ];

      // 调用父类的 createStreamingResponse
      return super.createStreamingResponse(enhancedMessages);
    } else {
      // 不使用 RAG，直接调用父类方法
      return super.createStreamingResponse(messages);
    }
  }

  /**
   * 更新 RAG 配置
   */
  updateRAGOptions(options: Partial<RAGModelOptions>): void {
    if (options.collectionName !== undefined) {
      this.ragOptions.collectionName = options.collectionName;
    }
    if (options.k !== undefined) {
      this.ragOptions.k = options.k;
    }
    if (options.enableRAG !== undefined) {
      this.ragOptions.enableRAG = options.enableRAG;
    }
    if (options.ragThreshold !== undefined) {
      this.ragOptions.ragThreshold = options.ragThreshold;
    }
    if (options.chromaHost !== undefined) {
      this.ragOptions.chromaHost = options.chromaHost;
    }
    if (options.chromaPort !== undefined) {
      this.ragOptions.chromaPort = options.chromaPort;
    }
    if (options.embeddingType !== undefined) {
      this.ragOptions.embeddingType = options.embeddingType;
    }
    if (options.embeddingModel !== undefined) {
      this.ragOptions.embeddingModel = options.embeddingModel;
    }
  }
}
