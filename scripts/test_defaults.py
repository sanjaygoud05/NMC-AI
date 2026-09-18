import urllib.request
import json

endpoints = [
    # Call with NO dataset_id query parameter
    "/api/analytics/dashboard",
    "/api/analytics/cpse",
    "/api/materials?page=1&page_size=5",
    "/api/matches?skip=0&limit=5",
    "/api/matches/report",
    "/api/review/queue?page=1&page_size=5",
    "/api/review/stats",
    "/api/standardization/report",
    "/api/common-master?page=1&page_size=5",
    "/api/legacy-mapping?page=1&page_size=5",
    "/api/procurement/cpse-summary",
    "/api/procurement/opportunities",
    "/api/analytics/data-quality",
]

print("=" * 70)
print("TESTING ALL SECTION ENDPOINTS WITHOUT QUERY PARAMETERS (DEFAULT BEHAVIOR)")
print("=" * 70)

for ep in endpoints:
    url = f"http://127.0.0.1:8000{ep}"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = resp.read().decode('utf-8')
            parsed = json.loads(data)
            if isinstance(parsed, list):
                status_str = f"LIST [items: {len(parsed)}]"
            elif isinstance(parsed, dict):
                count = parsed.get("total") or parsed.get("count") or parsed.get("total_materials") or len(parsed)
                status_str = f"DICT [count/total: {count}, keys: {list(parsed.keys())[:5]}]"
            else:
                status_str = f"TYPE: {type(parsed)}"
            print(f"[OK 200] {ep:45} -> {status_str}")
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode('utf-8')[:120] if hasattr(e, 'read') else str(e)
        print(f"[HTTP {e.code}] {ep:45} -> {err_msg}")
    except Exception as e:
        print(f"[ERROR]    {ep:45} -> {str(e)[:80]}")
