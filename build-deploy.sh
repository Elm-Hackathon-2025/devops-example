# Navigate to examples directory
# cd examples

# Build and push a sample Docker image
export TEAM_NAME=expo-1st
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export AWS_REGION=ap-southeast-1

# Login to ECR
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Build the sample app
docker build -f Dockerfile.node -t hackathon-$TEAM_NAME .

# Tag and push to ECR
docker tag hackathon-$TEAM_NAME:latest \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/hackathon-$TEAM_NAME:latest

docker push \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/hackathon-$TEAM_NAME:latest

# Force ECS to redeploy with new image
aws ecs update-service \
  --cluster hackathon-cluster \
  --service hackathon-$TEAM_NAME \
  --force-new-deployment \
  --region $AWS_REGION