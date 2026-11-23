import { GoogleGenAI } from "@google/genai";

/** Server-side only. Reads GEMINI_API_KEY / OPENAI_MODEL; never import from browser code. */

const DEFAULT_MODEL = "gemini-2.0-flash";

export const AI_MODEL = process.env["OPENAI_MODEL"]?.trim() || DEFAULT_MODEL;
export const AIConfigured = () => Boolean(process.env["GEMINI_API_KEY"]?.trim());

export class AIFailed extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

let client: GoogleGenAI | null = null;
function getClient() {
  const apiKey = process.env["GEMINI_API_KEY"]?.trim();
  if (!apiKey) throw new AIFailed(503, "demo");
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

function mapError(err: unknown): never {
  if (err instanceof AIFailed) throw err;
  const status = typeof err === "object" && err !== null && "status" in err && typeof err.status === "number" ? err.status : undefined;
  // Do not log prompt, document or provider response content.
  console.error("AI request failed", status ?? "unknown");
  if (status === 429) throw new AIFailed(429, "The AI service is busy or its free quota is used up for now. Please wait a minute and try again.");
  if (status === 400) throw new AIFailed(400, "The AI service declined this request.");
  throw new AIFailed(502, "The AI service had a problem. Please try again later.");
}

function config(signal?: AbortSignal, maxOutputTokens?: number) {
  return {
    ...(signal ? { abortSignal: signal } : {}),
    ...(maxOutputTokens ? { maxOutputTokens } : {}),
  };
}

/** One-shot structured call: returns the model's JSON text, validated by the caller. */
export async function generateJson(options: {
  instructions: string;
  input: string;
  schema: Record<string, unknown>;
  maxOutputTokens?: number;
  signal?: AbortSignal;
}): Promise<string> {
  try {
    const response = await getClient().models.generateContent({
      model: AI_MODEL,
      contents: [{ role: "user", parts: [{ text: `${options.instructions}\n\n${options.input}` }] }],
      config: { ...config(options.signal, options.maxOutputTokens), responseMimeType: "application/json", responseJsonSchema: options.schema },
    });
    const text = response.text ?? "";
    if (!text.trim()) throw new AIFailed(502, "The AI response was incomplete. Please try again.");
    return text;
  } catch (err) {
    mapError(err);
  }
}

/** Streaming text call; yields text deltas as they arrive. */
export async function* streamText(options: {
  instructions: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxOutputTokens?: number;
  signal?: AbortSignal;
}): AsyncGenerator<{ text?: string; done?: boolean }> {
  try {
    const response = await getClient().models.generateContentStream({
      model: AI_MODEL,
      contents: options.messages.map(m => ({ role: m.role, parts: [{ text: m.content }] })),
      config: { ...config(options.signal, options.maxOutputTokens), systemInstruction: options.instructions },
    });
    for await (const chunk of response) {
      const text = chunk.text;
      if (text) yield { text };
    }
    yield { done: true };
  } catch (err) {
    mapError(err);
  }
}

/** One-shot image+text call; returns the model's text. */
export async function generateFromImage(options: {
  instructions: string;
  prompt: string;
  imageDataUrl: string;
  maxOutputTokens?: number;
  signal?: AbortSignal;
}): Promise<string> {
  try {
    const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(options.imageDataUrl);
    if (!match) throw new AIFailed(400, "This image format could not be read.");
    const response = await getClient().models.generateContent({
      model: AI_MODEL,
      contents: [{
        role: "user",
        parts: [
          { text: `${options.instructions}\n\n${options.prompt}` },
          { inlineData: { mimeType: match[1]!, data: match[2]! } },
        ],
      }],
      config: config(options.signal, options.maxOutputTokens),
    });
    const text = response.text ?? "";
    if (!text.trim()) throw new AIFailed(502, "The image could not be read. Try clearer evidence or add a written description.");
    return text;
  } catch (err) {
    mapError(err);
  }
}
