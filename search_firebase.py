with open('app.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for idx, line in enumerate(lines):
    if 'getdamagerecords' in line.lower() or 'savedamagerecords' in line.lower():
        print(f"{idx+1}: {line.strip()}")
