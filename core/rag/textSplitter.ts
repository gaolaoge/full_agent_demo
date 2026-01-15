import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

/**
 * 创建文本分割器
 * @param chunkSize 每个文本块的最大字符数，默认 1000
 * @param chunkOverlap 文本块之间的重叠字符数，默认 200
 * @returns RecursiveCharacterTextSplitter 实例
 */
export function createTextSplitter(
  chunkSize: number = 1000,
  chunkOverlap: number = 200
): RecursiveCharacterTextSplitter {
  return new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap,
  });
}

/**
 * 分割文本为多个块
 * @param text 要分割的文本
 * @param chunkSize 每个文本块的最大字符数，默认 1000
 * @param chunkOverlap 文本块之间的重叠字符数，默认 200
 * @returns 文本块数组
 */
export async function splitText(
  text: string,
  chunkSize: number = 1000,
  chunkOverlap: number = 200
): Promise<string[]> {
  const splitter = createTextSplitter(chunkSize, chunkOverlap);
  return await splitter.splitText(text);
}

/**
 * 从文档创建分割后的文档块
 * @param texts 文本数组
 * @param chunkSize 每个文本块的最大字符数，默认 1000
 * @param chunkOverlap 文本块之间的重叠字符数，默认 200
 * @returns 文档块数组
 */
export async function createDocuments(
  texts: string[],
  chunkSize: number = 1000,
  chunkOverlap: number = 200
) {
  const splitter = createTextSplitter(chunkSize, chunkOverlap);
  return await splitter.createDocuments(texts);
}
