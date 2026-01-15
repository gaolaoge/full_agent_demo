// 此文件只能在服务器端使用
if (typeof window !== "undefined") {
  throw new Error("vectorStore.ts can only be used on the server side");
}

import { Chroma } from "@langchain/community/vectorstores/chroma";
import { Document } from "@langchain/core/documents";
import { createEmbeddings, EmbeddingModelType } from "./embedding";
import { ChromaClient } from "chromadb";

/**
 * 创建 Chroma 向量存储实例
 * @param collectionName 集合名称
 * @param embeddingType 嵌入模型类型
 * @param options 配置选项
 * @returns Chroma 向量存储实例
 */
export async function createVectorStore(
  collectionName: string = "rag-documents",
  embeddingType: EmbeddingModelType = "openai",
  options?: {
    host?: string;
    port?: number;
    apiKey?: string;
    model?: string;
    baseUrl?: string;
  }
): Promise<Chroma> {
  const embeddings = createEmbeddings(embeddingType, {
    apiKey: options?.apiKey,
    model: options?.model,
    baseUrl: options?.baseUrl,
  });

  const host = options?.host || process.env.CHROMA_HOST || "localhost";
  const port = options?.port || parseInt(process.env.CHROMA_PORT || "8000");
  const url = `http://${host}:${port}`;

  try {
    return new Chroma(embeddings, {
      collectionName,
      url, // 使用完整的 URL
    });
  } catch (error: any) {
    // 如果使用 url 失败，尝试使用 clientParams
    console.warn("使用 URL 配置失败，尝试使用 clientParams:", error.message);
    return new Chroma(embeddings, {
      collectionName,
      clientParams: {
        host,
        port,
      },
    });
  }
}

/**
 * 将文档添加到向量存储
 * @param texts 文本数组
 * @param metadatas 元数据数组（可选）
 * @param collectionName 集合名称
 * @param embeddingType 嵌入模型类型
 * @param options 配置选项
 * @returns 文档 ID 数组
 */
export async function addDocumentsToVectorStore(
  texts: string[],
  metadatas?: Record<string, any>[],
  collectionName: string = "rag-documents",
  embeddingType: EmbeddingModelType = "openai",
  options?: {
    host?: string;
    port?: number;
    apiKey?: string;
    model?: string;
    baseUrl?: string;
  }
): Promise<string[]> {
  const vectorStore = await createVectorStore(
    collectionName,
    embeddingType,
    options
  );

  // 创建文档对象
  const documents: Document[] = texts.map((text, index) => ({
    pageContent: text,
    metadata: metadatas?.[index] || { index, timestamp: Date.now() },
  }));

  // 生成文档 ID
  const ids = texts.map((_, index) => `doc-${Date.now()}-${index}`);

  // 添加文档到向量存储
  await vectorStore.addDocuments(documents, { ids });

  return ids;
}

/**
 * 从向量存储中检索相似文档
 * @param query 查询文本
 * @param k 返回的文档数量
 * @param collectionName 集合名称
 * @param embeddingType 嵌入模型类型
 * @param options 配置选项
 * @returns 检索到的文档数组
 */
export async function searchSimilarDocuments(
  query: string,
  k: number = 4,
  collectionName: string = "rag-documents",
  embeddingType: EmbeddingModelType = "openai",
  options?: {
    host?: string;
    port?: number;
    apiKey?: string;
    model?: string;
    baseUrl?: string;
  }
): Promise<Document[]> {
  try {
    // 先获取嵌入向量
    const { embedQuery } = await import("./embedding");
    const queryEmbedding = await embedQuery(query, embeddingType, {
      apiKey: options?.apiKey,
      model: options?.model,
      baseUrl: options?.baseUrl,
    });

    // 使用 ChromaClient 直接查询
    const host = options?.host || process.env.CHROMA_HOST || "localhost";
    const port = options?.port || parseInt(process.env.CHROMA_PORT || "8000");
    const client = new ChromaClient({
      host,
      port,
    });

    const collection = await client.getCollection({
      name: collectionName,
    });

    // 使用 query 方法进行相似度搜索
    const results = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: k,
      include: ["documents", "metadatas", "distances"],
    });

    // 转换为 Document 格式
    const documents: Document[] = [];
    if (results.ids && results.ids[0]) {
      const ids = results.ids[0];
      const docs = results.documents?.[0] || [];
      const metadatas = results.metadatas?.[0] || [];

      for (let i = 0; i < ids.length; i++) {
        documents.push({
          pageContent: docs[i] || "",
          metadata: metadatas[i] || {},
        });
      }
    }

    return documents;
  } catch (error: any) {
    console.error("检索相似文档失败:", error);
    console.error("错误详情:", {
      message: error.message,
      stack: error.stack,
      query: query.substring(0, 50),
      k,
      collectionName,
    });
    throw error;
  }
}

/**
 * 删除向量存储中的文档
 * @param ids 要删除的文档 ID 数组
 * @param collectionName 集合名称
 * @param embeddingType 嵌入模型类型
 * @param options 配置选项
 */
export async function deleteDocumentsFromVectorStore(
  ids: string[],
  collectionName: string = "rag-documents",
  embeddingType: EmbeddingModelType = "openai",
  options?: {
    host?: string;
    port?: number;
    apiKey?: string;
    model?: string;
    baseUrl?: string;
  }
): Promise<void> {
  const vectorStore = await createVectorStore(
    collectionName,
    embeddingType,
    options
  );

  await vectorStore.delete({ ids });
}

/**
 * 查看指定集合的完整数据
 * @param collectionName 集合名称
 * @param options 配置选项
 * @returns 包含所有文档信息的对象
 */
export async function getAllDocumentsFromCollection(
  collectionName: string = "rag-documents",
  options?: {
    host?: string;
    port?: number;
  }
): Promise<{
  ids: string[];
  documents: string[];
  metadatas: Record<string, any>[];
  embeddings?: number[][];
  count: number;
}> {
  const host = options?.host || process.env.CHROMA_HOST || "localhost";
  const port = options?.port || parseInt(process.env.CHROMA_PORT || "8000");

  // 创建 Chroma 客户端
  const client = new ChromaClient({
    host,
    port,
  });

  // 获取集合
  const collection = await client.getCollection({
    name: collectionName,
  });

  // 获取所有数据
  const result = await collection.get({
    include: ["documents", "metadatas", "embeddings"],
  });

  return {
    ids: result.ids || [],
    documents: (result.documents as string[]) || [],
    metadatas: (result.metadatas as Record<string, any>[]) || [],
    embeddings: result.embeddings || undefined,
    count: result.ids?.length || 0,
  };
}
