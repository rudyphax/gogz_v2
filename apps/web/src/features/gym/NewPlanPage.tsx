import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import {
  EQUIPMENT,
  GOAL_LABELS,
  GOALS,
  MAX_DAYS,
  MIN_DAYS,
  type Equipment,
  type Goal,
  type PlanDto,
} from '@gogz/shared';
import { api } from '../../api/client';
import { keys, useApiMutation } from '../../api/hooks';
import { Button, Card, cx, ErrorText, Field, PageHeader } from '../../components/ui';

const GOAL_HINTS: Record<Goal, string> = {
  strength: 'Heavy compound lifts, 3–5 reps',
  hypertrophy: 'Moderate weight, 8–12 reps',
  endurance: 'Lighter weight, 15–20 reps',
  golf: 'Strength plus rotational power and core',
};

const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbells',
  cable: 'Cable machine',
  machine: 'Machines',
  kettlebell: 'Kettlebells',
  bands: 'Resistance bands',
  bodyweight: 'Bodyweight',
};

export function NewPlanPage() {
  const navigate = useNavigate();
  const [goal, setGoal] = useState<Goal>('hypertrophy');
  const [daysPerWeek, setDays] = useState(3);
  const [equipment, setEquipment] = useState<Equipment[]>(['barbell', 'dumbbell']);
  const [name, setName] = useState('');

  const create = useApiMutation(
    () =>
      api<PlanDto>('/gym/plans', {
        method: 'POST',
        body: { goal, daysPerWeek, equipment, name: name || undefined },
      }),
    [keys.plans],
    () => void navigate('/gym'),
  );

  function toggle(eq: Equipment) {
    setEquipment((cur) => (cur.includes(eq) ? cur.filter((e) => e !== eq) : [...cur, eq]));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate(undefined);
  }

  const days = Array.from({ length: MAX_DAYS - MIN_DAYS + 1 }, (_, i) => MIN_DAYS + i);

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        title="Build a plan"
        subtitle="Tell us your goal and setup. We'll build the split."
      />

      <Card>
        <fieldset>
          <legend className="mb-3 text-sm font-bold">Goal</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {GOALS.map((g) => (
              <label
                key={g}
                className={cx(
                  'cursor-pointer rounded-lg p-3 ring-1 transition',
                  goal === g
                    ? 'bg-brand-400/10 ring-2 ring-brand-400'
                    : 'ring-line hover:ring-white/30',
                )}
              >
                <input
                  type="radio"
                  name="goal"
                  value={g}
                  checked={goal === g}
                  onChange={() => setGoal(g)}
                  className="sr-only"
                />
                <span className="block text-sm font-semibold">{GOAL_LABELS[g]}</span>
                <span className="block text-xs text-muted">{GOAL_HINTS[g]}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </Card>

      <Card>
        <fieldset>
          <legend className="mb-3 text-sm font-bold">Days per week</legend>
          <div className="flex gap-2">
            {days.map((d) => (
              <label
                key={d}
                className={cx(
                  'flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg text-sm font-bold ring-1',
                  daysPerWeek === d
                    ? 'bg-brand-400 text-night-950 ring-brand-400 glow'
                    : 'ring-line-strong hover:bg-white/5',
                )}
              >
                <input
                  type="radio"
                  name="days"
                  value={d}
                  checked={daysPerWeek === d}
                  onChange={() => setDays(d)}
                  className="sr-only"
                />
                {d}
              </label>
            ))}
          </div>
        </fieldset>
      </Card>

      <Card>
        <fieldset>
          <legend className="mb-3 text-sm font-bold">Equipment you have</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {EQUIPMENT.map((eq) => (
              <label key={eq} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={equipment.includes(eq)}
                  onChange={() => toggle(eq)}
                  className="h-4 w-4 rounded accent-brand-400"
                />
                {EQUIPMENT_LABELS[eq]}
              </label>
            ))}
          </div>
        </fieldset>
      </Card>

      <Card>
        <Field
          id="plan-name"
          label="Plan name (optional)"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          placeholder="Off-season strength"
        />
      </Card>

      <ErrorText error={create.error} />
      <div className="flex gap-2">
        <Button type="submit" disabled={create.isPending || equipment.length === 0}>
          {create.isPending ? 'Building…' : 'Generate plan'}
        </Button>
        <Button variant="ghost" onClick={() => void navigate('/gym')}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
