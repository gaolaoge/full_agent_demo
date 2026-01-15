import {
  getCurrentTimeTool,
  getCurrentTimestampTool,
} from "./GetCurrentTimeTool";

import { getWeatherTool } from "./GetWeatherTool";

/**
 * 获取所有可用工具
 */
export function getTools() {
  return [getCurrentTimeTool, getCurrentTimestampTool, getWeatherTool];
}
