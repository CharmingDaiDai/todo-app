import { useMutationState } from '@tanstack/react-query'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AnimatePresence, motion } from 'framer-motion'
import { BellRing, CalendarDays, ChevronDown, ChevronUp, GripVertical, ListChecks, LoaderCircle, PencilLine, Plus, Save, Tags, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode, type FormEvent } from 'react'
import { AppShell } from '../../components/layout/app-shell'
import { Button } from '../../components/ui/button'
import { DateTimeField } from '../../components/ui/date-time-picker'
import { MarkdownPreview } from '../../components/ui/markdown-preview'
import { pushSuccessToast } from '../../store/toast-store'
import {
  todoMutationKeys,
  useCreateTodoMutation,
  useDeleteTodoMutation,
  useReorderTodoMutation,
  useReplaceTodoSubtasksMutation,
  useReplaceTodoTagsMutation,
  useTagsQuery,
  useToggleSubtaskMutation,
  useTodosQuery,
  useToggleTodoStatusMutation,
  useUpdateTodoMutation,
} from '../../features/todos/hooks'
import { calculateNewOrderIndex } from '../../features/todos/order'
import type { Subtask, Tag, TodoPriority, TodoReminderType } from '../../features/todos/types'
import { cn } from '../../lib/cn'
import { useAuthStore } from '../../store/auth-store'

const priorityOptions: Array<{ value: TodoPriority; label: string; tone: string }> = [
  { value: 3, label: '高优先级', tone: '#d11f3e' },
  { value: 2, label: '中优先级', tone: 'var(--accent)' },
  { value: 1, label: '低优先级', tone: '#2f8f58' },
]

const reminderOptions: Array<{ value: TodoReminderType; label: string; hint: string }> = [
  { value: 'none', label: '不提醒', hint: '只记录截止时间，不触发 Web Push。' },
  { value: 'hour', label: '提前 1 小时', hint: '在截止时间前 1 小时触发提醒。' },
  { value: 'ten_minutes', label: '提前 10 分钟', hint: '适合临近截止前的短提醒。' },
  { value: 'custom_date', label: '自定义日期', hint: '选择一个独立于截止时间的提醒时刻。' },
]

function formatDate(date: string | null) {
  if (!date) return '未设置'

  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

function hasReminder(reminderType: TodoReminderType) {
  return reminderType !== 'none'
}

function toDateTimeLocalValue(date: string | null) {
  if (!date) return ''

  const value = new Date(date)
  const offset = value.getTimezoneOffset()
  const localDate = new Date(value.getTime() - offset * 60_000)

  return localDate.toISOString().slice(0, 16)
}

function resolveReminderConfig(reminderType: TodoReminderType, dueDate: string, reminderAt: string) {
  if (reminderType === 'none') {
    return {
      reminderType,
      reminderAt: null,
      error: null,
    }
  }

  if (reminderType === 'custom_date') {
    if (!reminderAt) {
      return {
        reminderType,
        reminderAt: null,
        error: '请选择自定义提醒时间。',
      }
    }

    const parsedReminderAt = new Date(reminderAt)

    if (Number.isNaN(parsedReminderAt.getTime())) {
      return {
        reminderType,
        reminderAt: null,
        error: '自定义提醒时间无效。',
      }
    }

    return {
      reminderType,
      reminderAt: parsedReminderAt.toISOString(),
      error: null,
    }
  }

  if (!dueDate) {
    return {
      reminderType,
      reminderAt: null,
      error: '预设提醒需要先设置截止时间。',
    }
  }

  return {
    reminderType,
    reminderAt: null,
    error: null,
  }
}

function getDescriptionSnippet(value: string) {
  const compact = value.replace(/[>#*_`\[\]()|!-]/g, ' ').replace(/\s+/g, ' ').trim()

  if (!compact) {
    return null
  }

  return compact.length > 140 ? `${compact.slice(0, 140)}...` : compact
}

function PriorityPicker({ value, onChange }: { value: TodoPriority; onChange: (value: TodoPriority) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {priorityOptions.map((item) => {
        const active = item.value === value

        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={cn(
              'flex items-center gap-3 rounded-[var(--radius-md)] border px-4 py-3 text-left transition duration-200',
              active ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text-primary)]' : 'border-[var(--border)] bg-[var(--surface-strong)] hover:-translate-y-[1px] hover:border-[var(--accent)]/45',
            )}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.tone }} />
            <span className="text-sm font-semibold">{item.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function ReminderPicker({ value, onChange }: { value: TodoReminderType; onChange: (value: TodoReminderType) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {reminderOptions.map((item) => {
        const active = item.value === value

        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={cn(
              'rounded-[var(--radius-md)] border px-4 py-3 text-left transition duration-200',
              active ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text-primary)]' : 'border-[var(--border)] bg-[var(--surface-strong)] hover:-translate-y-[1px] hover:border-[var(--accent)]/45',
            )}
          >
            <div className="text-sm font-semibold">{item.label}</div>
            <div className="mt-1 text-xs muted">{item.hint}</div>
          </button>
        )
      })}
    </div>
  )
}

function TagPicker({ tags, selectedTagIds, onToggle }: { tags: Tag[]; selectedTagIds: string[]; onToggle: (tagId: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {tags.length === 0 ? <div className="text-sm muted">当前还没有标签，可在设置页中创建。</div> : null}
      {tags.map((tag) => {
        const selected = selectedTagIds.includes(tag.id)

        return (
          <button
            key={tag.id}
            type="button"
            onClick={() => onToggle(tag.id)}
            className={cn(
              'tag-chip transition duration-200 hover:-translate-y-[1px]',
              selected && 'ring-2 ring-[var(--accent)] bg-[var(--accent-soft)]',
            )}
          >
            <span className="tag-chip-dot" style={{ backgroundColor: tag.color }} />
            {tag.name}
          </button>
        )
      })}
    </div>
  )
}

function DashboardMetricSkeleton() {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 surface-syncing">
      <div className="h-3 w-16 rounded-full bg-[var(--accent-soft)]/70" />
      <div className="mt-3 h-8 w-12 rounded-full bg-[var(--accent-soft)]/70" />
    </div>
  )
}

function TodoCardSkeleton() {
  return (
    <div className="panel-strong p-5 surface-syncing">
      <div className="flex gap-4">
        <div className="mt-1 h-5 w-5 rounded-md bg-[var(--accent-soft)]/70" />
        <div className="min-w-0 flex-1">
          <div className="h-5 w-40 rounded-full bg-[var(--accent-soft)]/70" />
          <div className="mt-3 h-3.5 w-full max-w-[26rem] rounded-full bg-[var(--accent-soft)]/60" />
          <div className="mt-2 h-3.5 w-2/3 rounded-full bg-[var(--accent-soft)]/60" />
          <div className="mt-4 flex gap-2">
            <div className="h-7 w-24 rounded-full bg-[var(--accent-soft)]/70" />
            <div className="h-7 w-20 rounded-full bg-[var(--accent-soft)]/50" />
          </div>
        </div>
      </div>
    </div>
  )
}

type DashboardFiltersProps = {
  statusFilter: 'all' | 'pending' | 'completed'
  sortMode: 'manual' | 'due' | 'priority'
  setStatusFilter: (value: 'all' | 'pending' | 'completed') => void
  setSortMode: (value: 'manual' | 'due' | 'priority') => void
  mode?: 'all' | 'desktop' | 'mobile'
}

function DashboardFilters({ statusFilter, sortMode, setStatusFilter, setSortMode, mode = 'all' }: DashboardFiltersProps) {
  return (
    <>
      <div className={cn(mode === 'mobile' ? 'hidden' : 'hidden flex-wrap gap-2 lg:flex')}>
        {(['all', 'pending', 'completed'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setStatusFilter(value)}
            className={`rounded-[var(--radius-md)] px-3 py-2 text-sm font-semibold ${
              statusFilter === value ? 'bg-[var(--accent)] text-white' : 'panel-strong'
            }`}
          >
            {value === 'all' ? '全部' : value === 'pending' ? '未完成' : '已完成'}
          </button>
        ))}

        {(['manual', 'due', 'priority'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setSortMode(value)}
            className={`rounded-[var(--radius-md)] px-3 py-2 text-sm font-semibold ${
              sortMode === value ? 'bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]' : 'panel-strong'
            }`}
          >
            {value === 'manual' ? '默认排序' : value === 'due' ? '最近截止' : '最高优先级'}
          </button>
        ))}
      </div>

      <div className={cn(mode === 'desktop' ? 'hidden' : 'space-y-3 lg:hidden')}>
        <div>
          <div className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.18em] muted">状态过滤</div>
          <div className="mobile-filter-scroll">
            {(['all', 'pending', 'completed'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(value)}
                className={cn('mobile-filter-chip', statusFilter === value && 'mobile-filter-chip-active')}
              >
                {value === 'all' ? '全部任务' : value === 'pending' ? '未完成' : '已完成'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.18em] muted">排序方式</div>
          <div className="mobile-filter-scroll">
            {(['manual', 'due', 'priority'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setSortMode(value)}
                className={cn('mobile-filter-chip', sortMode === value && 'mobile-filter-chip-active')}
              >
                {value === 'manual' ? '默认排序' : value === 'due' ? '最近截止' : '优先级'}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

type SortableTodoCardProps = {
  id: string
  disabled: boolean
  content: ReactNode
  actions: ReactNode
  isActive?: boolean
  isSyncing?: boolean
}

function SortableTodoCard({ id, disabled, content, actions, isActive = false, isSyncing = false }: SortableTodoCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  })

  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn('group relative panel-strong p-5', isDragging && 'opacity-80', isActive && 'border-[var(--accent)] ring-2 ring-[var(--accent-soft)]', isSyncing && 'surface-syncing')}
    >
      <div className="flex flex-col gap-4 lg:block">
        <div className="flex min-w-0 gap-4 lg:pr-40">{content}</div>

        <div
          className={cn(
            'flex gap-2 lg:absolute lg:right-4 lg:top-4 lg:rounded-full lg:border lg:border-[var(--border)] lg:bg-[var(--surface)]/96 lg:p-1.5 lg:shadow-[0_18px_30px_rgba(0,0,0,0.1)] lg:backdrop-blur-xl lg:transition lg:duration-200',
            'lg:pointer-events-none lg:translate-y-1 lg:opacity-0 lg:group-hover:pointer-events-auto lg:group-hover:translate-y-0 lg:group-hover:opacity-100',
            isActive && 'lg:pointer-events-auto lg:translate-y-0 lg:opacity-100',
          )}
        >
          <button
            type="button"
            aria-label="drag to reorder todo"
            className={cn(
              'inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-sm font-semibold transition duration-200 lg:h-10 lg:min-h-0 lg:w-10 lg:rounded-full lg:border-transparent lg:bg-transparent lg:px-0 lg:py-0 lg:hover:bg-[var(--accent-soft)]',
              disabled ? 'cursor-not-allowed opacity-45' : 'cursor-grab active:cursor-grabbing',
            )}
            disabled={disabled}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
            <span className="lg:hidden">拖拽</span>
          </button>
          {actions}
        </div>
      </div>
    </article>
  )
}

type CreateTodoComposerProps = {
  isOpen: boolean
  title: string
  setTitle: (value: string) => void
  dueDate: string
  setDueDate: (value: string) => void
  priority: TodoPriority
  setPriority: (value: TodoPriority) => void
  description: string
  setDescription: (value: string) => void
  descriptionMode: 'write' | 'preview'
  setDescriptionMode: (value: 'write' | 'preview') => void
  reminderType: TodoReminderType
  setReminderType: (value: TodoReminderType) => void
  reminderAt: string
  setReminderAt: (value: string) => void
  tags: Tag[]
  selectedTagIds: string[]
  handleToggleTag: (tagId: string) => void
  draftSubtask: string
  setDraftSubtask: (value: string) => void
  subtasks: string[]
  handleAddSubtask: () => void
  removeSubtask: (index: number) => void
  showCreateDetails: boolean
  setShowCreateDetails: React.Dispatch<React.SetStateAction<boolean>>
  createFormError: string | null
  createMutationError: string | null
  isSaving: boolean
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

function CreateTodoComposer({
  isOpen,
  title,
  setTitle,
  dueDate,
  setDueDate,
  priority,
  setPriority,
  description,
  setDescription,
  descriptionMode,
  setDescriptionMode,
  reminderType,
  setReminderType,
  reminderAt,
  setReminderAt,
  tags,
  selectedTagIds,
  handleToggleTag,
  draftSubtask,
  setDraftSubtask,
  subtasks,
  handleAddSubtask,
  removeSubtask,
  showCreateDetails,
  setShowCreateDetails,
  createFormError,
  createMutationError,
  isSaving,
  onClose,
  onSubmit,
}: CreateTodoComposerProps) {
  if (!isOpen) {
    return null
  }

  return (
    <>
      <motion.button
        type="button"
        aria-label="close create todo composer"
        className="fixed inset-0 z-40 bg-black/28 backdrop-blur-[3px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      <motion.div
        className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:p-6 md:items-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.form
          initial={{ opacity: 0, y: 28, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 18, scale: 0.98 }}
          transition={{ duration: 0.24, ease: 'easeOut' }}
          onSubmit={onSubmit}
          className="panel flex max-h-[calc(100vh-0.75rem)] w-full max-w-3xl flex-col overflow-hidden rounded-t-[32px] rounded-b-none md:max-h-[calc(100vh-3rem)] md:rounded-[var(--radius-xl)]"
        >
          <div className="flex justify-center pb-1 pt-3 md:hidden">
            <span className="h-1.5 w-14 rounded-full bg-[var(--border)]" />
          </div>

          <div className="border-b border-[var(--border)] bg-[var(--surface-strong)] px-5 py-5 md:px-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] muted">Create todo</div>
                <h3 className="mt-2 text-2xl font-semibold">添加任务</h3>
                <p className="mt-2 text-sm muted">用一个轻量浮层完成录入，避免主界面长期被大表单占据。</p>
              </div>
              <Button tone="ghost" onClick={onClose} aria-label="关闭新增任务浮层">
                <X className="h-4 w-4" />
                关闭
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5 md:px-6">
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold">标题</label>
                <input className="field-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：完成 Supabase schema 上线" required />
              </div>

              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                <div className="panel-strong px-4 py-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <CalendarDays className="h-4 w-4" />
                    截止时间
                  </div>
                  <DateTimeField value={dueDate} onChange={setDueDate} placeholder="选择一个截止时间" helper="先定日期，再补具体时刻，任务节奏会更清楚。" />
                </div>

                <div className="panel-strong px-4 py-4">
                  <div className="mb-3 text-sm font-semibold">优先级</div>
                  <PriorityPicker value={priority} onChange={setPriority} />
                </div>
              </div>

              <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-strong)]/72">
                <button
                  type="button"
                  onClick={() => setShowCreateDetails((current) => !current)}
                  className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
                >
                  <div>
                    <div className="text-sm font-semibold">高级选项</div>
                    <div className="mt-1 text-xs muted">
                      描述、提醒、标签和子任务
                      {selectedTagIds.length > 0 ? ` · ${selectedTagIds.length} 个标签` : ''}
                      {subtasks.length > 0 ? ` · ${subtasks.length} 个子任务` : ''}
                      {reminderType !== 'none' ? ' · 已设置提醒' : ''}
                    </div>
                  </div>
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]">
                    {showCreateDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </span>
                </button>

                <AnimatePresence initial={false}>
                  {showCreateDetails ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: 'easeOut' }}
                      className="overflow-hidden"
                    >
                      <div className="grid gap-5 border-t border-[var(--border)] px-4 py-4 md:grid-cols-2">
                        <div className="md:col-span-2">
                          <label className="mb-2 block text-sm font-semibold">描述</label>
                          <div className="mb-2 flex flex-wrap gap-2">
                            {(['write', 'preview'] as const).map((mode) => (
                              <button
                                key={mode}
                                type="button"
                                onClick={() => setDescriptionMode(mode)}
                                className={cn('rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em]', descriptionMode === mode ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-[var(--border)] bg-[var(--surface-strong)] muted')}
                              >
                                {mode === 'write' ? '编辑' : '预览'}
                              </button>
                            ))}
                          </div>
                          {descriptionMode === 'write' ? (
                            <textarea className="field-input field-textarea" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="补充说明、上下文和期望结果，支持标题、列表、链接和粗体。" />
                          ) : (
                            <div className="field-input min-h-[112px]">
                              <MarkdownPreview content={description} emptyState="在左侧编辑后，这里会显示 Markdown 预览。" />
                            </div>
                          )}
                        </div>

                        <div className="md:col-span-2 panel-strong px-4 py-4">
                          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                            <BellRing className="h-4 w-4" />
                            提醒
                          </div>
                          <ReminderPicker value={reminderType} onChange={setReminderType} />

                          {reminderType === 'custom_date' ? (
                            <div className="mt-4">
                              <label className="mb-2 block text-sm font-semibold">提醒时间</label>
                              <DateTimeField value={reminderAt} onChange={setReminderAt} placeholder="选择提醒时间" helper="用于单独设置提醒触发时刻。" />
                            </div>
                          ) : null}
                        </div>

                        <div className="md:col-span-2 panel-strong px-4 py-4">
                          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                            <Tags className="h-4 w-4" />
                            标签
                          </div>
                          <TagPicker tags={tags} selectedTagIds={selectedTagIds} onToggle={handleToggleTag} />
                        </div>

                        <div className="md:col-span-2 panel-strong px-4 py-4">
                          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                            <ListChecks className="h-4 w-4" />
                            子任务
                          </div>
                          <div className="flex gap-2">
                            <input className="field-input" value={draftSubtask} onChange={(event) => setDraftSubtask(event.target.value)} placeholder="添加一个 checklist 项" />
                            <Button type="button" tone="secondary" onClick={handleAddSubtask}>
                              添加
                            </Button>
                          </div>
                          {subtasks.length > 0 ? (
                            <div className="mt-3 space-y-2">
                              {subtasks.map((item, index) => (
                                <motion.div key={`${item}-${index}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="panel flex items-center justify-between gap-3 px-4 py-3 text-sm">
                                  <span>{item}</span>
                                  <button type="button" className="muted" onClick={() => removeSubtask(index)}>
                                    移除
                                  </button>
                                </motion.div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </section>

              {createFormError ? <div className="text-sm text-[#d11f3e]">{createFormError}</div> : null}
              {createMutationError ? <div className="text-sm text-[#d11f3e]">{createMutationError}</div> : null}
            </div>
          </div>

          <div className="border-t border-[var(--border)] bg-[var(--surface-strong)] px-5 py-4 md:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button tone="ghost" onClick={onClose}>
                取消
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {isSaving ? '保存中...' : '创建 Todo'}
              </Button>
            </div>
          </div>
        </motion.form>
      </motion.div>
    </>
  )
}

type EditTodoDrawerProps = {
  isOpen: boolean
  sheetMode?: boolean
  todoTitle: string
  tags: ReturnType<typeof useTagsQuery>['data'] extends infer T ? NonNullable<T> : never
  editTitle: string
  setEditTitle: (value: string) => void
  editDescription: string
  setEditDescription: (value: string) => void
  editDescriptionMode: 'write' | 'preview'
  setEditDescriptionMode: (value: 'write' | 'preview') => void
  editDueDate: string
  setEditDueDate: (value: string) => void
  editReminderType: TodoReminderType
  setEditReminderType: (value: TodoReminderType) => void
  editReminderAt: string
  setEditReminderAt: (value: string) => void
  editPriority: TodoPriority
  setEditPriority: (value: TodoPriority) => void
  editSelectedTagIds: string[]
  handleToggleEditTag: (tagId: string) => void
  editSubtasks: Array<{ title: string; isCompleted: boolean }>
  setEditSubtasks: React.Dispatch<React.SetStateAction<Array<{ title: string; isCompleted: boolean }>>>
  editDraftSubtask: string
  setEditDraftSubtask: (value: string) => void
  handleAddEditSubtask: () => void
  editFormError: string | null
  updateError: string | null
  replaceTagsError: string | null
  replaceSubtasksError: string | null
  isSaving: boolean
  onClose: () => void
  onSave: () => void
}

function EditTodoDrawer({
  isOpen,
  sheetMode = false,
  todoTitle,
  tags,
  editTitle,
  setEditTitle,
  editDescription,
  setEditDescription,
  editDescriptionMode,
  setEditDescriptionMode,
  editDueDate,
  setEditDueDate,
  editReminderType,
  setEditReminderType,
  editReminderAt,
  setEditReminderAt,
  editPriority,
  setEditPriority,
  editSelectedTagIds,
  handleToggleEditTag,
  editSubtasks,
  setEditSubtasks,
  editDraftSubtask,
  setEditDraftSubtask,
  handleAddEditSubtask,
  editFormError,
  updateError,
  replaceTagsError,
  replaceSubtasksError,
  isSaving,
  onClose,
  onSave,
}: EditTodoDrawerProps) {
  if (!isOpen) {
    return null
  }

  return (
    <>
      <motion.button
        type="button"
        aria-label="close edit drawer"
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      <motion.aside
        initial={sheetMode ? { y: '100%', opacity: 0 } : { x: '100%', opacity: 0 }}
        animate={sheetMode ? { y: 0, opacity: 1 } : { x: 0, opacity: 1 }}
        exit={sheetMode ? { y: '100%', opacity: 0 } : { x: '100%', opacity: 0 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
        className={cn(
          'fixed z-50 flex w-full flex-col bg-[var(--page-bg)] shadow-[0_24px_80px_rgba(0,0,0,0.22)]',
          sheetMode
            ? 'inset-x-0 bottom-0 max-h-[calc(100vh-0.5rem)] rounded-t-[32px] border-t border-[var(--border)]'
            : 'inset-y-0 right-0 max-w-2xl border-l border-[var(--border)]',
        )}
      >
        {sheetMode ? (
          <div className="flex justify-center pb-1 pt-3 md:hidden">
            <span className="h-1.5 w-14 rounded-full bg-[var(--border)]" />
          </div>
        ) : null}

        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] bg-[var(--surface-strong)] px-5 py-5 md:px-6">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] muted">Edit todo</div>
            <h3 className="mt-2 text-xl font-semibold">{todoTitle || '编辑任务'}</h3>
            <p className="mt-2 text-sm muted">在这里集中修改描述、提醒、标签和子任务，不打断主列表浏览。</p>
          </div>
          <Button tone="ghost" onClick={onClose} aria-label="关闭编辑抽屉">
            <X className="h-4 w-4" />
            关闭
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 md:px-6">
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold">标题</label>
              <input className="field-input" value={editTitle} onChange={(event) => setEditTitle(event.target.value)} />
            </div>

            <div>
              <div className="mb-2 flex flex-wrap gap-2">
                {(['write', 'preview'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setEditDescriptionMode(mode)}
                    className={cn('rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em]', editDescriptionMode === mode ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-[var(--border)] bg-[var(--surface-strong)] muted')}
                  >
                    {mode === 'write' ? '编辑' : '预览'}
                  </button>
                ))}
              </div>
              {editDescriptionMode === 'write' ? (
                <textarea className="field-input field-textarea" value={editDescription} onChange={(event) => setEditDescription(event.target.value)} placeholder="补充说明、上下文和期望结果，支持标题、列表、链接和粗体。" />
              ) : (
                <div className="field-input min-h-[112px]">
                  <MarkdownPreview content={editDescription} emptyState="编辑描述后，这里会显示 Markdown 预览。" />
                </div>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="panel-strong px-4 py-4">
                <label className="mb-2 block text-sm font-semibold">截止时间</label>
                <DateTimeField value={editDueDate} onChange={setEditDueDate} placeholder="选择一个截止时间" helper="保持和新增面板一致的时间编辑体验。" />
              </div>
              <div className="panel-strong px-4 py-4">
                <label className="mb-3 block text-sm font-semibold">优先级</label>
                <PriorityPicker value={editPriority} onChange={setEditPriority} />
              </div>
            </div>

            <div className="panel-strong px-4 py-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <BellRing className="h-4 w-4" />
                提醒设置
              </div>
              <ReminderPicker value={editReminderType} onChange={setEditReminderType} />

              {editReminderType === 'custom_date' ? (
                <div className="mt-3">
                  <DateTimeField value={editReminderAt} onChange={setEditReminderAt} placeholder="选择提醒时间" helper="为这条任务设置一个独立提醒时刻。" />
                </div>
              ) : null}
            </div>

            <div className="panel-strong px-4 py-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Tags className="h-4 w-4" />
                标签
              </div>
              <TagPicker tags={tags} selectedTagIds={editSelectedTagIds} onToggle={handleToggleEditTag} />
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <ListChecks className="h-4 w-4" />
                子任务
              </div>
              <div className="flex gap-2">
                <input className="field-input" value={editDraftSubtask} onChange={(event) => setEditDraftSubtask(event.target.value)} placeholder="添加一个新的子任务" />
                <Button type="button" tone="secondary" onClick={handleAddEditSubtask}>
                  添加
                </Button>
              </div>
              <div className="mt-3 space-y-2">
                {editSubtasks.length === 0 ? <div className="text-sm muted">当前没有子任务。</div> : null}
                {editSubtasks.map((subtask, index) => (
                  <div key={`${index}-${subtask.title}`} className="panel flex items-center gap-3 px-4 py-3">
                    <input
                      className="field-checkbox h-4 w-4"
                      type="checkbox"
                      checked={subtask.isCompleted}
                      onChange={(event) =>
                        setEditSubtasks((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, isCompleted: event.target.checked } : item,
                          ),
                        )
                      }
                    />
                    <input
                      className="field-input"
                      value={subtask.title}
                      onChange={(event) =>
                        setEditSubtasks((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, title: event.target.value } : item,
                          ),
                        )
                      }
                    />
                    <Button type="button" tone="ghost" onClick={() => setEditSubtasks((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                      <X className="h-4 w-4" />
                      删除
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {editFormError ? <div className="text-sm text-[#d11f3e]">{editFormError}</div> : null}
            {updateError ? <div className="text-sm text-[#d11f3e]">{updateError}</div> : null}
            {replaceTagsError ? <div className="text-sm text-[#d11f3e]">{replaceTagsError}</div> : null}
            {replaceSubtasksError ? <div className="text-sm text-[#d11f3e]">{replaceSubtasksError}</div> : null}
          </div>
        </div>

        <div className="border-t border-[var(--border)] bg-[var(--surface-strong)] px-5 py-4 md:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button tone="ghost" onClick={onClose}>
              取消
            </Button>
            <Button tone="secondary" onClick={onSave} disabled={isSaving}>
              {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isSaving ? '保存中...' : '保存更改'}
            </Button>
          </div>
        </div>
      </motion.aside>
    </>
  )
}

export function DashboardPage() {
  const user = useAuthStore((state) => state.user)
  const userId = user?.id
  const todosQuery = useTodosQuery(userId)
  const tagsQuery = useTagsQuery(userId)
  const createTodoMutation = useCreateTodoMutation(userId)
  const toggleTodoStatusMutation = useToggleTodoStatusMutation(userId)
  const toggleSubtaskMutation = useToggleSubtaskMutation(userId)
  const deleteTodoMutation = useDeleteTodoMutation(userId)
  const updateTodoMutation = useUpdateTodoMutation(userId)
  const reorderTodoMutation = useReorderTodoMutation(userId)
  const replaceTodoTagsMutation = useReplaceTodoTagsMutation(userId)
  const replaceTodoSubtasksMutation = useReplaceTodoSubtasksMutation(userId)
  const pendingToggleTodoIds = useMutationState<{ id: string; status: 'pending' | 'completed' } | undefined>({
    filters: { mutationKey: todoMutationKeys.toggleTodoStatus, status: 'pending' },
    select: (mutation) => mutation.state.variables as { id: string; status: 'pending' | 'completed' } | undefined,
  })
  const pendingDeleteTodoIds = useMutationState<string | undefined>({
    filters: { mutationKey: todoMutationKeys.deleteTodo, status: 'pending' },
    select: (mutation) => mutation.state.variables as string | undefined,
  })
  const pendingSubtaskIds = useMutationState<{ id: string; isCompleted: boolean } | undefined>({
    filters: { mutationKey: todoMutationKeys.toggleSubtask, status: 'pending' },
    select: (mutation) => mutation.state.variables as { id: string; isCompleted: boolean } | undefined,
  })
  const pendingUpdateTodoIds = useMutationState<{ id: string } | undefined>({
    filters: { mutationKey: todoMutationKeys.updateTodo, status: 'pending' },
    select: (mutation) => mutation.state.variables as { id: string } | undefined,
  })
  const pendingReorderTodoIds = useMutationState<{ id: string; orderIndex: number } | undefined>({
    filters: { mutationKey: todoMutationKeys.reorderTodo, status: 'pending' },
    select: (mutation) => mutation.state.variables as { id: string; orderIndex: number } | undefined,
  })
  const pendingReplaceTagTodoIds = useMutationState<{ todoId: string; tagIds: string[] } | undefined>({
    filters: { mutationKey: todoMutationKeys.replaceTodoTags, status: 'pending' },
    select: (mutation) => mutation.state.variables as { todoId: string; tagIds: string[] } | undefined,
  })
  const pendingReplaceSubtaskTodoIds = useMutationState<{ todoId: string; subtasks: Array<{ title: string; isCompleted: boolean }> } | undefined>({
    filters: { mutationKey: todoMutationKeys.replaceTodoSubtasks, status: 'pending' },
    select: (mutation) => mutation.state.variables as { todoId: string; subtasks: Array<{ title: string; isCompleted: boolean }> } | undefined,
  })

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [descriptionMode, setDescriptionMode] = useState<'write' | 'preview'>('write')
  const [dueDate, setDueDate] = useState('')
  const [reminderType, setReminderType] = useState<TodoReminderType>('none')
  const [reminderAt, setReminderAt] = useState('')
  const [priority, setPriority] = useState<TodoPriority>(2)
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [draftSubtask, setDraftSubtask] = useState('')
  const [subtasks, setSubtasks] = useState<string[]>([])
  const [createFormError, setCreateFormError] = useState<string | null>(null)
  const [isCreateComposerOpen, setIsCreateComposerOpen] = useState(false)
  const [showCreateDetails, setShowCreateDetails] = useState(false)
  const [expandedSubtaskTodoIds, setExpandedSubtaskTodoIds] = useState<string[]>([])
  const [isMobileViewport, setIsMobileViewport] = useState(() => window.innerWidth < 768)
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all')
  const [sortMode, setSortMode] = useState<'manual' | 'due' | 'priority'>('manual')
  const [activeTagFilters, setActiveTagFilters] = useState<string[]>([])
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editDescriptionMode, setEditDescriptionMode] = useState<'write' | 'preview'>('write')
  const [editDueDate, setEditDueDate] = useState('')
  const [editReminderType, setEditReminderType] = useState<TodoReminderType>('none')
  const [editReminderAt, setEditReminderAt] = useState('')
  const [editPriority, setEditPriority] = useState<TodoPriority>(2)
  const [editSelectedTagIds, setEditSelectedTagIds] = useState<string[]>([])
  const [editSubtasks, setEditSubtasks] = useState<Array<{ title: string; isCompleted: boolean }>>([])
  const [editDraftSubtask, setEditDraftSubtask] = useState('')
  const [editFormError, setEditFormError] = useState<string | null>(null)

  const todos = todosQuery.data ?? []
  const tags = tagsQuery.data ?? []
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const syncingTodoIds = useMemo(
    () =>
      new Set([
        ...pendingToggleTodoIds.map((item) => item?.id),
        ...pendingDeleteTodoIds,
        ...pendingUpdateTodoIds.map((item) => item?.id),
        ...pendingReorderTodoIds.map((item) => item?.id),
        ...pendingReplaceTagTodoIds.map((item) => item?.todoId),
        ...pendingReplaceSubtaskTodoIds.map((item) => item?.todoId),
      ].filter((id): id is string => Boolean(id))),
    [pendingDeleteTodoIds, pendingReorderTodoIds, pendingReplaceSubtaskTodoIds, pendingReplaceTagTodoIds, pendingToggleTodoIds, pendingUpdateTodoIds],
  )
  const syncingSubtaskIds = useMemo(
    () => new Set(pendingSubtaskIds.map((item) => item?.id).filter((id): id is string => Boolean(id))),
    [pendingSubtaskIds],
  )

  useEffect(() => {
    const validTagIds = new Set(tags.map((tag) => tag.id))

    setSelectedTagIds((current) => current.filter((tagId) => validTagIds.has(tagId)))
    setActiveTagFilters((current) => current.filter((tagId) => validTagIds.has(tagId)))
    setEditSelectedTagIds((current) => current.filter((tagId) => validTagIds.has(tagId)))
  }, [tags])

  const visibleTodos = useMemo(() => {
    const filtered = todos.filter((todo) => {
      const statusMatched = statusFilter === 'all' ? true : todo.status === statusFilter
      const tagsMatched =
        activeTagFilters.length === 0 ? true : activeTagFilters.every((tagId) => todo.tags.some((tag) => tag.id === tagId))

      return statusMatched && tagsMatched
    })

    if (sortMode === 'due') {
      return filtered.slice().sort((left, right) => {
        if (!left.dueDate) return 1
        if (!right.dueDate) return -1
        return new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime()
      })
    }

    if (sortMode === 'priority') {
      return filtered.slice().sort((left, right) => right.priority - left.priority)
    }

    return filtered.slice().sort((left, right) => left.orderIndex - right.orderIndex)
  }, [activeTagFilters, sortMode, statusFilter, todos])

  const pendingCount = todos.filter((todo) => todo.status === 'pending').length
  const completedCount = todos.length - pendingCount
  const dueSoonCount = todos.filter((todo) => {
    if (!todo.dueDate || todo.status === 'completed') return false
    const diff = new Date(todo.dueDate).getTime() - Date.now()
    return diff > 0 && diff <= 1000 * 60 * 60 * 24
  }).length
  const canDragSort = sortMode === 'manual' && statusFilter === 'all' && activeTagFilters.length === 0 && editingTodoId === null && !reorderTodoMutation.isPending
  const editingTodo = todos.find((todo) => todo.id === editingTodoId) ?? null

  useEffect(() => {
    if (!editingTodoId && !isCreateComposerOpen) {
      return
    }

    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (editingTodoId) {
          handleCancelEdit()
          return
        }

        setIsCreateComposerOpen(false)
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [editingTodoId, isCreateComposerOpen])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)')
    const handleChange = (event: MediaQueryListEvent) => setIsMobileViewport(event.matches)

    setIsMobileViewport(mediaQuery.matches)
    mediaQuery.addEventListener('change', handleChange)

    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  const resetCreateComposer = () => {
    setTitle('')
    setDescription('')
    setDescriptionMode('write')
    setDueDate('')
    setReminderType('none')
    setReminderAt('')
    setPriority(2)
    setSelectedTagIds([])
    setSubtasks([])
    setDraftSubtask('')
    setCreateFormError(null)
    setShowCreateDetails(false)
  }

  const handleOpenCreateComposer = () => {
    if (editingTodoId) {
      handleCancelEdit()
    }

    setIsCreateComposerOpen(true)
  }

  const handleCloseCreateComposer = () => {
    resetCreateComposer()
    setIsCreateComposerOpen(false)
  }

  const handleToggleTag = (tagId: string) => {
    setSelectedTagIds((current) =>
      current.includes(tagId) ? current.filter((value) => value !== tagId) : [...current, tagId],
    )
  }

  const handleToggleTagFilter = (tagId: string) => {
    setActiveTagFilters((current) =>
      current.includes(tagId) ? current.filter((value) => value !== tagId) : [...current, tagId],
    )
  }

  const handleToggleSubtaskList = (todoId: string) => {
    setExpandedSubtaskTodoIds((current) =>
      current.includes(todoId) ? current.filter((value) => value !== todoId) : [...current, todoId],
    )
  }

  const handleToggleEditTag = (tagId: string) => {
    setEditSelectedTagIds((current) =>
      current.includes(tagId) ? current.filter((value) => value !== tagId) : [...current, tagId],
    )
  }

  const handleAddSubtask = () => {
    const value = draftSubtask.trim()

    if (!value) return

    setSubtasks((current) => [...current, value])
    setDraftSubtask('')
  }

  const handleAddEditSubtask = () => {
    const value = editDraftSubtask.trim()

    if (!value) return

    setEditSubtasks((current) => [...current, { title: value, isCompleted: false }])
    setEditDraftSubtask('')
  }

  const handleCreateTodo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!userId || !title.trim()) {
      return
    }

    const reminderConfig = resolveReminderConfig(reminderType, dueDate, reminderAt)

    if (reminderConfig.error) {
      setCreateFormError(reminderConfig.error)
      return
    }

    setCreateFormError(null)

    try {
      await createTodoMutation.mutateAsync({
        userId,
        title: title.trim(),
        description: description.trim(),
        priority,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        reminderType: reminderConfig.reminderType,
        reminderAt: reminderConfig.reminderAt,
        tagIds: selectedTagIds,
        subtasks: subtasks.map((item) => ({ title: item })),
      })

      setTitle('')
      setDescription('')
      setDescriptionMode('write')
      setDueDate('')
      setReminderType('none')
      setReminderAt('')
      setPriority(2)
      setSelectedTagIds([])
      setSubtasks([])
      setDraftSubtask('')
      setCreateFormError(null)
      setShowCreateDetails(false)
      setIsCreateComposerOpen(false)
    } catch {
      return
    }
  }

  const handleStartEdit = (
    todoId: string,
    currentTitle: string,
    currentDescription: string,
    currentDueDate: string | null,
    currentReminderType: TodoReminderType,
    currentReminderAt: string | null,
    currentPriority: TodoPriority,
    currentTagIds: string[],
    currentSubtasks: Subtask[],
  ) => {
    setIsCreateComposerOpen(false)
    setEditingTodoId(todoId)
    setEditTitle(currentTitle)
    setEditDescription(currentDescription)
    setEditDescriptionMode('write')
    setEditDueDate(toDateTimeLocalValue(currentDueDate))
    setEditReminderType(currentReminderType)
    setEditReminderAt(toDateTimeLocalValue(currentReminderAt))
    setEditPriority(currentPriority)
    setEditSelectedTagIds(currentTagIds)
    setEditSubtasks(currentSubtasks.map((subtask) => ({ title: subtask.title, isCompleted: subtask.isCompleted })))
    setEditDraftSubtask('')
    setEditFormError(null)
  }

  const handleCancelEdit = () => {
    setEditingTodoId(null)
    setEditTitle('')
    setEditDescription('')
    setEditDescriptionMode('write')
    setEditDueDate('')
    setEditReminderType('none')
    setEditReminderAt('')
    setEditPriority(2)
    setEditSelectedTagIds([])
    setEditSubtasks([])
    setEditDraftSubtask('')
    setEditFormError(null)
  }

  const handleUpdateTodo = async (todoId: string) => {
    if (!editTitle.trim()) {
      return
    }

    const reminderConfig = resolveReminderConfig(editReminderType, editDueDate, editReminderAt)

    if (reminderConfig.error) {
      setEditFormError(reminderConfig.error)
      return
    }

    setEditFormError(null)

    try {
      await updateTodoMutation.mutateAsync({
        id: todoId,
        title: editTitle.trim(),
        description: editDescription.trim(),
        dueDate: editDueDate ? new Date(editDueDate).toISOString() : null,
        reminderType: reminderConfig.reminderType,
        reminderAt: reminderConfig.reminderAt,
        priority: editPriority,
      })

      await replaceTodoTagsMutation.mutateAsync({
        todoId,
        tagIds: editSelectedTagIds,
      })

      await replaceTodoSubtasksMutation.mutateAsync({
        todoId,
        subtasks: editSubtasks.filter((subtask) => subtask.title.trim()).map((subtask) => ({
          title: subtask.title.trim(),
          isCompleted: subtask.isCompleted,
        })),
      })

      pushSuccessToast('更改已同步', '任务内容、标签和子任务已经保存到云端。')
      handleCancelEdit()
    } catch {
      return
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    if (!canDragSort) {
      return
    }

    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const newOrderIndex = calculateNewOrderIndex(
      visibleTodos.map((todo) => ({ id: todo.id, orderIndex: todo.orderIndex })),
      String(active.id),
      String(over.id),
    )

    if (newOrderIndex === null) {
      return
    }

    try {
      await reorderTodoMutation.mutateAsync({
        id: String(active.id),
        orderIndex: newOrderIndex,
      })
    } catch {
      return
    }
  }

  return (
    <AppShell
      eyebrow="Workspace"
      title="Todo workspace"
      description="先记录，再推进。主界面只保留高频操作：快速新建、状态过滤、优先级排序和任务执行。"
      hidePageHeader
      mobileToolbar={
        <DashboardFilters
          statusFilter={statusFilter}
          sortMode={sortMode}
          setStatusFilter={setStatusFilter}
          setSortMode={setSortMode}
          mode="mobile"
        />
      }
    >
      <section className="panel px-4 py-3 sm:px-5">
        <div className="grid gap-3 sm:grid-cols-3">
          {todosQuery.isLoading ? (
            <>
              <DashboardMetricSkeleton />
              <DashboardMetricSkeleton />
              <DashboardMetricSkeleton />
            </>
          ) : (
            <>
              <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3">
                <div className="text-[0.68rem] uppercase tracking-[0.18em] muted">Open</div>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <div className="text-2xl font-semibold">{pendingCount}</div>
                  <div className="text-xs muted">进行中</div>
                </div>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3">
                <div className="text-[0.68rem] uppercase tracking-[0.18em] muted">Due soon</div>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <div className="text-2xl font-semibold">{dueSoonCount}</div>
                  <div className="text-xs muted">24 小时内</div>
                </div>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3">
                <div className="text-[0.68rem] uppercase tracking-[0.18em] muted">Done</div>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <div className="text-2xl font-semibold">{completedCount}</div>
                  <div className="text-xs muted">已完成</div>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="panel p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] muted">Task board</div>
            <h3 className="mt-2 text-xl font-semibold">任务列表</h3>
            {!todosQuery.isLoading && todosQuery.isFetching ? <div className="mt-3 sync-pill"><span className="sync-pill-dot" /> 正在后台刷新任务列表</div> : null}
          </div>

          <DashboardFilters
            statusFilter={statusFilter}
            sortMode={sortMode}
            setStatusFilter={setStatusFilter}
            setSortMode={setSortMode}
            mode="desktop"
          />
        </div>

        {tagsQuery.isLoading ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <div className="h-8 w-24 rounded-full bg-[var(--accent-soft)]/70 surface-syncing" />
            <div className="h-8 w-20 rounded-full bg-[var(--accent-soft)]/60 surface-syncing" />
            <div className="h-8 w-28 rounded-full bg-[var(--accent-soft)]/50 surface-syncing" />
          </div>
        ) : tags.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTagFilters([])}
              className={`tag-chip ${activeTagFilters.length === 0 ? 'ring-2 ring-[var(--accent)]' : ''}`}
            >
              全部标签
            </button>
            {tags.map((tag) => {
              const active = activeTagFilters.includes(tag.id)

              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => handleToggleTagFilter(tag.id)}
                  className={`tag-chip ${active ? 'ring-2 ring-[var(--accent)]' : ''}`}
                >
                  <span className="tag-chip-dot" style={{ backgroundColor: tag.color }} />
                  {tag.name}
                </button>
              )
            })}
          </div>
        ) : null}

        {todosQuery.isLoading ? (
          <div className="mt-6 space-y-4">
            <TodoCardSkeleton />
            <TodoCardSkeleton />
            <TodoCardSkeleton />
          </div>
        ) : null}
        {todosQuery.error ? (
          <div className="mt-6 panel-strong p-4 text-sm text-[#d11f3e]">
            {todosQuery.error.message}
            <div className="mt-2 muted">如果这是首次运行，请先在 Supabase SQL Editor 执行仓库内的 schema.sql。</div>
          </div>
        ) : null}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => void handleDragEnd(event)}>
          <SortableContext items={visibleTodos.map((todo) => todo.id)} strategy={verticalListSortingStrategy}>
            <div className="mt-6 space-y-4">
              <AnimatePresence initial={false}>
                {visibleTodos.map((todo, index) => (
                  <motion.div
                    key={todo.id}
                    layout
                    initial={{ opacity: 0, y: 16, scale: 0.98 }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      scale: todo.status === 'completed' ? 0.985 : 1,
                    }}
                    exit={{ opacity: 0, y: -18, scale: 0.95 }}
                    transition={{
                      delay: index * 0.03,
                      duration: 0.28,
                      ease: 'easeOut',
                      layout: { duration: 0.22, ease: 'easeOut' },
                    }}
                  >
                    <SortableTodoCard
                      id={todo.id}
                      disabled={!canDragSort}
                      isActive={editingTodoId === todo.id}
                      isSyncing={syncingTodoIds.has(todo.id)}
                      content={
                        <>
                          <input
                            className={cn('field-checkbox mt-1 h-5 w-5', syncingTodoIds.has(todo.id) && 'field-checkbox-syncing')}
                            type="checkbox"
                            checked={todo.status === 'completed'}
                            disabled={syncingTodoIds.has(todo.id)}
                            onChange={(event) =>
                              toggleTodoStatusMutation.mutate({
                                id: todo.id,
                                status: event.target.checked ? 'completed' : 'pending',
                              })
                            }
                          />

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className={`text-lg font-semibold ${todo.status === 'completed' ? 'line-through opacity-60' : ''}`}>{todo.title}</h4>
                              <span className="tag-chip" style={{ borderColor: priorityOptions.find((item) => item.value === todo.priority)?.tone }}>
                                <span className="tag-chip-dot" style={{ backgroundColor: priorityOptions.find((item) => item.value === todo.priority)?.tone }} />
                                {priorityOptions.find((item) => item.value === todo.priority)?.label}
                              </span>
                              {syncingTodoIds.has(todo.id) ? <span className="sync-pill"><span className="sync-pill-dot" /> 同步中</span> : null}
                            </div>

                            {getDescriptionSnippet(todo.description) ? <p className="mt-3 text-sm muted">{getDescriptionSnippet(todo.description)}</p> : null}

                            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] muted">
                              <span>Due {formatDate(todo.dueDate)}</span>
                              {hasReminder(todo.reminderType) ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-strong)] px-2 py-1">
                                  <BellRing className="h-3 w-3" />
                                  Reminder
                                </span>
                              ) : null}
                            </div>

                            {todo.tags.length > 0 ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {todo.tags.map((tag) => (
                                  <span key={tag.id} className="tag-chip">
                                    <span className="tag-chip-dot" style={{ backgroundColor: tag.color }} />
                                    {tag.name}
                                  </span>
                                ))}
                              </div>
                            ) : null}

                            {todo.subtasks.length > 0 ? (
                              <div className="mt-4">
                                <button
                                  type="button"
                                  onClick={() => handleToggleSubtaskList(todo.id)}
                                  className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]"
                                >
                                  {expandedSubtaskTodoIds.includes(todo.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                  子任务 {todo.subtasks.filter((subtask) => subtask.isCompleted).length}/{todo.subtasks.length}
                                </button>

                                <AnimatePresence initial={false}>
                                  {expandedSubtaskTodoIds.includes(todo.id) ? (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.22, ease: 'easeOut' }}
                                      className="overflow-hidden"
                                    >
                                      <div className="mt-3 space-y-2">
                                        {todo.subtasks.map((subtask) => (
                                          <motion.label
                                            key={subtask.id}
                                            initial={{ opacity: 0, y: 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className={cn('panel flex items-center gap-3 px-4 py-3 text-sm transition-opacity', syncingSubtaskIds.has(subtask.id) && 'surface-syncing opacity-80')}
                                          >
                                            <input
                                              className={cn('field-checkbox h-4 w-4', syncingSubtaskIds.has(subtask.id) && 'field-checkbox-syncing')}
                                              type="checkbox"
                                              checked={subtask.isCompleted}
                                              disabled={syncingSubtaskIds.has(subtask.id)}
                                              onChange={(event) =>
                                                toggleSubtaskMutation.mutate({
                                                  id: subtask.id,
                                                  isCompleted: event.target.checked,
                                                })
                                              }
                                            />
                                            <span className={subtask.isCompleted ? 'line-through opacity-60' : ''}>{subtask.title}</span>
                                          </motion.label>
                                        ))}
                                      </div>
                                    </motion.div>
                                  ) : null}
                                </AnimatePresence>
                              </div>
                            ) : null}
                          </div>
                        </>
                      }
                      actions={
                        <>
                          <Button
                            tone={editingTodoId === todo.id ? 'secondary' : 'ghost'}
                            className="lg:h-10 lg:min-h-0 lg:w-10 lg:rounded-full lg:px-0 lg:py-0"
                            disabled={syncingTodoIds.has(todo.id)}
                            onClick={() =>
                              handleStartEdit(
                                todo.id,
                                todo.title,
                                todo.description,
                                todo.dueDate,
                                todo.reminderType,
                                todo.reminderAt,
                                todo.priority,
                                todo.tags.map((tag) => tag.id),
                                todo.subtasks,
                              )
                            }
                          >
                            {syncingTodoIds.has(todo.id) ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <PencilLine className="h-4 w-4" />}
                            <span className="lg:hidden">{editingTodoId === todo.id ? '正在编辑' : '编辑'}</span>
                          </Button>
                          <Button
                            tone="ghost"
                            className="lg:h-10 lg:min-h-0 lg:w-10 lg:rounded-full lg:px-0 lg:py-0"
                            onClick={() => deleteTodoMutation.mutate(todo.id)}
                            disabled={syncingTodoIds.has(todo.id)}
                          >
                            {syncingTodoIds.has(todo.id) ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            <span className="lg:hidden">删除</span>
                          </Button>
                        </>
                      }
                    />
                  </motion.div>
                ))}
              </AnimatePresence>

              {!todosQuery.isLoading && visibleTodos.length === 0 ? (
                <div className="panel-strong p-6 text-sm muted">当前状态与标签筛选条件下还没有任务。先调整筛选条件，或者在上方创建第一条 Todo。</div>
              ) : null}
            </div>
          </SortableContext>
        </DndContext>
      </section>

      <motion.button
        type="button"
        initial={{ opacity: 0, y: 16, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.18, duration: 0.26, ease: 'easeOut' }}
        onClick={handleOpenCreateComposer}
        className="fixed bottom-24 right-4 z-30 inline-flex h-14 items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-5 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(18,88,214,0.32)] transition duration-200 hover:-translate-y-[1px] hover:opacity-95 md:right-6 lg:bottom-8 lg:right-8"
      >
        <Plus className="h-4 w-4" />
        <span className="hidden sm:inline">添加任务</span>
      </motion.button>

      <AnimatePresence>
        {isCreateComposerOpen ? (
          <CreateTodoComposer
            isOpen={isCreateComposerOpen}
            title={title}
            setTitle={setTitle}
            dueDate={dueDate}
            setDueDate={setDueDate}
            priority={priority}
            setPriority={setPriority}
            description={description}
            setDescription={setDescription}
            descriptionMode={descriptionMode}
            setDescriptionMode={setDescriptionMode}
            reminderType={reminderType}
            setReminderType={setReminderType}
            reminderAt={reminderAt}
            setReminderAt={setReminderAt}
            tags={tags}
            selectedTagIds={selectedTagIds}
            handleToggleTag={handleToggleTag}
            draftSubtask={draftSubtask}
            setDraftSubtask={setDraftSubtask}
            subtasks={subtasks}
            handleAddSubtask={handleAddSubtask}
            removeSubtask={(index) => setSubtasks((current) => current.filter((_, currentIndex) => currentIndex !== index))}
            showCreateDetails={showCreateDetails}
            setShowCreateDetails={setShowCreateDetails}
            createFormError={createFormError}
            createMutationError={createTodoMutation.error?.message ?? null}
            isSaving={createTodoMutation.isPending}
            onClose={handleCloseCreateComposer}
            onSubmit={(event) => void handleCreateTodo(event)}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {editingTodo ? (
          <EditTodoDrawer
            isOpen={editingTodo !== null}
            sheetMode={isMobileViewport}
            todoTitle={editingTodo.title}
            tags={tags}
            editTitle={editTitle}
            setEditTitle={setEditTitle}
            editDescription={editDescription}
            setEditDescription={setEditDescription}
            editDescriptionMode={editDescriptionMode}
            setEditDescriptionMode={setEditDescriptionMode}
            editDueDate={editDueDate}
            setEditDueDate={setEditDueDate}
            editReminderType={editReminderType}
            setEditReminderType={setEditReminderType}
            editReminderAt={editReminderAt}
            setEditReminderAt={setEditReminderAt}
            editPriority={editPriority}
            setEditPriority={setEditPriority}
            editSelectedTagIds={editSelectedTagIds}
            handleToggleEditTag={handleToggleEditTag}
            editSubtasks={editSubtasks}
            setEditSubtasks={setEditSubtasks}
            editDraftSubtask={editDraftSubtask}
            setEditDraftSubtask={setEditDraftSubtask}
            handleAddEditSubtask={handleAddEditSubtask}
            editFormError={editFormError}
            updateError={updateTodoMutation.error?.message ?? null}
            replaceTagsError={replaceTodoTagsMutation.error?.message ?? null}
            replaceSubtasksError={replaceTodoSubtasksMutation.error?.message ?? null}
            isSaving={updateTodoMutation.isPending || replaceTodoTagsMutation.isPending || replaceTodoSubtasksMutation.isPending}
            onClose={handleCancelEdit}
            onSave={() => {
              void handleUpdateTodo(editingTodo.id)
            }}
          />
        ) : null}
      </AnimatePresence>
    </AppShell>
  )
}
