import { JsonOutputParser } from "@langchain/core/output_parsers";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// 定义预期的 JSON 结构
interface Joke {
  setup: string;
  punchline: string;
}

// 同步读取文件
const promptPath = join(process.cwd(), "static", "documents", "index.json");
const json = readFileSync(promptPath, "utf-8");
console.log("json: ", json);

// 创建解析器
const parser = new JsonOutputParser();

(async function () {
  // 解析 JSON
  const parsedData = await parser.parse(json);
  console.log("parsedData: ", parsedData);
})();
