import { MonitorCog, Moon, Sparkles, SunMedium } from 'lucide-react'
import type { DesignLanguage } from '../../store/theme-store'
import { useThemeStore } from '../../store/theme-store'
import { Button } from '../ui/button'

const themes: Array<{ value: DesignLanguage; label: string; description: string }> = [
  { value: 'zen', label: 'Zen', description: '极简、柔和、留白' },
  { value: 'glass', label: 'Glass', description: '通透、渐变、全息' },
  { value: 'brutal', label: 'Brutal', description: '硬朗、网格、效率' },
]

export function ThemeSwitcher() {
  const language = useThemeStore((state) => state.language)
  const mode = useThemeStore((state) => state.mode)
  const setLanguage = useThemeStore((state) => state.setLanguage)
  const setMode = useThemeStore((state) => state.setMode)

  return (
    <div className="panel p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-soft)] text-[var(--accent)]">
          <MonitorCog className="h-5 w-5" />
        </div>
        <div>
          <div className="text-sm font-semibold">Deep Theme Engine</div>
          <div className="text-xs muted">设计语言与明暗模式独立切换</div>
        </div>
      </div>

      <div className="space-y-3">
        {themes.map((theme) => {
          const active = theme.value === language

          return (
            <button
              key={theme.value}
              type="button"
              onClick={() => setLanguage(theme.value)}
              className={`w-full rounded-[var(--radius-md)] border px-4 py-3 text-left transition ${
                active
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text-primary)]'
                  : 'border-[var(--border)] bg-[var(--surface-strong)] text-[var(--text-muted)] hover:border-[var(--accent)]'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold">{theme.label}</span>
                {active ? <Sparkles className="h-4 w-4 text-[var(--accent)]" /> : null}
              </div>
              <p className="mt-1 text-xs">{theme.description}</p>
            </button>
          )
        })}
      </div>

      <div className="mt-4 flex gap-2">
        <Button tone={mode === 'light' ? 'primary' : 'secondary'} onClick={() => setMode('light')} className="flex-1">
          <SunMedium className="h-4 w-4" />
          Light
        </Button>
        <Button tone={mode === 'dark' ? 'primary' : 'secondary'} onClick={() => setMode('dark')} className="flex-1">
          <Moon className="h-4 w-4" />
          Dark
        </Button>
      </div>
    </div>
  )
}