import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createTag, createTodo, deleteTag, deleteTodo, listTags, listTodos, reorderTodo, replaceTodoSubtasks, replaceTodoTags, toggleSubtaskCompletion, toggleTodoStatus, updateTodo } from './api'
import type { CreateTagInput, CreateTodoInput, ReorderTodoInput, ReplaceTodoSubtasksInput, ReplaceTodoTagsInput, Tag, Todo, UpdateTodoInput } from './types'

export const todoKeys = {
  all: ['todos'] as const,
  list: (userId: string) => ['todos', userId] as const,
  tags: (userId: string) => ['tags', userId] as const,
}

export const todoMutationKeys = {
  createTodo: ['todos', 'mutation', 'create'] as const,
  createTag: ['tags', 'mutation', 'create'] as const,
  deleteTag: ['tags', 'mutation', 'delete'] as const,
  toggleTodoStatus: ['todos', 'mutation', 'toggle-status'] as const,
  deleteTodo: ['todos', 'mutation', 'delete'] as const,
  updateTodo: ['todos', 'mutation', 'update'] as const,
  toggleSubtask: ['todos', 'mutation', 'toggle-subtask'] as const,
  reorderTodo: ['todos', 'mutation', 'reorder'] as const,
  replaceTodoTags: ['todos', 'mutation', 'replace-tags'] as const,
  replaceTodoSubtasks: ['todos', 'mutation', 'replace-subtasks'] as const,
}

function createTempId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function sortTodos(todos: Todo[]) {
  return todos.slice().sort((left, right) => left.orderIndex - right.orderIndex)
}

function updateTodoList(queryClient: ReturnType<typeof useQueryClient>, userId: string, updater: (current: Todo[]) => Todo[]) {
  queryClient.setQueryData<Todo[]>(todoKeys.list(userId), (current) => (current ? updater(current) : current))
}

function updateTagList(queryClient: ReturnType<typeof useQueryClient>, userId: string, updater: (current: Tag[]) => Tag[]) {
  queryClient.setQueryData<Tag[]>(todoKeys.tags(userId), (current) => (current ? updater(current) : current))
}

export function useTodosQuery(userId: string | undefined) {
  return useQuery({
    queryKey: userId ? todoKeys.list(userId) : ['todos', 'anonymous'],
    queryFn: () => listTodos(userId as string),
    enabled: Boolean(userId),
  })
}

export function useTagsQuery(userId: string | undefined) {
  return useQuery({
    queryKey: userId ? todoKeys.tags(userId) : ['tags', 'anonymous'],
    queryFn: () => listTags(userId as string),
    enabled: Boolean(userId),
  })
}

export function useCreateTodoMutation(userId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: todoMutationKeys.createTodo,
    mutationFn: (input: CreateTodoInput) => createTodo(input),
    onMutate: async (input) => {
      if (!userId) {
        return { previousTodos: undefined }
      }

      await queryClient.cancelQueries({ queryKey: todoKeys.list(userId) })
      const previousTodos = queryClient.getQueryData<Todo[]>(todoKeys.list(userId))
      const knownTags = queryClient.getQueryData<Tag[]>(todoKeys.tags(userId)) ?? []
      const highestOrderIndex = previousTodos?.reduce((max, todo) => Math.max(max, todo.orderIndex), 0) ?? 0
      const now = new Date().toISOString()

      const optimisticTodo: Todo = {
        id: createTempId('todo'),
        userId: input.userId,
        title: input.title,
        description: input.description,
        status: 'pending',
        priority: input.priority,
        dueDate: input.dueDate,
        reminderType: input.reminderType,
        reminderAt: input.reminderAt,
        orderIndex: highestOrderIndex + 1000,
        createdAt: now,
        updatedAt: now,
        tags: knownTags.filter((tag) => input.tagIds.includes(tag.id)),
        subtasks: input.subtasks.map((subtask, index) => ({
          id: createTempId('subtask'),
          todoId: 'optimistic',
          title: subtask.title,
          isCompleted: false,
          orderIndex: index,
          createdAt: now,
        })),
      }

      queryClient.setQueryData<Todo[]>(todoKeys.list(userId), (current) => sortTodos([...(current ?? []), optimisticTodo]))

      return { previousTodos }
    },
    onError: (_error, _input, context) => {
      if (!userId || !context?.previousTodos) return
      queryClient.setQueryData(todoKeys.list(userId), context.previousTodos)
    },
    onSettled: async () => {
      if (!userId) return
      await queryClient.invalidateQueries({ queryKey: todoKeys.list(userId) })
    },
  })
}

export function useCreateTagMutation(userId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: todoMutationKeys.createTag,
    mutationFn: (input: CreateTagInput) => createTag(input),
    onMutate: async (input) => {
      if (!userId) {
        return { previousTags: undefined }
      }

      await queryClient.cancelQueries({ queryKey: todoKeys.tags(userId) })
      const previousTags = queryClient.getQueryData<Tag[]>(todoKeys.tags(userId))
      const optimisticTag: Tag = {
        id: createTempId('tag'),
        name: input.name,
        color: input.color,
        createdAt: new Date().toISOString(),
      }

      queryClient.setQueryData<Tag[]>(todoKeys.tags(userId), (current) => [...(current ?? []), optimisticTag].sort((left, right) => left.name.localeCompare(right.name, 'zh-CN')))

      return { previousTags }
    },
    onError: (_error, _input, context) => {
      if (!userId || !context?.previousTags) return
      queryClient.setQueryData(todoKeys.tags(userId), context.previousTags)
    },
    onSettled: async () => {
      if (!userId) return
      await queryClient.invalidateQueries({ queryKey: todoKeys.tags(userId) })
    },
  })
}

export function useDeleteTagMutation(userId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: todoMutationKeys.deleteTag,
    mutationFn: (id: string) => deleteTag(id),
    onMutate: async (id) => {
      if (!userId) {
        return { previousTags: undefined, previousTodos: undefined }
      }

      await Promise.all([
        queryClient.cancelQueries({ queryKey: todoKeys.tags(userId) }),
        queryClient.cancelQueries({ queryKey: todoKeys.list(userId) }),
      ])

      const previousTags = queryClient.getQueryData<Tag[]>(todoKeys.tags(userId))
      const previousTodos = queryClient.getQueryData<Todo[]>(todoKeys.list(userId))

      updateTagList(queryClient, userId, (current) => current.filter((tag) => tag.id !== id))
      updateTodoList(queryClient, userId, (current) => current.map((todo) => ({ ...todo, tags: todo.tags.filter((tag) => tag.id !== id) })))

      return { previousTags, previousTodos }
    },
    onError: (_error, _id, context) => {
      if (!userId) return
      if (context?.previousTags) {
        queryClient.setQueryData(todoKeys.tags(userId), context.previousTags)
      }
      if (context?.previousTodos) {
        queryClient.setQueryData(todoKeys.list(userId), context.previousTodos)
      }
    },
    onSettled: async () => {
      if (!userId) return
      await queryClient.invalidateQueries({ queryKey: todoKeys.tags(userId) })
      await queryClient.invalidateQueries({ queryKey: todoKeys.list(userId) })
    },
  })
}

export function useToggleTodoStatusMutation(userId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: todoMutationKeys.toggleTodoStatus,
    mutationFn: ({ id, status }: { id: string; status: 'pending' | 'completed' }) => toggleTodoStatus(id, status),
    onMutate: async ({ id, status }) => {
      if (!userId) {
        return { previousTodos: undefined }
      }

      await queryClient.cancelQueries({ queryKey: todoKeys.list(userId) })
      const previousTodos = queryClient.getQueryData<Todo[]>(todoKeys.list(userId))

      updateTodoList(queryClient, userId, (current) =>
        current.map((todo) => (todo.id === id ? { ...todo, status, updatedAt: new Date().toISOString() } : todo)),
      )

      return { previousTodos }
    },
    onError: (_error, _variables, context) => {
      if (!userId || !context?.previousTodos) return
      queryClient.setQueryData(todoKeys.list(userId), context.previousTodos)
    },
    onSettled: async () => {
      if (!userId) return
      await queryClient.invalidateQueries({ queryKey: todoKeys.list(userId) })
    },
  })
}

export function useDeleteTodoMutation(userId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: todoMutationKeys.deleteTodo,
    mutationFn: (id: string) => deleteTodo(id),
    onMutate: async (id) => {
      if (!userId) {
        return { previousTodos: undefined }
      }

      await queryClient.cancelQueries({ queryKey: todoKeys.list(userId) })
      const previousTodos = queryClient.getQueryData<Todo[]>(todoKeys.list(userId))

      updateTodoList(queryClient, userId, (current) => current.filter((todo) => todo.id !== id))

      return { previousTodos }
    },
    onError: (_error, _id, context) => {
      if (!userId || !context?.previousTodos) return
      queryClient.setQueryData(todoKeys.list(userId), context.previousTodos)
    },
    onSettled: async () => {
      if (!userId) return
      await queryClient.invalidateQueries({ queryKey: todoKeys.list(userId) })
    },
  })
}

export function useUpdateTodoMutation(userId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: todoMutationKeys.updateTodo,
    mutationFn: (input: UpdateTodoInput) => updateTodo(input),
    onMutate: async (input) => {
      if (!userId) {
        return { previousTodos: undefined }
      }

      await queryClient.cancelQueries({ queryKey: todoKeys.list(userId) })
      const previousTodos = queryClient.getQueryData<Todo[]>(todoKeys.list(userId))

      updateTodoList(queryClient, userId, (current) =>
        current.map((todo) =>
          todo.id === input.id
            ? {
                ...todo,
                title: input.title ?? todo.title,
                description: input.description ?? todo.description,
                priority: input.priority ?? todo.priority,
                dueDate: input.dueDate === undefined ? todo.dueDate : input.dueDate,
                reminderType: input.reminderType ?? todo.reminderType,
                reminderAt: input.reminderAt === undefined ? todo.reminderAt : input.reminderAt,
                status: input.status ?? todo.status,
                updatedAt: new Date().toISOString(),
              }
            : todo,
        ),
      )

      return { previousTodos }
    },
    onError: (_error, _input, context) => {
      if (!userId || !context?.previousTodos) return
      queryClient.setQueryData(todoKeys.list(userId), context.previousTodos)
    },
    onSettled: async () => {
      if (!userId) return
      await queryClient.invalidateQueries({ queryKey: todoKeys.list(userId) })
    },
  })
}

export function useToggleSubtaskMutation(userId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: todoMutationKeys.toggleSubtask,
    mutationFn: ({ id, isCompleted }: { id: string; isCompleted: boolean }) => toggleSubtaskCompletion(id, isCompleted),
    onMutate: async ({ id, isCompleted }) => {
      if (!userId) {
        return { previousTodos: undefined }
      }

      await queryClient.cancelQueries({ queryKey: todoKeys.list(userId) })
      const previousTodos = queryClient.getQueryData<Todo[]>(todoKeys.list(userId))

      updateTodoList(queryClient, userId, (current) =>
        current.map((todo) => ({
          ...todo,
          subtasks: todo.subtasks.map((subtask) =>
            subtask.id === id ? { ...subtask, isCompleted } : subtask,
          ),
        })),
      )

      return { previousTodos }
    },
    onError: (_error, _variables, context) => {
      if (!userId || !context?.previousTodos) return
      queryClient.setQueryData(todoKeys.list(userId), context.previousTodos)
    },
    onSettled: async () => {
      if (!userId) return
      await queryClient.invalidateQueries({ queryKey: todoKeys.list(userId) })
    },
  })
}

export function useReorderTodoMutation(userId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: todoMutationKeys.reorderTodo,
    mutationFn: (input: ReorderTodoInput) => reorderTodo(input),
    onMutate: async ({ id, orderIndex }) => {
      if (!userId) {
        return { previousTodos: undefined }
      }

      await queryClient.cancelQueries({ queryKey: todoKeys.list(userId) })
      const previousTodos = queryClient.getQueryData<Todo[]>(todoKeys.list(userId))

      if (previousTodos) {
        queryClient.setQueryData<Todo[]>(
          todoKeys.list(userId),
          previousTodos
            .map((todo) => (todo.id === id ? { ...todo, orderIndex } : todo))
            .sort((left, right) => left.orderIndex - right.orderIndex),
        )
      }

      return { previousTodos }
    },
    onError: (_error, _variables, context) => {
      if (!userId || !context?.previousTodos) return
      queryClient.setQueryData(todoKeys.list(userId), context.previousTodos)
    },
    onSettled: async () => {
      if (!userId) return
      await queryClient.invalidateQueries({ queryKey: todoKeys.list(userId) })
    },
  })
}

export function useReplaceTodoTagsMutation(userId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: todoMutationKeys.replaceTodoTags,
    mutationFn: (input: ReplaceTodoTagsInput) => replaceTodoTags(input),
    onMutate: async (input) => {
      if (!userId) {
        return { previousTodos: undefined }
      }

      await queryClient.cancelQueries({ queryKey: todoKeys.list(userId) })
      const previousTodos = queryClient.getQueryData<Todo[]>(todoKeys.list(userId))
      const knownTags = queryClient.getQueryData<Tag[]>(todoKeys.tags(userId)) ?? []

      updateTodoList(queryClient, userId, (current) =>
        current.map((todo) =>
          todo.id === input.todoId
            ? { ...todo, tags: knownTags.filter((tag) => input.tagIds.includes(tag.id)) }
            : todo,
        ),
      )

      return { previousTodos }
    },
    onError: (_error, _input, context) => {
      if (!userId || !context?.previousTodos) return
      queryClient.setQueryData(todoKeys.list(userId), context.previousTodos)
    },
    onSettled: async () => {
      if (!userId) return
      await queryClient.invalidateQueries({ queryKey: todoKeys.list(userId) })
    },
  })
}

export function useReplaceTodoSubtasksMutation(userId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: todoMutationKeys.replaceTodoSubtasks,
    mutationFn: (input: ReplaceTodoSubtasksInput) => replaceTodoSubtasks(input),
    onMutate: async (input) => {
      if (!userId) {
        return { previousTodos: undefined }
      }

      await queryClient.cancelQueries({ queryKey: todoKeys.list(userId) })
      const previousTodos = queryClient.getQueryData<Todo[]>(todoKeys.list(userId))
      const now = new Date().toISOString()

      updateTodoList(queryClient, userId, (current) =>
        current.map((todo) =>
          todo.id === input.todoId
            ? {
                ...todo,
                subtasks: input.subtasks.map((subtask, index) => ({
                  id: todo.subtasks[index]?.id ?? createTempId('subtask'),
                  todoId: input.todoId,
                  title: subtask.title,
                  isCompleted: subtask.isCompleted,
                  orderIndex: index,
                  createdAt: todo.subtasks[index]?.createdAt ?? now,
                })),
              }
            : todo,
        ),
      )

      return { previousTodos }
    },
    onError: (_error, _input, context) => {
      if (!userId || !context?.previousTodos) return
      queryClient.setQueryData(todoKeys.list(userId), context.previousTodos)
    },
    onSettled: async () => {
      if (!userId) return
      await queryClient.invalidateQueries({ queryKey: todoKeys.list(userId) })
    },
  })
}