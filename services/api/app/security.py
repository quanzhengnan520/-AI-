"""M0 local device-token check. M1 replaces manual bootstrap with device pairing."""

import hashlib
import hmac
from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import Settings
from app.errors import APIError

bearer = HTTPBearer(auto_error=False)


def require_device(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> None:
    settings: Settings = request.app.state.settings
    supplied = (
        hashlib.sha256(credentials.credentials.encode("utf-8")).hexdigest()
        if credentials and credentials.scheme.lower() == "bearer"
        else ""
    )
    if (
        not settings.device_token_sha256
        or not supplied
        or not hmac.compare_digest(supplied, settings.device_token_sha256)
    ):
        raise APIError(401, "UNAUTHORIZED", "请配置有效的设备访问令牌。")
