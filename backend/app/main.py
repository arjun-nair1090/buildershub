from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.routers import auth, designs, jewellery, photos, public, settings as settings_router, stores, verify

settings = get_settings()

app = FastAPI(title="Jewlerify API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
    expose_headers=["Content-Disposition"],
)

API_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
    # JSON and images never need scripts, styles or frames.
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
}
DOCS_PATHS = ("/docs", "/redoc", "/openapi.json")  # the interactive docs load scripts


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    for name, value in API_HEADERS.items():
        if name == "Content-Security-Policy" and request.url.path.startswith(DOCS_PATHS):
            continue
        response.headers.setdefault(name, value)
    return response


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    """Flatten Pydantic errors into {field: message} so forms can show them inline."""
    fields: dict[str, str] = {}
    messages: list[str] = []
    for err in exc.errors():
        loc = [str(p) for p in err["loc"] if p not in ("body", "query", "path")]
        msg = err["msg"].removeprefix("Value error, ")
        if loc:
            fields.setdefault(loc[0], msg)  # the top-level field, also for list items like purity_options[0]
        messages.append(msg)
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": messages[0] if messages else "Invalid request", "fields": fields},
    )


app.include_router(auth.router)
app.include_router(jewellery.router)
app.include_router(stores.router)
app.include_router(photos.router)
app.include_router(designs.router)
app.include_router(verify.router)
app.include_router(public.router)
app.include_router(settings_router.router)


@app.get("/api/health", tags=["meta"])
def health() -> dict[str, str]:
    return {"status": "ok"}
