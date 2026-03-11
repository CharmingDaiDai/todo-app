import 'react-day-picker/style.css'

import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, ChevronDown, Clock3, Sparkles, X } from 'lucide-react'
import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { DayPicker } from 'react-day-picker'
import { cn } from '../../lib/cn'

type DateTimeFieldProps = {
  value: string
  onChange: (value: string) => void
  placeholder: string
  helper?: string
}

type ParsedLocalDateTime = {
  date: Date
  hour: number
  minute: number
}

function padNumber(value: number) {
  return value.toString().padStart(2, '0')
}

function buildLocalDateTimeValue(date: Date, hour: number, minute: number) {
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}T${padNumber(hour)}:${padNumber(minute)}`
}

function parseLocalDateTime(value: string): ParsedLocalDateTime | null {
  if (!value) {
    return null
  }

  const [datePart, timePart = '00:00'] = value.split('T')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hour, minute] = timePart.split(':').map(Number)

  if ([year, month, day, hour, minute].some((item) => Number.isNaN(item))) {
    return null
  }

  return {
    date: new Date(year, month - 1, day),
    hour,
    minute,
  }
}

function formatSummary(value: string, placeholder: string) {
  const parsed = parseLocalDateTime(value)

  if (!parsed) {
    return placeholder
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(parsed.date.getFullYear(), parsed.date.getMonth(), parsed.date.getDate(), parsed.hour, parsed.minute))
}

function addDays(base: Date, days: number) {
  const next = new Date(base)
  next.setDate(base.getDate() + days)
  return next
}

function getNextMonday(base: Date) {
  const day = base.getDay()
  const diff = day === 0 ? 1 : 8 - day
  return addDays(base, diff)
}

const quickTimeOptions = [9, 12, 15, 18, 21]
const hourOptions = [6, 8, 9, 10, 12, 14, 16, 18, 20, 22]
const minuteOptions = [0, 15, 30, 45]

const quickPresets = [
  {
    label: '今晚收尾',
    hint: '今天 18:30',
    resolve(base: Date) {
      return { date: base, hour: 18, minute: 30 }
    },
  },
  {
    label: '明早推进',
    hint: '明天 09:00',
    resolve(base: Date) {
      return { date: addDays(base, 1), hour: 9, minute: 0 }
    },
  },
  {
    label: '午后检查',
    hint: '今天 14:00',
    resolve(base: Date) {
      return { date: base, hour: 14, minute: 0 }
    },
  },
  {
    label: '下周一',
    hint: '09:00',
    resolve(base: Date) {
      return { date: getNextMonday(base), hour: 9, minute: 0 }
    },
  },
] as const

export function DateTimeField({ value, onChange, placeholder, helper }: DateTimeFieldProps) {
  const parsedValue = useMemo(() => parseLocalDateTime(value), [value])
  const [isOpen, setIsOpen] = useState(false)
  const [isMobileViewport, setIsMobileViewport] = useState(() => window.innerWidth < 768)
  const [visibleMonth, setVisibleMonth] = useState<Date>(parsedValue?.date ?? new Date())

  useEffect(() => {
    if (parsedValue?.date) {
      setVisibleMonth(parsedValue.date)
    }
  }, [parsedValue?.date?.getTime()])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)')
    const handleChange = (event: MediaQueryListEvent) => setIsMobileViewport(event.matches)

    setIsMobileViewport(mediaQuery.matches)
    mediaQuery.addEventListener('change', handleChange)

    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  const applyDate = (nextDate: Date | undefined) => {
    if (!nextDate) {
      onChange('')
      return
    }

    onChange(buildLocalDateTimeValue(nextDate, parsedValue?.hour ?? 9, parsedValue?.minute ?? 0))
    setVisibleMonth(nextDate)
  }

  const applyTime = (nextHour: number, nextMinute: number) => {
    if (!parsedValue?.date) {
      return
    }

    const safeHour = Math.min(23, Math.max(0, nextHour))
    const safeMinute = Math.min(59, Math.max(0, nextMinute))
    onChange(buildLocalDateTimeValue(parsedValue.date, safeHour, safeMinute))
  }

  const handleNumberInput = (segment: 'hour' | 'minute') => (event: ChangeEvent<HTMLInputElement>) => {
    if (!parsedValue?.date) {
      return
    }

    const raw = event.target.value

    if (raw === '') {
      return
    }

    const next = Number(raw)

    if (Number.isNaN(next)) {
      return
    }

    applyTime(segment === 'hour' ? next : parsedValue.hour, segment === 'minute' ? next : parsedValue.minute)
  }

  const applyPreset = (resolver: (base: Date) => { date: Date; hour: number; minute: number }) => {
    const baseDate = parsedValue?.date ?? new Date()
    const resolved = resolver(baseDate)

    onChange(buildLocalDateTimeValue(resolved.date, resolved.hour, resolved.minute))
    setVisibleMonth(resolved.date)
    setIsOpen(false)
  }

  return (
    <div className="date-time-field">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className={cn('date-time-trigger', isOpen && 'date-time-trigger-open')}
      >
        <div className="date-time-trigger-main">
          <span className="date-time-trigger-icon">
            <CalendarDays className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="date-time-trigger-label">{formatSummary(value, placeholder)}</div>
            <div className="date-time-trigger-meta">{parsedValue ? '点击继续微调日期与时间' : helper ?? '先选日期，再设置精确时间。'}</div>
          </div>
        </div>
        <span className={cn('date-time-trigger-chevron', isOpen && 'date-time-trigger-chevron-open')}>
          <ChevronDown className="h-4 w-4" />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen ? (
          <>
            {isMobileViewport ? (
              <motion.button
                type="button"
                aria-label="关闭时间选择面板"
                className="date-time-mobile-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsOpen(false)}
              />
            ) : null}

            <motion.div
              initial={isMobileViewport ? { opacity: 0, y: '100%' } : { opacity: 0, y: 10 }}
              animate={isMobileViewport ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
              exit={isMobileViewport ? { opacity: 0, y: '100%' } : { opacity: 0, y: 10 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              drag={isMobileViewport ? 'y' : false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={isMobileViewport ? 0.18 : 0}
              onDragEnd={(_, info) => {
                if (!isMobileViewport) {
                  return
                }

                if (Math.abs(info.offset.y) > 120 || Math.abs(info.velocity.y) > 700) {
                  setIsOpen(false)
                }
              }}
              className={cn('date-time-panel', isMobileViewport && 'date-time-panel-mobile')}
            >
              {isMobileViewport ? (
                <div className="date-time-mobile-topbar">
                  <span className="date-time-mobile-handle" />
                  <div className="date-time-mobile-title-group">
                    <div className="date-time-mobile-kicker">Time sheet</div>
                    <div className="date-time-mobile-title">拖动即可收起</div>
                  </div>
                  <button type="button" className="date-time-mobile-close" onClick={() => setIsOpen(false)}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : null}

              <div className="date-time-panel-grid">
                <div className="date-time-calendar-shell">
                  <DayPicker
                    mode="single"
                    month={visibleMonth}
                    onMonthChange={setVisibleMonth}
                    selected={parsedValue?.date}
                    onSelect={applyDate}
                    showOutsideDays
                  />
                </div>

                <div className="date-time-side">
                  <div className="date-time-summary-card">
                    <div className="date-time-summary-badge">
                      <Sparkles className="h-3.5 w-3.5" />
                      时间面板
                    </div>
                    <div className="mt-3 text-base font-semibold">{formatSummary(value, placeholder)}</div>
                    <div className="mt-1 text-sm muted">{helper ?? '统一替代浏览器默认日期控件，保证桌面和移动端观感一致。'}</div>
                  </div>

                  <div>
                    <div className="date-time-side-heading">
                      <Clock3 className="h-4 w-4" />
                      精确时间
                    </div>
                    <div className="date-time-time-row">
                      <label className={cn('date-time-number-shell', !parsedValue && 'date-time-number-shell-disabled')}>
                        <span>时</span>
                        <input
                          className="date-time-number"
                          type="number"
                          min={0}
                          max={23}
                          value={parsedValue ? padNumber(parsedValue.hour) : ''}
                          onChange={handleNumberInput('hour')}
                          disabled={!parsedValue}
                          placeholder="09"
                        />
                      </label>
                      <span className="date-time-colon">:</span>
                      <label className={cn('date-time-number-shell', !parsedValue && 'date-time-number-shell-disabled')}>
                        <span>分</span>
                        <input
                          className="date-time-number"
                          type="number"
                          min={0}
                          max={59}
                          value={parsedValue ? padNumber(parsedValue.minute) : ''}
                          onChange={handleNumberInput('minute')}
                          disabled={!parsedValue}
                          placeholder="00"
                        />
                      </label>
                    </div>

                    <div className="date-time-mobile-time-groups">
                      <div>
                        <div className="date-time-subheading">小时</div>
                        <div className="date-time-hour-grid">
                          {hourOptions.map((hour) => (
                            <button
                              key={hour}
                              type="button"
                              className={cn('date-time-tile', parsedValue?.hour === hour && 'date-time-tile-active')}
                              disabled={!parsedValue}
                              onClick={() => applyTime(hour, parsedValue?.minute ?? 0)}
                            >
                              {padNumber(hour)}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="date-time-subheading">分钟</div>
                        <div className="date-time-minute-grid">
                          {minuteOptions.map((minute) => (
                            <button
                              key={minute}
                              type="button"
                              className={cn('date-time-tile', parsedValue?.minute === minute && 'date-time-tile-active')}
                              disabled={!parsedValue}
                              onClick={() => applyTime(parsedValue?.hour ?? 9, minute)}
                            >
                              {padNumber(minute)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="date-time-chip-row">
                      {quickTimeOptions.map((hour) => {
                        const active = parsedValue?.hour === hour && parsedValue.minute === 0

                        return (
                          <button
                            key={hour}
                            type="button"
                            className={cn('date-time-chip', active && 'date-time-chip-active')}
                            disabled={!parsedValue}
                            onClick={() => applyTime(hour, 0)}
                          >
                            {padNumber(hour)}:00
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="date-time-side-heading">快捷预设</div>
                    <div className="date-time-preset-grid">
                      {quickPresets.map((preset) => (
                        <button key={preset.label} type="button" className="date-time-preset" onClick={() => applyPreset(preset.resolve)}>
                          <span className="date-time-preset-label">{preset.label}</span>
                          <span className="date-time-preset-hint">{preset.hint}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="date-time-actions">
                    <button type="button" className="date-time-clear" onClick={() => onChange('')}>
                      <X className="h-3.5 w-3.5" />
                      清空
                    </button>
                    <button type="button" className="date-time-apply" onClick={() => setIsOpen(false)}>
                      完成选择
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  )
}