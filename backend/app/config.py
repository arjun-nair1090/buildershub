from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    database_url: str = "postgresql+psycopg://jewellery:jewellery@localhost:5433/jewellery"

    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 8
    remember_me_expire_days: int = 14

    # Comma-separated list of allowed browser origins for the admin/public frontend.
    cors_origins: str = "http://localhost:5173"

    # Base URL of the public frontend. QR codes point to {public_base_url}/verify/{token}.
    public_base_url: str = "http://localhost:5173"

    # Vercel Functions cap request bodies at 4.5 MB, so uploads stay under that.
    max_upload_mb: int = 4

    # Live gold rate from metals.dev (https://metals.dev) or GoldAPI.io (https://www.goldapi.io); metals.dev is
    # used when both are set. Without a key, the keyless gold-api.com spot feed is used (international spot, so
    # it sits below Indian shop rates, which include import duty); turn that off and buyers see registered prices.
    metals_dev_api_key: str = ""
    goldapi_key: str = ""
    gold_rate_keyless_feed: bool = True
    # How long a fetched rate is reused. 30 suits gold-api.com (no request limit); the keyed providers' free
    # plans allow 100 requests a month, which needs 480 (8 h).
    gold_rate_ttl_minutes: int = 30

    seed_admin_name: str = "Store Administrator"
    seed_admin_email: str = "admin@jewelverify.demo"
    seed_admin_password: str = "Admin@12345"

    @field_validator("database_url")
    @classmethod
    def use_psycopg_driver(cls, url: str) -> str:
        """Hosted Postgres (e.g. Neon) hands out postgres:// URLs; SQLAlchemy needs the driver named."""
        for prefix in ("postgres://", "postgresql://"):
            if url.startswith(prefix):
                return "postgresql+psycopg://" + url.removeprefix(prefix)
        return url

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    def verification_url(self, token: str) -> str:
        return f"{self.public_base_url.rstrip('/')}/verify/{token}"


@lru_cache
def get_settings() -> Settings:
    return Settings()
