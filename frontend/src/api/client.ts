import axios from 'axios'
import { API_CONFIG, ENDPOINTS } from '@/config/api'

export const apiClient = axios.create({
  baseURL: API_CONFIG.baseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})

// Types matching backend schemas
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

export interface HealthResponse {
  status: string
  models_loaded: boolean
  classifier_ready: boolean
  autoencoder_ready: boolean
  version: string
}

export interface StatsResponse {
  total_requests: number
  attack_distribution: Record<string, number>
  severity_counts: Record<string, number>
  anomaly_rate: number
}

// API functions
export const api = {
  health: () => apiClient.get<HealthResponse>('/health').then(r => r.data),
  predict: (features: TrafficFeatures) =>
    apiClient.post<PredictionResponse>('/predict', features).then(r => r.data),
  predictBatch: (records: TrafficFeatures[]) =>
    apiClient.post<BatchPredictionResponse>('/predict/batch', { records }).then(r => r.data),
  stats: () => apiClient.get<StatsResponse>('/stats').then(r => r.data),
}
