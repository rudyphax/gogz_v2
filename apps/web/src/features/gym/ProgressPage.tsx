import { useState } from 'react';
import { Link } from 'react-router';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useProgress, useProgressList } from '../../api/hooks';
import { Card, Empty, ErrorText, Loading, PageHeader } from '../../components/ui';

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export function ProgressPage() {
  const list = useProgressList();
  const [picked, setPicked] = useState<string | null>(null);
  const slug = picked ?? list.data?.[0]?.exerciseSlug ?? null;
  const progress = useProgress(slug);
  const points = progress.data?.points.map((p) => ({ ...p, label: shortDate(p.date) })) ?? [];

  return (
    <div className="space-y-4">
      <Link to="/gym" className="text-sm text-brand-300 hover:underline">
        ← Back to Gym
      </Link>
      <PageHeader
        title="Progress"
        subtitle="Your best set per workout, with estimated one-rep max."
      />
      {list.isPending ? (
        <Loading />
      ) : list.error ? (
        <ErrorText error={list.error} />
      ) : !list.data.length ? (
        <Empty>Log a workout to start tracking progress.</Empty>
      ) : (
        <>
          <label className="block text-sm font-medium">
            Exercise
            <select
              className="mt-1 block w-full rounded-lg px-3 py-2 ring-1 ring-line-strong sm:w-80"
              value={slug ?? ''}
              onChange={(e) => setPicked(e.target.value)}
            >
              {list.data.map((e) => (
                <option key={e.exerciseSlug} value={e.exerciseSlug}>
                  {e.exerciseName}
                </option>
              ))}
            </select>
          </label>
          <Card>
            {progress.isPending ? (
              <Loading />
            ) : points.length < 1 ? (
              <Empty>No completed sets for this exercise yet.</Empty>
            ) : (
              <>
                <div
                  className="h-64"
                  role="img"
                  aria-label={`${progress.data?.exerciseName} progress chart`}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                      <CartesianGrid stroke="#1c2d4a" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 12, fill: '#8b9bb8' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: '#8b9bb8' }}
                        tickLine={false}
                        axisLine={false}
                        domain={['auto', 'auto']}
                      />
                      <Tooltip
                        contentStyle={{
                          background: '#0c1729',
                          border: '1px solid #2a4068',
                          borderRadius: 8,
                          color: '#e6eefb',
                        }}
                        labelStyle={{ color: '#8b9bb8' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="e1rm"
                        name="Est. 1RM (lb)"
                        stroke="#22d3ee"
                        strokeWidth={2.5}
                        dot={{ r: 3 }}
                        isAnimationActive={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="weight"
                        name="Top weight (lb)"
                        stroke="#5d6e8f"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <table className="mt-4 w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted">
                      <th className="font-medium">Date</th>
                      <th className="font-medium">Best set</th>
                      <th className="text-right font-medium">Est. 1RM</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {[...points].reverse().map((p) => (
                      <tr key={p.sessionId} className="border-t border-line">
                        <td className="py-1.5">{p.label}</td>
                        <td>{p.weight ? `${p.weight} lb × ${p.reps}` : `${p.reps} reps`}</td>
                        <td className="text-right">{p.e1rm || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
