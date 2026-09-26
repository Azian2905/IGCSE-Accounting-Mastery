export type ModuleStatus = 'not-started' | 'learning' | 'completed' | 'mastered' | 'weak';
export type SkillState = 'not-started' | 'learning' | 'with-help' | 'can-do-alone' | 'mastered' | 'weak';
export type Paper = 'P1' | 'P2';
export type Difficulty = 'easy' | 'medium' | 'hard' | 'tricky';
export type DifficultyMode = 'easy' | 'normal' | 'hard' | 'brutal';
export type ConfidenceChoice = 'low' | 'medium' | 'high';
export type AssessmentObjective = 'AO1' | 'AO2' | 'AO3';
export type QuestionType = 'mcq' | 'short' | 'calculation' | 'theory' | 'ledger';
export type QuestionSource = 'official-pearson' | 'pearson-style' | 'ai-generated' | 'original';
export type MistakeType =
  | 'rule' | 'calculation' | 'debit-credit' | 'misread' | 'formula' | 'theory-wording' | 'careless' | 'unclassified'
  | 'did-not-know-rule' | 'misread-question' | 'wrong-format' | 'theory-too-weak' | 'missing-development'
  | 'forgot-concept' | 'english-misunderstanding' | 'guessed' | 'other';
export type PageKey = 'dashboard'|'today'|'syllabus'|'learn'|'practice'|'mistakes'|'revision'|'theory'|'mock'|'analytics'|'quick'|'notes'|'history'|'ai'|'profile'|'settings';

export interface Topic { id:number; name:string; paper:Paper; studyWeight:number; }
export interface SyllabusModule { id:string; topicId:number; code:string; name:string; paper:Paper; studyWeight:number; focus:string; officialPoints:string[]; checklistPoints?:string[]; prerequisites?:string[]; }
export interface ModuleProgress {
  status:ModuleStatus;
  confidence:number;
  masteryScore:number;
  lastStudied?:string;
  lastTested?:string;
  questionsAttempted:number;
  questionsCorrect:number;
  weakSubtopics:string[];
  checklist:Record<string,boolean>;
  skillStates:Record<string,SkillState>;
  theoryScore?:number;
  calculationScore?:number;
  recentAccuracy?:number;
}
export interface Question {
  id:string;
  moduleId:string;
  type:QuestionType;
  difficulty:Difficulty;
  paper:Paper;
  question:string;
  options?:string[];
  answer:string;
  explanation:string;
  marks:number;
  tags:string[];
  source?:QuestionSource;
  year?:number;
  questionNumber?:string;
  assessmentObjectives?:AssessmentObjective[];
}
export interface AttemptMeta {
  confidence?:ConfidenceChoice;
  guessed?:boolean;
  didNotKnow?:boolean;
  difficultyMode?:DifficultyMode;
  timeSeconds?:number;
  assessmentObjectives?:AssessmentObjective[];
}
export interface QuestionAttempt {
  id:string;
  questionId:string;
  moduleId:string;
  date:string;
  userAnswer:string;
  correct:boolean;
  score:number;
  maxScore:number;
  mistakeType?:MistakeType;
  confidence?:ConfidenceChoice;
  guessed?:boolean;
  didNotKnow?:boolean;
  difficultyMode?:DifficultyMode;
  timeSeconds?:number;
  paper?:Paper;
  questionType?:QuestionType;
  marks?:number;
  assessmentObjectives?:AssessmentObjective[];
}
export interface MistakeRecord {
  id:string;
  questionId:string;
  moduleId:string;
  date:string;
  userAnswer:string;
  correctAnswer:string;
  explanation:string;
  mistakeType:MistakeType;
  timesWrong:number;
  resolved:boolean;
  correctStreak:number;
  paper?:Paper;
  questionType?:QuestionType;
  marks?:number;
  difficulty?:Difficulty;
  confidence?:ConfidenceChoice;
  guessed?:boolean;
  didNotKnow?:boolean;
  nextRevisionDate?:string;
  source?:QuestionSource;
}
export type RevisionRating = 'easy'|'okay'|'hard'|'forgot';
export interface RevisionRecord { id:string; moduleId:string; dueDate:string; completedDate?:string; score?:number; intervalDays:number; rating?:RevisionRating; }
export interface NoteRecord { id:string; moduleId?:string; title:string; body:string; type:'general'|'exam'|'mistake'|'formula'; starred:boolean; updatedAt:string; }
export interface StudyHistoryRecord { id:string; date:string; type:'status'|'practice'|'revision'|'note'|'profile'|'exam'|'achievement'|'backup'; title:string; detail:string; moduleId?:string; }
export interface StudyActivityRecord { id:string; date:string; minutes:number; questions:number; topicsRevised:number; moduleId?:string; }
export interface AnswerBankEntry { id:string; moduleId?:string; topic:string; title:string; answer:string; starred:boolean; learned:boolean; needsRevision:boolean; personalVersion?:string; updatedAt:string; }
export interface MockResult { id:string; paper:Paper; date:string; score:number; maxScore:number; timeSeconds?:number; topicScores?:Record<string,number>; aoScores?:Partial<Record<AssessmentObjective,number>>; }
export interface AchievementRecord { id:string; key:string; unlockedAt:string; }
export interface ExamEnglishProgress { completed:string[]; quizAttempts:number; correct:number; }
export interface Profile { name:string; targetGrade:string; examDatePaper1:string; examDatePaper2:string; dailyStudyMinutes:number; preferredLessonStyle:'simple'|'detailed'|'exam-focused'; preferredLanguage:'english'|'english-bangla'; }
export interface Settings { theme:'light'|'dark'|'system'; compact:boolean; mode:'learning'|'exam'; language:'english'|'english-bangla'; fontScale:'small'|'normal'|'large'; reducedMotion:boolean; }
export interface AppState {
  version:number;
  progress:Record<string,ModuleProgress>;
  attempts:QuestionAttempt[];
  mistakes:MistakeRecord[];
  revisions:RevisionRecord[];
  notes:NoteRecord[];
  history:StudyHistoryRecord[];
  profile:Profile;
  settings:Settings;
  studyMinutesTotal:number;
  studyDays:string[];
  studyActivity:StudyActivityRecord[];
  answerBank:AnswerBankEntry[];
  mockResults:MockResult[];
  achievements:AchievementRecord[];
  examEnglish:ExamEnglishProgress;
  aoScores:Record<AssessmentObjective,number>;
}
export interface Lesson { moduleId:string; intro:string; keyTerms:{term:string;definition:string}[]; rules:string[]; examples:{title:string;body:string}[]; mistakes:string[]; memoryTip:string; quickCheckQuestionIds:string[]; }
