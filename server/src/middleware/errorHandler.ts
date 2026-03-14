import type { Request, Response, NextFunction } from "express";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (
    err &&
    typeof err === "object" &&
    "code" in err &&
    (err as { code: string }).code === "LIMIT_FILE_SIZE"
  ) {
    res.status(413).json({ code: "PAYLOAD_TOO_LARGE", message: "File too large (max 10MB)" });
    return;
  }

  if (err && typeof err === "object" && ("status" in err || "code" in err)) {
    const status = Number((err as { status?: number }).status) || 400;
    const code = String((err as { code?: string }).code ?? "BAD_REQUEST");
    const message = String((err as { message?: string }).message ?? "Bad request");
    res.status(status).json({ code, message });
    return;
  }

  console.error(err);
  res.status(500).json({ code: "INTERNAL_ERROR", message: "Unexpected error" });
}
