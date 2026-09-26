import { getState } from './store.js';
import { modules } from './data.js';
import { daysUntil, examReadiness, overallCompletion, paperCoverage, recommendedNext, today } from './utils.js';

const PRIMARY_NAV = [
  ['dashboard','Home','⌂'],
  ['syllabus','Syllabus','▦'],
  ['learn','Learn','▤'],
  ['practice','Practice','□'],
  ['mock','Past Papers','▧'],
  ['revision','Revision','↻'],
  ['quick','Flashcards','◇'],
  ['analytics','Analytics','⌁'],
  ['notes','Notes','▣'],
  ['mistakes','Mistake Bank','!'],
  ['theory','Exam Readiness','✓'],
];
const FOOT_NAV = [
  ['profile','Profile','◉'],
  ['settings','Settings','⚙'],
];

let applying = false;
let scheduled = false;
let countdownTimer = 0;

function esc(value='') {
  return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
}

function pageKey(){
  const hash = location.hash.replace('#','');
  return hash || 'dashboard';
}

function iconBox(icon, tone='purple'){
  return `<span class="v3-icon v3-${tone}">${icon}</span>`;
}

function statusText(status){
  return status === 'not-started' ? 'Not started' : status === 'learning' ? 'Learning' : status === 'completed' ? 'Completed' : status === 'mastered' ? 'Mastered' : 'Needs revision';
}

function checklistPct(state, module){
  const p = state.progress[module.id];
  const values = Object.values(p?.checklist || {});
  if(!values.length) return p?.status === 'completed' || p?.status === 'mastered' ? 100 : 0;
  return Math.round(values.filter(Boolean).length / values.length * 100);
}

function totalSkillStats(state){
  let total = 0, done = 0;
  modules.forEach(m => {
    const values = Object.values(state.progress[m.id]?.checklist || {});
    total += values.length;
    done += values.filter(Boolean).length;
  });
  return { total, done };
}

function streak(state){
  const set = new Set(state.studyDays || []);
  if(!set.size) return 0;
  let count = 0;
  const d = new Date();
  for(let i=0;i<365;i++){
    const key = d.toISOString().slice(0,10);
    if(set.has(key)) count++;
    else if(i > 0) break;
    d.setDate(d.getDate()-1);
  }
  return count;
}

function pastPaperCount(state){
  const mockEvents = (state.history || []).filter(h => /mock|paper/i.test(`${h.title || ''} ${h.detail || ''}`)).length;
  return Math.min(12, mockEvents);
}

function navMarkup(){
  const current = pageKey();
  const item = ([key,label,icon]) => `<a href="#${key}" class="v3-nav-item ${current===key?'active':''}" data-v3-nav-link="${key}"><span>${icon}</span><b>${label}</b></a>`;
  return `<div class="v3-nav-primary">${PRIMARY_NAV.map(item).join('')}</div><div class="v3-nav-bottom">${FOOT_NAV.map(item).join('')}</div>`;
}

function decorateSidebar(){
  const sidebar = document.querySelector('.sidebar');
  if(!sidebar) return;
  sidebar.classList.add('v3-sidebar');
  if(sidebar.dataset.v3Decorated !== '1'){
    const brand = sidebar.querySelector('.brand');
    if(brand){
      const strong = brand.querySelector('strong');
      const small = brand.querySelector('small');
      if(strong) strong.textContent = 'IGCSE';
      if(small) small.textContent = 'Accounting Mastery';
      const mark = brand.querySelector('.brand-mark');
      if(mark) mark.innerHTML = '<span aria-hidden="true">▤</span>';
    }
    const oldSearch = sidebar.querySelector('.search-box');
    if(oldSearch) oldSearch.classList.add('v3-source-search');
    const foot = sidebar.querySelector('.sidebar-foot');
    if(foot) foot.innerHTML = '<span>Edexcel 4AC1</span><small>November 2026 exam journey</small>';
    sidebar.dataset.v3Decorated = '1';
  }
  const nav = sidebar.querySelector('nav');
  if(nav && nav.dataset.v3Nav !== '1'){
    nav.innerHTML = navMarkup();
    nav.dataset.v3Nav = '1';
  }
}

function topbarMarkup(state){
  const name = state.profile?.name && state.profile.name !== 'Student' ? state.profile.name : 'Azian';
  return `<div class="v3-topbar-inner">
    <form class="v3-global-search" id="v3-global-search-form">
      <span>⌕</span><input id="v3-global-search" placeholder="Search topics, questions, or notes..." autocomplete="off" />
    </form>
    <div class="v3-top-actions">
      <div class="v3-streak-chip" title="Current study streak"><span>🔥</span><b>${streak(state)}</b><small>day streak</small></div>
      <button class="v3-top-icon" type="button" aria-label="Display">☼</button>
      <button class="v3-top-icon" type="button" aria-label="Notifications">♢</button>
      <a class="v3-profile-chip" href="#profile"><span>${esc(name.charAt(0).toUpperCase())}</span><b>${esc(name)}</b><i>⌄</i></a>
    </div>
  </div>`;
}

function ensureTopbar(){
  const main = document.querySelector('.main');
  const content = main?.querySelector('.content');
  if(!main || !content) return;
  let bar = main.querySelector(':scope > .v3-topbar');
  if(bar) return;
  const state = getState();
  bar = document.createElement('header');
  bar.className = 'v3-topbar';
  bar.innerHTML = topbarMarkup(state);
  main.insertBefore(bar, content);
  const form = bar.querySelector('#v3-global-search-form');
  form?.addEventListener('submit', event => {
    event.preventDefault();
    const query = bar.querySelector('#v3-global-search')?.value || '';
    const sourceInput = document.querySelector('#global-search');
    const sourceForm = document.querySelector('#search-form');
    if(sourceInput && sourceForm){
      sourceInput.value = query;
      sourceInput.dispatchEvent(new Event('input',{bubbles:true}));
      sourceForm.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    }
  });
}

function moduleCard(module, state, index=0){
  if(!module) return '';
  const pct = checklistPct(state,module);
  const tones = ['purple','cyan','green'];
  const icons = ['▤','▧','✓'];
  return `<article class="v3-study-card">
    <div class="v3-study-title">${iconBox(icons[index%icons.length],tones[index%tones.length])}<div><b>${esc(module.code)} ${esc(module.name)}</b><small>${esc(module.focus || `Topic ${module.topicId}`)}</small></div></div>
    <div class="v3-study-progress"><span><i style="width:${pct}%"></i></span><b>${pct}%</b></div>
    <a href="#learn" class="v3-continue">Continue <span>→</span></a>
  </article>`;
}

function countdownParts(dateString){
  const target = new Date(`${dateString}T09:00:00`);
  const delta = Math.max(0,target.getTime()-Date.now());
  return {
    days: Math.floor(delta/86400000),
    hours: Math.floor(delta/3600000)%24,
    mins: Math.floor(delta/60000)%60,
    secs: Math.floor(delta/1000)%60,
  };
}

function dashboardMarkup(state){
  const completion = overallCompletion(state.progress);
  const skills = totalSkillStats(state);
  const next = recommendedNext(state.progress) || modules[0];
  const learning = modules.filter(m => ['learning','weak'].includes(state.progress[m.id]?.status));
  const candidates = [next, ...learning, ...modules].filter((m,i,arr) => m && arr.findIndex(x => x?.id === m.id) === i).slice(0,3);
  const p1 = paperCoverage(state.progress,'P1');
  const attempts = (state.attempts || []).length;
  const papers = pastPaperCount(state);
  const streakDays = streak(state);
  const c = countdownParts(state.profile.examDatePaper1 || '2026-10-28');
  const name = state.profile?.name && state.profile.name !== 'Student' ? state.profile.name : 'Azian';
  const remaining = Math.max(0, skills.total-skills.done);
  const ready = examReadiness(state);
  const todayLabel = new Date().toLocaleDateString(undefined,{weekday:'short'}).slice(0,1);

  return `<div class="v3-dashboard">
    <section class="v3-hero">
      <div class="v3-hero-copy">
        <h1>Good morning, ${esc(name)}! <span>👋</span></h1>
        <p>Small steps today, big results in November 2026.</p>
        <blockquote><span>“</span>Discipline today,<br/>full marks tomorrow.<span>”</span></blockquote>
      </div>
      <div class="v3-hero-art" aria-hidden="true"><img src="https://cdn.jsdelivr.net/gh/Azian2905/IGCSE-Accounting-Mastery@main/hero-study.svg" alt="" /></div>
      <div class="v3-countdown-card">
        <div class="v3-countdown-title">${iconBox('◎','purple')}<div><b>Exam Countdown</b><span>Edexcel IGCSE Accounting</span></div></div>
        <div class="v3-countdown-grid">
          <div><b data-cd="days">${c.days}</b><small>Days</small></div>
          <div><b data-cd="hours">${String(c.hours).padStart(2,'0')}</b><small>Hours</small></div>
          <div><b data-cd="mins">${String(c.mins).padStart(2,'0')}</b><small>Minutes</small></div>
          <div><b data-cd="secs">${String(c.secs).padStart(2,'0')}</b><small>Seconds</small></div>
        </div>
        <small class="v3-until">Until Paper 1 • 28 October 2026</small>
      </div>
    </section>

    <section class="v3-stats-row">
      <article class="v3-metric v3-progress-metric">
        <div class="v3-ring" style="--p:${completion}"><div><b>${completion}%</b></div></div>
        <div><h3>Overall Progress</h3><p><span class="dot green"></span>${skills.done} of ${skills.total || 0} skills completed</p><p><span class="dot blue"></span>${remaining} skills remaining</p><p><span class="dot gray"></span>Paper 1 coverage ${p1}%</p></div>
      </article>
      <article class="v3-metric">${iconBox('✎','purple')}<div><h3>Questions Practised</h3><strong>${attempts.toLocaleString()}</strong><p>questions answered</p><em>↑ Keep building accuracy</em></div><div class="v3-mini-bars"><i></i><i></i><i></i><i></i><i></i></div></article>
      <article class="v3-metric">${iconBox('▧','cyan')}<div><h3>Past Papers</h3><strong>${papers} <small>of 12</small></strong><p>recorded attempts</p><div class="v3-thin-progress"><i style="width:${Math.round(papers/12*100)}%"></i></div></div></article>
      <article class="v3-metric">${iconBox('🔥','orange')}<div><h3>Revision Streak</h3><strong>${streakDays} <small>days</small></strong><p>Keep going!</p><div class="v3-week-dots">${['M','T','W','T','F','S','S'].map((d,i)=>`<span class="${i<Math.min(7,streakDays)?'on':''}"><i></i>${i===new Date().getDay()-1?`<b>${todayLabel}</b>`:d}</span>`).join('')}</div></div></article>
    </section>

    <section class="v3-lower-grid">
      <div class="v3-panel v3-continue-panel">
        <div class="v3-section-heading"><h2>Continue Studying</h2><a href="#syllabus">See all <span>→</span></a></div>
        <div class="v3-study-grid">${candidates.map((m,i)=>moduleCard(m,state,i)).join('')}</div>
      </div>
      <div class="v3-panel v3-quick-panel">
        <div class="v3-section-heading"><h2>Quick Actions</h2></div>
        <div class="v3-quick-grid">
          <a href="#practice">${iconBox('?','purple')}<span><b>Practice Questions</b><small>Start practising</small></span><i>›</i></a>
          <a href="#mock">${iconBox('▧','cyan')}<span><b>Past Papers</b><small>View and attempt</small></span><i>›</i></a>
          <a href="#syllabus">${iconBox('▦','orange')}<span><b>View Syllabus</b><small>Track your progress</small></span><i>›</i></a>
          <a href="#notes">${iconBox('▣','green')}<span><b>My Notes</b><small>Open your notes</small></span><i>›</i></a>
        </div>
      </div>
    </section>
    <div class="v3-readiness-line"><span>Exam readiness</span><b>${ready}%</b><i><u style="width:${ready}%"></u></i><small>Internal study metric — not an official predicted grade.</small></div>
  </div>`;
}

function rebuildDashboard(){
  const home = document.querySelector('.simple-home');
  if(!home || home.dataset.v3Ready === '1') return;
  home.innerHTML = dashboardMarkup(getState());
  home.dataset.v3Ready = '1';
  home.classList.add('v3-home-host');
  refreshCountdown();
}

function refreshCountdown(){
  const state = getState();
  const parts = countdownParts(state.profile.examDatePaper1 || '2026-10-28');
  const map = {days:parts.days,hours:String(parts.hours).padStart(2,'0'),mins:String(parts.mins).padStart(2,'0'),secs:String(parts.secs).padStart(2,'0')};
  Object.entries(map).forEach(([key,value]) => {
    const node = document.querySelector(`[data-cd="${key}"]`);
    if(node) node.textContent = String(value);
  });
}

function syllabusSummary(state){
  const completion = overallCompletion(state.progress);
  const skills = totalSkillStats(state);
  return `<section class="v3-page-summary">
    <div class="v3-ring small" style="--p:${completion}"><div><b>${completion}%</b></div></div>
    <div><span>Overall Progress</span><strong>${completion}%</strong><small>${skills.done} of ${skills.total} syllabus skills completed</small></div>
    <div class="v3-summary-bar"><i style="width:${completion}%"></i></div>
  </section>`;
}

function augmentSyllabus(){
  const host = document.querySelector('.content');
  const pageHead = host?.querySelector('.page-head');
  if(!host || !pageHead || host.querySelector('.v3-page-summary')) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = syllabusSummary(getState());
  pageHead.insertAdjacentElement('afterend',wrap.firstElementChild);
}

function augmentPractice(){
  const host = document.querySelector('.content');
  const head = host?.querySelector('.page-head');
  if(!host || !head || host.querySelector('.v3-practice-launchers')) return;
  const box = document.createElement('section');
  box.className = 'v3-practice-launchers';
  box.innerHTML = `
    <a href="#practice">${iconBox('?','purple')}<span><b>MCQ Practice</b><small>Multiple-choice questions</small></span></a>
    <a href="#theory">${iconBox('✎','orange')}<span><b>Theory Practice</b><small>Structured answers</small></span></a>
    <a href="#practice">${iconBox('✓','green')}<span><b>Topic Tests</b><small>Topic-based practice</small></span></a>
    <a href="#mock">${iconBox('▧','pink')}<span><b>Past Paper Questions</b><small>Exam-style sets</small></span></a>`;
  head.insertAdjacentElement('afterend',box);
}

function augmentLearn(){
  const host = document.querySelector('.content');
  const head = host?.querySelector('.page-head');
  if(!host || !head || host.querySelector('.v3-learning-tabs')) return;
  const tabs = document.createElement('div');
  tabs.className = 'v3-learning-tabs';
  tabs.innerHTML = `<a class="active" href="#learn">Learn</a><a href="#notes">Notes</a><a href="#practice">Practice</a><a href="#mock">Past Paper Questions</a>`;
  head.insertAdjacentElement('afterend',tabs);
}

function augmentAnalytics(){
  const host = document.querySelector('.content');
  const head = host?.querySelector('.page-head');
  if(!host || !head || host.querySelector('.v3-analytics-strip')) return;
  const s = getState();
  const skills = totalSkillStats(s);
  const strip = document.createElement('section');
  strip.className = 'v3-analytics-strip';
  strip.innerHTML = `
    <div><span>Overall Progress</span><b>${overallCompletion(s.progress)}%</b></div>
    <div><span>Skills Completed</span><b>${skills.done}/${skills.total}</b></div>
    <div><span>Questions Practised</span><b>${(s.attempts||[]).length}</b></div>
    <div><span>Exam Readiness</span><b>${examReadiness(s)}%</b></div>`;
  head.insertAdjacentElement('afterend',strip);
}

function augmentGeneric(){
  const host = document.querySelector('.content');
  const head = host?.querySelector('.page-head');
  if(head) head.classList.add('v3-page-head');
  host?.querySelectorAll('.card').forEach(card => card.classList.add('v3-card'));
}

function enhance(){
  if(applying) return;
  applying = true;
  try{
    const key = pageKey();
    document.documentElement.dataset.page = key;
    decorateSidebar();
    ensureTopbar();
    augmentGeneric();
    if(key === 'dashboard') rebuildDashboard();
    if(key === 'syllabus') augmentSyllabus();
    if(key === 'practice') augmentPractice();
    if(key === 'learn') augmentLearn();
    if(key === 'analytics') augmentAnalytics();
  } finally {
    applying = false;
  }
}

function scheduleEnhance(){
  if(scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    enhance();
  });
}

new MutationObserver(scheduleEnhance).observe(document.getElementById('app'),{childList:true,subtree:true});
window.addEventListener('hashchange',scheduleEnhance);
window.addEventListener('resize',scheduleEnhance);
scheduleEnhance();

if(!countdownTimer){
  countdownTimer = window.setInterval(refreshCountdown,1000);
}
