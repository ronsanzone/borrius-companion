#!/usr/bin/env python3
"""Cloudflare API helper using local Wrangler OAuth; never prints credentials."""
import json, pathlib, re, sys, urllib.request, urllib.error
cfg=(pathlib.Path.home()/'Library/Preferences/.wrangler/config/default.toml').read_text()
token=re.search(r'oauth_token\s*=\s*"([^"]+)"',cfg).group(1)
method,endpoint=sys.argv[1:3]
body=pathlib.Path(sys.argv[3]).read_bytes() if len(sys.argv)>3 else None
req=urllib.request.Request('https://api.cloudflare.com/client/v4'+endpoint,data=body,method=method,headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'})
try:
 with urllib.request.urlopen(req) as r: print(r.read().decode())
except urllib.error.HTTPError as e:
 print(e.read().decode());sys.exit(1)
