import urllib.request
import json

endpoints = [
    '/api/materials?dataset_id=baseline&page=1&page_size=10',
    '/api/procurement/cpse-summary?dataset_id=baseline',
    '/api/procurement/opportunities?dataset_id=baseline',
    '/api/legacy-mapping?dataset_id=baseline&page=1&page_size=10',
    '/api/common-master?dataset_id=baseline&page=1&page_size=10',
    '/api/review/queue?dataset_id=baseline&page=1&page_size=10',
    '/api/matches?dataset_id=baseline&page=1&page_size=10',
    '/api/standardization/report?dataset_id=baseline'
]

for ep in endpoints:
    url = f"http://127.0.0.1:8000{ep}"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=4) as response:
            status = response.status
            data = response.read().decode('utf-8')
            parsed = json.loads(data)
            if isinstance(parsed, list):
                print(f"[OK 200] {ep} -> list with {len(parsed)} items")
            elif isinstance(parsed, dict):
                total = parsed.get('total', parsed.get('total_materials', 'N/A'))
                print(f"[OK 200] {ep} -> dict total={total}, keys={list(parsed.keys())[:4]}")
    except urllib.error.HTTPError as e:
        print(f"[HTTP {e.code}] {ep}: {e.reason}")
    except Exception as e:
        print(f"[ERR] {ep}: {e}")
