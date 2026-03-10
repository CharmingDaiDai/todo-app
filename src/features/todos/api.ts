import { supabase } from '../../lib/supabase'
import type { CreateTagInput, CreateTodoInput, ReorderTodoInput, ReplaceTodoSubtasksInput, ReplaceTodoTagsInput, Subtask, Tag, Todo, UpdateTodoInput } from './types'

type TodoRow = {
  id: string
  user_id: string
  title: string
  description: string
  status: 'pending' | 'completed'
  priority: 1 | 2 | 3
  due_date: string | null
  order_index: number
  created_at: string
  updated_at: string
  subtasks?: Array<{
    id: string
    todo_id: string
    title: string
    is_completed: boolean
    order_index: number
    created_at: string
  }>
  todo_tags?: Array<{
    tag: Array<{
      id: string
      name: string
      color: string
      created_at: string
    }>
  }>
}

type TagRow = {
  id: string
  name: string
  color: string
  created_at: string
}

function mapTag(row: TagRow): Tag {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
  }
}

function mapSubtask(row: NonNullable<TodoRow['subtasks']>[number]): Subtask {
  return {
    id: row.id,
    todoId: row.todo_id,
    title: row.title,
    isCompleted: row.is_completed,
    orderIndex: row.order_index,
    createdAt: row.created_at,
  }
}

function mapTodo(row: TodoRow): Todo {
  const tags = (row.todo_tags ?? []).flatMap((item) => item.tag.map(mapTag))

  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date,
    orderIndex: row.order_index,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    subtasks: (row.subtasks ?? []).slice().sort((left, right) => left.order_index - right.order_index).map(mapSubtask),
    tags,
  }
}

export async function listTags(userId: string): Promise<Tag[]> {
  const { data, error } = await supabase
    .from('tags')
    .select('id, name, color, created_at')
    .eq('user_id', userId)
    .order('name', { ascending: true })

  if (error) {
    throw error
  }

  return (data satisfies TagRow[]).map(mapTag)
}

export async function createTag(input: CreateTagInput): Promise<Tag> {
  const { data, error } = await supabase
    .from('tags')
    .insert({
      user_id: input.userId,
      name: input.name,
      color: input.color,
    })
    .select('id, name, color, created_at')
    .single()

  if (error) {
    throw error
  }

  return mapTag(data satisfies TagRow)
}

export async function deleteTag(id: string): Promise<void> {
  const { error } = await supabase.from('tags').delete().eq('id', id)

  if (error) {
    throw error
  }
}

export async function listTodos(userId: string): Promise<Todo[]> {
  const { data, error } = await supabase
    .from('todos')
    .select(
      `
        id,
        user_id,
        title,
        description,
        status,
        priority,
        due_date,
        order_index,
        created_at,
        updated_at,
        subtasks (
          id,
          todo_id,
          title,
          is_completed,
          order_index,
          created_at
        ),
        todo_tags (
          tag:tags (
            id,
            name,
            color,
            created_at
          )
        )
      `,
    )
    .eq('user_id', userId)
    .order('order_index', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return (data as TodoRow[]).map(mapTodo)
}

export async function createTodo(input: CreateTodoInput): Promise<void> {
  const { data: latestTodo } = await supabase
    .from('todos')
    .select('order_index')
    .eq('user_id', input.userId)
    .order('order_index', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextOrderIndex = (latestTodo?.order_index ?? 0) + 1000

  const { data: todo, error } = await supabase
    .from('todos')
    .insert({
      user_id: input.userId,
      title: input.title,
      description: input.description,
      priority: input.priority,
      due_date: input.dueDate,
      status: 'pending',
      order_index: nextOrderIndex,
    })
    .select('id')
    .single()

  if (error) {
    throw error
  }

  try {
    if (input.subtasks.length > 0) {
      const { error: subtasksError } = await supabase.from('subtasks').insert(
        input.subtasks.map((subtask, index) => ({
          todo_id: todo.id,
          title: subtask.title,
          order_index: index,
        })),
      )

      if (subtasksError) {
        throw subtasksError
      }
    }

    if (input.tagIds.length > 0) {
      const { error: tagsError } = await supabase.from('todo_tags').insert(
        input.tagIds.map((tagId) => ({
          todo_id: todo.id,
          tag_id: tagId,
        })),
      )

      if (tagsError) {
        throw tagsError
      }
    }
  } catch (insertError) {
    await supabase.from('todos').delete().eq('id', todo.id)
    throw insertError
  }
}

export async function updateTodo(input: UpdateTodoInput): Promise<void> {
  const payload: Record<string, unknown> = {}

  if (input.title !== undefined) payload.title = input.title
  if (input.description !== undefined) payload.description = input.description
  if (input.priority !== undefined) payload.priority = input.priority
  if (input.dueDate !== undefined) payload.due_date = input.dueDate
  if (input.status !== undefined) payload.status = input.status

  const { error } = await supabase.from('todos').update(payload).eq('id', input.id)

  if (error) {
    throw error
  }
}

export async function toggleTodoStatus(id: string, status: 'pending' | 'completed'): Promise<void> {
  return updateTodo({ id, status })
}

export async function deleteTodo(id: string): Promise<void> {
  const { error } = await supabase.from('todos').delete().eq('id', id)

  if (error) {
    throw error
  }
}

export async function toggleSubtaskCompletion(id: string, isCompleted: boolean): Promise<void> {
  const { error } = await supabase.from('subtasks').update({ is_completed: isCompleted }).eq('id', id)

  if (error) {
    throw error
  }
}

export async function reorderTodo(input: ReorderTodoInput): Promise<void> {
  const { error } = await supabase.from('todos').update({ order_index: input.orderIndex }).eq('id', input.id)

  if (error) {
    throw error
  }
}

export async function replaceTodoTags(input: ReplaceTodoTagsInput): Promise<void> {
  const { error: deleteError } = await supabase.from('todo_tags').delete().eq('todo_id', input.todoId)

  if (deleteError) {
    throw deleteError
  }

  if (input.tagIds.length === 0) {
    return
  }

  const { error: insertError } = await supabase.from('todo_tags').insert(
    input.tagIds.map((tagId) => ({
      todo_id: input.todoId,
      tag_id: tagId,
    })),
  )

  if (insertError) {
    throw insertError
  }
}

export async function replaceTodoSubtasks(input: ReplaceTodoSubtasksInput): Promise<void> {
  const { error: deleteError } = await supabase.from('subtasks').delete().eq('todo_id', input.todoId)

  if (deleteError) {
    throw deleteError
  }

  if (input.subtasks.length === 0) {
    return
  }

  const { error: insertError } = await supabase.from('subtasks').insert(
    input.subtasks.map((subtask, index) => ({
      todo_id: input.todoId,
      title: subtask.title,
      is_completed: subtask.isCompleted,
      order_index: index,
    })),
  )

  if (insertError) {
    throw insertError
  }
}