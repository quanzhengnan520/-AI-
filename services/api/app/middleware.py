"""Request IDs, bounded request bodies and safe unexpected failures."""

from uuid import uuid4

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.errors import error_response


class RequestBoundary:
    def __init__(self, app: ASGIApp, max_request_bytes: int) -> None:
        self.app = app
        self.max_request_bytes = max_request_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        request_id = str(uuid4())
        scope.setdefault("state", {})["request_id"] = request_id
        received_bytes = 0
        messages: list[Message] = []
        # Bound the actual stream, including requests without Content-Length.
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            received_bytes += len(message.get("body", b""))
            if received_bytes > self.max_request_bytes:
                response = error_response(
                    request_id, 413, "REQUEST_TOO_LARGE", "请求内容超过服务端大小限制。"
                )
                await response(scope, receive, send)
                return
            messages.append(message)
            if not message.get("more_body", False):
                break

        index = 0
        response_started = False

        async def replay() -> Message:
            nonlocal index
            if index < len(messages):
                message = messages[index]
                index += 1
                return message
            return await receive()

        async def send_with_id(message: Message) -> None:
            nonlocal response_started
            if message["type"] == "http.response.start":
                response_started = True
                message["headers"] = [
                    (key, value)
                    for key, value in message.get("headers", [])
                    if key.lower() != b"x-request-id"
                ] + [(b"x-request-id", request_id.encode("ascii"))]
            await send(message)

        try:
            await self.app(scope, replay, send_with_id)
        except Exception:
            if response_started:
                raise
            response = error_response(
                request_id, 500, "INTERNAL_ERROR", "服务暂时不可用，请稍后重试。"
            )
            await response(scope, receive, send_with_id)
