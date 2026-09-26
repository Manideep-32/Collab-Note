# Collab Note

This repository contains a Node/Express backend and a Vite React frontend.

## Prerequisites

- Node.js 18+
- npm

## Install

```bash
# From repository root
npm install
npm --prefix frontend install
```

## Environment

Copy `.env.example` to `.env` and adjust values as needed:

```bash
cp .env.example .env
```

## Run (development)

```bash
# Start backend only
npm run dev

# Start frontend only
npm --prefix frontend run dev

# Start both concurrently
npm run serve
```

Backend runs on http://localhost:5000. Frontend runs on http://localhost:5173 and proxies `/api` to the backend.

## Routes

- GET `/` → API server status
- GET `/api/health` → health check

## Backend Environment Variables

- `PORT` (default `5000`)
- `MONGO_URI` (MongoDB connection string)
- `JWT_SECRET` (required for authentication)
- `JWT_EXPIRES_IN` (default `7d`)
- `S3_BUCKET_NAME` (bucket name for file metadata)
- `S3_UPLOAD_BASE_URL` (base URL used to generate upload URLs)
- `FILE_PUBLIC_BASE_URL` (base URL used to generate download URLs)

## Core API Route Groups

- `POST /api/auth/bootstrap-owner` (one-time setup if no owner exists)
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/refresh`

- `GET /api/users` (Owner)
- `PATCH /api/users/:id/role` (Owner)
- `PATCH /api/users/:id/subject-assignments` (Owner)

- `POST /api/subjects` (Owner)
- `GET /api/subjects`
- `PATCH /api/subjects/:id` (Owner)
- `DELETE /api/subjects/:id` (Owner)

### Subject Community (Gold-Mine + Social Layer)

- `GET /api/subjects/:id/hub` (subject overview, counts, highlights)
- `POST /api/subjects/:id/join` (join subject room)
- `DELETE /api/subjects/:id/join` (leave room)
- `GET /api/subjects/:id/membership` (current user membership status)
- `GET /api/subjects/:id/members` (members list; room access required)

- `GET /api/subjects/:id/discussions` (room only)
- `POST /api/subjects/:id/discussions` (room only)
- `GET /api/subjects/:id/discussions/:threadId` (room only)
- `POST /api/subjects/:id/discussions/:threadId/replies` (room only)

- `GET /api/subjects/:id/notes` (subject notes section from approved resources)

- `GET /api/subjects/:id/famous-questions` (room only)
- `POST /api/subjects/:id/famous-questions` (room only)
- `PATCH /api/subjects/:id/famous-questions/:questionId/verify` (Subject Admin/Owner)

- `GET /api/subjects/:id/roadmaps`
- `POST /api/subjects/:id/roadmaps` (Subject Admin/Owner)

- `POST /api/resources/upload` (multipart/form-data, field name: `file`)
- `POST /api/resources/upload-url` (returns 410 in MongoDB-only mode)
- `POST /api/resources` (legacy metadata route)
- `GET /api/resources`
- `POST /api/resources/:id/download` (streams file from MongoDB GridFS)
- `PATCH /api/resources/:id/approve` (Subject Admin, Owner)
- `PATCH /api/resources/:id/reject` (Subject Admin, Owner)
- `PATCH /api/resources/:id/flag` (Subject Admin, Owner)
- `DELETE /api/resources/:id` (Subject Admin, Owner)

- `POST /api/resources/:id/reviews`
- `GET /api/resources/:id/reviews`

- `GET /api/tech-trends`
- `POST /api/tech-trends` (Owner)
- `POST /api/tech-trends/ingest` (Owner)

## Resource Upload In MongoDB-Only Mode

Use `POST /api/resources/upload` with `multipart/form-data`:

- text fields: `title`, `description`, `resourceType`, `subjectId`, `module`, `topic`, `tags`
- file field: `file`

Files are stored in MongoDB GridFS under the `resourceFiles` bucket and streamed back by the download endpoint.

## Build (frontend)

```bash
npm --prefix frontend run build
```

Output is in `frontend/dist`.

## Notes

- Routers, controllers, and models directories are scaffolded; add your routes under `routers/` and wire them in `index.js`.
- Adjust the Vite proxy in `frontend/vite.config.js` if your backend port changes.
