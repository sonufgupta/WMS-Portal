import urllib.request
import json

url = "https://wms-portal-g-default-rtdb.asia-southeast1.firebasedatabase.app/wms_data.json"
try:
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode('utf-8'))
        
    inbound = data.get('inbound_history', [])
    outbound = data.get('outbound_history', [])
    
    print(f"Total Inbound Logs: {len(inbound)}")
    print(f"Total Outbound Logs: {len(outbound)}")
    
    # Analyze MONITOR Geonix 19.5" LED (HDMI)
    # and MONITOR Geonix 18.5" LED (HDMI)
    inbound_195 = 0
    inbound_185 = 0
    for log in inbound:
        items = log.get('items', [])
        for item in items:
            name = item.get('name', '')
            count = log.get('count', 0)
            if "19.5" in name:
                inbound_195 += len([s for s in log.get('serials', []) if "19.5" in s.get('itemName', '')])
            if "18.5" in name:
                inbound_185 += len([s for s in log.get('serials', []) if "18.5" in s.get('itemName', '')])
                
    outbound_195 = 0
    outbound_185 = 0
    for log in outbound:
        for s in log.get('serials', []):
            name = s.get('itemName', '')
            if "19.5" in name:
                outbound_195 += 1
            if "18.5" in name:
                outbound_185 += 1
                
    print(f"Inbound 19.5: {inbound_195}, Outbound 19.5: {outbound_195}, Diff: {inbound_195 - outbound_195}")
    print(f"Inbound 18.5: {inbound_185}, Outbound 18.5: {outbound_185}, Diff: {inbound_185 - outbound_185}")

except Exception as e:
    print(f"Error: {e}")
