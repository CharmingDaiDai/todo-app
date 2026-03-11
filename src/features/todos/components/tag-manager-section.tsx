import { useMemo, useState, type FormEvent } from 'react'
import { useMutationState } from '@tanstack/react-query'
import { LoaderCircle, Tags, X } from 'lucide-react'
import { cn } from '../../../lib/cn'
import { Button } from '../../../components/ui/button'
import { todoMutationKeys, useCreateTagMutation, useDeleteTagMutation, useTagsQuery } from '../hooks'

const tagColors = ['#1258d6', '#ff4d00', '#2f8f58', '#8a43ff', '#d11f3e', '#f59e0b']

type TagManagerSectionProps = {
  userId?: string
}

export function TagManagerSection({ userId }: TagManagerSectionProps) {
  const tagsQuery = useTagsQuery(userId)
  const createTagMutation = useCreateTagMutation(userId)
  const deleteTagMutation = useDeleteTagMutation(userId)
  const [showTagManager, setShowTagManager] = useState(false)
  const [tagName, setTagName] = useState('')
  const [tagColor, setTagColor] = useState(tagColors[0])
  const pendingDeleteTagIds = useMutationState<string | undefined>({
    filters: { mutationKey: todoMutationKeys.deleteTag, status: 'pending' },
    select: (mutation) => mutation.state.variables as string | undefined,
  })

  const tags = tagsQuery.data ?? []
  const deletingTagIds = useMemo(
    () => new Set(pendingDeleteTagIds.filter((tagId): tagId is string => Boolean(tagId))),
    [pendingDeleteTagIds],
  )

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

  return (
    <section className="panel p-6 xl:col-span-2">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-soft)] text-[var(--accent)]">
          <Tags className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.18em] muted">Labels</div>
          <h3 className="mt-1 text-xl font-semibold">标签管理</h3>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <div className="panel-strong p-4">
          <div className="text-sm font-semibold">已创建 {tags.length} 个标签</div>
          <p className="mt-2 text-sm muted">在这里统一维护标签，主界面只保留标签的选择和过滤。</p>
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
            {createTagMutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {createTagMutation.isPending ? '创建中...' : '创建标签'}
          </Button>
          {createTagMutation.error ? <div className="text-sm text-[#d11f3e]">{createTagMutation.error.message}</div> : null}
        </form>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        {tagsQuery.isLoading ? (
          <>
            <span className="tag-chip surface-syncing h-8 w-24" />
            <span className="tag-chip surface-syncing h-8 w-20" />
            <span className="tag-chip surface-syncing h-8 w-28" />
          </>
        ) : null}
        {!tagsQuery.isLoading && tagsQuery.isFetching ? <div className="sync-pill"><span className="sync-pill-dot" /> 正在刷新标签</div> : null}
        {tags.map((tag) => (
          <span key={tag.id} className={cn('tag-chip', deletingTagIds.has(tag.id) && 'tag-chip-syncing')}>
            <span className="tag-chip-dot" style={{ backgroundColor: tag.color }} />
            {tag.name}
            <button
              type="button"
              className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--text-primary)]"
              onClick={() => void handleDeleteTag(tag.id)}
              disabled={deletingTagIds.has(tag.id)}
              aria-label={`delete tag ${tag.name}`}
            >
              {deletingTagIds.has(tag.id) ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
            </button>
          </span>
        ))}
      </div>

      {tagsQuery.error ? <div className="mt-4 text-sm text-[#d11f3e]">{tagsQuery.error.message}</div> : null}
      {deleteTagMutation.error ? <div className="mt-3 text-sm text-[#d11f3e]">{deleteTagMutation.error.message}</div> : null}
    </section>
  )
}