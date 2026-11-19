# ClipGenius AI — Backend

Real backend for ClipGenius AI: video upload/URL intake, Whisper transcription,
Claude-based moment analysis, and FFmpeg 9:16 clip extraction with subtitles.

## What this does NOT do (by design)
- It does **not** download from YouTube/TikTok/Instagram/Twitch/Kick. Only
  (a) direct file upload, or (b) a direct URL that resolves straight to a
  video file you have rights to use. Scraping social platforms violates
  their Terms of Service and is out of scope.
- It never fabricates transcripts, clips, or metadata. If the AI keys are
  missing or a provider call fails, the job fails with a real error instead
  of returning fake data.

## Required accounts / API keys (you must create these yourself)
1. **OpenAI account** → https://platform.openai.com/api-keys
   - Used for: Whisper transcription (`OPENAI_API_KEY`).
   - **Not free** — Whisper API is billed per minute of audio (currently a
     few cents per hour of video). You must add a payment method to your
     OpenAI account or the calls will fail.
2. **Anthropic account** → https://console.anthropic.com/settings/keys
   - Used for: picking highlight moments + writing titles/descriptions/
     hashtags (`ANTHROPIC_API_KEY`).
   - Also billed per use (small cost per video analyzed).
3. **A hosting account** for this backend (see "Deployment" below) — Render
   is used as the primary example.

There is no way to run the AI features for free — those two providers charge
per use. The *hosting* can be minimized, but the AI calls themselves cost a
small amount per video.

## Local environment variables
Copy `.env.example` to `.env` and fill in the two API keys plus your
frontend's GitHub Pages URL in `FRONTEND_ORIGIN`. **Never commit `.env`.**

## Project structure
```
backend/
├── server.js                  entry point
├── src/
│   ├── config.js               loads & validates env vars
│   ├── routes/jobs.js          HTTP routes
│   ├── controllers/jobsController.js
│   ├── middleware/             upload (Multer), rate limiting, errors
│   ├── services/
│   │   ├── jobStore.js         JSON-file job persistence (no DB needed)
│   │   ├── queue.js            single-process job worker/pipeline
│   │   ├── transcription.js    real Whisper API call
│   │   ├── analysis.js         real Claude API call
│   │   ├── videoFetcher.js     safe direct-URL video download
│   │   ├── videoProcessor.js   FFmpeg: crop to 9:16, cut, burn subtitles
│   │   └── cleanup.js          deletes old files automatically
│   └── utils/srt.js            builds .srt subtitle files from Whisper output
└── storage/                     uploads/outputs/tmp (not committed)
```

## API
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Health check, also reports if AI keys are configured |
| POST | `/api/jobs` | Create a job. `multipart/form-data` with field `video` (file) OR JSON/form field `url`. Optional: `language`, `minClip`, `maxClip`, `targetClip`, `maxClips` |
| GET | `/api/jobs/:id` | Poll status + progress (0-100) |
| GET | `/api/jobs/:id/results` | Final clip list (only once `status === "done"`) |
| GET | `/api/jobs/:id/download/:filename` | Download a generated clip |

Job `status` values: `queued → transcribing → analyzing → processing → done`
(or `failed` with an `error` message at any stage).

## Running it locally (for testing only — most people will deploy directly, see below)
```
cd backend
npm install
cp .env.example .env   # then edit .env with your real keys
npm start
```

---

## Deployment — exact steps from an Android phone

You do **not** need a computer. Everything below is done through GitHub's
and Render's websites in your phone's browser.

### Step 1 — Push this code to GitHub
If you received this as a zip, upload it to your existing ClipGenius AI
GitHub repository (GitHub's mobile web UI supports dragging/uploading
files, or use the GitHub mobile app's "Add file → Upload files").
Make sure `backend/.env` is **never** uploaded — only `.env.example`.

### Step 2 — Create the backend service on Render
1. Go to https://render.com on your phone browser → sign up / log in with GitHub.
2. Click **New → Blueprint**, select your ClipGenius AI repo. Render will
   detect `render.yaml` at the repo root and propose the `clipgenius-backend`
   service automatically.
3. When prompted, set the environment variables Render marks as required:
   - `OPENAI_API_KEY` → your OpenAI key
   - `ANTHROPIC_API_KEY` → your Anthropic key
   - `FRONTEND_ORIGIN` → your GitHub Pages URL, e.g. `https://yourusername.github.io`
4. Click **Apply** / **Create**. Render will build and deploy automatically.
   This takes a few minutes — you can watch the build logs in the browser.

### Why "Starter" and not "Free" in `render.yaml`
Render's free web services go to sleep after idle time and free instances
don't support the persistent disk this backend needs for video files during
processing. FFmpeg jobs also need to run for minutes without being killed.
The blueprint uses the cheapest **paid** instance (Starter, a few dollars/month)
specifically because it stays awake and has a real disk — this was the
practical decision explained in the audit: there isn't a reliable free tier
for sustained FFmpeg workloads right now. You can try switching `plan` to
`free` in `render.yaml` first if you want to test it at zero cost, but expect
jobs to fail or time out once a video is of any real length.

### Step 3 — Get your backend URL
Once deployed, Render shows a URL like `https://clipgenius-backend.onrender.com`.
Copy it — you'll put it into the frontend next.

### Step 4 — Point the frontend at the backend
In the frontend repo (same repo, root files), open `script.js` on GitHub's
mobile web editor and set the `API_BASE_URL` constant near the top to your
Render URL from Step 3. Commit the change — GitHub Pages redeploys
automatically via the existing workflow.

### Step 5 — Test it
Open your GitHub Pages site, upload a short test video (under a minute) or
paste a direct video file URL, and confirm you see real progress updates and
a downloadable clip at the end. If something fails, the error message shown
in the UI comes directly from the backend — it will tell you what's wrong
(missing key, bad file type, etc.) rather than silently succeeding.

**I have not deployed this for you and cannot confirm it works until you
run through these steps and test it yourself.**
