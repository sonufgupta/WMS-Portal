import urllib.request
import json

url = "https://wms-portal-g-default-rtdb.asia-southeast1.firebasedatabase.app/wms_data.json"
try:
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode('utf-8'))
        
    inbound = data.get('inbound_history', [])
    outbound = data.get('outbound_history', [])
    
    # Let's count how many inbound serials there are for each item
    inbound_serials_count = {}
    for log in inbound:
        serials = log.get('serials', [])
        for s in serials:
            item = s.get('itemName', '')
            inbound_serials_count[item] = inbound_serials_count.get(item, 0) + 1
            
    print("Inbound Serials count per product:")
    for k, v in inbound_serials_count.items():
        print(f"  {k}: {v}")
        
    # Let's count how many outbound serials there are for each item
    outbound_serials_count = {}
    outbound_serials_set = set()
    for log in outbound:
        serials = log.get('serials', [])
        for s in serials:
            item = s.get('itemName', '')
            outbound_serials_count[item] = outbound_serials_count.get(item, 0) + 1
            outbound_serials_set.add(s.get('serial', ''))
            
    print("\nOutbound Serials count per product in logs:")
    for k, v in outbound_serials_count.items():
        print(f"  {k}: {v}")
        
    # Let's calculate the stock using the app.js logic:
    # 1. outboundSerialsSet
    # 2. Loop through inbound history: if not in outboundSerialsSet, count as available
    available_serials_count = {}
    for log in inbound:
        serials = log.get('serials', [])
        for s in serials:
            item = s.get('itemName', '')
            serial = s.get('serial', '')
            if serial not in outbound_serials_set:
                available_serials_count[item] = available_serials_count.get(item, 0) + 1
                
    print("\nCalculated Available Stock (excluding outboundSerialsSet matches):")
    for k, v in available_serials_count.items():
        print(f"  {k}: {v}")
        
    # Let's check if there are WOS logs for these monitors!
    print("\nWOS (Without Serial) Inbound logs:")
    for log in inbound:
        if not log.get('serials'):
            print(f"  Item: {log.get('item')}, Count: {log.get('count')}, Vehicle: {log.get('vehicle')}")
            
    print("\nWOS (Without Serial) Outbound logs:")
    for log in outbound:
        serials = log.get('serials', [])
        # check if any serial is a WOS serial
        wos_serials = [s for s in serials if "WOS" in s.get('serial', '')]
        if wos_serials or not serials:
            print(f"  Log ID: {log.get('id')}, Shop: {log.get('shopName')}, Serials Count: {len(serials)}, WOS Serials: {len(wos_serials)}")

except Exception as e:
    print(f"Error: {e}")
