import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard, Crosshair, Upload, Zap,
  BarChart3, Search, ChevronLeft, ChevronRight,
  Shield, Activity, AlertCircle
} from 'lucide-react'
import { api } from '@/api/client'
import { useSettingsStore } from '@/store/settings'
import { clsx } from 'clsx'

const NAV_ITEMS = [
  { path: '/dashboard',  label: 'Dashboard',   icon: LayoutDashboard, desc: 'Overview' },
  { path: '/predict',    label: 'Playground',  icon: Crosshair,       desc: 'Live predict' },
  { path: '/batch',      label: 'Batch',       icon: Upload,          desc: 'CSV upload' },
  { path: '/simulator',  label: 'Simulator',   icon: Zap,             desc: 'Attack sim' },
  { path: '/analytics',  label: 'Analytics',   icon: BarChart3,       desc: 'Charts' },
  { path: '/forensics',  label: 'Forensics',   icon: Search,          desc: 'Investigation' },
]

export default function Layout() {
  const { sidebarCollapsed, toggleSidebar } = useSettingsStore()
  const location = useLocation()

  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: api.health,
    refetchInterval: 30_000,
    retry: 1,
  })

  const isOnline = health?.status === 'ok'

  return (
    <div className="flex h-screen bg-bg-base overflow-hidden">
      {/* Sidebar */}
      <motion.aside
        animate={{ width: sidebarCollapsed ? 64 : 220 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="flex flex-col border-r border-bg-border bg-bg-surface z-20 flex-shrink-0"
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-bg-border min-h-[64px]">
          <div className="relative flex-shrink-0">
            <Shield className="w-7 h-7 text-accent-cyan" />
            <div className={clsx(
              "absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-bg-surface",
              isOnline ? "bg-accent-green animate-pulse-cyan" : "bg-accent-red"
            )} />
          </div>
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                <div className="font-display font-bold text-text-primary text-base leading-tight whitespace-nowrap">
                  SENTINEL<span className="text-accent-cyan">IDS</span>
                </div>
                <div className="text-[10px] font-mono text-text-muted uppercase tracking-widest whitespace-nowrap">
                  {isOnline ? 'Systems nominal' : 'Offline mode'}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-4 space-y-1 px-2">
          {NAV_ITEMS.map(({ path, label, icon: Icon, desc }) => {
            const active = location.pathname.startsWith(path)
            return (
              <NavLink
                key={path}
                to={path}
                className={clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-150 group relative",
                  active
                    ? "bg-accent-cyan bg-opacity-10 text-accent-cyan border border-accent-cyan border-opacity-20"
                    : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
                )}
              >
                <Icon className={clsx("w-4 h-4 flex-shrink-0", active && "text-accent-cyan")} />
                <AnimatePresence>
                  {!sidebarCollapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="font-body text-sm font-medium whitespace-nowrap"
                    >
                      {label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {/* Tooltip when collapsed */}
                {sidebarCollapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-bg-elevated border border-bg-border
                    rounded text-xs font-mono text-text-primary whitespace-nowrap opacity-0
                    group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                    {label}
                    <div className="text-text-muted">{desc}</div>
                  </div>
                )}
                {active && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-accent-cyan rounded-r" />
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* Collapse toggle */}
        <div className="p-3 border-t border-bg-border">
          <button
            onClick={toggleSidebar}
            className="w-full flex items-center justify-center p-2 rounded text-text-muted
              hover:text-accent-cyan hover:bg-bg-elevated transition-all duration-150"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </motion.aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-16 border-b border-bg-border bg-bg-surface flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-accent-cyan" />
            <span className="font-mono text-xs text-text-secondary uppercase tracking-wider">
              {NAV_ITEMS.find(n => location.pathname.startsWith(n.path))?.label || 'SentinelIDS'}
            </span>
          </div>
          <div className="flex items-center gap-4">
            {health && (
              <div className="flex items-center gap-2">
                <div className={clsx(
                  "w-1.5 h-1.5 rounded-full",
                  isOnline ? "bg-accent-green animate-pulse" : "bg-accent-red"
                )} />
                <span className="font-mono text-xs text-text-muted">
                  {isOnline ? `v${health.version}` : 'offline'}
                </span>
              </div>
            )}
            {!isOnline && (
              <div className="flex items-center gap-1.5 text-accent-amber">
                <AlertCircle className="w-3.5 h-3.5" />
                <span className="font-mono text-xs">Mock mode</span>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto bg-bg-base">
          <div className="cyber-grid min-h-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="p-6"
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  )
}
