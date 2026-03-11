export const appRelease = {
  version: __APP_VERSION__,
  channel: 'beta',
  codename: 'Northstar',
  summary: '时间面板已升级为移动端可拖拽 sheet，并扩展为更大的触控时间选择区。',
} as const

export function formatVersionLabel(version: string, channel: string) {
  return `v${version} · ${channel}`
}