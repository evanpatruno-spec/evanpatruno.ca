import re

with open("prop_detail.html", "r", encoding="utf-8") as f:
    html = f.read()

print("--- DEBUGGING DESCRIPTION ---")
# Current Regex
desc_match = re.search(r'<div id="descriptionProp".*?<div class="slideTexte">\s*(.*?)\s*</div>', html, re.DOTALL)
if desc_match:
    print("MATCH FOUND!")
    print(desc_match.group(1)[:100])
else:
    print("NO MATCH for descriptionProp")
    # Try finding just the ID to see if it exists
    if 'id="descriptionProp"' in html:
        print("id='descriptionProp' exists.")
        # Print surroundings
        idx = html.find('id="descriptionProp"')
        print(html[idx:idx+300])
    else:
        print("id='descriptionProp' NOT found.")

print("\n--- DEBUGGING BROKERS ---")
# Current Regex
brokers = []
broker_matches = re.finditer(r'<h6><a [^>]+>([^<]+)</a></h6>', html)
count = 0
for match in broker_matches:
    print(f"Found broker: {match.group(1)}")
    count += 1
if count == 0:
    print("NO MATCH for brokers")
    if 'courtierProp' in html:
        print("#courtierProp exists.")
        idx = html.find('id="courtierProp"')
        print(html[idx:idx+500])
