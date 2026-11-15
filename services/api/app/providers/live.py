"""Separate integration seams; live traffic is intentionally unavailable in M0."""

from typing import Any

from app.providers.base import ProviderUnavailable, Transcript


class OpenAICompatibleLLMProvider:
    async def complete_structured(
        self,
        prompt: str,
        schema: dict[str, Any],
        context: dict[str, Any],
        request_id: str,
    ) -> dict[str, Any]:
        raise ProviderUnavailable("Live LLM integration is outside M0")


class LiveASRProvider:
    async def transcribe(self, audio: bytes, request_id: str) -> Transcript:
        raise ProviderUnavailable("Live ASR must be configured and tested independently after M0")
