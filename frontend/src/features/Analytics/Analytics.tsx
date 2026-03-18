import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts'
import { api } from '@/api/client'
import { useSettingsStore } from '@/store/settings'
import { ATTACK_COLORS, SEVERITY_COLORS } from '@/config/api'
import { format, subHours } from 'date-fns'

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="panel-elevated px-3 py-2 text-xs font-mono space-y-1 z-50">
      <div className="text-text-muted border-b border-bg-border pb-1 mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.fill || p.color }} />
          <span className="text-text-secondary">{p.name}:</span>
          <span className="text-text-primary font-semibold">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function Analytics() {
  const { predictions } = useSettingsStore()

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: api.stats,
    refetchInterval: 15_000,
  })

  // Attack distribution bar chart data
  const attackData = Object.entries(stats?.attack_distribution || {})
    .map(([name, value]) => ({ name, value, fill: ATTACK_COLORS[name] || '#475569' }))
    .sort((a, b) => b.value - a.value)

  // Severity pie data
  const severityData = Object.entries(stats?.severity_counts || {})
    .map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: SEVERITY_COLORS[name as keyof typeof SEVERITY_COLORS] || '#475569',
    }))

  // Confidence histogram from local predictions
  const confBuckets = Array.from({ length: 10 }, (_, i) => ({
    range: `${i * 10}-${(i + 1) * 10}%`,
    count: predictions.filter(p =>
      p.confidence >= i / 10 && p.confidence < (i + 1) / 10
    ).length,
  }))

  // Threat score histogram
  const scoreBuckets = Array.from({ length: 5 }, (_, i) => ({
    range: ['0-20', '20-40', '40-60', '60-80', '80-100'][i],
    low: predictions.filter(p => p.severity === 'low' && p.threat_score >= i*20 && p.threat_score < (i+1)*20).length,
    medium: predictions.filter(p => p.severity === 'medium' && p.threat_score >= i*20 && p.threat_score < (i+1)*20).length,
    high: predictions.filter(p => p.severity === 'high' && p.threat_score >= i*20 && p.threat_score < (i+1)*20).length,
    critical: predictions.filter(p => p.severity === 'critical' && p.threat_score >= i*20 && p.threat_score < (i+1)*20).length,
  }))

  // Hourly trend from local predictions
  const hourlyData = Array.from({ length: 12 }, (_, i) => {
    const hour = subHours(new Date(), 11 - i)
    const hourStr = format(hour, 'HH:00')
    const hourPreds = predictions.filter(p => {
      const pHour = new Date(p.timestamp)
      return pHour.getHours() === hour.getHours()
    })
    return {
      time: hourStr,
      total: hourPreds.length,
      attacks: hourPreds.filter(p => p.predicted_attack !== 'BENIGN').length,
      anomalies: hourPreds.filter(p => p.is_anomaly).length,
    }
  })

  const totalPredictions = stats?.total_requests ?? 0
  const attackRate = totalPredictions > 0
    ? (Object.entries(stats?.attack_distribution || {})
        .filter(([k]) => k !== 'BENIGN')
        .reduce((s, [, v]) => s + (v as number), 0) / totalPredictions * 100
      ).toFixed(1)
    : '0'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-text-primary">Analytics</h1>
        <p className="font-mono text-xs text-text-muted mt-1">
          Threat intelligence and detection statistics
        </p>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Requests', value: totalPredictions.toLocaleString(), color: '#00d4ff' },
          { label: 'Attack Rate', value: `${attackRate}%`, color: '#ff3b5c' },
          { label: 'Anomaly Rate', value: `${((stats?.anomaly_rate ?? 0) * 100).toFixed(1)}%`, color: '#a855f7' },
          { label: 'Local History', value: predictions.length.toLocaleString(), color: '#00ff9f' },
        ].map(({ label, value, color }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="panel p-4"
          >
            <div className="label-text mb-2">{label}</div>
            <div className="font-display text-2xl font-bold" style={{ color }}>{value}</div>
          </motion.div>
        ))}
      </div>

      {/* Attack distribution + Severity */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 panel p-5">
          <div className="label-text mb-4">Attack Type Distribution</div>
          {attackData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={attackData} margin={{ top: 5, right: 10, left: -20, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2540" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#475569', fontSize: 9, fontFamily: 'IBM Plex Mono' }}
                  angle={-35}
                  textAnchor="end"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fill: '#475569', fontSize: 10, fontFamily: 'IBM Plex Mono' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                  {attackData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-60 text-text-muted font-mono text-xs">
              No data — run some predictions first
            </div>
          )}
        </div>

        <div className="panel p-5">
          <div className="label-text mb-4">Severity Breakdown</div>
          {severityData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={severityData}
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {severityData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: '#0d1425',
                      border: '1px solid #1a2540',
                      borderRadius: 6,
                      fontFamily: 'IBM Plex Mono',
                      fontSize: 11,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-3">
                {severityData.map(d => (
                  <div key={d.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                      <span className="font-mono text-xs text-text-secondary">{d.name}</span>
                    </div>
                    <span className="font-mono text-xs text-text-primary">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-40 text-text-muted font-mono text-xs">
              No severity data yet
            </div>
          )}
        </div>
      </div>

      {/* Hourly trend + Confidence */}
      <div className="grid grid-cols-2 gap-4">
        <div className="panel p-5">
          <div className="label-text mb-4">Hourly Activity Trend</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={hourlyData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
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
              <Line type="monotone" dataKey="total" stroke="#00d4ff" strokeWidth={1.5} dot={false} name="Total" />
              <Line type="monotone" dataKey="attacks" stroke="#ff3b5c" strokeWidth={1.5} dot={false} name="Attacks" />
              <Line type="monotone" dataKey="anomalies" stroke="#a855f7" strokeWidth={1.5} dot={false} name="Anomalies" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="panel p-5">
          <div className="label-text mb-4">Confidence Distribution</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={confBuckets} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a2540" vertical={false} />
              <XAxis
                dataKey="range"
                tick={{ fill: '#475569', fontSize: 9, fontFamily: 'IBM Plex Mono' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fill: '#475569', fontSize: 10, fontFamily: 'IBM Plex Mono' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" fill="#00d4ff" fillOpacity={0.6} radius={[3, 3, 0, 0]} name="Predictions" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Threat score stacked */}
      <div className="panel p-5">
        <div className="label-text mb-4">Threat Score Distribution by Severity</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={scoreBuckets} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a2540" vertical={false} />
            <XAxis
              dataKey="range"
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
            <Bar dataKey="low" stackId="a" fill="#00ff9f" fillOpacity={0.7} name="Low" />
            <Bar dataKey="medium" stackId="a" fill="#ffaa00" fillOpacity={0.7} name="Medium" />
            <Bar dataKey="high" stackId="a" fill="#ff6b35" fillOpacity={0.7} name="High" />
            <Bar dataKey="critical" stackId="a" fill="#ff3b5c" fillOpacity={0.7} name="Critical" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
