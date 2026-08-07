with open('index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for idx, line in enumerate(lines):
    if 'outboundactive' in line.lower() or 'sessionoutbound' in line.lower() or 'outboundworkstation' in line.lower():
        print(f"{idx+1}: {line.strip()}")
