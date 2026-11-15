# 个人第二大脑 · M0 / M1 移动端

Expo SDK 57 / React Native / TypeScript strict / Expo Router。M0 四 Tab 为“今天、记录、记忆、我的”，首页进入演示问答与提醒。M0 页面使用合成数据；演示审核、待办及设置仅存内存，刷新恢复。模拟录音不采集、保存或上传音频。

M0 演示入口保留，不自动上传。首页“文字工作区 · M1”进入独立文字功能：设备配对、文字创建/编辑/删除、时间线与检索、手动人物/项目/事件关联、候选抽取与审核、有原文引用的问答。工作区仅访问 `.env.example` 的 `EXPO_PUBLIC_API_BASE_URL` 对应服务。禁止把供应商密钥或设备令牌写入 public 环境变量；模型 Adapter 与密钥只在服务端配置。

M1 新文字先显式“保存本机草稿”，再“保存并批准同步文字”。AsyncStorage 保存未加密文字草稿；已批准内容固定 UUID 与载荷，启动、恢复前台或 Web 恢复联网时重试，响应丢失不会换标识重复新建。未批准草稿不会自动发送；发送前后写盘失败均不假称保存成功。普通 401/409 保留输入；明确的 `RECORD_DELETED` 墓碑清除待同步正文，避免重建已删记录。原生设备令牌进入 SecureStore，Web 仅存当前标签页的 sessionStorage（同源脚本可读取，关标签页后需重新配对）。退出配对保留草稿；切换 API 地址不会发送旧地址队列。当前只支持单个应用实例操作本机队列，暂未做跨浏览器标签页写入锁。

在电脑端按仓库根 README 生成一次性配对码，再进入“设备配对”填写。保存记录不会自动抽取。默认 Mock，仅从原文生成待核实候选；每条候选可打开指定来源版本并高亮证据。修改候选后仍待复核，确认需另行点击。服务端若启用外部模型，详情页要求逐次明确同意后才能抽取。问答显示真实 API 返回的来源、时间和确认状态，无依据明确无法确认；旧预算记录不会因新预算出现而自动删除。

在项目根目录使用 Windows PowerShell，运行 `powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1` 安装，再运行 `powershell -ExecutionPolicy Bypass -File .\scripts\start-mobile.ps1 -Web`。详细依赖、iPhone 可信局域网与检查步骤见仓库根 README。真机、麦克风、后台录音和系统通知均未验证。

本目录可运行 `npm.cmd run typecheck`、`npm.cmd run lint`、`npm.cmd run format:check`、`npm.cmd test`、`npx.cmd expo install --check`、`npx.cmd expo export --platform web`。

组件在 src/components，M0 会话规则在 src/services/demo-state.ts，合成演示数据在 src/providers/mock.ts。M1 网络契约在 src/services/workspace-api.ts，持久草稿与幂等队列在 src/services/outbox.ts，凭据存储在 workspace-storage.ts，配对和恢复同步在 workspace-state.tsx，路由位于 src/app/workspace。证据范围使用 Unicode 码点，含 emoji 的原文也按同一坐标高亮。所有自动化测试只使用虚构资料；服务端 SQLite 与本机草稿尚未生产级加密。M1 不采集真实录音，不进入 M2。iPhone 原生启动、SecureStore 设备行为及真实模型仍需设备/受控环境验收，不能用 Web/Jest 结果代替。

SDK 57 的 Router 使用 query-string 7.1.3，其旧 URL 解码依赖存在 DoS 公告。本项目精确覆盖至 decode-uri-component 0.5.1，并由 `scripts/patch-query-string.js` 在 postinstall 严格检查版本与原始源码，将唯一一行 CJS require 适配为 ESM default；脚本可重复执行，遇未知版本或源码立即失败。`__tests__/routing-query.test.ts` 覆盖中文、空格、重复 key、字符范围和损坏编码。当上游 Expo Router 兼容已修复解码器后，升级验证并移除 overrides 与这项补丁。不要使用 `npm ci --ignore-scripts` 跳过兼容补丁。
