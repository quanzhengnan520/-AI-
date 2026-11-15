# 03｜数据结构、证据规则和 HTTP API

> 本文是逻辑契约；字段命名、含义和状态可由 Codex 细化成 Pydantic Schema / Alembic，但**不能擅自移除来源、时间、版本、确认状态、删除语义**。

## A. 通用约定
- 路由前缀：`/api/v1`；JSON；UTF-8。所有 ID 为 UUID v4（或一致的 UUIDv7）；时间统一 UTC ISO8601 带 `Z`，客户端按配置时区展示。
- 成功：`{"data": ..., "request_id":"..."}`；失败：`{"error":{"code":"...","message":"...","details":{}},"request_id":"..."}`。
- 默认使用单用户设备令牌 `Authorization: Bearer <device_token>`；未授权 401；无权限 403；找不到 404；版本冲突 409；校验错误 422；限流 429；服务器错误 5xx。
- 新建记录和上传接受 `Idempotency-Key`，重复请求返回同一资源（有可定义的 TTL）；所有可变对象包含 `version`，客户端提交 `expected_version` 以避免静默覆盖。
- 列表采用 `limit/cursor`，默认 20，最大 100；列表不直接返回巨大转写全文或音频二进制。
- 每条事实**必须有** `source_record_id` 和有意义的 `evidence_anchor`（片段/字符位置或明确“用户手动输入原文”）。未校验的外部猜测不能写入高置信记忆。

## B. 数据表（最小必要字段）
1. `users`：`id, locale, timezone, created_at, status`（首版仅一位使用者，仍允许未来扩展）。
2. `devices`：`id, user_id, token_hash, name, platform, revoked_at, last_seen_at, created_at`；只存令牌哈希。
3. `source_records`：`id,user_id,kind(text|audio|import),title,body_text?,audio_storage_key?,sha256?,captured_at,timezone,status(draft|saved|queued|processing|ready|failed|deleted),consent_confirmed,consent_note?,retention_days=30,expires_at,created_at,updated_at,deleted_at,version`。
4. `transcript_segments`：`id,record_id,speaker_label?,start_ms?,end_ms?,text,asr_confidence?,revision,created_at`；人物身份与 speaker 标签不得无依据自动等同。
5. `entities`：`id,user_id,kind(person|organization|project|place|other),display_name,aliases_json,created_at,updated_at,version`。
6. `memory_facts`：`id,user_id,entity_id?,subject,predicate,object_text,modality(assertion|plan|proposal|hypothesis|question),attribution_speaker?,event_time?,valid_from?,valid_to?,recorded_at,source_record_id,evidence_segment_id?,evidence_start_char?,evidence_end_char?,evidence_excerpt?,excerpt_retention_consent,status(candidate|needs_review|verified_by_user|rejected|superseded),certainty(high|medium|low),reasoning_note?,created_at,updated_at,deleted_at,version`。`certainty` 是机器不确定度标签，不等于真实性。
7. `memory_versions`：`id,fact_id,version,snapshot_json,changed_by(user|system),reason,created_at`。
8. `events`：`id,user_id,kind,occurred_at,summary,entity_refs_json,source_record_ids_json,created_at`。
9. `tasks`：`id,user_id,title,description?,due_at?,timezone,status(proposed|confirmed|done|cancelled),source_fact_ids_json,source_record_id?,created_at,updated_at,version`。
10. `reminders`：`id,user_id,task_id?,trigger_at,channel(local|push_future|in_app),enabled,quiet_hours_policy,notification_privacy_mode,status,created_at,updated_at`。
11. `change_candidates`：`id,user_id,old_fact_id,new_fact_id,classification(change_over_time|possible_contradiction|clarification|insufficient_context),explanation,evidence_ids_json,confidence,status(pending|confirmed|dismissed),created_at`。
12. `jobs`：`id,user_id,type,record_id?,idempotency_key?,status,attempt,lease_until?,payload_ref?,result_ref?,safe_error_code?,created_at,updated_at`。
13. `model_usage`：`id,request_id,user_id,provider,model,task_type,input_tokens?,output_tokens?,audio_seconds?,estimate_cost?,currency,price_config_version,created_at`。
14. `audit_events`：`id,user_id,actor,operation,target_type,target_id,request_id,created_at,metadata_redacted_json`。
15. `deletion_requests`：`id,user_id,scope,status,requested_at,completed_at?,summary_json`。首次可简单实现，但必须可追踪删除范围。

### 证据锚点原则
- 音频转写：每条记忆引用 `record_id + segment_id + [start_ms,end_ms]`；正文引用也可附字符范围。
- 手动文字：`record_id + [start_char,end_char]`，UI 展示对应原文。
- 来源删除：`evidence_status=original_deleted`，只有独立明确授权保留的摘录才允许显示；不能返回已删除音频可播放链接。
- 抽取/回答由模型生成时，服务端校验引用 ID 属于用户、实际存在、支持指定记录；来源不足则保守地降级。

## C. 核心 API 清单（M0 只需实现健康/样例/Mock）
| Method | Endpoint | 含义 | 最早阶段 |
|---|---|---|---|
| GET | `/health` | 存活探针，不泄露系统细节 | M0 |
| GET | `/api/v1/meta` | API 版本、Mock/Live 模式（无密钥） | M0 |
| POST | `/api/v1/auth/devices/pair` | 首版安全配对（服务器生成一次性码，用户确认） | M1 |
| POST | `/api/v1/records` | 建立文字或音频元数据记录 | M1 |
| GET | `/api/v1/records` | 游标记录列表和过滤 | M1 |
| GET | `/api/v1/records/{id}` | 记录详情、状态、证据段 | M1 |
| PATCH | `/api/v1/records/{id}` | 用户编辑记录标题/转写等（留版本） | M1/M2 |
| DELETE | `/api/v1/records/{id}` | 受控删除与派生影响提示 | M1/M4 |
| POST | `/api/v1/records/{id}/audio` | 文件上传，大小/MIME/音频时长校验 | M2 |
| POST | `/api/v1/records/{id}/process` | 转写与候选记忆异步处理 | M2/M3 |
| GET | `/api/v1/jobs/{id}` | 处理任务状态 | M2 |
| GET | `/api/v1/memories` | 有时间、人物、状态过滤的事实列表 | M1/M3 |
| GET | `/api/v1/memories/{id}` | 事实和证据详情 | M1/M3 |
| PATCH | `/api/v1/memories/{id}` | 用户确认/纠正/撤销，版本检查 | M3 |
| GET | `/api/v1/entities` | 人物/项目列表 | M3 |
| POST | `/api/v1/queries` | 有引文的历史问答 | M3 |
| GET | `/api/v1/changes` | 跨时间候选变化/冲突 | M3 |
| POST | `/api/v1/changes/{id}/review` | 确认/驳回候选 | M3 |
| GET/POST/PATCH | `/api/v1/tasks` | 任务提议/确认/完成 | M4 |
| GET/POST/PATCH | `/api/v1/reminders` | 用户控制的本地提醒调度 | M4 |
| GET | `/api/v1/usage` | 计量与费用汇总 | M3 |
| POST | `/api/v1/data/export` | 个人数据导出作业 | M4 |
| POST | `/api/v1/data/delete` | 删除范围与确认请求 | M4 |
| GET/PATCH | `/api/v1/settings` | 记录保留、静默时段、权限、模型模式 | M1/M4 |

## D. 代表性请求/响应（供 Codex 建契约测试）

### 1. 新增文本记录
```
POST /api/v1/records
Authorization: Bearer <device_token>
Idempotency-Key: <uuid>
Content-Type: application/json
{"kind":"text","title":"项目预算沟通","body_text":"王总说项目预算预计200万元，尚未正式审批。","captured_at":"2026-10-15T06:00:00Z","timezone":"Asia/Shanghai","consent_confirmed":true}
```
响应：
```
{"data":{"id":"<uuid>","kind":"text","status":"saved","version":1,"created_at":"2026-10-15T06:00:01Z"},"request_id":"<uuid>"}
```
### 2. 历史问答
```
POST /api/v1/queries
{"question":"王总的预算是否已经批准？","filters":{"entity_names":["王总"]},"include_uncertainty":true}
```
响应：
```
{"data":{"answer":"现有记录不能证明预算已批准。10月记录仅表述‘预计200万元、尚未正式审批’。","certainty":"supported_with_limits","citations":[{"record_id":"<uuid>","segment_id":null,"start_char":0,"end_char":26,"evidence_status":"available"}],"limitations":["缺少正式审批结果记录"]},"request_id":"<uuid>"}
```
### 3. 用户审核事实
```
PATCH /api/v1/memories/<id>
{"expected_version":2,"review_action":"verify","corrected_object_text":null,"review_note":"仅确认王总说过这句话，不确认审批结果"}
```
响应中事实新版本为 3，审计事件写入；冲突版本返回 HTTP 409。

### 4. 变化候选
```
{"old_fact_id":"<uuid>","new_fact_id":"<uuid>","classification":"change_over_time","explanation":"10月预计200万元；11月最新口头考虑150万元；10月预算尚未审批。属于表述变化，不足以认定违约。","status":"pending"}
```

## E. 检索和模型输出协议
- 内部 `FactCandidate` JSON 必须含：`subject/predicate/object/modality/attribution/event_time/evidence_anchor/uncertainty`，字段缺失、证据越界或 ID 不存在就退回 `needs_review`。
- Query 返回的 `citations` 在服务端二次验证，每一条引用都能在授权范围打开；无证据时 `citations: []` 且 `certainty: insufficient_evidence`。
- 历史时间信息不可混淆：`recorded_at` 是什么时候记录的，`event_time` 是内容所说事件的日期，`valid_from/to` 是事实适用区间。
- 无法确定说话者真实身份时，只可存 `speaker_label=Speaker_1`，不能自动映射到人物档案。

## F. 删除规则和测试契约
- 删除音频/原始转写时，更新所有记忆证据可用状态；若另外同意保留摘录，则继续显示摘录和独立留存告知；如没有，不可再显示原文。
- 删除全部数据，必须清理用户实体、facts、versions、记录、音频文件、转写、索引、缓存、导出临时文件、未运行作业、推送 token 与派生信息；记录最小必要的去标识审计摘要（是否保留需合规复核）。
- 物理删除与备份删除可能存在延迟，UI/文档应如实标记，不说“立即从所有备份消失”。
