# M1 修改文件清单

范围：M0基线61395e1之后，仅M1。A=新增，M=修改；未改动原AGENTS.md与docs/01–09。

移动端新增文字工作区与持久同步，保留M0演示；后端增加设备、记录、证据记忆与检索；脚本/夹具负责隔离验收；文档记录实际结果与限制。

| 类型 | 文件 |
|---|---|
| M | `.env.example` |
| M | `README.md` |
| M | `apps/mobile/.env.example` |
| M | `apps/mobile/README.md` |
| A | `apps/mobile/__tests__/outbox.test.ts` |
| A | `apps/mobile/__tests__/workspace-api.test.ts` |
| A | `apps/mobile/__tests__/workspace-fixtures.ts` |
| A | `apps/mobile/__tests__/workspace-screens.test.tsx` |
| A | `apps/mobile/__tests__/workspace-storage.test.ts` |
| M | `apps/mobile/app.json` |
| M | `apps/mobile/package-lock.json` |
| M | `apps/mobile/package.json` |
| M | `apps/mobile/src/app/(tabs)/index.tsx` |
| M | `apps/mobile/src/app/_layout.tsx` |
| A | `apps/mobile/src/app/workspace/_layout.tsx` |
| A | `apps/mobile/src/app/workspace/ask.tsx` |
| A | `apps/mobile/src/app/workspace/editor.tsx` |
| A | `apps/mobile/src/app/workspace/index.tsx` |
| A | `apps/mobile/src/app/workspace/memories.tsx` |
| A | `apps/mobile/src/app/workspace/memory/[id].tsx` |
| A | `apps/mobile/src/app/workspace/pair.tsx` |
| A | `apps/mobile/src/app/workspace/record/[id].tsx` |
| M | `apps/mobile/src/components/ui.tsx` |
| A | `apps/mobile/src/components/workspace-ui.tsx` |
| A | `apps/mobile/src/services/outbox.ts` |
| A | `apps/mobile/src/services/workspace-api.ts` |
| A | `apps/mobile/src/services/workspace-state.tsx` |
| A | `apps/mobile/src/services/workspace-storage.ts` |
| A | `apps/mobile/src/types/workspace.ts` |
| A | `docs/11_M1_DECISIONS.md` |
| A | `docs/M0_ACCEPTANCE.md` |
| A | `docs/M1_ACCEPTANCE.md` |
| M | `docs/PROGRESS.md` |
| A | `fixtures/m1_budget_story.json` |
| M | `scripts/check.ps1` |
| A | `scripts/new-pairing-code.ps1` |
| A | `scripts/smoke_m1.py` |
| A | `scripts/smoke_m1_ui.cjs` |
| A | `services/api/app/auth.py` |
| M | `services/api/app/config.py` |
| A | `services/api/app/contracts.py` |
| M | `services/api/app/main.py` |
| A | `services/api/app/manage.py` |
| M | `services/api/app/middleware.py` |
| A | `services/api/app/models.py` |
| M | `services/api/app/providers/live.py` |
| A | `services/api/app/providers/memory.py` |
| A | `services/api/app/query.py` |
| M | `services/api/app/routers/system.py` |
| A | `services/api/app/routers/workspace.py` |
| M | `services/api/app/schemas.py` |
| A | `services/api/app/store.py` |
| M | `services/api/migrations/env.py` |
| A | `services/api/migrations/versions/0002_m1_text_memory.py` |
| M | `services/api/pyproject.toml` |
| M | `services/api/requirements.lock` |
| M | `services/api/tests/test_api.py` |
| A | `services/api/tests/test_m1_api.py` |
| A | `services/api/tests/test_m1_providers.py` |
| A | `services/api/tests/test_m1_query.py` |
| M | `services/api/tests/test_migrations.py` |
| A | `docs/M1_FILE_MANIFEST.md` |
