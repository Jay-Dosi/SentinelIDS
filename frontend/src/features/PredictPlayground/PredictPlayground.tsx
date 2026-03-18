import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'
import { api } from '@/api/client'
import { useSettingsStore } from '@/store/settings'
import PredictionCard from '@/components/PredictionCard/PredictionCard'
import ThreatGauge from '@/components/ThreatGauge/ThreatGauge'
import ExplainabilityPanel from '@/components/ExplainabilityPanel/ExplainabilityPanel'
import type { TrafficFeatures, PredictionResponse } from '@/types'
import { nanoid } from 'nanoid'

const featureSchema = z.object({
  flow_duration: z.coerce.number().min(0).optional(),
  flow_iat_mean: z.coerce.number().min(0).optional(),
  flow_iat_std: z.coerce.number().min(0).optional(),
  packet_count: z.coerce.number().min(0).optional(),
  fwd_packets: z.coerce.number().min(0).optional(),
  bwd_packets: z.coerce.number().min(0).optional(),
  fwd_bwd_ratio: z.coerce.number().min(0).optional(),
  byte_count: z.coerce.number().min(0).optional(),
  fwd_bytes: z.coerce.number().min(0).optional(),
  bwd_bytes: z.coerce.number().min(0).optional(),
  flow_bytes_per_sec: z.coerce.number().min(0).optional(),
  flow_packets_per_sec: z.coerce.number().min(0).optional(),
  avg_packet_size: z.coerce.number().min(0).optional(),
  fwd_packet_size_mean: z.coerce.number().min(0).optional(),
  bwd_packet_size_mean: z.coerce.number().min(0).optional(),
  syn_flag_count: z.coerce.number().min(0).optional(),
  ack_flag_count: z.coerce.number().min(0).optional(),
  rst_flag_count: z.coerce.number().min(0).optional(),
  fin_flag_count: z.coerce.number().min(0).optional(),
  psh_flag_count: z.coerce.number().min(0).optional(),
  payload_length: z.coerce.number().min(0).optional(),
  payload_entropy: z.coerce.number().min(0).optional(),
  fwd_header_length: z.coerce.number().min(0).optional(),
  bwd_header_length: z.coerce.number().min(0).optional(),
})

type FeatureForm = z.infer<typeof featureSchema>

const PRESETS = {
  benign: {
    label: 'Normal Traffic',
    color: '#00ff9f',
    features: {
      flow_duration: 0.5, flow_iat_mean: 0.1, flow_iat_std: 0.05,
      packet_count: 10, fwd_packets: 6, bwd_packets: 4, fwd_bwd_ratio: 1.5,
      byte_count: 1500, fwd_bytes: 900, bwd_bytes: 600,
      flow_bytes_per_sec: 3000, flow_packets_per_sec: 20,
      avg_packet_size: 150, fwd_packet_size_mean: 150, bwd_packet_size_mean: 150,
      syn_flag_count: 1, ack_flag_count: 1, rst_flag_count: 0,
      fin_flag_count: 0, psh_flag_count: 0,
      payload_length: 900, payload_entropy: 0.5,
      fwd_header_length: 20, bwd_header_length: 20,
    },
  },
  ddos: {
    label: 'DDoS Attack',
    color: '#ff3b5c',
    features: {
      flow_duration: 0.001, flow_iat_mean: 0.0001, flow_iat_std: 0.00001,
      packet_count: 50000, fwd_packets: 49000, bwd_packets: 1000, fwd_bwd_ratio: 49,
      byte_count: 5000000, fwd_bytes: 4900000, bwd_bytes: 100000,
      flow_bytes_per_sec: 999999999, flow_packets_per_sec: 999999999,
      avg_packet_size: 100, fwd_packet_size_mean: 100, bwd_packet_size_mean: 100,
      syn_flag_count: 49000, ack_flag_count: 0, rst_flag_count: 0,
      fin_flag_count: 0, psh_flag_count: 0,
      payload_length: 4900000, payload_entropy: 0.1,
      fwd_header_length: 20, bwd_header_length: 20,
    },
  },
  scan: {
    label: 'Port Scan',
    color: '#00d4ff',
    features: {
      flow_duration: 0.001, flow_iat_mean: 0.0005, flow_iat_std: 0.0001,
      packet_count: 2, fwd_packets: 1, bwd_packets: 1, fwd_bwd_ratio: 1,
      byte_count: 120, fwd_bytes: 60, bwd_bytes: 60,
      flow_bytes_per_sec: 120000, flow_packets_per_sec: 2000,
      avg_packet_size: 60, fwd_packet_size_mean: 60, bwd_packet_size_mean: 60,
      syn_flag_count: 1, ack_flag_count: 0, rst_flag_count: 1,
      fin_flag_count: 0, psh_flag_count: 0,
      payload_length: 0, payload_entropy: 0,
      fwd_header_length: 20, bwd_header_length: 20,
    },
  },
}

const FEATURE_GROUPS = [
  {
    label: 'Flow Timing',
    fields: ['flow_duration', 'flow_iat_mean', 'flow_iat_std'],
  },
  {
    label: 'Packet Counts',
    fields: ['packet_count', 'fwd_packets', 'bwd_packets', 'fwd_bwd_ratio'],
  },
  {
    label: 'Byte Counts',
    fields: ['byte_count', 'fwd_bytes', 'bwd_bytes'],
  },
  {
    label: 'Flow Rates',
    fields: ['flow_bytes_per_sec', 'flow_packets_per_sec'],
  },
  {
    label: 'Packet Size',
    fields: ['avg_packet_size', 'fwd_packet_size_mean', 'bwd_packet_size_mean'],
  },
  {
    label: 'TCP Flags',
    fields: ['syn_flag_count', 'ack_flag_count', 'rst_flag_count', 'fin_flag_count', 'psh_flag_count'],
  },
  {
    label: 'Payload',
    fields: ['payload_length', 'payload_entropy'],
  },
  {
    label: 'Headers',
    fields: ['fwd_header_length', 'bwd_header_length'],
  },
]

// nanoid shim if not installed
function genId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

export default function PredictPlayground() {
  const [result, setResult] = useState<PredictionResponse | null>(null)
  const [submittedFeatures, setSubmittedFeatures] = useState<TrafficFeatures | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['Flow Timing', 'TCP Flags']))
  const { addPrediction } = useSettingsStore()

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<FeatureForm>({
    resolver: zodResolver(featureSchema),
  })

  const { mutate, isPending } = useMutation({
    mutationFn: (features: TrafficFeatures) => api.predict(features),
    onSuccess: (data, variables) => {
      setResult(data)
      setSubmittedFeatures(variables)
      addPrediction({
        ...data,
        id: genId(),
        timestamp: new Date().toISOString(),
        features: variables,
      })
    },
  })

  const onSubmit = (data: FeatureForm) => {
    const features: TrafficFeatures = {}
    Object.entries(data).forEach(([k, v]) => {
      if (v !== undefined && v !== null && !isNaN(Number(v))) {
        (features as any)[k] = Number(v)
      }
    })
    mutate(features)
  }

  const loadPreset = (preset: keyof typeof PRESETS) => {
    const features = PRESETS[preset].features
    Object.entries(features).forEach(([k, v]) => {
      setValue(k as any, v)
    })
  }

  const toggleGroup = (label: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-text-primary">Predict Playground</h1>
        <p className="font-mono text-xs text-text-muted mt-1">
          Enter network flow features and get real-time threat classification
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Input form */}
        <div className="space-y-4">
          {/* Presets */}
          <div className="panel p-4">
            <div className="label-text mb-3">Quick Presets</div>
            <div className="flex gap-2">
              {Object.entries(PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => loadPreset(key as keyof typeof PRESETS)}
                  className="flex-1 py-2 px-3 rounded border font-mono text-xs transition-all duration-150
                    hover:opacity-90"
                  style={{
                    borderColor: `${preset.color}40`,
                    color: preset.color,
                    backgroundColor: `${preset.color}10`,
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Feature groups */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            {FEATURE_GROUPS.map((group) => {
              const isExpanded = expandedGroups.has(group.label)
              return (
                <div key={group.label} className="panel overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.label)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-bg-elevated transition-colors"
                  >
                    <span className="font-mono text-xs text-text-secondary uppercase tracking-widest">
                      {group.label}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5 text-text-muted" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
                    )}
                  </button>
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 grid grid-cols-2 gap-3">
                          {group.fields.map((field) => (
                            <div key={field}>
                              <label className="label-text block mb-1">
                                {field.replace(/_/g, ' ')}
                              </label>
                              <input
                                {...register(field as any)}
                                type="number"
                                step="any"
                                placeholder="0"
                                className="input-field"
                              />
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isPending}
                className="flex-1 btn-primary flex items-center justify-center gap-2 py-3"
              >
                {isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-bg-base border-t-transparent rounded-full animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Analyze Traffic
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => { reset(); setResult(null) }}
                className="btn-ghost flex items-center gap-2 px-4"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>

        {/* Results panel */}
        <div className="space-y-4">
          <AnimatePresence mode="wait">
            {result ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                className="space-y-4"
              >
                {/* Main gauge */}
                <div className="panel p-6 flex flex-col items-center">
                  <ThreatGauge
                    score={result.threat_score}
                    severity={result.severity}
                    size="lg"
                  />
                  <div className="mt-4 font-display text-xl font-bold text-center"
                    style={{ color: result.predicted_attack === 'BENIGN' ? '#00ff9f' : '#ff3b5c' }}
                  >
                    {result.predicted_attack}
                  </div>
                  <div className="font-mono text-xs text-text-muted mt-1">
                    {(result.confidence * 100).toFixed(1)}% confidence
                  </div>
                </div>

                <PredictionCard prediction={result} />

                {/* Explainability */}
                {submittedFeatures && (
                  <div className="panel p-5">
                    <ExplainabilityPanel
                      prediction={result}
                      features={submittedFeatures}
                    />
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="panel p-12 flex flex-col items-center justify-center text-center h-64"
              >
                <div className="w-16 h-16 rounded-full bg-bg-base flex items-center justify-center mb-4 border border-bg-border">
                  <Send className="w-6 h-6 text-text-muted" />
                </div>
                <div className="font-mono text-sm text-text-muted">
                  Enter features and click Analyze
                </div>
                <div className="font-mono text-xs text-text-muted mt-2">
                  Or load a preset to get started
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
