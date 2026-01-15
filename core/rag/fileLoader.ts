import { JsonOutputParser } from "@langchain/core/output_parsers";

// 创建解析器
const parser = new JsonOutputParser();

async function parseJson(json: string): Promise<any> {
  // 解析 JSON
  const parsedData = await parser.parse(json);
  return parsedData;
}

export { parseJson };
