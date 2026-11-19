import json

path = r'C:\Users\harsh\.gemini\antigravity\brain\4c4006aa-1a26-44b8-8860-e640b61e39fc\.system_generated\logs\transcript.jsonl'
with open(path, 'r', encoding='utf-8') as f:
    for idx, line in enumerate(f):
        if idx in [2169, 2187]:
            d = json.loads(line)
            print(f'=== L{idx} ===')
            print(d.get('content'))
