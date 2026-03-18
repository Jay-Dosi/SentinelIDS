import { useEffect, useRef } from 'react'
import type { PredictionRecord } from '@/types'
import { ATTACK_COLORS } from '@/config/api'

// Simulated geo locations for attacks (in real deployment would come from IP geolocation)
const ATTACK_ORIGINS = [
  { lat: 39.9042, lng: 116.4074, city: 'Beijing' },
  { lat: 55.7558, lng: 37.6173, city: 'Moscow' },
  { lat: 37.5665, lng: 126.9780, city: 'Seoul' },
  { lat: 52.5200, lng: 13.4050, city: 'Berlin' },
  { lat: 40.7128, lng: -74.0060, city: 'New York' },
  { lat: 35.6762, lng: 139.6503, city: 'Tokyo' },
  { lat: 51.5074, lng: -0.1278, city: 'London' },
  { lat: -23.5505, lng: -46.6333, city: 'São Paulo' },
  { lat: 28.6139, lng: 77.2090, city: 'Delhi' },
  { lat: 1.3521, lng: 103.8198, city: 'Singapore' },
]

interface WorldMapProps {
  predictions: PredictionRecord[]
  height?: number
}

export default function WorldMap({ predictions, height = 300 }: WorldMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    // Dynamic import of leaflet to avoid SSR issues
    import('leaflet').then((L) => {
      const map = L.map(mapRef.current!, {
        center: [20, 0],
        zoom: 2,
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
      }).addTo(map)

      mapInstanceRef.current = map

      // Add markers for predictions
      const attackPredictions = predictions.filter(p => p.predicted_attack !== 'BENIGN')

      attackPredictions.slice(-20).forEach((pred, i) => {
        const origin = ATTACK_ORIGINS[i % ATTACK_ORIGINS.length]
        const color = ATTACK_COLORS[pred.predicted_attack] || '#ff3b5c'

        const icon = L.divIcon({
          html: `<div style="
            width: 10px; height: 10px;
            background: ${color};
            border-radius: 50%;
            box-shadow: 0 0 8px ${color}, 0 0 16px ${color}40;
            animation: pulse 2s infinite;
          "></div>`,
          className: '',
          iconSize: [10, 10],
          iconAnchor: [5, 5],
        })

        L.marker([origin.lat, origin.lng], { icon })
          .addTo(map)
          .bindPopup(`
            <div style="font-family: IBM Plex Mono; font-size: 11px; color: ${color}">
              <strong>${pred.predicted_attack}</strong><br/>
              ${origin.city}<br/>
              Score: ${pred.threat_score.toFixed(0)}
            </div>
          `)
      })
    })

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  // Update markers when predictions change
  useEffect(() => {
    if (!mapInstanceRef.current) return
    // In production, would update markers dynamically
  }, [predictions])

  if (predictions.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center bg-bg-base rounded border border-bg-border"
      >
        <span className="font-mono text-xs text-text-muted">No attack data to display</span>
      </div>
    )
  }

  return (
    <div
      ref={mapRef}
      style={{ height }}
      className="rounded overflow-hidden border border-bg-border"
    />
  )
}
