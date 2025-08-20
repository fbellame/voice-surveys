# LiveKit Agent Deployment Fixes

## Issues Fixed

The refactor from a standalone repository to a monorepo structure broke the deployment due to several naming inconsistencies and path issues.

### 1. Naming Inconsistency
**Problem**: The systemd service, container names, and environment files were using "future-survey-agent" instead of "livekit-agent".

**Fixed**:
- Systemd service: `livekit-agent@.service`
- Container names: `livekit-agent-%i`
- Environment file: `/etc/livekit-agent.env`
- Docker image: `fbellame/livekit-agent:latest`

### 2. Dockerfile Path Issues
**Problem**: The Dockerfile was trying to copy from `services/livekit-agent/` when it was already in that directory.

**Fixed**: Updated COPY commands to use relative paths:
- `COPY requirements.txt .`
- `COPY . .`

### 3. Environment File Handling
**Problem**: The Dockerfile expected a `.env.build` file that didn't exist.

**Fixed**: Modified Dockerfile to create a temporary `.env` file during build with placeholder values.

### 4. Build Workflow
**Problem**: The build workflow was still using the old image name.

**Fixed**: Updated `IMAGE_NAME` to use `docker.io/fbellame/livekit-agent`.

## Files Modified

1. **`services/livekit-agent/systemd/livekit-agent@.service`**
   - Updated description and container names
   - Fixed environment file path
   - Removed hardcoded Docker image

2. **`services/livekit-agent/cloud-init/base.yaml`**
   - Updated environment file path to `/etc/livekit-agent.env`

3. **`.github/workflows/deploy-do.yml`**
   - Updated environment file naming
   - Updated container log references

4. **`.github/workflows/build-push-docker.yml`**
   - Updated Docker image name
   - Removed unnecessary `.env.build` creation

5. **`services/livekit-agent/Dockerfile`**
   - Fixed COPY paths
   - Added temporary environment file creation during build

## Required GitHub Repository Updates

### Variables to Update
In your GitHub repository settings (Settings > Secrets and variables > Actions > Variables), update:

1. **`DOCKER_IMAGE`**: Change from `fbellame/future-survey:latest` to `fbellame/livekit-agent:latest`
2. **`IMAGE_NAME`** (optional): Change from `docker.io/fbellame/future-survey` to `docker.io/fbellame/livekit-agent`

### Secrets (No changes needed)
All existing secrets should continue to work:
- `DIGITALOCEAN_ACCESS_TOKEN`
- `SSH_PRIVATE_KEY`
- `SSH_PUBLIC_KEY`
- `DEEPGRAM_API_KEY`
- `OPENAI_API_KEY`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `SUPABASE_KEY`
- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`

## Deployment Process

1. **Build the new image**: Push to main branch or create a tag to trigger the build workflow
2. **Deploy**: Use the GitHub Actions "Deploy to DigitalOcean" workflow
3. **Verify**: Check the logs in the deployment workflow to ensure the agent starts correctly

## Testing the Fix

After updating the GitHub variables:

1. Push these changes to your repository
2. The build workflow will create the new `fbellame/livekit-agent:latest` image
3. Run the deployment workflow
4. Check the deployment logs to verify the agent starts successfully

The agent should now start correctly with the new naming convention and work properly after VM reboots.
