export const appRelease = {
  version: __APP_VERSION__,
  channel: 'beta',
  codename: 'Northstar',
  summary: '时间面板已修正紧凑布局的样式优先级，抽屉中的窄宽度场景不再被桌面双栏布局覆盖。',
} as const

export function formatVersionLabel(version: string, channel: string) {
  return `v${version} · ${channel}`
}