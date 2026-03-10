import { motion } from 'framer-motion'
import { CalendarRange, CheckCheck, Layers3, Zap } from 'lucide-react'
import { AppShell } from '../../components/layout/app-shell'
import { ThemeStage } from '../../components/theme/theme-stage'
import { useAuthStore } from '../../store/auth-store'
import { useThemeStore } from '../../store/theme-store'

const foundationCards = [
  {
    title: 'Auth baseline',
    description: '邮箱密码登录、Magic Link 和会话恢复已经接入前端骨架。',
    icon: CheckCheck,
  },
  {
    title: 'Theme engine',
    description: 'Zen / Glass / Brutal 的 light / dark 视觉 token 已接入全局样式层。',
    icon: Layers3,
  },
  {
    title: 'PWA boot',
    description: 'Manifest、Service Worker 自动注册和离线缓存配置已经就位。',
    icon: Zap,
  },
]

const nextMilestones = [
  '接入 Todo / Tag / Subtask 的 Query hooks 与表单 mutation',
  '实现任务列表、过滤、智能排序与乐观更新',
  '完成 dnd-kit 拖拽排序和 fractional indexing',
  '补完通知订阅、Edge Function 与到期提醒链路',
]

export function DashboardPage() {
  const user = useAuthStore((state) => state.user)
  const language = useThemeStore((state) => state.language)
  const mode = useThemeStore((state) => state.mode)

  return (
    <AppShell
      eyebrow="Workspace"
      title="Implementation has started."
      description="当前阶段聚焦工程骨架、认证、主题和 PWA 基线。接下来会继续进入数据库、真实任务模型和拖拽排序。"
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <ThemeStage />

        <section className="panel p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] muted">Session</div>
              <h3 className="mt-2 text-xl font-semibold">欢迎回来，{user?.email ?? 'Builder'}</h3>
            </div>
            <div className="rounded-[var(--radius-md)] bg-[var(--accent-soft)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
              {language} / {mode}
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="panel-strong flex items-start gap-4 p-4">
              <CalendarRange className="mt-0.5 h-5 w-5 text-[var(--accent)]" />
              <div>
                <div className="font-semibold">本轮已完成</div>
                <p className="mt-1 text-sm muted">前端基线、主题状态、认证壳和 PWA 插件已接入；数据库脚本已开始落地到仓库。</p>
              </div>
            </div>

            <div className="panel-strong p-4">
              <div className="text-xs uppercase tracking-[0.18em] muted">Current focus</div>
              <div className="mt-2 text-sm">Todo CRUD 与 Supabase schema 将作为下一轮主线实现。</div>
            </div>
          </div>
        </section>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        {foundationCards.map((card, index) => {
          const Icon = card.icon

          return (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08, duration: 0.35 }}
              className="panel p-5"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-soft)] text-[var(--accent)]">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{card.title}</h3>
              <p className="mt-2 text-sm muted">{card.description}</p>
            </motion.div>
          )
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="panel p-6">
          <div className="text-xs uppercase tracking-[0.18em] muted">Execution queue</div>
          <h3 className="mt-2 text-xl font-semibold">接下来的编码主线</h3>
          <div className="mt-5 space-y-3">
            {nextMilestones.map((item) => (
              <div key={item} className="panel-strong flex items-start gap-3 p-4">
                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
                <span className="text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel p-6">
          <div className="text-xs uppercase tracking-[0.18em] muted">Design intent</div>
          <h3 className="mt-2 text-xl font-semibold">主题层已经不是简单换色</h3>
          <p className="mt-3 text-sm muted">
            当前基线已经把颜色、圆角、边框、阴影、字体与背景材质统一抽成 CSS 变量，后续组件层能在不大改 API 的情况下切换设计语言。
          </p>
          <div className="mt-5 grid gap-3">
            <div className="panel-strong p-4">
              <div className="mono text-xs uppercase tracking-[0.18em] muted">Zen</div>
              <div className="mt-2 text-sm">柔和阴影、大圆角、克制层次。</div>
            </div>
            <div className="panel-strong p-4">
              <div className="mono text-xs uppercase tracking-[0.18em] muted">Glass</div>
              <div className="mt-2 text-sm">通透材质、发光边缘、动态光晕。</div>
            </div>
            <div className="panel-strong p-4">
              <div className="mono text-xs uppercase tracking-[0.18em] muted">Brutal</div>
              <div className="mt-2 text-sm">硬边框、网格纸感、强烈结构感。</div>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  )
}