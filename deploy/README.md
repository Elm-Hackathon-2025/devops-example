# Hackathon Service Helm Chart

A flexible Helm chart for deploying hackathon team services to EKS with automatic ingress, certificate management, and ExternalDNS integration.

## Features

- ✅ Automatic team namespace targeting
- ✅ Certificate ARN selection by team name
- ✅ Configurable container ports and health checks
- ✅ ExternalDNS integration for automatic DNS records
- ✅ AWS ALB Ingress with HTTPS
- ✅ Flexible environment variables and secrets
- ✅ Optional persistent storage
- ✅ Service-specific value files

## Quick Start

### 1. Deploy with Default Values

```bash
# Deploy backend API
helm template backend ./deploy \
  -f deploy/values.backend.yaml \
  --set teamName=expo-1st \
  --set image.tag=v1.0.0 | kubectl apply -f -

# Deploy frontend
helm template frontend ./deploy \
  -f deploy/values.frontend.yaml \
  --set teamName=expo-1st \
  --set image.tag=v1.0.0 | kubectl apply -f -
```

### 2. Deploy to Different Team

```bash
# Deploy to team-heros
helm template backend ./deploy \
  -f deploy/values.backend.yaml \
  --set teamName=heros \
  --set image.repository=hackathon-heros \
  --set image.tag=latest \
  --set ingress.hostname=api.heros.bp.elmhakathon.com | kubectl apply -f -
```

### 3. Deploy from GitHub Actions

```yaml
- name: Deploy to EKS
  run: |
    helm template ${{ env.SERVICE_NAME }} ./deploy \
      -f deploy/values.${{ env.SERVICE_NAME }}.yaml \
      --set teamName=${{ env.TEAM_NAME }} \
      --set image.tag=${{ github.sha }} | kubectl apply -f -
```

## Configuration

### Team Name (Required)

The `teamName` value is required and must match one of the teams defined in `certArnTeamMapping`.

```yaml
teamName: "expo-1st"  # kebab-case team name
```

### Image Configuration

```yaml
image:
  registry: "060795935816.dkr.ecr.ap-southeast-1.amazonaws.com"
  repository: "hackathon-expo-1st"
  tag: "latest"
  pullPolicy: Always
```

### Container Port

```yaml
containerPort: 3000  # Port your container listens on
service:
  port: 80          # Port exposed by the service
```

### Ingress & Health Checks

```yaml
ingress:
  enabled: true
  className: "alb"
  hostname: "api.expo-1st.bp.elmhakathon.com"
  
  healthCheck:
    path: "/health"
    intervalSeconds: 15
    timeoutSeconds: 5
    healthyThreshold: 2
    unhealthyThreshold: 2
    successCodes: "200,404"
```

### Certificate ARN Mapping

Update `values.yaml` with your team's certificate ARN:

```bash
# Get certificate ARN for your team
./scripts/get-cert-arn.sh expo-1st
```

Add to `certArnTeamMapping` in `values.yaml`:

```yaml
certArnTeamMapping:
  expo-1st: "arn:aws:acm:ap-southeast-1:060795935816:certificate/7adebf0f-..."
  heros: "arn:aws:acm:ap-southeast-1:060795935816:certificate/abc123..."
```

### Environment Variables

```yaml
env:
  - name: NODE_ENV
    value: "production"
  - name: DB_HOST
    value: "postgres"

envFromSecrets:
  - secretName: "app-secrets"

envFromConfigMaps:
  - configMapName: "app-config"
```

### Persistent Storage

```yaml
persistence:
  enabled: true
  storageClass: "gp3"
  accessMode: ReadWriteOnce
  size: 20Gi
  mountPath: /data
  subPath: ""
```

## Service-Specific Values Files

### Backend API (`values.backend.yaml`)

- Port: 3000
- Health checks: `/health`
- Replicas: 3
- Secrets/ConfigMaps enabled

### Frontend (`values.frontend.yaml`)

- Port: 8080
- No health checks (static content)
- Replicas: 2
- Environment: BACKEND_URL

## GitHub Actions Integration

### Complete Workflow Example

```yaml
name: Deploy Service

on:
  push:
    branches: [main]

env:
  TEAM_NAME: expo-1st
  AWS_REGION: ap-southeast-1
  ECR_REGISTRY: 060795935816.dkr.ecr.ap-southeast-1.amazonaws.com

jobs:
  deploy:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: [backend, frontend]
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
      
      - name: Login to ECR
        run: |
          aws ecr get-login-password --region ${{ env.AWS_REGION }} | \
            docker login --username AWS --password-stdin ${{ env.ECR_REGISTRY }}
      
      - name: Build and push
        run: |
          docker build -t ${{ env.ECR_REGISTRY }}/hackathon-${{ env.TEAM_NAME }}-${{ matrix.service }}:${{ github.sha }} \
            -f Dockerfile.${{ matrix.service }} .
          docker push ${{ env.ECR_REGISTRY }}/hackathon-${{ env.TEAM_NAME }}-${{ matrix.service }}:${{ github.sha }}
      
      - name: Configure kubectl
        run: |
          aws eks update-kubeconfig --name k8s-hakathon-prod --region ${{ env.AWS_REGION }}
      
      - name: Deploy to EKS
        run: |
          helm template ${{ matrix.service }} ./deploy \
            -f deploy/values.${{ matrix.service }}.yaml \
            --set teamName=${{ env.TEAM_NAME }} \
            --set image.repository=hackathon-${{ env.TEAM_NAME }}-${{ matrix.service }} \
            --set image.tag=${{ github.sha }} | kubectl apply -f -
      
      - name: Wait for rollout
        run: |
          kubectl rollout status deployment/${{ matrix.service }} \
            -n team-${{ env.TEAM_NAME }} \
            --timeout=5m
```

### Docker Compose Services

If you have multiple services in `docker-compose.yml`:

```yaml
name: Deploy All Services

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Get service names
        id: services
        run: |
          SERVICES=$(docker-compose config --services | jq -R -s -c 'split("\n")[:-1]')
          echo "services=$SERVICES" >> $GITHUB_OUTPUT
      
      - name: Deploy each service
        run: |
          for service in $(echo '${{ steps.services.outputs.services }}' | jq -r '.[]'); do
            echo "Deploying $service..."
            
            # Build and push
            docker-compose build $service
            docker tag ${service}:latest ${{ env.ECR_REGISTRY }}/hackathon-${{ env.TEAM_NAME }}-${service}:${{ github.sha }}
            docker push ${{ env.ECR_REGISTRY }}/hackathon-${{ env.TEAM_NAME }}-${service}:${{ github.sha }}
            
            # Deploy with Helm
            helm template $service ./deploy \
              -f deploy/values.${service}.yaml \
              --set teamName=${{ env.TEAM_NAME }} \
              --set image.repository=hackathon-${{ env.TEAM_NAME }}-${service} \
              --set image.tag=${{ github.sha }} | kubectl apply -f -
          done
```

## Adding Dependencies

Add to `Chart.yaml`:

```yaml
dependencies:
  - name: postgresql
    version: "12.1.0"
    repository: "https://charts.bitnami.com/bitnami"
    condition: postgresql.enabled
  
  - name: redis
    version: "17.3.0"
    repository: "https://charts.bitnami.com/bitnami"
    condition: redis.enabled
```

Then run:

```bash
helm dependency update ./deploy
```

## Custom Templates

Add custom Kubernetes manifests to `deploy/templates/`:

```bash
# Add a ConfigMap
cat > deploy/templates/configmap.yaml << 'EOF'
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{ .Values.service.name }}-config
  namespace: team-{{ .Values.teamName }}
data:
  config.json: |
    {{ .Values.customConfig | toJson }}
EOF
```

## Testing

### Dry Run

```bash
helm template backend ./deploy \
  -f deploy/values.backend.yaml \
  --set teamName=expo-1st \
  --debug
```

### Validate

```bash
helm template backend ./deploy \
  -f deploy/values.backend.yaml \
  --set teamName=expo-1st | kubectl apply --dry-run=server -f -
```

## Troubleshooting

### Check deployment status

```bash
kubectl get pods -n team-expo-1st
kubectl get ingress -n team-expo-1st
kubectl describe ingress backend -n team-expo-1st
```

### View logs

```bash
kubectl logs -n team-expo-1st -l app=backend --tail=100 -f
```

### Check certificate

```bash
./scripts/get-cert-arn.sh expo-1st
```

### Verify DNS

```bash
dig api.expo-1st.bp.elmhakathon.com +short
```

## Common Patterns

### Multi-environment deployment

```bash
# Production
helm template backend ./deploy \
  -f deploy/values.backend.yaml \
  --set teamName=expo-1st \
  --set image.tag=v1.0.0 \
  --set env[0].value=production | kubectl apply -f -

# Staging
helm template backend ./deploy \
  -f deploy/values.backend.yaml \
  --set teamName=expo-1st-staging \
  --set image.tag=v1.0.0-rc1 \
  --set env[0].value=staging | kubectl apply -f -
```

### Blue-Green deployment

```bash
# Deploy green
helm template backend-green ./deploy \
  -f deploy/values.backend.yaml \
  --set service.name=backend-green \
  --set image.tag=v2.0.0 | kubectl apply -f -

# Test green deployment
# Switch traffic by updating ingress...
```
