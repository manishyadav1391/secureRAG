import os
import json
from litellm import completion
from dotenv import load_dotenv
from ollama import Client

load_dotenv()

# Defaults from environment
DEFAULT_PROVIDER = os.getenv("LLM_PROVIDER", "gemini").lower()
DEFAULT_MODEL_NAME = os.getenv("LLM_MODEL_NAME")
def parse_json_response(content: str) -> dict:
    """Robustly extracts JSON from an LLM response string."""
    if not content:
        return {"answer": "Received empty response from the LLM.", "suggested_questions": []}
        
    content_str = content.strip()
    
    # Try direct parse
    try:
        return json.loads(content_str)
    except json.JSONDecodeError:
        pass
        
    # Clean markdown wrappers if present (e.g. ```json ... ```)
    if content_str.startswith("```"):
        lines = content_str.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        content_str = "\n".join(lines).strip()
        
        try:
            return json.loads(content_str)
        except json.JSONDecodeError:
            pass

    # Extract substring between first '{' and last '}'
    try:
        start_idx = content_str.find('{')
        end_idx = content_str.rfind('}')
        if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
            json_sub = content_str[start_idx:end_idx + 1]
            return json.loads(json_sub)
    except Exception:
        pass

    # Fallback to plain text wrapping
    return {
        "answer": content.strip(),
        "suggested_questions": []
    }

def call_llm(system_prompt: str, user_message: str, history: list = None, provider: str = None, model_name: str = None) -> dict:
    """
    Calls the configured LLM provider (Ollama, OpenAI, Anthropic, Gemini) 
    and enforces a structural JSON response.
    """
    provider = (provider or DEFAULT_PROVIDER).lower()
    
    # Map default model names if not specified
    if not model_name:
        if provider == DEFAULT_PROVIDER:
            model_name = DEFAULT_MODEL_NAME
        else:
            if provider == "gemini":
                model_name = "gemini-1.5-flash"
            elif provider == "openai":
                model_name = "gpt-4o-mini"
            elif provider == "anthropic":
                model_name = "claude-3-5-haiku-20241022"
            elif provider == "ollama":
                model_name = "gpt-oss:120b"

    messages = [{"role": "system", "content": system_prompt}]
    if history:
        messages.extend(history)
    messages.append({"role": "user", "content": user_message})

    if provider == "ollama":
        # Custom Ollama client implementation
        host = os.getenv("OLLAMA_HOST", "https://ollama.com")
        headers = {}
        ollama_key = os.getenv("OLLAMA_API_KEY")
        if ollama_key:
            headers['Authorization'] = 'Bearer ' + ollama_key
            
        client = Client(host=host, headers=headers)
        
        # Enforce json format in Ollama
        response = client.chat(model=model_name, messages=messages, format='json')
        raw_content = response['message']['content']
        return parse_json_response(raw_content)

    else:
        # LiteLLM for Gemini, OpenAI, Anthropic
        api_key = None
        if provider == "gemini":
            model_string = f"gemini/{model_name}"
            api_key = os.getenv("GEMINI_API_KEY") or os.getenv("LLM_API_KEY")
        elif provider == "openai":
            model_string = f"openai/{model_name}"
            api_key = os.getenv("OPENAI_API_KEY") or os.getenv("LLM_API_KEY")
        elif provider == "anthropic":
            model_string = f"anthropic/{model_name}"
            api_key = os.getenv("ANTHROPIC_API_KEY") or os.getenv("LLM_API_KEY")
        else:
            model_string = model_name
            api_key = os.getenv("LLM_API_KEY")

        api_kwargs = {}
        if api_key:
            api_kwargs["api_key"] = api_key

        response = completion(
            model=model_string,
            messages=messages,
            response_format={"type": "json_object"},
            **api_kwargs
        )
        raw_content = response.choices[0].message.content
        return parse_json_response(raw_content)