import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Activity, Shield, AlertTriangle, TrendingUp, Zap, Eye } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { api } from '@/api/client'
import { useSettingsStore } from '@/store/settings'
import { usePolling } from '@/hooks/usePolling'
import TimelineChart from '@/components/TimelineChart/TimelineChart'
import PredictionCard from '@/components/PredictionCard/PredictionCard'
import { ATTACK_COLORS, SEVERITY_COLORS } from '@/config/api'
import { clsx } from 'clsx'
import { format, subMinutes } from 'date-fns'

function generateTimelineData(predictions: any[]) {
  const now = new Date()
  return Array.from({ length: 20 }, (_, i) => {
    const time = subMinutes(now, 19 - i)
    const windowPreds = predictions.filter(p => {
      const pTime = new Date(p.timestamp)
      return Math.abs(pTime.getTime() - time.getTime()) < 60000
    })
    return {
      time: format(time, 'HH:mm'),
      benign: windowPreds.filter(p => p.predicted_attack === 'BENIGN').length,
      attack: windowPreds.filter(p => p.predicted_attack !== 'BENIGN').length,
    }
  })
}

const StatCard = ({ icon: Icon, label, value, sub, color }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="panel p-5"
  >
    <div className="flex items-start justify-between">
      <div>
        <div className="label-text mb-2">{label}</div>
        <div className="metric-value">{value}</div>
        {sub && <div className="font-mono text-xs text-text-muted mt-1">{sub}</div>}
      </div>
      <div className="p-2.5 rounded-lg bg-bg-base">
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
    </div>
  </motion.div>
)

export default function Dashboard() {
  const { predictions, addPrediction } = useSettingsStore()

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['stats'],
    queryFn: api.stats,
    refetchInterval: 10_000,
  })

  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: api.health,
  })

  const recentPredictions = predictions.slice(0, 8)
  const attackPredictions = predictions.filter(p => p.predicted_attack !== 'BENIGN')
  const criticalCount = predictions.filter(p => p.severity === 'critical').length

  const attackDistData = Object.entries(stats?.attack_distribution || {})
    .map(([name, value]) => ({
      name,
      value: value as number,
      color: ATTACK_COLORS[name] || '#475569',
    }))
    .sort((a, b) => b.value - a.value)

  const severityData = Object.entries(stats?.severity_counts || {})
    .map(([name, value]) => ({
      name,
      value: value as number,
      color: SEVERITY_COLORS[name as keyof typeof SEVERITY_COLORS] || '#475569',
    }))

  const timelineData = generateTimelineData(predictions)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">
            Security Overview
          </h1>
          <p className="font-mono text-xs text-text-muted mt-1">
            Real-time intrusion detection monitoring
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={clsx(
            "w-2 h-2 rounded-full",
            health?.status === 'ok' ? "bg-accent-green animate-pulse" : "bg-accent-red"
          )} />
          <span className="font-mono text-xs text-text-muted">
            {health?.status === 'ok' ? 'All systems operational' : 'Degraded mode'}
          </span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          icon={Eye}
          label="Total Analyzed"
          value={(stats?.total_requests ?? 0).toLocaleString()}
          sub="All time"
          color="#00d4ff"
        />
        <StatCard
          icon={AlertTriangle}
          label="Threats Detected"
          value={attackPredictions.length.toLocaleString()}
          sub={`${predictions.length > 0 ? ((attackPredictions.length / predictions.length) * 100).toFixed(1) : 0}% attack rate`}
          color="#ff3b5c"
        />
        <StatCard
          icon={Zap}
          label="Critical Alerts"
          value={criticalCount.toLocaleString()}
          sub="Requires immediate action"
          color="#ff3b5c"
        />
        <StatCard
          icon={Activity}
          label="Anomaly Rate"
          value={`${((stats?.anomaly_rate ?? 0) * 100).toFixed(1)}%`}
          sub="Autoencoder detection"
          color="#a855f7"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Timeline */}
        <div className="col-span-2 panel p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="label-text mb-1">Traffic Timeline</div>
              <div className="font-display text-sm font-semibold text-text-primary">
                Benign vs Attack flows
              </div>
            </div>
            <TrendingUp className="w-4 h-4 text-text-muted" />
          </div>
          <TimelineChart data={timelineData} height={180} />
        </div>

        {/* Attack distribution */}
        <div className="panel p-5">
          <div className="label-text mb-4">Attack Distribution</div>
          {attackDistData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie
                    data={attackDistData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={65}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {attackDistData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: any, n: any) => [v, n]}
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
              <div className="space-y-1.5 mt-2">
                {attackDistData.slice(0, 4).map((d) => (
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
              No data yet — run predictions
            </div>
          )}
        </div>
      </div>

      {/* Recent predictions */}
      <div className="panel p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="label-text flex items-center gap-2">
            <Shield className="w-3.5 h-3.5" /> Recent Predictions
          </div>
          <span className="font-mono text-xs text-text-muted">
            {recentPredictions.length} of {predictions.length}
          </span>
        </div>
        {recentPredictions.length === 0 ? (
          <div className="text-center py-10 text-text-muted font-mono text-sm">
            No predictions yet — go to{' '}
            <a href="/predict" className="text-accent-cyan hover:underline">Playground</a>
            {' '}or{' '}
            <a href="/simulator" className="text-accent-cyan hover:underline">Simulator</a>
          </div>
        ) : (
          <div className="space-y-2">
            {recentPredictions.map((p) => (
              <PredictionCard key={p.id} prediction={p} compact />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
