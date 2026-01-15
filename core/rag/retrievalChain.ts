import { searchSimilarDocuments } from "./vectorStore";
import { EmbeddingModelType } from "./embedding";
import { OllamaModel } from "../models/ollamaModel";

/**
 * 检索链配置选项
 */
export interface RetrievalChainOptions {
  collectionName?: string;
  embeddingType?: EmbeddingModelType;
  k?: number; // 检索的文档数量
  chromaHost?: string;
  chromaPort?: number;
  embeddingModel?: string;
  embeddingApiKey?: string;
  embeddingBaseUrl?: string;
}

/**
 * 检索结果
 */
export interface RetrievalResult {
  query: string;
  retrievedDocuments: Array<{
    content: string;
    metadata: Record<string, any>;
  }>;
  answer: string;
}

/**
 * 构建检索链提示
 * @param query 用户问题
 * @param retrievedDocs 检索到的文档
 * @returns 组合后的提示
 */
function buildPrompt(query: string, retrievedDocs: Array<{ content: string; metadata: Record<string, any> }>): string {
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
 * 执行检索链
 * @param query 用户问题
 * @param options 配置选项
 * @returns 检索结果和答案
 */
export async function executeRetrievalChain(
  query: string,
  options: RetrievalChainOptions = {}
): Promise<RetrievalResult> {
  const {
    collectionName = process.env.CHROMA_COLLECTION || "rag-documents",
    embeddingType = (process.env.EMBEDDING_TYPE as EmbeddingModelType) || "ollama",
    k = 4,
    chromaHost = process.env.CHROMA_HOST || "localhost",
    chromaPort = parseInt(process.env.CHROMA_PORT || "8000"),
    embeddingModel = process.env.EMBEDDING_MODEL,
    embeddingApiKey,
    embeddingBaseUrl,
  } = options;

  // 第 1 步：将用户问题向量化并在向量库中检索最相关的文本块
  const retrievedDocs = await searchSimilarDocuments(
    query,
    k,
    collectionName,
    embeddingType,
    {
      host: chromaHost,
      port: chromaPort,
      apiKey: embeddingApiKey,
      model: embeddingModel,
      baseUrl: embeddingBaseUrl,
    }
  );

  // 转换为检索结果格式
  const retrievedDocuments = retrievedDocs.map((doc) => ({
    content: doc.pageContent,
    metadata: doc.metadata || {},
  }));

  // 第 2 步：将检索到的文本块与问题组合成提示
  const prompt = buildPrompt(query, retrievedDocuments);

  // 第 3 步：调用 LLM 生成最终答案
  const model = new OllamaModel();
  let answer = "";

  await new Promise<void>((resolve, reject) => {
    model.streamChat(
      [{ role: "user", content: prompt }],
      (chunk) => {
        if (chunk.type === "content") {
          answer += chunk.content || "";
        } else if (chunk.type === "error") {
          reject(new Error(chunk.error));
        }
      }
    )
      .then(() => resolve())
      .catch(reject);
  });

  return {
    query,
    retrievedDocuments,
    answer,
  };
}

/**
 * 执行检索链（流式响应版本）
 * @param query 用户问题
 * @param onChunk 流式数据回调
 * @param options 配置选项
 */
export async function executeRetrievalChainStream(
  query: string,
  onChunk: (chunk: { type: "retrieval" | "content" | "error"; content?: string; error?: string; documents?: Array<{ content: string; metadata: Record<string, any> }> }) => void,
  options: RetrievalChainOptions = {}
): Promise<void> {
  const {
    collectionName = process.env.CHROMA_COLLECTION || "rag-documents",
    embeddingType = (process.env.EMBEDDING_TYPE as EmbeddingModelType) || "ollama",
    k = 4,
    chromaHost = process.env.CHROMA_HOST || "localhost",
    chromaPort = parseInt(process.env.CHROMA_PORT || "8000"),
    embeddingModel = process.env.EMBEDDING_MODEL,
    embeddingApiKey,
    embeddingBaseUrl,
  } = options;

  try {
    // 第 1 步：将用户问题向量化并在向量库中检索最相关的文本块
    onChunk({ type: "retrieval", content: "正在检索相关文档..." });
    
    const retrievedDocs = await searchSimilarDocuments(
      query,
      k,
      collectionName,
      embeddingType,
      {
        host: chromaHost,
        port: chromaPort,
        apiKey: embeddingApiKey,
        model: embeddingModel,
        baseUrl: embeddingBaseUrl,
      }
    );

    // 转换为检索结果格式
    const retrievedDocuments = retrievedDocs.map((doc) => ({
      content: doc.pageContent,
      metadata: doc.metadata || {},
    }));

    onChunk({
      type: "retrieval",
      content: `检索到 ${retrievedDocuments.length} 个相关文档`,
      documents: retrievedDocuments,
    });

    // 第 2 步：将检索到的文本块与问题组合成提示
    const prompt = buildPrompt(query, retrievedDocuments);

    // 第 3 步：调用 LLM 生成最终答案（流式）
    const model = new OllamaModel();
    
    await model.streamChat(
      [{ role: "user", content: prompt }],
      (chunk) => {
        if (chunk.type === "content") {
          onChunk({ type: "content", content: chunk.content });
        } else if (chunk.type === "error") {
          onChunk({ type: "error", error: chunk.error });
        }
      }
    );
  } catch (error: any) {
    onChunk({
      type: "error",
      error: error.message || "检索链执行失败",
    });
  }
}
