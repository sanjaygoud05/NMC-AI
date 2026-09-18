import urllib.request
import json

url = "http://127.0.0.1:8000/api/analytics/cpse?dataset_id=BASELINE"
req = urllib.request.Request(url)
with urllib.request.urlopen(req, timeout=5) as resp:
    data = json.loads(resp.read().decode('utf-8'))
    cpse_data = data.get('cpse_data', {})
    print("CPSEs in cpse_data:", len(cpse_data), list(cpse_data.keys()))
    for k, v in cpse_data.items():
        print(f"  {k}: total={v.get('total_materials')}, active={v.get('active_materials')}")
