import { moduleChecklists, modules, questions } from './data.js';
import type { AppState, AttemptMeta, MistakeType, ModuleProgress, ModuleStatus, NoteRecord, Profile, Settings, SkillState, StudyActivityRecord } from './types.js';
import { addDays, today, uid } from './utils.js';

export const STORAGE_KEY='accounting-mastery-hub-v1';
export const APP_VERSION=3;
let state:AppState;
let subscribers:(()=>void)[]=[];

function checklistTemplate(moduleId:string,fill=false){
  const items=moduleChecklists[moduleId]??modules.find(m=>m.id===moduleId)?.officialPoints??[];
  return Object.fromEntries(items.map((_,i)=>[`c${i}`,fill]));
}
function skillStateTemplate(moduleId:string,fill=false){
  const items=moduleChecklists[moduleId]??modules.find(m=>m.id===moduleId)?.officialPoints??[];
  return Object.fromEntries(items.map((_,i)=>[`c${i}`,fill?'can-do-alone':'not-started' as SkillState]));
}
function defaultProgress():Record<string,ModuleProgress>{
  return Object.fromEntries(modules.map(m=>[m.id,{
    status:'not-started',
    confidence:3,
    masteryScore:0,
    questionsAttempted:0,
    questionsCorrect:0,
    weakSubtopics:[],
    checklist:checklistTemplate(m.id),
    skillStates:skillStateTemplate(m.id)
  }]));
}
export function createDefaultState():AppState{
  return{
    version:APP_VERSION,
    progress:defaultProgress(),
    attempts:[],
    mistakes:[],
    revisions:[],
    notes:[],
    history:[],
    profile:{name:'Student',targetGrade:'9',examDatePaper1:'2026-10-28',examDatePaper2:'2026-11-05',dailyStudyMinutes:60,preferredLessonStyle:'exam-focused',preferredLanguage:'english'},
    settings:{theme:'light',compact:false,mode:'learning',language:'english',fontScale:'normal',reducedMotion:false},
    studyMinutesTotal:0,
    studyDays:[],
    studyActivity:[],
    answerBank:[],
    mockResults:[],
    achievements:[],
    examEnglish:{completed:[],quizAttempts:0,correct:0},
    aoScores:{AO1:0,AO2:0,AO3:0}
  }
}
function merge(partial:Partial<AppState>):AppState{
  const base=createDefaultState();
  const valid=new Set(['not-started','learning','completed','mastered','weak']);
  const validSkillStates=new Set<SkillState>(['not-started','learning','with-help','can-do-alone','mastered','weak']);
  const progress={...base.progress};
  for(const m of modules){
    const p=partial.progress?.[m.id];
    if(!p)continue;
    const legacyCompleted=(p.status==='completed'||p.status==='mastered')&&!('checklist' in p);
    const template=checklistTemplate(m.id,legacyCompleted);
    const incoming=(p as ModuleProgress).checklist??{};
    const checklist=Object.fromEntries(Object.keys(template).map(k=>[k,typeof incoming[k]==='boolean'?incoming[k]:template[k]]));
    const incomingSkills=(p as ModuleProgress).skillStates??{};
    const skillStates=Object.fromEntries(Object.keys(template).map(k=>{
      const candidate=incomingSkills[k] as SkillState|undefined;
      if(candidate&&validSkillStates.has(candidate))return[k,candidate];
      return[k,checklist[k]?(p.status==='mastered'?'mastered':'can-do-alone'):'not-started'];
    })) as Record<string,SkillState>;
    const values=Object.values(checklist),all=values.length>0&&values.every(Boolean),some=values.some(Boolean);
    let status=valid.has(p.status)?p.status:'not-started';
    if(status!=='weak'){
      if(all&&status!=='mastered')status='completed';
      else if(!all&&status==='mastered')status=some?'learning':'not-started';
      else if(!all&&status==='completed')status=some?'learning':'not-started';
      else if(some&&status==='not-started')status='learning';
    }
    progress[m.id]={
      ...base.progress[m.id],
      ...p,
      status:status as ModuleStatus,
      confidence:Math.max(1,Math.min(5,Number(p.confidence)||3)),
      masteryScore:Math.max(0,Math.min(100,Number(p.masteryScore)||0)),
      checklist,
      skillStates
    };
  }
  return{
    ...base,
    ...partial,
    version:APP_VERSION,
    progress,
    attempts:Array.isArray(partial.attempts)?partial.attempts:[],
    mistakes:Array.isArray(partial.mistakes)?partial.mistakes:[],
    revisions:Array.isArray(partial.revisions)?partial.revisions:[],
    notes:Array.isArray(partial.notes)?partial.notes:[],
    history:Array.isArray(partial.history)?partial.history:[],
    studyDays:Array.isArray(partial.studyDays)?partial.studyDays:[],
    studyActivity:Array.isArray(partial.studyActivity)?partial.studyActivity:[],
    answerBank:Array.isArray(partial.answerBank)?partial.answerBank:[],
    mockResults:Array.isArray(partial.mockResults)?partial.mockResults:[],
    achievements:Array.isArray(partial.achievements)?partial.achievements:[],
    examEnglish:{
      completed:Array.isArray(partial.examEnglish?.completed)?partial.examEnglish!.completed:[],
      quizAttempts:Number(partial.examEnglish?.quizAttempts)||0,
      correct:Number(partial.examEnglish?.correct)||0
    },
    aoScores:{...base.aoScores,...(partial.aoScores??{})},
    profile:{...base.profile,...(partial.profile??{})},
    settings:{...base.settings,...(partial.settings??{})}
  }
}
function load(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    return raw?merge(JSON.parse(raw)):createDefaultState()
  }catch{
    return createDefaultState()
  }
}
export function initStore(){state=load();applySettings();}
export function getState(){return state}
export function subscribe(fn:()=>void){subscribers.push(fn);return()=>{subscribers=subscribers.filter(x=>x!==fn)}}
function commit(next:AppState){
  state=next;
  localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
  applySettings();
  subscribers.forEach(fn=>fn())
}
function applySettings(){
  if(!state)return;
  document.documentElement.classList.remove('dark');
  document.documentElement.dataset.fontScale=state.settings.fontScale;
  document.documentElement.dataset.compact=String(state.settings.compact);
  document.documentElement.dataset.reducedMotion=String(state.settings.reducedMotion)
}
function scheduleRevisions(moduleId:string,oldStatus:ModuleStatus,newStatus:ModuleStatus,revisions=state.revisions){
  const next=[...revisions];
  if((newStatus==='completed'||newStatus==='mastered')&&!(oldStatus==='completed'||oldStatus==='mastered')){
    const now=today(),existing=new Set(next.filter(r=>r.moduleId===moduleId&&!r.completedDate).map(r=>r.intervalDays));
    [1,3,7,14,30].forEach(interval=>{
      if(!existing.has(interval))next.push({id:uid(),moduleId,dueDate:addDays(now,interval),intervalDays:interval})
    });
  }
  return next;
}
function statusFromSkills(current:ModuleProgress,checklist:Record<string,boolean>,skillStates:Record<string,SkillState>):ModuleStatus{
  const skillValues=Object.values(skillStates);
  if(skillValues.includes('weak'))return'weak';
  const values=Object.values(checklist),all=values.length>0&&values.every(Boolean),some=values.some(Boolean);
  if(all&&skillValues.length>0&&skillValues.every(x=>x==='mastered'))return'mastered';
  if(all)return'completed';
  if(some||skillValues.some(x=>x!=='not-started'))return'learning';
  return'not-started';
}
export function setModuleStatus(moduleId:string,status:ModuleStatus){
  const current=state.progress[moduleId];if(!current)return;
  const old=current.status;if(old===status)return;
  let checklist={...current.checklist};
  let skillStates={...current.skillStates};
  if(status==='completed'){
    checklist=checklistTemplate(moduleId,true);
    skillStates=Object.fromEntries(Object.keys(checklist).map(k=>[k,'can-do-alone'])) as Record<string,SkillState>;
  }
  if(status==='mastered'){
    checklist=checklistTemplate(moduleId,true);
    skillStates=Object.fromEntries(Object.keys(checklist).map(k=>[k,'mastered'])) as Record<string,SkillState>;
  }
  if(status==='not-started'){
    checklist=checklistTemplate(moduleId,false);
    skillStates=skillStateTemplate(moduleId,false);
  }
  const now=today();
  const progress={...state.progress,[moduleId]:{...current,status,lastStudied:now,checklist,skillStates}};
  const revisions=scheduleRevisions(moduleId,old,status);
  const m=modules.find(x=>x.id===moduleId);
  commit({...state,progress,revisions,history:[{id:uid(),date:new Date().toISOString(),type:'status' as const,title:`${m?.name??moduleId}: ${status}`,detail:`Status changed from ${old} to ${status}.`,moduleId},...state.history].slice(0,500),studyDays:Array.from(new Set([...state.studyDays,now]))})
}
export function setChecklistItem(moduleId:string,itemKey:string,done:boolean){
  const current=state.progress[moduleId];if(!current||!(itemKey in current.checklist))return;
  const checklist={...current.checklist,[itemKey]:done};
  const skillStates={...current.skillStates,[itemKey]:done?(current.skillStates[itemKey]==='mastered'?'mastered':'can-do-alone'):'not-started'} as Record<string,SkillState>;
  const status=statusFromSkills(current,checklist,skillStates);
  const now=today(),revisions=scheduleRevisions(moduleId,current.status,status);
  const m=modules.find(x=>x.id===moduleId),index=Number(itemKey.replace('c','')),label=(moduleChecklists[moduleId]??m?.officialPoints??[])[index]??'Syllabus item';
  const progress={...state.progress,[moduleId]:{...current,checklist,skillStates,status,lastStudied:now}};
  commit({...state,progress,revisions,history:[{id:uid(),date:new Date().toISOString(),type:'status' as const,title:`${m?.name??moduleId}: ${done?'checkpoint completed':'checkpoint reopened'}`,detail:`${label}.`,moduleId},...state.history].slice(0,500),studyDays:Array.from(new Set([...state.studyDays,now]))})
}
export function setSkillState(moduleId:string,itemKey:string,skillState:SkillState){
  const current=state.progress[moduleId];if(!current||!(itemKey in current.checklist))return;
  const skillStates={...current.skillStates,[itemKey]:skillState};
  const checklist={...current.checklist,[itemKey]:skillState==='can-do-alone'||skillState==='mastered'};
  const status=statusFromSkills(current,checklist,skillStates);
  const now=today(),revisions=scheduleRevisions(moduleId,current.status,status);
  const progress={...state.progress,[moduleId]:{...current,skillStates,checklist,status,lastStudied:now}};
  commit({...state,progress,revisions,studyDays:Array.from(new Set([...state.studyDays,now]))})
}
export function setConfidence(moduleId:string,confidence:number){
  commit({...state,progress:{...state.progress,[moduleId]:{...state.progress[moduleId],confidence:Math.max(1,Math.min(5,confidence)),lastStudied:today()}}})
}
export function recordAttempt(questionId:string,userAnswer:string,correct:boolean,mistakeType:MistakeType='unclassified',meta:AttemptMeta={}){
  const q=questions.find(x=>x.id===questionId);if(!q)return;
  const now=new Date().toISOString();
  const p=state.progress[q.moduleId];
  const attempted=p.questionsAttempted+1,correctCount=p.questionsCorrect+(correct?1:0);
  const rate=Math.round(correctCount/attempted*100);
  const progress:Record<string,ModuleProgress>={...state.progress,[q.moduleId]:{...p,questionsAttempted:attempted,questionsCorrect:correctCount,lastTested:today(),masteryScore:Math.max(p.masteryScore,rate),recentAccuracy:rate}};
  let mistakes=[...state.mistakes];
  const idx=mistakes.findIndex(m=>m.questionId===questionId&&!m.resolved);
  if(!correct){
    if(idx>=0)mistakes[idx]={...mistakes[idx],date:now,userAnswer,timesWrong:mistakes[idx].timesWrong+1,correctStreak:0,mistakeType,confidence:meta.confidence,guessed:meta.guessed,didNotKnow:meta.didNotKnow,nextRevisionDate:addDays(today(),1)};
    else mistakes.unshift({
      id:uid(),questionId,moduleId:q.moduleId,date:now,userAnswer,correctAnswer:q.answer,explanation:q.explanation,mistakeType,timesWrong:1,resolved:false,correctStreak:0,
      paper:q.paper,questionType:q.type,marks:q.marks,difficulty:q.difficulty,confidence:meta.confidence,guessed:meta.guessed,didNotKnow:meta.didNotKnow,nextRevisionDate:addDays(today(),1),source:q.source
    });
    progress[q.moduleId]={...progress[q.moduleId],status:'weak'};
  }else if(idx>=0){
    const streak=mistakes[idx].correctStreak+1;
    mistakes[idx]={...mistakes[idx],correctStreak:streak,resolved:streak>=2}
  }
  const activity:StudyActivityRecord={id:uid(),date:now,minutes:0,questions:1,topicsRevised:0,moduleId:q.moduleId};
  commit({
    ...state,
    progress,
    attempts:[{
      id:uid(),questionId,moduleId:q.moduleId,date:now,userAnswer,correct,score:correct?q.marks:0,maxScore:q.marks,mistakeType,
      confidence:meta.confidence,guessed:meta.guessed,didNotKnow:meta.didNotKnow,difficultyMode:meta.difficultyMode,timeSeconds:meta.timeSeconds,
      paper:q.paper,questionType:q.type,marks:q.marks,assessmentObjectives:meta.assessmentObjectives??q.assessmentObjectives
    },...state.attempts].slice(0,2000),
    mistakes,
    studyActivity:[activity,...state.studyActivity].slice(0,2000),
    history:[{id:uid(),date:now,type:'practice' as const,title:`Practice: ${correct?'Correct':'Needs review'}`,detail:`${q.question} — ${correct?'correct':'incorrect'}.`,moduleId:q.moduleId},...state.history].slice(0,500),
    studyDays:Array.from(new Set([...state.studyDays,today()]))
  })
}
export function classifyMistake(id:string,type:MistakeType){
  commit({...state,mistakes:state.mistakes.map(m=>m.id===id?{...m,mistakeType:type}:m)})
}
export function completeRevision(id:string,score?:number){
  const r=state.revisions.find(x=>x.id===id);if(!r)return;
  const m=modules.find(x=>x.id===r.moduleId);
  commit({...state,revisions:state.revisions.map(x=>x.id===id?{...x,completedDate:today(),score}:x),history:[{id:uid(),date:new Date().toISOString(),type:'revision' as const,title:`Revision completed: ${m?.name??r.moduleId}`,detail:`${r.intervalDays}-day review${score!=null?` • ${score}%`:''}.`,moduleId:r.moduleId},...state.history].slice(0,500),studyDays:Array.from(new Set([...state.studyDays,today()]))})
}
export function addNote(note:Omit<NoteRecord,'id'|'updatedAt'>){
  const n={...note,id:uid(),updatedAt:new Date().toISOString()};
  commit({...state,notes:[n,...state.notes],history:[{id:uid(),date:n.updatedAt,type:'note' as const,title:`Note: ${n.title}`,detail:'Note created.',moduleId:n.moduleId},...state.history].slice(0,500)})
}
export function toggleStarNote(id:string){commit({...state,notes:state.notes.map(n=>n.id===id?{...n,starred:!n.starred,updatedAt:new Date().toISOString()}:n)})}
export function deleteNote(id:string){commit({...state,notes:state.notes.filter(n=>n.id!==id)})}
export function updateProfile(patch:Partial<Profile>){commit({...state,profile:{...state.profile,...patch},history:[{id:uid(),date:new Date().toISOString(),type:'profile' as const,title:'Profile updated',detail:'Study profile settings were updated.'},...state.history].slice(0,500)})}
export function updateSettings(patch:Partial<Settings>){commit({...state,settings:{...state.settings,...patch}})}
export function recordStudyActivity(minutes:number,questions=0,topicsRevised=0,moduleId?:string){
  if(!Number.isFinite(minutes)||minutes<0)return;
  const rounded=Math.round(minutes);
  const activity:StudyActivityRecord={id:uid(),date:new Date().toISOString(),minutes:rounded,questions:Math.max(0,Math.round(questions)),topicsRevised:Math.max(0,Math.round(topicsRevised)),moduleId};
  commit({...state,studyMinutesTotal:state.studyMinutesTotal+rounded,studyDays:Array.from(new Set([...state.studyDays,today()])),studyActivity:[activity,...state.studyActivity].slice(0,2000)})
}
export function addStudyMinutes(minutes:number){
  if(!Number.isFinite(minutes)||minutes<=0)return;
  recordStudyActivity(minutes)
}
export function exportBackup(){return JSON.stringify(state,null,2)}
export function restoreBackup(raw:string){
  const parsed=JSON.parse(raw) as Partial<AppState>;
  if(!parsed||typeof parsed!=='object')throw new Error('Invalid backup file.');
  commit(merge(parsed))
}
export function resetState(){commit(createDefaultState())}
