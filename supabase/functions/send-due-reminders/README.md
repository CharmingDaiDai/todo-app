# send-due-reminders

这个 Edge Function 负责扫描未来 60 分钟内到期的待办任务，并向已订阅 `push_subs` 的设备发送 Web Push 提醒。

## 发送窗口

- `hour`: 任务在 60 分钟内、但不在 10 分钟内到期时发送
- `ten_minutes`: 任务在 10 分钟内到期时发送

提醒去重依赖 `public.todo_reminders` 表。

## 必需的 Edge Function Secrets

使用 Supabase CLI 或控制台设置这些 secrets：

```bash
supabase secrets set \
  CRON_PUSH_TOKEN="your-random-cron-token" \
  WEB_PUSH_VAPID_SUBJECT="mailto:you@example.com" \
  WEB_PUSH_VAPID_PUBLIC_KEY="your-vapid-public-key" \
  WEB_PUSH_VAPID_PRIVATE_KEY="your-vapid-private-key"
```

`SUPABASE_URL` 与 `SUPABASE_SERVICE_ROLE_KEY` 由 Supabase 托管环境自动提供。

## 必需的 Vault Secrets

`pg_cron` 任务通过 `vault.decrypted_secrets` 读取以下值：

- `project_url`: 例如 `https://<project-ref>.supabase.co`
- `cron_push_token`: 与 Edge Function secret `CRON_PUSH_TOKEN` 相同

你可以在 SQL Editor 中手动创建：

```sql
select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
select vault.create_secret('<same-random-cron-token>', 'cron_push_token');
```

## 部署顺序

1. 在 SQL Editor 执行 [supabase/push_pipeline.sql](supabase/push_pipeline.sql)
2. 设置 Edge Function secrets
3. 创建 Vault secrets
4. 部署函数：

```bash
supabase functions deploy send-due-reminders --no-verify-jwt
```

5. 用 SQL 手动测试：

```sql
select public.invoke_send_due_reminders();
```

6. 确认 `cron.job` 中存在 `send-due-reminders-every-minute`

## 说明

- 当前逻辑在订阅无效（404/410）时会自动删除对应 `push_subs` 记录
- 只有至少成功下发到一个设备时，才会写入 `todo_reminders`
- 如果用户当前没有有效订阅，则不会写 reminder 记录，后续在到期前重新订阅仍有机会收到提醒