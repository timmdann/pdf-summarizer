import { GoogleGenAI } from "@google/genai";

const KEY = process.env.GEMINI_API_KEY!;
export const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const TIMEOUT = Number(process.env.GEMINI_TIMEOUT_MS ?? 15000);
const MAX_CHARS = 120_000;

const PROMPT = `You are a professional document analyst. Analyze the following PDF text and respond in Markdown using exactly this structure:

## Overview
One or two sentences: what this document is and its main purpose.

## Key Points
5–8 concise bullet points covering the most important information, findings, arguments, or instructions.

## Notable Details
Important specific facts worth highlighting: numbers, dates, names, deadlines, prices, statistics, or conclusions. If none are present, omit this section.

Rules:
- Be factual and concise
- Do not add information not present in the text
- Do not repeat the same point in multiple sections`;

function extractText(obj: unknown): string {
  if (typeof obj === "string") return obj;
  if (obj && typeof obj === "object") {
    const r = obj as { text?: string | (() => string) };
    if (typeof r.text === "string") return r.text;
    if (typeof r.text === "function") return r.text();
  }
  return "";
}

export async function* summarizeWithGeminiStream(
  text: string,
  signal?: AbortSignal
): AsyncGenerator<string> {
  if (!KEY) throw new Error("GEMINI_API_KEY is missing");

  const ai = new GoogleGenAI({ apiKey: KEY });
  const trimmed = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text;

  // Internal timeout — aborts if Gemini takes too long
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(new Error("AI_TIMEOUT")), TIMEOUT);

  // Propagate external abort (e.g. client disconnect)
  signal?.addEventListener("abort", () => ac.abort(signal.reason), {
    once: true,
  });

  try {
    const stream = await ai.models.generateContentStream({
      model: MODEL,
      contents: `${PROMPT}\n\n${trimmed}`,
    });

    for await (const chunk of stream) {
      if (ac.signal.aborted) throw ac.signal.reason ?? new Error("aborted");
      const chunkText = extractText(chunk).trim();
      if (chunkText) yield chunkText;
    }
  } finally {
    clearTimeout(timer);
  }
}
