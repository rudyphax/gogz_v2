import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import type {
  AllowedEmailDto,
  ChallengeDto,
  Friend,
  Me,
  PlanDto,
  ProgressPointDto,
  SessionDto,
  SessionSummaryDto,
} from '@gogz/shared';
import { api, ApiError } from './client';

export const keys = {
  me: ['me'] as const,
  providers: ['providers'] as const,
  friends: ['golf', 'friends'] as const,
  challenges: ['golf', 'challenges'] as const,
  challenge: (id: string) => ['golf', 'challenges', id] as const,
  plans: ['gym', 'plans'] as const,
  sessions: ['gym', 'sessions'] as const,
  session: (id: string) => ['gym', 'sessions', id] as const,
  progressList: ['gym', 'progress'] as const,
  progress: (slug: string) => ['gym', 'progress', slug] as const,
  members: ['admin', 'members'] as const,
};

export function useMe() {
  return useQuery({
    queryKey: keys.me,
    queryFn: async () => {
      try {
        return await api<Me>('/me');
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: 60_000,
  });
}

export const useProviders = () =>
  useQuery({
    queryKey: keys.providers,
    queryFn: () => api<{ google: boolean }>('/auth/providers'),
  });
export const useFriends = () =>
  useQuery({ queryKey: keys.friends, queryFn: () => api<Friend[]>('/golf/friends') });
export const useChallenges = () =>
  useQuery({ queryKey: keys.challenges, queryFn: () => api<ChallengeDto[]>('/golf/challenges') });
export const useChallenge = (id: string) =>
  useQuery({
    queryKey: keys.challenge(id),
    queryFn: () => api<ChallengeDto>(`/golf/challenges/${id}`),
  });
export const usePlans = () =>
  useQuery({ queryKey: keys.plans, queryFn: () => api<PlanDto[]>('/gym/plans') });
export const useSessions = () =>
  useQuery({ queryKey: keys.sessions, queryFn: () => api<SessionSummaryDto[]>('/gym/sessions') });
export const useSession = (id: string) =>
  useQuery({ queryKey: keys.session(id), queryFn: () => api<SessionDto>(`/gym/sessions/${id}`) });
export const useProgressList = () =>
  useQuery({
    queryKey: keys.progressList,
    queryFn: () => api<{ exerciseSlug: string; exerciseName: string }[]>('/gym/progress'),
  });
export const useProgress = (slug: string | null) =>
  useQuery({
    queryKey: keys.progress(slug ?? ''),
    queryFn: () =>
      api<{ exerciseName: string; points: ProgressPointDto[] }>(`/gym/progress/${slug}`),
    enabled: !!slug,
  });
export const useMembers = () =>
  useQuery({
    queryKey: keys.members,
    queryFn: () => api<AllowedEmailDto[]>('/admin/allowed-emails'),
  });

/** Mutation that refreshes the given queries on success. */
export function useApiMutation<TVars, TResult = unknown>(
  fn: (vars: TVars) => Promise<TResult>,
  invalidate: QueryKey[] = [],
  onSuccess?: (result: TResult) => void,
) {
  const qc = useQueryClient();
  return useMutation<TResult, ApiError, TVars>({
    mutationFn: fn,
    onSuccess: async (result) => {
      await Promise.all(invalidate.map((queryKey) => qc.invalidateQueries({ queryKey })));
      onSuccess?.(result);
    },
  });
}
