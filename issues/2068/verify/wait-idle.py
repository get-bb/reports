import json, sys, time, urllib.request
url = sys.argv[1]
for _ in range(90):
    d = json.load(urllib.request.urlopen(url))
    print(d["status"], d["environmentId"], d["archivedAt"], flush=True)
    if d["status"] == "idle":
        break
    time.sleep(2)
