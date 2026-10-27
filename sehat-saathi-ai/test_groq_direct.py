import os
import json
import urllib.request
import urllib.error

# Load key from .env relative to script directory
env_path = os.path.join(os.path.dirname(__file__), ".env")
api_key = os.getenv("GROQ_API_KEY", "")
if not api_key and os.path.exists(env_path):
    with open(env_path, "r") as f:
        for line in f:
            if line.strip().startswith("GROQ_API_KEY="):
                api_key = line.strip().split("=", 1)[1].strip('"').strip("'")

print(f"API Key found: {'Yes (' + api_key[:6] + '...' + api_key[-4:] + ')' if api_key else 'No'}")

url = "https://api.groq.com/openai/v1/chat/completions"
headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json",
    "User-Agent": "SehatSaathi-Test/1.0"
}

data = {
    "model": "openai/gpt-oss-120b",
    "messages": [
        {
            "role": "system",
            "content": "You are SehatSaathi AI, a healthcare literacy assistant. Explain in simple terms for education only without diagnosing."
        },
        {
            "role": "user",
            "content": "Why is hydration important when having a mild fever?"
        }
    ],
    "temperature": 0.3,
    "max_tokens": 400
}

req = urllib.request.Request(url, data=json.dumps(data).encode("utf-8"), headers=headers, method="POST")

try:
    with urllib.request.urlopen(req, timeout=15) as response:
        body = response.read().decode("utf-8")
        result = json.loads(body)
        reply = result["choices"][0]["message"]["content"]
        print("\n=== GROQ API RESPONSE SUCCESS ===")
        print(f"Model used: {result.get('model')}")
        print("\n" + reply)
        print("\n=== TEST PASSED ===")
except urllib.error.HTTPError as e:
    err_body = e.read().decode("utf-8")
    print(f"\nHTTP ERROR {e.code}: {err_body}")
except Exception as e:
    print(f"\nCONNECTION/OTHER ERROR: {e}")
