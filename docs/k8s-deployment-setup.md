# Kubernetes Deployment Setup

This document explains how to set up the GitHub Actions workflow for deploying the livekit-agent to a DigitalOcean Kubernetes cluster.

## Prerequisites

1. A DigitalOcean Kubernetes cluster already exists
2. Docker image is built and pushed to Docker Hub
3. GitHub repository has the necessary secrets and variables configured

## Required GitHub Secrets

Add these secrets in your GitHub repository settings (Settings > Secrets and variables > Actions > Secrets):

### DigitalOcean
- `DIGITALOCEAN_ACCESS_TOKEN` - Your DigitalOcean API token

### Docker Hub
- `DOCKERHUB_USERNAME` - Your Docker Hub username
- `DOCKERHUB_TOKEN` - Your Docker Hub access token

### Application Secrets
- `DEEPGRAM_API_KEY` - Deepgram API key for speech-to-text
- `OPENAI_API_KEY` - OpenAI API key for AI processing
- `LIVEKIT_API_KEY` - LiveKit API key
- `LIVEKIT_API_SECRET` - LiveKit API secret
- `AWS_ACCESS_KEY_ID` - AWS access key for S3 storage
- `AWS_SECRET_ACCESS_KEY` - AWS secret access key
- `SUPABASE_KEY` - Supabase service role key

## Required GitHub Variables

Add these variables in your GitHub repository settings (Settings > Secrets and variables > Actions > Variables):

### Cluster Configuration
- `CLUSTER_ID` - Your DigitalOcean Kubernetes cluster ID
- `CLUSTER_NAME` - Your DigitalOcean Kubernetes cluster name
- `REGION` - Cluster region (default: `tor1`)
- `NAMESPACE` - Kubernetes namespace (default: `livekit-agent`)

### Application Configuration
- `DOCKER_IMAGE` - Docker image name (default: `fbellame/livekit-agent`)
- `APP_PORT` - Application port (default: `8080`)
- `SERVICE_PORT` - Service port (default: `80`)

### External Services
- `LIVEKIT_URL` - LiveKit server URL
- `AWS_REGION` - AWS region for S3
- `SUPABASE_URL` - Supabase project URL

## How to Use

1. **Manual Deployment**: Go to Actions > Deploy to DigitalOcean Kubernetes > Run workflow
   - You can specify a custom image tag
   - Option to recreate secrets if needed

2. **Automatic Deployment**: The workflow can be triggered by:
   - Manual dispatch (current setup)
   - Push to specific branches
   - Release creation
   - Custom events

## Workflow Features

- **Namespace Management**: Creates the namespace if it doesn't exist
- **Docker Registry Secret**: Sets up authentication for pulling private images
- **Application Secrets**: Manages all environment variables as Kubernetes secrets
- **Health Checks**: Includes liveness and readiness probes
- **Resource Limits**: Sets CPU and memory limits for the container
- **Load Balancer**: Creates a LoadBalancer service for external access
- **Rollout Monitoring**: Waits for deployment to be ready
- **Status Reporting**: Shows deployment status and external IP

## Troubleshooting

### Common Issues

1. **Image Pull Errors**: Ensure Docker Hub credentials are correct
2. **Secret Issues**: Check that all required secrets are set in GitHub
3. **Cluster Access**: Verify the cluster ID and DigitalOcean token
4. **Resource Limits**: Adjust CPU/memory limits if pods are failing

### Useful Commands

```bash
# Check cluster status
kubectl get nodes

# Check deployment status
kubectl get deployment livekit-agent -n livekit-agent

# Check pod logs
kubectl logs -f -l app=livekit-agent -n livekit-agent

# Check service status
kubectl get service livekit-agent -n livekit-agent

# Describe pod for debugging
kubectl describe pod -l app=livekit-agent -n livekit-agent
```

## Security Notes

- All sensitive data is stored as Kubernetes secrets
- Docker registry credentials are managed securely
- Resource limits prevent resource exhaustion
- Health checks ensure application availability

## Cost Optimization

- The workflow uses a single replica by default
- Resource limits prevent over-allocation
- Consider using node selectors for specific node types
- Monitor cluster usage and adjust as needed
