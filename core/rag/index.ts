import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseJson } from "./fileLoader";
import { splitText } from "./textSplitter";
import { embedChunks } from "./embedding";
import {
  addDocumentsToVectorStore,
  getAllDocumentsFromCollection,
} from "./vectorStore";

// 同步读取文件
const promptPath = join(process.cwd(), "static", "documents", "index.json");
const json = readFileSync(promptPath, "utf-8");

(async function () {
  // 第 1 步：加载文档
  const parsedData = await parseJson(json);

  // 将解析后的数据转换为文本（用于分割）
  const text = JSON.stringify(parsedData, null, 2);

  // 第 2 步：分割文本
  const chunks = await splitText(text, 500, 100);
  console.log(`分割后的文本块数量: ${chunks.length}`);

  // 第 3 步：嵌入向量化
  const embeddingType = process.env.EMBEDDING_TYPE;
  const ollamaModel = process.env.EMBEDDING_MODEL;
  console.log("开始向量化文本块...");

  // Chroma 配置
  const chromaHost = process.env.CHROMA_HOST;
  const chromaPort = parseInt(process.env.CHROMA_PORT as string);
  const collectionName = process.env.CHROMA_COLLECTION;

  try {
    const embeddedChunks = await embedChunks(
      chunks,
      embeddingType as "openai" | "ollama",
      {
        model: embeddingType === "ollama" ? ollamaModel : undefined,
      }
    );
    console.log(`向量化完成！共生成 ${embeddedChunks.length} 个向量`);

    // 第 4 步：创建向量存储并存入 Chroma
    console.log("\n开始将向量存入 Chroma 数据库...");
    console.log(`Chroma 连接信息: ${chromaHost}:${chromaPort}`);
    console.log(`集合名称: ${collectionName}`);

    // 准备元数据
    const metadatas = embeddedChunks.map((chunk) => ({
      index: chunk.index,
      textLength: chunk.text.length,
      embeddingDimension: chunk.embedding.length,
    }));

    // 将文档添加到向量存储
    const documentIds = await addDocumentsToVectorStore(
      chunks,
      metadatas,
      collectionName,
      embeddingType as "openai" | "ollama",
      {
        host: chromaHost,
        port: chromaPort,
        model: embeddingType === "ollama" ? ollamaModel : undefined,
      }
    );

    console.log(`\n向量存储完成！共存储 ${documentIds.length} 个文档`);
  } catch (error: any) {
    console.error("\n处理失败:", error.message);
    if (
      error.message?.includes("ECONNREFUSED") ||
      error.message?.includes("connect")
    ) {
      console.error(`\n无法连接到 Chroma 数据库 (${chromaHost}:${chromaPort})`);
      console.error("请确保 Chroma 服务正在运行:");
      console.error("docker run -p 8000:8000 chromadb/chroma");
    }
    process.exit(1);
  }
})();
