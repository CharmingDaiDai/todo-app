export const appRelease = {
  version: __APP_VERSION__,
  channel: 'beta',
  codename: 'Northstar',
  summary: 'Todo 和标签操作已加入乐观更新、全局同步提示与局部过渡反馈，降低 Supabase 往返延迟带来的卡顿感。',
} as const

export function formatVersionLabel(version: string, channel: string) {
  return `v${version} · ${channel}`
}