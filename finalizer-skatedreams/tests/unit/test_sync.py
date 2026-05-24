import pytest
import respx
from httpx import Response

from finalizer.sync import SyncError, dispara_sync


@pytest.mark.asyncio
@respx.mock
async def test_sync_ok():
    url = "https://script.google.com/macros/s/x/exec"
    respx.get(url).mock(return_value=Response(200, text="OK"))
    await dispara_sync(url, "tok")


@pytest.mark.asyncio
@respx.mock
async def test_sync_forbidden_raises():
    url = "https://script.google.com/macros/s/x/exec"
    respx.get(url).mock(return_value=Response(200, text="forbidden"))
    with pytest.raises(SyncError):
        await dispara_sync(url, "tok")


@pytest.mark.asyncio
@respx.mock
async def test_sync_error_raises():
    url = "https://script.google.com/macros/s/x/exec"
    respx.get(url).mock(return_value=Response(200, text="error: boom"))
    with pytest.raises(SyncError):
        await dispara_sync(url, "tok")
