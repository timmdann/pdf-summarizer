import { useState, useRef, useEffect } from "react";

export type SummarizeStatus = "idle" | "loading" | "streaming" | "done" | "error";

export type SummaryMeta = {
  model: string;
  durationMs: number;
  inputChars: number;
};

type BackendError = {
  code: string;
  message: string;
};

const API_BASE = (import.meta.env.VITE_API_URL ?? "").trim().replace(/\/$/, "");

async function readJsonSafe(res: Response): Promise<unknown | null> {
  const ct = res.headers.get("content-type") || "";
  if (!/application\/json/i.test(ct)) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export function useSummarize() {
  const [status, setStatus] = useState<SummarizeStatus>("idle");
  const [result, setResult] = useState<string>("");
  const [err, setErr] = useState<string>("");
  const [meta, setMeta] = useState<SummaryMeta | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  async function summarize(file: File): Promise<void> {
    abortControllerRef.current?.abort();
    const ac = new AbortController();
    abortControllerRef.current = ac;

    setStatus("loading");
    setErr("");
    setResult("");
    setMeta(null);

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch(`${API_BASE}/api/summarize`, {
        method: "POST",
        body: fd,
        signal: ac.signal,
      });

      if (!res.ok) {
        if (res.status === 413) throw new Error("File too large (max 10MB)");
        const data = await readJsonSafe(res);
        const be = data as BackendError | null;
        throw new Error(be?.message ?? `HTTP ${res.status}`);
      }

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      setStatus("streaming");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          let event: Record<string, unknown>;
          try {
            event = JSON.parse(jsonStr) as Record<string, unknown>;
          } catch {
            continue;
          }

          if (typeof event.chunk === "string") {
            setResult((prev) => prev + event.chunk);
          } else if (event.done) {
            setMeta({
              model: String(event.model ?? ""),
              durationMs: Number(event.durationMs ?? 0),
              inputChars: Number(event.inputChars ?? 0),
            });
            setStatus("done");
          } else if (event.error) {
            throw new Error(String(event.message ?? "Stream error"));
          }
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") return;
      setErr(error instanceof Error ? error.message : "Unknown error");
      setStatus("error");
    }
  }

  return { status, result, err, meta, summarize };
}
