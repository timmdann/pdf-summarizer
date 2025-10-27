import { GoogleGenAI } from "@google/genai";

const KEY = process.env.GEMINI_API_KEY!;
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const TIMEOUT = Number(process.env.GEMINI_TIMEOUT_MS ?? 15000);
const MAX_CHARS = 120_000;

export async function summarizeWithGemini(text: string): Promise<string> {
  if (!KEY) throw new Error("GEMINI_API_KEY is missing");

  const ai = new GoogleGenAI({ apiKey: KEY });
  const trimmed = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text;

  const prompt =
    "Summarize the following PDF text in 5–8 brief points. Be factual and concise, paying attention to details. At the very beginning, describe what this file is about and what information it contains.";

  const task = ai.models.generateContent({
    model: MODEL,
    contents: `${prompt}\n\n${trimmed}`,
  });

  const timeout = new Promise<never>((_, rej) =>
    setTimeout(() => rej(new Error("timeout")), TIMEOUT)
  );

  const resp: unknown = await Promise.race([task, timeout]).catch((e) => {
    if (e instanceof Error && e.message === "timeout") {
      throw new Error("AI_TIMEOUT");
    }
    throw e;
  });

  let summary = "";
  if (typeof resp === "string") {
    summary = resp;
  } else if (resp && typeof resp === "object") {
    const r = resp as { text?: string | (() => unknown) };
    if (typeof r.text === "string") {
      summary = r.text;
    } else if (typeof r.text === "function") {
      const v = r.text();
      summary = typeof v === "string" ? v : String(v ?? "");
    } else {
      summary = String(resp);
    }
  } else {
    summary = String(resp ?? "");
  }

  summary = summary.trim();
  if (!summary) throw new Error("Empty summary from model");
  return summary;
}
