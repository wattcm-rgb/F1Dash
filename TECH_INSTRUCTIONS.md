# F1 Dash — Tech Instructions

Operational guide for the self-hosted OpenF1 backend and the GitHub Pages frontend.

- **VPS IP:** `167.233.76.227`
- **OpenF1 API:** `http://167.233.76.227:8000/v1`
- **Live site:** https://wattcm-rgb.github.io/F1Dash/
- **Repo:** https://github.com/wattcm-rgb/F1Dash

---

## 1. Connecting to the server

From PowerShell on your PC:

```bash
ssh root@167.233.76.227
```

Enter the root password when prompted (set in the Hetzner console under your server → Rescue/Root password, or reset it there if lost).

Once connected, the OpenF1 stack lives in:

```bash
cd openf1
```

> If your prompt ever looks wrong (e.g. you pasted chat text by accident), just close the terminal and reconnect with `ssh root@167.233.76.227`.

---

## 2. The OpenF1 stack

Defined in `~/openf1/docker-compose.yml`. Services:

| Service | Role |
|---|---|
| `api` | Serves the REST API on port 8000 |
| `mongo` | MongoDB 7 database (stores all timing data) |
| `mqtt` | Message broker the realtime ingestor uses |
| `ingest-realtime` | Captures **live** session data from F1's timing feed |
| `ingest-historical` | Backfills past data — **currently broken** (see §6) |

The VPS runs 24/7. You only start `ingest-realtime` during sessions.

---

## 3. Ingesting live data (the main workflow)

**Run before each session** (practice, qualifying, sprint, race):

```bash
cd openf1
docker compose up ingest-realtime -d
```

`-d` = detached (runs in the background, survives closing the terminal).

**Watch it capturing** (optional):

```bash
docker compose logs ingest-realtime --follow
```

Press **Ctrl+C** to stop watching — the service keeps running.

**Stop after the session ends:**

```bash
docker compose stop ingest-realtime
```

### What's normal
- Outside a live session you'll see repeating warnings like
  `File '/tmp/...' is empty after 5 minutes. Killing subprocess...`
  That's expected — there's nothing to record, so it loops. Not an error.
- During a live session the logs fill with topic data and MongoDB starts populating.

---

## 4. Checking status

```bash
docker ps                          # what's running
docker compose ps                  # status of compose services
curl http://localhost:8000/v1/sessions   # API responds with JSON if healthy
```

From your PC's browser you can also hit:
`http://167.233.76.227:8000/v1/sessions`

An empty array `[]` means the API works but no data is ingested yet.

---

## 5. Starting / stopping / restarting the whole stack

```bash
cd openf1
docker compose up -d          # start everything (api, mongo, mqtt)
docker compose stop           # stop everything (keeps data)
docker compose restart api    # restart a single service
docker compose down           # stop + remove containers (KEEPS data volumes)
```

After a server reboot, bring the core services back with:

```bash
cd openf1 && docker compose up -d
```

---

## 6. Known issue: historical backfill is broken (403)

`docker compose up ingest-historical` fails with:

```
response = <Response [403]>
url = 'https://livetiming.formula1.com/static/2026/Index.json'
JSONDecodeError: Expecting value: line 1 column 1 (char 0)
```

F1 now blocks access to their static season index, so **historical backfill does not work**. Don't rely on it. The only way to get data is live capture with `ingest-realtime` during sessions.

Stop it if it's running:

```bash
docker compose stop ingest-historical
```

---

## 7. Fixing MongoDB

### Symptom: Mongo crashes with exit code 139 (segfault)
MongoDB 8 segfaults on this small server. We pin **MongoDB 7** in `docker-compose.yml`:

```yaml
  mongo:
    image: "mongo:7"
```

If you ever see exit code 139, confirm the image says `mongo:7`, not `mongo:8`.

### Symptom: Mongo has no IP / containers can't reach `mongo`
The network/volumes got into a bad state. Full clean restart:

```bash
cd openf1
docker compose down -v        # ⚠️ -v DELETES the data volumes
docker compose up -d
```

> ⚠️ `down -v` wipes all stored timing data. Only use it when the database
> is genuinely broken. Plain `docker compose down` (no `-v`) keeps data.

### Inspect Mongo
```bash
docker compose logs mongo --tail 50      # recent mongo logs
docker exec -it openf1-mongo-1 mongosh    # open a mongo shell
```

In the mongo shell:
```javascript
show dbs
use openf1
show collections
db.sessions.countDocuments()
```

---

## 8. Editing files on the server (nano)

```bash
nano docker-compose.yml
```

- Edit with arrow keys
- Save: **Ctrl+O**, then **Enter**
- Exit: **Ctrl+X**

After editing compose, apply changes:

```bash
docker compose up -d
```

---

## 9. Disk / housekeeping

```bash
df -h                     # disk space
docker system df          # space used by docker
docker compose logs --tail 100   # recent logs across services
docker image prune -a     # remove unused images to free space
```

---

## 10. Firewall

Port **8000** must be open inbound for the dashboard to reach the API.
In the Hetzner console: your server → Firewalls → allow TCP 8000.

---

## 11. Frontend (GitHub Pages) deploy flow

The site is a static React build deployed to the `gh-pages` branch. Source lives on `main`.

From the project folder on your PC (`F1 Dash`):

```bash
# 1. Build (needs Node on PATH)
npm run build

# 2. Copy the build onto gh-pages and push
git add -A && git commit -m "your message"
git checkout gh-pages
rm -f assets/*.js assets/*.css
cp dist/assets/* assets/
cp dist/index.html .
git add index.html assets/
git commit -m "Deploy"
git push origin gh-pages
git checkout main
git push origin main
```

GitHub Pages serves from the `gh-pages` branch root. Each build produces new
hashed asset filenames, so browser caching is never an issue.

### Notes
- Node lives at `C:\Program Files\nodejs` — if `npm` isn't found, that needs to be on PATH.
- The frontend points at `http://167.233.76.227:8000/v1` in `src/services/openf1Api.ts`.
- Live pages poll the API every 4 seconds during sessions; outside sessions they show the most recent data or an empty state.

---

## 12. Race weekend checklist

1. SSH in: `ssh root@167.233.76.227` → `cd openf1`
2. Make sure core stack is up: `docker compose up -d`
3. Before first session: `docker compose up ingest-realtime -d`
4. Confirm capture: `docker compose logs ingest-realtime --follow` (Ctrl+C to exit)
5. Open the dashboard and watch live timing
6. After the weekend: `docker compose stop ingest-realtime`

> Data only exists for sessions where `ingest-realtime` was running. There's
> no backfill, so start it before every session you want to see.
