import { arrayMove } from '@dnd-kit/sortable'

type OrderedTodo = {
  id: string
  orderIndex: number
}

const ORDER_STEP = 1000

export function calculateNewOrderIndex(items: OrderedTodo[], activeId: string, overId: string) {
  const activeIndex = items.findIndex((item) => item.id === activeId)
  const overIndex = items.findIndex((item) => item.id === overId)

  if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex) {
    return null
  }

  const reordered = arrayMove(items, activeIndex, overIndex)
  const movedIndex = reordered.findIndex((item) => item.id === activeId)
  const previous = reordered[movedIndex - 1] ?? null
  const next = reordered[movedIndex + 1] ?? null

  if (!previous && !next) {
    return items[activeIndex]?.orderIndex ?? ORDER_STEP
  }

  if (!previous && next) {
    return next.orderIndex - ORDER_STEP
  }

  if (previous && !next) {
    return previous.orderIndex + ORDER_STEP
  }

  return ((previous?.orderIndex ?? 0) + (next?.orderIndex ?? 0)) / 2
}