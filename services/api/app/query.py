"""M1 deterministic source retrieval; no generated inference or external network.

Question text and stored records are data, never instructions. Retrieval emits
exact authorized source spans and keeps record time distinct from inferred events.
"""

import re
from collections import defaultdict
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.contracts import QueryInput
from app.models import Entity, MemoryFact, RecordEntity, SourceRecord

SEARCH_LIMIT = 1000
CITATION_LIMIT = 20
QUOTE_LIMIT = 2000
_STOP_PHRASES = (
    "请告诉我",
    "请问",
    "告诉我",
    "有什么",
    "有哪些",
    "是什么",
    "什么时候",
    "多少",
    "为什么",
    "怎么样",
    "怎么",
    "是否",
    "有没有",
    "能不能",
    "可不可以",
    "了吗",
    "的吗",
    "曾经",
    "目前",
    "已经",
    "现在",
    "之前",
    "关于",
    "相关",
    "记录",
    "变化",
    "表示",
    "说过",
    "说了",
    "哪些",
    "什么",
    "情况",
    "一下",
    "查询",
    "检索",
    "请",
    "的",
    "了",
    "吗",
)
_STOP_TOKENS = {"项目", "人物", "事件", "公司", "这个", "那个", "我们", "以及", "还有"}


def _tokens(question: str, names: list[str]) -> set[str]:
    clean = question.lower()
    for name in sorted(names, key=len, reverse=True):
        clean = clean.replace(name.lower(), " ")
    for phrase in _STOP_PHRASES:
        clean = clean.replace(phrase, " ")
    tokens = set(re.findall(r"[a-z0-9]+", clean))
    for chunk in re.findall(r"[\u3400-\u9fff]+", clean):
        if len(chunk) == 1:
            continue
        # Chinese keyword overlap without an online tokenizer or embeddings.
        tokens.update(chunk[index : index + 2] for index in range(len(chunk) - 1))
    return tokens - _STOP_TOKENS


def _matches(value: str, tokens: set[str]) -> bool:
    lowered = value.lower()
    return any(token in lowered for token in tokens)


def _refusal() -> dict[str, Any]:
    return {
        "answer": "现有记录没有足够的相关证据，无法确认。请补充原始记录或缩小人物、项目范围。",
        "certainty": "insufficient_evidence",
        "citations": [],
        "limitations": ["没有可引用的相关原文；不会用模型猜测补全答案。"],
    }


def query_records(session: Session, user_id: str, payload: QueryInput) -> dict[str, Any]:
    records = list(
        session.scalars(
            select(SourceRecord)
            .where(SourceRecord.user_id == user_id, SourceRecord.deleted_at.is_(None))
            .order_by(SourceRecord.captured_at.desc(), SourceRecord.id.desc())
            .limit(SEARCH_LIMIT)
        )
    )
    if not records:
        return _refusal()
    record_ids = [record.id for record in records]
    entities_by_record: dict[str, list[Entity]] = defaultdict(list)
    for record_id, entity in session.execute(
        select(RecordEntity.record_id, Entity)
        .join(Entity, RecordEntity.entity_id == Entity.id)
        .where(RecordEntity.record_id.in_(record_ids), Entity.user_id == user_id)
    ):
        entities_by_record[record_id].append(entity)
    all_names = sorted(
        {entity.display_name for values in entities_by_record.values() for entity in values}
    )
    named_in_question = [name for name in all_names if name.lower() in payload.question.lower()]
    explicit = payload.filters

    def allowed(record: SourceRecord) -> bool:
        entities = entities_by_record[record.id]
        names = {entity.display_name for entity in entities}
        if explicit.entity_names and not names.intersection(explicit.entity_names):
            return False
        for kind, name in (
            ("person", explicit.person),
            ("project", explicit.project),
            ("event", explicit.event),
        ):
            if name and not any(
                entity.kind == kind and entity.display_name == name for entity in entities
            ):
                return False
        return not named_in_question or bool(names.intersection(named_in_question))

    records = [record for record in records if allowed(record)]
    query_tokens = _tokens(payload.question, all_names)
    broad_entity_question = not query_tokens and bool(
        named_in_question
        or explicit.entity_names
        or explicit.person
        or explicit.project
        or explicit.event
    )
    seeds = [
        record
        for record in records
        if broad_entity_question or _matches(record.title + "\n" + record.body_text, query_tokens)
    ]
    if not seeds:
        return _refusal()
    # Include the same manually linked project/event context so later statements
    # without the keyword remain visible. This is a timeline, not change inference.
    context_ids = {
        entity.id
        for record in seeds
        for entity in entities_by_record[record.id]
        if entity.kind in {"project", "event"}
    }
    seed_ids = {record.id for record in seeds}
    selected = [
        record
        for record in records
        if record.id in seed_ids
        or any(entity.id in context_ids for entity in entities_by_record[record.id])
    ]
    selected.sort(key=lambda record: (record.captured_at, record.id))
    facts_by_record: dict[str, list[MemoryFact]] = defaultdict(list)
    for fact in session.scalars(
        select(MemoryFact).where(
            MemoryFact.user_id == user_id,
            MemoryFact.source_record_id.in_([r.id for r in selected]),
            MemoryFact.deleted_at.is_(None),
            MemoryFact.status != "superseded",
        )
    ):
        facts_by_record[fact.source_record_id].append(fact)
    citations: list[dict[str, Any]] = []
    for record in selected:
        facts = [
            fact
            for fact in facts_by_record[record.id]
            if fact.source_record_version == record.version
        ]
        spans: list[tuple[int, int, str]] = []
        if explicit.confirmed_only:
            spans = [
                (fact.evidence_start_char, fact.evidence_end_char, fact.status)
                for fact in facts
                if fact.status == "verified_by_user"
                and fact.modality not in {"hypothesis", "question"}
                and (broad_entity_question or _matches(fact.evidence_excerpt, query_tokens))
            ]
        else:
            positions = [record.body_text.lower().find(token) for token in query_tokens]
            found = [position for position in positions if position >= 0]
            start = max(0, min(found) - 100) if found else 0
            end = min(len(record.body_text), start + QUOTE_LIMIT)
            status = next(
                (
                    fact.status
                    for fact in facts
                    if fact.evidence_start_char == start and fact.evidence_end_char == end
                ),
                "unreviewed_source",
            )
            spans = [(start, end, status)]
        for start, end, status in spans:
            if not 0 <= start < end <= len(record.body_text):
                continue
            quote = record.body_text[start:end]
            if explicit.confirmed_only and not any(
                fact.evidence_start_char == start
                and fact.evidence_end_char == end
                and fact.evidence_excerpt == quote
                for fact in facts
            ):
                continue
            citations.append(
                {
                    "record_id": record.id,
                    "record_version": record.version,
                    "start_char": start,
                    "end_char": end,
                    "quote": quote,
                    "captured_at": record.captured_at,
                    "recorded_at": record.created_at,
                    "status": status,
                    "evidence_status": "available",
                }
            )
    if not citations:
        return _refusal()
    total = len(citations)
    citations = citations[-CITATION_LIMIT:]
    lines = ["检索到以下来源原话（按记录时间排列）。无法确认原文未明确支持的结论："]
    lines.extend(
        f"[{index}] {citation['captured_at']}：“{citation['quote']}”"
        for index, citation in enumerate(citations, 1)
    )
    return {
        "answer": "\n".join(lines),
        "certainty": "supported_with_limits",
        "citations": citations,
        "limitations": [
            "这是关键词与人工关联的原文检索，不是事实推断；预计或考虑金额不能证明审批通过。",
            "引用保留原始陈述；候选、驳回和更正内容不会自动成为已核实事实。",
            f"最多检索最新{SEARCH_LIMIT}条记录，返回{len(citations)}/{total}条原文引用；不能据此断言没有其他记录。",
        ],
    }
