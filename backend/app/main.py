from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.routers import auth, classroom, share

settings = get_settings()
app = FastAPI(title=settings.app_name, version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_frontend_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def require_trusted_origin_for_mutations(request: Request, call_next):
    if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        origin = request.headers.get("origin")
        if origin is None or origin.rstrip("/") not in settings.allowed_frontend_origins:
            return JSONResponse(
                status_code=403,
                content={"detail": "Request origin is not allowed"},
            )
    return await call_next(request)

app.include_router(auth.router, prefix=settings.api_prefix)
app.include_router(classroom.router, prefix=settings.api_prefix)
app.include_router(share.router, prefix=settings.api_prefix)


@app.get("/health")
def health():
    return {"status": "ok"}
