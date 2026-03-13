# DineIQ\Backend\services\llm.py

# ---------------------------------------------------------
# Library and Packages Import
# ---------------------------------------------------------
import os
import time

# ---------------------------------------------------------
# Load environment variables from .env file
# ---------------------------------------------------------
from dotenv import load_dotenv
load_dotenv()

# ---------------------------------------------------------
# Class definition for Gemini LLM interactions
# ---------------------------------------------------------
class GeminiClient:
    """
    A single, reusable Gemini client.

    Pass a specific api_key to target a dedicated quota bucket.
    If omitted, falls back to GEMINI_API_KEY env var.

    Preferred usage — use named keys via services/dependencies.py:
        from services.dependencies import gemini_chatbot, gemini_menu, ...
    """

    # -------------------------------------------------------------------
    # 🔧 SETUP: Google Gemini
    # https://aistudio.google.com/api-keys
    # -------------------------------------------------------------------
    def __init__(
        self,
        api_key: str | None = None,
        model_name: str | None = None,
    ):
        """
        :param api_key: Gemini API key.
                        Provide a specific named key (e.g. GEMINI_API_KEY_CHATBOT)
                        for per-use-case quota isolation.
                        Defaults to GEMINI_API_KEY_COMMON env var if omitted.
        :param model_name: Gemini model name (defaults to GEMINI_MODEL env var)
        """
        self.api_key    = api_key or os.getenv("GEMINI_API_KEY_COMMON")
        self.model_name = model_name or os.getenv("GEMINI_MODEL")

        if not self.api_key:
            raise ValueError(
                "No Gemini API key provided. "
                "Pass api_key= or set GEMINI_API_KEY in .env"
            )

        if not self.model_name:
            raise ValueError("GEMINI_MODEL is not set in .env")

        self._model = self._init_gemini()

    # -------------------------------------------------------------------
    # 🔧 Gemini LLM Init
    # -------------------------------------------------------------------
    def _init_gemini(self):
        import google.generativeai as genai
        genai.configure(api_key=self.api_key)
        return genai.GenerativeModel(self.model_name)

    # Back-compat alias (used in categorization.py)
    def init_gemini(self):
        return self._init_gemini()

    # -------------------------------------------------------------------
    # 🧠 Gemini LLM Call with retry + backoff
    # -------------------------------------------------------------------
    def call_gemini_with_retry(
        self,
        prompt: str,
        max_retries: int = 3,
        rate_limit_sleep: int = 60,
        error_sleep: int = 5,
    ) -> str | None:
        """
        Call Gemini with basic retry & backoff handling.

        :param prompt: Prompt to send to Gemini
        :param max_retries: Number of retry attempts
        :param rate_limit_sleep: Seconds to wait on 429 errors
        :param error_sleep: Seconds to wait on other errors
        :return: Generated text or None
        """
        for attempt in range(1, max_retries + 1):
            try:
                response = self._model.generate_content(prompt)
                if response and getattr(response, "text", None):
                    return response.text

            except Exception as e:
                print(f"⚠️ Gemini call failed (attempt {attempt}): {e}")

                if "429" in str(e):
                    print(f"⏳ Rate limit hit. Waiting {rate_limit_sleep}s...")
                    time.sleep(rate_limit_sleep)
                else:
                    time.sleep(error_sleep)

        return None

    # -------------------------------------------------------------------
    # 🧠 Gemini LLM Call — no retry (fast path)
    # -------------------------------------------------------------------
    def call_gemini(self, prompt: str) -> str | None:
        """
        Call Gemini once without any retry or backoff logic.

        :param prompt: Prompt to send to Gemini
        :return: Generated text or None
        """
        try:
            response = self._model.generate_content(prompt)
            if response and getattr(response, "text", None):
                return response.text

        except Exception as e:
            print(f"⚠️ Gemini call failed: {e}")

        return None


# ---------------------------------------------------------
# Back-compat alias — GeminiClient_2 is no longer needed.
# Both clients in categorization.py now use the same class
# with different API keys (injected via dependencies.py).
# ---------------------------------------------------------
GeminiClient_2 = GeminiClient


# ---------------------------------------------------------
# Class definition for Grok LLM interactions
# ---------------------------------------------------------
class GrokClient:
    # -------------------------------------------------------------------
    # 🔧 SETUP: Grok (xAI)
    # https://console.x.ai/
    # -------------------------------------------------------------------
    def __init__(
        self,
        api_key: str | None = None,
        model_name: str | None = None,
    ):
        self.api_key    = api_key or os.getenv("GROK_API_KEY")
        self.model_name = model_name or os.getenv("GROK_MODEL", "grok-beta")

        if not self.api_key:
            raise ValueError("GROK_API_KEY missing")

        if not self.model_name:
            raise ValueError("GROK_MODEL missing")

        self._client = self._init_grok()

    def _init_grok(self):
        from openai import OpenAI
        return OpenAI(
            api_key=self.api_key,
            base_url="https://api.x.ai/v1",
        )

    def call_grok(self, prompt: str) -> str | None:
        try:
            response = self._client.chat.completions.create(
                model=self.model_name,
                messages=[{"role": "user", "content": prompt}],
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"⚠️ Grok call failed: {e}")
            return None


# ---------------------------------------------------------
# Class definition for Claude LLM interactions
# ---------------------------------------------------------
class ClaudeClient:
    # -------------------------------------------------------------------
    # 🔧 SETUP: Claude (Anthropic)
    # https://console.anthropic.com/
    # -------------------------------------------------------------------
    def __init__(
        self,
        api_key: str | None = None,
        model_name: str | None = None,
    ):
        self.api_key    = api_key or os.getenv("CLAUDE_API_KEY")
        self.model_name = model_name or os.getenv(
            "CLAUDE_MODEL", "claude-3-haiku-20240307"
        )

        if not self.api_key:
            raise ValueError("CLAUDE_API_KEY missing")

        if not self.model_name:
            raise ValueError("CLAUDE_MODEL missing")

        self._client = self._init_claude()

    def _init_claude(self):
        import anthropic
        return anthropic.Anthropic(api_key=self.api_key)

    def call_claude(self, prompt: str, max_tokens: int = 1024) -> str | None:
        try:
            response = self._client.messages.create(
                model=self.model_name,
                max_tokens=max_tokens,
                messages=[{"role": "user", "content": prompt}],
            )
            return response.content[0].text
        except Exception as e:
            print(f"⚠️ Claude call failed: {e}")
            return None
