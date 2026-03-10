export const appRelease = {
  version: __APP_VERSION__,
  channel: 'beta',
  codename: 'Northstar',
  summary: '移动端导航、Markdown 描述、推送提醒与运行时配置已整合到同一版本基线。',
} as const

export function formatVersionLabel(version: string, channel: string) {
  return `v${version} · ${channel}`
}