// MSW mock handlers for offline development
export const MOCK_PREDICTION = {
  predicted_attack: 'BENIGN',
  confidence: 0.92,
  anomaly_score: 0.15,
  is_anomaly: false,
  threat_score: 22.5,
  severity: 'low' as const,
  signature_matched: false,
  signature_rule: null,
  model_version: '1.0.0',
}

export const MOCK_STATS = {
  total_requests: 1247,
  attack_distribution: {
    BENIGN: 892,
    DDOS: 180,
    DOS: 94,
    BOTNET: 47,
    BRUTE_FORCE: 21,
    INFILTRATION: 8,
    PORTSCAN: 5,
  },
  severity_counts: {
    low: 892,
    medium: 180,
    high: 130,
    critical: 45,
  },
  anomaly_rate: 0.284,
}

export const MOCK_HEALTH = {
  status: 'ok',
  models_loaded: true,
  classifier_ready: true,
  autoencoder_ready: true,
  version: '1.0.0',
}

export const ATTACK_PRESETS: Record<string, Record<string, number>> = {
  DDOS: {
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
  DOS: {
    flow_duration: 0.002, flow_iat_mean: 0.0001, flow_iat_std: 0.00001,
    packet_count: 10000, fwd_packets: 9500, bwd_packets: 500, fwd_bwd_ratio: 19,
    byte_count: 950000, fwd_bytes: 900000, bwd_bytes: 50000,
    flow_bytes_per_sec: 475000000, flow_packets_per_sec: 5000000,
    avg_packet_size: 95, fwd_packet_size_mean: 95, bwd_packet_size_mean: 95,
    syn_flag_count: 9500, ack_flag_count: 0, rst_flag_count: 0,
    fin_flag_count: 0, psh_flag_count: 0,
    payload_length: 900000, payload_entropy: 0.05,
    fwd_header_length: 20, bwd_header_length: 20,
  },
  BRUTE_FORCE: {
    flow_duration: 0.1, flow_iat_mean: 0.01, flow_iat_std: 0.001,
    packet_count: 200, fwd_packets: 100, bwd_packets: 100, fwd_bwd_ratio: 1,
    byte_count: 20000, fwd_bytes: 10000, bwd_bytes: 10000,
    flow_bytes_per_sec: 200000, flow_packets_per_sec: 2000,
    avg_packet_size: 100, fwd_packet_size_mean: 100, bwd_packet_size_mean: 100,
    syn_flag_count: 100, ack_flag_count: 100, rst_flag_count: 50,
    fin_flag_count: 0, psh_flag_count: 0,
    payload_length: 10000, payload_entropy: 3.5,
    fwd_header_length: 20, bwd_header_length: 20,
  },
  PORTSCAN: {
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
  BENIGN: {
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
}
