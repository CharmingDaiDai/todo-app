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
import { BellRing, ChevronDown, ChevronUp, GripVertical, ListChecks, PencilLine, Plus, Save, Tags, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode, type FormEvent } from 'react'
import { AppShell } from '../../components/layout/app-shell'
import { Button } from '../../components/ui/button'
import { MarkdownPreview } from '../../components/ui/markdown-preview'
import {
  useCreateTodoMutation,
  useDeleteTodoMutation,
  useReorderTodoMutation,
  useReplaceTodoSubtasksMutation,
  useReplaceTodoTagsMutation,
  useTagsQuery,
  useTodosQuery,
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
}

function SortableTodoCard({ id, disabled, content, actions, isActive = false }: SortableTodoCardProps) {
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
      className={cn('panel-strong p-5', isDragging && 'opacity-80', isActive && 'border-[var(--accent)] ring-2 ring-[var(--accent-soft)]')}
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

type EditTodoDrawerProps = {
  isOpen: boolean
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
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col border-l border-[var(--border)] bg-[var(--page-bg)] shadow-[0_24px_80px_rgba(0,0,0,0.22)]"
      >
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
              <div>
                <label className="mb-2 block text-sm font-semibold">截止时间</label>
                <input className="field-input" type="datetime-local" value={editDueDate} onChange={(event) => setEditDueDate(event.target.value)} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold">优先级</label>
                <select className="field-input field-select" value={editPriority} onChange={(event) => setEditPriority(Number(event.target.value) as TodoPriority)}>
                  {priorityOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
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
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Tags className="h-4 w-4" />
                标签
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
              <Save className="h-4 w-4" />
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
  const deleteTodoMutation = useDeleteTodoMutation(userId)
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
  const [expandedSubtaskTodoIds, setExpandedSubtaskTodoIds] = useState<string[]>([])
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
  const editingTodo = todos.find((todo) => todo.id === editingTodoId) ?? null

  useEffect(() => {
    if (!editingTodoId) {
      return
    }

    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleCancelEdit()
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [editingTodoId])

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
      <section className="grid gap-4 sm:grid-cols-3">
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
      </section>

      <section>
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
              {createFormError ? <div className="text-sm text-[#d11f3e]">{createFormError}</div> : null}
              {createTodoMutation.error ? <div className="text-sm text-[#d11f3e]">{createTodoMutation.error.message}</div> : null}
            </div>

            <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-strong)]/65">
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

              {showCreateDetails ? (
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
                  </div>

                  <div>
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                      <Tags className="h-4 w-4" />
                      标签
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {tags.length === 0 ? <div className="text-sm muted">当前还没有标签，可在设置页中创建。</div> : null}
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

                  <div className="md:col-span-2">
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
                </div>
              ) : null}
            </section>
          </div>
        </form>
      </section>

      <section className="panel p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] muted">Task board</div>
            <h3 className="mt-2 text-xl font-semibold">任务列表</h3>
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
                    isActive={editingTodoId === todo.id}
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
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className={`text-lg font-semibold ${todo.status === 'completed' ? 'line-through opacity-60' : ''}`}>{todo.title}</h4>
                            <span className="tag-chip" style={{ borderColor: priorityOptions.find((item) => item.value === todo.priority)?.tone }}>
                              <span className="tag-chip-dot" style={{ backgroundColor: priorityOptions.find((item) => item.value === todo.priority)?.tone }} />
                              {priorityOptions.find((item) => item.value === todo.priority)?.label}
                            </span>
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

                              {expandedSubtaskTodoIds.includes(todo.id) ? (
                                <div className="mt-3 space-y-2">
                                  {todo.subtasks.map((subtask) => (
                                    <div key={subtask.id} className="panel flex items-center gap-3 px-4 py-3 text-sm">
                                      <span className={`h-2.5 w-2.5 rounded-full ${subtask.isCompleted ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`} />
                                      <span className={subtask.isCompleted ? 'line-through opacity-60' : ''}>{subtask.title}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </>
                    }
                    actions={
                      <>
                        <Button
                          tone={editingTodoId === todo.id ? 'secondary' : 'ghost'}
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
                          {editingTodoId === todo.id ? '正在编辑' : '编辑'}
                        </Button>
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

      <EditTodoDrawer
        isOpen={editingTodo !== null}
        todoTitle={editingTodo?.title ?? ''}
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
          if (editingTodo) {
            void handleUpdateTodo(editingTodo.id)
          }
        }}
      />
    </AppShell>
  )
}
