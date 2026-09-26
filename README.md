# Accounting Mastery Hub v1.2

## What changed in v1.2

- Every syllabus module now contains **individual tickable skills/checkpoints**.
- Partial learning counts as partial syllabus progress instead of forcing a whole module to Done.
- Example: Control Accounts separately tracks purpose, trade receivables control account preparation, and trade payables control account preparation.
- Paper 1, Paper 2, topic and overall completion percentages now calculate from the individual checklist items.
- Old v1/v1.1 backups migrate safely: modules previously marked Completed/Mastered are treated as having all their checklist skills completed.
- The clean white v1.1 interface and exam countdown remain.

A simplified, white-theme standalone personal study application for **Pearson Edexcel International GCSE (9–1) Accounting 4AC1**.

## v1.1 simplification update

- Prominent Paper 1 / Paper 2 exam countdown on the Home page
- Cleaner white-first visual design
- Simplified Home page focused on countdown, progress, next lesson and today's revision
- Essential navigation shown first; advanced features moved under **More tools**
- All previous study data and progress logic remain compatible

## Built and verified in this package

- Complete five-topic Pearson syllabus represented as 24 trackable modules
- Internal 100% study-weight tracker
- Separate Paper 1 / Paper 2 coverage and mastery
- Not Started / Learning / Completed / Mastered / Weak states
- Confidence tracking
- Practice question bank with MCQ, calculation and theory samples
- Automatic Mistake Bank with repeated-success resolution
- 1 / 3 / 7 / 14 / 30-day spaced revision scheduling
- Theory Answer Builder
- Notes
- Analytics and a clearly-labelled internal exam-readiness metric
- Mini mock mode
- Quick Revision mode
- Study-session planner and streak
- Progress history and achievements
- Search across modules, questions and notes
- Profile/settings, clean white theme, compact mode, Learning/Exam mode
- English + Bangla support for the fully-authored local lesson examples
- Browser localStorage persistence
- JSON backup export/import
- Provider-agnostic AI Tutor architecture with no exposed API keys
- Responsive desktop/mobile design

## Official vs internal numbers

Pearson officially allocates **100 marks to Paper 1** and **50 marks to Paper 2**. The per-module percentages in the app are internal study weights only. They are never presented as guaranteed topic marks.

## Fastest way to use it as a real website

Use the pre-built `Accounting-Mastery-Hub-Deploy.zip` and Vercel Drop. See `DEPLOYMENT.md` for click-by-click instructions.

## Source structure

- `src/types.ts` — data types
- `src/data.ts` — syllabus, sample questions and authored lessons
- `src/utils.ts` — progress/readiness calculations
- `src/store.ts` — persistent localStorage state, revisions, mistakes, notes, backups
- `src/ai.ts` — provider-agnostic AI service layer
- `src/app.ts` — responsive application UI and interactions
- `styles.css` — responsive theme and layout
- `tests/progress.test.mjs` — progress logic tests

## Rebuild from source

The project intentionally has **no runtime npm dependencies**. The compiled deployable site is already included in `dist/`.

If editing the TypeScript source, install TypeScript and run:

```bash
npm run build
npm run test:logic
```

## Local data

The browser storage key is `accounting-mastery-hub-v1`. Export a JSON backup before clearing browser data or moving to another device.

## AI Tutor security

The frontend contains no real secret API key. Connect a future AI provider through a secure server-side endpoint that implements the provider interface in `src/ai.ts`.

## v1.2.2
- Robust fix for syllabus checklist text wrapping: checklist rows now use flexbox and full-width text.
