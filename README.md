# PDF Summarizer

Web application that uploads a PDF and returns an AI-generated summary using Google Gemini. The summary streams in real time as it is generated.

## Features

- Drag & drop or click-to-browse PDF upload (max 10 MB) with animated visual feedback
- Streaming response — text appears word by word as Gemini generates it
- Structured summary — Overview, Key Points, and Notable Details sections
- Markdown rendering — bold, lists, and headings rendered properly
- Copy to clipboard button
- Rate limiting — 20 requests per 15 minutes per IP
- Docker Compose setup for one-command deployment

## Tech stack

| Layer     | Technology                                        |
| --------- | ------------------------------------------------- |
| Frontend  | React 19, TypeScript, Vite, Tailwind CSS v4       |
| Backend   | Node.js, Express 5, TypeScript                    |
| AI        | Google Gemini API (`@google/genai`)               |
| Streaming | Server-Sent Events (SSE)                          |
| Serving   | nginx (production), Vite dev server (development) |

## Quick start with Docker

```bash
cp .env.example .env
# Add your GEMINI_API_KEY to .env

docker compose up --build
```

Open [http://localhost](http://localhost).

## Local development

**Requirements:** Node.js 22+

```bash
# Terminal 1 — backend
cd server
npm install
npm run dev        # runs on http://localhost:3000

# Terminal 2 — frontend
cd client
npm install
npm run dev        # runs on http://localhost:5173
```

Vite proxies `/api/*` to `localhost:3000` automatically.

## Environment variables

Create a `.env` file in the project root (see `.env.example`):

| Variable            | Default            | Description                         |
| ------------------- | ------------------ | ----------------------------------- |
| `GEMINI_API_KEY`    | —                  | **Required.** Google Gemini API key |
| `GEMINI_MODEL`      | `gemini-2.5-flash` | Model to use                        |
| `GEMINI_TIMEOUT_MS` | `15000`            | Request timeout in milliseconds     |
| `PORT`              | `3000`             | Backend server port                 |
| `CORS_ORIGIN`       | _(any)_            | Comma-separated allowed origins     |

## Project structure

```
pdf-summarizer/
├── client/                      # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/              # Base UI components
│   │   │   └── SummaryCard.tsx  # Result card with copy button
│   │   ├── hooks/
│   │   │   └── useSummarize.ts  # Fetch + SSE streaming logic
│   │   └── App.tsx              # Page layout and form
│   ├── nginx.conf               # Production nginx config
│   └── Dockerfile
├── server/                      # Express backend
│   ├── src/
│   │   ├── middleware/
│   │   │   ├── cors.ts          # CORS config
│   │   │   ├── rateLimiter.ts   # Rate limiting
│   │   │   └── errorHandler.ts  # Global error handler
│   │   ├── routes/
│   │   │   └── summarize.ts     # POST /api/summarize
│   │   ├── geminiClient.ts      # Gemini API + streaming
│   │   └── index.ts             # App setup and entry point
│   └── Dockerfile
├── docker-compose.yml
└── .env.example
```

## API

### `POST /api/summarize`

Accepts a multipart form with a `file` field (PDF, max 10 MB). Returns a Server-Sent Events stream.

### `GET /api/health`

Returns `{ ok: true }`. Used by Docker Compose health check.
