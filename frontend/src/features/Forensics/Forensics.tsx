import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, Download, Filter, ChevronRight } from 'lucide-react'
import { useSettingsStore } from '@/store/settings'
import ExplainabilityPanel from '@/components/ExplainabilityPanel/ExplainabilityPanel'
import ThreatGauge from '@/components/ThreatGauge/ThreatGauge'
import type { PredictionRecord } from '@/types'
import { ATTACK_COLORS } from '@/config/api'
import { format } from 'date-fns'
import { clsx } from 'clsx'

export default function Forensics() {
  const { predictions, selectedPrediction, selectPrediction, clearPredictions } = useSettingsStore()
  const [search, setSearch] = useState('')
  const [filterSeverity, setFilterSeverity] = useState<string>('all')
  const [filterAttack, setFilterAttack] = useState<string>('all')

  const attackTypes = Array.from(new Set(predictions.map((p: PredictionRecord) => p.predicted_attack))).sort()

  const filtered = predictions.filter((p: PredictionRecord) => {
    if (filterSeverity !== 'all' && p.severity !== filterSeverity) return false
    if (filterAttack !== 'all' && p.predicted_attack !== filterAttack) return false
    if (search) {
      const q = search.toLowerCase()
      if (!p.predicted_attack.toLowerCase().includes(q) &&
          !p.severity.toLowerCase().includes(q)) return false
    }
    return true
  })

  const exportForensics = (p: PredictionRecord) => {
    const report = {
      generated_at: new Date().toISOString(),
      prediction: {
        id: p.id,
        timestamp: p.timestamp,
        attack_type: p.predicted_attack,
        confidence: p.confidence,
        threat_score: p.threat_score,
        severity: p.severity,
        anomaly_score: p.anomaly_score,
        is_anomaly: p.is_anomaly,
        signature_matched: p.signature_matched,
        signature_rule: p.signature_rule,
        model_version: p.model_version,
      },
      features: p.features,
    }
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `forensics_${p.id}_${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">Forensics</h1>
          <p className="font-mono text-xs text-text-muted mt-1">
            Investigate prediction history and export forensic reports
          </p>
        </div>
        {predictions.length > 0 && (
          <button
            onClick={clearPredictions}
            className="btn-ghost text-xs flex items-center gap-2"
          >
            <X className="w-3.5 h-3.5" /> Clear History
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="panel p-4 flex items-center gap-4">
        <div className="relative flex-1 max-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search predictions..."
            className="input-field pl-9 py-1.5 text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-text-muted" />
          <select
            value={filterSeverity}
            onChange={e => setFilterSeverity(e.target.value)}
            className="input-field w-32 py-1.5 text-xs"
          >
            <option value="all">All Severity</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>

          <select
            value={filterAttack}
            onChange={e => setFilterAttack(e.target.value)}
            className="input-field w-40 py-1.5 text-xs"
          >
            <option value="all">All Types</option>
            {attackTypes.map((t: string) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <span className="font-mono text-xs text-text-muted ml-auto">
          {filtered.length} of {predictions.length} records
        </span>
      </div>

      {predictions.length === 0 ? (
        <div className="panel p-16 text-center">
          <div className="font-mono text-sm text-text-muted">
            No prediction history yet
          </div>
          <div className="font-mono text-xs text-text-muted mt-2">
            Run predictions in the Playground, Batch, or Simulator tabs
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {/* Prediction list */}
          <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-auto pr-1">
            {filtered.map((p: PredictionRecord) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => selectPrediction(p)}
                className={clsx(
                  "panel p-4 cursor-pointer transition-all duration-150 hover:border-opacity-40",
                  selectedPrediction?.id === p.id && "border-accent-cyan border-opacity-40 bg-accent-cyan bg-opacity-5"
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: ATTACK_COLORS[p.predicted_attack] || '#475569' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span
                        className="font-mono text-sm font-semibold"
                        style={{ color: ATTACK_COLORS[p.predicted_attack] || '#94a3b8' }}
                      >
                        {p.predicted_attack}
                      </span>
                      <span className="font-mono text-xs text-text-muted">
                        {format(new Date(p.timestamp), 'HH:mm:ss')}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="font-mono text-xs text-text-muted">
                        {(p.confidence * 100).toFixed(0)}% conf
                      </span>
                      <span className="font-mono text-xs text-text-muted">
                        score: {p.threat_score.toFixed(0)}
                      </span>
                      <span className={clsx(
                        'text-xs font-mono',
                        p.severity === 'low' && 'badge-low',
                        p.severity === 'medium' && 'badge-medium',
                        p.severity === 'high' && 'badge-high',
                        p.severity === 'critical' && 'badge-critical',
                      )}>
                        {p.severity}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-text-muted flex-shrink-0" />
                </div>
              </motion.div>
            ))}
          </div>

          {/* Detail panel */}
          <AnimatePresence mode="wait">
            {selectedPrediction ? (
              <motion.div
                key={selectedPrediction.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4 max-h-[calc(100vh-280px)] overflow-auto pr-1"
              >
                {/* Header */}
                <div className="panel p-4 flex items-center justify-between">
                  <div>
                    <div className="font-mono text-xs text-text-muted mb-1">Forensic Record</div>
                    <div className="font-mono text-xs text-text-muted">{selectedPrediction.id}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => exportForensics(selectedPrediction)}
                      className="btn-ghost flex items-center gap-2 py-1.5 text-xs"
                    >
                      <Download className="w-3.5 h-3.5" /> Export
                    </button>
                    <button onClick={() => selectPrediction(null)} className="btn-ghost p-1.5">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Gauge + prediction */}
                <div className="panel p-5 flex items-center gap-6">
                  <ThreatGauge
                    score={selectedPrediction.threat_score}
                    severity={selectedPrediction.severity}
                    size="md"
                  />
                  <div className="flex-1">
                    <div
                      className="font-display text-2xl font-bold"
                      style={{ color: ATTACK_COLORS[selectedPrediction.predicted_attack] || '#94a3b8' }}
                    >
                      {selectedPrediction.predicted_attack}
                    </div>
                    <div className="font-mono text-xs text-text-muted mt-1">
                      {format(new Date(selectedPrediction.timestamp), 'PPpp')}
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div>
                        <div className="label-text mb-1">Confidence</div>
                        <div className="font-mono text-sm text-text-primary">
                          {(selectedPrediction.confidence * 100).toFixed(2)}%
                        </div>
                      </div>
                      <div>
                        <div className="label-text mb-1">Anomaly Score</div>
                        <div className={clsx(
                          "font-mono text-sm",
                          selectedPrediction.is_anomaly ? "text-accent-red" : "text-accent-green"
                        )}>
                          {(selectedPrediction.anomaly_score * 100).toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Features */}
                {selectedPrediction.features && (
                  <div className="panel p-4">
                    <div className="label-text mb-3">Raw Features</div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 max-h-48 overflow-auto">
                      {Object.entries(selectedPrediction.features as Record<string, unknown>)
                        .filter(([, v]) => v !== null && v !== undefined)
                        .map(([k, v]) => (
                          <div key={k} className="flex items-center justify-between">
                            <span className="font-mono text-xs text-text-muted truncate">{k}:</span>
                            <span className="font-mono text-xs text-text-primary ml-2">
                              {typeof v === 'number' ? (v as number).toLocaleString() : String(v)}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Explainability */}
                {selectedPrediction.features && (
                  <div className="panel p-4">
                    <ExplainabilityPanel
                      prediction={selectedPrediction}
                      features={selectedPrediction.features}
                    />
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="panel p-12 flex flex-col items-center justify-center text-center"
              >
                <Search className="w-8 h-8 text-text-muted mb-4" />
                <div className="font-mono text-sm text-text-muted">
                  Select a prediction to investigate
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}