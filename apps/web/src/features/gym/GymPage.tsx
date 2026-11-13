import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { GOAL_LABELS, type PlanDto, type SessionDto } from '@gogz/shared';
import { api } from '../../api/client';
import { keys, useApiMutation, usePlans, useSessions } from '../../api/hooks';
import { Badge, Button, Card, Empty, ErrorText, Loading, PageHeader } from '../../components/ui';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

export function GymPage() {
  const plans = usePlans();
  const sessions = useSessions();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const start = useApiMutation(
    (planDayId: string) =>
      api<SessionDto>('/gym/sessions', { method: 'POST', body: { planDayId } }),
    [keys.sessions],
    (s) => {
      qc.setQueryData(keys.session(s.id), s);
      void navigate(`/gym/sessions/${s.id}`);
    },
  );
  const activate = useApiMutation(
    (id: string) => api<PlanDto>(`/gym/plans/${id}/activate`, { method: 'POST' }),
    [keys.plans],
  );
  const remove = useApiMutation(
    (id: string) => api(`/gym/plans/${id}`, { method: 'DELETE' }),
    [keys.plans],
  );

  const active = plans.data?.find((p) => p.isActive);
  const others = plans.data?.filter((p) => !p.isActive) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gym"
        subtitle="Pick today's workout, log your sets, beat last time."
        action={
          <div className="flex gap-2">
            <Link
              to="/gym/progress"
              className="rounded-lg px-3 py-2 text-sm font-semibold text-brand-200 ring-1 ring-brand-400/40 hover:bg-brand-400/10"
            >
              Progress
            </Link>
            <Link
              to="/gym/plans/new"
              className="rounded-lg bg-brand-400 px-3 py-2 text-sm font-semibold text-night-950 hover:bg-brand-300"
            >
              New plan
            </Link>
          </div>
        }
      />

      <ErrorText error={start.error ?? activate.error ?? remove.error} />

      {plans.isPending ? (
        <Loading />
      ) : plans.error ? (
        <ErrorText error={plans.error} />
      ) : !active ? (
        <Empty>
          No plan yet.{' '}
          <Link to="/gym/plans/new" className="font-semibold text-brand-300 underline">
            Build one from your goals
          </Link>
          .
        </Empty>
      ) : (
        <section aria-label="Active plan">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold">{active.name}</h2>
            <Badge tone="green">{GOAL_LABELS[active.goal]}</Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {active.days.map((day) => (
              <Card key={day.id} className="flex flex-col">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-bold">{day.name}</h3>
                  <span className="text-xs text-muted">{day.exercises.length} exercises</span>
                </div>
                <ul className="mb-4 flex-1 space-y-1 text-sm text-muted">
                  {day.exercises.map((e) => (
                    <li key={e.id} className="flex justify-between gap-2">
                      <span className="truncate">{e.exerciseName}</span>
                      <span className="shrink-0 tabular-nums text-faint">
                        {e.sets}×{e.repMin}–{e.repMax}
                      </span>
                    </li>
                  ))}
                </ul>
                <Button
                  disabled={start.isPending}
                  onClick={() => start.mutate(day.id)}
                  aria-label={`Start ${day.name}`}
                >
                  Start workout
                </Button>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section aria-label="Recent workouts">
        <h2 className="mb-2 text-xs font-bold tracking-wide text-muted uppercase">
          Recent workouts
        </h2>
        {sessions.isPending ? (
          <Loading />
        ) : !sessions.data?.length ? (
          <Empty>Your logged workouts will show up here.</Empty>
        ) : (
          <ul className="divide-y divide-line rounded-xl bg-panel ring-1 ring-line">
            {sessions.data.slice(0, 10).map((s) => (
              <li key={s.id}>
                <Link
                  to={`/gym/sessions/${s.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-white/5"
                >
                  <span className="font-semibold">{s.planDayName}</span>
                  <span className="flex items-center gap-2 text-muted">
                    {!s.completedAt && <Badge tone="amber">In progress</Badge>}
                    {s.setCount} sets · {formatDate(s.startedAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {others.length > 0 && (
        <section aria-label="Other plans">
          <h2 className="mb-2 text-xs font-bold tracking-wide text-muted uppercase">Other plans</h2>
          <ul className="space-y-2">
            {others.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-panel px-4 py-3 text-sm ring-1 ring-line"
              >
                <span className="font-medium">{p.name}</span>
                <span className="flex gap-2">
                  <Button variant="secondary" onClick={() => activate.mutate(p.id)}>
                    Make active
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => {
                      if (confirm(`Delete "${p.name}"? Logged workouts are kept.`))
                        remove.mutate(p.id);
                    }}
                  >
                    Delete
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
