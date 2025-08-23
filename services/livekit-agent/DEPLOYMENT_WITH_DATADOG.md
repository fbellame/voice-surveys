# LiveKit Agent + DataDog Deployment Guide

This guide explains how to deploy the LiveKit Agent with DataDog monitoring using Docker Compose on a DigitalOcean VM.

## Overview

The deployment includes:
- **LiveKit Agent**: Your main application container
- **DataDog Agent**: Monitoring and APM collection
- **Docker Compose**: Orchestration of both services
- **Systemd Service**: Automatic startup and management
- **Monitoring Network**: Isolated Docker network for service communication

## Prerequisites

- DigitalOcean VM (Ubuntu 20.04+ recommended)
- DataDog API key
- LiveKit server credentials
- Root access to the VM

## Quick Deployment

### Option 1: Automated Deployment (Recommended)

1. **Download the deployment package** from GitHub Actions artifacts after a successful build
2. **Upload to your VM**:
   ```bash
   scp -r deployment-package/ root@your-vm-ip:/tmp/
   ```
3. **Run the deployment script**:
   ```bash
   ssh root@your-vm-ip
   cd /tmp/deployment-package
   sudo bash deploy-vm.sh
   ```

### Option 2: Manual Deployment

1. **Clone the repository** on your VM:
   ```bash
   git clone https://github.com/your-repo/voice-surveys.git
   cd voice-surveys/services/livekit-agent
   ```

2. **Run the deployment script**:
   ```bash
   sudo bash deploy-vm.sh
   ```

## Configuration

After running the deployment script, you need to configure the environment files:

### 1. LiveKit Agent Configuration

```bash
cp /etc/livekit-agent.env.template /etc/livekit-agent.env
nano /etc/livekit-agent.env
```

Required variables:
```bash
# Docker image
DOCKER_IMAGE=docker.io/fbellame/livekit-agent:latest

# LiveKit configuration
LIVEKIT_URL=wss://your-livekit-server.com
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret

# Application ports
APP_PORT=8081
HEALTH_CHECK_PORT=8080
```

### 2. DataDog Configuration

```bash
cp /etc/datadog.env.template /etc/datadog.env
nano /etc/datadog.env
```

Required variables:
```bash
# DataDog API Key (required)
DD_API_KEY=your_datadog_api_key

# DataDog site (optional, defaults to us5.datadoghq.com)
DD_SITE=us5.datadoghq.com

# Environment (optional, defaults to dev)
DD_ENV=dev
```

## Starting the Service

### Enable and Start the Service

```bash
# Enable the service to start on boot
systemctl enable livekit-agent-compose@default

# Start the service
systemctl start livekit-agent-compose@default
```

### Check Service Status

```bash
# Check systemd service status
systemctl status livekit-agent-compose@default

# Check running containers
docker ps

# Check container logs
docker logs livekit-agent-default
docker logs dd-agent

# Follow logs in real-time
journalctl -u livekit-agent-compose@default -f
```

## Monitoring

### DataDog Integration

The DataDog agent is configured to collect:
- **APM traces** from your LiveKit agent
- **Container metrics** (CPU, memory, network)
- **Host metrics** (system resources)
- **Docker events** and logs

### Accessing DataDog

1. Log into your DataDog account
2. Navigate to **Infrastructure > Containers**
3. You should see your containers listed
4. Check **APM > Services** for application traces

### Health Checks

The LiveKit agent includes health checks:
- **Endpoint**: `http://localhost:8080/health`
- **Interval**: 30 seconds
- **Timeout**: 10 seconds
- **Retries**: 3 attempts
- **Start period**: 60 seconds

## Management Commands

### Service Management

```bash
# Start the service
systemctl start livekit-agent-compose@default

# Stop the service
systemctl stop livekit-agent-compose@default

# Restart the service
systemctl restart livekit-agent-compose@default

# Disable auto-start
systemctl disable livekit-agent-compose@default

# Check service logs
journalctl -u livekit-agent-compose@default -f
```

### Docker Compose Management

```bash
cd /opt/livekit-agent

# View running services
docker-compose ps

# View logs
docker-compose logs -f

# Restart services
docker-compose restart

# Stop services
docker-compose down

# Start services
docker-compose up -d
```

### Container Management

```bash
# View all containers
docker ps -a

# View container logs
docker logs livekit-agent-default
docker logs dd-agent

# Execute commands in containers
docker exec -it livekit-agent-default bash
docker exec -it dd-agent bash

# View container stats
docker stats
```

## Troubleshooting

### Common Issues

1. **Service won't start**:
   ```bash
   # Check environment files exist
   ls -la /etc/livekit-agent.env /etc/datadog.env
   
   # Check systemd logs
   journalctl -u livekit-agent-compose@default -n 50
   ```

2. **Containers not communicating**:
   ```bash
   # Check monitoring network
   docker network ls
   docker network inspect monitoring
   
   # Check container networking
   docker inspect livekit-agent-default | grep -A 10 "NetworkSettings"
   ```

3. **DataDog agent not collecting data**:
   ```bash
   # Check DataDog agent logs
   docker logs dd-agent
   
   # Verify API key
   docker exec dd-agent agent status
   ```

4. **Port conflicts**:
   ```bash
   # Check what's using the ports
   netstat -tlnp | grep :8081
   netstat -tlnp | grep :8080
   ```

### Log Locations

- **Systemd logs**: `journalctl -u livekit-agent-compose@default`
- **Container logs**: `/var/lib/docker/containers/`
- **Application logs**: Inside containers at `/app/logs/`

### Performance Monitoring

```bash
# Monitor resource usage
docker stats

# Check disk usage
df -h

# Monitor network
iftop -i eth0

# Check memory usage
free -h
```

## Security Considerations

1. **Environment Files**: Keep `/etc/livekit-agent.env` and `/etc/datadog.env` secure
2. **API Keys**: Never commit API keys to version control
3. **Network Security**: The monitoring network is isolated from the host
4. **Container Security**: Containers run with minimal privileges

## Scaling

### Multiple Instances

To run multiple instances on the same VM:

```bash
# Start additional instances
systemctl start livekit-agent-compose@instance1
systemctl start livekit-agent-compose@instance2

# Check all instances
systemctl list-units livekit-agent-compose@*
```

### Load Balancing

For production deployments, consider:
- Using a load balancer (nginx, haproxy)
- Running instances on different VMs
- Using Kubernetes for orchestration

## Backup and Recovery

### Backup Configuration

```bash
# Backup environment files
cp /etc/livekit-agent.env /backup/
cp /etc/datadog.env /backup/

# Backup docker-compose.yml
cp /opt/livekit-agent/docker-compose.yml /backup/
```

### Recovery

```bash
# Restore from backup
cp /backup/livekit-agent.env /etc/
cp /backup/datadog.env /etc/
cp /backup/docker-compose.yml /opt/livekit-agent/

# Restart service
systemctl restart livekit-agent-compose@default
```

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Review container logs
3. Check DataDog documentation
4. Open an issue in the repository

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    DigitalOcean VM                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │   Systemd       │    │   Docker        │                │
│  │   Service       │    │   Compose       │                │
│  └─────────────────┘    └─────────────────┘                │
│           │                       │                        │
│           └───────────────────────┼────────────────────────┘
│                                   │
│  ┌─────────────────────────────────┼────────────────────────┐
│  │         Docker Network: monitoring                       │
│  │  ┌─────────────────┐    ┌─────────────────┐              │
│  │  │  LiveKit Agent  │    │  DataDog Agent  │              │
│  │  │  Container      │◄──►│  Container      │              │
│  │  │  Port: 8081     │    │  APM Enabled    │              │
│  │  └─────────────────┘    └─────────────────┘              │
│  └─────────────────────────────────────────────────────────┘
│                                   │
│  ┌─────────────────────────────────┼────────────────────────┐
│  │         External Connections                              │
│  │  ┌─────────────────┐    ┌─────────────────┐              │
│  │  │  LiveKit Server │    │  DataDog Cloud  │              │
│  │  │  (WebSocket)    │    │  (Metrics/APM)  │              │
│  │  └─────────────────┘    └─────────────────┘              │
│  └─────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────┘
```
