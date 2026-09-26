# Accounting Mastery Upgrade Plan

This repository is being upgraded progressively. Existing browser progress remains on the same localStorage key: `accounting-mastery-hub-v1`.

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
Next
- “I don’t understand this question” guided flow
- Advanced Theory Trainer
- Exam Answer Space mode
- Exam English
- Guess / IDK system

### Phase 3 — Revision intelligence
Planned
- Smart Mistake Bank
- Automatic Revision Queue
- My Exam Answer Bank
- AI Tutor context actions

### Phase 4 — Exam system
Planned
- Past Paper Question Library
- Paper 1 / Paper 2 Exam Mode
- Mark Scheme Comparison
- AO1 / AO2 / AO3 tracking

### Phase 5 — Analytics
Planned
- Readiness components
- Weakness heatmap
- Real-data charts
- Skills radar
- Score progression

### Phase 6 — Visual upgrades
Planned
- Journey to Exam
- Study calendar heatmap
- 24-module mastery map
- Paper cards
- Accounting learning diagrams
- Achievements
- Completion animations
- Improved accounting-specific hero

## Data migration

The application version is incremented without changing the localStorage key. Older saved states are merged into the new defaults. Existing checklist booleans remain supported, and new per-skill states are derived from them so old progress is not lost.
