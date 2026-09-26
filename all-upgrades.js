import { getState, completeRevision } from './store.js';
import { modules, questions, moduleChecklists, topics } from './data.js';
import { overallCompletion, masteryCompletion, paperCoverage, topicCoverage, accuracy, examReadiness, normalizeAnswer, today } from './utils.js';

const STORAGE_KEY='accounting-mastery-hub-v1';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const clamp=(n,min=0,max=100)=>Math.max(min,Math.min(max,Number.isFinite(n)?n:0));
const page=()=>location.hash.replace('#','')||'dashboard';
let applying=false, scheduled=false, heatMetric='completion', calendarOffset=0;
let examTab='mode', examSession=null, examTimer=0, libraryFilter={paper:'all',module:'all',type:'all',marks:'all'};
let tutorModule=modules[0]?.id||'', tutorContext=null, tutorReply='';

function saveState(mutator){
  const s=getState();
  mutator(s);
  localStorage.setItem(STORAGE_KEY,JSON.stringify(s));
}
function moduleById(id){return modules.find(m=>m.id===id)}
function modulePct(s,m){
  const vals=Object.values(s.progress?.[m.id]?.checklist||{});
  if(!vals.length)return ['completed','mastered'].includes(s.progress?.[m.id]?.status)?100:0;
  return Math.round(vals.filter(Boolean).length/vals.length*100);
}
function moduleAcc(s,id){
  const p=s.progress?.[id]; return p?.questionsAttempted?Math.round((p.questionsCorrect||0)/p.questionsAttempted*100):0;
}
function statusClass(status){
  return status==='mastered'?'mastered':status==='completed'?'completed':status==='learning'?'learning':status==='weak'?'weak':'not-started';
}
function sourceLabel(q){
  const src=(q?.source||'').toLowerCase();
  if(src.includes('official'))return 'Official Pearson';
  if(src.includes('ai'))return 'AI-generated practice';
  return q?.source||'Pearson-style practice';
}
function streak(s){
  const set=new Set(s.studyDays||[]); if(!set.size)return 0;
  let n=0,d=new Date();
  for(let i=0;i<500;i++){const k=d.toISOString().slice(0,10);if(set.has(k))n++;else if(i>0)break;d.setDate(d.getDate()-1)}
  return n;
}
function bestStreak(s){
  const dates=[...new Set(s.studyDays||[])].sort(); if(!dates.length)return 0;
  let best=1,run=1;
  for(let i=1;i<dates.length;i++){
    const a=new Date(dates[i-1]+'T00:00:00Z'),b=new Date(dates[i]+'T00:00:00Z');
    if((b-a)/86400000===1){run++;best=Math.max(best,run)}else run=1;
  } return best;
}
function activeMistakes(s){return (s.mistakes||[]).filter(m=>!m.resolved)}
function overdueRevisions(s){return (s.revisions||[]).filter(r=>!r.completedDate&&r.dueDate<=today())}
function metricValue(s,m,metric){
  const p=s.progress[m.id]||{};
  if(metric==='completion')return modulePct(s,m);
  if(metric==='accuracy')return moduleAcc(s,m);
  if(metric==='confidence')return Math.round((p.confidence||0)/5*100);
  if(metric==='recent'){
    const at=(s.attempts||[]).filter(a=>a.moduleId===m.id).slice(0,5); return at.length?Math.round(at.filter(a=>a.correct).length/at.length*100):0;
  }
  if(metric==='theory'){
    const at=(s.attempts||[]).filter(a=>a.moduleId===m.id&&(a.questionType==='theory'||questions.find(q=>q.id===a.questionId)?.type==='theory')).slice(0,10);
    return at.length?Math.round(at.reduce((x,a)=>x+(a.maxScore?100*a.score/a.maxScore:(a.correct?100:0)),0)/at.length):0;
  }
  if(metric==='calculation'){
    const at=(s.attempts||[]).filter(a=>a.moduleId===m.id&&['calculation','ledger'].includes(a.questionType||questions.find(q=>q.id===a.questionId)?.type)).slice(0,10);
    return at.length?Math.round(at.filter(a=>a.correct).length/at.length*100):0;
  }
  return 0;
}
function metricTone(v,hasData=true){
  if(!hasData)return 'none'; if(v>=80)return 'strong'; if(v>=60)return 'good'; if(v>=35)return 'learning'; return 'weak';
}
function stateCounts(s){
  const out={mastered:0,completed:0,learning:0,weak:0,'not-started':0};
  modules.forEach(m=>out[s.progress?.[m.id]?.status||'not-started']++);
  return out;
}
function card(title,body,cls=''){return `<section class="u-card ${cls}"><div class="u-card-head"><h2>${title}</h2></div>${body}</section>`}

function ensureNav(){
  const nav=$('.v3-nav-primary'); if(!nav)return;
  const add=(hash,label,icon,attr)=>{
    if(nav.querySelector(`[${attr}]`))return;
    const a=document.createElement('a'); a.href='#'+hash; a.className='v3-nav-item'; a.setAttribute(attr,'1'); a.innerHTML=`<span>${icon}</span><b>${label}</b>`; nav.appendChild(a);
  };
  add('answerbank','Answer Bank','▣','data-u-answerbank');
  const mock=nav.querySelector('[data-v3-nav-link="mock"] b'); if(mock)mock.textContent='Exam Mode';
  const quick=nav.querySelector('[data-v3-nav-link="quick"] b'); if(quick)quick.textContent='Revision Queue';
  const theory=nav.querySelector('[data-v3-nav-link="theory"] b'); if(theory)theory.textContent='Theory Trainer';
}

function revisionPriority(s){
  const scored=modules.map(m=>{
    const p=s.progress[m.id]||{}, acc=moduleAcc(s,m.id), pct=modulePct(s,m);
    let score=0, reasons=[];
    if(p.status==='weak'){score+=45;reasons.push('marked weak')}
    const mistakes=activeMistakes(s).filter(x=>x.moduleId===m.id).length;
    if(mistakes){score+=Math.min(30,mistakes*8);reasons.push(`${mistakes} active mistake${mistakes===1?'':'s'}`)}
    if(p.questionsAttempted&&acc<60){score+=25;reasons.push(`${acc}% accuracy`)}
    if((p.confidence||3)<=2){score+=15;reasons.push(`confidence ${p.confidence||0}/5`)}
    if(!p.lastStudied&&pct>0){score+=10;reasons.push('not revised recently')}
    const due=(s.revisions||[]).some(r=>r.moduleId===m.id&&!r.completedDate&&r.dueDate<=today());
    if(due){score+=25;reasons.push('revision due')}
    return {m,score,reasons,acc,pct,mistakes};
  }).sort((a,b)=>b.score-a.score);
  return scored;
}
function revisionQueueMarkup(){
  const s=getState(), ranked=revisionPriority(s), priority=ranked.filter(x=>x.score>0).slice(0,6);
  const due=overdueRevisions(s);
  const tasks=[];
  if(priority[0])tasks.push({mins:10,label:priority[0].m.name,detail:priority[0].reasons.slice(0,2).join(' • '),moduleId:priority[0].m.id,type:'topic'});
  if(priority[1])tasks.push({mins:8,label:`5 questions — ${priority[1].m.name}`,detail:'Target the weak area, not random practice.',moduleId:priority[1].m.id,type:'practice'});
  if(due[0])tasks.push({mins:10,label:`Redo scheduled revision — ${moduleById(due[0].moduleId)?.name||due[0].moduleId}`,detail:`${due[0].intervalDays}-day review`,revisionId:due[0].id,type:'revision'});
  tasks.push({mins:12,label:'1 × theory answer',detail:'Use Exam Space Mode and keep the answer concise.',type:'theory'});
  return `<div class="u-page">
    <div class="u-page-head"><div><span>SMART REVISION</span><h1>Today's Revision Queue</h1><p>Built from weak topics, mistakes, due reviews, confidence and recent performance.</p></div><div class="u-pill">${tasks.reduce((a,t)=>a+t.mins,0)} min plan</div></div>
    <div class="u-priority-strip">
      <div class="now"><b>REVISE NOW</b><span>${ranked.filter(x=>x.score>=40).length} modules</span></div>
      <div class="soon"><b>REVISE SOON</b><span>${ranked.filter(x=>x.score>=15&&x.score<40).length} modules</span></div>
      <div class="strong"><b>STRONG</b><span>${ranked.filter(x=>x.score<15&&x.pct>0).length} modules</span></div>
    </div>
    ${card('Today',`<div class="u-task-list">${tasks.map((t,i)=>`<article><div class="u-task-time">${t.mins}<small>min</small></div><div><span>Task ${i+1}</span><h3>${esc(t.label)}</h3><p>${esc(t.detail)}</p></div><div class="u-task-actions">${t.type==='revision'?`<button class="btn btn-primary" data-u-revision-done="${t.revisionId}">Done</button>`:`<a class="btn btn-primary" href="${t.type==='theory'?'#theory':t.type==='practice'?'#practice':'#learn'}" ${t.moduleId?`data-u-open-module="${t.moduleId}"`:''}>Start</a>`}<button class="btn btn-secondary" data-u-feel="${t.moduleId||''}" data-feel="easy">Easy</button><button class="btn btn-secondary" data-u-feel="${t.moduleId||''}" data-feel="hard">Hard</button><button class="btn btn-secondary" data-u-feel="${t.moduleId||''}" data-feel="forgot">Forgot</button></div></article>`).join('')}</div>`)}
    ${card('What should I revise?',`<div class="u-revise-grid">${ranked.slice(0,9).map(x=>`<article class="${x.score>=40?'now':x.score>=15?'soon':'strong'}"><span>${x.score>=40?'Revise now':x.score>=15?'Revise soon':'Strong'}</span><h3>${x.m.code} ${esc(x.m.name)}</h3><p>${esc(x.reasons.join(' • ')||'No urgent warning from your stored data.')}</p><a href="#learn" data-u-open-module="${x.m.id}">Open topic →</a></article>`).join('')}</div>`)}
  </div>`;
}

function mistakeBankMarkup(){
  const s=getState(),items=activeMistakes(s);
  const counts={};items.forEach(m=>counts[m.mistakeType||'unclassified']=(counts[m.mistakeType||'unclassified']||0)+1);
  const common=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
  const categories=['rule','misread','calculation','debit-credit','wrong-format','theory-wording','missing-development','forgot-concept','english','careless','guessed','other','unclassified'];
  return `<div class="u-page">
    <div class="u-page-head"><div><span>SMART MISTAKE BANK</span><h1>Turn mistakes into marks</h1><p>Every mistake stays useful: identify the cause, revise it, then retry it.</p></div><div class="u-pill">${items.length} active</div></div>
    ${common?`<section class="u-common-mistake"><span>MY MOST COMMON MISTAKE</span><h2>${esc(common[0].replaceAll('-',' '))}</h2><b>${common[1]} mistake${common[1]===1?'':'s'}</b></section>`:''}
    <div class="u-filter-row"><label>Filter <select id="u-mistake-filter"><option value="all">All mistake types</option>${categories.map(c=>`<option value="${c}">${esc(c.replaceAll('-',' '))}</option>`).join('')}</select></label></div>
    <div class="u-mistake-list">${items.length?items.map(m=>{
      const q=questions.find(q=>q.id===m.questionId),mo=moduleById(m.moduleId);
      return `<article class="u-mistake" data-u-mistake-type="${esc(m.mistakeType||'unclassified')}">
        <div class="u-mistake-top"><div><span>${esc(m.paper||q?.paper||mo?.paper||'')} • ${esc(m.questionType||q?.type||'question')} • ${m.marks||q?.marks||'?'} mark${(m.marks||q?.marks||1)==1?'':'s'}</span><h3>${esc(q?.question||m.questionId)}</h3></div><b>Wrong ${m.timesWrong||1}×</b></div>
        <div class="u-compare-two"><div><span>Your answer</span><p>${esc(m.userAnswer||'—')}</p></div><div><span>Correct answer</span><p>${esc(m.correctAnswer||'—')}</p></div></div>
        <p class="u-explain">${esc(m.explanation||'No explanation stored yet.')}</p>
        <div class="u-meta-chips"><span>${esc(mo?.code||'')} ${esc(mo?.name||'')}</span><span>${esc(m.difficulty||q?.difficulty||'')}</span><span>Confidence: ${esc(m.confidence||'not recorded')}</span>${m.guessed?'<span>Guessed</span>':''}${m.didNotKnow?'<span>IDK</span>':''}<span>Next: ${esc(m.nextRevisionDate||'not scheduled')}</span></div>
        <div class="u-mistake-actions"><a class="btn btn-primary" href="#practice" data-u-open-module="${m.moduleId}">Retry topic</a><button class="btn btn-secondary" data-u-ask-tutor data-module="${m.moduleId}" data-question="${esc(q?.question||'')}">Ask AI Tutor</button></div>
      </article>`;
    }).join(''):`<div class="u-empty"><b>No active mistakes 🎉</b><p>New incorrect answers will appear here automatically.</p></div>`}</div>
  </div>`;
}

function answerBankMarkup(){
  const s=getState(); s.answerBank=s.answerBank||[];
  const seeds=[
    {id:'prudence',moduleId:'1.2',topic:'Accounting Concepts',title:'Prudence',definition:'Assets and profit should not be overstated, and liabilities and expenses should not be understated, while using an appropriate accounting treatment.',answer2:'Avoid overstating assets or profit and avoid understating liabilities or expenses.',answer3:'Use an appropriate cautious treatment so assets/profit are not overstated and liabilities/expenses are not understated.',answer5:'Apply prudence to the facts of the question; do not simply choose whichever method gives the lowest profit.',mistake:'Prudence does not mean “always make profit as low as possible”.'},
    {id:'consistency',moduleId:'1.2',topic:'Accounting Concepts',title:'Consistency',definition:'Accounting methods should normally be applied consistently from one period to the next.',answer2:'Use the same accounting method between periods so results can be compared.',answer3:'Methods should normally be consistent, but a justified change may be made if another method is more appropriate.',answer5:'Explain the effect of the change on comparability and why the new method is more appropriate; then use it consistently.',mistake:'Do not say an accounting method can never be changed.'},
    {id:'control',moduleId:'3.2',topic:'Control Accounts',title:'Purpose of control accounts',definition:'A control account summarises the total of the related personal ledger accounts.',answer2:'It provides an independent check on the personal ledgers and can help locate errors.',answer3:'It checks the arithmetical accuracy of personal ledgers and gives a quick total for trade receivables or trade payables.',answer5:'For longer questions, link each purpose to how it helps the business, such as locating errors or obtaining quick totals.',mistake:'Do not describe how to prepare the account when the question only asks its purpose.'}
  ];
  const custom=s.answerBank;
  const all=[...seeds,...custom.filter(x=>!seeds.some(s=>s.id===x.id))];
  return `<div class="u-page">
    <div class="u-page-head"><div><span>MY EXAM ANSWER BANK</span><h1>Short answers worth remembering</h1><p>Keep answers concise and suitable for limited exam space.</p></div><button class="btn btn-primary" data-u-add-answer>Add personal answer</button></div>
    <div class="u-answer-search"><input id="u-answer-search" placeholder="Search answer bank..."></div>
    <div class="u-answer-grid">${all.map(a=>{
      const saved=custom.find(x=>x.id===a.id)||a;
      return `<article class="u-answer-card" data-search="${esc((a.title+' '+a.topic).toLowerCase())}">
        <div><span>${esc(a.topic)}</span><h3>${esc(a.title)}</h3></div>
        <p><b>Definition</b>${esc(a.definition||'')}</p><p><b>2-mark answer</b>${esc(a.answer2||'')}</p><p><b>3-mark applied answer</b>${esc(a.answer3||'')}</p><p><b>5-mark evaluation idea</b>${esc(a.answer5||'')}</p><p class="u-warning"><b>Common mistake</b>${esc(a.mistake||'')}</p>
        <div class="u-answer-actions"><button data-u-bank-toggle="${a.id}" data-field="favourite" class="${saved.favourite?'on':''}">★ Favourite</button><button data-u-bank-toggle="${a.id}" data-field="learned" class="${saved.learned?'on':''}">✓ Learned</button><button data-u-bank-toggle="${a.id}" data-field="needsRevision" class="${saved.needsRevision?'on':''}">↻ Needs revision</button></div>
      </article>`;
    }).join('')}</div>
  </div>`;
}

function questionLibraryMarkup(){
  const filtered=questions.filter(q=>(libraryFilter.paper==='all'||q.paper===libraryFilter.paper)&&(libraryFilter.module==='all'||q.moduleId===libraryFilter.module)&&(libraryFilter.type==='all'||q.type===libraryFilter.type)&&(libraryFilter.marks==='all'||String(q.marks)===libraryFilter.marks));
  return `<section class="u-library">
    <div class="u-filter-row four">
      <label>Paper<select id="u-lib-paper"><option value="all">All</option><option value="P1">Paper 1</option><option value="P2">Paper 2</option></select></label>
      <label>Module<select id="u-lib-module"><option value="all">All modules</option>${modules.map(m=>`<option value="${m.id}">${m.code} ${esc(m.name)}</option>`).join('')}</select></label>
      <label>Type<select id="u-lib-type"><option value="all">All</option>${['mcq','short','calculation','theory','ledger'].map(x=>`<option value="${x}">${x}</option>`).join('')}</select></label>
      <label>Marks<select id="u-lib-marks"><option value="all">All</option>${[1,2,3,4,5,6].map(x=>`<option value="${x}">${x}</option>`).join('')}</select></label>
    </div>
    <div class="u-library-list">${filtered.map(q=>{const m=moduleById(q.moduleId);return `<article><div class="u-source ${sourceLabel(q).includes('Official')?'official':''}">${esc(sourceLabel(q))}</div><div><span>${q.year?esc(q.year):'Year —'} • ${q.paper} • ${q.marks} mark${q.marks===1?'':'s'}</span><h3>${esc(q.question)}</h3><p>${esc(m?.code||'')} ${esc(m?.name||'')} • ${esc(q.type)} • ${esc(q.difficulty)}</p></div><button class="btn btn-secondary" data-u-library-practice="${q.id}">Practise</button></article>`}).join('')||'<div class="u-empty">No questions match these filters.</div>'}</div>
  </section>`;
}
function examModeMarkup(){
  const paper=examSession?.paper||'P1';
  if(examSession){
    const q=examSession.questions[examSession.index],answered=Object.keys(examSession.answers).filter(k=>examSession.answers[k]?.trim()).length,total=examSession.questions.length;
    if(examSession.submitted){
      const results=scoreExam(examSession);
      return `<section class="u-exam-result"><div class="u-report-title"><span>${paper==='P1'?'PAPER 1':'PAPER 2'} PRACTICE REPORT</span><h2>${results.score} / ${results.total}</h2><p>${results.total?Math.round(results.score/results.total*100):0}% auto-scored</p></div>
      <div class="u-report-grid"><div><span>Answered</span><b>${answered}/${total}</b></div><div><span>Flagged</span><b>${examSession.flagged.size}</b></div><div><span>Strongest</span><b>${esc(results.strongest||'Not enough data')}</b></div><div><span>Weakest</span><b>${esc(results.weakest||'Not enough data')}</b></div></div>
      <div class="u-disclaimer">This is a local practice simulation, not an official Pearson paper or predicted grade. Written theory may require teacher/mark-scheme review.</div>
      ${card('Top things to fix',`<ol>${results.fix.length?results.fix.map(x=>`<li>${esc(x)}</li>`).join(''):'<li>Build more practice data.</li>'}</ol>`)}
      <button class="btn btn-primary" data-u-exam-exit>Back to Exam Mode</button></section>`;
    }
    return `<section class="u-exam-shell"><div class="u-exam-top"><div><span>${paper==='P1'?'PAPER 1 • 100 marks • 2 hours':'PAPER 2 • 50 marks • 1 hour 15 minutes'}</span><h2>${esc(examSession.mode)}</h2></div><div class="u-timer" data-u-exam-timer>${formatTime(examSession.end-Date.now())}</div></div>
    <div class="u-exam-progress"><i style="width:${total?answered/total*100:0}%"></i></div>
    <div class="u-exam-body"><aside>${examSession.questions.map((x,i)=>`<button data-u-exam-nav="${i}" class="${i===examSession.index?'active':''} ${examSession.answers[x.id]?.trim()?'answered':''} ${examSession.flagged.has(x.id)?'flagged':''}">${i+1}</button>`).join('')}</aside>
    <main><div class="u-exam-qmeta"><span>Question ${examSession.index+1} of ${total}</span><b>${q.marks} mark${q.marks===1?'':'s'}</b></div><h3>${esc(q.question)}</h3>${q.options?`<div class="u-exam-options">${q.options.map(o=>`<label><input type="radio" name="u-exam-opt" value="${esc(o)}" ${examSession.answers[q.id]===o?'checked':''}><span>${esc(o)}</span></label>`).join('')}</div>`:`<textarea id="u-exam-answer" rows="${Math.min(10,Math.max(3,q.marks+2))}" placeholder="Write your answer...">${esc(examSession.answers[q.id]||'')}</textarea>`}<div class="u-exam-buttons"><button class="btn btn-secondary" data-u-flag>${examSession.flagged.has(q.id)?'★ Flagged':'☆ Flag question'}</button><button class="btn btn-secondary" data-u-exam-prev ${examSession.index===0?'disabled':''}>Previous</button><button class="btn btn-primary" data-u-exam-next>${examSession.index===total-1?'Review':'Next'}</button></div></main></div>
    <div class="u-exam-submit"><span>${total-answered} unanswered • ${examSession.flagged.size} flagged</span><button class="btn btn-danger" data-u-exam-submit>Submit exam</button></div></section>`;
  }
  return `<section class="u-exam-launch">
    <div class="u-paper-cards">
      <article><div class="u-paper-tab">PAPER 1</div><h2>Introduction to Bookkeeping and Accounting</h2><div class="u-paper-facts"><b>100 marks</b><b>2 hours</b><b>Topics 1–3</b></div><p>Coverage ${paperCoverage(getState().progress,'P1')}% • Accuracy ${paperAccuracy('P1')}%</p><div class="u-paper-actions"><button class="btn btn-primary" data-u-start-exam="P1" data-mode="Full Paper">Full Paper</button><button class="btn btn-secondary" data-u-start-exam="P1" data-mode="MCQ only">MCQ only</button><button class="btn btn-secondary" data-u-start-exam="P1" data-mode="Short Questions">Short Questions</button></div></article>
      <article><div class="u-paper-tab">PAPER 2</div><h2>Financial Statements</h2><div class="u-paper-facts"><b>50 marks</b><b>1h 15m</b><b>Topics 4–5 + earlier knowledge</b></div><p>Coverage ${paperCoverage(getState().progress,'P2')}% • Accuracy ${paperAccuracy('P2')}%</p><div class="u-paper-actions"><button class="btn btn-primary" data-u-start-exam="P2" data-mode="Full Paper">Full Paper</button><button class="btn btn-secondary" data-u-start-exam="P2" data-mode="Financial statements">Financial statements</button><button class="btn btn-secondary" data-u-start-exam="P2" data-mode="Adjustments">Adjustments</button></div></article>
    </div>
    <div class="u-disclaimer">Exam Mode uses the question bank stored in this project. It does not reproduce an official Pearson examination paper unless a question is explicitly labelled “Official Pearson”.</div>
  </section>`;
}
function examPageMarkup(){
  return `<div class="u-page"><div class="u-page-head"><div><span>EXAM SYSTEM</span><h1>Paper 1 / Paper 2 Exam Mode</h1><p>Timed practice, navigation, flags, unanswered warnings and post-exam analysis.</p></div></div>
  <div class="u-tabs"><button class="${examTab==='mode'?'active':''}" data-u-exam-tab="mode">Exam Mode</button><button class="${examTab==='library'?'active':''}" data-u-exam-tab="library">Question Library</button></div>
  ${examTab==='mode'?examModeMarkup():questionLibraryMarkup()}</div>`;
}
function paperAccuracy(paper){
  const s=getState(),at=(s.attempts||[]).filter(a=>(a.paper||questions.find(q=>q.id===a.questionId)?.paper)===paper);
  return at.length?Math.round(at.filter(a=>a.correct).length/at.length*100):0;
}
function startExam(paper,mode){
  let qs=questions.filter(q=>q.paper===paper);
  if(mode==='MCQ only')qs=qs.filter(q=>q.type==='mcq');
  if(mode==='Short Questions')qs=qs.filter(q=>['short','calculation','ledger'].includes(q.type));
  if(mode==='Financial statements')qs=qs.filter(q=>['4.1','4.2','4.3','4.5'].includes(q.moduleId));
  if(mode==='Adjustments')qs=qs.filter(q=>q.moduleId.startsWith('5.')||['2.5','2.6','2.7'].includes(q.moduleId));
  if(!qs.length)qs=questions.filter(q=>q.paper===paper);
  const duration=paper==='P1'?120*60:75*60;
  examSession={paper,mode,questions:qs.slice(0,paper==='P1'?25:15),index:0,answers:{},flagged:new Set(),start:Date.now(),end:Date.now()+duration*1000,submitted:false};
  startExamTimer(); renderCustom();
}
function formatTime(ms){let s=Math.max(0,Math.floor(ms/1000)),h=Math.floor(s/3600),m=Math.floor(s%3600/60),sec=s%60;return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`}
function startExamTimer(){
  clearInterval(examTimer); if(!examSession)return;
  examTimer=setInterval(()=>{const n=$('[data-u-exam-timer]');if(n)n.textContent=formatTime(examSession.end-Date.now());if(Date.now()>=examSession.end&&!examSession.submitted){submitExam()}},1000);
}
function captureExamAnswer(){
  if(!examSession)return; const q=examSession.questions[examSession.index];
  const ta=$('#u-exam-answer'); if(ta)examSession.answers[q.id]=ta.value;
  const r=$('input[name="u-exam-opt"]:checked'); if(r)examSession.answers[q.id]=r.value;
}
function scoreOne(q,a){if(!a)return 0;const x=normalizeAnswer(a),e=normalizeAnswer(q.answer);if(q.options)return x===e?q.marks:0;const nx=x.match(/-?\d+(?:\.\d+)?/g)?.join('|'),ne=e.match(/-?\d+(?:\.\d+)?/g)?.join('|');return ((nx&&ne&&nx===ne)||x===e)?q.marks:0}
function scoreExam(session){
  let score=0,total=0;const by={};const misses=[];
  session.questions.forEach(q=>{total+=q.marks;const sc=scoreOne(q,session.answers[q.id]||'');score+=sc;const m=moduleById(q.moduleId);const key=m?.name||q.moduleId;by[key]=by[key]||{s:0,t:0};by[key].s+=sc;by[key].t+=q.marks;if(sc<q.marks)misses.push(key)});
  const arr=Object.entries(by).map(([k,v])=>[k,v.t?Math.round(v.s/v.t*100):0]).sort((a,b)=>b[1]-a[1]);
  return {score,total,strongest:arr[0]?.[0],weakest:arr.at(-1)?.[0],fix:[...new Set(misses)].slice(0,3)};
}
function submitExam(){
  captureExamAnswer(); if(!examSession)return; examSession.submitted=true; clearInterval(examTimer);
  const r=scoreExam(examSession),pct=r.total?Math.round(r.score/r.total*100):0;
  saveState(s=>{s.mockResults=s.mockResults||[];s.mockResults.unshift({id:crypto.randomUUID?.()||String(Date.now()),date:new Date().toISOString(),paper:examSession.paper,score:r.score,maxScore:r.total,percentage:pct,timeSeconds:Math.round((Date.now()-examSession.start)/1000),mode:examSession.mode});});
  renderCustom();
}

function aoScores(s){
  const groups={AO1:[],AO2:[],AO3:[]};
  (s.attempts||[]).forEach(a=>{
    let aos=a.assessmentObjectives;
    if(!aos?.length){
      const q=questions.find(q=>q.id===a.questionId),type=a.questionType||q?.type;
      aos=type==='theory'?['AO3']:type==='calculation'||type==='ledger'?['AO2']:['AO1'];
    }
    aos.forEach(ao=>groups[ao]?.push(a.correct?100:(a.maxScore?100*(a.score||0)/a.maxScore:0)));
  });
  return Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,v.length?Math.round(v.reduce((a,b)=>a+b,0)/v.length):0]));
}
function readinessComponents(s){
  const ao=aoScores(s),cov=overallCompletion(s.progress),mastery=masteryCompletion(s.progress);
  const calc=(s.attempts||[]).filter(a=>['calculation','ledger'].includes(a.questionType||questions.find(q=>q.id===a.questionId)?.type));
  const theory=(s.attempts||[]).filter(a=>(a.questionType||questions.find(q=>q.id===a.questionId)?.type)==='theory');
  const mocks=s.mockResults||[];
  const revision=(s.revisions||[]).length?Math.round((s.revisions||[]).filter(r=>r.completedDate).length/s.revisions.length*100):0;
  return {coverage:Math.round(cov),knowledge:ao.AO1,calculations:calc.length?Math.round(calc.filter(a=>a.correct).length/calc.length*100):0,theory:theory.length?Math.round(theory.reduce((z,a)=>z+(a.maxScore?100*a.score/a.maxScore:(a.correct?100:0)),0)/theory.length):0,timed:mocks.length?Math.round(mocks.slice(0,5).reduce((z,x)=>z+(x.percentage??(x.maxScore?100*x.score/x.maxScore:0)),0)/Math.min(5,mocks.length)):0,mastery:Math.round(mastery),revision,weak:modules.filter(m=>s.progress[m.id]?.status==='weak').length};
}
function lineSvg(vals,labels=[]){
  if(vals.length<2)return '<div class="u-empty small">Not enough data yet.</div>';
  const w=520,h=170,p=22,max=Math.max(100,...vals),min=0;
  const pts=vals.map((v,i)=>`${p+(w-2*p)*(i/(vals.length-1))},${h-p-(h-2*p)*((v-min)/(max-min||1))}`).join(' ');
  return `<svg class="u-linechart" viewBox="0 0 ${w} ${h}" role="img"><line x1="${p}" y1="${h-p}" x2="${w-p}" y2="${h-p}"></line><line x1="${p}" y1="${p}" x2="${p}" y2="${h-p}"></line><polyline points="${pts}"></polyline>${vals.map((v,i)=>{const [x,y]=pts.split(' ')[i].split(',');return `<circle cx="${x}" cy="${y}" r="4"><title>${labels[i]||''} ${Math.round(v)}%</title></circle>`}).join('')}</svg>`;
}
function barsMarkup(items){
  if(!items.length)return '<div class="u-empty small">Not enough data yet.</div>';
  return `<div class="u-bars">${items.map(([l,v])=>`<div><span>${esc(l)}</span><i><u style="width:${clamp(v)}%"></u></i><b>${Math.round(v)}%</b></div>`).join('')}</div>`;
}
function radarSvg(values){
  const labels=['Knowledge','Calculations','Double Entry','Formats','MCQ','Theory','Evaluation','Exam Speed'],cx=150,cy=150,r=105;
  const pts=labels.map((_,i)=>{const a=-Math.PI/2+i*2*Math.PI/labels.length;return [cx+Math.cos(a)*r,cy+Math.sin(a)*r]});
  const data=values.map((v,i)=>{const a=-Math.PI/2+i*2*Math.PI/labels.length,rr=r*clamp(v)/100;return [cx+Math.cos(a)*rr,cy+Math.sin(a)*rr]});
  return `<svg class="u-radar" viewBox="0 0 300 300">${[.25,.5,.75,1].map(k=>`<polygon class="grid" points="${pts.map(([x,y])=>`${cx+(x-cx)*k},${cy+(y-cy)*k}`).join(' ')}"></polygon>`).join('')}${pts.map(([x,y])=>`<line class="axis" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"></line>`).join('')}<polygon class="data" points="${data.map(p=>p.join(',')).join(' ')}"></polygon>${labels.map((l,i)=>{const [x,y]=pts[i],dx=x>cx?7:x<cx?-7:0,dy=y>cy?14:y<cy?-7:4;return `<text x="${x+dx}" y="${y+dy}" text-anchor="${x>cx?'start':x<cx?'end':'middle'}">${l}</text>`}).join('')}</svg>`;
}
function skillScores(s){
  const ao=aoScores(s);
  const calc=(s.attempts||[]).filter(a=>['calculation','ledger'].includes(a.questionType||questions.find(q=>q.id===a.questionId)?.type));
  const mcq=(s.attempts||[]).filter(a=>(a.questionType||questions.find(q=>q.id===a.questionId)?.type)==='mcq');
  const th=(s.attempts||[]).filter(a=>(a.questionType||questions.find(q=>q.id===a.questionId)?.type)==='theory');
  const moduleScore=(ids)=>{const at=(s.attempts||[]).filter(a=>ids.includes(a.moduleId));return at.length?Math.round(at.filter(a=>a.correct).length/at.length*100):0};
  const speed=(s.attempts||[]).filter(a=>a.timeSeconds).length?Math.round(100-(s.attempts||[]).filter(a=>a.timeSeconds).reduce((z,a)=>z+Math.min(100,(a.timeSeconds/180)*100),0)/(s.attempts||[]).filter(a=>a.timeSeconds).length):0;
  return [ao.AO1,calc.length?Math.round(calc.filter(a=>a.correct).length/calc.length*100):0,moduleScore(['2.3','3.2','3.3']),moduleScore(['2.2','2.3','3.2','3.4','4.1','4.2']),mcq.length?Math.round(mcq.filter(a=>a.correct).length/mcq.length*100):0,th.length?Math.round(th.filter(a=>a.correct).length/th.length*100):0,ao.AO3,speed];
}
function analyticsMarkup(){
  const s=getState(),ao=aoScores(s),r=readinessComponents(s),counts=stateCounts(s);
  const mocks=(s.mockResults||[]).slice().reverse();
  const topicBars=topics.map(t=>[`${t.id}. ${t.name}`,topicAccuracy(s,t.id)]);
  const attemptVals=(s.attempts||[]).slice(0,20).reverse();let running=[],c=0;attemptVals.forEach((a,i)=>{if(a.correct)c++;running.push(Math.round(c/(i+1)*100))});
  const masteryTotal=modules.length;
  const p1=paperAccuracy('P1'),p2=paperAccuracy('P2');
  const studyByWeek=weeklyStudy(s);
  const skills=skillScores(s);
  return `<div class="u-page">
    <div class="u-page-head"><div><span>REAL ANALYTICS</span><h1>What your stored data says</h1><p>Charts use your real website data. Empty charts stay empty instead of inventing results.</p></div><div class="u-pill">Internal study metrics</div></div>
    <section class="u-readiness"><div><span>EXAM READINESS</span><strong>${examReadiness(s)}%</strong><p>Internal study metric — not an official predicted grade.</p></div><div class="u-ready-components">${[['Syllabus coverage',r.coverage],['Knowledge',r.knowledge],['Calculations',r.calculations],['Theory writing',r.theory],['Timed paper performance',r.timed],['Revision completion',r.revision]].map(([l,v])=>`<div><span>${l}</span><i><u style="width:${v}%"></u></i><b>${v}%</b></div>`).join('')}<div><span>Weak topics remaining</span><b>${r.weak}</b></div></div></section>
    <div class="u-ao-grid">${[['AO1','Knowledge & understanding',ao.AO1],['AO2','Application & procedures',ao.AO2],['AO3','Analysis, evaluation & presentation',ao.AO3]].map(([a,l,v])=>`<article><span>${a}</span><strong>${v}%</strong><p>${l}</p><i><u style="width:${v}%"></u></i></article>`).join('')}</div>
    <div class="u-chart-grid">
      ${card('Mock score over time',mocks.length?lineSvg(mocks.map(x=>x.percentage??(x.maxScore?100*x.score/x.maxScore:0)),mocks.map(x=>x.date?.slice(0,10))):'<div class="u-empty small">No mock results yet.</div>','u-chart')}
      ${card('Accuracy by topic',barsMarkup(topicBars),'u-chart')}
      ${card('Mastery breakdown',`<div class="u-donut-wrap"><div class="u-donut" style="--mastered:${counts.mastered/masteryTotal*100};--completed:${(counts.mastered+counts.completed)/masteryTotal*100};--learning:${(counts.mastered+counts.completed+counts.learning)/masteryTotal*100};--weak:${(counts.mastered+counts.completed+counts.learning+counts.weak)/masteryTotal*100}"><span>${counts.mastered}<small>mastered</small></span></div><div class="u-legend"><span class="mastered">Mastered ${counts.mastered}</span><span class="completed">Completed ${counts.completed}</span><span class="learning">Learning ${counts.learning}</span><span class="weak">Weak ${counts.weak}</span><span>Not started ${counts['not-started']}</span></div></div>`,'u-chart')}
      ${card('Paper 1 vs Paper 2',barsMarkup([['Paper 1 accuracy',p1],['Paper 2 accuracy',p2],['Paper 1 coverage',paperCoverage(s.progress,'P1')],['Paper 2 coverage',paperCoverage(s.progress,'P2')]]),'u-chart')}
      ${card('Question accuracy over time',running.length>1?lineSvg(running):'<div class="u-empty small">Answer more questions to see a trend.</div>','u-chart')}
      ${card('Study time by week',studyByWeek.length?`<div class="u-week-bars">${studyByWeek.map(([l,v])=>`<div><b>${v}</b><i style="height:${Math.max(5,v/Math.max(...studyByWeek.map(x=>x[1]),1)*100)}%"></i><span>${l}</span></div>`).join('')}</div>`:'<div class="u-empty small">Log study sessions to build this chart.</div>','u-chart')}
    </div>
    ${card('Accounting skills radar',`<div class="u-radar-wrap">${radarSvg(skills)}<div><p>Clicking detailed skill drill-down will be based on the same stored attempts and module progress.</p><div class="u-skill-list">${['Knowledge','Calculations','Double Entry','Accounting Formats','MCQ','Theory Writing','Evaluation','Exam Speed'].map((l,i)=>`<button data-u-skill="${i}"><span>${l}</span><b>${skills[i]}%</b></button>`).join('')}</div><div id="u-skill-detail"></div></div></div>`)}
    ${heatmapMarkup(s)}
    ${scoreImprovementMarkup(s)}
  </div>`;
}
function topicAccuracy(s,id){
  const ids=modules.filter(m=>m.topicId===id).map(m=>m.id),at=(s.attempts||[]).filter(a=>ids.includes(a.moduleId));
  return at.length?Math.round(at.filter(a=>a.correct).length/at.length*100):0;
}
function weeklyStudy(s){
  const out={};
  (s.studyActivity||[]).forEach(a=>{const d=new Date(a.date),start=new Date(d);start.setDate(d.getDate()-((d.getDay()+6)%7));const k=start.toISOString().slice(5,10);out[k]=(out[k]||0)+(a.minutes||0)});
  return Object.entries(out).sort((a,b)=>a[0].localeCompare(b[0])).slice(-8);
}
function heatmapMarkup(s){
  const options=[['completion','Syllabus completion'],['accuracy','Question accuracy'],['confidence','Confidence'],['recent','Recent performance'],['theory','Theory ability'],['calculation','Calculation ability']];
  return card('Weakness heatmap',`<div class="u-tabs small">${options.map(([v,l])=>`<button data-u-heat="${v}" class="${heatMetric===v?'active':''}">${l}</button>`).join('')}</div><div class="u-heat-grid">${modules.map(m=>{const v=metricValue(s,m,heatMetric),has=heatMetric==='completion'||heatMetric==='confidence'||(s.progress[m.id]?.questionsAttempted||0)>0;return `<button class="${metricTone(v,has)}" data-u-open-module="${m.id}" title="${esc(m.name)} • ${v}%"><b>${m.code}</b><span>${v}%</span><small>${esc(m.name)}</small></button>`}).join('')}</div>`);
}
function scoreImprovementMarkup(s){
  const rows=modules.map(m=>{const at=(s.attempts||[]).filter(a=>a.moduleId===m.id).slice().reverse();if(at.length<2)return null;const scores=at.map(a=>a.correct?100:(a.maxScore?100*(a.score||0)/a.maxScore:0));return {m,first:Math.round(scores[0]),current:Math.round(scores.at(-1)),best:Math.round(Math.max(...scores)),scores}}).filter(Boolean).slice(0,8);
  return card('Score improvement',rows.length?`<div class="u-improve-list">${rows.map(x=>`<article><div><b>${x.m.code} ${esc(x.m.name)}</b><span>First ${x.first}% • Current ${x.current}% • Best ${x.best}%</span></div>${lineSvg(x.scores.slice(-8))}</article>`).join('')}</div>`:'<div class="u-empty small">Repeat topics to see first, current and best scores.</div>');
}

function monthCalendarMarkup(s){
  const now=new Date(),base=new Date(now.getFullYear(),now.getMonth()+calendarOffset,1),y=base.getFullYear(),m=base.getMonth(),days=new Date(y,m+1,0).getDate(),start=(new Date(y,m,1).getDay()+6)%7;
  const activity={};(s.studyActivity||[]).forEach(a=>{const k=a.date.slice(0,10);activity[k]=activity[k]||{minutes:0,questions:0,topics:0};activity[k].minutes+=a.minutes||0;activity[k].questions+=a.questions||0;activity[k].topics+=a.topicsRevised||0});
  (s.studyDays||[]).forEach(k=>activity[k]=activity[k]||{minutes:0,questions:0,topics:0});
  const cells=Array(start).fill('<span class="u-cal blank"></span>');
  for(let d=1;d<=days;d++){const k=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`,a=activity[k],intensity=!a?0:a.minutes>=60?4:a.minutes>=30?3:a.minutes>=10?2:1;cells.push(`<span class="u-cal i${intensity}" title="${k} • ${a?.minutes||0} minutes • ${a?.questions||0} questions • ${a?.topics||0} topics">${d}</span>`)}
  const month=base.toLocaleDateString(undefined,{month:'long',year:'numeric'});
  return `<section class="u-calendar"><div class="u-calendar-head"><button data-u-cal="-1">‹</button><h3>${month}</h3><button data-u-cal="1">›</button></div><div class="u-weeknames">${['M','T','W','T','F','S','S'].map(x=>`<span>${x}</span>`).join('')}</div><div class="u-calendar-grid">${cells.join('')}</div><div class="u-calendar-stats"><div><b>${streak(s)}</b><span>Current streak</span></div><div><b>${bestStreak(s)}</b><span>Best streak</span></div><div><b>${Object.keys(activity).filter(k=>k.startsWith(`${y}-${String(m+1).padStart(2,'0')}`)).length}</b><span>Study days</span></div><div><b>${s.studyMinutesTotal||0}</b><span>Total minutes</span></div></div></section>`;
}
function masteryMapMarkup(s,limit=false){
  const list=limit?modules.slice(0,24):modules;
  return `<div class="u-mastery-grid">${list.map(m=>{const p=s.progress[m.id]||{},pct=modulePct(s,m),acc=moduleAcc(s,m.id);return `<button class="${statusClass(p.status)}" data-u-open-module="${m.id}" title="${esc(m.name)} • ${pct}% complete • confidence ${p.confidence||0}/5 • accuracy ${acc}%"><b>${m.code}</b><span>${pct}%</span><small>${esc(m.name)}</small></button>`}).join('')}</div>`;
}
function journeyMarkup(s){
  const c=overallCompletion(s.progress),at=(s.attempts||[]).length,rev=(s.revisions||[]).filter(r=>r.completedDate).length,mocks=(s.mockResults||[]).length,ready=examReadiness(s);
  let stage=0;if(c>0)stage=1;if(at>=10)stage=2;if(rev>=3)stage=3;if(mocks>=1)stage=4;if(ready>=75)stage=5;if(c>=100&&ready>=85)stage=6;
  const labels=['Start','Learn','Practice','Revise','Papers','Ready','Exam'];
  return `<section class="u-journey">${labels.map((l,i)=>`<div class="${i<stage?'done':i===stage?'current':''}"><i>${i<stage?'✓':i===6?'★':i+1}</i><span>${l}</span></div>${i<labels.length-1?'<b></b>':''}`).join('')}</section>`;
}
function weakCardsMarkup(s){
  const ranked=revisionPriority(s).filter(x=>x.score>0).slice(0,3);
  return `<div class="u-weak-cards">${ranked.length?ranked.map(x=>`<article><span>NEEDS ATTENTION</span><h3>${x.m.code} ${esc(x.m.name)}</h3><p>${x.acc||0}% accuracy • ${x.mistakes} recent/active mistake${x.mistakes===1?'':'s'}</p><a href="#learn" data-u-open-module="${x.m.id}">Fix this topic →</a></article>`).join(''):'<div class="u-empty small">No urgent weak area from your current data.</div>'}</div>`;
}
function dashboardAugment(){
  const host=$('.v3-dashboard');if(!host||host.querySelector('.u-journey'))return;
  const s=getState(),lower=$('.v3-lower-grid',host);
  const html=`<section class="u-dashboard-section"><div class="u-section-title"><div><span>YOUR JOURNEY</span><h2>Journey to the Exam</h2></div></div>${journeyMarkup(s)}</section>
  <section class="u-dashboard-section"><div class="u-section-title"><div><span>TODAY'S PRIORITY</span><h2>${esc(revisionPriority(s)[0]?.m?.name||'Continue your syllabus')}</h2></div><a href="#revision">Open revision queue →</a></div><p class="u-priority-copy">${esc(revisionPriority(s)[0]?.reasons?.join(' • ')||'Keep moving through the next incomplete syllabus skill.')}</p></section>
  <section class="u-dashboard-section"><div class="u-section-title"><div><span>24 MODULES</span><h2>Mastery Map</h2></div><a href="#analytics">Full analytics →</a></div>${masteryMapMarkup(s,true)}</section>
  <section class="u-dashboard-section"><div class="u-section-title"><div><span>WEAK AREAS</span><h2>Needs attention</h2></div></div>${weakCardsMarkup(s)}</section>`;
  if(lower)lower.insertAdjacentHTML('beforebegin',html);else host.insertAdjacentHTML('beforeend',html);
}
function topicDiagram(id){
  if(id==='2.3')return `<div class="u-diagram"><h3>Double entry</h3><div class="u-flowline"><span>Transaction</span><b>→</b><span>DEBIT</span><b>+</b><span>CREDIT</span></div><p>Every transaction has two entries.</p></div>`;
  if(id==='3.2')return `<div class="u-diagram"><h3>Control accounts</h3><div class="u-taccounts"><div><b>Trade Receivables Control</b><i>Debit side</i><i>Credit side</i></div><div><b>Trade Payables Control</b><i>Debit side</i><i>Credit side</i></div></div></div>`;
  if(id==='3.4')return `<div class="u-diagram"><h3>Bank reconciliation flow</h3><div class="u-flowline vertical"><span>Cash Book</span><b>↓</b><span>Update bank-originated entries</span><b>↓</b><span>Adjusted Cash Book</span><b>↓</b><span>Timing differences</span><b>↓</b><span>Bank Reconciliation Statement</span></div></div>`;
  if(id==='2.5'||id==='5.2')return `<div class="u-diagram"><h3>Depreciation pattern</h3><svg viewBox="0 0 420 180" class="u-dep-chart"><line x1="40" y1="20" x2="40" y2="150"></line><line x1="40" y1="150" x2="400" y2="150"></line><polyline class="sl" points="40,30 130,60 220,90 310,120 390,145"></polyline><polyline class="rb" points="40,30 130,82 220,112 310,130 390,140"></polyline><text x="260" y="78">Straight line</text><text x="260" y="128">Reducing balance</text></svg></div>`;
  if(id==='4.1')return `<div class="u-diagram"><h3>Income statement flow</h3><div class="u-flowline vertical"><span>Revenue</span><b>↓</b><span>Cost of sales</span><b>↓</b><span>Gross profit</span><b>↓</b><span>Expenses</span><b>↓</b><span>Profit for the year</span></div></div>`;
  if(id==='4.2')return `<div class="u-diagram"><h3>Partnership appropriation</h3><div class="u-flowline vertical"><span>Profit</span><b>↓</b><span>Interest on capital / salary</span><b>↓</b><span>Remaining profit</span><b>↓</b><span>Profit-sharing ratio</span></div></div>`;
  return '';
}
function augmentLearn(){
  const host=$('.content');if(!host)return;
  const select=$('#learn-module');if(!select)return;
  const requested=sessionStorage.getItem('am-open-module');if(requested&&select.value!==requested){select.value=requested;select.dispatchEvent(new Event('change',{bubbles:true}));sessionStorage.removeItem('am-open-module');return}
  if(host.querySelector('.u-learning-diagram'))return;
  const d=topicDiagram(select.value); if(!d)return;
  const el=document.createElement('section');el.className='u-learning-diagram';el.innerHTML=d;
  const tabs=$('.v3-learning-tabs',host)||$('.page-subhead',host);tabs?.insertAdjacentElement('afterend',el);
}
function achievementData(s){
  const attempts=s.attempts||[],mocks=s.mockResults||[],resolved=(s.mistakes||[]).filter(m=>m.resolved).length;
  const last10=attempts.filter(a=>(a.questionType||questions.find(q=>q.id===a.questionId)?.type)==='mcq').slice(0,10);
  return [
    ['First Lesson Complete','✓',modules.some(m=>modulePct(s,m)>0)],
    ['First Module Mastered','★',modules.some(m=>s.progress[m.id]?.status==='mastered')],
    ['First 10 MCQs','10',attempts.filter(a=>(a.questionType||questions.find(q=>q.id===a.questionId)?.type)==='mcq').length>=10],
    ['100 Questions','100',attempts.length>=100],
    ['Perfect 10 MCQs','◎',last10.length===10&&last10.every(a=>a.correct)],
    ['7-Day Streak','🔥',streak(s)>=7],
    ['14-Day Streak','🔥',streak(s)>=14],
    ['First Past Paper','▧',mocks.length>=1],
    ['First 80% Mock','80',mocks.some(x=>(x.percentage??0)>=80)],
    ['Paper 1 Syllabus Complete','P1',paperCoverage(s.progress,'P1')>=100],
    ['Paper 2 Core Complete','P2',paperCoverage(s.progress,'P2')>=100],
    ['Zero Overdue Revision','✓',(s.revisions||[]).length>0&&overdueRevisions(s).length===0],
    ['All Accounting Concepts Mastered','A',s.progress['1.2']?.status==='mastered'],
    ['Comeback — Weak Topic Mastered','↗',resolved>0]
  ];
}
function profileAugment(){
  const host=$('.content');if(!host||host.querySelector('.u-trophy'))return;
  const s=getState(),a=achievementData(s);const sec=document.createElement('section');sec.className='u-trophy u-card';sec.innerHTML=`<div class="u-card-head"><h2>Trophy Cabinet</h2><span>${a.filter(x=>x[2]).length}/${a.length} unlocked</span></div><div class="u-badges">${a.map(([n,icon,on])=>`<article class="${on?'unlocked':'locked'}"><i>${icon}</i><b>${esc(n)}</b><span>${on?'Unlocked':'Locked'}</span></article>`).join('')}</div>`;host.appendChild(sec);
}
function tutorMarkup(){
  const s=getState(),ctx=tutorContext||JSON.parse(sessionStorage.getItem('am-tutor-context')||'null'),m=moduleById(ctx?.moduleId||tutorModule)||modules[0];
  return `<div class="u-page"><div class="u-page-head"><div><span>ONE-CLICK AI TUTOR</span><h1>Accounting Tutor Context</h1><p>The website automatically carries the topic/question context here.</p></div><div class="u-pill">${esc(m.code)} ${esc(m.name)}</div></div>
  <section class="u-tutor-context"><label>Module<select id="u-tutor-module">${modules.map(x=>`<option value="${x.id}" ${x.id===m.id?'selected':''}>${x.code} ${esc(x.name)}</option>`).join('')}</select></label>${ctx?.question?`<div><span>Question</span><p>${esc(ctx.question)}</p></div>`:''}${ctx?.studentAnswer?`<div><span>Your answer</span><p>${esc(ctx.studentAnswer)}</p></div>`:''}${ctx?.correctAnswer?`<div><span>Correct answer</span><p>${esc(ctx.correctAnswer)}</p></div>`:''}</section>
  <div class="u-tutor-buttons">${['Explain simply','Explain even simpler','Show an example','Why is my answer wrong?','Teach me the rule','Give me another question','Help me write the exam answer'].map(x=>`<button data-u-tutor-action="${esc(x)}">${x}</button>`).join('')}</div>
  <section class="u-tutor-reply">${tutorReply?`<h3>${esc(tutorReply.title)}</h3><p>${esc(tutorReply.text)}</p>`:`<div class="u-empty"><b>Choose what you need help with.</b><p>The current project has no external AI provider connected, so this page can prepare context and local coaching prompts but cannot call a live AI model yet.</p></div>`}</section></div>`;
}
function localTutorReply(action,m,ctx){
  const first=(moduleChecklists[m.id]||m.officialPoints||[])[0]||m.focus;
  if(action==='Explain simply')return {title:'Simple explanation',text:`This topic is ${m.name}. Start with this skill: ${first}. Focus on what the question is asking, then apply that accounting rule.`};
  if(action==='Explain even simpler')return {title:'Even simpler',text:`Think of ${m.name} as one job. Your job is: ${first}. Do that one job first before adding extra detail.`};
  if(action==='Show an example')return {title:'Example',text:`Use a small example for ${m.name}: identify the rule, apply it to one simple transaction or figure, then check the effect on the account or financial statement.`};
  if(action==='Why is my answer wrong?')return {title:'Why it may be wrong',text:ctx?.correctAnswer?`Compare your answer with the expected answer. Look for the missing rule, figure, format or development. Expected answer: ${ctx.correctAnswer}`:'Open a recorded mistake so the tutor can receive your answer and the correct answer automatically.'};
  if(action==='Teach me the rule')return {title:'Rule to learn',text:first};
  if(action==='Give me another question')return {title:'Next question',text:questions.find(q=>q.moduleId===m.id)?.question||`No local question is bundled for ${m.name} yet.`};
  return {title:'Exam answer help',text:`First write the exact accounting point. Then develop it with “because / therefore / this means” if the command word needs explanation. Keep it within the marks and answer space.`};
}

function markComparisonAugment(){
  if(page()!=='theory')return;const host=$('.p2-page');if(!host||host.querySelector('.u-mark-compare'))return;
  const ta=$('#p2-theory-answer')||$('#theory-answer'); if(!ta)return;
  const sec=document.createElement('section');sec.className='u-mark-compare';
  sec.innerHTML=`<div class="u-card-head"><h2>Mark Scheme Comparison View</h2><span>Suggested analysis — not an official Pearson allocation</span></div><div class="u-compare-four"><div><b>Your answer</b><p data-u-your-answer>${esc(ta.value||'Write your answer above.')}</p></div><div class="credit"><b>What may earn credit</b><p>Relevant accounting point + correct development/application.</p></div><div class="missing"><b>What may be missing</b><p>Check for explanation, application and a justified conclusion where the command word requires it.</p></div><div class="improve"><b>Improved answer</b><p>Use the simplest answer shown by the Theory Trainer after analysis.</p></div></div><div class="u-colour-key"><span class="green">Green = creditworthy</span><span class="yellow">Yellow = partly developed</span><span class="red">Red = incorrect/irrelevant</span><span class="blue">Blue = improvement</span></div>`;
  host.appendChild(sec);
  ta.addEventListener('input',()=>{const p=sec.querySelector('[data-u-your-answer]');if(p)p.textContent=ta.value||'Write your answer above.'});
}

function renderCustom(){
  const content=$('.content');if(!content)return;
  const p=page();
  if(p==='mistakes'){content.innerHTML=mistakeBankMarkup();bind();return}
  if(p==='revision'||p==='quick'){content.innerHTML=revisionQueueMarkup();bind();return}
  if(p==='answerbank'){content.innerHTML=answerBankMarkup();bind();return}
  if(p==='mock'){content.innerHTML=examPageMarkup();bind();return}
  if(p==='analytics'){content.innerHTML=analyticsMarkup();bind();return}
  if(p==='ai'){content.innerHTML=tutorMarkup();bind();return}
}
function augmentDashboard(){
  dashboardAugment();
  const host=$('.v3-dashboard');if(!host||host.querySelector('.u-calendar-dashboard'))return;
  const s=getState();const wrap=document.createElement('section');wrap.className='u-dashboard-section u-calendar-dashboard';wrap.innerHTML=`<div class="u-section-title"><div><span>STUDY CALENDAR</span><h2>Your Study Activity</h2></div></div>${monthCalendarMarkup(s)}`;host.appendChild(wrap);bind();
}
function checkCelebration(){
  const s=getState(),snapshot=JSON.parse(sessionStorage.getItem('am-status-snapshot')||'{}'),next={};let msg='';
  modules.forEach(m=>{next[m.id]=s.progress[m.id]?.status;const old=snapshot[m.id],now=next[m.id];if(old&&old!==now&&(now==='completed'||now==='mastered'))msg=now==='mastered'?`${m.code} ${m.name} mastered ★`:`${m.code} ${m.name} completed ✓`});
  sessionStorage.setItem('am-status-snapshot',JSON.stringify(next));
  if(msg&&!document.querySelector('.u-celebrate')){const el=document.createElement('div');el.className='u-celebrate';el.innerHTML=`<b>${esc(msg)}</b>`;document.body.appendChild(el);setTimeout(()=>el.remove(),1800)}
}

function enhance(){
  if(applying)return;applying=true;
  try{
    ensureNav();
    const p=page();
    if(['mistakes','revision','quick','answerbank','mock','analytics','ai'].includes(p)){renderCustom();}
    if(p==='dashboard')augmentDashboard();
    if(p==='learn')augmentLearn();
    if(p==='profile')profileAugment();
    if(p==='theory')markComparisonAugment();
    checkCelebration();
  }finally{applying=false}
}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;enhance()})}

function bind(){
  $$('[data-u-open-module]').forEach(a=>a.onclick=()=>{const id=a.dataset.uOpenModule;if(id)sessionStorage.setItem('am-open-module',id)});
  $('#u-mistake-filter')?.addEventListener('change',e=>{$$('.u-mistake').forEach(x=>x.hidden=e.target.value!=='all'&&x.dataset.uMistakeType!==e.target.value)});
  $$('[data-u-ask-tutor]').forEach(b=>b.onclick=()=>{const m=activeMistakes(getState()).find(x=>x.moduleId===b.dataset.module);tutorContext={moduleId:b.dataset.module,question:b.dataset.question,studentAnswer:m?.userAnswer,correctAnswer:m?.correctAnswer};sessionStorage.setItem('am-tutor-context',JSON.stringify(tutorContext));location.hash='ai'});
  $$('[data-u-revision-done]').forEach(b=>b.onclick=()=>{completeRevision(b.dataset.uRevisionDone);renderCustom()});
  $$('[data-u-feel]').forEach(b=>b.onclick=()=>{const id=b.dataset.uFeel,feel=b.dataset.feel;if(!id)return;saveState(s=>{const p=s.progress[id];if(!p)return;if(feel==='forgot'){p.status='weak';p.confidence=1}else if(feel==='hard'){p.confidence=Math.max(1,(p.confidence||3)-1)}else if(feel==='easy'){p.confidence=Math.min(5,(p.confidence||3)+1)}});renderCustom()});
  $('#u-answer-search')?.addEventListener('input',e=>{$$('.u-answer-card').forEach(c=>c.hidden=!c.dataset.search.includes(e.target.value.toLowerCase()))});
  $$('[data-u-bank-toggle]').forEach(b=>b.onclick=()=>{const id=b.dataset.uBankToggle,field=b.dataset.field;saveState(s=>{s.answerBank=s.answerBank||[];let item=s.answerBank.find(x=>x.id===id);if(!item){const seed=id==='prudence'?{id,title:'Prudence',topic:'Accounting Concepts',moduleId:'1.2'}:id==='consistency'?{id,title:'Consistency',topic:'Accounting Concepts',moduleId:'1.2'}:{id,title:'Purpose of control accounts',topic:'Control Accounts',moduleId:'3.2'};item={...seed};s.answerBank.push(item)}item[field]=!item[field]});renderCustom()});
  $('[data-u-add-answer]')?.addEventListener('click',()=>{const title=prompt('Short title for your answer?');if(!title)return;const body=prompt('Your exam-safe answer?')||'';saveState(s=>{s.answerBank=s.answerBank||[];s.answerBank.push({id:'personal-'+Date.now(),title,topic:'Personal',definition:body,answer2:body,answer3:body,answer5:body,mistake:'',favourite:false,learned:false,needsRevision:true})});renderCustom()});
  $$('[data-u-exam-tab]').forEach(b=>b.onclick=()=>{examTab=b.dataset.uExamTab;renderCustom()});
  $$('[data-u-start-exam]').forEach(b=>b.onclick=()=>startExam(b.dataset.uStartExam,b.dataset.mode));
  $$('[data-u-exam-nav]').forEach(b=>b.onclick=()=>{captureExamAnswer();examSession.index=Number(b.dataset.uExamNav);renderCustom()});
  $('[data-u-exam-prev]')?.addEventListener('click',()=>{captureExamAnswer();examSession.index=Math.max(0,examSession.index-1);renderCustom()});
  $('[data-u-exam-next]')?.addEventListener('click',()=>{captureExamAnswer();examSession.index=Math.min(examSession.questions.length-1,examSession.index+1);renderCustom()});
  $('[data-u-flag]')?.addEventListener('click',()=>{const q=examSession.questions[examSession.index];examSession.flagged.has(q.id)?examSession.flagged.delete(q.id):examSession.flagged.add(q.id);renderCustom()});
  $('[data-u-exam-submit]')?.addEventListener('click',()=>{captureExamAnswer();const unanswered=examSession.questions.filter(q=>!examSession.answers[q.id]?.trim()).length;if(unanswered&&!confirm(`${unanswered} questions are unanswered. Submit anyway?`))return;submitExam()});
  $('[data-u-exam-exit]')?.addEventListener('click',()=>{examSession=null;renderCustom()});
  $$('input[name="u-exam-opt"]').forEach(r=>r.onchange=()=>{const q=examSession.questions[examSession.index];examSession.answers[q.id]=r.value});
  $('#u-lib-paper')?.addEventListener('change',e=>{libraryFilter.paper=e.target.value;renderCustom()});
  $('#u-lib-module')?.addEventListener('change',e=>{libraryFilter.module=e.target.value;renderCustom()});
  $('#u-lib-type')?.addEventListener('change',e=>{libraryFilter.type=e.target.value;renderCustom()});
  $('#u-lib-marks')?.addEventListener('change',e=>{libraryFilter.marks=e.target.value;renderCustom()});
  $$('[data-u-library-practice]').forEach(b=>b.onclick=()=>{location.hash='practice'});
  $$('[data-u-heat]').forEach(b=>b.onclick=()=>{heatMetric=b.dataset.uHeat;renderCustom()});
  $$('[data-u-skill]').forEach(b=>b.onclick=()=>{const labels=['Knowledge','Calculations','Double Entry','Accounting Formats','MCQ','Theory Writing','Evaluation','Exam Speed'],i=Number(b.dataset.uSkill),v=skillScores(getState())[i],d=$('#u-skill-detail');if(d)d.innerHTML=`<div class="u-skill-detail"><b>${labels[i]} — ${v}%</b><p>This internal score is calculated from your stored question attempts and progress. Improve it by practising related weak modules and reviewing mistakes.</p></div>`});
  $$('[data-u-cal]').forEach(b=>b.onclick=()=>{calendarOffset+=Number(b.dataset.uCal); if(page()==='analytics')renderCustom(); else {const c=$('.u-calendar-dashboard');if(c)c.innerHTML=`<div class="u-section-title"><div><span>STUDY CALENDAR</span><h2>Your Study Activity</h2></div></div>${monthCalendarMarkup(getState())}`;bind()}});
  $('#u-tutor-module')?.addEventListener('change',e=>{tutorModule=e.target.value;tutorContext={moduleId:tutorModule};renderCustom()});
  $$('[data-u-tutor-action]').forEach(b=>b.onclick=()=>{const ctx=tutorContext||JSON.parse(sessionStorage.getItem('am-tutor-context')||'null')||{},m=moduleById(ctx.moduleId||tutorModule)||modules[0];tutorReply=localTutorReply(b.dataset.uTutorAction,m,ctx);renderCustom()});
}

new MutationObserver(schedule).observe(document.getElementById('app'),{childList:true,subtree:true});
window.addEventListener('hashchange',()=>{if(examSession&&page()!=='mock'){clearInterval(examTimer);examSession=null}schedule()});
schedule();
