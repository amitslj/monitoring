# Monitoring Module

**Standalone monitoring infrastructure for AWS resource inventory and CloudWatch alarm management.**

This is a completely independent monitoring module that provides AWS resource discovery, inventory generation, and automated CloudWatch alarm creation. It operates independently from the main SaaS platform planes (control-plane, app-plane, observe-plane).

## Features

- **Resource Discovery**: Automatically discovers Lambda and API Gateway resources (v1 & v2)
- **Tag-based Filtering**: Filter resources by tag key/value pairs
- **CloudWatch Alarms**: Automatically creates alarms for discovered resources
- **S3 Storage**: Stores detailed inventory and alarm reports in S3
- **Scheduled Execution**: EventBridge rules for daily inventory and alarm generation
- **Central Configuration**: Single `config.json` file manages all settings
- **Configurable Alarms**: JSON-based alarm definitions for different resource types
- **Simple Deployment**: Just `npm run deploy` - no external dependencies

## Quick Start

### Prerequisites

- Node.js 18.x or later
- AWS CLI configured
- AWS CDK v2 installed globally: `npm install -g aws-cdk`

### 1. Configure

Edit `config.json` to set your AWS account, S3 bucket, and resource filters:

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
      {"key": "cmd-saas", "value": "12345"},
      {"key": "environment", "value": "qa"}
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

### 2. Deploy

```bash
# Deploy to dev environment
npm run deploy

# Deploy to specific environment
ENVIRONMENT=staging npm run deploy:env
```

### 3. Test

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

# Check S3 for results
aws s3 ls s3://cdk-use1-deploy-bucket/inventory/
aws s3 ls s3://cdk-use1-deploy-bucket/alarm/
```

## Configuration

All settings are managed in `config.json`:

### Core Settings

- **aws.accountId**: AWS account for deployment
- **aws.region**: AWS region (us-east-1, eu-central-1, etc.)
- **s3.bucket**: S3 bucket for storing inventory and alarm reports
- **s3.prefix**: S3 prefix/folder for inventory reports
- **s3.alarmPrefix**: S3 prefix/folder for alarm reports

### Resource Discovery

- **resources.types**: Array of AWS resource types to scan
  - `"lambda"` - AWS Lambda functions
  - `"apigateway"` - API Gateway v1 REST APIs
  - `"apigatewayv2"` - API Gateway v2 HTTP APIs
- **resources.tagFilters**: Array of tag filters to apply
  - `{"key": "environment", "value": "qa"}`
  - `{"key": "cmd-saas", "value": "12345"}`

### CloudWatch Alarms

The system automatically creates CloudWatch alarms for discovered resources based on `alarm-mappings.json`:

- **Lambda Alarms**: Error rate and duration monitoring
- **API Gateway Alarms**: 4XX errors and latency monitoring
- **Configurable Thresholds**: Customize alarm thresholds per resource type
- **Auto-Tagging**: Alarms are tagged with resource information

### Lambda Settings

- **lambda.timeout**: Function timeout in seconds (max 900)
- **lambda.memorySize**: Memory allocation in MB (128-10240)
- **lambda.logLevel**: Log level (DEBUG, INFO, WARN, ERROR)

### Scheduling

- **schedule.enabled**: Enable/disable scheduled execution
- **schedule.expression**: Cron expression (e.g., `"cron(0 2 * * ? *)"`)
- **schedule.description**: Human-readable description

## Usage

### Available Commands

```bash
npm run build          # Build Lambda and CDK
npm run deploy         # Deploy to dev (default)
npm run synth          # Generate CloudFormation
npm run diff           # Show deployment differences
npm run destroy        # Destroy infrastructure
npm run clean          # Clean build artifacts

# Environment-specific commands
ENVIRONMENT=prod npm run deploy:env
ENVIRONMENT=staging npm run diff:env
ENVIRONMENT=prod npm run destroy:env
```

### Manual Invocation

```bash
# Use default configuration
aws lambda invoke \
  --function-name monitoring-resource-inventory-dev \
  --payload '{}' \
  response.json

# Override configuration
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

## Output

The system generates multiple types of reports in S3:

### 1. Detailed Inventory

**Location**: `s3://bucket/prefix/inventory-TIMESTAMP.json`

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
      },
      "discoveredAt": "2026-02-01T10:30:00.000Z"
    }
  ],
  "statistics": {
    "scanDurationMs": 5432,
    "apiCalls": 12,
    "errors": []
  }
}
```

### 2. Alarm Results Report

**Location**: `s3://bucket/alarm/alarm-results-TIMESTAMP.json`

```json
{
  "generatedAt": "2026-02-01T15:10:00.312Z",
  "totalAlarms": 6,
  "alarmsByStatus": {
    "created": 6,
    "updated": 0,
    "failed": 0
  },
  "alarmsByResourceType": {
    "lambda": 4,
    "apigateway": 2
  },
  "results": [
    {
      "resourceArn": "arn:aws:lambda:us-east-1:891377317762:function:lambda2",
      "resourceName": "lambda2",
      "resourceType": "lambda",
      "alarmName": "lambda2-HighErrorRate",
      "status": "created"
    }
  ]
}
```

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   EventBridge   │───▶│ Inventory Lambda │───▶│   S3 Bucket     │
│ (2:00 AM UTC)   │    │ (Resource Scan)  │    │  (inventory/)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        │
                       ┌─────────────────┐               │
                       │   AWS APIs      │               │
                       │ (Lambda, APIGW) │               │
                       └─────────────────┘               │
                                                         │
┌─────────────────┐    ┌─────────────────┐               │
│   EventBridge   │───▶│  Alarm Lambda   │◀──────────────┘
│ (2:15 AM UTC)   │    │ (Alarm Creator) │
└─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │  CloudWatch     │    │   S3 Bucket     │
                       │    Alarms       │    │   (alarm/)      │
                       └─────────────────┘    └─────────────────┘
```

### Components

- **Inventory Lambda**: Scans AWS resources and generates inventory
- **Alarm Lambda**: Creates CloudWatch alarms for discovered resources
- **EventBridge Rules**: Triggers scheduled execution (inventory at 2:00 AM, alarms at 2:15 AM)
- **S3 Bucket**: Stores inventory and alarm reports
- **CloudWatch Alarms**: Monitors resource health and performance
- **IAM Roles**: Provides necessary permissions

## Extending

### Adding New Resource Types

1. **Update Configuration**:
   ```json
   {
     "resourceTypes": ["lambda", "apigateway", "apigatewayv2", "dynamodb"]
   }
   ```

2. **Implement Scanner**: Add method in `resource-inventory-lambda/src/resource-scanner.ts`

3. **Update Permissions**: Add IAM permissions in `infra/stacks/monitoring-stack.ts`

4. **Redeploy**: `npm run deploy`

### Adding New Environments

1. **Add to config.json**:
   ```json
   {
     "environments": {
       "dev": { ... },
       "prod": {
         "awsAccountId": "891377317762",
         "region": "us-east-1",
         "resourceTypes": ["lambda", "apigateway"],
         "tagFilters": [{"key": "Environment", "value": "prod"}]
       }
     }
   }
   ```

2. **Deploy**: `ENVIRONMENT=prod npm run deploy:env`

### Customizing CloudWatch Alarms

Modify `alarm-mappings.json` to customize alarm definitions:

```json
{
  "alarmMappings": {
    "lambda": [
      {
        "alarmName": "HighErrorRate",
        "description": "Lambda function error rate exceeds threshold",
        "metricName": "Errors",
        "namespace": "AWS/Lambda",
        "threshold": 5,
        "comparisonOperator": "GreaterThanThreshold"
      }
    ]
  }
}
```

Upload the updated file to S3 and redeploy:
```bash
aws s3 cp alarm-mappings.json s3://cdk-use1-deploy-bucket/alarm-mappings.json
npm run deploy
```

## Structure

```
monitoring/
├── config.json                       # Central configuration
├── alarm-mappings.json               # CloudWatch alarm definitions
├── package.json                      # Build scripts
├── README.md                         # Documentation
├── INSTALL.md                        # Installation guide
├── .gitignore                        # Git ignore patterns
├── resource-inventory-lambda/        # Resource discovery Lambda
│   ├── src/
│   │   ├── types.ts                  # Type definitions
│   │   ├── config.ts                 # Configuration management
│   │   ├── resource-scanner.ts      # AWS resource scanning
│   │   ├── s3-uploader.ts           # S3 upload functionality
│   │   └── index.ts                  # Lambda handler
│   ├── package.json                  # Lambda dependencies
│   └── tsconfig.json                 # TypeScript config
├── cloudwatch-alarm-lambda/          # Alarm generation Lambda
│   ├── src/
│   │   ├── types.ts                  # Type definitions
│   │   ├── alarm-generator.ts        # CloudWatch alarm creation
│   │   ├── s3-client.ts             # S3 operations
│   │   └── index.ts                  # Lambda handler
│   ├── package.json                  # Lambda dependencies
│   └── tsconfig.json                 # TypeScript config
└── infra/                            # CDK infrastructure
    ├── launcher.ts                   # CDK entry point
    ├── lib/
    │   └── config.ts                 # Configuration loader
    ├── stacks/
    │   └── monitoring-stack.ts       # CDK stack definition
    ├── package.json                  # CDK dependencies
    ├── tsconfig.json                 # TypeScript config
    └── cdk.json                      # CDK configuration
```

This structure follows the same patterns as `control-plane` and `app-plane` modules.

## Troubleshooting

### Common Issues

1. **Permission Errors**: Ensure AWS credentials have necessary permissions
2. **S3 Access Denied**: Verify bucket exists and is accessible
3. **Build Failures**: Ensure Node.js 18.x is installed
4. **Environment Not Found**: Check `config.json` has the environment defined

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
aws logs tail /aws/lambda/monitoring-resource-inventory-dev --follow
```

## Cleanup

```bash
# Destroy all resources
npm run destroy

# Or for specific environment
ENVIRONMENT=staging npm run destroy:env
```

## Support

This is a standalone module independent of the main SaaS platform. For issues or enhancements, modify the code directly or contact the development team.
