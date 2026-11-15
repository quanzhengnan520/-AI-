# M0 工程决策记录

日期：2026-11-15。适用范围仅 M0；M1 需要用户验收并明确开始后实施。

1. **保留资料包作为项目根目录。** 源码位于 `SecondBrain_POC00_Codex_Package/`，原 ZIP 和合并版需求书保持在其上级目录；不把资料包平铺覆盖其他文件。
2. **采用 Expo SDK 57。** 初始化命令为 `create-expo-app@5.0.0 apps/mobile --template default@sdk-57 --no-install`。核验时官方正在 SDK 58 过渡，明确建议使用真机 Expo Go 的项目先选择 SDK 57。依赖由对应 SDK 的 `expo install` 校准，确切版本以 `apps/mobile/package-lock.json` 为准。[创建项目](https://docs.expo.dev/get-started/create-a-project/)、[Router 安装](https://docs.expo.dev/router/installation/)、[Jest 测试](https://docs.expo.dev/develop/unit-testing/)。
3. **双层 Mock，各自标明边界。** 手机默认从内存 Mock adapter 读取合成资料；后端提供独立的鉴权演示接口。不会为了演示页面自动向服务器发送输入。用户可以在设置中主动检查本地 `/health` 与 `/api/v1/meta`，这不启用 Live AI。
4. **只建工程数据库骨架。** SQLite WAL、SQLAlchemy 和 Alembic 用于工程元数据及迁移基线；记录、记忆、设备配对、幂等写入、持久队列和版本冲突的完整实现属于 M1 及之后。页面确认、提醒和计时操作为内存演示，重启可复位。
5. **本机开发鉴权。** 健康和无敏感信息的版本元数据公开；演示资源使用 Bearer 令牌。默认没有共享令牌，受保护接口默认拒绝。用户主动运行 `scripts/new-dev-token.ps1` 时随机生成本机测试令牌，后端只读取 SHA-256 哈希；原令牌只写入 Git 忽略的本机文件。正式设备配对、撤销和 SecureStore 接入留给 M1，不能把 M0 称为生产认证。
6. **禁用 Live 与真实权限。** M0 不包含真实云模型实现、不请求麦克风和通知权限、不上传音频。Live 开关不能绕过未实施的适配器。LLM 与 ASR 的接口独立，后续分别替换，不推断 Chat API 支持音频转写。
7. **默认只监听回环。** PowerShell 启动脚本默认 localhost；用户主动加 `-Lan` 才在可信局域网演示。没有创建隧道、开放公网、自动修改防火墙或安装系统服务。
8. **本地工具补足环境。** 当前 Node 24.22.1 可用，但 npm 未在 PATH、Python 为 Microsoft Store 无效别名。项目本地 `.tooling` 引入 npm 12.2.2，使用现有 Python 3.12.14 创建 `.venv`。安装脚本也支持标准 Node/npm/Python 安装，不依赖开发者的固定用户路径。依赖下载用于安装工具，不上传项目内容或用户资料。
9. **浏览器验证与真机验证分开。** Web 打包和浏览器中的手机尺寸交互可以验证 Router、页面状态及显示；不能验证 iOS 原生安装、麦克风、后台录音和系统通知。真机无测试记录时一律记“未测”。
10. **修复 SDK 57 的传递依赖漏洞。** Router 的 `query-string@7.1.3` 依赖旧 URL 解码器；上游[拒绝服务公告](https://github.com/advisories/GHSA-qr28-fpjm-wq7f)修复于 `decode-uri-component@0.5.1`。该修复版本采用 ESM，直接覆盖会破坏旧 CommonJS 调用，因此精确锁定版本，使用 `apps/mobile/scripts/patch-query-string.js` 在安装后严格匹配并适配一行默认导入。未知版本或源码会使安装失败，不能悄悄套错补丁；重复执行安全。保留中文、重复 key、损坏编码和证据深链回归；上游兼容升级后应移除补丁。没有进行跨 SDK 的强制 `audit fix`。

以上选择以最少可替换组件完成 M0。后续不自动引入向量库、Redis、付费服务或完整业务表。
