# PDF Summarizer

Web application that uploads a PDF and returns an AI-generated summary using Google Gemini. The summary streams in real time as it is generated.

## Features

- Drag & drop or click-to-browse PDF upload (max 10 MB)
- Streaming response — text appears word by word as Gemini generates it
- Markdown rendering — bold, lists, and headings rendered properly
- Copy to clipboard button
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
├── client/               # React frontend
│   ├── src/
│   │   ├── components/ui/
│   │   └── App.tsx
│   ├── nginx.conf        # Production nginx config
│   └── Dockerfile
├── server/               # Express backend
│   ├── src/
│   │   ├── index.ts      # API routes
│   │   └── geminiClient.ts
│   └── Dockerfile
├── docker-compose.yml
└── .env.example
```

## API

### `POST /api/summarize`

Accepts a multipart form with a `file` field (PDF). Returns a Server-Sent Events stream.
