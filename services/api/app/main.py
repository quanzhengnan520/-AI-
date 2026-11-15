from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException
from starlette.middleware.cors import CORSMiddleware

from app.config import Settings
from app.database import create_database
from app.errors import APIError, api_error_handler, http_error_handler, validation_error_handler
from app.middleware import RequestBoundary
from app.providers.base import ASRProvider, LLMProvider
from app.providers.mock import MockASRProvider, MockLLMProvider
from app.routers.system import router
from app.routers.workspace import router as workspace_router


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    engine = create_database(settings)

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        yield
        engine.dispose()

    application = FastAPI(
        title="个人第二大脑 · M1 Text Memory API",
        version="0.1.0",
        lifespan=lifespan,
        # Avoid loading external Swagger/ReDoc assets on the local-first default.
        docs_url=None,
        redoc_url=None,
    )
    application.state.settings = settings
    application.state.engine = engine
    llm: LLMProvider = MockLLMProvider()
    asr: ASRProvider = MockASRProvider()
    application.state.llm_provider = llm
    application.state.asr_provider = asr
    application.add_exception_handler(APIError, api_error_handler)  # type: ignore[arg-type]
    application.add_exception_handler(HTTPException, http_error_handler)  # type: ignore[arg-type]
    application.add_exception_handler(
        RequestValidationError,
        validation_error_handler,  # type: ignore[arg-type]
    )
    application.add_middleware(RequestBoundary, max_request_bytes=settings.max_request_bytes)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type", "Idempotency-Key", "X-Request-ID"],
        expose_headers=["X-Request-ID"],
    )
    application.include_router(router)
    application.include_router(workspace_router)
    return application


app = create_app()
