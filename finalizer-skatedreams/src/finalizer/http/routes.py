"""HTTP routes for the finalizer service."""

from fastapi import APIRouter, Depends, Header, HTTPException, status


def build_router(pipeline, *, api_token: str) -> APIRouter:
    router = APIRouter()

    def require_token(x_finalizer_token: str | None = Header(default=None)):
        if not x_finalizer_token or x_finalizer_token != api_token:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    @router.get("/health")
    async def health():
        return {"status": "ok"}

    @router.get("/status", dependencies=[Depends(require_token)])
    async def get_status():
        rep = pipeline.last_report
        return {
            "last_run_at": pipeline.last_run_at.isoformat() if pipeline.last_run_at else None,
            "report": rep.to_dict() if rep else None,
        }

    @router.post("/run", dependencies=[Depends(require_token)])
    async def run():
        report = await pipeline.run_ciclo()
        return {"status": "ok", "report": report.to_dict()}

    return router
