import "dotenv/config";
import express from "express";
import morgan from "morgan";
import { corsMiddleware } from "./middleware/cors";
import { errorHandler } from "./middleware/errorHandler";
import summarizeRouter from "./routes/summarize";

const app = express();
const port = process.env.PORT || 3000;

app.use(corsMiddleware);
app.use(morgan("dev"));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/summarize", summarizeRouter);

app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
