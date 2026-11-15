# 给 Codex 的第一条开发指令（复制本文件以下内容）

你现在是本项目的技术负责人和全栈工程师。请完整阅读仓库根目录 `AGENTS.md`、`00_START_HERE.md` 和 `docs/01_PRODUCT_PRD.md` 至 `docs/09_OFFICIAL_REFERENCES.md`。这是一个最终面向**独立联网 AI 智能硬件**的“个人第二大脑”产品，当前使用 **iPhone 16 Pro Max** 作第一版软硬结合验证，开发机是 Windows 11。

**现在只做 M0，不要直接做完整 App。**

请先检查环境、扫描已有项目文件，然后按 `docs/04_IMPLEMENTATION_PLAN.md` 的 M0 验收标准搭建 Expo React Native/TypeScript + FastAPI/SQLite 工程骨架，并实现带清楚 Mock 标签的可交互移动端页面：首页、记录、记忆、问答、提醒、设置。后端实现 `/health`、`/api/v1/meta` 与规范错误结构，Mock provider 与未来真实 Provider 接口分离。默认不需要云模型 API Key、苹果开发者账户或远端服务器。

请设置自动化测试、格式/类型检查、README 的 Windows PowerShell 启动步骤与 `.env.example`；不要把个人资料、密钥、日志或音频上传至外部服务。执行当前环境能运行的检查并写出真实测试结果，无法执行的注明原因。完成后更新 `docs/PROGRESS.md`，按文件清单、启动命令、验证步骤、已知问题和下一步依赖向我汇报，**然后暂停等待我验收 M0**，不要主动展开 M1。

如果规范有少量实现细节不明确，请做最简单可替换的工程选择并写入决策记录；只有涉及付款、账号、真实隐私数据、公开服务或破坏性操作时才必须向我询问。
