import { useState, useCallback } from "react";
import Spinner from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { Copy, Check } from "lucide-react";

type BackendError = {
  code: string;
  message: string;
};

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const API_BASE = (import.meta.env.VITE_API_URL ?? "").trim().replace(/\/$/, "");

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<
    "idle" | "loading" | "streaming" | "done" | "error"
  >("idle");
  const [result, setResult] = useState<string>("");
  const [err, setErr] = useState<string>("");
  const [meta, setMeta] = useState<{
    model: string;
    durationMs: number;
    inputChars: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  function validatePDF(f: File): string | null {
    if (f.type !== "application/pdf" && f.type !== "application/octet-stream") {
      return "Only PDF files are allowed";
    }
    if (f.size > MAX_SIZE_BYTES) return "File is too large (max 10MB)";
    return null;
  }

  function pick(f: File | undefined): void {
    if (!f) return;
    const v = validatePDF(f);
    if (v) {
      setErr(v);
      setFile(null);
      setResult("");
      setMeta(null);
      setStatus("error");
      return;
    }
    setFile(f);
    setErr("");
    setResult("");
    setMeta(null);
    setStatus("idle");
  }

  const copyToClipboard = useCallback(async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  async function readJsonSafe(res: Response): Promise<unknown | null> {
    const ct = res.headers.get("content-type") || "";
    if (!/application\/json/i.test(ct)) return null;
    try {
      return await res.json();
    } catch {
      return null;
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!file) return;

    setStatus("loading");
    setErr("");
    setResult("");
    setMeta(null);

    const fd = new FormData();
    fd.append("file", file);

    try {
      const url = `${API_BASE ? API_BASE : ""}/api/summarize`;
      const res = await fetch(url, { method: "POST", body: fd });

      if (!res.ok) {
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
      const message = error instanceof Error ? error.message : "Unknown error";
      setErr(message);
      setStatus("error");
    }
  }

  return (
    <>
      <div className="min-h-screen flex flex-col gap-14 items-center justify-center bg-gray-50 p-6">
        <div>
          <h1 className="scroll-m-20 text-center text-4xl font-extrabold tracking-tight text-balance mb-5 text-teal-900">
            PDF Summarization
          </h1>
          <h2 className="scroll-m-20 pb-2 text-2xl font-semibold tracking-tight first:mt-0 text-teal-800">
            Send us your PDF file and receive a brief summary
          </h2>
        </div>
        <form onSubmit={onSubmit} className="w-full max-w-md space-y-4">
          <div className="grid w-full items-center gap-2">
            <Label htmlFor="pdf">PDF file</Label>

            <FileDropzone
              id="pdf"
              accept="application/pdf"
              disabled={status === "loading" || status === "streaming"}
              onSelect={(f) => pick(f)}
            />

            {file && (
              <p className="text-xs text-muted-foreground">
                Selected: <span className="font-medium">{file.name}</span> ·{" "}
                {(file.size / 1024).toFixed(1)} KB
              </p>
            )}
          </div>

          {status === "loading" || status === "streaming" ? (
            <Spinner />
          ) : (
            <Button
              type="submit"
              variant="teal"
              disabled={!file}
              className="w-full"
            >
              Send for summarization
            </Button>
          )}

          {(status === "streaming" || status === "done") && result && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Result</CardTitle>
                {status === "done" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={copyToClipboard}
                    className="text-muted-foreground"
                  >
                    {copied ? (
                      <><Check className="h-4 w-4" /> Copied!</>
                    ) : (
                      <><Copy className="h-4 w-4" /> Copy</>
                    )}
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <div className="whitespace-pre-wrap text-sm">{result}</div>
              </CardContent>
              {status === "done" && meta && (
                <CardFooter className="flex flex-col">
                  <span>
                    Model: <span className="font-medium">{meta.model}</span>
                  </span>
                  <span>
                    Time:{" "}
                    <span className="font-medium">{meta.durationMs} ms</span>
                  </span>
                  <span>
                    Input text:{" "}
                    <span className="font-medium">
                      {meta.inputChars.toLocaleString()} characters
                    </span>
                  </span>
                </CardFooter>
              )}
            </Card>
          )}

          {status === "error" && err && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{err}</AlertDescription>
            </Alert>
          )}
        </form>
      </div>
    </>
  );
}
