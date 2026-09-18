import urllib.request
import json

endpoints = [
    '/health',
    '/api/materials?page=1&page_size=10',
    '/api/procurement/cpse-summary',
    '/api/procurement/clusters',
    '/api/procurement/opportunities',
    '/api/legacy-mapping?page=1&page_size=10',
    '/api/common-master?page=1&page_size=10',
    '/api/review/queue?page=1&page_size=10',
    '/api/review/metrics',
    '/api/datasets',
    '/api/matches?page=1&page_size=10',
    '/api/matches/candidates?page=1&page_size=10',
    '/api/validation/report',
    '/api/standardization/report'
]

for ep in endpoints:
    url = f"http://127.0.0.1:8000{ep}"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=4) as response:
            status = response.status
            data = response.read().decode('utf-8')
            try:
                parsed = json.loads(data)
                if isinstance(parsed, list):
                    info = f"list with {len(parsed)} items"
                elif isinstance(parsed, dict):
                    keys = list(parsed.keys())[:5]
                    info = f"dict keys: {keys}"
                    if 'total' in parsed:
                        info += f", total={parsed['total']}"
                    if 'count' in parsed:
                        info += f", count={parsed['count']}"
                else:
                    info = f"type: {type(parsed)}"
            except:
                info = f"{len(data)} chars"
            print(f"[OK 200] {ep} -> {info}")
    except urllib.error.HTTPError as e:
        print(f"[HTTP {e.code}] {ep}: {e.reason}")
    except Exception as e:
        print(f"[ERR] {ep}: {e}")
