#!/bin/bash
set -e
echo "User data started" > /tmp/user-data-debug.txt

# Setup logging to both file and CloudWatch
exec > >(tee /var/log/user-data.log)
exec 2>&1

echo "=== DEPLOYMENT START: $(date) ==="
echo "Instance ID: $(curl -s http://169.254.169.254/latest/meta-data/instance-id)"
echo "Public IP: $(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)"
echo "User Data Script Version: 3.0"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "=== Updating system... ==="
yum update -y

log "=== Installing basic packages... ==="
yum install -y wget curl unzip git python3

log "=== Installing CloudWatch agent... ==="
wget https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm
rpm -U ./amazon-cloudwatch-agent.rpm

# Configure CloudWatch logs
cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json <<EOF
{
    "logs": {
        "logs_collected": {
            "files": {
                "collect_list": [
                    {
                        "file_path": "/var/log/user-data.log",
                        "log_group_name": "${log_group_name}",
                        "log_stream_name": "user-data-$(curl -s http://169.254.169.254/latest/meta-data/instance-id)"
                    }
                ]
            }
        }
    }
}
EOF

/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
    -a fetch-config \
    -m ec2 \
    -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json \
    -s

log "=== Installing Docker... ==="
yum install -y docker
systemctl start docker
systemctl enable docker
usermod -a -G docker ec2-user

if systemctl is-active --quiet docker; then
    log "Docker is running"
    docker --version
else
    log "Docker failed to start"
    systemctl status docker
    exit 1
fi

log "=== Installing Docker Compose... ==="
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose

if docker-compose --version; then
    log "Docker Compose installed: $(docker-compose --version)"
else
    log "Docker Compose installation failed"
    exit 1
fi

log "=== Installing latest buildx plugin... ==="
mkdir -p ~/.docker/cli-plugins/
curl -L https://github.com/docker/buildx/releases/latest/download/buildx-linux-amd64 -o ~/.docker/cli-plugins/docker-buildx
chmod +x ~/.docker/cli-plugins/docker-buildx

log "=== Installing Node.js 16... ==="
curl -fsSL https://rpm.nodesource.com/setup_16.x | bash -
yum install -y nodejs

if node --version && npm --version; then
    log "Node.js installed: $(node --version), npm: $(npm --version)"
else
    log "Node.js installation failed"
    exit 1
fi

log "=== Setting up application directory... ==="
mkdir -p /app
cd /app

log "=== Cloning repository: ${github_repo} ==="
if git clone "${github_repo}" .; then
    log "Repository cloned successfully"
    log "Repository contents:"
    ls -la
else
    log "Failed to clone repository"
    exit 1
fi

log "=== Checking out development branch ==="
git branch -a
if git checkout development; then
    log "Switched to development branch"
    log "Current branch: $(git branch --show-current)"
    log "Last commit: $(git log -1 --oneline)"
else
    log "Failed to checkout development branch"
    log "Available branches:"
    git branch -a
    exit 1
fi

log "=== Creating configuration files ==="
echo "${env_content}" | base64 -d > .env.production
echo "${docker_compose_content}" | base64 -d > docker-compose.yml

log "=== Configuration files created ==="
log "Files in /app:"
ls -la /app/

log "=== Docker Compose configuration: ==="
cat docker-compose.yml

log "=== Environment configuration: ==="
cat .env.production

log "=== Checking required files exist ==="
required_files="package.json next.config.js"
for file in $required_files; do
    if [ -f "$file" ]; then
        log "Found: $file"
    else
        log "Missing: $file"
        log "Current directory contents:"
        find . -name "*.json" -o -name "*.js" -o -name "Dockerfile" | head -20
    fi
done

log "=== Building Docker image manually ==="
if docker build -f Dockerfile.prod -t crypto-exchange-app:latest .; then
    log "Docker image built successfully"
else
    log "Docker image build failed"
    exit 1
fi

log "=== Starting containers without build ==="
if docker-compose up -d; then
    log "Docker Compose started successfully"
else
    log "Docker Compose failed to start"
    log "=== Docker Compose logs: ==="
    docker-compose logs
    exit 1
fi

log "=== Building and starting Docker containers... ==="
if docker-compose up -d --build; then
    log "Docker Compose started successfully"
else
    log "Docker Compose failed to start"
    log "=== Docker Compose logs: ==="
    docker-compose logs
    exit 1
fi

log "=== Waiting for containers to start (60 seconds)... ==="
sleep 60

log "=== Container status: ==="
docker ps -a

log "=== Checking container logs ==="
containers="crypto-exchange-redis crypto-exchange-app"
for container in $containers; do
    log "--- $container logs (last 50 lines) ---"
    docker logs --tail 50 "$container" 2>&1 || log "Container $container not found or not running"
done

log "=== Creating monitoring and health check scripts ==="
cat > /app/health-check.sh <<'HEALTH_EOF'
#!/bin/bash
log_file="/var/log/health-check.log"
exec >> "$log_file" 2>&1

echo "=== Health Check: $(date) ==="

if ! systemctl is-active --quiet docker; then
    echo "Docker service is down, restarting..."
    systemctl restart docker
    sleep 10
fi

cd /app

containers="crypto-exchange-redis crypto-exchange-app"
for container in $containers; do
    if ! docker ps --format "table {{.Names}}" | grep -q "$container"; then
        echo "$container is not running, restarting..."
        docker-compose restart "$container"
        sleep 10
    else
        echo "$container is running [OK]"
    fi
done

if curl -f http://localhost:80 --connect-timeout 5 >/dev/null 2>&1; then
    echo "Application health check: PASS [OK]"
else
    echo "Application health check: FAIL [ERROR]"
    echo "Restarting all services..."
    docker-compose restart
fi

echo "Health check completed."
HEALTH_EOF

chmod +x /app/health-check.sh
echo "*/2 * * * * /app/health-check.sh" | crontab -

cat > /app/status.html <<'STATUS_EOF'
<!DOCTYPE html>
<html>
<head><title>Crypto Exchange Status</title></head>
<body>
    <h1>Crypto Exchange Deployment Status</h1>
    <p><strong>Status:</strong> Deployment completed successfully</p>
    <p><strong>Deployment Time:</strong> $(date)</p>
    <p><strong>Instance ID:</strong> $(curl -s http://169.254.169.254/latest/meta-data/instance-id)</p>
    <p><strong>Public IP:</strong> $(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)</p>
    <p><strong>Application:</strong> <a href="http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)">Access App on Port 80</a></p>
    <h2>Container Status</h2>
    <pre>$(docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}")</pre>
</body>
</html>
STATUS_EOF

python3 -m http.server 8080 --directory /app >/dev/null 2>&1 &

log "=== DEPLOYMENT COMPLETED: $(date) ==="
log "Application URL: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)"
log "Status page: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):8080/status.html"
log "To debug, use AWS Session Manager to connect to this instance"