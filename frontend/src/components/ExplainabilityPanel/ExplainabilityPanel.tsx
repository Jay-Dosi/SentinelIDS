import { motion } from 'framer-motion'
import { Brain, TrendingUp, TrendingDown, Info } from 'lucide-react'
import type { PredictionResponse, TrafficFeatures } from '@/types'
import { ATTACK_COLORS } from '@/config/api'

interface ExplainabilityPanelProps {
  prediction: PredictionResponse
  features: TrafficFeatures
}

interface FeatureContribution {
  name: string
  value: number
  contribution: number
  direction: 'positive' | 'negative'
  explanation: string
}

function computeContributions(
  features: TrafficFeatures,
  prediction: PredictionResponse
): FeatureContribution[] {
  const isBenign = prediction.predicted_attack === 'BENIGN'

  const rules: FeatureContribution[] = []

  const synCount = features.syn_flag_count ?? 0
  if (synCount > 1000) {
    rules.push({
      name: 'SYN Flag Count',
      value: synCount,
      contribution: Math.min(synCount / 10000, 1),
      direction: 'positive',
      explanation: `${synCount.toLocaleString()} SYN packets — indicative of SYN flood or port scan`,
    })
  }

  const pps = features.flow_packets_per_sec ?? 0
  if (pps > 10000) {
    rules.push({
      name: 'Packets/sec',
      value: pps,
      contribution: Math.min(pps / 1000000, 1),
      direction: 'positive',
      explanation: `${pps.toLocaleString()} pkt/s — extremely high rate suggests volumetric attack`,
    })
  }

  const entropy = features.payload_entropy ?? 0
  if (entropy > 6) {
    rules.push({
      name: 'Payload Entropy',
      value: entropy,
      contribution: (entropy - 6) / 2,
      direction: 'positive',
      explanation: `Entropy ${entropy.toFixed(2)} — high randomness may indicate encrypted C2 traffic`,
    })
  } else if (entropy < 1 && entropy >= 0) {
    rules.push({
      name: 'Payload Entropy',
      value: entropy,
      contribution: 0.4,
      direction: 'positive',
      explanation: `Entropy ${entropy.toFixed(2)} — very low entropy indicates repetitive attack payload`,
    })
  }

  const ratio = features.fwd_bwd_ratio ?? 0
  if (ratio > 10) {
    rules.push({
      name: 'Fwd/Bwd Ratio',
      value: ratio,
      contribution: Math.min(ratio / 50, 1),
      direction: 'positive',
      explanation: `Ratio ${ratio.toFixed(1)} — heavily asymmetric flow typical of DDoS or scan`,
    })
  }

  const conf = prediction.confidence
  rules.push({
    name: 'Classifier Confidence',
    value: conf,
    contribution: conf,
    direction: isBenign ? 'negative' : 'positive',
    explanation: `Model is ${(conf * 100).toFixed(1)}% confident in ${prediction.predicted_attack} classification`,
  })

  const anomaly = prediction.anomaly_score
  if (anomaly > 0.5) {
    rules.push({
      name: 'Anomaly Score',
      value: anomaly,
      contribution: anomaly,
      direction: 'positive',
      explanation: `Autoencoder reconstruction error ${(anomaly * 100).toFixed(1)}% above threshold`,
    })
  }

  return rules.sort((a, b) => b.contribution - a.contribution).slice(0, 6)
}

export default function ExplainabilityPanel({ prediction, features }: ExplainabilityPanelProps) {
  const contributions = computeContributions(features, prediction)
  const attackColor = ATTACK_COLORS[prediction.predicted_attack] || '#00d4ff'

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Brain className="w-4 h-4 text-accent-purple" />
        <span className="font-mono text-xs text-text-secondary uppercase tracking-widest">
          Model Reasoning
        </span>
      </div>

      {contributions.length === 0 ? (
        <div className="flex items-center gap-2 text-text-muted font-mono text-sm">
          <Info className="w-4 h-4" />
          No significant feature contributions detected
        </div>
      ) : (
        <div className="space-y-3">
          {contributions.map((c, i) => (
            <motion.div
              key={c.name}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className="space-y-1"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {c.direction === 'positive'
                    ? <TrendingUp className="w-3 h-3 text-accent-red" />
                    : <TrendingDown className="w-3 h-3 text-accent-green" />
                  }
                  <span className="font-mono text-xs text-text-secondary">{c.name}</span>
                </div>
                <span className="font-mono text-xs" style={{ color: attackColor }}>
                  {(c.contribution * 100).toFixed(0)}%
                </span>
              </div>
              <div className="h-1.5 bg-bg-base rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${c.contribution * 100}%` }}
                  transition={{ duration: 0.6, delay: i * 0.08, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{
                    backgroundColor: c.direction === 'positive' ? attackColor : '#00ff9f',
                    boxShadow: `0 0 6px ${c.direction === 'positive' ? attackColor : '#00ff9f'}60`,
                  }}
                />
              </div>
              <p className="font-mono text-xs text-text-muted leading-relaxed">
                {c.explanation}
              </p>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
