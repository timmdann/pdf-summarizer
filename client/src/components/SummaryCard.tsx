import { useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { SummaryMeta } from "@/hooks/useSummarize";

type Props = {
  result: string;
  status: "streaming" | "done";
  meta: SummaryMeta | null;
};

export function SummaryCard({ result, status, meta }: Props) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = useCallback(async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  return (
    <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
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
        <div
          className="text-sm prose prose-sm max-w-none
            prose-ul:my-1 prose-li:my-0.5
            prose-p:my-1 prose-strong:font-semibold"
        >
          <ReactMarkdown>{result}</ReactMarkdown>
        </div>
        {status === "streaming" && (
          <span className="inline-block w-[2px] h-[1em] bg-teal-600 ml-0.5 align-middle animate-pulse" />
        )}
      </CardContent>
      {status === "done" && meta && (
        <CardFooter className="flex flex-col">
          <span>
            Model: <span className="font-medium">{meta.model}</span>
          </span>
          <span>
            Time: <span className="font-medium">{meta.durationMs} ms</span>
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
  );
}
