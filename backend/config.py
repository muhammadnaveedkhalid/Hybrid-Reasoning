from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    hf_dataset_id: str = "pubmed_qa"
    hf_dataset_config: str = "pqa_labeled"
    hf_dataset_split: str = "train"
    guideline_keywords: str = "thalassem,hemoglobin,transfusion,anemia,splen,chelation,iron overload,emergency"
    frontend_urls: str = "http://localhost:5173,http://127.0.0.1:5173"


settings = Settings()
