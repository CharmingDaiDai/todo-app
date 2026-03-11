export const appRelease = {
  version: __APP_VERSION__,
  channel: 'beta',
  codename: 'Northstar',
  summary: '任务面板现已采用自定义日期时间选择器，并继续统一移动端浮层与编辑体验。',
} as const

export function formatVersionLabel(version: string, channel: string) {
  return `v${version} · ${channel}`
}