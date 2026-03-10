import { motion } from 'framer-motion'
import { Mail, ShieldEllipsis, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { ThemeSwitcher } from '../../components/theme/theme-switcher'
import { Button } from '../../components/ui/button'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/auth-store'

type AuthMode = 'signin' | 'signup' | 'magic'

const modeContent: Record<AuthMode, { title: string; subtitle: string; cta: string }> = {
  signin: {
    title: '邮箱 + 密码登录',
    subtitle: '进入你的私有任务空间，继续处理标签、子任务、拖拽排序和提醒。',
    cta: 'Sign in',
  },
  signup: {
    title: '创建新账户',
    subtitle: '注册后即可拥有独立数据空间，并启用跨设备同步的个人任务工作台。',
    cta: 'Create account',
  },
  magic: {
    title: '发送 Magic Link',
    subtitle: '输入邮箱，系统会发送免密登录链接，让你快速回到任务列表。',
    cta: 'Send link',
  },
}

export function SignInPage() {
  const status = useAuthStore((state) => state.status)
  const [mode, setMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)

  const currentMode = useMemo(() => modeContent[mode], [mode])

  useEffect(() => {
    if (status === 'authenticated') {
      setFeedback('登录成功，正在进入应用…')
    }
  }, [status])

  if (status === 'authenticated') {
    return <Navigate to="/app" replace />
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsBusy(true)
    setFeedback(null)

    const redirectTo = `${window.location.origin}/app`

    const result =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : mode === 'signup'
          ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } })
          : await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } })

    if (result.error) {
      setFeedback(result.error.message)
      setIsBusy(false)
      return
    }

    setFeedback(
      mode === 'magic'
        ? 'Magic Link 已发送，请查收邮箱。'
        : mode === 'signup'
          ? '注册请求已提交，请按 Supabase 设置完成邮箱验证。'
          : '登录成功，正在跳转…',
    )
    setIsBusy(false)
  }

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-6 md:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 opacity-90">
        <div className="ambient-orb left-0 top-24 h-72 w-72 bg-[var(--accent)]" />
        <div className="ambient-orb bottom-10 right-0 h-96 w-96 bg-[var(--accent-strong)]" />
      </div>

      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-3rem)] max-w-7xl gap-6 lg:grid-cols-[minmax(0,1.2fr)_420px]">
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="panel flex flex-col justify-between p-6 md:p-8"
        >
          <div>
            <div className="text-xs uppercase tracking-[0.22em] muted">Deep Todo PWA</div>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold md:text-6xl">Todo, but with system-grade polish and theme depth.</h1>
            <p className="mt-5 max-w-2xl text-base muted md:text-lg">
              面向真实日常工作的任务系统：支持标签、子任务、截止时间、提醒、Markdown 描述、Web Push 与多端一致的 PWA 体验。
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="panel-strong p-5">
              <Mail className="h-5 w-5 text-[var(--accent)]" />
              <div className="mt-4 font-semibold">Fast capture</div>
              <p className="mt-2 text-sm muted">快速记录任务、补充标签与子任务，再按优先级和到期时间推进。</p>
            </div>
            <div className="panel-strong p-5">
              <Sparkles className="h-5 w-5 text-[var(--accent)]" />
              <div className="mt-4 font-semibold">Readable detail</div>
              <p className="mt-2 text-sm muted">描述区支持轻量 Markdown，任务内容可以同时兼顾结构化与可读性。</p>
            </div>
            <div className="panel-strong p-5">
              <ShieldEllipsis className="h-5 w-5 text-[var(--accent)]" />
              <div className="mt-4 font-semibold">Reminder loop</div>
              <p className="mt-2 text-sm muted">支持预设提醒、自定义时间与浏览器推送，减少任务临期遗漏。</p>
            </div>
          </div>

          <div className="mt-8">
            <ThemeSwitcher />
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.12, duration: 0.45, ease: 'easeOut' }}
          className="panel self-center p-6"
        >
          <div className="text-xs uppercase tracking-[0.22em] muted">Authentication</div>
          <h2 className="mt-3 text-2xl font-semibold">{currentMode.title}</h2>
          <p className="mt-2 text-sm muted">{currentMode.subtitle}</p>

          <div className="mt-6 grid grid-cols-3 gap-2 rounded-[var(--radius-md)] bg-[var(--surface-strong)] p-1">
            {(['signin', 'signup', 'magic'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`rounded-[calc(var(--radius-md)-4px)] px-3 py-2 text-sm font-semibold transition ${
                  mode === value ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)]'
                }`}
              >
                {value === 'signin' ? '登录' : value === 'signup' ? '注册' : 'Magic'}
              </button>
            ))}
          </div>

          <form className="mt-6 space-y-4" onSubmit={(event) => void handleSubmit(event)}>
            <div>
              <label className="mb-2 block text-sm font-semibold">邮箱</label>
              <input
                className="field-input"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            {mode !== 'magic' ? (
              <div>
                <label className="mb-2 block text-sm font-semibold">密码</label>
                <input
                  className="field-input"
                  type="password"
                  placeholder="至少 6 位密码"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={6}
                  required
                />
              </div>
            ) : null}

            <Button type="submit" block disabled={isBusy}>
              {isBusy ? 'Please wait...' : currentMode.cta}
            </Button>
          </form>

          <div className="mt-4 min-h-6 text-sm muted">{feedback}</div>
        </motion.section>
      </div>
    </div>
  )
}