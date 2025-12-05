# GitHub Organization Secrets Configuration

This document outlines the required GitHub secrets that need to be configured at the **Organization level** to enable automatic deployment workflows for all team repositories.

## Required Secrets

Configure these secrets at: `https://github.com/organizations/Elm-Hackathon-2025/settings/secrets/actions`

### 1. AWS_ACCESS_KEY_ID
- **Description**: AWS IAM access key ID for ECR and ECS access
- **Value**: Your AWS access key ID (e.g., `AKIAIOSFODNN7EXAMPLE`)
- **Permissions Required**:
  - **ECR**: `GetAuthorizationToken`, `CreateRepository`, `DescribeRepositories`, `BatchCheckLayerAvailability`, `GetDownloadUrlForLayer`, `PutImage`, `InitiateLayerUpload`, `UploadLayerPart`, `CompleteLayerUpload`, `PutImageScanningConfiguration`
  - **CloudWatch Logs**: `CreateLogGroup`, `DescribeLogGroups`, `PutRetentionPolicy`
  - **ECS**: `RegisterTaskDefinition`, `DescribeTaskDefinition`, `CreateService`, `UpdateService`, `DescribeServices`, `ListTasks`, `DescribeTasks`
  - **IAM**: `PassRole` (for ECS task execution roles)

### 2. AWS_SECRET_ACCESS_KEY
- **Description**: AWS IAM secret access key corresponding to the access key ID
- **Value**: Your AWS secret access key (e.g., `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`)
- **Security**: This is sensitive - never commit or expose this value

### 3. AWS_ACCOUNT_ID
- **Description**: Your AWS account ID (12-digit number)
- **Value**: `060795935816`
- **Usage**: Used to construct ECR repository URLs

## How to Set Up

1. Go to your GitHub organization settings:
   ```
   https://github.com/organizations/Elm-Hackathon-2025/settings/secrets/actions
   ```

2. Click **"New organization secret"**

3. Add each secret with:
   - **Name**: Exactly as listed above (case-sensitive)
   - **Value**: The corresponding value
   - **Repository access**: Select **"All repositories"** or choose specific repositories

## Verification

After adding secrets, verify they're available in any repository:

1. Go to any team repository
2. Navigate to: `Settings` → `Secrets and variables` → `Actions`
3. You should see the organization secrets listed under "Organization secrets"

## IAM Policy Example

Here's the complete IAM policy for the AWS credentials (GitHubActionsECSDeployPolicy):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ECRAuthorizationToken",
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken"
      ],
      "Resource": "*"
    },
    {
      "Sid": "ECRRepositoryManagement",
      "Effect": "Allow",
      "Action": [
        "ecr:CreateRepository",
        "ecr:DescribeRepositories",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:PutImageScanningConfiguration"
      ],
      "Resource": "arn:aws:ecr:ap-southeast-1:060795935816:repository/hackathon-*"
    },
    {
      "Sid": "CloudWatchLogsManagement",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:DescribeLogGroups",
        "logs:PutRetentionPolicy"
      ],
      "Resource": "arn:aws:logs:ap-southeast-1:060795935816:log-group:/ecs/hackathon*"
    },
    {
      "Sid": "ECSTaskDefinitionManagement",
      "Effect": "Allow",
      "Action": [
        "ecs:RegisterTaskDefinition",
        "ecs:DescribeTaskDefinition",
        "ecs:DeregisterTaskDefinition"
      ],
      "Resource": "*"
    },
    {
      "Sid": "ECSServiceManagement",
      "Effect": "Allow",
      "Action": [
        "ecs:CreateService",
        "ecs:UpdateService",
        "ecs:DescribeServices",
        "ecs:DeleteService",
        "ecs:ListTasks",
        "ecs:DescribeTasks"
      ],
      "Resource": [
        "arn:aws:ecs:ap-southeast-1:060795935816:service/hackathon-cluster/*",
        "arn:aws:ecs:ap-southeast-1:060795935816:task/hackathon-cluster/*"
      ]
    },
    {
      "Sid": "IAMPassRole",
      "Effect": "Allow",
      "Action": [
        "iam:PassRole"
      ],
      "Resource": [
        "arn:aws:iam::060795935816:role/ecsTaskExecutionRole",
        "arn:aws:iam::060795935816:role/ecsTaskRole"
      ]
    }
  ]
}
```

### Required Permissions Explained

- **ECR**: Create repositories, push images, scan images
- **CloudWatch Logs**: Create log groups for ECS services
- **ECS**: Register task definitions, create/update services, describe tasks
- **IAM**: Pass roles to ECS tasks (required for task execution)



## Security Best Practices

1. **Use dedicated IAM user**: Create a specific IAM user for GitHub Actions (e.g., `github-actions-deployer`)
2. **Least privilege**: Only grant the minimum required permissions
3. **Rotate credentials**: Regularly rotate AWS access keys (every 90 days recommended)
4. **Enable MFA**: Consider MFA for the IAM user for additional security
5. **Audit logs**: Monitor CloudTrail logs for the access key usage

## Troubleshooting

### Secret not found
- Ensure secrets are set at Organization level, not repository level
- Verify repository access is set correctly in organization secret settings

### Permission denied
- Check the IAM policy has all required permissions
- Verify the AWS account ID matches your actual account

### ECR login fails
- Ensure `AWS_ACCOUNT_ID` matches the ECR repository account
- Verify `AWS_REGION` in the workflow matches your ECR region (ap-southeast-1)
