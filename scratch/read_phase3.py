import json

transcript_path = r'C:\Users\harsh\.gemini\antigravity\brain\e90803ef-432d-4cee-be21-9af6a6b6ad21\.system_generated\logs\transcript_full.jsonl'
with open(transcript_path, 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if i == 1677:
            data = json.loads(line)
            content = data.get('content', '')
            lines = content.split('\n')
            start = False
            for l in lines:
                if 'PHASE 3' in l:
                    start = True
                if start and 'PHASE 4' in l:
                    break
                if start:
                    print(l)
            break
