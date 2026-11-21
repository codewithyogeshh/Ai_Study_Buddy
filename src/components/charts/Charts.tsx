import { useId } from 'react'

import { dayLabel } from '../../lib/format'

/** Bar chart of study minutes per day, with a quiet grid and keyboard-free hover titles. */
export function ActivityChart({
  data,
  unit = 'min',
  height = 150,
}: {
  data: { date: string; minutes: number; quizzes?: number }[]
  unit?: string
  height?: number
}) {
  const max = Math.max(1, ...data.map((d) => d.minutes))
  const barWidth = 100 / Math.max(data.length, 1)
  const showEvery = data.length > 16 ? Math.ceil(data.length / 8) : data.length > 10 ? 2 : 1

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
        role="img"
        aria-label="Study activity chart"
      >
        {[0.25, 0.5, 0.75, 1].map((tick) => (
          <line
            key={tick}
            x1="0"
            x2="100"
            y1={height - tick * (height - 16)}
            y2={height - tick * (height - 16)}
            stroke="var(--border)"
            strokeWidth="0.5"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {data.map((d, i) => {
          const h = (d.minutes / max) * (height - 22)
          return (
            <rect
              key={d.date}
              x={i * barWidth + barWidth * 0.24}
              y={height - Math.max(h, d.minutes > 0 ? 3 : 1.5)}
              width={barWidth * 0.52}
              height={Math.max(h, d.minutes > 0 ? 3 : 1.5)}
              rx="1.2"
              fill={d.minutes > 0 ? 'var(--primary)' : 'var(--surface-3)'}
              opacity={d.quizzes ? 1 : 0.82}
            >
              <title>{`${dayLabel(d.date)} — ${d.minutes} ${unit}`}</title>
            </rect>
          )
        })}
      </svg>
      <div className="mt-1.5 flex justify-between text-[10.5px] text-muted">
        {data.map((d, i) =>
          i % showEvery === 0 || i === data.length - 1 ? <span key={d.date}>{dayLabel(d.date)}</span> : null,
        )}
      </div>
    </div>
  )
}

/** Line chart for quiz percentages over time. */
export function ScoreChart({ points, height = 190 }: { points: { label: string; value: number }[]; height?: number }) {
  const gradientId = useId().replace(/:/g, '')
  if (!points.length) return null
  const width = 100
  const top = 10
  const bottom = height - 18
  const usable = bottom - top
  const step = points.length > 1 ? width / (points.length - 1) : width
  const coords = points.map((p, i) => ({
    x: points.length > 1 ? i * step : width / 2,
    y: bottom - (Math.max(0, Math.min(100, p.value)) / 100) * usable,
  }))
  const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(2)},${c.y.toFixed(2)}`).join(' ')
  const area = `${line} L${coords[coords.length - 1].x.toFixed(2)},${bottom} L${coords[0].x.toFixed(2)},${bottom} Z`

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
        role="img"
        aria-label="Quiz score trend"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 50, 100].map((value) => {
          const y = bottom - (value / 100) * usable
          return (
            <line
              key={value}
              x1="0"
              x2="100"
              y1={y}
              y2={y}
              stroke="var(--border)"
              strokeWidth="0.5"
              strokeDasharray={value === 0 ? undefined : '2 2'}
              vectorEffect="non-scaling-stroke"
            />
          )
        })}
        <path d={area} fill={`url(#${gradientId})`} />
        <path
          d={line}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="1.6"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r="1.5" fill="var(--primary)" vectorEffect="non-scaling-stroke">
            <title>{`${points[i].label}: ${points[i].value}%`}</title>
          </circle>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10.5px] text-muted">
        <span>{points[0]?.label}</span>
        <span>{points[points.length - 1]?.label}</span>
      </div>
    </div>
  )
}

/** Horizontal bars for topic mastery. */
export function TopicBars({ topics }: { topics: { topic: string; percentage: number; total: number }[] }) {
  return (
    <ul className="space-y-3">
      {topics.map((topic) => (
        <li key={topic.topic}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[12.5px]">
            <span className="truncate text-ink-soft">{topic.topic}</span>
            <span className="shrink-0 tabular-nums text-muted">
              {topic.percentage}% <span className="text-[11px]">({topic.total})</span>
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
            <div
              className={topic.percentage >= 70 ? 'h-full rounded-full bg-ok' : topic.percentage >= 40 ? 'h-full rounded-full bg-warn' : 'h-full rounded-full bg-bad'}
              style={{ width: `${Math.max(3, Math.min(100, topic.percentage))}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}
