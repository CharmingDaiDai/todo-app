import { Paintbrush2 } from 'lucide-react'
import { useThemeStore } from '../../store/theme-store'

const summaries = {
  zen: '以呼吸感留白、柔和阴影和流动布局构成静态秩序。',
  glass: '通过毛玻璃、动态渐变和荧光高光构建全息层级。',
  brutal: '使用硬边框、等宽字体和高对比硬阴影强调效率。',
} as const

export function ThemeStage() {
  const language = useThemeStore((state) => state.language)
  const mode = useThemeStore((state) => state.mode)

  return (
    <div className="panel relative overflow-hidden p-6">
      <div className="ambient-orb right-4 top-4 h-24 w-24 bg-[var(--accent)]" />
      <div className="ambient-orb bottom-3 left-8 h-20 w-20 bg-[var(--accent-strong)]" />

      <div className="relative z-10 space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-soft)] text-[var(--accent)]">
            <Paintbrush2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold">当前视觉语境</div>
            <div className="text-xs muted">{language.toUpperCase()} / {mode.toUpperCase()}</div>
          </div>
        </div>

        <div>
          <h3 className="text-2xl font-semibold">{language.toUpperCase()} mode is live</h3>
          <p className="mt-2 max-w-xl text-sm muted">{summaries[language]}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {['Inbox Zero', 'Smooth Motion', 'PWA Ready'].map((label, index) => (
            <div key={label} className="panel-strong px-4 py-4">
              <div className="text-xs uppercase tracking-[0.18em] muted">0{index + 1}</div>
              <div className="mt-2 font-semibold">{label}</div>
              <div className="mt-1 text-sm muted">
                {index === 0 && '任务模型、标签和子任务结构已进入基础实现。'}
                {index === 1 && '主题切换、页面过渡和布局动效已纳入前端骨架。'}
                {index === 2 && 'Manifest 与 Service Worker 注册已在工程配置中就位。'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}