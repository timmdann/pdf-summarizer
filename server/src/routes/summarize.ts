import { Router } from "express";
import multer from "multer";
import { summarizeWithGeminiStream, MODEL } from "../geminiClient";
import { summarizeLimiter } from "../middleware/rateLimiter";

const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (
  data: Buffer
) => Promise<{ text: string }>;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (
      file.mimetype === "application/pdf" ||
      file.mimetype === "application/octet-stream"
    ) {
      cb(null, true);
    } else {
      const err = new Error("Only PDF files are accepted") as Error & {
        status?: number;
        code?: string;
      };
      err.status = 415;
      err.code = "UNSUPPORTED_MEDIA_TYPE";
      cb(err);
    }
  },
});

const router = Router();

router.post("/", summarizeLimiter, upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      message: "file is required and must be a PDF",
    });
  }

  const buf = req.file.buffer;
  const isPdf = buf && buf.slice(0, 5).toString("ascii") === "%PDF-";
  if (!isPdf) {
    return res.status(415).json({
      code: "UNSUPPORTED_MEDIA_TYPE",
      message: "File is not a valid PDF",
    });
  }

  let text: string;
  try {
    const parsed = await pdfParse(buf);
    text = String(parsed.text || "").trim();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/password|encrypted/i.test(msg)) {
      return res.status(422).json({
        code: "PDF_ENCRYPTED",
        message: "PDF is password-protected. Please remove the password and try again.",
      });
    }
    return res.status(502).json({ code: "PARSE_ERROR", message: "Failed to parse PDF" });
  }

  if (text.length === 0) {
    return res.status(400).json({ code: "EMPTY_PDF", message: "No extractable text in PDF" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const ac = new AbortController();
  req.on("close", () => ac.abort());

  const t0 = Date.now();
  try {
    for await (const chunk of summarizeWithGeminiStream(text, ac.signal)) {
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    }
    const durationMs = Date.now() - t0;
    res.write(`data: ${JSON.stringify({ done: true, model: MODEL, inputChars: text.length, durationMs })}\n\n`);
  } catch (e) {
    if (ac.signal.aborted) return;
    const msg = e instanceof Error ? e.message : "Unknown error";
    const code = /timeout|abort/i.test(msg) ? "AI_TIMEOUT" : "AI_UPSTREAM_ERROR";
    res.write(`data: ${JSON.stringify({ error: true, code, message: msg })}\n\n`);
  } finally {
    res.end();
  }
});

export default router;
