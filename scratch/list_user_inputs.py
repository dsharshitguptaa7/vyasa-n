import json

transcript_path = r'C:\Users\harsh\.gemini\antigravity\brain\e90803ef-432d-4cee-be21-9af6a6b6ad21\.system_generated\logs\transcript.jsonl'
with open(transcript_path, 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        data = json.loads(line)
        if data.get('type') == 'USER_INPUT':
            content = data.get('content', '')
            print(f"Step {i}: {content[:150]}...")
