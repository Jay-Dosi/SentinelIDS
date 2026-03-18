import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend
} from 'recharts'
import { format } from 'date-fns'

interface TimelinePoint {
  time: string
  benign: number
  attack: number
}

interface TimelineChartProps {
  data: TimelinePoint[]
  height?: number
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="panel-elevated px-3 py-2 text-xs font-mono space-y-1">
      <div className="text-text-muted">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-text-secondary">{p.name}:</span>
          <span className="text-text-primary font-semibold">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function TimelineChart({ data, height = 200 }: TimelineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="gradBenign" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#00ff9f" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#00ff9f" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradAttack" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ff3b5c" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#ff3b5c" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1a2540" vertical={false} />
        <XAxis
          dataKey="time"
          tick={{ fill: '#475569', fontSize: 10, fontFamily: 'IBM Plex Mono' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fill: '#475569', fontSize: 10, fontFamily: 'IBM Plex Mono' }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="benign"
          stroke="#00ff9f"
          strokeWidth={1.5}
          fill="url(#gradBenign)"
          dot={false}
          name="Benign"
        />
        <Area
          type="monotone"
          dataKey="attack"
          stroke="#ff3b5c"
          strokeWidth={1.5}
          fill="url(#gradAttack)"
          dot={false}
          name="Attack"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
