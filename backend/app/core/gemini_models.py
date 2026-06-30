DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite"

SUPPORTED_GEMINI_MODELS = {
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
}


def resolve_gemini_model(model: str | None) -> str:
    if model in SUPPORTED_GEMINI_MODELS:
        return model
    return DEFAULT_GEMINI_MODEL
