import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FileDropzone } from "@/components/ui/file-dropzone";
import Spinner from "@/components/ui/spinner";
import { SummaryCard } from "@/components/SummaryCard";
import { useSummarize } from "@/hooks/useSummarize";

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

function validatePDF(f: File): string | null {
  if (f.type !== "application/pdf" && f.type !== "application/octet-stream") {
    return "Only PDF files are allowed";
  }
  if (f.size > MAX_SIZE_BYTES) return "File is too large (max 10MB)";
  return null;
}

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [fileErr, setFileErr] = useState<string>("");
  const { status, result, err, meta, summarize } = useSummarize();

  function pick(f: File | undefined): void {
    if (!f) return;
    const validationErr = validatePDF(f);
    if (validationErr) {
      setFileErr(validationErr);
      setFile(null);
      return;
    }
    setFile(f);
    setFileErr("");
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!file) return;
    await summarize(file);
  }

  const isBusy = status === "loading" || status === "streaming";
  const errorMessage = fileErr || (status === "error" ? err : "");

  return (
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
            disabled={isBusy}
            onSelect={pick}
          />
          {file && (
            <p className="text-xs text-muted-foreground">
              Selected: <span className="font-medium">{file.name}</span> ·{" "}
              {(file.size / 1024).toFixed(1)} KB
            </p>
          )}
        </div>

        {isBusy ? (
          <Spinner />
        ) : (
          <Button type="submit" variant="teal" disabled={!file} className="w-full">
            Send for summarization
          </Button>
        )}

        {(status === "streaming" || status === "done") && result && (
          <SummaryCard result={result} status={status} meta={meta} />
        )}

        {errorMessage && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}
      </form>
    </div>
  );
}
