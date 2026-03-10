# Deep Todo App

一个基于 React、Supabase 和 PWA 的沉浸式 Todo 应用。当前版本已经覆盖认证、任务管理、三套设计语言、拖拽排序、浏览器推送订阅、Supabase Edge Function 到期提醒，以及移动端底部 Tab 导航。

## 当前实现

- React 19 + TypeScript + Vite 7
- React Router 7
- TanStack Query 5 管理服务端状态
- Zustand 管理主题与会话状态
- Tailwind CSS 4 + 自定义 CSS Variables 主题系统
- Framer Motion 页面与卡片动画
- dnd-kit 任务拖拽排序
- Supabase Auth / Postgres / RLS / Edge Functions
- vite-plugin-pwa 自定义 service worker
- 任务描述字段轻量 Markdown 编辑与预览

## 与原始方案的差异

- UI 组件当前采用自定义组件层，没有引入 Shadcn UI
- 路由实际使用的是 React Router 7，而不是早期文档里的 v6 描述
- 当前每个任务只支持一组提醒配置：不提醒、提前 1 小时、提前 10 分钟、自定义时间
- 自动化测试暂未接入；当前以构建验证和手工回归为主

## 本地运行

在 app 目录下运行：

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
```

## 环境变量

前端需要以下变量：

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_VAPID_PUBLIC_KEY=
```

为了兼容 Cloudflare Pages，也支持：

```bash
VITE_SUPABASE_ANON_KEY=
```

前端会优先读取 VITE_SUPABASE_PUBLISHABLE_KEY，如果不存在则回退到 VITE_SUPABASE_ANON_KEY。

在 Cloudflare Pages 上，前端还会优先通过 Pages Function `/api/runtime-config` 读取运行时配置，这样即使构建阶段的 Vite 变量注入异常，也不会阻塞 Supabase 初始化。

如果 Cloudflare Pages 对 `VITE_*` 变量表现异常，运行时接口还支持这些后备名字：

```bash
SUPABASE_URL=
SUPABASE_ANON_KEY=
VAPID_PUBLIC_KEY=
```

对 Pages 来说，推荐优先配置这组不带 `VITE_` 前缀的运行时变量，由 `/api/runtime-config` 提供给前端。

## Supabase SQL

首次初始化或升级提醒能力后，需要执行：

- supabase/schema.sql
- supabase/push_pipeline.sql

## 当前未完成范围

- PWA 安装引导界面
- 更完整的离线数据同步策略
- 一个任务支持多个提醒时间
