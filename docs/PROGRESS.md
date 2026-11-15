# M0 交付与验收记录

日期：2026-11-15（Asia/Shanghai）。范围：只做 M0；**未开始 M1，等待用户验收**。

## 当前状态

M0 工程与本机演示交付已完成，自动检查及浏览器验收通过；**等待用户最终验收**。当前记录不构成 iPhone 真机通过声明。

## M0 验收项逐项核对

| M0 验收项 | 状态 | 依据 |
|---|---|---|
| 检查 Windows 开发环境、扫描原文件 | 通过 | 资料包只有规范与夹具；已补足项目内 npm / Python 环境 |
| 仓库、目录、README、环境模板和锁文件 | 通过 | 本地 Git `main`；后端与移动端各有依赖锁 |
| 四 Tab 与问答、提醒、记录 / 记忆详情、录音浮层 | 通过（浏览器） | 实际 Expo 开发服务器中的手机尺寸点击与导航 |
| 全部演示内容标 Mock、不冒充真实 AI | 通过 | 页面固定标签；明确未保存音频、会话重置及预设回答 |
| FastAPI 健康、版本、错误、Mock provider | 通过 | 真实 SQLite 查询、统一错误结构、LLM / ASR 分离 |
| 默认不需要 Key、不连接云模型、有网络配置边界 | 通过 | Live 拒绝启用；只有用户点击连接检查才访问本机 API |
| pytest、移动端类型检查、lint 和本地启动烟测 | 通过 | 统一检查脚本和真实进程 / 浏览器烟测均完成 |
| README 中 Windows 步骤可用 | 通过 | Windows PowerShell 5.1 完整运行 `setup.ps1`、`check.ps1` 与两个启动脚本 |
| 无真实用户音频上传 | 通过 | 没有麦克风和音频上传实现；浏览器未发现外部 HTTP 请求 |
| iPhone 真机是否已测试 | 未测，已明示 | 没有连接实际手机，不宣称已安装或后台能力通过 |
| 完成后停止 M0、更新进度 | 通过 | 本记录与交付文档已更新；M1 尚未开始 |

## 环境检查

| 项目 | 实际结果 |
|---|---|
| Windows PowerShell | 5.1 命令验证通过；Codex 终端 PowerShell 7.6.9 |
| Node | 24.22.1 |
| npm | 系统 PATH 缺失；项目 `.tooling` 提供 12.2.2 |
| Python | 系统 `python` 是无效 Store 别名；现有运行时 3.12.14，已创建项目 `.venv` |
| Git | 2.55.0.windows.3；资料包目录初始化本地 `main`，没有添加远端或推送 |
| Expo | SDK 57；项目本地 CLI，无需全局安装 |
| EAS | 未全局安装；M0 不使用云构建 |
| Apple 账户 / 模型 Key | 未要求、未使用 |

## 实现文件

| 位置 | 内容 |
|---|---|
| `apps/mobile/src/app/` | 四 Tab、问答、提醒、记录详情、记忆详情 |
| `apps/mobile/src/components/` | 公共界面、Mock 提示、模拟录音浮层 |
| `apps/mobile/src/providers/` | 固定合成数据与演示回答 |
| `apps/mobile/src/services/` | 会话状态与用户主动触发的 HTTP 连接检查 |
| `apps/mobile/src/types/` | 领域类型 |
| `apps/mobile/__tests__/` | 移动端演示行为和关键组件测试 |
| `apps/mobile/package.json`、`package-lock.json` | Expo SDK 兼容的锁定依赖与检查命令 |
| `apps/mobile/.env.example` | 仅本地 API 地址，无供应商凭据 |
| `services/api/app/` | FastAPI、配置、鉴权、结构错误、SQLite、LLM / ASR 独立协议与 Mock |
| `services/api/migrations/` | Alembic 工程元数据迁移基线 |
| `services/api/tests/` | API、隐私错误边界、鉴权、provider、数据库测试 |
| `services/api/pyproject.toml`、`requirements.lock` | Python 工程、Ruff / mypy / pytest 与依赖锁 |
| `scripts/*.ps1` | 安装、启动、检查、本机测试令牌 |
| `scripts/smoke_api.py` | 临时数据库与真实 Uvicorn 进程 HTTP 烟测 |
| `scripts/smoke_ui.cjs` | 可选 Playwright / Edge 手机尺寸浏览器回归与截图 |
| `apps/mobile/scripts/patch-query-string.js` | 严格、幂等的 SDK 57 URL 解码安全兼容补丁 |
| `README.md`、`.env.example`、`.gitignore`、`.gitattributes` | Windows 启动手册、配置和仓库基础 |
| `docs/10_M0_DECISIONS.md` | 本阶段工程选择、边界与官方依据 |

原研发资料 `00_START_HERE.md`、`AGENTS.md`、`CODEX_FIRST_PROMPT.md`、`docs/01–09` 与合成夹具保留。上级目录的 ZIP、单文件合并需求书和用户第一条指令未修改。

逐文件清单见 [M0_FILE_MANIFEST.md](M0_FILE_MANIFEST.md)，共 111 个跟踪文件（包含原规范和官方模板图标）。实现快照提交：`fab476a5e6c7080bdd1f16761c09e6a97a03e705`；使用本地 Codex 作者信息，无远端、无推送。此进度中的提交记录随后以独立文档提交补充。

## 实际检查结果

| 检查 | 结果 | 说明 |
|---|---|---|
| 后端 pytest | 通过，30 项 | 1 条上游 Starlette / HTTPX 弃用提示 |
| 后端 Ruff lint / format | 通过 | 20 个 Python 文件符合格式 |
| 后端 mypy | 通过 | 14 个实现文件 |
| Python pip check | 通过 | 未发现依赖冲突 |
| SQLite / Alembic | 通过 | 真实 `upgrade head`，WAL；仅 `schema_state` 与迁移元数据 |
| 真实进程 API 烟测 | 通过，6 项 | 回环地址、临时库、随机临时令牌；健康/Mock 元数据/401/鉴权200/422/404 |
| PowerShell 语法与运行时探测 | 通过 | PS 5.1 能调用项目 npm、Node 和 `.venv` Python |
| PowerShell 完整安装复现 | 通过 | `npm ci` 重装 1071 个包，postinstall 自动应用补丁；模板复制与迁移完成 |
| 令牌脚本隔离测试 | 通过 | 首次生成、哈希匹配、不回显、不隐式覆盖、显式轮换均验证 |
| 移动端 strict TypeScript / lint / format | 通过 | 含依赖兼容补丁脚本 |
| 移动端组件与规则测试 | 通过，4 套 / 19 项 | 搜索空态、模拟录音、审核/提醒、问答取消/拒答、连接错误、编码查询参数 |
| Expo 依赖检查 / Web 导出 | 通过 | SDK 57 兼容包版本；Web 为单页应用 |
| 浏览器手机尺寸交互 | 通过，12 项 | Playwright 1.62.1 / Edge headless，440×956；含中文查询参数证据深链、真实后端连接、无外部 HTTP 请求与无浏览器运行异常 |
| iPhone 16 Pro Max / Expo Go | **未测** | 当前没有连接实际手机 |
| 签名安装 / 后台录音 / 通知 | **未测** | M0 不包含真实能力、不需要账户；后续阶段另验收 |

复核命令、逐步启动命令和手工验收路线详见根 `README.md`。本地验证产物均在 Git 忽略的 `.artifacts/verification/`，没有令牌或真实谈话：

- `setup.txt`：Windows PowerShell 5.1 完整安装记录。
- `check.txt`：统一格式 / 类型 / 自动测试 / Expo 依赖检查最终结果。
- `api-smoke.txt`、`api-smoke-server.log`：6 项真实进程 API 检查。
- `ui-smoke.txt`：12 项浏览器检查。
- `powershell-token-test.txt`：令牌脚本隔离测试摘要，不含凭据。
- `home.png`、`recording-demo.png`、`record-detail.png`、`evidence.png`、`answer.png`、`reminders.png`、`settings.png`：真实运行页面截图。

最后一次统一检查退出码为 0；没有把 iOS 原生能力纳入这些通过数。

## M0 范围与限制

- UI 使用内存合成数据。确认、驳回、待办和设置只改变本次会话，刷新后恢复，不声称已经持久保存。
- 模拟录音只计时，不申请麦克风、不生成音频文件；无真人录音上传。
- 问答是明确标识的预设演示；非示例问题演示依据不足。不能当作真实模型质量评测。
- 后端只读 Mock 资源；真实文字记录、配对撤销、幂等写入、版本冲突、持久队列未做，属于后续阶段。
- 没有启用云模型、ASR、推送、导出或真实删除，没有公网服务；SQLite 未加密，不能宣称端到端加密。
- 局域网模式必须用户显式启动；后端会监听所有网卡，需自行维护可信网络和防火墙。默认只监听回环。
- Node 依赖审计最终为 **0 严重 / 0 高危 / 8 中危 / 10 低危**；仍涉及 Expo / ESLint 的 minimatch 和 Jest / deepmerge 等上游工具依赖，不能宣称整个依赖树没有安全问题。URL 解码高危已修复并回归；其他问题保留到后续兼容升级，不能据此把当前原型直接公开部署。
- URL 解码兼容补丁需要维护：安装必须执行 postinstall；不要使用 `npm ci --ignore-scripts`。升级 Expo / Router 时重新核对并在上游修复后移除此补丁。

## 验收后的下一步

请先按 README 检查演示体验，并在 iPhone 上尝试 Expo Go。收到明确验收与开始 M1 的指令后，才实现设备配对、真实文字记录、可核验的记忆和持久化。本次在 M0 停止。
