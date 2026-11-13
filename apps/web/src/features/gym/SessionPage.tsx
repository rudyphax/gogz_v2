import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { SessionDto, SessionExerciseDto, SetDto } from '@gogz/shared';
import { api } from '../../api/client';
import { keys, useApiMutation, useSession } from '../../api/hooks';
import { Badge, Button, Card, ErrorText, Loading } from '../../components/ui';

interface Row {
  weight: string;
  reps: string;
}
type Rows = Record<string, Row[]>;

/** Saved sets win; otherwise start with the planned number of sets, pre-filling the suggested weight. */
export function initialRows(session: SessionDto): Rows {
  const rows: Rows = {};
  for (const e of session.exercises) {
    const saved = session.sets
      .filter((s) => s.exerciseSlug === e.exerciseSlug)
      .sort((a, b) => a.setNumber - b.setNumber);
    rows[e.exerciseSlug] = saved.length
      ? saved.map((s) => ({ weight: String(s.weight), reps: String(s.reps) }))
      : Array.from({ length: e.sets }, () => ({
          weight: e.suggestion ? String(e.suggestion.weight) : '',
          reps: '',
        }));
  }
  return rows;
}

/** Only sets with reps entered are saved. */
export function rowsToSets(rows: Rows): SetDto[] {
  return Object.entries(rows).flatMap(([exerciseSlug, list]) =>
    list
      .map((r) => ({ reps: Number.parseInt(r.reps, 10), weight: Number.parseFloat(r.weight) || 0 }))
      .filter((r) => Number.isFinite(r.reps) && r.reps > 0)
      .map((r, i) => ({ exerciseSlug, setNumber: i + 1, reps: r.reps, weight: r.weight })),
  );
}

const fmtSets = (sets: { reps: number; weight: number }[]) =>
  sets.map((s) => (s.weight ? `${s.weight}×${s.reps}` : `${s.reps} reps`)).join(', ');

function ExerciseCard({
  exercise,
  rows,
  onChange,
  disabled,
}: {
  exercise: SessionExerciseDto;
  rows: Row[];
  onChange: (rows: Row[]) => void;
  disabled: boolean;
}) {
  const update = (i: number, patch: Partial<Row>) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <Card>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-bold">{exercise.exerciseName}</h2>
        <span className="text-xs text-muted tabular-nums">
          Target {exercise.sets} × {exercise.repMin}–{exercise.repMax}
        </span>
      </div>
      <p className="text-xs text-muted">
        Last time:{' '}
        {exercise.lastSets.length
          ? fmtSets(exercise.lastSets)
          : 'first time, so find a weight that hits the range'}
      </p>
      {exercise.suggestion && (
        <p className="mt-1 text-xs font-medium text-brand-200">
          Today:{' '}
          {exercise.suggestion.weight
            ? `${exercise.suggestion.weight} lb × ${exercise.suggestion.reps}`
            : `${exercise.suggestion.reps} reps`}
          <span className="font-normal text-muted"> · {exercise.suggestion.reason}</span>
        </p>
      )}
      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th className="w-12 font-medium">Set</th>
            <th className="font-medium">Weight (lb)</th>
            <th className="font-medium">Reps</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="py-1 text-muted">{i + 1}</td>
              <td className="py-1 pr-2">
                <input
                  aria-label={`${exercise.exerciseName} set ${i + 1} weight`}
                  inputMode="decimal"
                  value={r.weight}
                  disabled={disabled}
                  onChange={(e) => update(i, { weight: e.target.value })}
                  className="w-full rounded-md px-2 py-1.5 ring-1 ring-line-strong focus:ring-2 focus:ring-brand-400 focus:outline-none"
                />
              </td>
              <td className="py-1">
                <input
                  aria-label={`${exercise.exerciseName} set ${i + 1} reps`}
                  inputMode="numeric"
                  value={r.reps}
                  placeholder={
                    exercise.suggestion ? String(exercise.suggestion.reps) : `${exercise.repMin}`
                  }
                  disabled={disabled}
                  onChange={(e) => update(i, { reps: e.target.value })}
                  className="w-full rounded-md px-2 py-1.5 ring-1 ring-line-strong focus:ring-2 focus:ring-brand-400 focus:outline-none"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!disabled && (
        <div className="mt-2 flex gap-2">
          <Button
            variant="ghost"
            className="!px-2 !py-1 text-xs"
            onClick={() => onChange([...rows, { weight: rows.at(-1)?.weight ?? '', reps: '' }])}
          >
            + Add set
          </Button>
          {rows.length > 1 && (
            <Button
              variant="ghost"
              className="!px-2 !py-1 text-xs"
              onClick={() => onChange(rows.slice(0, -1))}
            >
              Remove last
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

export function SessionPage() {
  const { id = '' } = useParams();
  const { data: session, isPending, error } = useSession(id);
  if (isPending) return <Loading />;
  if (error) return <ErrorText error={error} />;
  // Keyed so the editable rows are rebuilt if you navigate to another workout.
  return <SessionEditor key={session.id} session={session} />;
}

function SessionEditor({ session }: { session: SessionDto }) {
  const id = session.id;
  const navigate = useNavigate();
  const [rows, setRows] = useState<Rows>(() => initialRows(session));
  const [saved, setSaved] = useState(false);

  const save = useApiMutation(
    (sets: SetDto[]) =>
      api<SessionDto>(`/gym/sessions/${id}/sets`, { method: 'PUT', body: { sets } }),
    [keys.sessions, keys.session(id)],
    () => setSaved(true),
  );
  const finish = useApiMutation(
    async (sets: SetDto[]) => {
      await api(`/gym/sessions/${id}/sets`, { method: 'PUT', body: { sets } });
      return api<SessionDto>(`/gym/sessions/${id}/complete`, { method: 'POST' });
    },
    [keys.sessions, keys.session(id), keys.progressList],
    () => void navigate('/gym'),
  );
  const remove = useApiMutation(
    () => api(`/gym/sessions/${id}`, { method: 'DELETE' }),
    [keys.sessions],
    () => void navigate('/gym'),
  );

  const done = session.completedAt !== null;
  const busy = save.isPending || finish.isPending;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link to="/gym" className="text-sm text-brand-300 hover:underline">
        ← Back to Gym
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold">{session.planDayName}</h1>
        {done ? <Badge tone="green">Completed</Badge> : <Badge tone="amber">In progress</Badge>}
        <span className="text-sm text-muted">
          {new Date(session.startedAt).toLocaleDateString()}
        </span>
      </div>

      {session.exercises.length === 0 && (
        <p className="text-sm text-muted">
          This workout's plan was deleted, but its logged sets are still in your history.
        </p>
      )}
      {session.exercises.map((e) => (
        <ExerciseCard
          key={e.id}
          exercise={e}
          rows={rows[e.exerciseSlug] ?? []}
          disabled={done}
          onChange={(next) => {
            setSaved(false);
            setRows({ ...rows, [e.exerciseSlug]: next });
          }}
        />
      ))}

      <ErrorText error={save.error ?? finish.error ?? remove.error} />
      <div className="sticky bottom-0 -mx-4 flex flex-wrap gap-2 border-t border-line bg-night-950/90 px-4 py-3 backdrop-blur">
        {!done && (
          <>
            <Button disabled={busy} onClick={() => finish.mutate(rowsToSets(rows))}>
              Finish workout
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => save.mutate(rowsToSets(rows))}
            >
              {save.isPending ? 'Saving…' : saved ? 'Saved ✓' : 'Save progress'}
            </Button>
          </>
        )}
        <Button
          variant="ghost"
          className="ml-auto text-red-300"
          disabled={busy}
          onClick={() => {
            if (confirm('Delete this workout and its sets?')) remove.mutate(undefined);
          }}
        >
          Delete
        </Button>
      </div>
    </div>
  );
}
