# Job Application Bot — personal use

Finds remote **customer support / telesales / collections** roles open to
candidates outside the US and Canada, filters out anything requiring US work
authorization, tailors a resume summary + note per job with Claude, and
auto-submits on **Greenhouse-hosted** postings only. Everything else is
logged as `skipped_manual_ats` instead of being force-filled blind. You get
one email per successful application.

Runs entirely on **GitHub Actions** (free), **Supabase** (free tier), and
**Resend** (free tier) — no Vercel needed, no paid plan required.

## One-time setup (~10 minutes)

1. **Database** — open your `job-application-bot` Supabase project → SQL
   Editor → paste in `migrations/001_init.sql` → Run.
2. **Push this code** to the empty GitHub repo you created:
   ```
   cd job-bot
   git init
   git add .
   git commit -m "initial setup"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/job-application-bot.git
   git push -u origin main
   ```
3. **Add secrets** — in the GitHub repo: Settings → Secrets and variables →
   Actions → New repository secret. Add all of these:
   - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` — Supabase project →
     Settings → API
   - `ANTHROPIC_API_KEY` — console.anthropic.com → API Keys (this is the one
     part that isn't fully free — pennies per day at this volume, but not
     literally $0)
   - `RESEND_API_KEY` — resend.com → API Keys
   - `NOTIFY_FROM_EMAIL` — must be a sender/domain verified in Resend
   - `NOTIFY_TO_EMAIL` — where you want the "Applied: X at Y" emails
4. Done. It runs daily at 07:00 UTC, or trigger a run immediately from the
   repo's **Actions** tab → "Job application bot" → **Run workflow**.

## How to stop it

Easiest: repo → **Actions** tab → "Job application bot" → **⋯** → **Disable
workflow**. One click, nothing runs again until you re-enable it.

Alternative: in Supabase SQL Editor, run
`update system_state set status = 'paused' where id = 1;` — the next
scheduled run will exit immediately without discovering or applying.

## What's real right now vs. what needs your first-run attention

- **Auto-submit currently covers Greenhouse only.** It's the most
  standardized ATS form structure, so it's the safest to fill without a
  human watching. Lever, Ashby, and custom company career pages get logged
  to `skipped_manual_ats` in the `applications` table instead of being
  guessed at — you can check that table periodically and apply to those
  by hand if you want them.
- **I could not test the Greenhouse auto-fill against a live form** — this
  sandbox can't reach greenhouse.io. The selectors are based on Greenhouse's
  standard, well-documented form structure, but the very first real run is
  the actual test. Worth checking the Actions log after day one.
- **The auth-question safety net matters**: if a Greenhouse posting slipped
  through filtering and turns out to ask a work-authorization question
  directly on the form, the bot aborts that one application rather than
  answering it — logged as `skipped_manual_ats`, not submitted.
- **Eligibility filtering**: Himalayas jobs use real structured location
  data (reliable). RemoteOK and We Work Remotely don't expose that, so
  those fall back to text-pattern screening, with a Claude call as a
  second opinion on ambiguous cases (capped at 15 per run to control cost).

## Files

- `src/sources/*.js` — Himalayas, RemoteOK, We Work Remotely fetchers
- `src/eligibility.js` — location/role filtering
- `src/tailor.js` — Claude calls for ambiguous-case eligibility + tailoring
- `src/submit.js` — ATS detection + Greenhouse auto-fill (Playwright)
- `src/notify.js` — Resend emails
- `src/db.js` — Supabase reads/writes
- `src/run.js` — orchestrates one full cycle
- `src/profile.json` — your structured CV data (customer support / telesales
  / collections only — IT experience intentionally excluded per your
  instruction)
- `src/resume.pdf` — your actual CV, uploaded as-is to each application
