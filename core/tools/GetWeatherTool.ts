import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { UapiClient } from "uapi-sdk-typescript";

// 天气信息 Schema
const weatherSchema = z.object({
  location: z.string(),
  timezone: z.string(),
  temperature: z.string(),
  weather: z.string(),
  code: z.string(),
  humidity: z.string(),
  wind_direction: z.string(),
  wind_speed: z.string(),
  updated_at: z.string(),
});

// 工具参数 Schema
const weatherToolSchema = z.object({
  location: z.string().describe("要查询天气的城市名称"),
});

const getWeatherTool = tool(
  async ({ location }) => {
    try {
      const client = new UapiClient("https://uapis.cn");

      const payload = {
        city: location,
        adcode: undefined,
        extended: false,
        indices: false,
        forecast: false,
      };

      const response = await (client as any).misc.getMiscWeather(payload);

      // 检查响应状态
      if (!response) {
        throw new Error(`天气服务异常：${response}`);
      }

      // 根据注释中的响应格式处理数据
      const weatherData = response;

      // 验证必需的字段是否存在
      if (!weatherData.city || !weatherData.weather) {
        throw new Error("响应数据格式不符合预期");
      }

      // 构建符合 weatherSchema 的结果对象
      const result: z.infer<typeof weatherSchema> = {
        location: weatherData.city,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, // 或从系统获取
        temperature: `${weatherData.temperature}°C`,
        weather: weatherData.weather,
        code: weatherData.weather_code?.toString() || "",
        humidity: `${weatherData.humidity}%`,
        wind_direction: weatherData.wind_direction,
        wind_speed: `${weatherData.wind_power} km/h`, // 将wind_power转换为速度单位
        updated_at: weatherData.report_time,
      };

      return JSON.stringify(result, null, 2);
    } catch (error: any) {
      console.error("获取天气信息失败:", error);

      if (error.name === "AbortError") {
        return "获取天气信息失败: 请求超时";
      } else if (error.response) {
        return `获取天气信息失败: ${
          error.response.data.error?.description || "API请求失败"
        }`;
      } else if (error.request) {
        return "获取天气信息失败: 网络连接错误";
      } else {
        return `获取天气信息失败: ${error.message}`;
      }
    }
  },
  {
    name: "get_weather",
    description: "获取指定城市的当前天气信息",
    schema: weatherToolSchema,
  }
);

export { getWeatherTool };
