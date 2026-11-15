"""Persistent per-device authentication; the M0 environment token never authenticates M1."""

import hashlib
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.config import Settings
from app.database import create_database
from app.errors import APIError
from app.models import OWNER_ID, Device, PairingAttempt, PairingCode, User, now
from app.security import bearer


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


@dataclass(frozen=True)
class Principal:
    user_id: str
    device_id: str


def current_device(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> Principal:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise APIError(401, "UNAUTHORIZED", "请先配对此设备。")
    with Session(request.app.state.engine) as session:
        device = session.scalar(
            select(Device).where(
                Device.token_hash == digest(credentials.credentials), Device.revoked_at.is_(None)
            )
        )
        if device is None:
            raise APIError(401, "UNAUTHORIZED", "设备认证已失效，请重新配对。")
        return Principal(device.user_id, device.id)


def issue_pairing_code(settings: Settings) -> str:
    engine = create_database(settings)
    try:
        with Session(engine) as session:
            session.connection().exec_driver_sql("BEGIN IMMEDIATE")
            if session.get(User, OWNER_ID) is None:
                session.add(User(id=OWNER_ID))
                session.flush()
            code = secrets.token_urlsafe(24)
            session.add(
                PairingCode(
                    user_id=OWNER_ID,
                    code_hash=digest(code),
                    expires_at=(datetime.now(UTC) + timedelta(minutes=10))
                    .isoformat(timespec="microseconds")
                    .replace("+00:00", "Z"),
                )
            )
            session.commit()
            return code
    finally:
        engine.dispose()


def consume_pairing_code(request: Request, code: str, name: str, platform: str) -> dict[str, str]:
    client_hash = digest(request.client.host if request.client else "unknown")
    cutoff = (
        (datetime.now(UTC) - timedelta(minutes=1))
        .isoformat(timespec="microseconds")
        .replace("+00:00", "Z")
    )
    with Session(request.app.state.engine) as session:
        session.connection().exec_driver_sql("BEGIN IMMEDIATE")
        attempts = (
            session.scalar(
                select(func.count())
                .select_from(PairingAttempt)
                .where(
                    PairingAttempt.client_hash == client_hash, PairingAttempt.attempted_at >= cutoff
                )
            )
            or 0
        )
        if attempts >= 10:
            raise APIError(429, "PAIRING_RATE_LIMITED", "配对尝试过多，请稍后再试。")
        session.add(PairingAttempt(client_hash=client_hash, attempted_at=now()))
        session.execute(
            delete(PairingAttempt).where(
                PairingAttempt.attempted_at
                < (datetime.now(UTC) - timedelta(hours=1))
                .isoformat(timespec="microseconds")
                .replace("+00:00", "Z")
            )
        )
        pairing = session.scalar(
            select(PairingCode).where(
                PairingCode.code_hash == digest(code),
                PairingCode.consumed_at.is_(None),
                PairingCode.expires_at > now(),
            )
        )
        if pairing is None:
            session.commit()
            raise APIError(401, "INVALID_PAIRING_CODE", "配对码无效、已使用或已过期。")
        pairing.consumed_at = now()
        token = secrets.token_urlsafe(32)
        device = Device(
            user_id=pairing.user_id, token_hash=digest(token), name=name, platform=platform
        )
        session.add(device)
        session.flush()
        result = {"device_id": device.id, "device_token": token}
        session.commit()
        return result
