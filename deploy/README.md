# Self-hosting this fork on a dedicated Linux server

A runbook for moving the Actual server off a personal machine onto an old
laptop running **Ubuntu Server 24.04 LTS**, using the Docker image that CI
builds from this fork (so all customizations come along).

The CI workflow (`.github/workflows/fork-docker.yml`) publishes
`ghcr.io/rallenblack/actual-server:latest` on every push to the deploy branch.
The laptop just pulls and runs it — it never builds anything heavy.

---

## 1. Install Ubuntu Server 24.04 LTS on the laptop

- Back up anything you need off the Win7 install first (this wipes the disk).
- Make a bootable USB with the Ubuntu Server 24.04 LTS ISO (use Rufus/balenaEtcher).
- Boot from USB, install. During setup:
  - Create your user account (remember the password — you'll `sudo` with it).
  - **Check "Install OpenSSH server"** so you can manage it remotely from your PC.
  - Skip the "featured server snaps" (we'll install Docker ourselves).
- After install + reboot, log in. Note the laptop's IP: `ip -4 addr | grep inet`.
- (Optional, recommended) close the lid without sleeping — laptops suspend on
  lid-close by default:
  ```bash
  sudo sed -i 's/#HandleLidSwitch=.*/HandleLidSwitch=ignore/' /etc/systemd/logind.conf
  sudo systemctl restart systemd-logind
  ```

## 2. Install Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"        # run docker without sudo
newgrp docker                          # apply the group now (or log out/in)
docker run --rm hello-world            # sanity check
```

## 3. Get the deploy files + pull the image

```bash
mkdir -p ~/actual && cd ~/actual
# copy deploy/docker-compose.yml here (scp from your PC, or curl from the repo)
mkdir -p actual-data
```

The image is in your **private** GitHub Container Registry. Two options:

- **Easiest — make the package public** (one time): on GitHub →
  your profile → **Packages** → `actual-server` → **Package settings** →
  **Change visibility → Public**. Then no login is needed.
- **Or keep it private** and log in on the laptop with a token:
  GitHub → Settings → Developer settings → **Personal access tokens (classic)**
  → generate one with **`read:packages`**, then:
  ```bash
  echo "<YOUR_TOKEN>" | docker login ghcr.io -u rallenblack --password-stdin
  ```

```bash
docker compose pull
```

## 4. Generate the HTTPS cert (self-signed)

HTTPS is required (browsers need a secure context for the in-browser database).
Put the cert where the compose file expects it, with the server's name/IP in the
SAN. Replace `<LAN_IP>` with the laptop's IP and pick a hostname:

```bash
HOST=budget-server          # whatever you want; reachable as <HOST>.local
LAN_IP=192.168.1.50         # the laptop's IP from step 1

openssl req -x509 -newkey rsa:2048 -nodes -days 3650 \
  -keyout actual-data/selfhost.key -out actual-data/selfhost.crt \
  -subj "/CN=$HOST" \
  -addext "subjectAltName=IP:$LAN_IP,IP:127.0.0.1,DNS:localhost,DNS:$HOST,DNS:$HOST.local"
```

## 5. Start it

```bash
docker compose up -d
docker compose logs -f        # should show "Listening on :::5006"
```

Open `https://<HOST>.local:5006` (or `https://<LAN_IP>:5006`) from a device on
the network, accept the self-signed warning, and set the **server password**.

## 6. Migrate your existing budget

Pick one:

- **Easiest — re-upload from a client:** on your phone/PC that already has the
  budget, point Actual at the new server (Settings → change server URL), log in,
  and the client uploads its local copy. Done.
- **Copy the data files:** stop the old server, copy its `user-files/` and
  `server-files/` into `~/actual/actual-data/` on the laptop, fix ownership
  (`sudo chown -R 1000:1000 actual-data`), then `docker compose up -d`.

## 7. Repoint devices

Point each device at `https://<HOST>.local:5006`, accept the cert once, and
re-add to the Home Screen. (When you set up Tailscale later, you'll switch to
the Tailscale hostname and a real trusted cert — no more warnings.)

## Updating later

When the fork changes, CI rebuilds the image automatically. On the laptop:

```bash
cd ~/actual && docker compose pull && docker compose up -d
```
