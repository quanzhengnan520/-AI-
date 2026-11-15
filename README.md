# 个人第二大脑 POC-00 · M0

面向 iPhone 16 Pro Max 的 Expo / React Native / TypeScript 演示客户端，以及 FastAPI / SQLite 后端骨架。当前仅交付 **M0**，完成后等待验收；尚未实现真实记录、语音识别和 AI 记忆能力。

页面始终标记“演示数据 / Mock”：今天、记录列表与详情、记忆列表与详情、问一问、提醒、设置，以及模拟录音浮层。演示交互仅保存在当前会话，刷新或重启后复位；不请求麦克风或通知权限，不上传输入，不调用云模型。

## Windows 首次安装

在 PowerShell 中切换到本 README 所在目录。建议 Node.js 24 LTS、Python 3.12、Git；M0 不需要 Expo/EAS 全局安装、Mac、Apple 开发者会员或模型 API Key。

```powershell
Set-Location 'D:\桌面\个人第二大脑项目\第一代开发版\SecondBrain_POC00_Codex_Package'
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup.ps1
```

此命令创建本项目 `.venv`、安装锁定的前后端依赖、复制不含密钥的环境模板并执行 Alembic 迁移；不会覆盖已有 `.env`。如果 Node 可用但 npm 缺失，会把 npm 12.2.2 下载到本项目 `.tooling`，校验官方包完整性，不修改系统 PATH。仅安装依赖需要网络，启动后的默认 Mock 演示不需要模型联网。

如果 Python 尚未加入 PATH，可指定本机安装路径：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup.ps1 -PythonPath 'C:\Path\To\Python312\python.exe'
```

## 启动与验收

开两个 PowerShell 窗口，都先进入项目目录。

窗口一启动本地后端（默认 `127.0.0.1:8000`，不会开放公网）：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-api.ps1
```

窗口二启动浏览器预览（默认 localhost）：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-mobile.ps1 -Web
```

Expo 会显示开发地址，默认 Web 为 [localhost:8081](http://localhost:8081)。如果端口已占用，请使用终端显示的端口。关闭服务用各自窗口的 `Ctrl+C`。移动端默认使用本地 Mock，后端暂时未启动也可浏览演示页面。

本机 API 检查：

```powershell
Invoke-RestMethod 'http://127.0.0.1:8000/health'
Invoke-RestMethod 'http://127.0.0.1:8000/api/v1/meta'
```

设置页点击“检查连接”才会访问 `apps/mobile/.env` 中 `EXPO_PUBLIC_API_BASE_URL` 指定的上述接口；这是本地工程连接检查，不会切换成真实 AI。更改 Expo 环境变量后重启开发服务器。服务器如需要允许不同 Web 来源，应显式配置 CORS 精确来源，不能填任意公网地址。

使用 iPhone 上的 Expo Go 时，手机与电脑须在可信私有 Wi-Fi。用户主动选择局域网启动：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-mobile.ps1 -Lan
```

使用 iPhone 相机或 Expo Go 扫描 Expo 显示的二维码。M0 演示不需要手机连接后端。若还需手机点击“检查连接”，将 `apps/mobile/.env` 中 API 地址改为电脑的局域网 IPv4（例如 `http://192.168.1.10:8000`），再在另一个终端运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-api.ps1 -Lan
```

手机里的 `127.0.0.1` 是手机自身。后端 `-Lan` 会监听所有网卡（`0.0.0.0`），需由电脑防火墙限制访问；脚本不会自动识别私有网卡或更改防火墙。防火墙如有提示，只在你信任的私有网络允许所需端口，不关闭整个防火墙。此 HTTP 方式仅用于合成数据的可信局域网开发；不创建隧道。Expo Go、iOS 网络权限和原生行为仍需你在真机上验收，目前没有声称真机已通过。

## 最小鉴权示例

`/health`、`/api/v1/meta` 仅返回无敏感信息的探针与版本元数据。`/api/v1/demo` 返回明确标记的合成资源，需要本机设备令牌；未配置时拒绝访问。普通 UI 演示不需要此令牌。

用户主动验证鉴权时，运行一次：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-dev-token.ps1
# 然后重启后端，使新的哈希生效
$deviceToken = [IO.File]::ReadAllText((Join-Path (Get-Location) '.artifacts\dev-device-token.txt'))
Invoke-RestMethod 'http://127.0.0.1:8000/api/v1/demo?limit=2' -Headers @{ Authorization = "Bearer $deviceToken" }
Remove-Variable deviceToken
```

原始令牌不会打印到终端；只保存在本机 `.artifacts/dev-device-token.txt`，服务端 `.env` 只写入其 SHA-256 哈希。不要分享该文件或把令牌填入 `EXPO_PUBLIC_*`。再次生成需显式 `-Rotate`，会使旧令牌失效。这是 M0 本机测试能力，安全设备配对与撤销流程属于 M1。

## 自动检查

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\check.ps1
.\services\api\.venv\Scripts\python.exe .\scripts\smoke_api.py
```

第一条依次执行后端 Ruff 格式/lint、mypy、pytest，以及移动端 strict TypeScript、ESLint、Prettier、Jest 和 Expo SDK 依赖检查。第二条在回环地址的临时端口启动真实 Uvicorn，用临时 SQLite 和随机临时令牌检查 API，然后关闭子进程；不会使用你的真实资料或修改本机服务配置。

如果希望检查 Web 打包，在项目根运行：

```powershell
. .\scripts\common.ps1
Initialize-NodeTools
Set-Location .\apps\mobile
npx.cmd expo export --platform web
```

实际通过数、浏览器截图、未测试项目见 [docs/PROGRESS.md](docs/PROGRESS.md)。Jest/浏览器测试只能证明演示交互，不能证明真实模型或 iOS 后台能力。

逐文件交付清单见 [docs/M0_FILE_MANIFEST.md](docs/M0_FILE_MANIFEST.md)。

仓库另含可选的 `scripts/smoke_ui.cjs` 浏览器回归：需要 Playwright 和已安装的 Microsoft Edge，并先启动本地 API 与 Expo Web，再运行 `node .\scripts\smoke_ui.cjs`。本次使用现有工具环境提供的 Playwright，打开全新临时浏览器会话，不读取你的私人浏览器资料；运行结果与截图写入 `.artifacts/verification`。普通安装与手工验收不要求此工具。

## 手工验收路线

1. “今天”进入“开始记录”，确认 Mock 提示，演示开始、暂停、继续、结束；确认界面没有声称已保存真实录音。
2. 切换“记录”，搜索并打开记录详情；进入相关记忆，打开证据并查看高亮原文。
3. “记忆”筛选并打开详情，演示确认或驳回；观察状态变化。
4. “问一问”选择示例预算问题、打开答案引用；输入无关问题，观察“无法确认”的提示。
5. “提醒”确认候选待办并标记完成；系统不发送通知。
6. “我的”调整演示设置、主动检查后端连接；确认 Live 和真实数据操作未开放。刷新页面，确认说明中的会话复位行为。

## 文件与边界

```text
apps/mobile/       Expo Router 页面、共享组件、内存状态、Mock / HTTP adapter、测试
services/api/      FastAPI、配置、SQLite / Alembic、LLM / ASR 接口、测试、依赖锁
scripts/           Windows 安装、启动、检查、本机演示令牌、API 进程烟测
fixtures/          原资料包的纯合成场景
docs/01–09         原研发规范
docs/10_M0_DECISIONS.md   当前工程选择与理由
docs/PROGRESS.md   实际验收、检查结果、已知限制
.env.example       仅服务端配置模板；不含模型密钥
```

SQLite 默认为普通本机数据库，未实现端到端加密。仅使用可信电脑和受控目录；运行目录、`.env`、令牌、日志、构建文件均已被 Git 忽略。M0 没有导出、真实删除、离线持久同步、ASR、云模型、设备配对或推送，不把演示按钮当成这些能力。

下一步由你验收 M0 后决定是否进入 M1：设备配对、真实文字记录、可核验的记忆与持久化。当前不自动开展 M1。
