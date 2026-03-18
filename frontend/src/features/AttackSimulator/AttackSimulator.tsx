import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useMutation } from '@tanstack/react-query'
import { Zap, Play, Square, RotateCcw, Activity } from 'lucide-react'
import { api } from '@/api/client'
import { useSettingsStore } from '@/store/settings'
import PredictionCard from '@/components/PredictionCard/PredictionCard'
import TimelineChart from '@/components/TimelineChart/TimelineChart'
import type { PredictionResponse, TrafficFeatures } from '@/types'
import { ATTACK_COLORS } from '@/config/api'
import { format } from 'date-fns'

const ATTACK_TEMPLATES: Array<{
  type: string
  label: string
  description: string
  color: string
  icon: string
  features: TrafficFeatures
}> = [
  {
    type: 'ddos',
    label: 'DDoS Burst',
    description: 'Volumetric flood with massive packet rate',
    color: '#ff3b5c',
    icon: '💥',
    features: {
      flow_duration: 0.001, flow_iat_mean: 0.00001, flow_iat_std: 0.000001,
      packet_count: 100000, fwd_packets: 99000, bwd_packets: 1000, fwd_bwd_ratio: 99,
      byte_count: 9900000, fwd_bytes: 9800000, bwd_bytes: 100000,
      flow_bytes_per_sec: 999999999, flow_packets_per_sec: 999999999,
      avg_packet_size: 99, fwd_packet_size_mean: 99, bwd_packet_size_mean: 100,
      syn_flag_count: 99000, ack_flag_count: 0, rst_flag_count: 0,
      fin_flag_count: 0, psh_flag_count: 0,
      payload_length: 9800000, payload_entropy: 0.05,
      fwd_header_length: 20, bwd_header_length: 20,
    },
  },
  {
    type: 'portscan',
    label: 'Port Scan',
    description: 'Systematic probing of network ports',
    color: '#00d4ff',
    icon: '🔍',
    features: {
      flow_duration: 0.0005, flow_iat_mean: 0.0002, flow_iat_std: 0.00005,
      packet_count: 1, fwd_packets: 1, bwd_packets: 0, fwd_bwd_ratio: 999,
      byte_count: 40, fwd_bytes: 40, bwd_bytes: 0,
      flow_bytes_per_sec: 80000, flow_packets_per_sec: 2000,
      avg_packet_size: 40, fwd_packet_size_mean: 40, bwd_packet_size_mean: 0,
      syn_flag_count: 1, ack_flag_count: 0, rst_flag_count: 0,
      fin_flag_count: 0, psh_flag_count: 0,
      payload_length: 0, payload_entropy: 0,
      fwd_header_length: 20, bwd_header_length: 0,
    },
  },
  {
    type: 'bruteforce',
    label: 'Brute Force',
    description: 'Repeated authentication attempts',
    color: '#ffaa00',
    icon: '🔑',
    features: {
      flow_duration: 0.2, flow_iat_mean: 0.02, flow_iat_std: 0.005,
      packet_count: 500, fwd_packets: 250, bwd_packets: 250, fwd_bwd_ratio: 1,
      byte_count: 50000, fwd_bytes: 25000, bwd_bytes: 25000,
      flow_bytes_per_sec: 250000, flow_packets_per_sec: 2500,
      avg_packet_size: 100, fwd_packet_size_mean: 100, bwd_packet_size_mean: 100,
      syn_flag_count: 250, ack_flag_count: 250, rst_flag_count: 100,
      fin_flag_count: 0, psh_flag_count: 50,
      payload_length: 25000, payload_entropy: 3.5,
      fwd_header_length: 20, bwd_header_length: 20,
    },
  },
  {
    type: 'dos',
    label: 'DoS Attack',
    description: 'Single-source denial of service',
    color: '#ff6b35',
    icon: '⚡',
    features: {
      flow_duration: 0.005, flow_iat_mean: 0.0005, flow_iat_std: 0.0001,
      packet_count: 5000, fwd_packets: 4800, bwd_packets: 200, fwd_bwd_ratio: 24,
      byte_count: 480000, fwd_bytes: 460000, bwd_bytes: 20000,
      flow_bytes_per_sec: 96000000, flow_packets_per_sec: 1000000,
      avg_packet_size: 96, fwd_packet_size_mean: 96, bwd_packet_size_mean: 100,
      syn_flag_count: 4800, ack_flag_count: 0, rst_flag_count: 0,
      fin_flag_count: 0, psh_flag_count: 0,
      payload_length: 460000, payload_entropy: 0.1,
      fwd_header_length: 20, bwd_header_length: 20,
    },
  },
  {
    type: 'botnet',
    label: 'Botnet C2',
    description: 'Command and control communication',
    color: '#a855f7',
    icon: '🤖',
    features: {
      flow_duration: 300, flow_iat_mean: 60, flow_iat_std: 10,
      packet_count: 30, fwd_packets: 15, bwd_packets: 15, fwd_bwd_ratio: 1,
      byte_count: 3000, fwd_bytes: 1500, bwd_bytes: 1500,
      flow_bytes_per_sec: 10, flow_packets_per_sec: 0.1,
      avg_packet_size: 100, fwd_packet_size_mean: 100, bwd_packet_size_mean: 100,
      syn_flag_count: 1, ack_flag_count: 15, rst_flag_count: 0,
      fin_flag_count: 1, psh_flag_count: 5,
      payload_length: 1500, payload_entropy: 7.8,
      fwd_header_length: 20, bwd_header_length: 20,
    },
  },
]

function addJitter(features: TrafficFeatures): TrafficFeatures {
  const result: TrafficFeatures = {}
  Object.entries(features).forEach(([k, v]) => {
    if (typeof v === 'number' && v > 0) {
      const jitter = 0.9 + Math.random() * 0.2
      ;(result as any)[k] = v * jitter
    } else {
      ;(result as any)[k] = v
    }
  })
  return result
}

function genId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

export default function AttackSimulator() {
  const [selectedTemplate, setSelectedTemplate] = useState(ATTACK_TEMPLATES[0])
  const [isRunning, setIsRunning] = useState(false)
  const [simResults, setSimResults] = useState<PredictionResponse[]>([])
  const [timelineData, setTimelineData] = useState<Array<{ time: string; benign: number; attack: number }>>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { addPrediction } = useSettingsStore()

  const { mutate } = useMutation({
    mutationFn: (features: TrafficFeatures) => api.predict(features),
    onSuccess: (data, features) => {
      setSimResults(prev => [data, ...prev].slice(0, 50))
      addPrediction({
        ...data,
        id: genId(),
        timestamp: new Date().toISOString(),
        features,
      })
      setTimelineData(prev => {
        const now = format(new Date(), 'HH:mm:ss')
        const last = [...prev].slice(-19)
        const isBenign = data.predicted_attack === 'BENIGN'
        return [...last, {
          time: now,
          benign: isBenign ? 1 : 0,
          attack: isBenign ? 0 : 1,
        }]
      })
    },
  })

  const startSimulation = () => {
    setIsRunning(true)
    setSimResults([])
    setTimelineData([])
    // Fire immediately
    mutate(addJitter(selectedTemplate.features))
    // Then every 1.5 seconds
    intervalRef.current = setInterval(() => {
      mutate(addJitter(selectedTemplate.features))
    }, 1500)
  }

  const stopSimulation = () => {
    setIsRunning(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  const reset = () => {
    stopSimulation()
    setSimResults([])
    setTimelineData([])
  }

  const attackCount = simResults.filter(r => r.predicted_attack !== 'BENIGN').length
  const avgScore = simResults.length
    ? simResults.reduce((s, r) => s + r.threat_score, 0) / simResults.length
    : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-text-primary">Attack Simulator</h1>
        <p className="font-mono text-xs text-text-muted mt-1">
          Simulate cyber attacks and observe real-time detection
        </p>
      </div>

      {/* Template selection */}
      <div className="grid grid-cols-5 gap-3">
        {ATTACK_TEMPLATES.map((template) => (
          <button
            key={template.type}
            onClick={() => { setSelectedTemplate(template); if (isRunning) stopSimulation() }}
            className={`panel p-4 text-left transition-all duration-150 hover:border-opacity-60 ${
              selectedTemplate.type === template.type ? 'border-opacity-60' : ''
            }`}
            style={{
              borderColor: selectedTemplate.type === template.type ? template.color : undefined,
              backgroundColor: selectedTemplate.type === template.type ? `${template.color}08` : undefined,
            }}
          >
            <div className="text-2xl mb-2">{template.icon}</div>
            <div className="font-mono text-xs font-semibold" style={{ color: template.color }}>
              {template.label}
            </div>
            <div className="font-mono text-xs text-text-muted mt-1 leading-relaxed">
              {template.description}
            </div>
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="panel p-4 flex items-center gap-4">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded border"
          style={{ borderColor: `${selectedTemplate.color}40`, color: selectedTemplate.color, backgroundColor: `${selectedTemplate.color}10` }}
        >
          <Zap className="w-4 h-4" />
          <span className="font-mono text-sm font-semibold">{selectedTemplate.label}</span>
        </div>
        <div className="flex-1" />
        <button onClick={reset} className="btn-ghost p-2" disabled={isRunning}>
          <RotateCcw className="w-4 h-4" />
        </button>
        {isRunning ? (
          <button onClick={stopSimulation} className="btn-danger flex items-center gap-2">
            <Square className="w-4 h-4" /> Stop
          </button>
        ) : (
          <button onClick={startSimulation} className="btn-primary flex items-center gap-2">
            <Play className="w-4 h-4" /> Start Simulation
          </button>
        )}
      </div>

      {/* Live stats */}
      {simResults.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="panel p-4 text-center">
            <div className="label-text mb-2">Total Flows</div>
            <div className="font-display text-3xl font-bold text-text-primary">{simResults.length}</div>
          </div>
          <div className="panel p-4 text-center">
            <div className="label-text mb-2">Attacks Detected</div>
            <div className="font-display text-3xl font-bold text-accent-red">{attackCount}</div>
            <div className="font-mono text-xs text-text-muted mt-1">
              {((attackCount / simResults.length) * 100).toFixed(0)}% detection rate
            </div>
          </div>
          <div className="panel p-4 text-center">
            <div className="label-text mb-2">Avg Threat Score</div>
            <div className="font-display text-3xl font-bold" style={{ color: selectedTemplate.color }}>
              {avgScore.toFixed(0)}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Timeline */}
        {timelineData.length > 0 && (
          <div className="panel p-4">
            <div className="label-text mb-3 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5" /> Live Detection Timeline
            </div>
            <TimelineChart data={timelineData} height={180} />
          </div>
        )}

        {/* Live feed */}
        <div className="panel p-4">
          <div className="label-text mb-3 flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-accent-red animate-pulse' : 'bg-text-muted'}`} />
            {isRunning ? 'Live Detection Feed' : 'Detection Results'}
          </div>
          <div className="space-y-2 max-h-64 overflow-auto">
            <AnimatePresence>
              {simResults.slice(0, 8).map((r, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-3 py-2 px-3 rounded bg-bg-base border border-bg-border"
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: ATTACK_COLORS[r.predicted_attack] || '#475569' }}
                  />
                  <span
                    className="font-mono text-xs font-semibold flex-1"
                    style={{ color: ATTACK_COLORS[r.predicted_attack] || '#94a3b8' }}
                  >
                    {r.predicted_attack}
                  </span>
                  <span className="font-mono text-xs text-text-muted">
                    {r.threat_score.toFixed(0)}
                  </span>
                  <span className={`text-xs font-mono ${
                    r.severity === 'critical' ? 'text-accent-red' :
                    r.severity === 'high' ? 'text-severity-high' :
                    r.severity === 'medium' ? 'text-severity-medium' :
                    'text-severity-low'
                  }`}>
                    {r.severity}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
            {simResults.length === 0 && (
              <div className="text-center py-8 text-text-muted font-mono text-xs">
                Click Start Simulation to begin
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
