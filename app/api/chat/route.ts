import { NextRequest } from "next/server";
import { DeepSeekModel } from "@/core/DeepSeekModel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    const apiKey = process.env.DEEP_SEEK_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "DEEP_SEEK_API_KEY is not set" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const model = new DeepSeekModel(apiKey);
    const readableStream = await model.createStreamingResponse(messages);

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("API error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
