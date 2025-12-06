# Helm Chart Customization Guide

This guide covers advanced customization scenarios for the hackathon service Helm chart.

## Table of Contents

- [Service-Specific Values Files](#service-specific-values-files)
- [Adding Chart Dependencies](#adding-chart-dependencies)
- [Custom Environment Variables](#custom-environment-variables)
- [Advanced Configuration Examples](#advanced-configuration-examples)

---

## Service-Specific Values Files

### Creating Service-Specific Overrides

Service-specific values files allow you to customize deployment settings for different services (frontend, backend, worker, etc.) while keeping the base configuration in `values.yaml`.

#### Naming Convention

```
values.{service-name}.yaml
```

Examples:
- `values.frontend.yaml` - Frontend application
- `values.backend.yaml` - Backend API
- `values.worker.yaml` - Background worker
- `values.websocket.yaml` - WebSocket server

#### Example: Backend API Service

**File: `values.backend.yaml`**

```yaml
# Override base values for backend API service
service:
  name: backend-api
  port: 80
  type: ClusterIP

image:
  # ECR repository will be: hackathon-{teamName}-backend-api
  repository: hackathon-expo-1st-backend-api
  tag: "latest"
  pullPolicy: Always

containerPort: 3000

replicaCount: 3

resources:
  requests:
    cpu: 500m
    memory: 512Mi
  limits:
    cpu: 1000m
    memory: 1024Mi

ingress:
  enabled: true
  hostname: api.expo-1st.bp.elmhakathon.com
  healthCheck:
    path: /health
    intervalSeconds: 30
    timeoutSeconds: 5
    successCodes: "200"

# Health probes
livenessProbe:
  enabled: true
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 60
  periodSeconds: 10

readinessProbe:
  enabled: true
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 5

# Environment variables
env:
  - name: NODE_ENV
    value: "production"
  - name: PORT
    value: "3000"
  - name: LOG_LEVEL
    value: "info"
  - name: DATABASE_URL
    valueFrom:
      secretKeyRef:
        name: backend-secrets
        key: database-url
  - name: REDIS_URL
    value: "redis://redis-master:6379"

# Enable PostgreSQL dependency
postgresql:
  enabled: true

# Enable Redis dependency
redis:
  enabled: true
```

#### Example: Frontend Application

**File: `values.frontend.yaml`**

```yaml
service:
  name: frontend
  port: 80
  type: ClusterIP

image:
  repository: hackathon-expo-1st-frontend
  tag: "latest"

containerPort: 8080

replicaCount: 2

resources:
  requests:
    cpu: 250m
    memory: 256Mi
  limits:
    cpu: 500m
    memory: 512Mi

ingress:
  enabled: true
  hostname: app.expo-1st.bp.elmhakathon.com
  healthCheck:
    path: /
    intervalSeconds: 30
    timeoutSeconds: 3
    successCodes: "200,301,302"

# No health probes for static frontend
livenessProbe:
  enabled: false

readinessProbe:
  enabled: false

env:
  - name: REACT_APP_API_URL
    value: "https://api.expo-1st.bp.elmhakathon.com"
  - name: REACT_APP_ENV
    value: "production"

# Frontend doesn't need database dependencies
postgresql:
  enabled: false

redis:
  enabled: false
```

#### Example: Worker Service

**File: `values.worker.yaml`**

```yaml
service:
  name: worker
  port: 80
  type: ClusterIP

image:
  repository: hackathon-expo-1st-worker
  tag: "latest"

containerPort: 3000

replicaCount: 2

resources:
  requests:
    cpu: 500m
    memory: 512Mi
  limits:
    cpu: 2000m
    memory: 2048Mi

# Workers typically don't need ingress
ingress:
  enabled: false

livenessProbe:
  enabled: true
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 60
  periodSeconds: 30

env:
  - name: WORKER_TYPE
    value: "background-jobs"
  - name: QUEUE_NAME
    value: "default"
  - name: REDIS_URL
    value: "redis://redis-master:6379"
  - name: DATABASE_URL
    valueFrom:
      secretKeyRef:
        name: worker-secrets
        key: database-url

# Share database with backend
postgresql:
  enabled: false  # Use existing database

redis:
  enabled: true
```

#### Using Service-Specific Values

```bash
# Deploy backend with service-specific values
helm template backend ./deploy \
  -f deploy/values.backend.yaml \
  --set teamName=expo-1st \
  --set image.tag=v1.2.3 | kubectl apply -f -

# Deploy frontend
helm template frontend ./deploy \
  -f deploy/values.frontend.yaml \
  --set teamName=expo-1st \
  --set image.tag=v1.2.3 | kubectl apply -f -

# Deploy worker
helm template worker ./deploy \
  -f deploy/values.worker.yaml \
  --set teamName=expo-1st \
  --set image.tag=v1.2.3 | kubectl apply -f -
```

---

## Adding Chart Dependencies

### Overview

Helm chart dependencies allow you to package and deploy third-party services (databases, caches, message queues) alongside your application.

### Step 1: Edit `Chart.yaml`

Add dependencies to the `dependencies` section in `Chart.yaml`:

**File: `deploy/Chart.yaml`**

```yaml
apiVersion: v2
name: hackathon-service
description: Helm chart for deploying hackathon team services to EKS
type: application
version: 1.0.0
appVersion: "1.0"

dependencies:
  # PostgreSQL Database
  - name: postgresql
    version: "12.1.0"
    repository: "https://charts.bitnami.com/bitnami"
    condition: postgresql.enabled
    tags:
      - database

  # Redis Cache/Queue
  - name: redis
    version: "17.3.0"
    repository: "https://charts.bitnami.com/bitnami"
    condition: redis.enabled
    tags:
      - cache

  # MongoDB (alternative database)
  - name: mongodb
    version: "13.6.0"
    repository: "https://charts.bitnami.com/bitnami"
    condition: mongodb.enabled
    tags:
      - database

  # RabbitMQ (message queue)
  - name: rabbitmq
    version: "11.1.0"
    repository: "https://charts.bitnami.com/bitnami"
    condition: rabbitmq.enabled
    tags:
      - messaging
```

### Step 2: Update `values.yaml`

Add configuration for each dependency in `values.yaml`:

**File: `deploy/values.yaml`**

```yaml
# ... existing configuration ...

# PostgreSQL Configuration
postgresql:
  enabled: false  # Set to true to deploy PostgreSQL
  auth:
    postgresPassword: "changeme123"
    username: "hackathon"
    password: "hackathon123"
    database: "hackathon_db"
  primary:
    persistence:
      enabled: true
      size: 10Gi
    resources:
      requests:
        memory: 256Mi
        cpu: 250m
      limits:
        memory: 512Mi
        cpu: 500m
  readReplicas:
    replicaCount: 0

# Redis Configuration
redis:
  enabled: false  # Set to true to deploy Redis
  auth:
    enabled: true
    password: "redis123"
  master:
    persistence:
      enabled: true
      size: 5Gi
    resources:
      requests:
        memory: 128Mi
        cpu: 100m
      limits:
        memory: 256Mi
        cpu: 200m
  replica:
    replicaCount: 1

# MongoDB Configuration
mongodb:
  enabled: false
  auth:
    rootPassword: "mongo123"
    username: "hackathon"
    password: "hackathon123"
    database: "hackathon_db"
  persistence:
    enabled: true
    size: 10Gi
  resources:
    requests:
      memory: 256Mi
      cpu: 250m
    limits:
      memory: 512Mi
      cpu: 500m

# RabbitMQ Configuration
rabbitmq:
  enabled: false
  auth:
    username: "admin"
    password: "rabbitmq123"
  persistence:
    enabled: true
    size: 5Gi
  resources:
    requests:
      memory: 256Mi
      cpu: 250m
    limits:
      memory: 512Mi
      cpu: 500m
```

### Step 3: Download Dependencies

Before deploying, you need to download the dependency charts:

```bash
# Navigate to the chart directory
cd deploy/

# Update dependencies (downloads charts to charts/ directory)
helm dependency update

# Verify dependencies were downloaded
ls -la charts/
# You should see: postgresql-12.1.0.tgz, redis-17.3.0.tgz, etc.
```

### Step 4: Enable Dependencies in Service Values

**File: `values.backend.yaml`**

```yaml
# Enable PostgreSQL for backend
postgresql:
  enabled: true
  auth:
    database: "hackathon_backend"
    username: "backend_user"
    password: "secure_password_here"

# Enable Redis for caching
redis:
  enabled: true
  auth:
    password: "secure_redis_password"
```

### Step 5: Deploy with Dependencies

```bash
# Deploy backend with PostgreSQL and Redis
helm template backend ./deploy \
  -f deploy/values.backend.yaml \
  --set teamName=expo-1st \
  --set image.tag=v1.0.0 \
  --set postgresql.enabled=true \
  --set redis.enabled=true | kubectl apply -f -
```

### Step 6: Access Dependency Services

Once deployed, your application can connect to the dependency services using their internal DNS names:

**PostgreSQL Connection:**
```bash
# Hostname: <release-name>-postgresql.<namespace>.svc.cluster.local
# Example: backend-postgresql.team-expo-1st.svc.cluster.local

# Connection string in your app:
DATABASE_URL=postgresql://backend_user:secure_password_here@backend-postgresql:5432/hackathon_backend
```

**Redis Connection:**
```bash
# Hostname: <release-name>-redis-master.<namespace>.svc.cluster.local
# Example: backend-redis-master.team-expo-1st.svc.cluster.local

# Connection string in your app:
REDIS_URL=redis://:secure_redis_password@backend-redis-master:6379
```

### Dependency Management Commands

```bash
# List dependencies
helm dependency list

# Update all dependencies
helm dependency update

# Build dependencies (package charts/)
helm dependency build

# Remove downloaded charts
rm -rf charts/*.tgz
```

---

## Custom Environment Variables

### Static Environment Variables

**In values file:**

```yaml
env:
  - name: NODE_ENV
    value: "production"
  - name: API_URL
    value: "https://api.example.com"
  - name: FEATURE_FLAG_X
    value: "true"
```

### Secrets from Kubernetes Secrets

**Create secret first:**

```bash
kubectl create secret generic app-secrets \
  -n team-expo-1st \
  --from-literal=database-password=super-secret \
  --from-literal=api-key=sk-1234567890
```

**Reference in values:**

```yaml
env:
  - name: DATABASE_PASSWORD
    valueFrom:
      secretKeyRef:
        name: app-secrets
        key: database-password
  - name: API_KEY
    valueFrom:
      secretKeyRef:
        name: app-secrets
        key: api-key
```

### ConfigMap Values

**Create ConfigMap:**

```bash
kubectl create configmap app-config \
  -n team-expo-1st \
  --from-literal=log-level=debug \
  --from-literal=max-workers=10
```

**Reference in values:**

```yaml
env:
  - name: LOG_LEVEL
    valueFrom:
      configMapKeyRef:
        name: app-config
        key: log-level
  - name: MAX_WORKERS
    valueFrom:
      configMapKeyRef:
        name: app-config
        key: max-workers
```

---

## Advanced Configuration Examples

### Example 1: Multi-Service Application with Shared Database

**Project structure:**
```
team-repo/
├── deploy/
│   ├── Chart.yaml (with postgresql dependency)
│   ├── values.yaml (base config)
│   ├── values.backend.yaml
│   ├── values.frontend.yaml
│   └── values.worker.yaml
```

**Deploy order:**

```bash
# 1. Deploy backend (creates PostgreSQL)
helm template backend ./deploy \
  -f deploy/values.backend.yaml \
  --set teamName=expo-1st \
  --set postgresql.enabled=true | kubectl apply -f -

# 2. Deploy worker (reuses PostgreSQL)
helm template worker ./deploy \
  -f deploy/values.worker.yaml \
  --set teamName=expo-1st \
  --set postgresql.enabled=false \
  --set env[0].name=DATABASE_URL \
  --set env[0].value=postgresql://backend-postgresql:5432/hackathon_db | kubectl apply -f -

# 3. Deploy frontend (no database needed)
helm template frontend ./deploy \
  -f deploy/values.frontend.yaml \
  --set teamName=expo-1st | kubectl apply -f -
```

### Example 2: Team-Specific Database Credentials

**File: `values.backend.team-heros.yaml`**

```yaml
# Team-specific overrides for team-heros
service:
  name: backend-api

postgresql:
  enabled: true
  auth:
    database: "heros_production"
    username: "heros_backend"
    password: "heros_secure_pass_2024"

env:
  - name: DATABASE_URL
    value: "postgresql://heros_backend:heros_secure_pass_2024@backend-postgresql:5432/heros_production"
  - name: TEAM_NAME
    value: "heros"
```

### Example 3: CI/CD Integration with Dependencies

**GitHub Actions workflow:**

```yaml
- name: Update Helm Dependencies
  run: |
    cd deploy
    helm dependency update
    cd ..

- name: Deploy Backend with PostgreSQL
  run: |
    helm template backend ./deploy \
      -f deploy/values.backend.yaml \
      --set teamName=${{ env.TEAM_NAME }} \
      --set image.tag=${{ github.sha }} \
      --set postgresql.enabled=true \
      --set postgresql.auth.password=${{ secrets.DB_PASSWORD }} | kubectl apply -f -
```

### Example 4: Using External Database (RDS)

**Disable PostgreSQL dependency, use external RDS:**

**File: `values.backend.yaml`**

```yaml
# Don't deploy PostgreSQL
postgresql:
  enabled: false

env:
  - name: DATABASE_URL
    valueFrom:
      secretKeyRef:
        name: rds-credentials
        key: connection-string
  # Or use individual components:
  - name: DB_HOST
    value: "hackathon-prod.abc123.ap-southeast-1.rds.amazonaws.com"
  - name: DB_PORT
    value: "5432"
  - name: DB_NAME
    value: "hackathon_production"
  - name: DB_USER
    valueFrom:
      secretKeyRef:
        name: rds-credentials
        key: username
  - name: DB_PASSWORD
    valueFrom:
      secretKeyRef:
        name: rds-credentials
        key: password
```

**Create secret for RDS:**

```bash
kubectl create secret generic rds-credentials \
  -n team-expo-1st \
  --from-literal=username=admin \
  --from-literal=password=rds-secure-password \
  --from-literal=connection-string=postgresql://admin:rds-secure-password@hackathon-prod.abc123.ap-southeast-1.rds.amazonaws.com:5432/hackathon_production
```

---

## Tips and Best Practices

### 1. **Version Control Your Values Files**

Commit all `values.*.yaml` files to your repository so teams can track configuration changes.

### 2. **Use Secrets for Sensitive Data**

Never commit passwords or API keys in values files. Use Kubernetes Secrets and reference them:

```yaml
env:
  - name: API_KEY
    valueFrom:
      secretKeyRef:
        name: app-secrets
        key: api-key
```

### 3. **Test Locally Before CI/CD**

Render templates locally to verify configuration:

```bash
helm template backend ./deploy -f deploy/values.backend.yaml --debug
```

### 4. **Pin Dependency Versions**

Always specify exact versions in `Chart.yaml` to ensure reproducible deployments:

```yaml
dependencies:
  - name: postgresql
    version: "12.1.0"  # Not "12.x" or "~12.1.0"
```

### 5. **Use Conditional Dependencies**

Enable/disable dependencies per environment:

```yaml
# Development: use in-cluster PostgreSQL
postgresql:
  enabled: true

# Production: use external RDS
postgresql:
  enabled: false
```

### 6. **Resource Limits**

Always set resource requests and limits to prevent resource exhaustion:

```yaml
resources:
  requests:
    cpu: 500m
    memory: 512Mi
  limits:
    cpu: 1000m
    memory: 1024Mi
```

---

## Troubleshooting

### Dependencies Not Found

```bash
# Error: found in Chart.yaml, but missing in charts/ directory
helm dependency update
```

### Dependency Version Conflicts

```bash
# Remove old charts and update
rm -rf charts/*.tgz
helm dependency update
```

### Service Can't Connect to Database

Check the service DNS name:

```bash
# PostgreSQL service name format:
<release-name>-postgresql.<namespace>.svc.cluster.local

# Verify service exists:
kubectl get svc -n team-expo-1st | grep postgresql
```

### View Rendered Templates

```bash
# See what will be deployed:
helm template backend ./deploy \
  -f deploy/values.backend.yaml \
  --set teamName=expo-1st \
  --debug
```

---

## Further Reading

- [Helm Chart Dependencies](https://helm.sh/docs/helm/helm_dependency/)
- [Bitnami PostgreSQL Chart](https://github.com/bitnami/charts/tree/main/bitnami/postgresql)
- [Bitnami Redis Chart](https://github.com/bitnami/charts/tree/main/bitnami/redis)
- [Kubernetes Secrets](https://kubernetes.io/docs/concepts/configuration/secret/)
- [ConfigMaps](https://kubernetes.io/docs/concepts/configuration/configmap/)
