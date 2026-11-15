# 个人第二大脑 · M0 移动端

Expo SDK 57 / React Native / TypeScript strict / Expo Router。四 Tab 为“今天、记录、记忆、我的”，首页进入问答与提醒。所有页面使用合成数据；审核、待办及设置仅存内存，刷新恢复。模拟录音不采集、保存或上传音频。

默认不调用后端或模型；仅“我的 → 测试本地 API 连接”主动读取 `/health` 和 `/api/v1/meta`。API 地址通过 `.env.example` 的 `EXPO_PUBLIC_API_BASE_URL` 配置。禁止把供应商密钥或设备令牌写入 public 环境变量。

在项目根目录使用 Windows PowerShell，运行 `powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1` 安装，再运行 `powershell -ExecutionPolicy Bypass -File .\scripts\start-mobile.ps1 -Web`。详细依赖、iPhone 可信局域网与检查步骤见仓库根 README。真机、麦克风、后台录音和系统通知均未验证。

本目录可运行 `npm.cmd run typecheck`、`npm.cmd run lint`、`npm.cmd run format:check`、`npm.cmd test`、`npx.cmd expo install --check`、`npx.cmd expo export --platform web`。

组件在 src/components，会话规则在 src/services/demo-state.ts，合成数据与预设演示回答在 src/providers/mock.ts，网络边界在 src/services/connection.ts，路由在 src/app。真实持久化、设备配对、录音、模型能力不在 M0 范围内。

SDK 57 的 Router 使用 query-string 7.1.3，其旧 URL 解码依赖存在 DoS 公告。本项目精确覆盖至 decode-uri-component 0.5.1，并由 `scripts/patch-query-string.js` 在 postinstall 严格检查版本与原始源码，将唯一一行 CJS require 适配为 ESM default；脚本可重复执行，遇未知版本或源码立即失败。`__tests__/routing-query.test.ts` 覆盖中文、空格、重复 key、字符范围和损坏编码。当上游 Expo Router 兼容已修复解码器后，升级验证并移除 overrides 与这项补丁。不要使用 `npm ci --ignore-scripts` 跳过兼容补丁。
