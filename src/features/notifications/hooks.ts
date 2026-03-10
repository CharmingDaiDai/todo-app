import { useEffect, useMemo, useState } from 'react'
import { env } from '../../lib/env'
import { deletePushSubscription, upsertPushSubscription } from './api'

function isNotificationSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalized = `${base64}${padding}`
  const raw = window.atob(normalized)

  return Uint8Array.from(raw, (character) => character.charCodeAt(0))
}

function getSubscriptionKeys(subscription: PushSubscription) {
  const p256dh = subscription.getKey('p256dh')
  const auth = subscription.getKey('auth')

  if (!p256dh || !auth) {
    throw new Error('Push subscription is missing required encryption keys.')
  }

  const toBase64 = (buffer: ArrayBuffer) => window.btoa(String.fromCharCode(...new Uint8Array(buffer)))

  return {
    auth: toBase64(auth),
    p256dh: toBase64(p256dh),
  }
}

export function usePushNotifications(userId: string | undefined) {
  const [permission, setPermission] = useState<NotificationPermission>(() => Notification.permission)
  const [isSupported, setIsSupported] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setIsSupported(isNotificationSupported())
    setPermission(Notification.permission)
  }, [])

  useEffect(() => {
    if (!isNotificationSupported() || !userId) {
      setIsSubscribed(false)
      return
    }

    let active = true

    void navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        if (active) {
          setIsSubscribed(Boolean(subscription))
        }
      })
      .catch((subscriptionError: unknown) => {
        if (active && subscriptionError instanceof Error) {
          setError(subscriptionError.message)
        }
      })

    return () => {
      active = false
    }
  }, [userId])

  const isConfigured = useMemo(() => Boolean(env.vapidPublicKey), [])

  const subscribe = async () => {
    if (!userId) {
      setError('需要先登录后才能启用提醒。')
      return
    }

    if (!isNotificationSupported()) {
      setError('当前浏览器不支持 Web Push。')
      return
    }

    if (!env.vapidPublicKey) {
      setError('缺少 VAPID public key，暂时无法创建浏览器推送订阅。')
      return
    }

    setIsBusy(true)
    setError(null)

    try {
      const requestedPermission = await Notification.requestPermission()
      setPermission(requestedPermission)

      if (requestedPermission !== 'granted') {
        throw new Error('浏览器通知权限未授予。')
      }

      const registration = await navigator.serviceWorker.ready
      const existingSubscription = await registration.pushManager.getSubscription()
      const subscription =
        existingSubscription ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeBase64Url(env.vapidPublicKey),
        }))

      const keys = getSubscriptionKeys(subscription)

      await upsertPushSubscription(userId, {
        endpoint: subscription.endpoint,
        auth: keys.auth,
        p256dh: keys.p256dh,
      })

      setIsSubscribed(true)
    } catch (subscriptionError) {
      if (subscriptionError instanceof Error) {
        setError(subscriptionError.message)
      }
    } finally {
      setIsBusy(false)
    }
  }

  const unsubscribe = async () => {
    if (!isNotificationSupported()) {
      return
    }

    setIsBusy(true)
    setError(null)

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        await deletePushSubscription(subscription.endpoint)
        await subscription.unsubscribe()
      }

      setIsSubscribed(false)
    } catch (unsubscribeError) {
      if (unsubscribeError instanceof Error) {
        setError(unsubscribeError.message)
      }
    } finally {
      setIsBusy(false)
    }
  }

  return {
    permission,
    isSupported,
    isConfigured,
    isSubscribed,
    isBusy,
    error,
    subscribe,
    unsubscribe,
  }
}