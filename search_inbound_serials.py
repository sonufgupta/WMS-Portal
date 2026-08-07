import urllib.request
import json

url = "https://wms-portal-g-default-rtdb.asia-southeast1.firebasedatabase.app/wms_data.json"
try:
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode('utf-8'))
        
    inbound = data.get('inbound_history', [])
    
    # Collect all inbound serials containing '63156' or similar numbers, or print a sample of inbound serials
    samples = []
    found_matches = []
    
    search_targets = ['63156', '63157', '62911', '62912', '62881', '63481']
    
    for log in inbound:
        for s in log.get('serials', []):
            serial = s.get('serial', '')
            samples.append(serial)
            for target in search_targets:
                if target in serial:
                    found_matches.append((serial, s.get('itemName', ''), log.get('timestamp'), log.get('vehicle')))

    print(f"Sample inbound serials (first 10):")
    for s in samples[:15]:
        print(f"  {s}")
        
    print(f"\nMatches found in Inbound for our search targets:")
    if found_matches:
        for match in found_matches:
            print(f"  Serial: '{match[0]}', Item: '{match[1]}', Time: {match[2]}, Vehicle: {match[3]}")
    else:
        print("  No matches found at all!")

except Exception as e:
    print(f"Error: {e}")
