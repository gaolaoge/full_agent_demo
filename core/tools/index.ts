import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { GetCurrentTimeTool } from "./GetCurrentTimeTool";

/**
 * 获取当前时间的 LangChain 工具
 */
export const getCurrentTimeTool = tool(
  async () => {
    return GetCurrentTimeTool.getCurrentTime();
  },
  {
    name: "get_current_time",
    description: "获取当前的日期和时间（中国时区，格式：YYYY-MM-DD HH:mm:ss）",
  }
);

/**
 * 获取当前时间戳的 LangChain 工具
 */
export const getCurrentTimestampTool = tool(
  async () => {
    return GetCurrentTimeTool.getCurrentTimestamp().toString();
  },
  {
    name: "get_current_timestamp",
    description: "获取当前的时间戳（毫秒）",
  }
);

/**
 * 获取所有可用工具
 */
export function getTools() {
  return [getCurrentTimeTool, getCurrentTimestampTool];
}
