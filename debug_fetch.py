import urllib.request
import re

url = "https://www.himalayacorp.com/fr/proprietes.html"
headers = {'User-Agent': 'Mozilla/5.0'}
req = urllib.request.Request(url, headers=headers)

try:
    with urllib.request.urlopen(req) as response:
        html = response.read().decode('utf-8')
        # Find the first item
        ul_match = re.search(r'<ul class="listeProp clearfix">(.*?)</ul>', html, re.DOTALL)
        if ul_match:
            ul_content = ul_match.group(1)
            # Take the first <li>
            first_li = re.search(r'<li[^>]*>(.*?)</li>', ul_content, re.DOTALL)
            if first_li:
                print("--- START FIRST LI ---")
                print(first_li.group(1))
                print("--- END FIRST LI ---")
            else:
                print("No <li> found in UL")
        else:
            print("No UL found")
except Exception as e:
    print(f"Error: {e}")
