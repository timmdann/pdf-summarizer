import { GoogleGenAI } from "@google/genai";

const KEY = process.env.GEMINI_API_KEY!;
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const TIMEOUT = Number(process.env.GEMINI_TIMEOUT_MS ?? 15000);
const MAX_CHARS = 120_000;

const PROMPT =
  "Summarize the following PDF text in 5–8 brief points. Be factual and concise, paying attention to details. At the very beginning, describe what this file is about and what information it contains.";

function extractText(obj: unknown): string {
  if (typeof obj === "string") return obj;
  if (obj && typeof obj === "object") {
    const r = obj as { text?: string | (() => unknown) };
    if (typeof r.text === "string") return r.text;
    if (typeof r.text === "function") {
      const v = r.text();
      return typeof v === "string" ? v : String(v ?? "");
    }
    return String(obj);
  }
  return String(obj ?? "");
}

export async function summarizeWithGemini(text: string): Promise<string> {
  if (!KEY) throw new Error("GEMINI_API_KEY is missing");

  const ai = new GoogleGenAI({ apiKey: KEY });
  const trimmed = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text;

  const task = ai.models.generateContent({
    model: MODEL,
    contents: `${PROMPT}\n\n${trimmed}`,
  });

  const timeout = new Promise<never>((_, rej) =>
    setTimeout(() => rej(new Error("timeout")), TIMEOUT)
  );

  const resp: unknown = await Promise.race([task, timeout]).catch((e) => {
    if (e instanceof Error && e.message === "timeout") throw new Error("AI_TIMEOUT");
    throw e;
  });

  const summary = extractText(resp).trim();
  if (!summary) throw new Error("Empty summary from model");
  return summary;
}

export async function* summarizeWithGeminiStream(
  text: string
): AsyncGenerator<string> {
  if (!KEY) throw new Error("GEMINI_API_KEY is missing");

  const ai = new GoogleGenAI({ apiKey: KEY });
  const trimmed = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text;

  const stream = await ai.models.generateContentStream({
    model: MODEL,
    contents: `${PROMPT}\n\n${trimmed}`,
  });

  for await (const chunk of stream) {
    const chunkText = extractText(chunk).trim();
    if (chunkText) yield chunkText;
  }
}
