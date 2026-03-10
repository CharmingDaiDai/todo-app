import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createTag, createTodo, deleteTodo, listTags, listTodos, toggleSubtaskCompletion, toggleTodoStatus, updateTodo } from './api'
import type { CreateTagInput, CreateTodoInput, UpdateTodoInput } from './types'

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