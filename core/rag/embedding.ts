import { OpenAIEmbeddings } from "@langchain/openai";
import { OllamaEmbeddings } from "@langchain/ollama";

/**
 * 嵌入模型类型
 */
export type EmbeddingModelType = "openai" | "ollama";

/**
 * 创建嵌入模型实例
 * @param type 嵌入模型类型：'openai' 或 'ollama'
 * @param options 配置选项
 * @returns 嵌入模型实例
 */
export function createEmbeddings(
  type: EmbeddingModelType = "openai",
  options?: {
    apiKey?: string;
    model?: string;
    baseUrl?: string;
  }
) {
  if (type === "ollama") {
    // 使用更常见的嵌入模型，如果 nomic-embed-text 不可用，可以尝试 all-minilm
    const defaultModel =
      options?.model ||
      process.env.OLLAMA_EMBEDDING_MODEL ||
      "nomic-embed-text";
    return new OllamaEmbeddings({
      model: defaultModel,
      baseUrl:
        options?.baseUrl ||
        process.env.OLLAMA_BASE_URL ||
        "http://localhost:11434",
    });
  } else {
    return new OpenAIEmbeddings({
      model: options?.model || "text-embedding-3-small",
      openAIApiKey: options?.apiKey || process.env.OPENAI_API_KEY,
    });
  }
}

/**
 * 将单个文本转换为向量
 * @param text 要转换的文本
 * @param type 嵌入模型类型
 * @param options 配置选项
 * @returns 向量数组
 */
export async function embedQuery(
  text: string,
  type: EmbeddingModelType = "openai",
  options?: {
    apiKey?: string;
    model?: string;
    baseUrl?: string;
  }
): Promise<number[]> {
  const embeddings = createEmbeddings(type, options);
  return await embeddings.embedQuery(text);
}

/**
 * 将多个文本块转换为向量
 * @param texts 文本块数组
 * @param type 嵌入模型类型
 * @param options 配置选项
 * @returns 向量数组的数组
 */
export async function embedDocuments(
  texts: string[],
  type: EmbeddingModelType = "openai",
  options?: {
    apiKey?: string;
    model?: string;
    baseUrl?: string;
  }
): Promise<number[][]> {
  try {
    const embeddings = createEmbeddings(type, options);
    return await embeddings.embedDocuments(texts);
  } catch (error: any) {
    if (type === "ollama" && error?.message?.includes("not found")) {
      const modelName =
        options?.model ||
        process.env.OLLAMA_EMBEDDING_MODEL ||
        "nomic-embed-text";
      throw new Error(
        `Ollama 嵌入模型 "${modelName}" 未找到。请先运行: ollama pull ${modelName}\n` +
          `或者使用其他模型，如: ollama pull all-minilm`
      );
    }
    throw error;
  }
}

/**
 * 将文本块数组转换为向量，并返回带元数据的文档向量
 * @param chunks 文本块数组
 * @param type 嵌入模型类型，默认为 'openai'
 * @param options 配置选项
 * @returns 包含向量和元数据的对象数组
 */
export async function embedChunks(
  chunks: string[],
  type: EmbeddingModelType = "openai",
  options?: {
    apiKey?: string;
    model?: string;
    baseUrl?: string;
  }
): Promise<Array<{ text: string; embedding: number[]; index: number }>> {
  const embeddings = await embedDocuments(chunks, type, options);
  return chunks.map((text, index) => ({
    text,
    embedding: embeddings[index],
    index,
  }));
}
