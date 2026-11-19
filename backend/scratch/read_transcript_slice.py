import json

path = r'C:\Users\harsh\.gemini\antigravity\brain\9482885b-f9ad-4872-a348-f87e0cdf3079\.system_generated\logs\transcript.jsonl'
with open(path, 'r', encoding='utf-8') as f:
    for idx, line in enumerate(f):
        if idx in range(335, 345) or idx in range(390, 402):
            d = json.loads(line)
            tp = d.get('type')
            src = d.get('source')
            cnt = str(d.get('content', ''))[:300].replace('\n', ' ')
            print(f'L{idx}: {tp} | {src} | {cnt}')
