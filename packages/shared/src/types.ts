import type { ChallengeActionType, ChallengeStatus, HeadToHead } from './challenge.js';
import type { Goal } from './workouts/generate.js';
import type { Equipment } from './workouts/exercises.js';
import type { Suggestion } from './workouts/progression.js';

/** JSON shapes returned by the API, shared with the web app. */

export type Role = 'admin' | 'member' | 'demo';

export interface Me {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  phone: string | null;
  smsOptIn: boolean;
  avatarUrl: string | null;
  role: Role;
  hasPassword: boolean;
}

export interface Friend {
  id: string;
  displayName: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  record: HeadToHead;
}

export interface ChallengeEventDto {
  id: string;
  actorId: string;
  actorName: string;
  type: string;
  prize: string | null;
  createdAt: string;
}

export interface ChallengeDto {
  id: string;
  status: ChallengeStatus;
  prize: string;
  challenger: { id: string; displayName: string; avatarUrl: string | null };
  opponent: { id: string; displayName: string; avatarUrl: string | null };
  turnUserId: string | null;
  winnerId: string | null;
  availableActions: ChallengeActionType[];
  createdAt: string;
  updatedAt: string;
  events?: ChallengeEventDto[];
}

export interface PlanExerciseDto {
  id: string;
  exerciseSlug: string;
  exerciseName: string;
  sets: number;
  repMin: number;
  repMax: number;
}

export interface PlanDayDto {
  id: string;
  dayIndex: number;
  name: string;
  exercises: PlanExerciseDto[];
}

export interface PlanDto {
  id: string;
  name: string;
  goal: Goal;
  daysPerWeek: number;
  equipment: Equipment[];
  isActive: boolean;
  createdAt: string;
  days: PlanDayDto[];
}

export interface SetDto {
  exerciseSlug: string;
  setNumber: number;
  reps: number;
  weight: number;
}

export interface SessionExerciseDto extends PlanExerciseDto {
  lastSets: { reps: number; weight: number }[];
  suggestion: Suggestion | null;
}

export interface SessionDto {
  id: string;
  planDayId: string | null;
  planDayName: string;
  startedAt: string;
  completedAt: string | null;
  exercises: SessionExerciseDto[];
  sets: SetDto[];
}

export interface SessionSummaryDto {
  id: string;
  planDayName: string;
  startedAt: string;
  completedAt: string | null;
  setCount: number;
}

export interface ProgressPointDto {
  sessionId: string;
  date: string;
  weight: number;
  reps: number;
  e1rm: number;
}

export interface AllowedEmailDto {
  email: string;
  role: 'admin' | 'member';
  createdAt: string;
  registered: boolean;
}
