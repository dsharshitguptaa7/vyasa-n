import json

data = json.load(open('scratch/deduped_incentive_inventory.json', encoding='utf-8'))
print(f"Total deduplicated incentive certs: {len(data)}")
for x in data:
    print(f"{x['cert_no']} | Page {x['page']} | {x['recipient']} | {x['amount']} | Token: {x['token']}")
