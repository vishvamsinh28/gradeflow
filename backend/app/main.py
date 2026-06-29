from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.routers import analytics, assignments, auth, classes, public, settings as settings_router, submissions

settings = get_settings()
app = FastAPI(title=settings.app_name, version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def require_trusted_origin_for_mutations(request: Request, call_next):
    if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        origin = request.headers.get("origin")
        if origin != settings.frontend_origin:
            return JSONResponse(
                status_code=403,
                content={"detail": "Request origin is not allowed"},
            )
    return await call_next(request)

app.include_router(auth.router, prefix=settings.api_prefix)
app.include_router(classes.router, prefix=settings.api_prefix)
app.include_router(assignments.router, prefix=settings.api_prefix)
app.include_router(submissions.router, prefix=settings.api_prefix)
app.include_router(analytics.router, prefix=settings.api_prefix)
app.include_router(settings_router.router, prefix=settings.api_prefix)
app.include_router(public.router, prefix=settings.api_prefix)


@app.get("/health")
def health():
    return {"status": "ok"}
