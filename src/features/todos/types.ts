export type TodoStatus = 'pending' | 'completed'

export type TodoPriority = 1 | 2 | 3

export type Tag = {
  id: string
  name: string
  color: string
  createdAt: string
}

export type Subtask = {
  id: string
  todoId: string
  title: string
  isCompleted: boolean
  orderIndex: number
  createdAt: string
}

export type Todo = {
  id: string
  userId: string
  title: string
  description: string
  status: TodoStatus
  priority: TodoPriority
  dueDate: string | null
  orderIndex: number
  createdAt: string
  updatedAt: string
  subtasks: Subtask[]
  tags: Tag[]
}

export type CreateTagInput = {
  userId: string
  name: string
  color: string
}

export type CreateTodoInput = {
  userId: string
  title: string
  description: string
  priority: TodoPriority
  dueDate: string | null
  tagIds: string[]
  subtasks: Array<{
    title: string
  }>
}

export type UpdateTodoInput = {
  id: string
  title?: string
  description?: string
  priority?: TodoPriority
  dueDate?: string | null
  status?: TodoStatus
}