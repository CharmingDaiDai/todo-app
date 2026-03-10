import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '../../lib/cn'

type MarkdownPreviewProps = {
  content: string
  className?: string
  emptyState?: string
}

export function MarkdownPreview({ content, className, emptyState = '暂无内容。' }: MarkdownPreviewProps) {
  const normalizedContent = content.trim()

  if (!normalizedContent) {
    return <div className={cn('markdown-preview muted', className)}>{emptyState}</div>
  }

  return (
    <div className={cn('markdown-preview', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{normalizedContent}</ReactMarkdown>
    </div>
  )
}