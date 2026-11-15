# 02｜技术架构与工程约束

## A. 单人 POC 的系统边界

```
[iPhone App: Expo/React Native/TypeScript]
  │ 用户输入/本地录音/播放/Local Notifications
  │ HTTPS（开发阶段可在可信局域网调试；对外开放必须 TLS + 鉴权）
  ▼
[FastAPI /api/v1 ：认证、任务、记录、记忆、查询]
  ├─ [SQLite WAL + Alembic]：结构数据/事实/版本/审计/成本
  ├─ [受控文件存储]：原始音频、导出、定时清理
  ├─ [Worker：持久作业队列]：转写、抽取、冲突候选、清理
  ├─ [LLM Adapter]：Mock + 可配置 OpenAI-compatible Chat
  ├─ [ASR Adapter]：Mock/本地转写/支持转写的第三方 API
  └─ [Evidence / Search Engine]：事实过滤、中文搜索、来源校验
           ▼
[未来的独立 4G 智能硬件] 复用 /api/v1 协议，另有设备认证与音频传输
```

设计原则：**可替换模型、证据先行、可控成本、Windows 开发、未来可扩展，而不是今天上微服务。**

## B. 推荐技术栈
- 客户端：React Native + Expo（使用创建时稳定兼容的当前 SDK）+ TypeScript strict + Expo Router + `expo-audio` + `expo-file-system` + `expo-secure-store` + `expo-notifications`；组件库可选择简单稳定方案，界面简洁中文。
- 客户端本地：录音文件存应用持久 document 目录；少量 token 存 SecureStore；草稿/同步队列按需求使用 expo-sqlite；绝不把 API Key 打进 iOS 包。
- 服务端：Python 3.12（或目前兼容的稳定版本） + FastAPI + Pydantic v2 + SQLAlchemy 2 + Alembic + SQLite WAL；开发调试可用 uvicorn。
- 作业：首版 SQLite `jobs` 表 + 独立 Worker 轮询和租约重试；不依赖 Web 请求线程执行长时音频/LLM 作业，也不先装 Redis/Celery。
- 测试：pytest/HTTPX（后端）、Vitest/Jest + React Native Testing Library（以 Expo 兼容为准）、API 契约和端到端人工验收。
- 时间：数据库全部 UTC，保存用户时区（默认 Asia/Shanghai、可设置），UI 显示本地；音频相对时间 `start_ms/end_ms`。

## C. 具体目录建议
```
secondbrain/
  apps/mobile/             # Expo App，screens、components、hooks、services、types
  services/api/
    app/main.py            # FastAPI app
    app/routers/           # versioned endpoints
    app/models/            # SQLAlchemy models
    app/schemas/           # Pydantic contracts
    app/services/          # ingestion, memory, search, conflict, reminders
    app/providers/         # llm/, asr/, mock/
    app/worker.py          # durable job runner
    app/security/          # auth/permission/crypto
    migrations/            # Alembic
    tests/
  fixtures/                # 完全虚构的可复现数据
  docs/                    # 架构/运行/进度/测试记录
  .env.example
  README.md
```

## D. 模型层
1. **LLM 是可替换能力，不是记忆数据库**。所有原始记录、候选抽取、确认状态与引用都必须落在自己的受控数据库中。
2. `LLMProvider` 抽象：`complete_structured(prompt, schema, context, request_id)`，输出必须 JSON Schema 校验；失败要报错/重试/降级，不把模型自由发挥的文本直接写入真值表。
3. `ASRProvider` 独立于 LLM。OpenAI-compatible Chat API **不保证**包含 audio transcription；优先 Mock + provider adapter，并由 Codex 列出已测试兼容性。无可用 ASR 时仍能文字记录和验证记忆。
4. `EmbeddingsProvider` 作为可选增强；默认先 SQLite 结构化过滤 + 中文全文检索。SQLite FTS5 的分词不一定适合中文，先做可复现检索实验：优先 FTS5/trigram 兼容性探测，缺失时做中文分词入索引或降级为可解释的 keyword+entity 匹配。不能假装英语 tokenizer 自动做好中文语义检索。
5. QA 流程：解析问题 → 检索有权限的记录/事实 → 按实体、时间、状态重排 → 构造**有限的证据上下文** → LLM 生成含引用 ID 的答案 → 服务端验证引用是否存在、确实支持说法 → 返回答案+依据+不确定性；证据不足直接拒绝猜测。
6. 事实流程：一次输入 → 字幕/分段（如音频） → 事实/人物/承诺候选 → 证据 span 校验 → 去重与关联 → 标为待核实/候选 → 冲突和时间变化分类 → 用户确认/驳回。

## E. 可靠作业处理
- `POST /records`、`POST /uploads` 支持客户端 `Idempotency-Key`。
- 音频上传后返回 `record_id/job_id` 与 `queued`；worker 后台处理，App 轮询 GET job 状态，最长等待和超时提示由 UI 提供。
- job 状态：queued/running/succeeded/failed/cancelled；重试最多 3 次（参数可配置），失败保留安全错误码，不反复上传原始资料。
- Worker 意外退出需恢复 expired lease；幂等写 facts 与 segments，避免生成重复记忆。
- 网络中断：App 本地记录与等待同步标识、可取消/重试；仅上传用户明确许可的记录。

## F. 同步和未来硬件
- App 与后端用稳定 `/api/v1`；不将数据模型绑定手机操作系统。未联网时可本地录音/草稿/部分缓存查看，不能离线调用纯云端大模型。
- POC 单用户单设备，不实现完整跨端实时同步；但所有对象采用 UUID、`updated_at`、`version`、`deleted_at` 和时区，以便以后多端一致性处理。
- 未来设备需求单独定义：设备证书/令牌、独立蜂窝连接、分段传输、设备时间校准、未传成功缓存、远程擦除、OTA 与功耗指标。**不能因为手机 5G 网络能使用，就认为 4G 工程产品已验证。**

## G. 部署与开发策略
- M0/M1：Windows 本地后端 + iPhone/Expo 开发体验；Mock 模式默认启动。若通过局域网访问，需要手机与 PC 同网络、Windows 防火墙允许特定端口，并核查 iOS ATS 等限制。**不得把未鉴权的 HTTP API 暴露到公网。**
- 真机远程访问：优先部署有 TLS/鉴权的受控临时环境，限制真人数据；若仅用隧道演示，必须保护访问、服务端鉴权、禁止 debug 输出原文。
- iOS 的 `expo-audio` 后台录音需 config plugin `enableBackgroundRecording: true` 和运行时 `allowsBackgroundRecording: true`，需要**重建开发客户端/安装包**才生效；只在用户主动录音时启用，苹果系统中断/杀进程行为必须真机测试。
- Expo Go 适合初期可视化/部分功能，不足以证明签名能力、原生配置和后台行为；不要用 Expo Go 成功等同独立安装包成功。
- Windows 上可通过 EAS Build 云端构建 iOS。对受控 iPhone 安装 ad hoc build 一般需付费 Apple Developer membership、设备注册/签名；无此账号时先继续 PC + Expo Go/Mock 验证，不阻塞产品代码编写。

## H. 成本可观测性
每次调用记录 provider、model、任务类型、开始/结束时间、token/音频计量（如提供）、成功/失败、估算费用货币和**价格配置版本**。不在源代码硬编码模型价格，不假装“本地模型完全零成本”。提供每日/累计费用面板，达到预算阈值由用户确认是否继续。
