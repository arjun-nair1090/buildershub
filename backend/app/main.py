from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.routers import auth, jewellery, settings as settings_router, stores, verify

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


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    """Flatten Pydantic errors into {field: message} so forms can show them inline."""
    fields: dict[str, str] = {}
    messages: list[str] = []
    for err in exc.errors():
        loc = [str(p) for p in err["loc"] if p not in ("body", "query", "path")]
        msg = err["msg"].removeprefix("Value error, ")
        if loc:
            fields.setdefault(loc[-1], msg)
        messages.append(msg)
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": messages[0] if messages else "Invalid request", "fields": fields},
    )


app.include_router(auth.router)
app.include_router(jewellery.router)
app.include_router(stores.router)
app.include_router(verify.router)
app.include_router(settings_router.router)


@app.get("/api/health", tags=["meta"])
def health() -> dict[str, str]:
    return {"status": "ok"}
