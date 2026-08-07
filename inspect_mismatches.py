import urllib.request
import json

url = "https://wms-portal-g-default-rtdb.asia-southeast1.firebasedatabase.app/wms_data.json"
try:
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode('utf-8'))
        
    inbound = data.get('inbound_history', [])
    outbound = data.get('outbound_history', [])
    
    inbound_serials = set()
    inbound_serials_lower = {}
    for log in inbound:
        for s in log.get('serials', []):
            serial = s.get('serial', '')
            inbound_serials.add(serial)
            inbound_serials_lower[serial.lower().strip()] = serial

    print(f"Total Unique Inbound Serials: {len(inbound_serials)}")

    # Let's check outbound serials
    outbound_serials = []
    for log in outbound:
        for s in log.get('serials', []):
            outbound_serials.append({
                'serial': s.get('serial', ''),
                'itemName': s.get('itemName', ''),
                'shop': log.get('shopName', ''),
                'invoice': log.get('invoiceNo', '')
            })

    print(f"Total Outbound Serials Scans: {len(outbound_serials)}")

    not_found_exact = []
    found_case_insensitive = []
    for obs in outbound_serials:
        serial = obs['serial']
        serial_clean = serial.lower().strip()
        if "WOS" in serial:
            continue
        if serial not in inbound_serials:
            if serial_clean in inbound_serials_lower:
                found_case_insensitive.append((serial, inbound_serials_lower[serial_clean]))
            else:
                not_found_exact.append(obs)

    print(f"\nOutbound serials matched case-insensitively but not exactly: {len(found_case_insensitive)}")
    for o_s, i_s in found_case_insensitive[:10]:
        print(f"  Outbound: '{o_s}' vs Inbound: '{i_s}'")

    print(f"\nOutbound serials NOT found in inbound AT ALL (case-insensitively): {len(not_found_exact)}")
    for obs in not_found_exact:
        print(f"  Serial: '{obs['serial']}', Item: '{obs['itemName']}', Shop: '{obs['shop']}', Invoice: '{obs['invoice']}'")

except Exception as e:
    print(f"Error: {e}")
