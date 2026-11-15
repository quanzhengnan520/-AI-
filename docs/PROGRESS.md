# M1 交付与验收记录

日期：2026-11-15（Asia/Shanghai）。用户已初步验收 M0 并明确授权 M1。范围仅为真实文字记录、候选长期记忆与有来源检索；M1 完成后停止，等待用户验收，M2 未启动。

## 当前状态

M1 实现、自动检查和本机 Web 操作验收已完成，**等待用户验收，M2 未启动**。分支 `feat/m1-text-memory`，M0 起点 `61395e1`。历史 M0 的30项后端、19项移动端及浏览器12项记录保存在 [M0_ACCEPTANCE.md](M0_ACCEPTANCE.md)。原规范保持不变。

M0 的30个后端用例继续运行；其中“业务路由尚不存在”随M1实现改为验证未配对401，旧迁移测试固定验证0001_m0，另加M1升级测试，未删除旧功能回归。移动端原19项保持通过。

## 实现范围

| 功能 | 实现与约束 |
|---|---|
| 文字记录 | 创建、编辑、明确确认删除、SQLite持久化、UTC时间、版本冲突、历史来源版本 |
| 手动关联 | 人物、项目、事件名称去重和共享实体关联，时间线、关键词检索与分页 |
| 候选抽取 | 默认确定性 Mock，服务端可替换 Live API Adapter，Schema和逐字锚点校验 |
| 证据与审核 | 来源记录/版本、精确引用/位置、时间、状态；确认/驳回/更正带乐观版本，修改仍待复核 |
| 有来源回答 | 原文按时间引用，可打开证据；没有依据明确无法确认；不推断审批成立 |
| 离线草稿 | 未加密本机持久存储、用户明确批准的不可变队列、固定幂等键、失败与重启恢复 |
| 设备接入 | 一次性配对码、持久设备令牌哈希、私有API鉴权；统一/api/v1供后续客户端复用 |
| 可追踪性 | 请求ID、无原文审计与最小模型用量日志；价格未知时为空，不虚构费用 |

## 数据库变更

Alembic `0001_m0 → 0002_m1`，保留 M0 `schema_state`，新增：

- `users/devices/pairing_codes/pairing_attempts`：单用户、设备认证、一次性码及限流。
- `source_records/record_versions`：原始文字、发生/保存时间、版本及历史快照。
- `entities/record_entities`：人物/项目/事件及记录关联。
- `memory_facts/memory_versions`：候选、来源版本、原文锚点、语气、确认状态与审核历史。
- `idempotency_entries`：同用户唯一键、请求摘要、记录ID；删除后保留无正文墓碑，拒绝复活。
- `audit_events/model_usage`：无原文的操作审计、请求关联和最小计量。

新增记录不会覆盖旧沟通。编辑使旧来源候选退出当前依据，旧版来源仍可定位。删除清理该记录正文、历史、派生记忆与孤立关联名称；不是磁盘安全擦除。30天保留字段仅为元数据，本阶段不自动清理。

## API 变更

所有成功为 `{data,request_id}`，错误为 `{error:{code,message,details},request_id}`。业务接口均需要配对设备 Bearer 令牌，M0演示令牌无权访问M1。

| 方法与路径 | 用途 |
|---|---|
| POST `/api/v1/auth/devices/pair` | 消费十分钟一次性码，发设备令牌 |
| GET `/api/v1/auth/devices`、DELETE `/{device_id}` | 列出本用户设备/撤销设备；撤销后令牌拒绝访问 |
| GET/POST `/api/v1/records` | 分页检索/创建；创建须UUID Idempotency-Key |
| GET/PATCH/DELETE `/api/v1/records/{id}` | 查看（含version参数）/带expected_version编辑/明确确认删除 |
| POST `/api/v1/records/{id}/extract` | 单独触发候选抽取；Live须逐次allow_live_ai |
| GET `/api/v1/memories`、`/{id}` | 候选检索与详情 |
| PATCH `/api/v1/memories/{id}` | 带版本确认、驳回、更正 |
| POST `/api/v1/queries` | 有原文引用的保守检索回答 |
| GET `/api/v1/entities` | 分页列出人工关联实体 |
| GET `/api/v1/records/{id}/versions`、`/api/v1/memories/{id}/versions` | 记录版本目录/记忆审核历史 |
| GET `/health`、`/api/v1/meta` | 保留无敏感数据探针和模式元数据 |

准确实现与配置见 [11_M1_DECISIONS.md](11_M1_DECISIONS.md)，启动见 [README](../README.md)，手工验收见 [M1_ACCEPTANCE.md](M1_ACCEPTANCE.md)。

## 验证结果

| 检查 | 实际结果 |
|---|---|
| 后端 pytest | **111通过，0失败**：M0 30 + Provider 57 + 检索7 + API边界16 + 迁移1 |
| 移动端 Jest | **8套/54通过，0失败**：保留M0 19项，新增35项 |
| 后端 Ruff lint/format、mypy | 通过；32个Python文件格式检查，22个实现文件类型检查 |
| strict TypeScript、ESLint、Prettier | 通过；统一检查脚本由Windows PowerShell5.1执行，退出码0 |
| Expo SDK依赖/Web导出 | 通过；SDK57兼容检查，实际生成Web dist |
| M0真实HTTP烟测 | **6通过**；新M1服务代码仍支持旧健康/Mock/鉴权/错误契约 |
| M1真实HTTP和进程重启 | **12通过**；临时SQLite、随机回环端口、真Uvicorn |
| M0浏览器回归 | **12通过**；更新后API/Expo上复核原演示交互 |
| M1浏览器操作验收 | **9通过**；Edge全新上下文、440×956，真实页面/API/独立临时库 |
| SQLite迁移 | M0→M1→M0→M1通过，保留M0元数据；冻结迁移不依赖未来ORM模型 |
| Windows配对脚本 | PS5.1隔离库执行通过，唯一文件、无凭据回显，测试码文件随后删除 |
| pip check | 通过；Windows时区tzdata安装后Asia/Shanghai可用 |
| npm audit生产依赖 | 0 critical、0 high；3 moderate、8 low尚存，未用强制大版本升级破坏Expo兼容 |
| 实际云模型/iPhone真机 | **未测**，未发生真实模型调用或费用 |

必测预算场景：三条原文与三次时间独立保存，关联同一人物/项目/事件；检索返回3条逐字引用，可点开高亮；回答明确不能据原文确认未被支持的结论，不生成“200万元预算曾获批准”，150万元不删除旧记录。候选被驳回或修改，不会抹去原始沟通历史。

额外覆盖：原文空白/emoji保真、配对失效/过期/限流、跨用户隔离、6个并发相同键请求只建1条、旧版本409、显式null拒绝、模型错误/伪造锚点、抽取期间原文变更拒绝旧候选但保留用量日志、删除正文与版本/派生/孤立实体、服务端重启、离线刷新恢复及响应已提交但丢失后的幂等重试。

收尾复核增加组合请求体大小检查：中文正文与多个关联名虽然各字段合法，合计仍可能超过默认32KiB。现在客户端在入队前提示缩短/拆分并保留输入，避免无效内容进入不可变发送队列；该项已纳入第54个移动端测试。

全部输入为虚构资料。浏览器操作验收由脚本驱动，已检查实际截图；不冒充人工iPhone真机测试。1条上游Starlette/HTTPX弃用提示未影响测试。首次HTTP验收发现测试脚本未关闭SQLite句柄，已修正并以退出码0重跑。

本机验证产物在Git忽略的 `.artifacts/verification/m1/`：`check.txt`、`http-smoke.txt`、`http-server.log`、`ui-smoke.txt`、`ui-server.log`、`web-export.txt`、`migration-freeze.txt`、`windows-pairing-script.txt`、`npm-audit.json`；截图为`record-and-extraction.png`、`memory-review.png`、`sourced-answer.png`、`offline-recovered.png`。M0回归产物仍在上一级verification目录。日志不含配对码、令牌或原始私人资料。

## 风险与未测项

- 当前无生产级SQLite、WAL、备份或草稿加密；不可用于真实敏感数据。
- iPhone16 Pro Max/Expo Go、SecureStore原生行为、系统断网与杀进程未接实际设备验证；Web通过不等于iOS通过。
- Live Adapter仅用MockTransport验证，真实供应商兼容性、质量、计费未实测。
- 中文关键词检索和Mock逐句抽取存在语义漏召回，不具备M3跨记录自动冲突判断或向量检索能力。
- 单用户本地POC，局域网HTTP仅虚构资料开发；未交付公网HTTPS、多租户或生产部署。
- 离线新建草稿可恢复；旧服务端记录编辑需联网。已批准发送的正文锁定，以防响应丢失后改变幂等请求；错误需人工重试/处理。
- Web草稿队列当前仅支持单标签页操作，尚无跨标签页写入锁；同时打开多个实例编辑草稿可能发生覆盖。本轮按单实例验收。
- 检索最多扫描最新1000条记录、返回20条引用，每条最多2000字符；局限在答案中明示，不将未命中当成“历史上从未发生”。
- 移动端按默认32KiB限制单条文字请求，较长内容需拆分；若部署者手工降低服务端请求上限，需同步调整客户端约束。分页为本地POC的偏移游标，翻页期间持续新增可能造成跨页重复。
- 未实现录音、ASR、后台Worker、提醒、自动保留清理或导出；未进入M2。

## Git 与停止点

实现与验收已完成，提交ID在最终记录中补充。无远端推送。此次并行代理中途触发使用额度限制，已由主代理接手后端挂载、补充测试与全部最终联调，未将中途代码当作完成。当前停在M1，等待用户验收。
