# Example Applications

This directory contains example applications demonstrating how to build and deploy services for the hackathon.

## 📁 Files

### Node.js Applications

- **`app.js`** - Simple Express.js application (basic example)
- **`app-postgres.js`** - Full-featured application with PostgreSQL and Redis
- **`package.json`** - Simple app dependencies
- **`package-postgres.json`** - Full app dependencies

### Docker Files

- **`Dockerfile.node`** - Basic Node.js Dockerfile
- **`Dockerfile.python`** - Basic Python Dockerfile
- **`Dockerfile.postgres`** - Production-ready Node.js with PostgreSQL support
- **`docker-compose.yml`** - Multi-service setup (app + postgres + redis)

### Database

- **`init-db.sql`** - PostgreSQL initialization script
- **`.env.example`** - Environment variables template

## 🚀 Quick Start

### Local Development with Docker Compose

```bash
# Navigate to examples directory
cd examples

# Copy environment file
cp .env.example .env

# Edit .env with your team name and service name
nano .env

# Start all services (app, postgres, redis)
docker-compose up -d

# View logs
docker-compose logs -f app

# Test the application
curl http://localhost:3000/health

# Create a task
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Task","description":"My first task","status":"pending"}'

# Get all tasks
curl http://localhost:3000/api/tasks

# Stop services
docker-compose down
```

### Development Mode (Optional Management UIs)

```bash
# Start with pgAdmin and Redis Commander for development
docker-compose --profile dev up -d

# Access services:
# - App: http://localhost:3000
# - pgAdmin: http://localhost:5050 (admin@hackathon.local / admin123)
# - Redis Commander: http://localhost:8081
```

## 📡 API Endpoints

### Health Check
```bash
GET /health
```

### Tasks API
```bash
# Get all tasks
GET /api/tasks

# Create a task
POST /api/tasks
{
  "title": "Task title",
  "description": "Task description",
  "status": "pending"
}

# Get a specific task
GET /api/tasks/:id

# Update a task
PUT /api/tasks/:id
{
  "title": "Updated title",
  "status": "completed"
}

# Delete a task
DELETE /api/tasks/:id
```

### Metrics API
```bash
# Record a metric
POST /api/metrics
{
  "metric_name": "response_time",
  "metric_value": 123.45
}

# Get metrics
GET /api/metrics?metric_name=response_time&limit=50
```

### Cache API
```bash
# Get cached value
GET /api/cache/:key

# Set cached value
POST /api/cache
{
  "key": "my-key",
  "value": {"data": "value"},
  "ttl": 3600
}
```

### System Info
```bash
GET /api/info
```

## 🐳 Docker Deployment

### Build and Run Locally

```bash
# Build the image
docker build -f Dockerfile.postgres -t my-team-app .

# Run with environment variables
docker run -d \
  -p 3000:3000 \
  -e TEAM_NAME=expo-1st \
  -e SERVICE_NAME=api \
  -e DB_HOST=host.docker.internal \
  -e DB_PASSWORD=postgres123 \
  -e REDIS_HOST=host.docker.internal \
  --name my-app \
  my-team-app

# View logs
docker logs -f my-app

# Stop and remove
docker stop my-app && docker rm my-app
```

## 🔄 GitHub Actions Deployment

### Setup GitHub Secrets

Add these secrets to your GitHub repository:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Add the following secrets:

```
AWS_ACCOUNT_ID=your-account-id
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

### Deploy via GitHub Actions

#### Method 1: Manual Workflow Dispatch

1. Go to **Actions** tab in your repository
2. Select **Deploy to AWS ECS** workflow
3. Click **Run workflow**
4. Enter parameters:
   - **Team name**: `expo-1st` (your team's kebab-case name)
   - **Service name**: `api` (or `frontend`, `backend`, etc.)
5. Click **Run workflow**

#### Method 2: Automatic on Push

The workflow automatically runs when you push to `main` or `develop` branches:

```bash
git add .
git commit -m "Update application"
git push origin main
```

**Note**: When using auto-deploy, set default values in workflow file or use repository variables.

### Access Your Deployed Service

After deployment, your service will be available at:

```
https://[service-name].[team-name].bp.elmhakathon.com
```

**Examples**:
- `https://api.expo-1st.bp.elmhakathon.com` - API service for expo-1st team
- `https://frontend.expo-1st.bp.elmhakathon.com` - Frontend service for expo-1st team
- `https://backend.heros.bp.elmhakathon.com` - Backend service for heros team

## 🌐 DNS Configuration

The CDK stack automatically creates:

1. **Main team domain**: `expo-1st.bp.elmhakathon.com`
2. **Wildcard subdomain**: `*.expo-1st.bp.elmhakathon.com`

This allows multiple services per team:
- `api.expo-1st.bp.elmhakathon.com`
- `frontend.expo-1st.bp.elmhakathon.com`
- `backend.expo-1st.bp.elmhakathon.com`
- `admin.expo-1st.bp.elmhakathon.com`
- etc.

All services route to the same ALB and ECS cluster but can run different containers.

## 📦 Multi-Service Architecture

### Deploying Multiple Services for One Team

```bash
# Deploy API service
./scripts/deploy-team.sh expo-1st api

# Deploy Frontend service
./scripts/deploy-team.sh expo-1st frontend

# Deploy Backend service
./scripts/deploy-team.sh expo-1st backend
```

### Repository Structure Recommendation

```
team-repository/
├── api/                  # API service
│   ├── Dockerfile
│   ├── app.js
│   └── package.json
├── frontend/            # Frontend service
│   ├── Dockerfile
│   ├── src/
│   └── package.json
├── backend/             # Backend service
│   ├── Dockerfile
│   ├── app.js
│   └── package.json
├── docker-compose.yml   # Local development
└── .github/
    └── workflows/
        └── deploy.yml   # Deployment workflow
```

## 🔐 Secrets Management

### Store Secrets in AWS Secrets Manager

```bash
# Create database password secret
aws secretsmanager create-secret \
  --name hackathon/expo-1st/db-password \
  --secret-string "your-secure-password" \
  --region ap-southeast-1

# Create database host secret
aws secretsmanager create-secret \
  --name hackathon/expo-1st/db-host \
  --secret-string "your-rds-endpoint.rds.amazonaws.com" \
  --region ap-southeast-1

# Create Redis host secret
aws secretsmanager create-secret \
  --name hackathon/expo-1st/redis-host \
  --secret-string "your-redis-endpoint" \
  --region ap-southeast-1
```

### Using Secrets in Your Application

The GitHub workflow automatically injects secrets from AWS Secrets Manager into your containers as environment variables.

## 🗄️ Database Setup

### Option 1: Use Docker Compose (Local/Development)

```bash
docker-compose up -d postgres
```

### Option 2: AWS RDS (Production)

1. Create RDS PostgreSQL instance in AWS Console
2. Store connection details in Secrets Manager
3. Update security groups to allow ECS tasks to connect

### Option 3: Shared Team Database

Each team can have a shared PostgreSQL/Redis instance:

```yaml
# Deploy shared database for your team
services:
  postgres:
    image: postgres:15-alpine
    # ... configuration
  redis:
    image: redis:7-alpine
    # ... configuration
```

## 📊 Monitoring

### CloudWatch Logs

View your application logs:

```bash
# View logs for your service
aws logs tail /ecs/hackathon/expo-1st/api --follow

# View logs for specific time range
aws logs tail /ecs/hackathon/expo-1st/api \
  --since 1h \
  --format short
```

### CloudWatch Metrics

Access metrics in AWS Console:
- CPU Utilization
- Memory Utilization
- Request Count
- Response Time
- Error Rate

## 🐛 Troubleshooting

### Service Won't Start

```bash
# Check service events
aws ecs describe-services \
  --cluster hackathon-cluster \
  --services hackathon-expo-1st-api

# Check task failures
aws ecs list-tasks \
  --cluster hackathon-cluster \
  --service-name hackathon-expo-1st-api \
  --desired-status STOPPED
```

### Database Connection Issues

1. Verify security group allows traffic from ECS tasks
2. Check database credentials in Secrets Manager
3. Verify VPC networking configuration
4. Check CloudWatch logs for connection errors

### DNS Not Resolving

```bash
# Check DNS propagation
dig api.expo-1st.bp.elmhakathon.com

# Verify Route53 records
aws route53 list-resource-record-sets \
  --hosted-zone-id YOUR_ZONE_ID
```

## 💡 Best Practices

1. **Health Checks**: Always implement `/health` endpoint
2. **Graceful Shutdown**: Handle SIGTERM signals properly
3. **Environment Variables**: Use environment variables for configuration
4. **Secrets**: Never commit secrets to Git; use AWS Secrets Manager
5. **Logging**: Log to stdout/stderr for CloudWatch integration
6. **Database Migrations**: Run migrations in init containers or startup
7. **Connection Pooling**: Use connection pools for databases
8. **Error Handling**: Implement proper error handling and retries
9. **Monitoring**: Set up CloudWatch alarms for critical metrics
10. **Security**: Run containers as non-root user

## 📚 Additional Resources

- [AWS ECS Documentation](https://docs.aws.amazon.com/ecs/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Redis Documentation](https://redis.io/documentation)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

---

**Need help?** Contact your hackathon mentors or check the main [DEPLOYMENT-GUIDE.md](../DEPLOYMENT-GUIDE.md).
