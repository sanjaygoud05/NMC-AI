# NMC-AI — End-to-End Production Deployment Guide

This guide walks you through deploying **NMC-AI** so that all 10 harmonization phases, AI matching, dataset ingestion, and the React frontend work seamlessly in production.

---

## Architecture Overview

```
 ┌─────────────────────────────────────────────────────────────┐
 │                      SUPABASE CLOUD                         │
 │      PostgreSQL DB · User Auth · Session Management         │
 └──────────────────────────────┬──────────────────────────────┘
                                │
                 ▲              │
                 │              ▼
   ┌─────────────┴────────┐   ┌───────────────────────────┐
   │   FRONTEND (Vercel)  │──▶│   BACKEND (Railway)       │
   │   React 18 + Vite    │   │   FastAPI + Pipeline      │
   │   Tailwind + shadcn  │   │   all-MiniLM-L6-v2 ML     │
   └──────────────────────┘   └───────────────────────────┘
```

---

## Option 1: Backend on Railway + Frontend on Vercel (Recommended 🚀)

This is the industry-standard setup:
- **Backend on Railway** handles Python + PyTorch / Sentence-Transformers with ample memory and automatic Docker support.
- **Frontend on Vercel** gives blazing fast global CDN delivery and instant preview deployments on every Git push.

---

### Step 1: Deploy Backend to Railway

1. Go to [railway.app](https://railway.app) and sign in with your GitHub account.
2. Click **"New Project"** → **"Deploy from GitHub repo"**.
3. Select your repository: `sanjaygoud05/NMI-AI`.
4. Railway will detect the root `Dockerfile` automatically.
5. In your Railway service settings:
   - Go to **Variables** and add:
     ```env
     PORT=8000
     DATA_DIR=/app/data
     SUPABASE_URL=<your-supabase-project-url>
     SUPABASE_KEY=<your-supabase-service-or-anon-key>
     ```
6. Go to **Settings** → **Networking** → Click **"Generate Domain"** (e.g. `https://nmi-ai-production.up.railway.app`).
7. Test the backend by visiting:
   ```
   https://your-railway-url.up.railway.app/api/health
   ```
   You should see: `{"status": "healthy"}`.

---

### Step 2: Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com) and log in with GitHub.
2. Click **"Add New Project"** → Import `sanjaygoud05/NMI-AI`.
3. Configure the Project:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click `Edit` and select **`client`**
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add **Environment Variables**:
   | Variable Name | Value |
   |---|---|
   | `VITE_API_BASE_URL` | `https://your-railway-url.up.railway.app` (from Step 1) |
   | `VITE_SUPABASE_URL` | `https://your-supabase-id.supabase.co` |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` |
5. Click **Deploy**.
   Vercel will build the frontend and provide your live URL (e.g., `https://nmc-ai.vercel.app`).

---

## Option 2: All-in-One Deployment on Railway

If you want both frontend and backend on Railway inside one project:

### Service 1: Backend
1. In your Railway project, click **New** → **GitHub Repo** → `sanjaygoud05/NMI-AI`.
2. Name the service: `backend`.
3. In **Settings**:
   - Railway will build using the root `Dockerfile`.
   - In **Variables**, add:
     ```env
     PORT=8000
     DATA_DIR=/app/data
     SUPABASE_URL=...
     SUPABASE_KEY=...
     ```
4. Generate a public domain under **Networking** (e.g., `https://backend-production.up.railway.app`).

### Service 2: Frontend
1. In the same project canvas, click **+ New** → **GitHub Repo** → select `sanjaygoud05/NMI-AI` again.
2. Name this service: `frontend`.
3. In **Settings**:
   - **Root Directory**: `/client`
   - **Dockerfile Path**: `Dockerfile` (uses `client/Dockerfile` with Nginx)
4. In **Variables**, add:
   ```env
   VITE_API_BASE_URL=https://backend-production.up.railway.app
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_PUBLISHABLE_KEY=...
   ```
5. Generate a public domain under **Networking**.

---

## Pre-Flight Checklist Before You Deploy

- [x] **CORS configured**: `server/app/main.py` is configured with `allow_origin_regex` to allow your Vercel or Railway domain.
- [x] **SPA Routing**: `client/vercel.json` and `client/nginx.conf` have rewrite rules so refreshing pages (`/dashboard`, `/review`) won't 404.
- [x] **Dynamic PORT**: `server/Dockerfile` and root `Dockerfile` listen on dynamic `${PORT:-8000}`.
- [x] **Data directory bundled**: The root `Dockerfile` copies `data/` and `server/` together so the baseline dataset (1,250 items) is immediately available in production without manual upload.
- [x] **Build verified**: `vite build` passes with zero errors.
