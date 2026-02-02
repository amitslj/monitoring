# Monitoring Module Installation Guide

Installation and deployment guide for the standalone monitoring module with CloudWatch alarm management.

## Prerequisites

- **Node.js 18.x** or later
- **AWS CLI** configured with credentials
- **AWS CDK v2** installed globally: `npm install -g aws-cdk`

## Configuration

All settings are managed in a single `config.json` file:

```json
{
  "aws": {
    "accountId": "891377317762",
    "region": "us-east-1"
  },
  "s3": {
    "bucket": "cdk-use1-deploy-bucket",
    "prefix": "inventory/",
    "alarmPrefix": "alarm/"
  },
  "resources": {
    "types": ["lambda", "apigateway", "apigatewayv2"],
    "tagFilters": [
      {"key": "Environment", "value": "qa"},
      {"key": "Project", "value": "cmd-saas"}
    ]
  },
  "lambda": {
    "timeout": 900,
    "memorySize": 512,
    "logLevel": "INFO"
  },
  "schedule": {
    "enabled": true,
    "expression": "cron(0 2 * * ? *)",
    "description": "Daily resource inventory scan at 2 AM UTC"
  }
}
```

### Configuration Options

- **aws.accountId**: AWS account ID for deployment
- **aws.region**: AWS region (e.g., us-east-1, eu-central-1)
- **s3.bucket**: S3 bucket for storing inventory and alarm reports
- **s3.prefix**: S3 prefix/folder for inventory reports
- **s3.alarmPrefix**: S3 prefix/folder for alarm reports
- **resources.types**: AWS resource types to scan (lambda, apigateway, apigatewayv2)
- **resources.tagFilters**: Array of tag key/value pairs to filter resources
- **lambda.timeout**: Lambda timeout in seconds (max 900)
- **lambda.memorySize**: Lambda memory in MB (128-10240)
- **lambda.logLevel**: Log level (DEBUG, INFO, WARN, ERROR)
- **schedule.enabled**: Enable/disable scheduled execution
- **schedule.expression**: Cron expression for schedule

## Quick Start

### 1. Configure AWS Credentials

Your AWS credentials are already configured in `~/.aws/credentials`. The CDK will automatically use these credentials.

### 2. Upload Alarm Mappings

Upload the alarm configuration to S3:

```bash
aws s3 cp alarm-mappings.json s3://cdk-use1-deploy-bucket/alarm-mappings.json
```

#Bootsrapping AWS Account -
#npx cdk bootstrap aws://891377317762/us-east-1 --cloudformation-execution-policies arn:aws:iam::891377317762:policy/cdk-policy

### 3. Install Dependencies

```bash
npm install
```

### 4. Build

```bash
npm run build
```

### 5. Deploy

```bash
npm run deploy
```

### 6. Test the Deployment

```bash
# Test resource inventory
aws lambda invoke \
  --function-name monitoring-resource-inventory-dev \
  --payload '{}' \
  response.json

# Test alarm generation
aws lambda invoke \
  --function-name monitoring-alarm-generator-dev \
  --payload '{}' \
  alarm-response.json

# View the responses
cat response.json
cat alarm-response.json
```

### 7. Check Results

```bash
# List inventory files in S3
aws s3 ls s3://cdk-use1-deploy-bucket/inventory/ --recursive

# List alarm results in S3
aws s3 ls s3://cdk-use1-deploy-bucket/alarm/ --recursive

# Check CloudWatch alarms
aws cloudwatch describe-alarms --alarm-name-prefix "lambda2-" --region us-east-1
aws cloudwatch describe-alarms --alarm-name-prefix "test-api-" --region us-east-1
```

## Available Commands

```bash
# Build the module
npm run build

# Deploy infrastructure
npm run deploy

# Destroy infrastructure
npm run destroy

# Clean build artifacts
npm run clean
```

## Manual Invocation

### Default Parameters

```bash
aws lambda invoke \
  --function-name monitoring-resource-inventory-dev \
  --payload '{}' \
  response.json
```

### Custom Parameters

```bash
aws lambda invoke \
  --function-name monitoring-resource-inventory-dev \
  --payload '{
    "resourceTypes": ["lambda"],
    "tagFilters": [
      {"key": "Environment", "value": "prod"}
    ]
  }' \
  response.json
```

## Output Files

The system generates multiple types of reports in S3:

1. **Detailed Inventory**: `s3://cdk-use1-deploy-bucket/inventory/inventory-TIMESTAMP.json`
2. **Alarm Results**: `s3://cdk-use1-deploy-bucket/alarm/alarm-results-TIMESTAMP.json`
3. **CloudWatch Alarms**: Created automatically in AWS CloudWatch

### Sample Output

```json
{
  "generatedAt": "2026-02-01T10:30:00.000Z",
  "totalResources": 25,
  "resourcesByType": {
    "lambda": 15,
    "apigateway": 5,
    "apigatewayv2": 5
  },
  "resources": [
    {
      "arn": "arn:aws:lambda:us-east-1:123456789012:function:my-function",
      "type": "lambda",
      "name": "my-function",
      "region": "us-east-1",
      "tags": {
        "Environment": "qa",
        "Project": "cmd-saas"
      },
      "metadata": {
        "runtime": "nodejs18.x",
        "handler": "index.handler",
        "memorySize": 512
      }
    }
  ]
}
```

## Extending Resource Types

1. Add new resource type to `config.json`:

```json
{
  "resources": {
    "types": ["lambda", "apigateway", "apigatewayv2", "dynamodb"]
  }
}
```

2. Implement scanner in `resource-inventory-lambda/src/resource-scanner.ts`
3. Update IAM permissions in `infra/stacks/monitoring-stack.ts`
4. Redeploy with `npm run deploy`

## Troubleshooting

### Common Issues

1. **Permission Errors**: Check AWS credentials are properly configured in `~/.aws/credentials`
2. **S3 Access Denied**: Verify bucket exists and is accessible
3. **Build Failures**: Ensure Node.js 18.x is installed
4. **CDK Bootstrap**: Run `npx cdk bootstrap` if first time using CDK in this account/region

### Debug Mode

Set log level to DEBUG in `config.json`:

```json
{
  "lambda": {
    "logLevel": "DEBUG"
  }
}
```

### View Logs

```bash
# View CloudWatch logs
aws logs tail /aws/lambda/monitoring-resource-inventory-dev --follow
```

## Security Note

✅ **Good Practice**: AWS credentials are now stored securely in the AWS credentials file (`~/.aws/credentials`). This is the recommended approach for local development and PoC work.

## Cleanup

```bash
# Destroy all resources
npm run destroy
```

## Structure

```
monitoring/
├── config.json                      # Central configuration
├── package.json                     # Build scripts
├── README.md                        # Documentation
├── INSTALL.md                       # Installation guide
├── .gitignore                       # Git ignore patterns
├── resource-inventory-lambda/       # Resource discovery Lambda
│   ├── src/                         # TypeScript source
│   ├── package.json                 # Lambda dependencies
│   └── tsconfig.json                # TypeScript config
├── cloudwatch-alarm-lambda/         # Alarm generation Lambda
│   ├── src/                         # TypeScript source
│   ├── package.json                 # Lambda dependencies
│   └── tsconfig.json                # TypeScript config
└── infra/                           # CDK infrastructure
    ├── launcher.ts                  # CDK entry point
    ├── stacks/
    │   └── monitoring-stack.ts      # CDK stack
    ├── package.json                 # CDK dependencies
    ├── tsconfig.json                # TypeScript config
    └── cdk.json                     # CDK configuration
```

## What Gets Deployed

- **Resource Inventory Lambda**: `monitoring-resource-inventory-dev`
- **Alarm Generator Lambda**: `monitoring-alarm-generator-dev`
- **EventBridge Rules**:
  - `monitoring-daily-inventory-dev` (scheduled daily at 2:00 AM UTC)
  - `monitoring-alarm-generation-dev` (scheduled daily at 2:15 AM UTC)
- **IAM Roles**: Lambda execution roles with permissions to scan resources, write to S3, and manage CloudWatch alarms
- **S3 Bucket**: References existing `cdk-use1-deploy-bucket`
- **CloudWatch Alarms**: Automatically created for discovered resources

## Next Steps

After successful deployment, consider:

1. Customizing alarm thresholds in `alarm-mappings.json`
2. Adding SNS notifications to CloudWatch alarms
3. Implementing additional resource types (DynamoDB, RDS, etc.)
4. Adding email notifications for inventory reports
5. Setting up proper AWS credential management for production
6. Adding error handling and retry logic
7. Implementing alarm cleanup for deleted resources
