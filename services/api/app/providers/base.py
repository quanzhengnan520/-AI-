from dataclasses import dataclass
from typing import Any, Protocol


class ProviderUnavailable(Exception):
    """Safe capability failure. Never include prompts, credentials or raw audio."""


class LLMProvider(Protocol):
    async def complete_structured(
        self,
        prompt: str,
        schema: dict[str, Any],
        context: dict[str, Any],
        request_id: str,
    ) -> dict[str, Any]: ...


@dataclass(frozen=True)
class Transcript:
    text: str
    mock: bool
    speaker_label: str | None = None


class ASRProvider(Protocol):
    async def transcribe(self, audio: bytes, request_id: str) -> Transcript: ...
