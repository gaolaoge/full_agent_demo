import { tool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * 获取当前时间的工具
 */
class GetCurrentTimeTool {
  /**
   * 获取当前时间（本地时间）
   * @returns 格式化的时间字符串
   */
  static getCurrentTime(): string {
    const now = new Date();
    return now.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "Asia/Shanghai",
    });
  }

  /**
   * 获取当前时间（UTC时间）
   * @returns UTC时间字符串
   */
  static getCurrentTimeUTC(): string {
    const now = new Date();
    return now.toUTCString();
  }

  /**
   * 获取当前时间戳（毫秒）
   * @returns 时间戳（毫秒）
   */
  static getCurrentTimestamp(): number {
    return Date.now();
  }

  /**
   * 获取格式化的日期时间字符串
   * @param format 格式类型：'full' | 'date' | 'time' | 'datetime'
   * @returns 格式化的时间字符串
   */
  static getFormattedTime(
    format: "full" | "date" | "time" | "datetime" = "datetime"
  ): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");

    switch (format) {
      case "full":
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      case "date":
        return `${year}-${month}-${day}`;
      case "time":
        return `${hours}:${minutes}:${seconds}`;
      case "datetime":
      default:
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }
  }

  /**
   * 获取带时区信息的时间
   * @returns 包含时区信息的时间字符串
   */
  static getCurrentTimeWithTimezone(): string {
    const now = new Date();
    const timeString = now.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "Asia/Shanghai",
    });
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return `${timeString} (${timezone})`;
  }
}

/**
 * 获取当前时间的 LangChain 工具
 */
const getCurrentTimeTool = tool(
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
const getCurrentTimestampTool = tool(
  async () => {
    return GetCurrentTimeTool.getCurrentTimestamp().toString();
  },
  {
    name: "get_current_timestamp",
    description: "获取当前的时间戳（毫秒）",
  }
);

export { getCurrentTimeTool, getCurrentTimestampTool };
