# Accounting Mastery Upgrade Plan

This repository is upgraded progressively while preserving the same browser progress key: `accounting-mastery-hub-v1`.

## Non-negotiable rules

- Preserve existing progress, checklists, attempts, mistakes, notes, revisions, profile, settings and history.
- Keep Pearson Edexcel International GCSE Accounting 4AC1 terminology and scope.
- Never label generated material as an official Pearson past-paper question.
- Never present a suggested mark breakdown as an official Pearson mark scheme unless an official source is available.
- Keep the premium blue/purple V3 visual identity and improve it rather than replacing it.

## Phase status

### Phase 1 — Foundation
Status: implemented
- Backward-compatible data model migration
- Per-skill state foundation while retaining existing boolean checklist compatibility
- Metadata foundations for confidence, guessing/IDK, difficulty mode, AO data, mistake detail, answer bank, mock results, study activity and achievements
- Reusable responsive visual primitives
- Existing localStorage key preserved

### Phase 2 — Core learning improvements
Status: implemented
- “I don’t understand this question” guided flow with staged help before answer reveal
- Advanced Theory Trainer with meaning, relevant information, possible points, answer analysis and improved response
- Exam Answer Space mode for concise answers
- Exam English command-word trainer and mini quiz
- Guess / IDK and confidence tracking for practice questions
- Easy / Normal / Hard / Brutal practice modes mapped to the current in-syllabus question bank
- Result cards with answer, reason, confidence and a short memory rule

### Phase 3 — Revision intelligence
Status: implemented
- Smart Mistake Bank with richer context and filtering
- Automatic revision priority queue using weak areas, mistakes, due revisions, confidence and performance
- My Exam Answer Bank with search, favourites, learned/revise states and personal answers
- One-click tutor context handoff and quick coaching actions
- External live AI provider is still optional and is not falsely represented as connected

### Phase 4 — Exam system
Status: implemented
- Searchable question library using the project question bank
- Clear source labels so generated/style questions are not falsely presented as official Pearson questions
- Paper 1 / Paper 2 timed practice mode
- Question navigation, flags, unanswered warning, progress bar, submit confirmation and result report
- Paper summary cards with official paper durations/marks already used by this project
- Mark Scheme Comparison view for theory answers, clearly labelled as suggested analysis unless an official mark scheme is available
- Internal AO1 / AO2 / AO3 performance tracking from stored attempts

### Phase 5 — Analytics
Status: implemented
- Multi-component internal Exam Readiness dashboard
- Weakness heatmap with multiple views
- Real-data mock trend, topic accuracy, mastery breakdown, paper comparison, accuracy trend and study-time charts
- Accounting skills radar
- Score-improvement views where repeated attempt data exists
- Empty states instead of fake chart data

### Phase 6 — Visual upgrades
Status: implemented
- Journey to Exam visual path
- Study calendar heatmap with month navigation and streak information
- 24-module mastery map
- Premium Paper 1 / Paper 2 cards
- Accounting learning diagrams for key topics such as double entry, control accounts, bank reconciliation, depreciation, financial statements and partnerships
- Achievement / trophy cabinet
- Subtle completion celebration animation with reduced-motion support
- Weak-topic cards, revision priority graphics and upgraded result/report visuals
- Existing premium accounting hero retained

## Data migration

The application version was incremented without changing the localStorage key. Older saved states are merged into the new defaults. Existing checklist booleans remain supported, and new per-skill states are derived from them so old progress is not lost.

## Accuracy / source labelling

The website must distinguish official Pearson material from Pearson-style or AI-generated practice. Internal readiness, AO and performance analytics are study metrics and must not be described as official predicted grades or official Pearson mark allocations.
