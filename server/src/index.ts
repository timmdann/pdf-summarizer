import express from "express";
import multer from "multer";
import cors from "cors";
import "dotenv/config";
import { summarizeWithGemini } from "./geminiClient";

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
    origin: allowedOrigins.length ? allowedOrigins : true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);
app.options("*", cors());

app.get("/api/health", (_req: express.Request, res: express.Response) => {
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

app.post(
  "/api/summarize",
  upload.single("file"),
  async (req: express.Request, res: express.Response) => {
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

    try {
      const parsed = await pdfParse(buf);
      const text = String(parsed.text || "").trim();
      if (text.length === 0) {
        return res
          .status(400)
          .json({ code: "EMPTY_PDF", message: "No extractable text in PDF" });
      }

      const t0 = Date.now();
      const summary = await summarizeWithGemini(text);
      const durationMs = Date.now() - t0;

      return res.json({
        summary,
        model: process.env.GEMINI_MODEL ?? "gemini-1.5-flash",
        inputChars: text.length,
        durationMs,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      if (/abort/i.test(msg) || /timeout/i.test(msg)) {
        return res
          .status(504)
          .json({ code: "AI_TIMEOUT", message: "Upstream model timeout" });
      }
      return res.status(502).json({ code: "AI_UPSTREAM_ERROR", message: msg });
    }
  }
);

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
