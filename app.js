import { aiTutor } from './ai.js';
import { lessons, moduleChecklists, modules, questions, topics } from './data.js';
import { addNote, addStudyMinutes, classifyMistake, completeRevision, deleteNote, exportBackup, getState, initStore, recordAttempt, resetState, restoreBackup, setChecklistItem, setConfidence, setModuleStatus, subscribe, toggleStarNote, updateProfile, updateSettings } from './store.js';
import { accuracy, checklistStats, daysUntil, esc, examReadiness, masteryCompletion, moduleById, moduleChecklistComplete, normalizeAnswer, overallCompletion, paperCoverage, recommendedNext, today, topicCoverage } from './utils.js';
const root = document.getElementById('app');
if (!root)
    throw new Error('Missing #app root');
initStore();
const primaryNav = [
    ['dashboard', 'Home', '⌂'], ['today', "Today's Study", '◎'], ['syllabus', 'Syllabus', '☑'], ['learn', 'Learn', '▤'], ['practice', 'Practice', '?'], ['revision', 'Revision', '↻'],
];
const moreNav = [
    ['mistakes', 'Mistake Bank', '!'], ['theory', 'Theory Trainer', '✎'], ['mock', 'Mock Exams', '◫'], ['analytics', 'Analytics', '▥'], ['quick', 'Quick Revision', '⚡'], ['notes', 'Notes', '▧'], ['history', 'Progress History', '◷'], ['ai', 'AI Tutor', '✦'], ['profile', 'Profile', '◉'], ['settings', 'Settings', '⚙'],
];
const nav = [...primaryNav, ...moreNav];
let page = parsePage(location.hash);
let sidebarOpen = false;
let showMoreNav = false;
let searchQuery = '';
let toast = '';
let syllabusFilter = 'all';
let openTopics = new Set([1, 2, 3, 4, 5]);
let learnModuleId = '1.2';
let practicePaper = 'all', practiceType = 'all', practiceDifficulty = 'all', practiceModule = 'all', practiceIndex = 0, practiceAnswer = '', practiceResult = null, practiceMistake = 'unclassified';
let theoryIndex = 0, theoryAnswer = '', theoryAnalysed = false;
let quickModuleId = '2.5';
let sessionMinutes = 45;
let mockPaper = 'P1', mockStarted = false, mockSubmitted = false, mockAnswers = {};
let aiModuleId = '1.2', aiRequest = 'Explain this topic simply and give me one exam trap.', aiResponse = '', aiLoading = false;
const theorySamples = [
    { q: 'Explain why a business maintains control accounts.', marks: 4, focus: 'Purpose of control accounts', points: ['Independent check on personal ledgers', 'Helps locate errors', 'Quick total receivables/payables figures'] },
    { q: 'Advise a business whether it should computerise its accounting system.', marks: 5, focus: 'Manual → computerised accounting', points: ['Faster processing', 'Automatic calculations', 'Improved reporting', 'Cost, training and security risks'] },
    { q: 'Evaluate the effect of changing from straight-line to reducing-balance depreciation.', marks: 5, focus: 'Change depreciation method', points: ['Different timing of depreciation expense', 'Different carrying values', 'Effect on profit varies by year', 'Consistency and suitability matter'] },
];
const banglaSummaries = {
    '1.2': 'এই topic-এ ৬টি concept মনে রাখুন: Consistency, Prudence, Accruals, Materiality, Money measurement, Business entity। Exam-এ শুধু নাম লিখলে হবে না—scenario-এর সাথে concept-এর সম্পর্ক explain করতে হবে।',
    '2.4': 'Capital expenditure সাধারণত non-current asset কেনা বা improve করার খরচ। Revenue expenditure হলো day-to-day running, repair বা maintenance-এর খরচ। ভুল classification করলে profit এবং assets দুটোই ভুল হতে পারে।',
    '2.5': 'Straight line-এ depreciation সাধারণত প্রতি বছর একই থাকে। Reducing balance-এ opening carrying value-এর উপর percentage বসে, তাই amount কমতে থাকে। Disposal-এ proceeds-এর সাথে carrying value compare করুন।',
    '3.2': 'Receivables control account = customers আমাদের কাছে কত owe করে তার summary। Payables control account = আমরা suppliers-কে কত owe করি তার summary। এগুলো error check করতেও সাহায্য করে।',
    '3.3': 'সব error trial balance-কে disagree করায় না। Suspense account শুধু temporary—trial balance difference থাকলে ব্যবহার হয় এবং relevant errors correct হলে close হওয়া উচিত।',
    '3.4': 'Bank reconciliation-এর আগে cash book update করুন bank-originated items দিয়ে। তারপর timing differences যেমন unpresented cheque reconciliation statement-এ নিন।',
};
function parsePage(hash) { const x = hash.replace('#', ''); return nav.some(n => n[0] === x) ? x : 'dashboard'; }
window.addEventListener('hashchange', () => { page = parsePage(location.hash); sidebarOpen = false; render(); });
subscribe(render);
function hProgress(value, label) { return `<div class="progress-wrap">${label ? `<div class="progress-label"><span>${esc(label)}</span><b>${value}%</b></div>` : ''}<div class="progress"><span style="width:${Math.max(0, Math.min(100, value))}%"></span></div></div>`; }
function badge(status) { const labels = { 'not-started': 'Not started', 'learning': 'Learning', 'completed': 'Completed', 'mastered': 'Mastered', 'weak': 'Weak / revise' }; return `<span class="badge badge-${status}">${labels[status]}</span>`; }
function card(content, cls = '') { return `<section class="card ${cls}">${content}</section>`; }
function button(label, action, variant = 'primary', extra = '') { return `<button class="btn btn-${variant}" data-action="${action}" ${extra}>${label}</button>`; }
function stat(label, value, detail, icon = '') { return card(`<div class="stat"><div><div class="eyebrow">${esc(label)}</div><div class="stat-value">${esc(value)}</div><div class="muted">${esc(detail)}</div></div><div class="stat-icon">${icon}</div></div>`); }
function selectOptions(items, value) { return items.map(([v, l]) => `<option value="${v}" ${v === value ? 'selected' : ''}>${esc(l)}</option>`).join(''); }
function empty(title, body) { return `<div class="empty"><h3>${esc(title)}</h3><p>${esc(body)}</p></div>`; }
function formatDate(value) { try {
    return new Date(value).toLocaleString();
}
catch {
    return value;
} }
function streak() { const days = [...getState().studyDays].sort(); if (!days.length)
    return 0; let count = 0; const d = new Date(); for (let i = 0; i < 365; i++) {
    const s = d.toISOString().slice(0, 10);
    if (days.includes(s))
        count++;
    else if (i > 0)
        break;
    d.setDate(d.getDate() - 1);
} return count; }
function showToast(message) { toast = message; render(); setTimeout(() => { if (toast === message) {
    toast = '';
    render();
} }, 2400); }
function render() {
    const state = getState();
    const itemHtml = ([key, label, icon]) => `<a href="#${key}" class="nav-item ${page === key ? 'active' : ''}" data-nav="${key}"><span class="nav-icon">${icon}</span><span>${label}</span></a>`;
    const primaryHtml = primaryNav.map(itemHtml).join('');
    const moreVisible = showMoreNav || moreNav.some(([key]) => page === key);
    const moreHtml = moreNav.map(itemHtml).join('');
    root.innerHTML = `
    <div class="app-shell">
      <header class="mobile-header"><button class="icon-btn" data-action="open-sidebar" aria-label="Open navigation">☰</button><div><b>Accounting Mastery Hub</b><small>4AC1 • Nov 2026</small></div><span></span></header>
      <aside class="sidebar ${sidebarOpen ? 'open' : ''}">
        <div class="brand"><div class="brand-mark">A</div><div><strong>Accounting Mastery</strong><small>Edexcel 4AC1 • Nov 2026</small></div><button class="sidebar-close" data-action="close-sidebar" aria-label="Close navigation">×</button></div>
        <form id="search-form" class="search-box"><input id="global-search" value="${esc(searchQuery)}" placeholder="Search syllabus, notes, questions" aria-label="Search"/><button aria-label="Search">⌕</button></form>
        <nav>${primaryHtml}<div class="nav-divider"></div><button class="nav-more-toggle" type="button" data-action="toggle-more-nav" aria-expanded="${moreVisible}"><span>More tools</span><span>${moreVisible ? '−' : '+'}</span></button><div class="nav-more ${moreVisible ? 'show' : ''}">${moreHtml}</div></nav>
        <div class="sidebar-foot"><span>${state.settings.mode === 'learning' ? 'Learning' : 'Exam'} mode</span><small>Progress saves in this browser.</small></div>
      </aside>
      ${sidebarOpen ? '<button class="backdrop" data-action="close-sidebar" aria-label="Close navigation"></button>' : ''}
      <main class="main"><div class="content">${searchQuery ? renderSearch(searchQuery) : ''}${renderPage()}</div></main>
      ${toast ? `<div class="toast" role="status">${esc(toast)}</div>` : ''}
    </div>`;
    wire();
}
function renderPage() { switch (page) {
    case 'dashboard': return renderDashboard();
    case 'today': return renderToday();
    case 'syllabus': return renderSyllabus();
    case 'learn': return renderLearn();
    case 'practice': return renderPractice();
    case 'mistakes': return renderMistakes();
    case 'revision': return renderRevision();
    case 'theory': return renderTheory();
    case 'mock': return renderMock();
    case 'analytics': return renderAnalytics();
    case 'quick': return renderQuick();
    case 'notes': return renderNotes();
    case 'history': return renderHistory();
    case 'ai': return renderAi();
    case 'profile': return renderProfile();
    case 'settings': return renderSettings();
} }
function renderSearch(query) { const q = query.toLowerCase(); const ms = modules.filter(m => `${m.name} ${m.focus} ${m.officialPoints.join(' ')}`.toLowerCase().includes(q)).slice(0, 5); const qs = questions.filter(x => `${x.question} ${x.explanation} ${x.tags.join(' ')}`.toLowerCase().includes(q)).slice(0, 5); const ns = getState().notes.filter(n => `${n.title} ${n.body}`.toLowerCase().includes(q)).slice(0, 5); return card(`<div class="row-between"><div><div class="eyebrow">SEARCH RESULTS</div><h2>“${esc(query)}”</h2></div><button class="icon-btn" data-action="clear-search" aria-label="Clear search">×</button></div><div class="search-results">${ms.map(m => `<button data-action="open-learn-module" data-module="${m.id}"><b>${m.code} ${esc(m.name)}</b><span>Syllabus module</span></button>`).join('')}${qs.map(x => `<button data-action="open-practice-question" data-question="${x.id}"><b>${esc(x.question)}</b><span>Practice question</span></button>`).join('')}${ns.map(n => `<a href="#notes"><b>${esc(n.title)}</b><span>Personal note</span></a>`).join('')}${!ms.length && !qs.length && !ns.length ? '<p class="muted">No matching syllabus items, questions or notes.</p>' : ''}</div>`, 'search-panel'); }
function renderDashboard() {
    const s = getState();
    const completion = overallCompletion(s.progress), mastery = masteryCompletion(s.progress), readiness = examReadiness(s), next = recommendedNext(s.progress);
    const done = modules.filter(m => moduleChecklistComplete(s.progress, m.id)).length, mastered = modules.filter(m => s.progress[m.id].status === 'mastered').length;
    const due = s.revisions.filter(r => !r.completedDate && r.dueDate <= today()).length;
    const p1Days = daysUntil(s.profile.examDatePaper1), p2Days = daysUntil(s.profile.examDatePaper2);
    return `<div class="simple-home">
    <div class="page-head simple-head"><div><div class="eyebrow blue">EDEXCEL IGCSE ACCOUNTING 4AC1</div><h1>Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, ${esc(s.profile.name)}.</h1><p>One clear plan: finish the syllabus, revise it, then master exam questions.</p></div></div>

    <section class="exam-hero">
      <div class="exam-main"><div class="eyebrow">NEXT EXAM • PAPER 1</div><div class="days-big">${p1Days}</div><div class="days-label">days remaining</div><div class="exam-date">Wednesday, 28 October 2026 • Morning • 100 marks • 2 hours</div></div>
      <div class="exam-secondary"><span>Paper 2</span><b>${p2Days} days</b><small>Thursday, 5 November 2026 • Morning • 50 marks</small></div>
    </section>

    <div class="simple-stats">
      ${card(`<div class="simple-stat"><div><div class="eyebrow">SYLLABUS</div><div class="stat-value">${completion}%</div><p>${100 - completion}% remaining • ${done}/24 modules completed</p></div>${hProgress(completion)}</div>`)}
      ${card(`<div class="simple-stat"><div><div class="eyebrow">PAPER 1 COVERAGE</div><div class="stat-value">${paperCoverage(s.progress, 'P1')}%</div><p>Topics 1–3 • 100 official marks</p></div>${hProgress(paperCoverage(s.progress, 'P1'))}</div>`)}
      ${card(`<div class="simple-stat"><div><div class="eyebrow">PAPER 2 CORE</div><div class="stat-value">${paperCoverage(s.progress, 'P2')}%</div><p>Topics 4–5 • 50 official marks</p></div>${hProgress(paperCoverage(s.progress, 'P2'))}</div>`)}
    </div>

    <div class="grid-two simple-grid">
      ${card(`<div class="row-between"><div><div class="eyebrow blue">WHAT TO STUDY NEXT</div><h2>${next ? `${next.code} ${esc(next.name)}` : 'Syllabus teaching complete'}</h2></div>${next ? badge(s.progress[next.id].status) : ''}</div>${next ? `<p class="muted">${esc(next.focus)}</p><div class="button-row"><button class="btn btn-primary" data-action="open-learn-module" data-module="${next.id}">Start this lesson</button><a class="btn btn-secondary" href="#syllabus">See syllabus</a></div>` : `<p class="muted">Focus on weak topics, revision and full exam practice.</p><a class="btn btn-primary" href="#practice">Start practice</a>`}`)}
      ${card(`<div class="eyebrow blue">TODAY</div><h2>${due ? `${due} revision${due === 1 ? '' : 's'} due` : 'No revision overdue'}</h2><p class="muted">${due ? 'Clear your due reviews first, then continue your next syllabus module.' : 'Continue your next lesson or do a short practice set.'}</p><div class="button-row"><a class="btn btn-primary" href="#today">Open today’s plan</a>${due ? '<a class="btn btn-secondary" href="#revision">Revision list</a>' : ''}</div>`)}
    </div>

    <div class="home-quick">
      <a href="#syllabus"><span>☑</span><b>Syllabus</b><small>See what is done and left</small></a>
      <a href="#learn"><span>▤</span><b>Learn</b><small>Study one module</small></a>
      <a href="#practice"><span>?</span><b>Practice</b><small>Answer exam questions</small></a>
      <a href="#revision"><span>↻</span><b>Revision</b><small>Review completed topics</small></a>
    </div>

    <div class="home-note"><b>Mastery:</b> ${mastered}/24 modules • ${mastery}% weighted mastery. <b>Exam readiness:</b> ${readiness}% — an internal study metric, not an official predicted grade. <a href="#analytics">View details</a></div>
  </div>`;
}
function renderToday() { const s = getState(), due = s.revisions.filter(r => !r.completedDate && r.dueDate <= today()), weak = modules.filter(m => s.progress[m.id].status === 'weak'), next = recommendedNext(s.progress); let left = sessionMinutes; const blocks = []; if (due.length && left >= 10) {
    const x = Math.min(15, left);
    blocks.push(['Spaced revision', x, `Review ${Math.min(due.length, 2)} due module${due.length > 1 ? 's' : ''}.`, '↻']);
    left -= x;
} if (weak.length && left >= 10) {
    const x = Math.min(15, left);
    blocks.push(['Weak-area repair', x, `Focus on ${weak[0].name}.`, '!']);
    left -= x;
} if (next && left >= 10) {
    const x = Math.max(10, Math.min(Math.round(left * .55), 30));
    blocks.push(['Current syllabus progress', x, `Learn/practise ${next.code} ${next.name}.`, '▤']);
    left -= x;
} if (left > 0)
    blocks.push(['Exam-style questions', left, 'Finish with questions and log mistakes.', '?']); return `<div class="page-head"><div><div class="eyebrow blue">TODAY'S STUDY</div><h1>A realistic session, not an impossible checklist</h1><p>Choose your time. The plan prioritises due revision, weak topics and current syllabus progress.</p></div></div>${card(`<div class="form-row"><label>Session length<select id="session-minutes">${[15, 30, 45, 60, 90].map(x => `<option value="${x}" ${x === sessionMinutes ? 'selected' : ''}>${x} minutes</option>`).join('')}</select></label>${button('Log this study session', 'log-session')}</div>`)}<div class="grid-two">${blocks.map((b, i) => card(`<div class="study-block"><div class="study-icon">${b[3]}</div><div><div class="eyebrow">BLOCK ${i + 1} • ${b[1]} MIN</div><h2>${b[0]}</h2><p>${esc(b[2])}</p></div></div>`)).join('')}</div>${card(`<h2>Daily rule</h2><p>End every session by answering something without looking. Retrieval practice is more useful than rereading alone.</p>`)}`; }
function renderChecklist(moduleId, compact = false) {
    const s = getState(), m = moduleById(moduleId);
    if (!m)
        return '';
    const items = moduleChecklists[moduleId] ?? m.officialPoints, stats = checklistStats(s.progress, moduleId), checks = s.progress[moduleId].checklist;
    return `<div class="syllabus-checklist ${compact ? 'compact' : ''}"><div class="checklist-head"><div><b>${stats.completed}/${stats.total} syllabus skills completed</b><small>${stats.percent}% of this module • ${m.studyWeight}% total study weight</small></div><strong>${stats.percent}%</strong></div>${hProgress(stats.percent)}<div class="checklist-items">${items.map((item, i) => `<label class="check-item ${checks[`c${i}`] ? 'checked' : ''}"><input type="checkbox" data-checklist-module="${m.id}" data-checklist-key="c${i}" ${checks[`c${i}`] ? 'checked' : ''}><span class="check-box" aria-hidden="true">${checks[`c${i}`] ? '✓' : ''}</span><span>${esc(item)}</span></label>`).join('')}</div></div>`;
}
function renderSyllabus() {
    const s = getState(), shown = modules.filter(m => syllabusFilter === 'all' || m.paper === syllabusFilter || (syllabusFilter === 'remaining' && !moduleChecklistComplete(s.progress, m.id)));
    return `<div class="page-head"><div><div class="eyebrow blue">MASTER CHECKLIST</div><h1>Complete Edexcel 4AC1 syllabus</h1><p>Tick the exact skill you have learned. Partial ticks count as partial syllabus progress, so a module no longer has to be all-or-nothing.</p></div></div><div class="info-banner"><b>Example:</b> if you can prepare control accounts but have not learned their purpose, tick only the preparation skills. The module stays Learning until all its syllabus skills are complete.</div><div class="tabs">${['all', 'P1', 'P2', 'remaining'].map(x => `<button class="${syllabusFilter === x ? 'active' : ''}" data-filter-syllabus="${x}">${x === 'all' ? 'All' : x === 'remaining' ? 'Remaining' : x === 'P1' ? 'Paper 1' : 'Paper 2'}</button>`).join('')}</div><div class="stack">${topics.map(t => { const items = shown.filter(m => m.topicId === t.id); if (!items.length)
        return ''; const open = openTopics.has(t.id), tc = topicCoverage(s.progress, t.id); return card(`<button class="topic-head" data-toggle-topic="${t.id}"><div><div class="eyebrow blue">TOPIC ${t.id} • ${t.paper} • ${t.studyWeight}% STUDY WEIGHT</div><h2>${esc(t.name)} ${tc === 100 ? '✓' : ''}</h2>${hProgress(tc)}</div><div class="topic-percent">${tc}% ${open ? '⌃' : '⌄'}</div></button>${open ? `<div class="module-list">${items.map(m => { const p = s.progress[m.id], stats = checklistStats(s.progress, m.id); return `<div class="module-row module-row-checklist"><div class="module-main"><div class="module-title"><span>${m.code}</span><b>${esc(m.name)}</b>${badge(p.status)}</div><p>${esc(m.focus)}</p>${renderChecklist(m.id)}${m.prerequisites?.length ? `<div class="muted small">Prerequisites: ${m.prerequisites.join(', ')}</div>` : ''}</div><div class="module-controls"><label>Status<select data-status-module="${m.id}">${statusOptions(p.status)}</select></label><label>Confidence: <b>${p.confidence}/5</b><input data-confidence-module="${m.id}" type="range" min="1" max="5" value="${p.confidence}"></label><small>${p.questionsCorrect}/${p.questionsAttempted} questions correct</small><small>${stats.completed}/${stats.total} checklist skills • Weight ${m.studyWeight}%</small></div></div>`; }).join('')}</div>` : ''}`, 'topic-card'); }).join('')}</div>`;
}
function statusOptions(current) { return ['not-started', 'learning', 'completed', 'mastered', 'weak'].map(x => `<option value="${x}" ${x === current ? 'selected' : ''}>${x === 'not-started' ? 'Not started' : x === 'learning' ? 'Learning' : x === 'completed' ? 'Completed' : x === 'mastered' ? 'Mastered' : 'Weak / needs revision'}</option>`).join(''); }
function renderLearn() { const s = getState(), m = moduleById(learnModuleId) ?? modules[0], lesson = lessons[m.id], bangla = s.settings.language === 'english-bangla' ? banglaSummaries[m.id] : ''; return `<div class="page-head"><div><div class="eyebrow blue">LEARN</div><h1>Topic learning room</h1><p>Learn the rule, see it applied, then practise immediately.</p></div></div>${card(`<label>Choose module<select id="learn-module">${modules.map(x => `<option value="${x.id}" ${x.id === m.id ? 'selected' : ''}>${x.code} — ${esc(x.name)}</option>`).join('')}</select></label>`)}<div class="row-between page-subhead"><div><div class="eyebrow blue">TOPIC ${m.topicId} • ${m.paper} • ${m.studyWeight}% STUDY WEIGHT</div><h2>${esc(m.name)}</h2></div>${badge(s.progress[m.id].status)}</div>${card(`<h2>Your syllabus checklist</h2><p class="muted">Tick each skill as you actually complete it. Your overall progress updates immediately.</p>${renderChecklist(m.id, true)}`)}${lesson ? `<div class="grid-two wide-left"><div class="stack">${card(`<h2>Easy explanation</h2><p class="lead">${esc(lesson.intro)}</p>${bangla ? `<div class="bangla"><b>বাংলায় সহজ করে:</b><p>${esc(bangla)}</p></div>` : ''}`)}${card(`<h2>Key terms</h2><div class="term-list">${lesson.keyTerms.map(k => `<div><b>${esc(k.term)}</b><p>${esc(k.definition)}</p></div>`).join('')}</div>`)}${card(`<h2>Rules to remember</h2><ul class="check-list">${lesson.rules.map(x => `<li>✓ ${esc(x)}</li>`).join('')}</ul>`)}${lesson.examples.map(e => card(`<h2>${esc(e.title)}</h2><p>${esc(e.body)}</p>`)).join('')}</div><div class="stack">${card(`<h2>Common mistakes</h2><ul>${lesson.mistakes.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`, 'warning-card')}${card(`<h2>Memory trick</h2><p>${esc(lesson.memoryTip)}</p>`, 'tip-card')}${card(`<h2>Quick check</h2><div class="mini-questions">${questions.filter(q => lesson.quickCheckQuestionIds.includes(q.id)).map(q => `<div><b>${esc(q.question)}</b><small>${q.marks} mark${q.marks === 1 ? '' : 's'} • ${q.difficulty}</small></div>`).join('') || '<p class="muted">No local quick-check questions for this lesson yet.</p>'}</div>`)}${card(`<h2>Finish this lesson</h2><p class="muted">Completed = teaching/practice finished. Mastered = strong exam-style performance.</p><div class="button-row"><button class="btn btn-secondary" data-set-learn-status="learning" data-module="${m.id}">Mark learning</button><button class="btn btn-primary" data-set-learn-status="completed" data-module="${m.id}">Mark completed</button><button class="btn btn-secondary" data-set-learn-status="mastered" data-module="${m.id}">Mark mastered</button></div>`)}</div></div>` : card(`<h2>Official checklist</h2><p>This module is fully tracked in the syllabus. A detailed local lesson is not bundled yet, so use the official points below and mark it Learning while you study it.</p><ul>${m.officialPoints.map(x => `<li>${esc(x)}</li>`).join('')}</ul><button class="btn btn-primary" data-set-learn-status="learning" data-module="${m.id}">Start learning</button>`)}`; }
function practicePool() { return questions.filter(q => (practicePaper === 'all' || q.paper === practicePaper) && (practiceType === 'all' || q.type === practiceType) && (practiceDifficulty === 'all' || q.difficulty === practiceDifficulty) && (practiceModule === 'all' || q.moduleId === practiceModule)); }
function renderPractice() { const s = getState(), pool = practicePool(), q = pool[practiceIndex % Math.max(pool.length, 1)]; return `<div class="page-head"><div><div class="eyebrow blue">PRACTICE</div><h1>Question bank</h1><p>Wrong answers automatically enter your Mistake Bank. Use filters to target weak areas.</p></div></div>${card(`<div class="filters"><label>Paper<select id="practice-paper">${selectOptions([['all', 'All'], ['P1', 'Paper 1'], ['P2', 'Paper 2']], practicePaper)}</select></label><label>Type<select id="practice-type">${selectOptions([['all', 'All'], ['mcq', 'MCQ'], ['short', 'Short answer'], ['calculation', 'Calculation'], ['theory', 'Theory'], ['ledger', 'Ledger']], practiceType)}</select></label><label>Difficulty<select id="practice-difficulty">${selectOptions([['all', 'All'], ['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard'], ['tricky', 'Very tricky']], practiceDifficulty)}</select></label><label>Module<select id="practice-module"><option value="all">All modules</option>${modules.map(m => `<option value="${m.id}" ${practiceModule === m.id ? 'selected' : ''}>${m.code} ${esc(m.name)}</option>`).join('')}</select></label></div>`)}${!q ? empty('No questions match these filters', 'Broaden the filters. The bundled bank intentionally uses a smaller set of higher-quality demo questions rather than hundreds of placeholders.') : card(`<div class="row-between"><div class="eyebrow blue">${q.paper} • ${q.type} • ${q.difficulty}</div><div class="muted small">${q.marks} mark${q.marks === 1 ? '' : 's'} • ${pool.length} matching</div></div><h2 class="question">${esc(q.question)}</h2>${q.options ? `<div class="option-grid">${q.options.map(o => `<button ${practiceResult !== null ? 'disabled' : ''} data-practice-option="${esc(o)}" class="option ${practiceAnswer === o ? 'selected' : ''}">${esc(o)}</button>`).join('')}</div>` : `<textarea id="practice-answer" rows="6" ${practiceResult !== null ? 'disabled' : ''} placeholder="${s.settings.mode === 'exam' ? 'Write your answer. No hints in Exam Mode.' : 'Show your working or write your developed answer.'}">${esc(practiceAnswer)}</textarea>`}${practiceResult === null ? `<div class="form-row"><label>If wrong, likely cause<select id="practice-mistake">${mistakeOptions(practiceMistake)}</select></label><button class="btn btn-primary" data-action="submit-practice" ${practiceAnswer.trim() ? '' : 'disabled'}>Submit answer</button></div>` : `<div class="result ${practiceResult ? 'correct' : 'wrong'}"><h3>${practiceResult ? '✓ Correct' : '✕ Needs review'}</h3><p><b>Answer:</b> ${esc(q.answer)}</p>${s.settings.mode === 'learning' ? `<p><b>Why:</b> ${esc(q.explanation)}</p>` : ''}<button class="btn btn-secondary" data-action="next-practice">Next question</button></div>`}`)}`; }
function mistakeOptions(current) { const opts = [['unclassified', 'Unclassified'], ['rule', 'Did not know rule'], ['calculation', 'Calculation mistake'], ['debit-credit', 'Debit/credit confusion'], ['misread', 'Misread question'], ['formula', 'Forgot formula'], ['theory-wording', 'Theory wording'], ['careless', 'Careless mistake']]; return opts.map(([v, l]) => `<option value="${v}" ${v === current ? 'selected' : ''}>${l}</option>`).join(''); }
function renderMistakes() { const s = getState(), items = s.mistakes.filter(m => !m.resolved); return `<div class="page-head"><div><div class="eyebrow blue">MISTAKE BANK</div><h1>Turn mistakes into marks</h1><p>A mistake stays active until two correct retries after the error.</p></div></div>${!items.length ? empty('No unresolved mistakes', 'Questions you answer incorrectly will appear here automatically for targeted revision.') : `<div class="stack">${items.map(m => { const q = questions.find(q => q.id === m.questionId), mod = moduleById(m.moduleId); return card(`<div class="row-between"><div><div class="eyebrow danger-text">${mod?.code ?? ''} ${esc(mod?.name ?? '')}</div><h2>${esc(q?.question ?? m.questionId)}</h2></div><span class="badge badge-weak">Wrong ${m.timesWrong}×</span></div><div class="grid-two"><div class="answer-box"><b>Your last answer</b><p>${esc(m.userAnswer)}</p></div><div class="answer-box good"><b>Correct answer</b><p>${esc(m.correctAnswer)}</p></div></div><p>${esc(m.explanation)}</p><div class="form-row"><label>Cause<select data-mistake-class="${m.id}">${mistakeOptions(m.mistakeType)}</select></label><span class="muted">Correct retry streak: <b>${m.correctStreak}/2</b></span></div>`); }).join('')}</div>`}`; }
function renderRevision() { const s = getState(), pending = s.revisions.filter(r => !r.completedDate).sort((a, b) => a.dueDate.localeCompare(b.dueDate)), due = pending.filter(r => r.dueDate <= today()), upcoming = pending.filter(r => r.dueDate > today()); const list = (items, emptyTitle) => items.length ? `<div class="stack">${items.map(r => { const m = moduleById(r.moduleId); return card(`<div class="row-between"><div><div class="eyebrow blue">${r.intervalDays}-DAY REVIEW</div><h3>${m?.code ?? ''} ${esc(m?.name ?? '')}</h3><div class="muted">Due ${r.dueDate}</div></div><button class="btn ${r.dueDate < today() ? 'btn-danger' : 'btn-secondary'}" data-complete-revision="${r.id}">Mark revision done</button></div>`); }).join('')}</div>` : empty(emptyTitle, 'Revision sessions are scheduled 1, 3, 7, 14 and 30 days after a module is first completed.'); return `<div class="page-head"><div><div class="eyebrow blue">SPACED REVISION</div><h1>Revision schedule</h1><p>Completion starts the revision clock; mastery requires you to keep the knowledge.</p></div></div><h2>Due now (${due.length})</h2>${list(due, 'Nothing due today')}<h2 class="section-title">Upcoming (${upcoming.length})</h2>${list(upcoming.slice(0, 20), 'No upcoming revisions')}`; }
function renderTheory() { const s = theorySamples[theoryIndex], words = theoryAnswer.trim() ? theoryAnswer.trim().split(/\s+/).length : 0, checks = { point: /because|since|as|reason|check|error|faster|cost|profit|value/i.test(theoryAnswer), application: /business|control|computer|depreciation|receivable|payable/i.test(theoryAnswer), balance: /however|although|but|on the other hand|disadvantage|risk/i.test(theoryAnswer), conclusion: /therefore|overall|recommend|advise|conclude/i.test(theoryAnswer) }; return `<div class="page-head"><div><div class="eyebrow blue">THEORY ANSWER BUILDER</div><h1>Build answers instead of memorising paragraphs</h1><p>Command word → topic/person → point → explanation → application → counterpoint → justified conclusion when required.</p></div></div>${card(`<div class="grid-three mini"><div><span>QUESTION</span><b>${esc(s.q)}</b></div><div><span>MARKS</span><b class="big">${s.marks}</b></div><div><span>FOCUS</span><b>${esc(s.focus)}</b></div></div>`)}${card(`<h2>Answer-building structure</h2><div class="flow">${['Point', 'Explain', 'Apply', 'Counterpoint', 'Judgement'].map((x, i) => `<div><b>${x}</b>${i < 4 ? '<span>→</span>' : ''}</div>`).join('')}</div><div class="info-box"><b>Possible content:</b> ${s.points.map(esc).join(' • ')}</div>`)}${card(`<label>Write your answer<textarea id="theory-answer" rows="8" placeholder="Write it as you would in the exam...">${esc(theoryAnswer)}</textarea></label><div class="muted small">${words} words</div><div class="button-row"><button class="btn btn-primary" data-action="analyze-theory">Analyse structure</button><button class="btn btn-secondary" data-action="next-theory">Next prompt</button></div>${theoryAnalysed ? `<div class="structure-grid">${Object.entries(checks).map(([k, v]) => `<div class="${v ? 'good' : 'neutral'}"><b>✓ ${k[0].toUpperCase() + k.slice(1)}</b><span>${v ? 'Detected in your draft' : 'Not clearly detected yet'}</span></div>`).join('')}</div><p class="muted small">This checks structural cues only, not official marks. Use the exact Pearson mark scheme when available.</p>` : ''}`)}`; }
function mockQuestions() { return questions.filter(q => q.paper === mockPaper).slice(0, mockPaper === 'P1' ? 10 : 6); }
function renderMock() { const qs = mockQuestions(), total = qs.reduce((s, q) => s + q.marks, 0); let score = 0; if (mockSubmitted)
    for (const q of qs) {
        if (normalizeAnswer(mockAnswers[q.id] ?? '') === normalizeAnswer(q.answer))
            score += q.marks;
    } return `<div class="page-head"><div><div class="eyebrow blue">MOCK EXAMS</div><h1>Local mini mock mode</h1><p>Uses the bundled practice bank; it does not reproduce an official Pearson paper.</p></div></div>${card(`<div class="button-row"><button class="btn ${mockPaper === 'P1' ? 'btn-primary' : 'btn-secondary'}" data-mock-paper="P1">Paper 1 mini mock</button><button class="btn ${mockPaper === 'P2' ? 'btn-primary' : 'btn-secondary'}" data-mock-paper="P2">Paper 2 mini mock</button></div><p class="muted">Suggested time: ${mockPaper === 'P1' ? '25' : '20'} minutes • ${total} local-demo marks</p>${!mockStarted ? button('Start mock', 'start-mock') : ''}`)}${mockStarted ? `<div class="stack">${qs.map((q, i) => card(`<div class="row-between"><div class="eyebrow blue">QUESTION ${i + 1}</div><span class="muted small">${q.marks} mark${q.marks === 1 ? '' : 's'}</span></div><h3>${esc(q.question)}</h3>${q.options ? `<select data-mock-answer="${q.id}" ${mockSubmitted ? 'disabled' : ''}><option value="">Choose an answer</option>${q.options.map(o => `<option value="${esc(o)}" ${mockAnswers[q.id] === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>` : `<textarea data-mock-answer="${q.id}" rows="4" ${mockSubmitted ? 'disabled' : ''}>${esc(mockAnswers[q.id] ?? '')}</textarea>`}${mockSubmitted ? `<div class="answer-box good"><b>Expected answer</b><p>${esc(q.answer)}</p></div>` : ''}`)).join('')}${card(!mockSubmitted ? button('Submit mini mock', 'submit-mock') : `<div class="eyebrow">LOCAL DEMO SCORE</div><div class="score">${score}/${total}</div><p class="muted">Written answers are strict-match marked here. Do not treat this as an official Pearson grade.</p>`)}</div>` : ''}`; }
function renderAnalytics() { const s = getState(), ranked = modules.map(m => ({ m, p: s.progress[m.id], acc: accuracy(s.progress, m.id) })).filter(x => x.p.questionsAttempted > 0).sort((a, b) => a.acc - b.acc), mistakes = Object.entries(s.mistakes.reduce((a, m) => { a[m.mistakeType] = (a[m.mistakeType] || 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]); return `<div class="page-head"><div><div class="eyebrow blue">ANALYTICS</div><h1>What the numbers actually say</h1><p>Readiness is an internal metric, not an official predicted grade.</p></div></div><div class="stats-grid">${stat('Completion', `${overallCompletion(s.progress)}%`, 'Weighted syllabus progress', '✓')}${stat('Mastery', `${masteryCompletion(s.progress)}%`, 'Weighted mastered progress', '★')}${stat('Question accuracy', `${accuracy(s.progress)}%`, `${s.attempts.length} attempts`, '?')}${stat('Readiness', `${examReadiness(s)}%`, 'Internal metric', '◎')}</div><div class="grid-two">${card(`<h2>Topic completion</h2><div class="stack-md">${topics.map(t => hProgress(topicCoverage(s.progress, t.id), `Topic ${t.id} — ${t.name}`)).join('')}</div>`)}${card(`<h2>Paper coverage</h2><div class="stack-lg">${hProgress(paperCoverage(s.progress, 'P1'), 'Paper 1 syllabus coverage')}${hProgress(paperCoverage(s.progress, 'P2'), 'Paper 2 core coverage')}</div><p class="muted small">Paper 2 is holistic and builds on Topics 1–3 as well as Topics 4–5.</p>`)}</div><div class="grid-two">${card(`<h2>Weakest tested modules</h2>${ranked.length ? `<div class="rank-list">${ranked.slice(0, 5).map(x => `<div><span><b>${x.m.code} ${esc(x.m.name)}</b><small>${x.p.questionsCorrect}/${x.p.questionsAttempted} correct</small></span><strong class="${x.acc < 60 ? 'danger-text' : x.acc < 80 ? 'warn-text' : 'success-text'}">${x.acc}%</strong></div>`).join('')}</div>` : '<p class="muted">Answer practice questions to build performance analytics.</p>'}`)}${card(`<h2>Most common mistake types</h2>${mistakes.length ? `<div class="rank-list">${mistakes.slice(0, 6).map(([type, count]) => `<div><span>${esc(type.replaceAll('-', ' '))}</span><strong>${count}</strong></div>`).join('')}</div>` : '<p class="muted">No mistakes logged yet.</p>'}`)}</div>`; }
function renderQuick() { const m = moduleById(quickModuleId) ?? modules[0], lesson = lessons[m.id]; return `<div class="page-head"><div><div class="eyebrow blue">QUICK REVISION</div><h1>Fast recap mode</h1><p>Definition, rule, example, trap, memory cue, exam check.</p></div></div>${card(`<select id="quick-module">${modules.map(x => `<option value="${x.id}" ${x.id === m.id ? 'selected' : ''}>${x.code} — ${esc(x.name)}</option>`).join('')}</select>`)}${card(`<div class="eyebrow blue">${m.paper} • TOPIC ${m.topicId}</div><h2>${esc(m.name)}</h2><p>${esc(m.focus)}</p><div class="quick-grid">${lesson ? [['KEY DEFINITION', lesson.keyTerms[0]?.definition ?? lesson.intro], ['RULE', lesson.rules[0]], ['EXAMPLE', lesson.examples[0]?.body ?? 'Use a worked example from your lesson.'], ['EXAM TRAP', lesson.mistakes[0]], ['MEMORY TIP', lesson.memoryTip], ['EXAM CHECK', `Can you explain: ${m.officialPoints[0]}?`]].map(([l, t]) => `<div><span>${esc(l)}</span><p>${esc(t)}</p></div>`).join('') : m.officialPoints.slice(0, 6).map((x, i) => `<div><span>CHECK ${i + 1}</span><p>${esc(x)}</p></div>`).join('')}</div>`)}`; }
function renderNotes() { const s = getState(); return `<div class="page-head"><div><div class="eyebrow blue">MY ACCOUNTING NOTES</div><h1>Notes that stay with your progress</h1><p>Create formula notes, exam points, mistake notes or personal explanations.</p></div></div>${card(`<form id="note-form"><div class="form-grid"><label>Title<input id="note-title" placeholder="Note title"></label><label>Module<select id="note-module"><option value="">General note</option>${modules.map(m => `<option value="${m.id}">${m.code} ${esc(m.name)}</option>`).join('')}</select></label><label>Type<select id="note-type"><option value="general">General</option><option value="exam">Exam point</option><option value="mistake">Mistake note</option><option value="formula">Formula</option></select></label></div><label>Note<textarea id="note-body" rows="5" placeholder="Write your note..."></textarea></label><button class="btn btn-primary">Save note</button></form>`)}${!s.notes.length ? empty('No notes yet', 'Your notes will appear here and are included in JSON backups.') : `<div class="note-grid">${s.notes.map(n => card(`<div class="row-between"><div><div class="eyebrow blue">${n.type}${n.moduleId ? ` • ${n.moduleId}` : ''}</div><h2>${esc(n.title)}</h2></div><div class="icon-row"><button class="icon-btn ${n.starred ? 'starred' : ''}" data-star-note="${n.id}" aria-label="Star note">★</button><button class="icon-btn danger-text" data-delete-note="${n.id}" aria-label="Delete note">⌫</button></div></div><p class="note-body">${esc(n.body)}</p><div class="muted small">Updated ${formatDate(n.updatedAt)}</div>`)).join('')}</div>`}`; }
function renderHistory() { const s = getState(); return `<div class="page-head"><div><div class="eyebrow blue">PROGRESS HISTORY</div><h1>Your accounting timeline</h1></div></div>${!s.history.length ? empty('No activity yet', 'Status changes, practice, revisions, notes and profile changes will build your timeline.') : `<div class="timeline">${s.history.slice(0, 100).map(h => `<div class="timeline-item"><span></span>${card(`<div class="muted small">${formatDate(h.date)} • ${h.type}</div><h3>${esc(h.title)}</h3><p>${esc(h.detail)}</p>`)}</div>`).join('')}</div>`}`; }
function renderAi() { const s = getState(); return `<div class="page-head"><div><div class="eyebrow blue">AI TUTOR</div><h1>Ready for a secure AI connection</h1><p>The AI layer is provider-agnostic so Claude, OpenAI or another provider can be added later without rebuilding the study app.</p></div></div>${card(`<h2>Provider status: ${esc(aiTutor.getProvider().name)}</h2><p class="muted">No secret API key is included in this frontend.</p><div class="warning-inline">🔒 Production AI should use a secure server-side endpoint so your key is never exposed in browser code.</div>`)}${card(`<label>Context module<select id="ai-module">${modules.map(m => `<option value="${m.id}" ${m.id === aiModuleId ? 'selected' : ''}>${m.code} ${esc(m.name)}</option>`).join('')}</select></label><label>Ask the tutor<textarea id="ai-request" rows="5">${esc(aiRequest)}</textarea></label><div class="button-row"><button class="btn btn-primary" data-action="ai-explain" ${aiLoading ? 'disabled' : ''}>✦ Explain</button><button class="btn btn-secondary" data-action="ai-practice" ${aiLoading ? 'disabled' : ''}>Generate practice</button></div>${aiResponse ? `<div class="ai-response">${esc(aiResponse)}</div>` : ''}`)}`; }
function renderProfile() { const p = getState().profile; return `<div class="page-head"><div><div class="eyebrow blue">PROFILE</div><h1>Your study profile</h1><p>Used for countdowns and planning. Everything stays in this browser unless you export a backup.</p></div></div>${card(`<form id="profile-form"><div class="form-grid two"><label>Name<input id="profile-name" value="${esc(p.name)}"></label><label>Target grade<input id="profile-grade" value="${esc(p.targetGrade)}"></label><label>Paper 1 date<input id="profile-p1" type="date" value="${esc(p.examDatePaper1)}"></label><label>Paper 2 date<input id="profile-p2" type="date" value="${esc(p.examDatePaper2)}"></label><label>Daily study target<select id="profile-minutes">${[15, 30, 45, 60, 90, 120].map(x => `<option value="${x}" ${x === p.dailyStudyMinutes ? 'selected' : ''}>${x} minutes</option>`).join('')}</select></label><label>Lesson style<select id="profile-style"><option value="simple" ${p.preferredLessonStyle === 'simple' ? 'selected' : ''}>Simple</option><option value="detailed" ${p.preferredLessonStyle === 'detailed' ? 'selected' : ''}>Detailed</option><option value="exam-focused" ${p.preferredLessonStyle === 'exam-focused' ? 'selected' : ''}>Exam-focused</option></select></label><label>Preferred language<select id="profile-language"><option value="english" ${p.preferredLanguage === 'english' ? 'selected' : ''}>English</option><option value="english-bangla" ${p.preferredLanguage === 'english-bangla' ? 'selected' : ''}>English + Bangla</option></select></label></div><button class="btn btn-primary">Save profile</button></form>`)}${card(`<h2>Qualification</h2><div class="grid-two"><div class="info-box"><span>QUALIFICATION</span><b>Pearson Edexcel International GCSE (9–1) Accounting</b></div><div class="info-box"><span>CODE</span><b>4AC1 • Linear</b></div></div>`)}`; }
function renderSettings() { const s = getState().settings; return `<div class="page-head"><div><div class="eyebrow blue">SETTINGS</div><h1>Simple settings</h1><p>The hub now uses a clean white theme by default.</p></div></div>${card(`<h2>Study preferences</h2><div class="info-box white-theme-box"><span>APPEARANCE</span><b>Clean white theme</b><p class="muted small">Fixed for a clearer, less complicated study experience.</p></div><div class="form-grid two settings-gap"><label>Mode<select data-setting="mode"><option value="learning" ${s.mode === 'learning' ? 'selected' : ''}>Learning mode</option><option value="exam" ${s.mode === 'exam' ? 'selected' : ''}>Exam mode</option></select></label><label>Language<select data-setting="language"><option value="english" ${s.language === 'english' ? 'selected' : ''}>English</option><option value="english-bangla" ${s.language === 'english-bangla' ? 'selected' : ''}>English + Bangla</option></select></label><label>Font size<select data-setting="fontScale"><option value="small" ${s.fontScale === 'small' ? 'selected' : ''}>Small</option><option value="normal" ${s.fontScale === 'normal' ? 'selected' : ''}>Normal</option><option value="large" ${s.fontScale === 'large' ? 'selected' : ''}>Large</option></select></label></div><div class="toggle-grid"><label><span>Compact layout</span><input data-setting-check="compact" type="checkbox" ${s.compact ? 'checked' : ''}></label><label><span>Reduced animations</span><input data-setting-check="reducedMotion" type="checkbox" ${s.reducedMotion ? 'checked' : ''}></label></div>`)}${card(`<h2>Backup & restore</h2><p class="muted">Progress saves automatically in this browser. Export a JSON backup before switching browsers/devices or clearing browser data.</p><div class="button-row"><button class="btn btn-primary" data-action="export-backup">↓ Export backup</button><button class="btn btn-secondary" data-action="import-backup">↑ Import backup</button><input id="backup-file" type="file" accept="application/json,.json" hidden></div>`)}${card(`<h2 class="danger-text">Reset</h2><p class="muted">This resets progress, scores, notes and history in this browser.</p><button class="btn btn-danger" data-action="reset-all">Reset all progress</button>`)}`; }
function wire() {
    document.querySelectorAll('[data-action="open-sidebar"]').forEach(x => x.onclick = () => { sidebarOpen = true; render(); });
    document.querySelectorAll('[data-action="close-sidebar"]').forEach(x => x.onclick = () => { sidebarOpen = false; render(); });
    document.querySelectorAll('[data-action="toggle-more-nav"]').forEach(x => x.onclick = () => { showMoreNav = !showMoreNav; render(); });
    const sf = document.getElementById('search-form');
    sf?.addEventListener('submit', e => { e.preventDefault(); searchQuery = document.getElementById('global-search').value.trim(); render(); });
    document.querySelectorAll('[data-action="clear-search"]').forEach(x => x.onclick = () => { searchQuery = ''; render(); });
    document.querySelectorAll('[data-action="go-today"]').forEach(x => x.onclick = () => location.hash = 'today');
    document.querySelectorAll('[data-action="open-learn-module"]').forEach(x => x.onclick = () => { learnModuleId = x.dataset.module ?? '1.2'; searchQuery = ''; location.hash = 'learn'; if (page === 'learn')
        render(); });
    document.querySelectorAll('[data-action="open-practice-question"]').forEach(x => x.onclick = () => { const id = x.dataset.question; const q = questions.find(q => q.id === id); if (q) {
        practicePaper = q.paper;
        practiceModule = q.moduleId;
        practiceType = 'all';
        practiceDifficulty = 'all';
        practiceIndex = Math.max(0, practicePool().findIndex(v => v.id === id));
        practiceAnswer = '';
        practiceResult = null;
        searchQuery = '';
        location.hash = 'practice';
        if (page === 'practice')
            render();
    } });
    const session = document.getElementById('session-minutes');
    session?.addEventListener('change', () => { sessionMinutes = Number(session.value); render(); });
    document.querySelectorAll('[data-action="log-session"]').forEach(x => x.onclick = () => { addStudyMinutes(sessionMinutes); showToast(`${sessionMinutes}-minute study session logged.`); });
    document.querySelectorAll('[data-filter-syllabus]').forEach(x => x.onclick = () => { syllabusFilter = x.dataset.filterSyllabus; render(); });
    document.querySelectorAll('[data-toggle-topic]').forEach(x => x.onclick = () => { const id = Number(x.dataset.toggleTopic); openTopics.has(id) ? openTopics.delete(id) : openTopics.add(id); render(); });
    document.querySelectorAll('[data-checklist-module]').forEach(el => el.onchange = () => { const id = el.dataset.checklistModule, key = el.dataset.checklistKey, before = overallCompletion(getState().progress); setChecklistItem(id, key, el.checked); const after = overallCompletion(getState().progress), stats = checklistStats(getState().progress, id); showToast(`${moduleById(id)?.name}: ${stats.completed}/${stats.total} skills complete. Overall ${before}% → ${after}%.`); });
    document.querySelectorAll('[data-status-module]').forEach(el => el.onchange = () => { const before = overallCompletion(getState().progress), id = el.dataset.statusModule; setModuleStatus(id, el.value); const after = overallCompletion(getState().progress); showToast(`${moduleById(id)?.name}: ${el.options[el.selectedIndex].text}. Overall ${before}% → ${after}%.`); });
    document.querySelectorAll('[data-confidence-module]').forEach(el => el.onchange = () => setConfidence(el.dataset.confidenceModule, Number(el.value)));
    const lm = document.getElementById('learn-module');
    lm?.addEventListener('change', () => { learnModuleId = lm.value; render(); });
    document.querySelectorAll('[data-set-learn-status]').forEach(x => x.onclick = () => { const id = x.dataset.module, before = overallCompletion(getState().progress); setModuleStatus(id, x.dataset.setLearnStatus); const after = overallCompletion(getState().progress); showToast(`${moduleById(id)?.name} updated. Overall ${before}% → ${after}%.`); });
    const pp = document.getElementById('practice-paper');
    pp?.addEventListener('change', () => { practicePaper = pp.value; resetPractice(); });
    const pt = document.getElementById('practice-type');
    pt?.addEventListener('change', () => { practiceType = pt.value; resetPractice(); });
    const pd = document.getElementById('practice-difficulty');
    pd?.addEventListener('change', () => { practiceDifficulty = pd.value; resetPractice(); });
    const pm = document.getElementById('practice-module');
    pm?.addEventListener('change', () => { practiceModule = pm.value; resetPractice(); });
    document.querySelectorAll('[data-practice-option]').forEach(x => x.onclick = () => { practiceAnswer = x.dataset.practiceOption ?? ''; render(); });
    const pa = document.getElementById('practice-answer');
    pa?.addEventListener('input', () => { practiceAnswer = pa.value; const btn = document.querySelector('[data-action="submit-practice"]'); if (btn)
        btn.disabled = !practiceAnswer.trim(); });
    const pmi = document.getElementById('practice-mistake');
    pmi?.addEventListener('change', () => practiceMistake = pmi.value);
    document.querySelectorAll('[data-action="submit-practice"]').forEach(x => x.onclick = submitPractice);
    document.querySelectorAll('[data-action="next-practice"]').forEach(x => x.onclick = () => { const pool = practicePool(); practiceIndex = pool.length ? (practiceIndex + 1) % pool.length : 0; practiceAnswer = ''; practiceResult = null; practiceMistake = 'unclassified'; render(); });
    document.querySelectorAll('[data-mistake-class]').forEach(x => x.onchange = () => classifyMistake(x.dataset.mistakeClass, x.value));
    document.querySelectorAll('[data-complete-revision]').forEach(x => x.onclick = () => { completeRevision(x.dataset.completeRevision); showToast('Revision marked complete.'); });
    const ta = document.getElementById('theory-answer');
    ta?.addEventListener('input', () => theoryAnswer = ta.value);
    document.querySelectorAll('[data-action="analyze-theory"]').forEach(x => x.onclick = () => { theoryAnswer = document.getElementById('theory-answer').value; theoryAnalysed = true; render(); });
    document.querySelectorAll('[data-action="next-theory"]').forEach(x => x.onclick = () => { theoryIndex = (theoryIndex + 1) % theorySamples.length; theoryAnswer = ''; theoryAnalysed = false; render(); });
    document.querySelectorAll('[data-mock-paper]').forEach(x => x.onclick = () => { mockPaper = x.dataset.mockPaper; mockStarted = false; mockSubmitted = false; mockAnswers = {}; render(); });
    document.querySelectorAll('[data-action="start-mock"]').forEach(x => x.onclick = () => { mockStarted = true; render(); });
    document.querySelectorAll('[data-mock-answer]').forEach(x => x.onchange = () => mockAnswers[x.dataset.mockAnswer] = x.value);
    document.querySelectorAll('[data-action="submit-mock"]').forEach(x => x.onclick = () => { document.querySelectorAll('[data-mock-answer]').forEach(y => mockAnswers[y.dataset.mockAnswer] = y.value); mockSubmitted = true; render(); });
    const qm = document.getElementById('quick-module');
    qm?.addEventListener('change', () => { quickModuleId = qm.value; render(); });
    const nf = document.getElementById('note-form');
    nf?.addEventListener('submit', e => { e.preventDefault(); const title = document.getElementById('note-title').value.trim(), body = document.getElementById('note-body').value.trim(), moduleId = document.getElementById('note-module').value, type = document.getElementById('note-type').value; if (!title && !body)
        return; addNote({ title: title || 'Untitled note', body, moduleId: moduleId || undefined, type, starred: false }); showToast('Note saved.'); });
    document.querySelectorAll('[data-star-note]').forEach(x => x.onclick = () => toggleStarNote(x.dataset.starNote));
    document.querySelectorAll('[data-delete-note]').forEach(x => x.onclick = () => { if (confirm('Delete this note?'))
        deleteNote(x.dataset.deleteNote); });
    const aim = document.getElementById('ai-module');
    aim?.addEventListener('change', () => aiModuleId = aim.value);
    const air = document.getElementById('ai-request');
    air?.addEventListener('input', () => aiRequest = air.value);
    document.querySelectorAll('[data-action="ai-explain"]').forEach(x => x.onclick = () => runAi('explain'));
    document.querySelectorAll('[data-action="ai-practice"]').forEach(x => x.onclick = () => runAi('practice'));
    const pf = document.getElementById('profile-form');
    pf?.addEventListener('submit', e => { e.preventDefault(); updateProfile({ name: document.getElementById('profile-name').value, targetGrade: document.getElementById('profile-grade').value, examDatePaper1: document.getElementById('profile-p1').value, examDatePaper2: document.getElementById('profile-p2').value, dailyStudyMinutes: Number(document.getElementById('profile-minutes').value), preferredLessonStyle: document.getElementById('profile-style').value, preferredLanguage: document.getElementById('profile-language').value }); showToast('Profile saved.'); });
    document.querySelectorAll('[data-setting]').forEach(x => x.onchange = () => updateSettings({ [x.dataset.setting]: x.value }));
    document.querySelectorAll('[data-setting-check]').forEach(x => x.onchange = () => updateSettings({ [x.dataset.setting]: x.checked }));
    document.querySelectorAll('[data-action="export-backup"]').forEach(x => x.onclick = downloadBackup);
    document.querySelectorAll('[data-action="import-backup"]').forEach(x => x.onclick = () => document.getElementById('backup-file')?.click());
    const bf = document.getElementById('backup-file');
    bf?.addEventListener('change', async () => { const file = bf.files?.[0]; if (!file)
        return; try {
        restoreBackup(await file.text());
        showToast('Backup restored successfully.');
    }
    catch (e) {
        showToast(e instanceof Error ? e.message : 'Could not import backup.');
    } });
    document.querySelectorAll('[data-action="reset-all"]').forEach(x => x.onclick = () => { if (confirm('Reset all Accounting Mastery Hub data in this browser?')) {
        resetState();
        showToast('All progress reset.');
    } });
}
function resetPractice() { practiceIndex = 0; practiceAnswer = ''; practiceResult = null; practiceMistake = 'unclassified'; render(); }
function submitPractice() { const pool = practicePool(), q = pool[practiceIndex % Math.max(pool.length, 1)]; if (!q || !practiceAnswer.trim())
    return; const a = normalizeAnswer(practiceAnswer), expected = normalizeAnswer(q.answer); let correct = false; if (q.options)
    correct = a === expected;
else {
    const numericA = a.match(/-?\d+(?:\.\d+)?/g)?.join('|'), numericE = expected.match(/-?\d+(?:\.\d+)?/g)?.join('|');
    correct = (numericA && numericE && numericA === numericE) || a === expected || (a.length > 12 && expected.includes(a));
} practiceResult = !!correct; recordAttempt(q.id, practiceAnswer, practiceResult, practiceMistake); render(); }
async function runAi(kind) { aiLoading = true; aiResponse = ''; render(); const context = { moduleId: aiModuleId, question: aiRequest, language: getState().settings.language, mode: getState().settings.mode, weakAreas: getState().progress[aiModuleId].weakSubtopics }; const r = kind === 'explain' ? await aiTutor.explain(context) : await aiTutor.generatePractice(context); aiResponse = r.text; aiLoading = false; render(); }
function downloadBackup() { const blob = new Blob([exportBackup()], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `accounting-mastery-backup-${today()}.json`; a.click(); URL.revokeObjectURL(url); showToast('Backup downloaded.'); }
render();
