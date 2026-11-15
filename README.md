# 个人第二大脑 POC-00 · M1

Expo React Native / TypeScript 手机端、FastAPI API 和 SQLite 长期记忆库。M0 已通过用户初步验收；本次只交付 M1 的文字闭环，完成后等待验收，不进入 M2。

首页“文字工作区 · M1”进入持久化功能：文字创建、编辑、删除，人物/项目/事件关联，时间线与关键词检索，候选记忆审核，以及可以打开原文的检索回答。原四 Tab 的录音、提醒示例继续明确标记 M0 演示，数据与文字工作区独立。

默认 Mock 是确定性原文抽取，不代表语义理解准确率。当前 SQLite 和本机草稿未完成生产级加密，本轮开发和验收只使用虚构资料。

## Windows 安装与启动

建议 Node.js 24 LTS、Python 3.12 和 Git。在 PowerShell 进入项目目录：

```powershell
Set-Location 'D:\桌面\个人第二大脑项目\第一代开发版\SecondBrain_POC00_Codex_Package'
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup.ps1
```

安装脚本创建项目 Python 虚拟环境、安装锁定依赖、补足项目内 npm、复制不存在的环境文件并迁移数据库，不覆盖已有配置。Python 不可用时增加 `-PythonPath 'C:\Path\To\Python312\python.exe'`。安装依赖需要网络，默认 Mock 无需模型 Key 或 Apple 会员。

另开两个 PowerShell 窗口，都先进入项目目录，分别执行：

```powershell
# 窗口一：API，默认 127.0.0.1:8000
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-api.ps1
```

```powershell
# 窗口二：Expo Web，默认 localhost:8081，以终端实际端口为准
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-mobile.ps1 -Web
```

打开 [localhost:8081](http://localhost:8081)，点击“文字工作区 · M1”。关闭服务用各窗口的 Ctrl+C。旧 M0 服务需退出再启动，以加载新代码。

## 设备配对

在第三个窗口进入项目目录，生成一次性码：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-pairing-code.ps1
```

脚本仅显示新建本机文件路径。打开文件，把码填入工作区“配对设备”。配对码十分钟有效、单次使用；再次运行生成新文件。不要分享配对文件、服务端 .env 或 .artifacts。

服务端只保存设备令牌哈希。原生客户端把令牌存 SecureStore；Web 用当前标签页 sessionStorage，关闭会话后可能需要重新配对。退出配对不会删除服务端资料。旧 new-dev-token.ps1 仅用于 M0 演示接口，不能访问 M1 数据。客户端环境变量只放 API 地址，不能放供应商 Key。

手机与电脑处于可信私有 Wi-Fi 时，将 apps/mobile/.env 的 EXPO_PUBLIC_API_BASE_URL 改为电脑局域网 IPv4，例如 http://192.168.1.10:8000，重启 Expo，分别运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-api.ps1 -Lan
```

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-mobile.ps1 -Lan
```

Expo Go 扫描终端二维码。手机的 127.0.0.1 是手机自身。-Lan 开放监听地址，需由防火墙限制可信私有网络；不自动修改防火墙，不建公网隧道。HTTP 仅用于虚构资料开发。iPhone 真机、签名安装和原生安全存储尚待真机验收。

## 文字与证据

新建文字时输入原文、记录时间和人物/项目/事件。“仅保存本机草稿”不发送 API；“批准并同步文字”持久保存固定幂等键后才发送。失败时保留队列，联网后重试；刷新后草稿仍在。M1 支持离线新建草稿，服务端旧记录编辑需联网；版本冲突保留当前输入供处理。

打开记录后单独触发候选抽取。候选包含原记录和版本、逐字证据及位置、时间、确定性和审核状态。确认、驳回、修改均带版本；修改仍待审核，确认假设不会把假设改成事实。原文编辑后旧候选不再参与当前回答，但旧版本证据仍可定位。

问答按时间引用检索原文，没有证据时明确无法确认，不从金额推导审批结果。本次是保守关键词和原文回答，复杂语义、向量检索和跨记录推理不在 M1 范围。

删除需在页面明确确认，会清除该记录正文、历史版本、候选及关联，保留无正文墓碑避免幂等重放复活。SQLite 删除不等于对磁盘、WAL 或外部备份做取证级擦除。

## 检查与验收

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\check.ps1
.\services\api\.venv\Scripts\python.exe .\scripts\smoke_api.py
.\services\api\.venv\Scripts\python.exe .\scripts\smoke_m1.py
```

统一检查包含 Ruff、mypy、pytest、strict TypeScript、ESLint、Prettier、Jest 和 Expo 依赖检查。两个 Python 烟测用临时库和随机回环端口启动真实 Uvicorn，不污染本机业务库。M1 覆盖 M0 迁移、配对、预算故事、审核、冲突、删除、重启和幂等；不调用真实云模型。

Web 导出：

```powershell
. .\scripts\common.ps1
Initialize-NodeTools
Set-Location .\apps\mobile
npx.cmd expo export --platform web
```

可选浏览器回归依赖 Playwright 和已安装的 Edge，使用全新浏览器上下文。smoke_ui.cjs 保留 M0 回归。完整手工路线、数据库/API 变更、实际通过数与风险见 [当前进度](docs/PROGRESS.md) 和 [M1 验收记录](docs/M1_ACCEPTANCE.md)；M0 历史见 [M0 验收记录](docs/M0_ACCEPTANCE.md)。

## 配置与范围

根 .env.example 仅供后端，安装复制到 services/api/.env；默认 MOCK_MODE=true、LIVE_AI_ENABLED=false。真实 API Adapter 的参数与逐次授权要求见 [M1 决策](docs/11_M1_DECISIONS.md)。本轮用模拟传输验证 Live 协议，没有付费模型调用。

API 统一位于 /api/v1，后续 Windows、Android 和独立硬件可复用认证、记录、记忆、检索接口。当前单用户 POC 未实现音频/转写、后台任务、推送、自动保留清理、向量库、生产加密或公网部署。

原 AGENTS.md 与 docs/01–09 保持不变。M1 完成后停止，等待用户验收，不自行进入 M2。
