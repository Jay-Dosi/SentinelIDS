// API Response Types
export interface HealthResponse {
  status: 'ok' | 'degraded'
  models_loaded: boolean
  classifier_ready: boolean
  autoencoder_ready: boolean
  version: string
}

export interface PredictionResponse {
  predicted_attack: string
  confidence: number
  anomaly_score: number
  is_anomaly: boolean
  threat_score: number
  severity: 'low' | 'medium' | 'high' | 'critical'
  signature_matched: boolean
  signature_rule: string | null
  model_version: string
}

export interface BatchPredictionResponse {
  total: number
  results: PredictionResponse[]
}

export interface StatsResponse {
  total_requests: number
  attack_distribution: Record<string, number>
  severity_counts: Record<string, number>
  anomaly_rate: number
}

// Feature input types
export interface TrafficFeatures {
  flow_duration?: number | null
  flow_iat_mean?: number | null
  flow_iat_std?: number | null
  packet_count?: number | null
  fwd_packets?: number | null
  bwd_packets?: number | null
  fwd_bwd_ratio?: number | null
  byte_count?: number | null
  fwd_bytes?: number | null
  bwd_bytes?: number | null
  flow_bytes_per_sec?: number | null
  flow_packets_per_sec?: number | null
  avg_packet_size?: number | null
  fwd_packet_size_mean?: number | null
  bwd_packet_size_mean?: number | null
  syn_flag_count?: number | null
  ack_flag_count?: number | null
  rst_flag_count?: number | null
  fin_flag_count?: number | null
  psh_flag_count?: number | null
  payload_length?: number | null
  payload_entropy?: number | null
  fwd_header_length?: number | null
  bwd_header_length?: number | null
}

// Extended prediction with metadata
export interface PredictionRecord extends PredictionResponse {
  id: string
  timestamp: string
  features: TrafficFeatures
  client_ip?: string
}

// Attack simulator types
export type AttackType = 'ddos' | 'portscan' | 'bruteforce' | 'dos' | 'botnet' | 'web_attack'

export interface AttackTemplate {
  type: AttackType
  label: string
  description: string
  features: TrafficFeatures
  color: string
}

// Chart data types
export interface TimelinePoint {
  time: string
  benign: number
  attack: number
  total: number
}

export interface SeverityDataPoint {
  name: string
  value: number
  color: string
}

// Forensics types
export interface ForensicsData {
  prediction: PredictionRecord
  featureContributions: FeatureContribution[]
  explanation: string[]
}

export interface FeatureContribution {
  feature: string
  value: number
  contribution: number
  direction: 'positive' | 'negative'
}

// CSV types
export interface CSVRow {
  [key: string]: string
}

export interface MappedCSVRow {
  original: CSVRow
  mapped: TrafficFeatures
  valid: boolean
}
