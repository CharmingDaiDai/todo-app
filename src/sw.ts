/// <reference lib="webworker" />

import { precacheAndRoute } from 'workbox-precaching'

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<unknown>
}

precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('push', (event) => {
  const payload = event.data?.json?.() as
    | {
        title?: string
        body?: string
        url?: string
        tag?: string
        icon?: string
        badge?: string
      }
    | undefined

  const title = payload?.title ?? 'Deep Todo'
  const body = payload?.body ?? '你有一个即将到期的任务提醒。'

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: payload?.icon ?? '/deep-todo-mark.svg',
      badge: payload?.badge ?? '/deep-todo-mark.svg',
      tag: payload?.tag ?? 'deep-todo-reminder',
      data: {
        url: payload?.url ?? '/app',
      },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const targetUrl = String(event.notification.data?.url ?? '/app')
      const matched = clients.find((client) => 'focus' in client)

      if (matched) {
        return matched.focus()
      }

      return self.clients.openWindow(targetUrl)
    }),
  )
})