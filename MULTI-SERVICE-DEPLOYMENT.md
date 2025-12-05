# Multi-Service Deployment Guide

This guide explains how to deploy multiple services (e.g., API, frontend, backend) for a team using the GitHub Actions workflow.

## Overview

The deployment workflow is fully automated and non-interactive. It will:
1. ✅ Create ECR repository if it doesn't exist
2. ✅ Create CloudWatch log group if it doesn't exist
3. ✅ Build and push Docker image
4. ✅ Register ECS task definition
5. ✅ Create or update ECS service

## Prerequisites

### 1. GitHub Organization Secrets

The following secrets must be configured at the organization level:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_ACCOUNT_ID`

See [GITHUB-SECRETS.md](./GITHUB-SECRETS.md) for detailed setup instructions.

### 2. IAM Permissions

The AWS user/role must have the `GitHubActionsECSDeployPolicy` policy attached. To update the policy:

```bash
./scripts/update-iam-policy.sh
```

This policy includes permissions for:
- Creating ECR repositories
- Creating CloudWatch log groups
- Registering ECS task definitions
- Creating/updating ECS services
- Passing IAM roles to ECS tasks

### 3. Repository Structure

Your repository should have one of these Dockerfiles:
- `Dockerfile` (default)
- `Dockerfile.node` (for Node.js services)
- `Dockerfile.frontend` (for frontend services)

## Deployment Examples

### Example 1: Deploy API Service

**Manual Trigger:**
1. Go to Actions tab in your repository
2. Select "Deploy to AWS ECS"
3. Click "Run workflow"
4. Enter:
   - `team_name`: `expo-1st`
   - `service_name`: `test-api`
5. Click "Run workflow"

**Result:**
- ECR repo: `hackathon-expo-1st-test-api`
- ECS service: `hackathon-expo-1st-test-api`
- URL: `https://test-api.expo-1st.bp.elmhakathon.com`

### Example 2: Deploy Frontend Service

**Manual Trigger:**
1. Go to Actions tab
2. Select "Deploy to AWS ECS"
3. Click "Run workflow"
4. Enter:
   - `team_name`: `expo-1st`
   - `service_name`: `test-frontend`
5. Click "Run workflow"

**Result:**
- ECR repo: `hackathon-expo-1st-test-frontend`
- ECS service: `hackathon-expo-1st-test-frontend`
- URL: `https://test-frontend.expo-1st.bp.elmhakathon.com`

### Example 3: Auto-Deploy on Push

The workflow automatically triggers on push to `main` or `develop` branches:

```bash
git add .
git commit -m "Update service"
git push origin main
```

The workflow uses default values:
- `team_name`: `expo-1st`
- `service_name`: `api`

To change defaults, edit the `env` section in `.github/workflows/deploy-ecs.yml`.

## Multi-Service Setup

For teams with multiple services (API + Frontend + Backend), each service should:
1. Have its own GitHub repository
2. Have the workflow configured with appropriate defaults
3. Use a unique `service_name`

### Docker Compose (Local Development)

For local testing of multiple services:

```bash
# Build and start all services
docker compose up --build

# Start specific services
docker compose up api frontend

# Stop all services
docker compose down
```

See `examples/docker-compose.yml` for a complete multi-service example.

## Workflow Behavior

### First Deployment
When deploying a service for the first time:
- ✅ Creates ECR repository: `hackathon-{team}-{service}`
- ✅ Creates CloudWatch log group: `/ecs/hackathon/{team}/{service}`
- ✅ Builds Docker image
- ✅ Pushes image to ECR
- ✅ Registers task definition
- ✅ Creates ECS service

### Subsequent Deployments
On updates:
- ✅ Builds new Docker image
- ✅ Pushes to existing ECR repository
- ✅ Registers new task definition revision
- ✅ Updates ECS service with force new deployment

## Service Isolation

Each service is completely isolated:
- **Separate ECR repository**: Images don't conflict
- **Separate ECS service**: Deployments don't override each other
- **Separate log group**: Logs are organized per service
- **Separate URL**: Each service has its own subdomain

## Troubleshooting

### ECR Repository Creation Fails
```
Error: AccessDeniedException
```
**Solution**: Ensure IAM policy includes `ecr:CreateRepository` permission.

### CloudWatch Log Group Creation Fails
```
Error: AccessDeniedException
```
**Solution**: Ensure IAM policy includes `logs:CreateLogGroup` permission.

### ECS Service Creation Fails
```
Error: Unable to assume role
```
**Solution**: Ensure IAM policy includes `iam:PassRole` permission for ECS task roles.

### Service Already Exists
If you see "Service already exists", the workflow will automatically update it instead. This is normal behavior.

## URLs and Naming Convention

### Service URL Pattern
```
https://{service-name}.{team-name}.bp.elmhakathon.com
```

### Resource Naming
- **ECR Repository**: `hackathon-{team}-{service}`
- **ECS Service**: `hackathon-{team}-{service}`
- **Task Definition**: `hackathon-{team}-{service}`
- **Log Group**: `/ecs/hackathon/{team}/{service}`

### Example for team "expo-1st"
| Service | URL |
|---------|-----|
| API | https://test-api.expo-1st.bp.elmhakathon.com |
| Frontend | https://test-frontend.expo-1st.bp.elmhakathon.com |
| Backend | https://backend.expo-1st.bp.elmhakathon.com |

## Monitoring

### View Logs
```bash
# View logs for a service
aws logs tail /ecs/hackathon/{team}/{service} --follow

# Example
aws logs tail /ecs/hackathon/expo-1st/test-api --follow
```

### Check Service Status
```bash
# Check ECS service
aws ecs describe-services \
  --cluster hackathon-cluster \
  --services hackathon-{team}-{service}

# Example
aws ecs describe-services \
  --cluster hackathon-cluster \
  --services hackathon-expo-1st-test-api
```

### View Running Tasks
```bash
aws ecs list-tasks \
  --cluster hackathon-cluster \
  --service-name hackathon-{team}-{service}
```

## Advanced Configuration

### Custom Port
Edit the task definition in `.github/workflows/deploy-ecs.yml`:
```yaml
"containerPort": 8080,  # Change from 3000
```

### Custom Health Check
Modify the health check configuration:
```yaml
"healthCheck": {
  "command": ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"],
  "interval": 30,
  "timeout": 5,
  "retries": 3,
  "startPeriod": 60
}
```

### Environment Variables
Add environment variables in the task definition:
```yaml
"environment": [
  {"name": "NODE_ENV", "value": "production"},
  {"name": "CUSTOM_VAR", "value": "custom_value"}
]
```

## Support

For issues or questions:
1. Check CloudWatch logs for service errors
2. Verify IAM permissions are correct
3. Ensure GitHub secrets are configured
4. Check ECS service events in AWS console
