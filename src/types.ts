export type ModuleStatus = 'not-started' | 'learning' | 'completed' | 'mastered' | 'weak';
export type Paper = 'P1' | 'P2';
export type Difficulty = 'easy' | 'medium' | 'hard' | 'tricky';
export type QuestionType = 'mcq' | 'short' | 'calculation' | 'theory' | 'ledger';
export type MistakeType = 'rule' | 'calculation' | 'debit-credit' | 'misread' | 'formula' | 'theory-wording' | 'careless' | 'unclassified';
export type PageKey = 'dashboard'|'today'|'syllabus'|'learn'|'practice'|'mistakes'|'revision'|'theory'|'mock'|'analytics'|'quick'|'notes'|'history'|'ai'|'profile'|'settings';

export interface Topic { id:number; name:string; paper:Paper; studyWeight:number; }
export interface SyllabusModule { id:string; topicId:number; code:string; name:string; paper:Paper; studyWeight:number; focus:string; officialPoints:string[]; checklistPoints?:string[]; prerequisites?:string[]; }
export interface ModuleProgress { status:ModuleStatus; confidence:number; masteryScore:number; lastStudied?:string; lastTested?:string; questionsAttempted:number; questionsCorrect:number; weakSubtopics:string[]; checklist:Record<string,boolean>; }
export interface Question { id:string; moduleId:string; type:QuestionType; difficulty:Difficulty; paper:Paper; question:string; options?:string[]; answer:string; explanation:string; marks:number; tags:string[]; }
export interface QuestionAttempt { id:string; questionId:string; moduleId:string; date:string; userAnswer:string; correct:boolean; score:number; maxScore:number; mistakeType?:MistakeType; }
export interface MistakeRecord { id:string; questionId:string; moduleId:string; date:string; userAnswer:string; correctAnswer:string; explanation:string; mistakeType:MistakeType; timesWrong:number; resolved:boolean; correctStreak:number; }
export interface RevisionRecord { id:string; moduleId:string; dueDate:string; completedDate?:string; score?:number; intervalDays:number; }
export interface NoteRecord { id:string; moduleId?:string; title:string; body:string; type:'general'|'exam'|'mistake'|'formula'; starred:boolean; updatedAt:string; }
export interface StudyHistoryRecord { id:string; date:string; type:'status'|'practice'|'revision'|'note'|'profile'; title:string; detail:string; moduleId?:string; }
export interface Profile { name:string; targetGrade:string; examDatePaper1:string; examDatePaper2:string; dailyStudyMinutes:number; preferredLessonStyle:'simple'|'detailed'|'exam-focused'; preferredLanguage:'english'|'english-bangla'; }
export interface Settings { theme:'light'|'dark'|'system'; compact:boolean; mode:'learning'|'exam'; language:'english'|'english-bangla'; fontScale:'small'|'normal'|'large'; reducedMotion:boolean; }
export interface AppState { version:number; progress:Record<string,ModuleProgress>; attempts:QuestionAttempt[]; mistakes:MistakeRecord[]; revisions:RevisionRecord[]; notes:NoteRecord[]; history:StudyHistoryRecord[]; profile:Profile; settings:Settings; studyMinutesTotal:number; studyDays:string[]; }
export interface Lesson { moduleId:string; intro:string; keyTerms:{term:string;definition:string}[]; rules:string[]; examples:{title:string;body:string}[]; mistakes:string[]; memoryTip:string; quickCheckQuestionIds:string[]; }
