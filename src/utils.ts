import { moduleChecklists, modules } from './data.js';
import type { AppState, ModuleProgress, ModuleStatus, SyllabusModule } from './types.js';

export const completedStatuses: ModuleStatus[] = ['completed','mastered'];
export const isCompleted = (status:ModuleStatus) => completedStatuses.includes(status);
export const clamp = (n:number) => Math.max(0,Math.min(100,Number.isFinite(n)?n:0));
export const round1 = (n:number) => Math.round(n*10)/10;
export const today = () => new Date().toISOString().slice(0,10);
export const uid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export function addDays(date:string, days:number){const [y,m,d]=date.split('-').map(Number);const t=new Date(Date.UTC(y,m-1,d,12));t.setUTCDate(t.getUTCDate()+days);return t.toISOString().slice(0,10)}
export function daysUntil(dateString:string){const [y,m,d]=dateString.split('-').map(Number);const target=Date.UTC(y,m-1,d);const now=new Date();const current=Date.UTC(now.getFullYear(),now.getMonth(),now.getDate());return Math.max(0,Math.ceil((target-current)/86400000));}
export function checklistStats(progress:Record<string,ModuleProgress>,moduleId:string){const items=moduleChecklists[moduleId]??modules.find(m=>m.id===moduleId)?.officialPoints??[];const checks=progress[moduleId]?.checklist??{};const total=items.length;const completed=items.reduce((n,_,i)=>n+(checks[`c${i}`]?1:0),0);return{completed,total,percent:total?round1(completed/total*100):0};}
export function moduleChecklistComplete(progress:Record<string,ModuleProgress>,moduleId:string){const x=checklistStats(progress,moduleId);return x.total>0&&x.completed===x.total;}
export function moduleCoverage(progress:Record<string,ModuleProgress>,moduleId:string){return checklistStats(progress,moduleId).percent;}
export function overallCompletion(progress:Record<string,ModuleProgress>){const earned=modules.reduce((s,m)=>s+m.studyWeight*(moduleCoverage(progress,m.id)/100),0);return clamp(round1(earned));}
export function masteryCompletion(progress:Record<string,ModuleProgress>){return clamp(round1(modules.reduce((s,m)=>s+((progress[m.id]?.status??'not-started')==='mastered'?m.studyWeight:0),0)));}
export function paperCoverage(progress:Record<string,ModuleProgress>,paper:'P1'|'P2'){const set=modules.filter(m=>m.paper===paper);const total=set.reduce((s,m)=>s+m.studyWeight,0);const earned=set.reduce((s,m)=>s+m.studyWeight*(moduleCoverage(progress,m.id)/100),0);return total?clamp(round1(earned/total*100)):0;}
export function paperMastery(progress:Record<string,ModuleProgress>,paper:'P1'|'P2'){const set=modules.filter(m=>m.paper===paper);const total=set.reduce((s,m)=>s+m.studyWeight,0);const earned=set.reduce((s,m)=>s+((progress[m.id]?.status??'not-started')==='mastered'?m.studyWeight:0),0);return total?clamp(round1(earned/total*100)):0;}
export function topicCoverage(progress:Record<string,ModuleProgress>,topicId:number){const set=modules.filter(m=>m.topicId===topicId);const total=set.reduce((s,m)=>s+m.studyWeight,0);const earned=set.reduce((s,m)=>s+m.studyWeight*(moduleCoverage(progress,m.id)/100),0);return total?clamp(round1(earned/total*100)):0;}
export function accuracy(progress:Record<string,ModuleProgress>,moduleId?:string){const vals=moduleId?[progress[moduleId]].filter(Boolean):Object.values(progress);const attempted=vals.reduce((s,p)=>s+p.questionsAttempted,0);const correct=vals.reduce((s,p)=>s+p.questionsCorrect,0);return attempted?Math.round(correct/attempted*100):0;}
export function examReadiness(state:AppState){const completion=overallCompletion(state.progress),mastery=masteryCompletion(state.progress),acc=accuracy(state.progress);const unresolved=state.mistakes.filter(m=>!m.resolved).length;const overdue=state.revisions.filter(r=>!r.completedDate&&r.dueDate<=today()).length;return clamp(Math.round(completion*.3+mastery*.35+acc*.35-Math.min(20,unresolved*1.5)-Math.min(10,overdue*1.2)));}
export function recommendedNext(progress:Record<string,ModuleProgress>):SyllabusModule|undefined {return modules.find(m=>progress[m.id]?.status==='weak'&&!moduleChecklistComplete(progress,m.id))??modules.find(m=>progress[m.id]?.status==='learning'&&!moduleChecklistComplete(progress,m.id))??modules.find(m=>!moduleChecklistComplete(progress,m.id)&&(m.prerequisites??[]).every(id=>moduleChecklistComplete(progress,id)))??modules.find(m=>!moduleChecklistComplete(progress,m.id));}
export function esc(value:unknown){return String(value??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[ch] as string));}
export function normalizeAnswer(value:string){return value.trim().toLowerCase().replace(/[$,]/g,'').replace(/\s+/g,' ');}
export function moduleById(id:string){return modules.find(m=>m.id===id);}
