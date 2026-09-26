# Update your already-deployed website to v1.1

## Before updating

Open the current website and use **Settings → Export backup**. Keep that JSON file somewhere safe.

If you deploy the update at the same website origin, browser localStorage normally remains available. If you receive a new website URL, use **Settings → Import backup** on the new site.

## What changed

- White-first theme
- Much simpler Home page
- Large Paper 1 countdown at the top
- Paper 2 countdown beside it
- Core navigation shown first
- Extra tools hidden under “More tools”
- Existing syllabus, progress, practice, mistakes, revision, theory, analytics, notes and AI architecture retained

## Vercel Drop note

Vercel Drop creates a new project for each new drop. So dragging this updated ZIP into Vercel Drop gives you an updated site, but normally a new project/link.

If you just want the easiest update, deploy the new ZIP and bookmark the new URL. Then import your JSON backup if needed.

If keeping the exact same Vercel URL is important, the project needs a normal Vercel update workflow (for example a connected Git repository or Vercel CLI).
