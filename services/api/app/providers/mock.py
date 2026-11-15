"""Deterministic contract fixtures, not AI inference or audio recognition."""

from typing import Any

from jsonschema import SchemaError, ValidationError, validate

from app.providers.base import ProviderUnavailable, Transcript


class MockLLMProvider:
    async def complete_structured(
        self,
        prompt: str,
        schema: dict[str, Any],
        context: dict[str, Any],
        request_id: str,
    ) -> dict[str, Any]:
        result: dict[str, Any] = {
            "mock": True,
            "answer": "演示回答：无法从现有资料确认。此适配器未调用真实模型。",
            "certainty": "insufficient_evidence",
            "citations": [],
        }
        try:
            validate(instance=result, schema=schema)
        except (ValidationError, SchemaError) as exc:
            raise ProviderUnavailable("Mock output does not match requested schema") from exc
        return result


class MockASRProvider:
    async def transcribe(self, audio: bytes, request_id: str) -> Transcript:
        if audio:
            raise ProviderUnavailable("M0 Mock ASR does not accept real audio")
        return Transcript(text="演示转写：这是一条合成文本，未进行语音识别。", mock=True)
