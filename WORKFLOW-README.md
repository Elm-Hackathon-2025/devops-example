# GitHub Actions Workflow - Build and Deploy to ECS

This workflow builds a Docker image and deploys it to AWS ECS for a specific team.

## Overview

The workflow:
1. Builds a Docker image from `Dockerfile.node`
2. Pushes the image to the team's ECR repository (`hackathon-{team_name}`)
3. Forces a new deployment on the team's ECS service (`hackathon-{team_name}`)
4. Waits for the service to stabilize
5. Reports deployment status

## Usage

### Prerequisites

1. **AWS Secrets** - Configure in GitHub repository settings:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_ACCOUNT_ID`

2. **CDK Deployment** - The ECS infrastructure must be deployed first:
   ```bash
   npm run deploy
   ```

### Manual Trigger (Recommended)

Go to **Actions** → **Build and Deploy to ECS** → **Run workflow**

**Inputs:**
- **team_name**: Team name in kebab-case (e.g., `expo-1st`, `heros`, `rollingstars`)
- **github_repo_name**: Service/repository name (e.g., `api`, `frontend`, `backend`, `mobile`)

**Example:**
```yaml
team_name: expo-1st
github_repo_name: api
```

This will:
- Build and push to ECR: `hackathon-expo-1st:api-latest`
- Deploy to ECS service: `hackathon-expo-1st`
- Make accessible at:
  - **Service URL**: `https://api.expo-1st.bp.elmhakathon.com` (recommended)
  - **Team Base URL**: `https://expo-1st.bp.elmhakathon.com`

### Auto Trigger

The workflow also triggers automatically on push to `main` or `develop` branches, using default values:
- team_name: `expo-1st`
- github_repo_name: `api`

## Architecture

### ECR Repository Naming
- **Format**: `hackathon-{team_name}`
- **Example**: `hackathon-expo-1st`
- **Note**: One ECR repo per team, multiple services use different image tags

### Image Tagging Strategy
Each build creates 3 tags:
1. `latest` - Most recent build for any service
2. `{repo_name}-latest` - Most recent build for this specific service (e.g., `api-latest`)
3. `{repo_name}-{git_sha}` - Specific commit build (e.g., `api-abc1234`)

### ECS Service Naming
- **Format**: `hackathon-{team_name}`
- **Example**: `hackathon-expo-1st`
- **Cluster**: `hackathon-cluster`

### URL Patterns
- **Team Base**: `https://{team_name}.bp.elmhakathon.com`
  - Example: `https://expo-1st.bp.elmhakathon.com`
- **Service-specific** (recommended): `https://{repo_name}.{team_name}.bp.elmhakathon.com`
  - Example: `https://api.expo-1st.bp.elmhakathon.com`
  - Example: `https://frontend.expo-1st.bp.elmhakathon.com`

**Note**: Each service deployed by a team should use its own subdomain (e.g., `api.expo-1st`, `frontend.expo-1st`) to allow multiple services to run independently.

## Team Names Reference

All 19 teams (in kebab-case):
```
expo-1st
heros
rollingstars
elm-tech
itjehaat-sooq
supernovas
automind-squad
naqliyat
agent-x
product-boosters
altahateeh
sema-lab
logisty
smart
marzas
qimmah
huic-team
elm-product
bpo
```

## Examples

### Deploy API for Expo 1st
```yaml
team_name: expo-1st
github_repo_name: api
```
→ Deploys to:
- **Service URL**: `https://api.expo-1st.bp.elmhakathon.com` ✅
- Team Base: `https://expo-1st.bp.elmhakathon.com`

### Deploy Frontend for Heros
```yaml
team_name: heros
github_repo_name: frontend
```
→ Deploys to:
- **Service URL**: `https://frontend.heros.bp.elmhakathon.com` ✅
- Team Base: `https://heros.bp.elmhakathon.com`

### Deploy Mobile App for Rollingstars
```yaml
team_name: rollingstars
github_repo_name: mobile
```
→ Deploys to:
- **Service URL**: `https://mobile.rollingstars.bp.elmhakathon.com` ✅
- Team Base: `https://rollingstars.bp.elmhakathon.com`

## Workflow Steps Explained

### 1. Build Phase
- Checks out code
- Configures AWS credentials
- Logs into ECR
- Builds Docker image with team/repo context

### 2. Push Phase
- Checks if ECR repository exists (creates if needed)
- Pushes image with multiple tags

### 3. Deploy Phase
- Checks if ECS service exists
- Forces new deployment with updated image
- Waits for service to become stable

### 4. Verification Phase
- Shows service status (desired/running/pending counts)
- Lists recent tasks and their health
- Displays deployment summary with URLs

## Troubleshooting

### "ECS service not found"
The workflow built and pushed the Docker image, but no ECS service exists yet.

**Solution**: Deploy the CDK stack first:
```bash
npm run deploy
```

### "Service fails to stabilize"
Tasks may be failing health checks or crashing.

**Check logs**:
```bash
aws logs tail /ecs/hackathon/{team_name}/{repo_name} --follow
```

**Check task status**:
```bash
aws ecs describe-tasks \
  --cluster hackathon-cluster \
  --tasks $(aws ecs list-tasks \
    --cluster hackathon-cluster \
    --service-name hackathon-{team_name} \
    --query 'taskArns[0]' \
    --output text)
```

### "Image pull errors"
If you see Docker Hub rate limit errors, ensure the workflow is using ECR images.

**Verify image in ECR**:
```bash
aws ecr describe-images \
  --repository-name hackathon-{team_name} \
  --region ap-southeast-1
```

## Local Testing

You can replicate the workflow locally:

```bash
# 1. Set variables
export TEAM_NAME=expo-1st
export REPO_NAME=api
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export AWS_REGION=ap-southeast-1

# 2. ECR login
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# 3. Build image
docker build \
  -f Dockerfile.node \
  -t $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/hackathon-$TEAM_NAME:latest \
  -t $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/hackathon-$TEAM_NAME:$REPO_NAME-latest \
  .

# 4. Push image
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/hackathon-$TEAM_NAME:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/hackathon-$TEAM_NAME:$REPO_NAME-latest

# 5. Force deployment
aws ecs update-service \
  --cluster hackathon-cluster \
  --service hackathon-$TEAM_NAME \
  --force-new-deployment \
  --region $AWS_REGION
```

## Multi-Service Deployment

Teams can deploy multiple services, each accessible via its own subdomain:

**Step 1: Deploy API**
```yaml
team_name: expo-1st
github_repo_name: api
```
→ Accessible at: `https://api.expo-1st.bp.elmhakathon.com` ✅

**Step 2: Deploy Frontend**
```yaml
team_name: expo-1st
github_repo_name: frontend
```
→ Accessible at: `https://frontend.expo-1st.bp.elmhakathon.com` ✅

**Step 3: Deploy Backend**
```yaml
team_name: expo-1st
github_repo_name: backend
```
→ Accessible at: `https://backend.expo-1st.bp.elmhakathon.com` ✅

**Result - Multiple Services:**
- API: `https://api.expo-1st.bp.elmhakathon.com`
- Frontend: `https://frontend.expo-1st.bp.elmhakathon.com`
- Backend: `https://backend.expo-1st.bp.elmhakathon.com`
- Team Base: `https://expo-1st.bp.elmhakathon.com`

**Note**: Each service (api, frontend, backend) gets its own subdomain, allowing teams to run multiple independent services.

## Advanced Configuration

### Custom Dockerfile
The workflow uses `Dockerfile.node` by default. To use a different Dockerfile, modify the workflow:

```yaml
- name: Build Docker image
  run: |
    docker build \
      -f Dockerfile.custom \  # Change this
      -t $IMAGE_TAG \
      .
```

### Custom Build Args
Add build arguments:

```yaml
docker build \
  --build-arg NODE_VERSION=20 \
  --build-arg TEAM_NAME=${{ env.TEAM_NAME }} \
  -t $IMAGE_TAG \
  .
```

### Environment Variables
ECS task definitions can include environment variables. Update the CDK stack to add them, or use AWS Secrets Manager for sensitive values.

## Security Best Practices

1. **Never commit AWS credentials** - Use GitHub Secrets
2. **Use IAM roles with least privilege** - Only grant necessary ECR and ECS permissions
3. **Scan images** - ECR scanning is enabled by default in this workflow
4. **Rotate credentials regularly** - Update GitHub Secrets periodically
5. **Use encrypted secrets** - For database passwords, API keys, etc.

## Monitoring

After deployment, monitor your service:

**CloudWatch Logs:**
```bash
aws logs tail /ecs/hackathon/{team_name}/{repo_name} --follow
```

**Service Events:**
```bash
aws ecs describe-services \
  --cluster hackathon-cluster \
  --services hackathon-{team_name} \
  --query 'services[0].events[:10]'
```

**Task Health:**
```bash
aws ecs describe-tasks \
  --cluster hackathon-cluster \
  --tasks $(aws ecs list-tasks \
    --cluster hackathon-cluster \
    --service-name hackathon-{team_name} \
    --query 'taskArns' \
    --output text)
```

## Support

For issues:
1. Check workflow run logs in GitHub Actions
2. Check CloudWatch logs for application errors
3. Verify ECS service and task status
4. Ensure CDK stack is fully deployed
