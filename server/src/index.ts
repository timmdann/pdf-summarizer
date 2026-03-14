import express from "express";
import multer from "multer";
import "dotenv/config";
import cors from "cors";
import { summarizeWithGeminiStream } from "./geminiClient";

const pdfParse = require("pdf-parse") as (
  data: Buffer
) => Promise<{ text: string }>;

const app = express();
const port = process.env.PORT || 3000;

const allowedOrigins = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
    credentials: false,
  })
);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

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

app.post("/api/summarize", upload.single("file"), async (req, res) => {
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
    const msg = e instanceof Error ? e.message : "Unknown error";
    return res.status(502).json({ code: "PARSE_ERROR", message: msg });
  }

  if (text.length === 0) {
    return res
      .status(400)
      .json({ code: "EMPTY_PDF", message: "No extractable text in PDF" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const t0 = Date.now();
  try {
    for await (const chunk of summarizeWithGeminiStream(text)) {
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    }
    const durationMs = Date.now() - t0;
    res.write(
      `data: ${JSON.stringify({
        done: true,
        model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
        inputChars: text.length,
        durationMs,
      })}\n\n`
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    const code = /timeout|abort/i.test(msg) ? "AI_TIMEOUT" : "AI_UPSTREAM_ERROR";
    res.write(`data: ${JSON.stringify({ error: true, code, message: msg })}\n\n`);
  } finally {
    res.end();
  }
});

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "LIMIT_FILE_SIZE"
    ) {
      return res.status(413).json({
        code: "PAYLOAD_TOO_LARGE",
        message: "File too large (max 10MB)",
      });
    }

    if (err && typeof err === "object" && ("status" in err || "code" in err)) {
      const status = Number((err as { status?: number }).status) || 400;
      const code = String((err as { code?: string }).code ?? "BAD_REQUEST");
      const message = String(
        (err as { message?: string }).message ?? "Bad request"
      );
      return res.status(status).json({ code, message });
    }

    console.error(err);
    res
      .status(500)
      .json({ code: "INTERNAL_ERROR", message: "Unexpected error" });
  }
);

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
