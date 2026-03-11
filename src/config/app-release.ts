export const appRelease = {
  version: __APP_VERSION__,
  channel: 'beta',
  codename: 'Northstar',
  summary: '查询刷新现已支持 skeleton 与后台重验证提示，同时补充了同步成功和失败回滚的全局 toast 反馈。',
} as const

export function formatVersionLabel(version: string, channel: string) {
  return `v${version} · ${channel}`
}