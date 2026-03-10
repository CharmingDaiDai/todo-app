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
import { CalendarClock, GripVertical, ListChecks, PencilLine, Plus, Save, Tags, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode, type FormEvent } from 'react'
import { AppShell } from '../../components/layout/app-shell'
import { ThemeStage } from '../../components/theme/theme-stage'
import { Button } from '../../components/ui/button'
import {
  useCreateTagMutation,
  useCreateTodoMutation,
  useDeleteTagMutation,
  useDeleteTodoMutation,
  useReorderTodoMutation,
  useReplaceTodoTagsMutation,
  useTagsQuery,
  useTodosQuery,
  useToggleSubtaskMutation,
  useToggleTodoStatusMutation,
  useUpdateTodoMutation,
} from '../../features/todos/hooks'
import { calculateNewOrderIndex } from '../../features/todos/order'
import type { TodoPriority } from '../../features/todos/types'
import { cn } from '../../lib/cn'
import { useAuthStore } from '../../store/auth-store'
import { useThemeStore } from '../../store/theme-store'

const priorityOptions: Array<{ value: TodoPriority; label: string; tone: string }> = [
  { value: 3, label: '高优先级', tone: '#d11f3e' },
  { value: 2, label: '中优先级', tone: 'var(--accent)' },
  { value: 1, label: '低优先级', tone: '#2f8f58' },
]

const tagColors = ['#1258d6', '#ff4d00', '#2f8f58', '#8a43ff', '#d11f3e', '#f59e0b']

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
  const language = useThemeStore((state) => state.language)
  const mode = useThemeStore((state) => state.mode)
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

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<TodoPriority>(2)
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [draftSubtask, setDraftSubtask] = useState('')
  const [subtasks, setSubtasks] = useState<string[]>([])
  const [tagName, setTagName] = useState('')
  const [tagColor, setTagColor] = useState(tagColors[0])
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all')
  const [sortMode, setSortMode] = useState<'manual' | 'due' | 'priority'>('manual')
  const [activeTagFilters, setActiveTagFilters] = useState<string[]>([])
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const [editPriority, setEditPriority] = useState<TodoPriority>(2)
  const [editSelectedTagIds, setEditSelectedTagIds] = useState<string[]>([])

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

  const handleCreateTodo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!userId || !title.trim()) {
      return
    }

    try {
      await createTodoMutation.mutateAsync({
        userId,
        title: title.trim(),
        description: description.trim(),
        priority,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        tagIds: selectedTagIds,
        subtasks: subtasks.map((item) => ({ title: item })),
      })

      setTitle('')
      setDescription('')
      setDueDate('')
      setPriority(2)
      setSelectedTagIds([])
      setSubtasks([])
      setDraftSubtask('')
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
    currentPriority: TodoPriority,
    currentTagIds: string[],
  ) => {
    setEditingTodoId(todoId)
    setEditTitle(currentTitle)
    setEditDescription(currentDescription)
    setEditDueDate(toDateTimeLocalValue(currentDueDate))
    setEditPriority(currentPriority)
    setEditSelectedTagIds(currentTagIds)
  }

  const handleCancelEdit = () => {
    setEditingTodoId(null)
    setEditTitle('')
    setEditDescription('')
    setEditDueDate('')
    setEditPriority(2)
    setEditSelectedTagIds([])
  }

  const handleUpdateTodo = async (todoId: string) => {
    if (!editTitle.trim()) {
      return
    }

    try {
      await updateTodoMutation.mutateAsync({
        id: todoId,
        title: editTitle.trim(),
        description: editDescription.trim(),
        dueDate: editDueDate ? new Date(editDueDate).toISOString() : null,
        priority: editPriority,
      })

      await replaceTodoTagsMutation.mutateAsync({
        todoId,
        tagIds: editSelectedTagIds,
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
      title="Live Todo workspace"
      description="当前页已经直接连接 Supabase 数据层，可创建标签、任务和子任务，并支持完成状态切换与基础筛选排序。"
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
              <CalendarClock className="mt-0.5 h-5 w-5 text-[var(--accent)]" />
              <div>
                <div className="font-semibold">当前已接入真实数据层</div>
                <p className="mt-1 text-sm muted">任务、标签和子任务会直接通过 React Query 与 Supabase 交互，下一步再补拖拽排序与编辑流。</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="panel-strong p-4">
                <div className="text-xs uppercase tracking-[0.18em] muted">Open</div>
                <div className="mt-2 text-2xl font-semibold">{pendingCount}</div>
              </div>
              <div className="panel-strong p-4">
                <div className="text-xs uppercase tracking-[0.18em] muted">Done</div>
                <div className="mt-2 text-2xl font-semibold">{completedCount}</div>
              </div>
              <div className="panel-strong p-4">
                <div className="text-xs uppercase tracking-[0.18em] muted">Due 24h</div>
                <div className="mt-2 text-2xl font-semibold">{dueSoonCount}</div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <form className="panel p-6" onSubmit={(event) => void handleCreateTodo(event)}>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-soft)] text-[var(--accent)]">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.18em] muted">Create task</div>
              <h3 className="mt-1 text-xl font-semibold">录入新的 Todo</h3>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            <div>
              <label className="mb-2 block text-sm font-semibold">标题</label>
              <input className="field-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：完成 Supabase schema 上线" required />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">描述</label>
              <textarea className="field-input field-textarea" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="补充说明、上下文和期望结果" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
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

            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Tags className="h-4 w-4" />
                标签
              </div>
              <div className="flex flex-wrap gap-2">
                {tags.length === 0 ? <div className="text-sm muted">先在右侧创建标签，然后回来多选。</div> : null}
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

            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={createTodoMutation.isPending}>
                {createTodoMutation.isPending ? '保存中...' : '创建 Todo'}
              </Button>
              {createTodoMutation.error ? <div className="text-sm text-[#d11f3e]">{createTodoMutation.error.message}</div> : null}
            </div>
          </div>
        </form>

        <section className="panel p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-soft)] text-[var(--accent)]">
              <Tags className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.18em] muted">Tag studio</div>
              <h3 className="mt-1 text-xl font-semibold">管理任务标签</h3>
            </div>
          </div>

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
          </div>

          <div className="flex flex-wrap gap-2">
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

        {!canDragSort ? (
          <div className="mt-4 text-sm muted">拖拽排序仅在“默认排序 + 全部状态 + 无标签筛选 + 非编辑中”时启用，避免在筛选视图里写出错误顺序。</div>
        ) : (
          <div className="mt-4 text-sm muted">当前可直接拖拽任务卡片右侧的“拖拽”按钮来调整顺序。</div>
        )}

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
                        <textarea className="field-input field-textarea" value={editDescription} onChange={(event) => setEditDescription(event.target.value)} placeholder="补充说明、上下文和期望结果" />
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
                        {updateTodoMutation.error ? <div className="text-sm text-[#d11f3e]">{updateTodoMutation.error.message}</div> : null}
                        {replaceTodoTagsMutation.error ? <div className="text-sm text-[#d11f3e]">{replaceTodoTagsMutation.error.message}</div> : null}
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

                        {todo.description ? <p className="mt-2 text-sm muted">{todo.description}</p> : null}

                        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.12em] muted">
                          <span>Due {formatDate(todo.dueDate)}</span>
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

                    {todo.subtasks.length > 0 ? (
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
                            onClick={() => handleStartEdit(todo.id, todo.title, todo.description, todo.dueDate, todo.priority, todo.tags.map((tag) => tag.id))}
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