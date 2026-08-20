# Markyn - Cloud Sync API

Flask REST API backing the optional cloud-save feature. Stores projects in Postgres (hosted on
Supabase) and authenticates requests via Supabase-issued JWTs, verified against Supabase's public
JWKS endpoint (no shared secret required). Purely additive to the main app - local save/import
(file-based) works with zero backend and no login.

## Setup

1. Create a Supabase project. In its dashboard:
   - **Settings > API**: copy the Project URL and `anon` public key (used by the frontend for
     auth only - never sent to this API).
   - **Settings > Database**: copy the connection string.
   - **SQL Editor**: run `db/schema.sql` to create the `projects` table.
2. `cd backend && python -m venv venv && venv\Scripts\activate` (or `source venv/bin/activate` on macOS/Linux)
3. `pip install -r requirements.txt`
4. Copy `.env.example` to `.env` and fill in `DATABASE_URL` and `SUPABASE_URL`.
5. `python app.py` - runs on `http://localhost:5000`.

## Deployment

Deployed on Render as a Python web service:
- Root directory: `backend`
- Build command: `pip install -r requirements.txt`
- Start command: `gunicorn wsgi:app`
- Environment variables: `DATABASE_URL`, `SUPABASE_URL`, `ALLOWED_ORIGINS` (comma-separated
  origins allowed to call this API)

Free-tier services sleep after ~15 minutes idle; the first request afterward takes ~30-50s to
wake up.

## API

All `/api/projects*` routes require `Authorization: Bearer <supabase-access-token>`.

| Method | Path                  | Description                                  |
|--------|-----------------------|-----------------------------------------------|
| GET    | `/api/projects`       | List the current user's projects (summary)   |
| GET    | `/api/projects/<id>`  | Full project data (including the saved PDF)  |
| POST   | `/api/projects`       | Create a project (`{name, data}`)            |
| PUT    | `/api/projects/<id>`  | Update a project (`{name?, data?}`)          |
| DELETE | `/api/projects/<id>`  | Delete a project                             |

`data` is the same JSON shape the app already produces for local save/export
(`{ name, scale, scaleUnit, regions, materials, pageCount, pdfBase64 }`).
