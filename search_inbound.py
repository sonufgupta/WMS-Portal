with open(r'c:\Users\Dell\OneDrive\Desktop\warehouse-activity\app.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()
for idx, line in enumerate(lines):
    if 'btncollapsesidebar' in line.lower():
        print(f"{idx+1}: {line.strip()}")
