import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, FileText, X, Download, CheckCircle, AlertCircle } from 'lucide-react'
import Papa from 'papaparse'
import { api } from '@/api/client'
import { useSettingsStore } from '@/store/settings'
import type { TrafficFeatures, PredictionResponse } from '@/types'
import { ATTACK_COLORS, UNIFIED_FEATURES } from '@/config/api'
import { clsx } from 'clsx'

interface BatchResult {
  row: number
  original: Record<string, string>
  prediction: PredictionResponse
}

function mapCSVRow(row: Record<string, string>): TrafficFeatures {
  const features: TrafficFeatures = {}
  UNIFIED_FEATURES.forEach((feat) => {
    const val = row[feat] ?? row[feat.replace(/_/g, ' ')] ?? row[feat.toUpperCase()]
    if (val !== undefined && val !== '') {
      const n = parseFloat(val)
      if (!isNaN(n)) (features as any)[feat] = n
    }
  })
  return features
}

export default function BatchUpload() {
  const [csvData, setCsvData] = useState<Record<string, string>[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [results, setResults] = useState<BatchResult[]>([])
  const [fileName, setFileName] = useState('')
  const { addPredictions } = useSettingsStore()

  const { mutate, isPending, isSuccess } = useMutation({
    mutationFn: async (rows: Record<string, string>[]) => {
      const records = rows.map(mapCSVRow)
      return api.predictBatch(records)
    },
    onSuccess: (data, rows) => {
      const batchResults: BatchResult[] = data.results.map((prediction, i) => ({
        row: i + 1,
        original: rows[i],
        prediction,
      }))
      setResults(batchResults)
      addPredictions(
        batchResults.map(r => ({
          ...r.prediction,
          id: `batch-${r.row}-${Date.now()}`,
          timestamp: new Date().toISOString(),
          features: mapCSVRow(r.original),
        }))
      )
    },
  })

  const onDrop = useCallback((acceptedFiles: File[]) => {
  const file = acceptedFiles[0]
  if (!file) return
  setFileName(file.name)
  setResults([])

  if (file.name.endsWith('.json')) {
    // Handle JSON upload
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string)
        // Support both array of records and {records: [...]} format
        const records: Record<string, string>[] = Array.isArray(parsed)
          ? parsed
          : parsed.records ?? []
        // Convert numbers to strings for unified processing
        const stringified = records.map((r: any) =>
          Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v)]))
        )
        setCsvData(stringified.slice(0, 1000))
        setColumns(stringified.length > 0 ? Object.keys(stringified[0]) : [])
      } catch {
        alert('Invalid JSON file — expected array of objects or {records: [...]}')
      }
    }
    reader.readAsText(file)
  } else {
    // Existing CSV handling
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const rows = result.data as Record<string, string>[]
        setCsvData(rows.slice(0, 1000))
        setColumns(result.meta.fields || [])
      },
    })
  }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
  onDrop,
  accept: {
    'text/csv': ['.csv'],
    'application/json': ['.json'],
  },
  maxFiles: 1,
  })

  const exportResults = () => {
    if (!results.length) return
    const rows = results.map(r => ({
      row: r.row,
      predicted_attack: r.prediction.predicted_attack,
      confidence: r.prediction.confidence.toFixed(4),
      threat_score: r.prediction.threat_score.toFixed(2),
      severity: r.prediction.severity,
      anomaly_score: r.prediction.anomaly_score.toFixed(4),
      is_anomaly: r.prediction.is_anomaly,
    }))
    const csv = Papa.unparse(rows)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sentinel_results_${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const attackSummary = results.reduce<Record<string, number>>((acc, r) => {
    const k = r.prediction.predicted_attack
    acc[k] = (acc[k] || 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-text-primary">Batch Analysis</h1>
        <p className="font-mono text-xs text-text-muted mt-1">
          Upload a CSV file with network flow features for bulk prediction
        </p>
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={clsx(
          "panel p-12 flex flex-col items-center justify-center cursor-pointer transition-all duration-200",
          isDragActive
            ? "border-accent-cyan border-opacity-60 bg-accent-cyan bg-opacity-5"
            : "hover:border-accent-cyan hover:border-opacity-30 hover:bg-bg-elevated"
        )}
      >
        <input {...getInputProps()} />
        <Upload className={clsx("w-10 h-10 mb-4", isDragActive ? "text-accent-cyan" : "text-text-muted")} />
        <div className="font-mono text-sm text-text-secondary text-center">
          {isDragActive ? (
            <span className="text-accent-cyan">Drop CSV file here</span>
          ) : (
            <>
              <span className="text-accent-cyan">Click to browse</span> or drag & drop CSV
            </>
          )}
        </div>
        <div className="font-mono text-xs text-text-muted mt-2">
          CSV or JSON · up to 1,000 rows · columns must match network flow features
        </div>
      </div>

      {/* File loaded */}
      <AnimatePresence>
        {csvData.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* File info */}
            <div className="panel p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-accent-cyan" />
                <div>
                  <div className="font-mono text-sm text-text-primary">{fileName}</div>
                  <div className="font-mono text-xs text-text-muted">
                    {csvData.length} rows · {columns.length} columns
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setCsvData([]); setColumns([]); setResults([]); setFileName('') }}
                  className="btn-ghost p-2"
                >
                  <X className="w-4 h-4" />
                </button>
                <button
                  onClick={() => mutate(csvData)}
                  disabled={isPending}
                  className="btn-primary flex items-center gap-2"
                >
                  {isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-bg-base border-t-transparent rounded-full animate-spin" />
                      Processing {csvData.length} rows...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Run Batch Analysis
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* CSV Preview */}
            {!results.length && (
              <div className="panel overflow-hidden">
                <div className="px-4 py-3 border-b border-bg-border label-text">
                  Data Preview (first 5 rows)
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="border-b border-bg-border">
                        {columns.slice(0, 8).map(col => (
                          <th key={col} className="px-4 py-2 text-left text-text-muted whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                        {columns.length > 8 && (
                          <th className="px-4 py-2 text-text-muted">+{columns.length - 8} more</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {csvData.slice(0, 5).map((row, i) => (
                        <tr key={i} className="border-b border-bg-border border-opacity-50 hover:bg-bg-elevated">
                          {columns.slice(0, 8).map(col => (
                            <td key={col} className="px-4 py-2 text-text-secondary whitespace-nowrap">
                              {row[col] ?? '-'}
                            </td>
                          ))}
                          {columns.length > 8 && <td className="px-4 py-2 text-text-muted">...</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Results */}
            {results.length > 0 && (
              <div className="space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-5 gap-3">
                  {Object.entries(attackSummary)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([attack, count]) => (
                      <div key={attack} className="panel p-3 text-center">
                        <div
                          className="font-mono text-xs mb-1 font-semibold"
                          style={{ color: ATTACK_COLORS[attack] || '#94a3b8' }}
                        >
                          {attack}
                        </div>
                        <div className="font-display text-xl font-bold text-text-primary">{count}</div>
                        <div className="font-mono text-xs text-text-muted">
                          {((count / results.length) * 100).toFixed(0)}%
                        </div>
                      </div>
                    ))}
                </div>

                {/* Results table */}
                <div className="panel overflow-hidden">
                  <div className="px-4 py-3 border-b border-bg-border flex items-center justify-between">
                    <div className="label-text flex items-center gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-accent-green" />
                      {results.length} predictions complete
                    </div>
                    <button
                      onClick={exportResults}
                      className="btn-ghost flex items-center gap-2 py-1.5 text-xs"
                    >
                      <Download className="w-3.5 h-3.5" /> Export CSV
                    </button>
                  </div>
                  <div className="overflow-auto max-h-96">
                    <table className="w-full text-xs font-mono">
                      <thead className="sticky top-0 bg-bg-elevated">
                        <tr className="border-b border-bg-border">
                          <th className="px-4 py-2 text-left text-text-muted">#</th>
                          <th className="px-4 py-2 text-left text-text-muted">Prediction</th>
                          <th className="px-4 py-2 text-left text-text-muted">Confidence</th>
                          <th className="px-4 py-2 text-left text-text-muted">Threat Score</th>
                          <th className="px-4 py-2 text-left text-text-muted">Severity</th>
                          <th className="px-4 py-2 text-left text-text-muted">Anomaly</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.map((r) => (
                          <tr
                            key={r.row}
                            className="border-b border-bg-border border-opacity-30 hover:bg-bg-elevated"
                          >
                            <td className="px-4 py-2 text-text-muted">{r.row}</td>
                            <td className="px-4 py-2">
                              <span
                                className="font-semibold"
                                style={{ color: ATTACK_COLORS[r.prediction.predicted_attack] || '#94a3b8' }}
                              >
                                {r.prediction.predicted_attack}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-text-secondary">
                              {(r.prediction.confidence * 100).toFixed(1)}%
                            </td>
                            <td className="px-4 py-2 text-text-secondary">
                              {r.prediction.threat_score.toFixed(0)}
                            </td>
                            <td className="px-4 py-2">
                              <span className={clsx(
                                r.prediction.severity === 'low' && 'badge-low',
                                r.prediction.severity === 'medium' && 'badge-medium',
                                r.prediction.severity === 'high' && 'badge-high',
                                r.prediction.severity === 'critical' && 'badge-critical',
                              )}>
                                {r.prediction.severity}
                              </span>
                            </td>
                            <td className="px-4 py-2">
                              {r.prediction.is_anomaly ? (
                                <AlertCircle className="w-3.5 h-3.5 text-accent-red" />
                              ) : (
                                <CheckCircle className="w-3.5 h-3.5 text-accent-green" />
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
