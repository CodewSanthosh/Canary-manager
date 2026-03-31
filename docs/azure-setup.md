# Azure VM Deployment Guide

## Step-by-Step: Deploy Canary Release Manager on Azure

---

## Prerequisites

- Azure account (Free tier: $200 credit for 30 days at https://azure.microsoft.com/free)
- SSH client (Windows Terminal, PuTTY, or Git Bash)

---

## Step 1: Create a Resource Group

1. Go to [Azure Portal](https://portal.azure.com)
2. Search for **"Resource Groups"** in the top search bar
3. Click **"+ Create"**
4. Fill in:
   - **Subscription**: Your subscription
   - **Resource group**: `canary-manager-rg`
   - **Region**: Choose nearest (e.g., `East US`, `Central India`)
5. Click **"Review + Create"** → **"Create"**

---

## Step 2: Create a Virtual Machine

1. Search for **"Virtual Machines"** → Click **"+ Create"** → **"Azure Virtual Machine"**
2. Fill in the **Basics** tab:

| Field | Value |
|-------|-------|
| Resource group | `canary-manager-rg` |
| Virtual machine name | `canary-manager-vm` |
| Region | Same as resource group |
| Image | **Ubuntu Server 22.04 LTS - x64 Gen2** |
| Size | **Standard_B2s** (2 vCPUs, 4 GB RAM) |
| Authentication | **SSH public key** |
| Username | `azureuser` |
| SSH public key source | Generate new key pair |
| Key pair name | `canary-manager-key` |

3. **Disks** tab: Leave defaults (30 GB Standard SSD)

4. **Networking** tab:
   - Virtual network: Create new or use default
   - Public IP: **Create new** (Standard, Static)
   - NIC NSG: **Advanced**
   - Click **"Create new"** for NSG and add these inbound rules:

| Priority | Name | Port | Protocol |
|----------|------|------|----------|
| 300 | SSH | 22 | TCP |
| 310 | HTTP | 80 | TCP |
| 320 | HTTPS | 443 | TCP |
| 330 | Jenkins | 8080 | TCP |
| 340 | App-Direct | 3000 | TCP |

5. Click **"Review + Create"** → **"Create"**
6. **Download the SSH private key** when prompted

---

## Step 3: Connect to the VM

```bash
# Set permissions on the key file
chmod 400 ~/Downloads/canary-manager-key.pem

# Connect via SSH
ssh -i ~/Downloads/canary-manager-key.pem azureuser@<YOUR-VM-PUBLIC-IP>
```

Find your VM's public IP in: **Azure Portal → Virtual Machines → canary-manager-vm → Overview**

---

## Step 4: Upload Project Files

Option A - Using Git:
```bash
# On the VM
sudo apt install -y git
git clone https://github.com/YOUR_USERNAME/canary-manager.git /tmp/canary-setup
cd /tmp/canary-setup
```

Option B - Using SCP:
```bash
# From your local machine
scp -i ~/Downloads/canary-manager-key.pem -r "./Canary management system/*" azureuser@<VM-IP>:/tmp/canary-setup/
```

---

## Step 5: Run the Deployment Script

```bash
cd /tmp/canary-setup
chmod +x deploy.sh
sudo ./deploy.sh
```

This script will automatically:
- ✅ Update system packages
- ✅ Install Node.js 18.x
- ✅ Install and configure Jenkins
- ✅ Install and configure Nginx as reverse proxy
- ✅ Create a systemd service for the app
- ✅ Configure firewall rules

---

## Step 6: Access Your Applications

| Service | URL | Description |
|---------|-----|-------------|
| **Dashboard** | `http://<VM-IP>` | Canary Release Manager |
| **Jenkins** | `http://<VM-IP>:8080` | CI/CD Pipeline |
| **API** | `http://<VM-IP>/api/health` | Health endpoint |

---

## Step 7: Configure Jenkins

1. Open `http://<VM-IP>:8080` in your browser
2. Get the initial admin password:
   ```bash
   sudo cat /var/lib/jenkins/secrets/initialAdminPassword
   ```
3. Install **suggested plugins**
4. Create an admin user
5. Go to **Manage Jenkins → Plugins → Available** and install:
   - **NodeJS Plugin**
   - **Pipeline Plugin** (usually pre-installed)
6. Go to **Manage Jenkins → Tools → NodeJS installations**:
   - Name: `Node18`
   - Version: `18.x`
7. Create a **New Item**:
   - Name: `canary-pipeline`
   - Type: **Pipeline**
   - Pipeline → Definition: **Pipeline script from SCM** or paste the Jenkinsfile
8. Generate an API Token:
   - Go to your user → **Configure** → **API Token** → **Add new Token**
   - Copy the token
9. Update `.env` on the VM:
   ```bash
   sudo nano /opt/canary-manager/.env
   # Set JENKINS_TOKEN=your_token_here
   sudo systemctl restart canary-manager
   ```

---

## Step 8: Verify Everything

```bash
# Check app status
sudo systemctl status canary-manager

# Check Jenkins status  
sudo systemctl status jenkins

# Check Nginx status
sudo systemctl status nginx

# Test health endpoint
curl http://localhost:3000/api/health

# View app logs
sudo journalctl -u canary-manager -f
```

---

## Useful Commands

```bash
# Restart the app
sudo systemctl restart canary-manager

# View live logs
sudo journalctl -u canary-manager -f

# Restart Jenkins
sudo systemctl restart jenkins

# Restart Nginx
sudo systemctl restart nginx

# Check ports in use
sudo netstat -tlnp
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Cannot connect to VM | Check NSG rules in Azure Portal |
| App not loading | Run `sudo systemctl status canary-manager` |
| Jenkins not loading | Run `sudo systemctl status jenkins` |
| WebSocket not connecting | Ensure Nginx config has the `/ws` location block |
| Port 3000 blocked | Add port 3000 to NSG inbound rules |

---

## Cost Management

- **Standard_B2s**: ~$30/month
- **Stop the VM** when not in use to save costs
- **Azure Portal → VM → Stop** (you only pay for storage when stopped)
- Delete the resource group to remove everything: `az group delete --name canary-manager-rg`
