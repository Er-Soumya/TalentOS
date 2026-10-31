import secrets

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "TalentOS API"
    database_url: str = "postgresql+psycopg://postgres:YOUR_PASSWORD@localhost:5432/talentos"

    jwt_secret: str = ""
    jwt_expire_minutes: int = 60 * 24 * 7
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # AI provider: "ollama" (default: free, runs on your own computer/server) or "gemini" (optional).
    # If the AI is not reachable the app keeps working with its built-in fallbacks.
    llm_provider: str = "ollama"
    llm_rpm: int = 600              # max AI calls per minute
    llm_max_retries: int = 1
    llm_timeout_s: int = 180        # a local model on a CPU can be slow, so be patient

    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2"
    ollama_num_ctx: int = 8192      # how much text the model can read at once (Ollama's own default of 2048 is too small for resumes)
    ollama_keep_alive: str = "30m"  # keep the model loaded in memory between requests (much faster)

    gemini_api_key: str = ""
    gemini_model: str = "gemini-flash-latest"

    otp_mode: str = "fixed"         # "fixed" or "email"
    dev_otp: str = "1234"
    otp_ttl_minutes: int = 10
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""

    upload_dir: str = "uploads"
    max_upload_mb: int = 10
    max_match_batch: int = 25

    @property
    def cors_list(self):
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
if not settings.jwt_secret.strip():
    settings.jwt_secret = secrets.token_urlsafe(48)