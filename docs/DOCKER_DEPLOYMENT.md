# ReadInsight Docker Deployment

ReadInsight can run in Docker so it does not depend on the server's global
Node.js or pnpm versions. The container uses Node 22 and pnpm 11.0.6.

## Server Layout

```text
Nginx
  readinsight.bamamei.online -> 127.0.0.1:3000

/opt/readinsight
  Dockerfile
  docker-compose.yml
  .env
```

`box2bitable` can keep using its existing PM2 + Node setup. Dockerizing
ReadInsight does not require changing the other project.

## Environment

Create `/opt/readinsight/.env` on the server:

```bash
DATABASE_URL=postgresql://...
```

Do not commit `.env` to GitHub.

## Install Docker On Ubuntu

If Docker is not installed on the server yet:

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker ubuntu
```

After `usermod`, log out and log back in for the Docker group permission to
take effect.

## Build And Run

From `/opt/readinsight`:

```bash
docker compose up -d --build
```

Check status and logs:

```bash
docker compose ps
docker compose logs -f readinsight
```

The app listens inside the container on port `3000` and is exposed only on the
server loopback address:

```text
127.0.0.1:3000
```

Nginx should proxy public HTTPS traffic to that local address.

Application logs are persisted to:

```text
/opt/readinsight/logs
```

## Update Deployment

```bash
cd /opt/readinsight
git pull origin main
docker compose up -d --build
docker image prune -f
```

## Useful Commands

```bash
docker compose restart readinsight
docker compose down
docker compose logs --tail=100 readinsight
docker exec -it readinsight-web sh
```
