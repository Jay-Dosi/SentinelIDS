import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from '@/components/Layout/Layout'
import Dashboard from '@/features/Dashboard/Dashboard'
import PredictPlayground from '@/features/PredictPlayground/PredictPlayground'
import BatchUpload from '@/features/BatchUpload/BatchUpload'
import AttackSimulator from '@/features/AttackSimulator/AttackSimulator'
import Analytics from '@/features/Analytics/Analytics'
import Forensics from '@/features/Forensics/Forensics'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="predict" element={<PredictPlayground />} />
          <Route path="batch" element={<BatchUpload />} />
          <Route path="simulator" element={<AttackSimulator />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="forensics" element={<Forensics />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
