import os
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI

load_dotenv()

def _get_base_llm(temperature: float, max_tokens: int = 1024):
    gemini_api_key = os.getenv("GEMINI_API_KEY")
    if gemini_api_key:
        model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
        return ChatGoogleGenerativeAI(
            model=model_name,
            temperature=temperature,
            max_output_tokens=max_tokens,
            google_api_key=gemini_api_key,
        )
        
    api_key = os.getenv("OPENROUTER_API_KEY")
    model_name = os.getenv("OPENROUTER_MODEL", "openrouter/auto")
    if not api_key:
        raise ValueError("GEMINI_API_KEY or OPENROUTER_API_KEY is not set in .env")
    return ChatOpenAI(
        model=model_name,
        temperature=temperature,
        max_tokens=max_tokens,
        openai_api_key=api_key,
        openai_api_base="https://openrouter.ai/api/v1",
    )

def get_sql_llm():
    """Returns a low temperature LLM for precise SQL generation."""
    temp = float(os.getenv("SQL_LLM_TEMPERATURE", "0.1"))
    return _get_base_llm(temperature=temp, max_tokens=1024)

def get_narrator_llm():
    """Returns a slightly higher temperature LLM for natural language generation."""
    temp = float(os.getenv("NARRATOR_LLM_TEMPERATURE", "0.3"))
    return _get_base_llm(temperature=temp, max_tokens=512)
