import { moduleChecklists, modules } from '../dist/data.js';
import { createDefaultState } from '../dist/store.js';
import { checklistStats, masteryCompletion, moduleCoverage, overallCompletion, paperCoverage, topicCoverage } from '../dist/utils.js';

function assert(name,actual,expected){if(actual!==expected){throw new Error(`${name}: expected ${expected}, got ${actual}`)}console.log(`✓ ${name}`)}
function completeChecklist(state,id){Object.keys(state.progress[id].checklist).forEach(k=>state.progress[id].checklist[k]=true)}

const state=createDefaultState();
assert('24 modules',modules.length,24);
assert('weights total 100',modules.reduce((s,m)=>s+m.studyWeight,0),100);
assert('Paper 1 weights total 60',modules.filter(m=>m.paper==='P1').reduce((s,m)=>s+m.studyWeight,0),60);
assert('Paper 2 weights total 40',modules.filter(m=>m.paper==='P2').reduce((s,m)=>s+m.studyWeight,0),40);
assert('initial completion',overallCompletion(state.progress),0);

completeChecklist(state,'2.5');
state.progress['2.5'].status='completed';
assert('depreciation checklist adds 4%',overallCompletion(state.progress),4);
assert('P1 normalized coverage',paperCoverage(state.progress,'P1'),6.7);
state.progress['2.5'].status='mastered';
assert('mastering does not double-count completion',overallCompletion(state.progress),4);
assert('mastery is separate',masteryCompletion(state.progress),4);

const partial=createDefaultState();
partial.progress['3.2'].checklist.c1=true;
partial.progress['3.2'].status='learning';
assert('Control Accounts has 3 individual checklist skills',moduleChecklists['3.2'].length,3);
assert('one Control Accounts skill gives 33.3% module coverage',moduleCoverage(partial.progress,'3.2'),33.3);
assert('partial Control Accounts contributes 1.7% overall',overallCompletion(partial.progress),1.7);
assert('partial checklist count is tracked',checklistStats(partial.progress,'3.2').completed,1);

['3.1','3.2','3.3','3.4'].forEach(id=>{completeChecklist(state,id);state.progress[id].status='completed'});
assert('Topic 3 reaches 100%',topicCoverage(state.progress,3),100);
console.log('All granular progress logic tests passed.');
