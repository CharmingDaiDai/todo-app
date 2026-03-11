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
import { motion } from 'framer-motion'
import { BellRing, CalendarClock, GripVertical, ListChecks, PencilLine, Plus, Save, Tags, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode, type FormEvent } from 'react'
import { AppShell } from '../../components/layout/app-shell'
import { Button } from '../../components/ui/button'
import { MarkdownPreview } from '../../components/ui/markdown-preview'
import {
  useCreateTagMutation,
  useCreateTodoMutation,
  useDeleteTagMutation,
  useDeleteTodoMutation,
  useReorderTodoMutation,
  useReplaceTodoSubtasksMutation,
  useReplaceTodoTagsMutation,
  useTagsQuery,
  useTodosQuery,
  useToggleSubtaskMutation,
  useToggleTodoStatusMutation,
  useUpdateTodoMutation,
} from '../../features/todos/hooks'
import { calculateNewOrderIndex } from '../../features/todos/order'
import type { Subtask, TodoPriority, TodoReminderType } from '../../features/todos/types'
import { cn } from '../../lib/cn'
import { useAuthStore } from '../../store/auth-store'

const priorityOptions: Array<{ value: TodoPriority; label: string; tone: string }> = [
  { value: 3, label: '高优先级', tone: '#d11f3e' },
  { value: 2, label: '中优先级', tone: 'var(--accent)' },
  { value: 1, label: '低优先级', tone: '#2f8f58' },
]

const tagColors = ['#1258d6', '#ff4d00', '#2f8f58', '#8a43ff', '#d11f3e', '#f59e0b']

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

function getReminderSummary(reminderType: TodoReminderType, reminderAt: string | null) {
  if (reminderType === 'none') {
    return '未设置提醒'
  }

  if (reminderType === 'hour') {
    return '提前 1 小时提醒'
  }

  if (reminderType === 'ten_minutes') {
    return '提前 10 分钟提醒'
  }

  return reminderAt ? `自定义提醒 ${formatDate(reminderAt)}` : '自定义提醒'
}

function getDescriptionSnippet(value: string) {
  const compact = value.replace(/[>#*_`\[\]()|!-]/g, ' ').replace(/\s+/g, ' ').trim()

  if (!compact) {
    return null
  }

  return compact.length > 140 ? `${compact.slice(0, 140)}...` : compact
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
}

function SortableTodoCard({ id, disabled, content, actions }: SortableTodoCardProps) {
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
      className={cn('panel-strong p-5', isDragging && 'opacity-80')}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-4">{content}</div>

        <div className="flex gap-2 lg:flex-col">
          <button
            type="button"
            aria-label="drag to reorder todo"
            className={cn(
              'inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-sm font-semibold',
              disabled ? 'cursor-not-allowed opacity-45' : 'cursor-grab active:cursor-grabbing',
            )}
            disabled={disabled}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
            拖拽
          </button>
          {actions}
        </div>
      </div>
    </article>
  )
}

export function DashboardPage() {
  const user = useAuthStore((state) => state.user)
  const userId = user?.id
  const todosQuery = useTodosQuery(userId)
  const tagsQuery = useTagsQuery(userId)
  const createTodoMutation = useCreateTodoMutation(userId)
  const createTagMutation = useCreateTagMutation(userId)
  const deleteTagMutation = useDeleteTagMutation(userId)
  const toggleTodoStatusMutation = useToggleTodoStatusMutation(userId)
  const deleteTodoMutation = useDeleteTodoMutation(userId)
  const toggleSubtaskMutation = useToggleSubtaskMutation(userId)
  const updateTodoMutation = useUpdateTodoMutation(userId)
  const reorderTodoMutation = useReorderTodoMutation(userId)
  const replaceTodoTagsMutation = useReplaceTodoTagsMutation(userId)
  const replaceTodoSubtasksMutation = useReplaceTodoSubtasksMutation(userId)

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
  const [showCreateDetails, setShowCreateDetails] = useState(false)
  const [showTagManager, setShowTagManager] = useState(false)
  const [tagName, setTagName] = useState('')
  const [tagColor, setTagColor] = useState(tagColors[0])
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
  const canDragSort = sortMode === 'manual' && statusFilter === 'all' && activeTagFilters.length === 0 && editingTodoId === null

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
    } catch {
      return
    }
  }

  const handleCreateTag = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!userId || !tagName.trim()) {
      return
    }

    try {
      await createTagMutation.mutateAsync({
        userId,
        name: tagName.trim(),
        color: tagColor,
      })

      setTagName('')
      setTagColor(tagColors[(tagColors.indexOf(tagColor) + 1) % tagColors.length])
    } catch {
      return
    }
  }

  const handleDeleteTag = async (tagId: string) => {
    try {
      await deleteTagMutation.mutateAsync(tagId)
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
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_320px]">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="panel p-5">
            <div className="text-xs uppercase tracking-[0.18em] muted">Open</div>
            <div className="mt-3 text-3xl font-semibold">{pendingCount}</div>
            <div className="mt-2 text-sm muted">还在推进中的任务</div>
          </div>
          <div className="panel p-5">
            <div className="text-xs uppercase tracking-[0.18em] muted">Due soon</div>
            <div className="mt-3 text-3xl font-semibold">{dueSoonCount}</div>
            <div className="mt-2 text-sm muted">24 小时内到期</div>
          </div>
          <div className="panel p-5">
            <div className="text-xs uppercase tracking-[0.18em] muted">Done</div>
            <div className="mt-3 text-3xl font-semibold">{completedCount}</div>
            <div className="mt-2 text-sm muted">已经完成的任务</div>
          </div>
        </div>

        <section className="panel p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-soft)] text-[var(--accent)]">
              <CalendarClock className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.18em] muted">Today focus</div>
              <div className="mt-1 text-sm font-semibold">欢迎回来，{user?.email ?? 'Builder'}</div>
            </div>
          </div>

          <div className="mt-4 space-y-3 text-sm muted">
            <p>先用上方快速录入记录事项，再通过下面的过滤和排序推进任务。</p>
            <p>{canDragSort ? '当前可以直接拖拽任务调整顺序。' : '当前处于筛选或编辑状态，拖拽排序暂时关闭。'}</p>
          </div>
        </section>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <form className="panel p-6" onSubmit={(event) => void handleCreateTodo(event)}>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-soft)] text-[var(--accent)]">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.18em] muted">Quick capture</div>
              <h3 className="mt-1 text-xl font-semibold">先快速记下任务</h3>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(180px,0.7fr)_minmax(180px,0.7fr)]">
              <div>
                <label className="mb-2 block text-sm font-semibold">标题</label>
                <input className="field-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：完成 Supabase schema 上线" required />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">截止时间</label>
                <input className="field-input" type="datetime-local" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">优先级</label>
                <select className="field-input field-select" value={priority} onChange={(event) => setPriority(Number(event.target.value) as TodoPriority)}>
                  {priorityOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={createTodoMutation.isPending}>
                {createTodoMutation.isPending ? '保存中...' : '创建 Todo'}
              </Button>
              <Button tone="secondary" onClick={() => setShowCreateDetails((current) => !current)}>
                {showCreateDetails ? '收起高级选项' : '展开描述、提醒和子任务'}
              </Button>
              {createFormError ? <div className="text-sm text-[#d11f3e]">{createFormError}</div> : null}
              {createTodoMutation.error ? <div className="text-sm text-[#d11f3e]">{createTodoMutation.error.message}</div> : null}
            </div>

            {showCreateDetails ? (
              <>
                <div>
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
                  <div className="mt-2 text-xs muted">支持轻量 Markdown：标题、粗体、列表、引用、行内代码、链接、表格和任务列表。</div>
                </div>

                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <BellRing className="h-4 w-4" />
                    提醒
                  </div>
                  <select className="field-input field-select" value={reminderType} onChange={(event) => setReminderType(event.target.value as TodoReminderType)}>
                    {reminderOptions.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <div className="mt-2 text-sm muted">{reminderOptions.find((item) => item.value === reminderType)?.hint}</div>

                  {reminderType === 'custom_date' ? (
                    <div className="mt-3">
                      <label className="mb-2 block text-sm font-semibold">提醒时间</label>
                      <input className="field-input" type="datetime-local" value={reminderAt} onChange={(event) => setReminderAt(event.target.value)} />
                    </div>
                  ) : null}

                  {(reminderType === 'hour' || reminderType === 'ten_minutes') && !dueDate ? (
                    <div className="mt-3 text-sm text-[#d11f3e]">预设提醒依赖截止时间，请先填写上面的截止时间。</div>
                  ) : null}
                </div>

                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <Tags className="h-4 w-4" />
                    标签
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {tags.length === 0 ? <div className="text-sm muted">当前还没有标签，可在右侧快速创建。</div> : null}
                    {tags.map((tag) => {
                      const selected = selectedTagIds.includes(tag.id)

                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => handleToggleTag(tag.id)}
                          className={`tag-chip ${selected ? 'ring-2 ring-[var(--accent)]' : ''}`}
                        >
                          <span className="tag-chip-dot" style={{ backgroundColor: tag.color }} />
                          {tag.name}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <ListChecks className="h-4 w-4" />
                    子任务
                  </div>
                  <div className="flex gap-2">
                    <input
                      className="field-input"
                      value={draftSubtask}
                      onChange={(event) => setDraftSubtask(event.target.value)}
                      placeholder="添加一个 checklist 项"
                    />
                    <Button type="button" tone="secondary" onClick={handleAddSubtask}>
                      添加
                    </Button>
                  </div>
                  {subtasks.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {subtasks.map((item, index) => (
                        <div key={`${item}-${index}`} className="panel-strong flex items-center justify-between gap-3 px-4 py-3 text-sm">
                          <span>{item}</span>
                          <button type="button" className="muted" onClick={() => setSubtasks((current) => current.filter((_, currentIndex) => currentIndex !== index))}>
                            移除
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        </form>

        <section className="panel p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-soft)] text-[var(--accent)]">
              <Tags className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.18em] muted">Labels</div>
              <h3 className="mt-1 text-xl font-semibold">标签作为次级配置</h3>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div className="panel-strong p-4">
              <div className="text-sm font-semibold">已创建 {tags.length} 个标签</div>
              <p className="mt-2 text-sm muted">默认先创建任务，标签只在需要做聚类或过滤时再补充。</p>
            </div>

            <Button tone="secondary" onClick={() => setShowTagManager((current) => !current)} block>
              {showTagManager ? '收起标签管理' : '展开标签管理'}
            </Button>
          </div>

          {showTagManager ? (
            <form className="mt-6 space-y-4" onSubmit={(event) => void handleCreateTag(event)}>
              <div>
                <label className="mb-2 block text-sm font-semibold">标签名称</label>
                <input className="field-input" value={tagName} onChange={(event) => setTagName(event.target.value)} placeholder="例如：Product、Infra、Personal" required />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">颜色</label>
                <div className="flex flex-wrap gap-2">
                  {tagColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setTagColor(color)}
                      className={`h-10 w-10 rounded-full border-2 ${tagColor === color ? 'border-[var(--text-primary)]' : 'border-transparent'}`}
                      style={{ backgroundColor: color }}
                      aria-label={`select ${color}`}
                    />
                  ))}
                </div>
              </div>

              <Button type="submit" tone="secondary" disabled={createTagMutation.isPending}>
                {createTagMutation.isPending ? '创建中...' : '创建标签'}
              </Button>
              {createTagMutation.error ? <div className="text-sm text-[#d11f3e]">{createTagMutation.error.message}</div> : null}
            </form>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span key={tag.id} className="tag-chip">
                <span className="tag-chip-dot" style={{ backgroundColor: tag.color }} />
                {tag.name}
                <button
                  type="button"
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--text-primary)]"
                  onClick={() => void handleDeleteTag(tag.id)}
                  aria-label={`delete tag ${tag.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
          {deleteTagMutation.error ? <div className="mt-3 text-sm text-[#d11f3e]">{deleteTagMutation.error.message}</div> : null}
        </section>
      </section>

      <section className="panel p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] muted">Task board</div>
            <h3 className="mt-2 text-xl font-semibold">任务列表</h3>
            <p className="mt-2 text-sm muted">默认按扫描效率展示，只保留标题、时间、优先级和关键信息。</p>
          </div>

          <DashboardFilters
            statusFilter={statusFilter}
            sortMode={sortMode}
            setStatusFilter={setStatusFilter}
            setSortMode={setSortMode}
            mode="desktop"
          />
        </div>

        {tags.length > 0 ? (
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

        {!canDragSort ? <div className="mt-4 text-sm muted">拖拽排序仅在默认排序、全部状态、无标签筛选且未编辑任务时启用。</div> : <div className="mt-4 text-sm muted">当前可直接拖拽任务卡片右侧的“拖拽”按钮来调整顺序。</div>}

        {todosQuery.isLoading ? <div className="mt-6 text-sm muted">正在加载任务数据…</div> : null}
        {todosQuery.error ? (
          <div className="mt-6 panel-strong p-4 text-sm text-[#d11f3e]">
            {todosQuery.error.message}
            <div className="mt-2 muted">如果这是首次运行，请先在 Supabase SQL Editor 执行仓库内的 schema.sql。</div>
          </div>
        ) : null}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => void handleDragEnd(event)}>
          <SortableContext items={visibleTodos.map((todo) => todo.id)} strategy={verticalListSortingStrategy}>
            <div className="mt-6 space-y-4">
              {visibleTodos.map((todo, index) => (
                <motion.div key={todo.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04, duration: 0.28 }}>
                  <SortableTodoCard
                    id={todo.id}
                    disabled={!canDragSort}
                    content={
                      <>
                        <input
                          className="field-checkbox mt-1 h-5 w-5"
                          type="checkbox"
                          checked={todo.status === 'completed'}
                          onChange={(event) =>
                            toggleTodoStatusMutation.mutate({
                              id: todo.id,
                              status: event.target.checked ? 'completed' : 'pending',
                            })
                          }
                        />

                        <div className="min-w-0">
                    {editingTodoId === todo.id ? (
                      <div className="space-y-3">
                        <input className="field-input" value={editTitle} onChange={(event) => setEditTitle(event.target.value)} />
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
                          <input className="field-input" type="datetime-local" value={editDueDate} onChange={(event) => setEditDueDate(event.target.value)} />
                          <select className="field-input field-select" value={editPriority} onChange={(event) => setEditPriority(Number(event.target.value) as TodoPriority)}>
                            {priorityOptions.map((item) => (
                              <option key={item.value} value={item.value}>
                                {item.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                            <BellRing className="h-4 w-4" />
                            提醒设置
                          </div>
                          <select className="field-input field-select" value={editReminderType} onChange={(event) => setEditReminderType(event.target.value as TodoReminderType)}>
                            {reminderOptions.map((item) => (
                              <option key={item.value} value={item.value}>
                                {item.label}
                              </option>
                            ))}
                          </select>
                          <div className="mt-2 text-sm muted">{reminderOptions.find((item) => item.value === editReminderType)?.hint}</div>

                          {editReminderType === 'custom_date' ? (
                            <div className="mt-3">
                              <input className="field-input" type="datetime-local" value={editReminderAt} onChange={(event) => setEditReminderAt(event.target.value)} />
                            </div>
                          ) : null}

                          {(editReminderType === 'hour' || editReminderType === 'ten_minutes') && !editDueDate ? (
                            <div className="mt-3 text-sm text-[#d11f3e]">预设提醒依赖截止时间，请先填写截止时间。</div>
                          ) : null}
                        </div>
                        <div>
                          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                            <Tags className="h-4 w-4" />
                            编辑标签
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {tags.length === 0 ? <div className="text-sm muted">当前没有可用标签。</div> : null}
                            {tags.map((tag) => {
                              const selected = editSelectedTagIds.includes(tag.id)

                              return (
                                <button
                                  key={tag.id}
                                  type="button"
                                  onClick={() => handleToggleEditTag(tag.id)}
                                  className={`tag-chip ${selected ? 'ring-2 ring-[var(--accent)]' : ''}`}
                                >
                                  <span className="tag-chip-dot" style={{ backgroundColor: tag.color }} />
                                  {tag.name}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                        <div>
                          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                            <ListChecks className="h-4 w-4" />
                            编辑子任务
                          </div>
                          <div className="flex gap-2">
                            <input
                              className="field-input"
                              value={editDraftSubtask}
                              onChange={(event) => setEditDraftSubtask(event.target.value)}
                              placeholder="添加一个新的子任务"
                            />
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
                                <Button
                                  type="button"
                                  tone="ghost"
                                  onClick={() => setEditSubtasks((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                                >
                                  <X className="h-4 w-4" />
                                  删除
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                        {editFormError ? <div className="text-sm text-[#d11f3e]">{editFormError}</div> : null}
                        {updateTodoMutation.error ? <div className="text-sm text-[#d11f3e]">{updateTodoMutation.error.message}</div> : null}
                        {replaceTodoTagsMutation.error ? <div className="text-sm text-[#d11f3e]">{replaceTodoTagsMutation.error.message}</div> : null}
                        {replaceTodoSubtasksMutation.error ? <div className="text-sm text-[#d11f3e]">{replaceTodoSubtasksMutation.error.message}</div> : null}
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className={`text-lg font-semibold ${todo.status === 'completed' ? 'line-through opacity-60' : ''}`}>{todo.title}</h4>
                          <span className="tag-chip" style={{ borderColor: priorityOptions.find((item) => item.value === todo.priority)?.tone }}>
                            <span className="tag-chip-dot" style={{ backgroundColor: priorityOptions.find((item) => item.value === todo.priority)?.tone }} />
                            {priorityOptions.find((item) => item.value === todo.priority)?.label}
                          </span>
                        </div>

                        {getDescriptionSnippet(todo.description) ? <p className="mt-3 text-sm muted">{getDescriptionSnippet(todo.description)}</p> : null}

                        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.12em] muted">
                          <span>Due {formatDate(todo.dueDate)}</span>
                          <span>{getReminderSummary(todo.reminderType, todo.reminderAt)}</span>
                          <span>Created {formatDate(todo.createdAt)}</span>
                        </div>
                      </>
                    )}

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

                    {todo.subtasks.length > 0 && editingTodoId !== todo.id ? (
                      <div className="mt-4 text-sm muted">
                        已完成 {todo.subtasks.filter((subtask) => subtask.isCompleted).length} / {todo.subtasks.length} 个子任务
                      </div>
                    ) : null}

                    {todo.subtasks.length > 0 && editingTodoId === todo.id ? (
                      <div className="mt-4 space-y-2">
                        {todo.subtasks.map((subtask) => (
                          <label key={subtask.id} className="panel flex items-center gap-3 px-4 py-3 text-sm">
                            <input
                              className="field-checkbox h-4 w-4"
                              type="checkbox"
                              checked={subtask.isCompleted}
                              onChange={(event) =>
                                toggleSubtaskMutation.mutate({ id: subtask.id, isCompleted: event.target.checked })
                              }
                            />
                            <span className={subtask.isCompleted ? 'line-through opacity-60' : ''}>{subtask.title}</span>
                          </label>
                        ))}
                      </div>
                    ) : null}
                        </div>
                      </>
                    }
                    actions={
                      <>
                        {editingTodoId === todo.id ? (
                          <>
                            <Button tone="secondary" onClick={() => void handleUpdateTodo(todo.id)} disabled={updateTodoMutation.isPending}>
                              <Save className="h-4 w-4" />
                              保存
                            </Button>
                            <Button tone="ghost" onClick={handleCancelEdit}>
                              <X className="h-4 w-4" />
                              取消
                            </Button>
                          </>
                        ) : (
                          <Button
                            tone="ghost"
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
                            <PencilLine className="h-4 w-4" />
                            编辑
                          </Button>
                        )}
                        <Button tone="ghost" onClick={() => deleteTodoMutation.mutate(todo.id)} disabled={deleteTodoMutation.isPending}>
                          <Trash2 className="h-4 w-4" />
                          删除
                        </Button>
                      </>
                    }
                  />
                </motion.div>
              ))}

              {!todosQuery.isLoading && visibleTodos.length === 0 ? (
                <div className="panel-strong p-6 text-sm muted">当前状态与标签筛选条件下还没有任务。先调整筛选条件，或者在上方创建第一条 Todo。</div>
              ) : null}
            </div>
          </SortableContext>
        </DndContext>
      </section>
    </AppShell>
  )
}
