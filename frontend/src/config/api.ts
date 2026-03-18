export const API_CONFIG = {
  baseURL: (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8000',
  timeout: 30000,
  mockMode: (import.meta as any).env?.VITE_MOCK_MODE === 'true',
  pollInterval: Number((import.meta as any).env?.VITE_POLL_INTERVAL) || 5000,
}

export const ENDPOINTS = {
  health: '/health',
  predict: '/predict',
  predictBatch: '/predict/batch',
  stats: '/stats',
} as const

export const UNIFIED_FEATURES = [
  'flow_duration', 'flow_iat_mean', 'flow_iat_std',
  'packet_count', 'fwd_packets', 'bwd_packets', 'fwd_bwd_ratio',
  'byte_count', 'fwd_bytes', 'bwd_bytes',
  'flow_bytes_per_sec', 'flow_packets_per_sec',
  'avg_packet_size', 'fwd_packet_size_mean', 'bwd_packet_size_mean',
  'syn_flag_count', 'ack_flag_count', 'rst_flag_count', 'fin_flag_count', 'psh_flag_count',
  'payload_length', 'payload_entropy',
  'fwd_header_length', 'bwd_header_length',
] as const

export const SEVERITY_COLORS: Record<string, string> = {
  low: '#00ff9f',
  medium: '#ffaa00',
  high: '#ff6b35',
  critical: '#ff3b5c',
}

export const ATTACK_COLORS: Record<string, string> = {
  BENIGN: '#00ff9f',
  DDOS: '#ff3b5c',
  DOS: '#ff6b35',
  BOTNET: '#a855f7',
  BRUTE_FORCE: '#ffaa00',
  INFILTRATION: '#f43f5e',
  PORTSCAN: '#00d4ff',
  EXPLOITS: '#ef4444',
  FUZZERS: '#8b5cf6',
  GENERIC: '#6366f1',
  BACKDOOR: '#dc2626',
  SHELLCODE: '#b91c1c',
  WEB_BRUTE_FORCE: '#d97706',
  WEB_SQL_INJECTION: '#92400e',
  WEB_XSS: '#78350f',
  WORM: '#7c3aed',
  APACHE2: '#c026d3',
}