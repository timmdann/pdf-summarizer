import { useState } from "react";
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

type SummarizeResponse = {
  summary: string;
  model: string;
  inputChars: number;
  durationMs: number;
};

type BackendError = {
  code: string;
  message: string;
};

function isSummarizeResponse(x: unknown): x is SummarizeResponse {
  return (
    typeof x === "object" &&
    x !== null &&
    "summary" in x &&
    typeof (x as { summary: unknown }).summary === "string" &&
    "model" in x &&
    "inputChars" in x &&
    "durationMs" in x
  );
}

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle"
  );
  const [result, setResult] = useState<string>("");
  const [err, setErr] = useState<string>("");
  const [meta, setMeta] = useState<Pick<
    SummarizeResponse,
    "model" | "durationMs" | "inputChars"
  > | null>(null);

  function validatePDF(f: File): string | null {
    if (f.type !== "application/pdf") return "Only PDF files are allowed";
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

  async function readJsonSafe(res: Response): Promise<unknown | null> {
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
      const res = await fetch("/api/summarize", { method: "POST", body: fd });
      const data = await readJsonSafe(res);

      if (!res.ok) {
        const be = data as BackendError | null;
        throw new Error(be?.message ?? `HTTP ${res.status}`);
      }

      if (!isSummarizeResponse(data)) {
        throw new Error("Unexpected response shape");
      }

      setResult(data.summary);
      setMeta({
        model: data.model,
        durationMs: data.durationMs,
        inputChars: data.inputChars,
      });
      setStatus("done");
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
              disabled={status === "loading"}
              onSelect={(f) => pick(f)}
            />

            {file && (
              <p className="text-xs text-muted-foreground">
                Selected: <span className="font-medium">{file.name}</span> ·{" "}
                {(file.size / 1024).toFixed(1)} KB
              </p>
            )}
          </div>

          {status === "loading" ? (
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

          {status === "done" && meta && (
            <Card>
              <CardHeader>
                <CardTitle>Result</CardTitle>
                <CardDescription></CardDescription>
              </CardHeader>
              <CardContent>
                <div className="whitespace-pre-wrap text-sm">{result}</div>
              </CardContent>
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
