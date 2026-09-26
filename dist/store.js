import { moduleChecklists, modules, questions } from './data.js';
import { addDays, today, uid } from './utils.js';
export const STORAGE_KEY = 'accounting-mastery-hub-v1';
export const APP_VERSION = 2;
let state;
let subscribers = [];
function checklistTemplate(moduleId, fill = false) { const items = moduleChecklists[moduleId] ?? modules.find(m => m.id === moduleId)?.officialPoints ?? []; return Object.fromEntries(items.map((_, i) => [`c${i}`, fill])); }
function defaultProgress() { return Object.fromEntries(modules.map(m => [m.id, { status: 'not-started', confidence: 3, masteryScore: 0, questionsAttempted: 0, questionsCorrect: 0, weakSubtopics: [], checklist: checklistTemplate(m.id) }])); }
export function createDefaultState() { return { version: APP_VERSION, progress: defaultProgress(), attempts: [], mistakes: [], revisions: [], notes: [], history: [], profile: { name: 'Student', targetGrade: '9', examDatePaper1: '2026-10-28', examDatePaper2: '2026-11-05', dailyStudyMinutes: 60, preferredLessonStyle: 'exam-focused', preferredLanguage: 'english' }, settings: { theme: 'light', compact: false, mode: 'learning', language: 'english', fontScale: 'normal', reducedMotion: false }, studyMinutesTotal: 0, studyDays: [] }; }
function merge(partial) {
    const base = createDefaultState();
    const valid = new Set(['not-started', 'learning', 'completed', 'mastered', 'weak']);
    const progress = { ...base.progress };
    for (const m of modules) {
        const p = partial.progress?.[m.id];
        if (!p)
            continue;
        const legacyCompleted = (p.status === 'completed' || p.status === 'mastered') && !('checklist' in p);
        const template = checklistTemplate(m.id, legacyCompleted);
        const incoming = p.checklist ?? {};
        const checklist = Object.fromEntries(Object.keys(template).map(k => [k, typeof incoming[k] === 'boolean' ? incoming[k] : template[k]]));
        const values = Object.values(checklist), all = values.length > 0 && values.every(Boolean), some = values.some(Boolean);
        let status = valid.has(p.status) ? p.status : 'not-started';
        if (status !== 'weak') {
            if (all && status !== 'mastered')
                status = 'completed';
            else if (!all && status === 'mastered')
                status = some ? 'learning' : 'not-started';
            else if (!all && status === 'completed')
                status = some ? 'learning' : 'not-started';
            else if (some && status === 'not-started')
                status = 'learning';
        }
        progress[m.id] = { ...base.progress[m.id], ...p, status: status, confidence: Math.max(1, Math.min(5, Number(p.confidence) || 3)), masteryScore: Math.max(0, Math.min(100, Number(p.masteryScore) || 0)), checklist };
    }
    return { ...base, ...partial, version: APP_VERSION, progress, attempts: Array.isArray(partial.attempts) ? partial.attempts : [], mistakes: Array.isArray(partial.mistakes) ? partial.mistakes : [], revisions: Array.isArray(partial.revisions) ? partial.revisions : [], notes: Array.isArray(partial.notes) ? partial.notes : [], history: Array.isArray(partial.history) ? partial.history : [], studyDays: Array.isArray(partial.studyDays) ? partial.studyDays : [], profile: { ...base.profile, ...(partial.profile ?? {}) }, settings: { ...base.settings, ...(partial.settings ?? {}) } };
}
function load() { try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? merge(JSON.parse(raw)) : createDefaultState();
}
catch {
    return createDefaultState();
} }
export function initStore() { state = load(); applySettings(); }
export function getState() { return state; }
export function subscribe(fn) { subscribers.push(fn); return () => { subscribers = subscribers.filter(x => x !== fn); }; }
function commit(next) { state = next; localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); applySettings(); subscribers.forEach(fn => fn()); }
function applySettings() { if (!state)
    return; document.documentElement.classList.remove('dark'); document.documentElement.dataset.fontScale = state.settings.fontScale; document.documentElement.dataset.compact = String(state.settings.compact); document.documentElement.dataset.reducedMotion = String(state.settings.reducedMotion); }
function scheduleRevisions(moduleId, oldStatus, newStatus, revisions = state.revisions) {
    const next = [...revisions];
    if ((newStatus === 'completed' || newStatus === 'mastered') && !(oldStatus === 'completed' || oldStatus === 'mastered')) {
        const now = today(), existing = new Set(next.filter(r => r.moduleId === moduleId && !r.completedDate).map(r => r.intervalDays));
        [1, 3, 7, 14, 30].forEach(interval => { if (!existing.has(interval))
            next.push({ id: uid(), moduleId, dueDate: addDays(now, interval), intervalDays: interval }); });
    }
    return next;
}
export function setModuleStatus(moduleId, status) {
    const current = state.progress[moduleId];
    if (!current)
        return;
    const old = current.status;
    if (old === status)
        return;
    let checklist = { ...current.checklist };
    if (status === 'completed' || status === 'mastered')
        checklist = checklistTemplate(moduleId, true);
    if (status === 'not-started')
        checklist = checklistTemplate(moduleId, false);
    const now = today();
    const progress = { ...state.progress, [moduleId]: { ...current, status, lastStudied: now, checklist } };
    const revisions = scheduleRevisions(moduleId, old, status);
    const m = modules.find(x => x.id === moduleId);
    commit({ ...state, progress, revisions, history: [{ id: uid(), date: new Date().toISOString(), type: 'status', title: `${m?.name ?? moduleId}: ${status}`, detail: `Status changed from ${old} to ${status}.`, moduleId }, ...state.history].slice(0, 500), studyDays: Array.from(new Set([...state.studyDays, now])) });
}
export function setChecklistItem(moduleId, itemKey, done) {
    const current = state.progress[moduleId];
    if (!current || !(itemKey in current.checklist))
        return;
    const checklist = { ...current.checklist, [itemKey]: done };
    const values = Object.values(checklist), all = values.length > 0 && values.every(Boolean), some = values.some(Boolean);
    let status = current.status;
    if (status !== 'weak') {
        if (all)
            status = current.status === 'mastered' ? 'mastered' : 'completed';
        else if (some)
            status = 'learning';
        else
            status = 'not-started';
    }
    const now = today(), revisions = scheduleRevisions(moduleId, current.status, status);
    const m = modules.find(x => x.id === moduleId), index = Number(itemKey.replace('c', '')), label = (moduleChecklists[moduleId] ?? m?.officialPoints ?? [])[index] ?? 'Syllabus item';
    const progress = { ...state.progress, [moduleId]: { ...current, checklist, status, lastStudied: now } };
    commit({ ...state, progress, revisions, history: [{ id: uid(), date: new Date().toISOString(), type: 'status', title: `${m?.name ?? moduleId}: ${done ? 'checkpoint completed' : 'checkpoint reopened'}`, detail: `${label}.`, moduleId }, ...state.history].slice(0, 500), studyDays: Array.from(new Set([...state.studyDays, now])) });
}
export function setConfidence(moduleId, confidence) { commit({ ...state, progress: { ...state.progress, [moduleId]: { ...state.progress[moduleId], confidence: Math.max(1, Math.min(5, confidence)), lastStudied: today() } } }); }
export function recordAttempt(questionId, userAnswer, correct, mistakeType = 'unclassified') { const q = questions.find(x => x.id === questionId); if (!q)
    return; const now = new Date().toISOString(); const p = state.progress[q.moduleId]; const attempted = p.questionsAttempted + 1, correctCount = p.questionsCorrect + (correct ? 1 : 0); const rate = Math.round(correctCount / attempted * 100); const progress = { ...state.progress, [q.moduleId]: { ...p, questionsAttempted: attempted, questionsCorrect: correctCount, lastTested: today(), masteryScore: Math.max(p.masteryScore, rate) } }; let mistakes = [...state.mistakes]; const idx = mistakes.findIndex(m => m.questionId === questionId && !m.resolved); if (!correct) {
    if (idx >= 0)
        mistakes[idx] = { ...mistakes[idx], date: now, userAnswer, timesWrong: mistakes[idx].timesWrong + 1, correctStreak: 0, mistakeType };
    else
        mistakes.unshift({ id: uid(), questionId, moduleId: q.moduleId, date: now, userAnswer, correctAnswer: q.answer, explanation: q.explanation, mistakeType, timesWrong: 1, resolved: false, correctStreak: 0 });
    progress[q.moduleId] = { ...progress[q.moduleId], status: 'weak' };
}
else if (idx >= 0) {
    const streak = mistakes[idx].correctStreak + 1;
    mistakes[idx] = { ...mistakes[idx], correctStreak: streak, resolved: streak >= 2 };
} commit({ ...state, progress, attempts: [{ id: uid(), questionId, moduleId: q.moduleId, date: now, userAnswer, correct, score: correct ? q.marks : 0, maxScore: q.marks, mistakeType }, ...state.attempts].slice(0, 2000), mistakes, history: [{ id: uid(), date: now, type: 'practice', title: `Practice: ${correct ? 'Correct' : 'Needs review'}`, detail: `${q.question} — ${correct ? 'correct' : 'incorrect'}.`, moduleId: q.moduleId }, ...state.history].slice(0, 500), studyDays: Array.from(new Set([...state.studyDays, today()])) }); }
export function classifyMistake(id, type) { commit({ ...state, mistakes: state.mistakes.map(m => m.id === id ? { ...m, mistakeType: type } : m) }); }
export function completeRevision(id, score) { const r = state.revisions.find(x => x.id === id); if (!r)
    return; const m = modules.find(x => x.id === r.moduleId); commit({ ...state, revisions: state.revisions.map(x => x.id === id ? { ...x, completedDate: today(), score } : x), history: [{ id: uid(), date: new Date().toISOString(), type: 'revision', title: `Revision completed: ${m?.name ?? r.moduleId}`, detail: `${r.intervalDays}-day review${score != null ? ` • ${score}%` : ''}.`, moduleId: r.moduleId }, ...state.history].slice(0, 500), studyDays: Array.from(new Set([...state.studyDays, today()])) }); }
export function addNote(note) { const n = { ...note, id: uid(), updatedAt: new Date().toISOString() }; commit({ ...state, notes: [n, ...state.notes], history: [{ id: uid(), date: n.updatedAt, type: 'note', title: `Note: ${n.title}`, detail: 'Note created.', moduleId: n.moduleId }, ...state.history].slice(0, 500) }); }
export function toggleStarNote(id) { commit({ ...state, notes: state.notes.map(n => n.id === id ? { ...n, starred: !n.starred, updatedAt: new Date().toISOString() } : n) }); }
export function deleteNote(id) { commit({ ...state, notes: state.notes.filter(n => n.id !== id) }); }
export function updateProfile(patch) { commit({ ...state, profile: { ...state.profile, ...patch }, history: [{ id: uid(), date: new Date().toISOString(), type: 'profile', title: 'Profile updated', detail: 'Study profile settings were updated.' }, ...state.history].slice(0, 500) }); }
export function updateSettings(patch) { commit({ ...state, settings: { ...state.settings, ...patch } }); }
export function addStudyMinutes(minutes) { if (!Number.isFinite(minutes) || minutes <= 0)
    return; commit({ ...state, studyMinutesTotal: state.studyMinutesTotal + Math.round(minutes), studyDays: Array.from(new Set([...state.studyDays, today()])) }); }
export function exportBackup() { return JSON.stringify(state, null, 2); }
export function restoreBackup(raw) { const parsed = JSON.parse(raw); if (!parsed || typeof parsed !== 'object')
    throw new Error('Invalid backup file.'); commit(merge(parsed)); }
export function resetState() { commit(createDefaultState()); }
