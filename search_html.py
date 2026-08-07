with open('index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for idx, line in enumerate(lines):
    if 'nav-link' in line or 'sidebar-menu' in line or 'content-section' in line or 'outboundConfigModal' in line or 'outboundHistoryTable' in line:
        print(f"{idx+1}: {line.strip()}")
