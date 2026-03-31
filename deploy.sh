#!/bin/bash
# ============================================
# Canary Release Manager - Azure VM Deployment
# Run this script on a fresh Ubuntu 22.04 VM
# ============================================

set -e

echo "╔══════════════════════════════════════════╗"
echo "║  🐤 Canary Release Manager - Setup       ║"
echo "╚══════════════════════════════════════════╝"

# ---- 1. System Update ----
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# ---- 2. Install Node.js 18.x ----
echo "📥 Installing Node.js 18.x..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
echo "Node.js version: $(node -v)"
echo "npm version: $(npm -v)"

# ---- 3. Install Git ----
echo "📥 Installing Git..."
sudo apt install -y git

# ---- 4. Install Nginx ----
echo "📥 Installing Nginx..."
sudo apt install -y nginx
sudo systemctl enable nginx

# ---- 5. Install Jenkins ----
echo "📥 Installing Jenkins..."
sudo apt install -y fontconfig openjdk-17-jre
sudo wget -O /usr/share/keyrings/jenkins-keyring.asc https://pkg.jenkins.io/debian-stable/jenkins.io-2023.key
echo "deb [signed-by=/usr/share/keyrings/jenkins-keyring.asc] https://pkg.jenkins.io/debian-stable binary/" | sudo tee /etc/apt/sources.list.d/jenkins.list > /dev/null
sudo apt update
sudo apt install -y jenkins
sudo systemctl enable jenkins
sudo systemctl start jenkins

# ---- 6. Setup Application ----
echo "🔧 Setting up application..."
APP_DIR="/opt/canary-manager"
sudo mkdir -p $APP_DIR

# If running from the project directory
if [ -f "package.json" ]; then
    sudo cp -r ./* $APP_DIR/
else
    echo "⚠ No project files found. Clone your repo manually:"
    echo "  sudo git clone <your-repo-url> $APP_DIR"
fi

cd $APP_DIR
sudo npm install --production

# Create .env file
sudo cp .env.example .env 2>/dev/null || true

# ---- 7. Create systemd service ----
echo "🔧 Creating systemd service..."
sudo cat > /etc/systemd/system/canary-manager.service << 'EOF'
[Unit]
Description=Canary Release Manager
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/canary-manager
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable canary-manager
sudo systemctl start canary-manager

# ---- 8. Configure Nginx reverse proxy ----
echo "🔧 Configuring Nginx..."
sudo cat > /etc/nginx/sites-available/canary-manager << 'EOF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    location /ws {
        proxy_pass http://localhost:3000/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/canary-manager /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

# ---- 9. Configure Firewall ----
echo "🔒 Configuring firewall..."
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (Nginx)
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 8080/tcp  # Jenkins
sudo ufw --force enable

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  ✅ Setup Complete!                       ║"
echo "║                                          ║"
echo "║  Dashboard: http://<VM-IP>               ║"
echo "║  Jenkins:   http://<VM-IP>:8080          ║"
echo "║                                          ║"
echo "║  Jenkins initial password:               ║"
echo "╚══════════════════════════════════════════╝"
echo ""
sudo cat /var/lib/jenkins/secrets/initialAdminPassword 2>/dev/null || echo "Jenkins not yet initialized"
echo ""
echo "Done! 🎉"
