"""Commit enriched-events.json to GitHub via the Contents API."""
import json
import base64
import os
import urllib.request
import sys

token = os.environ["GH_TOKEN"]
repo = os.environ["GH_REPO"]
sha = os.environ["SHA"]

with open("data/enriched-events.json", "rb") as f:
    content = base64.b64encode(f.read()).decode()

payload = json.dumps({
    "message": "chore: update enriched events [skip ci]",
    "content": content,
    "sha": sha,
    "committer": {"name": "vuily-bot", "email": "bot@vuily.fun"},
}).encode()

url = f"https://api.github.com/repos/{repo}/contents/data/enriched-events.json"
req = urllib.request.Request(url, data=payload, method="PUT", headers={
    "Authorization": f"Bearer {token}",
    "Accept": "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
})

try:
    with urllib.request.urlopen(req) as res:
        result = json.loads(res.read())
        print(f"Committed: {result['commit']['sha']}")
except urllib.error.HTTPError as e:
    print(f"API error {e.code}: {e.read().decode()}", file=sys.stderr)
    sys.exit(1)
