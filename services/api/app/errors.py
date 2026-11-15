"""Safe structured error responses: never echo request bodies or exception messages."""

from collections.abc import Mapping
from typing import Any

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException


class APIError(Exception):
    def __init__(self, status_code: int, code: str, message: str) -> None:
        self.status_code = status_code
        self.code = code
        self.message = message


def error_response(
    request_id: str,
    status: int,
    code: str,
    message: str,
    details: dict[str, Any] | None = None,
    headers: Mapping[str, str] | None = None,
) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={
            "error": {"code": code, "message": message, "details": details or {}},
            "request_id": request_id,
        },
        headers={"X-Request-ID": request_id, **(headers or {})},
    )


async def api_error_handler(request: Request, exc: APIError) -> JSONResponse:
    headers = {"WWW-Authenticate": "Bearer"} if exc.status_code == 401 else None
    return error_response(
        request.state.request_id, exc.status_code, exc.code, exc.message, headers=headers
    )


async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    # Only safe validation categories are returned. Pydantic input/ctx may contain secrets.
    return error_response(
        request.state.request_id,
        422,
        "VALIDATION_ERROR",
        "请求参数不合法，请检查参数范围。",
        {"issues": [{"type": error["type"]} for error in exc.errors()]},
    )


async def http_error_handler(request: Request, exc: HTTPException) -> JSONResponse:
    errors = {
        401: ("UNAUTHORIZED", "请配置有效的设备访问令牌。"),
        403: ("FORBIDDEN", "没有权限执行此操作。"),
        404: ("NOT_FOUND", "没有找到此资源。"),
        405: ("METHOD_NOT_ALLOWED", "此资源不支持该请求方法。"),
    }
    code, message = errors.get(exc.status_code, ("HTTP_ERROR", "请求未能完成。"))
    return error_response(
        request.state.request_id, exc.status_code, code, message, headers=exc.headers
    )
