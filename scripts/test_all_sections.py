import urllib.request
import json
import traceback

endpoints = [
    # Dashboard / Analytics
    "/api/analytics/dashboard?dataset_id=BASELINE",
    "/api/analytics/cpse?dataset_id=BASELINE",
    "/api/analytics/quality?dataset_id=BASELINE",
    
    # Materials
    "/api/materials?dataset_id=BASELINE&page=1&page_size=10",
    
    # Matches
    "/api/matches?dataset_id=BASELINE&skip=0&limit=10",
    "/api/matches/report?dataset_id=BASELINE",
    
    # Review
    "/api/review/queue?dataset_id=BASELINE&page=1&page_size=10",
    "/api/review/stats?dataset_id=BASELINE",
    
    # Standardization
    "/api/standardization/report?dataset_id=BASELINE",
    "/api/standardization/attributes/summary?dataset_id=BASELINE",
    
    # Common Master
    "/api/common-master?dataset_id=BASELINE&page=1&page_size=10",
    
    # Legacy Mapping
    "/api/legacy-mapping?dataset_id=BASELINE&page=1&page_size=10",
    
    # Procurement
    "/api/procurement/cpse-summary?dataset_id=BASELINE",
    "/api/procurement/opportunities?dataset_id=BASELINE",
    
    # Dataset
    "/api/datasets",
]

print("=" * 70)
print("TESTING ALL SECTION ENDPOINTS WITH dataset_id=BASELINE")
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
            print(f"[OK 200] {ep:55} -> {status_str}")
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode('utf-8')[:120] if hasattr(e, 'read') else str(e)
        print(f"[HTTP {e.code}] {ep:55} -> {err_msg}")
    except Exception as e:
        print(f"[ERROR]    {ep:55} -> {str(e)[:80]}")
