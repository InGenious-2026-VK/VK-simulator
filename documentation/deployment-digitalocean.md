# Deploying FoodChainIQ to DigitalOcean with CI/CD

Every push to `main` runs the backend tests and the frontend build on GitHub
Actions. If both pass, the workflow SSHes into a DigitalOcean droplet, checks
out the pushed commit, and runs `docker compose up -d --build`. Pull requests
run the tests only.

Workflow file: [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)

```
git push main ──► GitHub Actions ──► backend tests + frontend build
                                         │ (both pass)
                                         ▼
                                   SSH to droplet
                                   git checkout <sha>
                                   docker compose up -d --build
                                   health check /api/health
```

## 1. Create the droplet

In the DigitalOcean control panel: **Create → Droplets**

- **Image:** Marketplace → **Docker on Ubuntu** (Docker and the compose plugin
  are preinstalled), or plain Ubuntu 24.04 and install Docker yourself.
- **Size:** Basic, **2 GB RAM** (about $12/month) is recommended. The 1 GB
  size works only if you add swap (step 2), because building the frontend
  and running Postgres need the memory.
- **Authentication:** SSH key (add your own public key).

Note the droplet's IP address.

## 2. Prepare the server (one time)

SSH in as root:

```bash
ssh root@YOUR_DROPLET_IP
```

Create a `deploy` user that can run Docker:

```bash
adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
```

Firewall: allow SSH and the web ports only:

```bash
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw --force enable
```

Optional, needed on 1 GB droplets: add 2 GB of swap.

```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

## 3. Give the droplet read access to the repository

The repository is private, so the droplet needs a **deploy key** to pull.

On the droplet, as `deploy`:

```bash
su - deploy
ssh-keygen -t ed25519 -f ~/.ssh/github_deploy -N ""
cat ~/.ssh/github_deploy.pub
```

On GitHub, go to the repository's **Settings → Deploy keys → Add deploy key**,
paste the public key, and leave **Allow write access** unchecked.

Back on the droplet:

```bash
cat >> ~/.ssh/config <<'EOF'
Host github.com
  IdentityFile ~/.ssh/github_deploy
  IdentitiesOnly yes
EOF
git clone git@github.com:InGenious-2026-VK/VK-simulator.git ~/VK-simulator
```

## 4. Create the production `.env`

`.env` is git-ignored and stays on the server. Deploys never overwrite it.

```bash
cd ~/VK-simulator
cp .env.example .env
nano .env
```

Change at least the following:

| Setting | Value |
|---|---|
| `POSTGRES_PASSWORD` | a strong password (`openssl rand -hex 24`) |
| `JWT_SECRET` | `openssl rand -hex 32` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | your real admin login |
| `SEED_DEMO` | `false` for a real deployment |
| `APP_PORT` | `80` to serve on plain HTTP directly, or keep `8080` behind the HTTPS proxy in step 7 |
| `COOKIE_SECURE` | `true` once the site is served over HTTPS |
| `CORS_ORIGINS` | your public URL, e.g. `https://foodchainiq.example.com` |

Set `POSTGRES_PASSWORD` **before the first start**. Postgres stores the
password when it creates the `db-data` volume and ignores later changes.

First start, by hand:

```bash
docker compose up -d --build
curl http://127.0.0.1:8080/api/health
```

## 5. Create the CI key and add GitHub secrets

This second key lets GitHub Actions SSH into the droplet. Create it on your
own computer, not on the droplet:

```bash
ssh-keygen -t ed25519 -f do_actions_key -N "" -C "github-actions"
ssh-copy-id -i do_actions_key.pub deploy@YOUR_DROPLET_IP
```

On GitHub, go to **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|---|---|
| `DROPLET_HOST` | the droplet IP |
| `DROPLET_USER` | `deploy` |
| `DROPLET_SSH_KEY` | the full contents of `do_actions_key` (the private key) |

Optional: if you cloned somewhere other than `~/VK-simulator`, add a
**Variables** entry named `APP_DIR` with that path.

The deploy job uses a GitHub **environment** named `production`. It is
created automatically on the first run. Under **Settings → Environments →
production** you can add required reviewers if you want to approve deploys
manually.

## 6. Push and watch

Merge or push to `main`, then open the repository's **Actions** tab. The
`deploy` job runs after `backend-tests` and `frontend-build` pass and fails if
`/api/health` doesn't respond within about 2.5 minutes. When it fails, the job
log includes `docker compose ps` and the last container logs.

You can also start a deploy by hand: **Actions → CI/CD → Run workflow**.

## 7. HTTPS with a domain (recommended)

Point an `A` record for your domain at the droplet IP, keep `APP_PORT=8080`,
and install Caddy on the droplet as root. Caddy fetches and renews the
certificate automatically:

```bash
apt install -y caddy
cat > /etc/caddy/Caddyfile <<'EOF'
foodchainiq.example.com {
    reverse_proxy 127.0.0.1:8080
}
EOF
systemctl reload caddy
```

Then set `COOKIE_SECURE=true` and `CORS_ORIGINS=https://foodchainiq.example.com`
in `.env`, and apply the change:

```bash
docker compose up -d
```

Because `APP_PORT` publishes on all interfaces, also close port 8080 to the
outside. `ufw` (step 2) already blocks it unless you allowed it, but Docker
can bypass `ufw` for published ports. To be safe, set
`APP_PORT=127.0.0.1:8080` in `.env`.

## Rollback

On the droplet:

```bash
cd ~/VK-simulator
git checkout <previous-good-sha>
docker compose up -d --build
```

Or revert the commit on `main` and push. The pipeline deploys the revert.

## Backups

The database lives in the `foodchainiq_db-data` Docker volume. Uploaded files
live in `foodchainiq_storage`. Either turn on DigitalOcean droplet backups
(+20% of the droplet price), or dump the database regularly:

```bash
docker compose exec -T db pg_dump -U foodchainiq foodchainiq | gzip > ~/backup-$(date +%F).sql.gz
```
