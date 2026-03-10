import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createTag, createTodo, deleteTag, deleteTodo, listTags, listTodos, reorderTodo, replaceTodoTags, toggleSubtaskCompletion, toggleTodoStatus, updateTodo } from './api'
import type { CreateTagInput, CreateTodoInput, ReorderTodoInput, ReplaceTodoTagsInput, Todo, UpdateTodoInput } from './types'

export const todoKeys = {
  all: ['todos'] as const,
  list: (userId: string) => ['todos', userId] as const,
  tags: (userId: string) => ['tags', userId] as const,
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
    mutationFn: (input: CreateTodoInput) => createTodo(input),
    onSuccess: async () => {
      if (!userId) return
      await queryClient.invalidateQueries({ queryKey: todoKeys.list(userId) })
    },
  })
}

export function useCreateTagMutation(userId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateTagInput) => createTag(input),
    onSuccess: async () => {
      if (!userId) return
      await queryClient.invalidateQueries({ queryKey: todoKeys.tags(userId) })
    },
  })
}

export function useDeleteTagMutation(userId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteTag(id),
    onSuccess: async () => {
      if (!userId) return
      await queryClient.invalidateQueries({ queryKey: todoKeys.tags(userId) })
      await queryClient.invalidateQueries({ queryKey: todoKeys.list(userId) })
    },
  })
}

export function useToggleTodoStatusMutation(userId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'pending' | 'completed' }) => toggleTodoStatus(id, status),
    onSuccess: async () => {
      if (!userId) return
      await queryClient.invalidateQueries({ queryKey: todoKeys.list(userId) })
    },
  })
}

export function useDeleteTodoMutation(userId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteTodo(id),
    onSuccess: async () => {
      if (!userId) return
      await queryClient.invalidateQueries({ queryKey: todoKeys.list(userId) })
    },
  })
}

export function useUpdateTodoMutation(userId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpdateTodoInput) => updateTodo(input),
    onSuccess: async () => {
      if (!userId) return
      await queryClient.invalidateQueries({ queryKey: todoKeys.list(userId) })
    },
  })
}

export function useToggleSubtaskMutation(userId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, isCompleted }: { id: string; isCompleted: boolean }) => toggleSubtaskCompletion(id, isCompleted),
    onSuccess: async () => {
      if (!userId) return
      await queryClient.invalidateQueries({ queryKey: todoKeys.list(userId) })
    },
  })
}

export function useReorderTodoMutation(userId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
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
    mutationFn: (input: ReplaceTodoTagsInput) => replaceTodoTags(input),
    onSuccess: async () => {
      if (!userId) return
      await queryClient.invalidateQueries({ queryKey: todoKeys.list(userId) })
    },
  })
}