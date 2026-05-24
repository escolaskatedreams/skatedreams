"""Trigger the Apps Script `puxar_calendario()` web app webhook."""

import httpx


class SyncError(Exception):
    pass


async def dispara_sync(url: str, token: str, timeout_seconds: int = 120) -> None:
    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        r = await client.get(url, params={"token": token})
    body = r.text.strip()
    if body == "OK":
        return
    raise SyncError(f"Apps Script returned: {body!r}")
