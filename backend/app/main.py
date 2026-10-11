import json

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
NUL_ERROR = {"detail": "Text can't contain NUL characters.", "fields": {}}


def _has_nul(value: object) -> bool:
    if isinstance(value, str):
        return "\x00" in value
    if isinstance(value, dict):
        return any(_has_nul(k) or _has_nul(v) for k, v in value.items())
    if isinstance(value, list):
        return any(_has_nul(v) for v in value)
    return False


# Registered before security_headers, so it runs inside it and its 422s carry the same headers.
@app.middleware("http")
async def refuse_nul(request: Request, call_next):
    """Postgres can't store NUL in text: refuse it up front rather than fail with a 500 at the database."""
    if "\x00" in request.url.path or any(_has_nul(k) or _has_nul(v) for k, v in request.query_params.multi_items()):
        return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content=NUL_ERROR)
    if request.headers.get("content-type", "").startswith("application/json"):
        body = await request.body()  # Starlette replays the cached body to the route
        if b"\\u0000" in body:
            try:
                found = _has_nul(json.loads(body))
            except ValueError:
                found = False  # malformed JSON: the route's own validation reports it
            if found:
                return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content=NUL_ERROR)
    return await call_next(request)


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
