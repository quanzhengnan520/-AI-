import asyncio

import pytest
from pydantic import ValidationError

from app.config import Settings
from app.providers.base import ProviderUnavailable
from app.providers.live import LiveASRProvider, OpenAICompatibleLLMProvider
from app.providers.mock import MockASRProvider, MockLLMProvider


@pytest.mark.parametrize(
    "overrides",
    [
        {"mock_mode": False},
        {"live_ai_enabled": True},
        {"llm_provider": "live"},
        {"asr_provider": "live"},
        {"database_url": "postgresql://example.invalid/db"},
        {"device_token_sha256": "not-a-digest"},
    ],
)
def test_unsafe_or_unsupported_configuration_is_rejected(overrides) -> None:
    with pytest.raises(ValidationError):
        Settings(_env_file=None, **overrides)


def test_mock_llm_validates_structured_output() -> None:
    schema = {
        "type": "object",
        "required": ["mock", "answer", "certainty", "citations"],
        "properties": {"mock": {"const": True}, "citations": {"type": "array", "maxItems": 0}},
    }
    result = asyncio.run(MockLLMProvider().complete_structured("unused", schema, {}, "test"))
    assert result["mock"] is True
    assert result["certainty"] == "insufficient_evidence"
    assert result["citations"] == []


def test_mock_llm_rejects_incompatible_schema() -> None:
    with pytest.raises(ProviderUnavailable):
        asyncio.run(
            MockLLMProvider().complete_structured(
                "unused", {"type": "object", "required": ["unavailable_field"]}, {}, "test"
            )
        )


def test_mock_asr_is_explicitly_synthetic_and_rejects_real_bytes() -> None:
    result = asyncio.run(MockASRProvider().transcribe(b"", "test"))
    assert result.mock is True
    assert "未进行语音识别" in result.text
    with pytest.raises(ProviderUnavailable):
        asyncio.run(MockASRProvider().transcribe(b"pretend-audio", "test"))


def test_live_interfaces_fail_closed_without_any_network() -> None:
    with pytest.raises(ProviderUnavailable):
        asyncio.run(OpenAICompatibleLLMProvider().complete_structured("", {}, {}, "test"))
    with pytest.raises(ProviderUnavailable):
        asyncio.run(LiveASRProvider().transcribe(b"", "test"))
