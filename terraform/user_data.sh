# filepath: /home/gabor/Code/Practice/Apex/crypto-exchange/terraform/user_data.sh
#!/bin/bash
set -e

# Setup logging to both file and CloudWatch
exec > >(tee /var/log/user-data.log)
exec 2>&1

# Install CloudWatch agent first
yum install -y amazon-cloudwatch-agent awslogs

# Configure CloudWatch logs
cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json << 'EOF'
{
    "logs": {
        "logs_collected": {
            "files": {
                "collect_list": [
                    {
                        "file_path": "/var/log/user-data.log",
                        "log_group_name": "${log_group_name}",
                        "log_stream_name": "user-data-{instance_id}"
                    }
                ]
            }
        }
    }
}
EOF

# Start CloudWatch agent
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
    -a fetch-config \
    -m ec2 \
    -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json \
    -s

echo "=== DEPLOYMENT START: $(date) ==="
echo "Instance ID: $(curl -s http://169.254.169.254/latest/meta-data/instance-id)"
echo "Public IP: $(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)"
echo "User Data Script Version: 2.0"

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "=== Updating system... ==="
yum update -y

log "=== Installing Docker... ==="
yum install -y docker
systemctl start docker
systemctl enable docker
usermod -a -G docker ec2-user

# Verify Docker
if systemctl is-active --quiet docker; then
    log "✓ Docker is running"
    docker --version
else
    log "✗ Docker failed to start"
    systemctl status docker
    exit 1
fi

log "=== Installing Docker Compose... ==="
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Verify Docker Compose
if docker-compose --version; then
    log "✓ Docker Compose installed: $(docker-compose --version)"
else
    log "✗ Docker Compose installation failed"
    exit 1
fi

log "=== Installing Git and Node.js... ==="
yum install -y git
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
yum install -y nodejs

log "=== Installing pnpm... ==="
npm install -g pnpm

log "=== Setting up application directory... ==="
mkdir -p /app
cd /app

log "=== Cloning repository: ${github_repo} ==="
if git clone ${github_repo} .; then
    log "✓ Repository cloned successfully"
    log "Repository contents:"
    ls -la
else
    log "✗ Failed to clone repository"
    exit 1
fi

log "=== Checking out development branch ==="
git branch -a
if git checkout development; then
    log "✓ Switched to development branch"
    log "Current branch: $(git branch --show-current)"
    log "Last commit: $(git log -1 --oneline)"
else
    log "✗ Failed to checkout development branch"
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
required_files=("package.json" "next.config.js" "src/server/api/workers/Dockerfile")
for file in "$${required_files[@]}"; do
    if [ -f "$file" ]; then
        log "✓ Found: $file"
    else
        log "✗ Missing: $file"
        log "Current directory contents:"
        find . -name "*.json" -o -name "*.js" -o -name "Dockerfile" | head -20
    fi
done

log "=== Building and starting Docker containers... ==="
if docker-compose up -d --build; then
    log "✓ Docker Compose started successfully"
else
    log "✗ Docker Compose failed to start"
    log "=== Docker Compose logs: ==="
    docker-compose logs
    exit 1
fi

log "=== Waiting for containers to start (60 seconds)... ==="
sleep 60

log "=== Container status: ==="
docker ps -a

log "=== Checking container logs ==="
containers=("crypto-exchange-redis" "crypto-exchange-app" "crypto-exchange-workers")
for container in "$${containers[@]}"; do
    log "--- $container logs (last 50 lines) ---"
    docker logs --tail 50 "$container" 2>&1 || log "Container $container not found or not running"
done

log "=== Testing application connectivity ==="
for i in {1..5}; do
    if curl -f http://localhost:3000 --connect-timeout 10; then
        log "✓ Application is responding on port 3000 (attempt $i)"
        break
    else
        log "✗ Application not responding on port 3000 (attempt $i/5)"
        if [ $i -eq 5 ]; then
            log "=== Network debugging ==="
            netstat -tulpn | grep :3000 || log "Nothing listening on port 3000"
            log "=== Docker network inspection ==="
            docker network ls
            docker network inspect "$(docker-compose ps -q app | head -1)" 2>/dev/null || log "Cannot inspect app container network"
        else
            sleep 30
        fi
    fi
done

log "=== Creating monitoring and health check scripts ==="
# Create detailed health check
cat > /app/health-check.sh << 'EOF'
#!/bin/bash
log_file="/var/log/health-check.log"
exec >> "$log_file" 2>&1

echo "=== Health Check: $(date) ==="

# Check Docker daemon
if ! systemctl is-active --quiet docker; then
    echo "Docker service is down, restarting..."
    systemctl restart docker
    sleep 10
fi

cd /app

# Check each container
containers=("crypto-exchange-redis" "crypto-exchange-app" "crypto-exchange-workers")
for container in "$${containers[@]}"; do
    if ! docker ps --format "table {{.Names}}" | grep -q "$container"; then
        echo "$container is not running, restarting..."
        docker-compose restart "$${container#crypto-exchange-}"
        sleep 10
    else
        echo "$container is running ✓"
    fi
done

# Test application
if curl -f http://localhost:3000 --connect-timeout 5 >/dev/null 2>&1; then
    echo "Application health check: PASS ✓"
else
    echo "Application health check: FAIL ✗"
    echo "Restarting all services..."
    docker-compose restart
fi

echo "Health check completed."
EOF

chmod +x /app/health-check.sh

# Set up monitoring
echo "*/2 * * * * /app/health-check.sh" | crontab -

# Create status page
cat > /app/status.html << EOF
<!DOCTYPE html>
<html>
<head><title>Crypto Exchange Status</title></head>
<body>
    <h1>Crypto Exchange Deployment Status</h1>
    <p><strong>Status:</strong> Deployment completed successfully</p>
    <p><strong>Deployment Time:</strong> $(date)</p>
    <p><strong>Instance ID:</strong> $(curl -s http://169.254.169.254/latest/meta-data/instance-id)</p>
    <p><strong>Public IP:</strong> $(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)</p>
    <p><strong>Application:</strong> <a href="http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):3000">Access App on Port 3000</a></p>
    <h2>Container Status</h2>
    <pre>$(docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}")</pre>
</body>
</html>
EOF

# Start simple HTTP server for status
python3 -m http.server 80 --directory /app >/dev/null 2>&1 &

log "=== DEPLOYMENT COMPLETED: $(date) ==="
log "Application URL: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):3000"
log "Status page: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)/status.html"
log "To debug, use AWS Session Manager to connect to this instance"