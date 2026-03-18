import { motion } from 'framer-motion'
import { clsx } from 'clsx'

interface ThreatGaugeProps {
  score: number
  severity: string
  size?: 'sm' | 'md' | 'lg'
}

const SEVERITY_COLORS = {
  low: '#00ff9f',
  medium: '#ffaa00',
  high: '#ff6b35',
  critical: '#ff3b5c',
}

export default function ThreatGauge({ score, severity, size = 'md' }: ThreatGaugeProps) {
  const color = SEVERITY_COLORS[severity as keyof typeof SEVERITY_COLORS] || '#00d4ff'
  const clampedScore = Math.min(100, Math.max(0, score))

  const sizes = {
    sm: { r: 32, stroke: 4, viewBox: 80, fontSize: 14 },
    md: { r: 48, stroke: 6, viewBox: 120, fontSize: 20 },
    lg: { r: 64, stroke: 8, viewBox: 160, fontSize: 28 },
  }

  const { r, stroke, viewBox, fontSize } = sizes[size]
  const cx = viewBox / 2
  const cy = viewBox / 2
  const circumference = 2 * Math.PI * r
  // Only use 75% of the circle (270 degrees)
  const arcLength = circumference * 0.75
  const offset = arcLength - (clampedScore / 100) * arcLength
  const rotation = -225 // Start from bottom-left

  return (
    <div className="flex flex-col items-center gap-1">
      <svg
        width={viewBox}
        height={viewBox}
        viewBox={`0 0 ${viewBox} ${viewBox}`}
        className="transform"
      >
        {/* Background arc */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="#1a2540"
          strokeWidth={stroke}
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(${rotation} ${cx} ${cy})`}
        />
        {/* Score arc */}
        <motion.circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(${rotation} ${cx} ${cy})`}
          initial={{ strokeDashoffset: arcLength }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
        {/* Score text */}
        <text
          x={cx}
          y={cy + fontSize * 0.35}
          textAnchor="middle"
          fill={color}
          fontSize={fontSize}
          fontFamily="IBM Plex Mono"
          fontWeight="600"
        >
          {Math.round(clampedScore)}
        </text>
        {/* Label */}
        <text
          x={cx}
          y={cy + fontSize + 6}
          textAnchor="middle"
          fill="#475569"
          fontSize={fontSize * 0.4}
          fontFamily="IBM Plex Mono"
          letterSpacing="2"
        >
          THREAT
        </text>
      </svg>
      <span
        className={clsx(
          'font-mono text-xs uppercase tracking-widest px-2 py-0.5 rounded',
          severity === 'low' && 'badge-low',
          severity === 'medium' && 'badge-medium',
          severity === 'high' && 'badge-high',
          severity === 'critical' && 'badge-critical',
        )}
      >
        {severity}
      </span>
    </div>
  )
}
