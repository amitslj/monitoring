# AWS Monitoring Module

**Standalone CloudWatch alarm deployment system for AWS resources.**

This is a completely independent monitoring module that creates CloudWatch alarms for AWS resources based on inventory data. It uses a direct CDK deployment approach to create and manage alarms efficiently.

## 🏗️ High-Level Architecture

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   Inventory File    │    │   Alarm Mappings    │    │   Configuration     │
│ (inventory-*.json)  │    │ (alarm-mappings.json)│    │   (config.json)     │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
           │                           │                           │
           └─────────────┐             │             ┌─────────────┘
                         ▼             ▼             ▼
                    ┌─────────────────────────────────────┐
                    │        CDK Application              │
                    │     (alarm-deployment-cdk)          │
                    └─────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
           ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
           │ Lambda Alarms   │ │API Gateway      │ │  Future Stack   │
           │     Stack       │ │ Alarms Stack    │ │ (DynamoDB, etc) │
           └─────────────────┘ └─────────────────┘ └─────────────────┘
                    │                 │                 │
                    └─────────────────┼─────────────────┘
                                      ▼
                    ┌─────────────────────────────────────┐
                    │         CloudWatch Alarms           │
                    │    (Deployed to AWS Account)        │
                    └─────────────────────────────────────┘
```

### Key Components

1. **Inventory Data**: JSON files containing discovered AWS resources
2. **Alarm Mappings**: Configuration defining alarm rules for each resource type
3. **CDK Application**: TypeScript-based infrastructure-as-code that creates CloudWatch alarms
4. **Resource-Specific Stacks**: Separate CloudFormation stacks for each resource type
5. **CloudWatch Alarms**: Deployed monitoring alarms in your AWS account

## 🚀 Quick Start

### Prerequisites

- Node.js 18.x or later
- AWS CLI configured with appropriate permissions
- AWS CDK v2 installed globally: `npm install -g aws-cdk`
- CDK bootstrapped in your target AWS account/region

### 1. Configure

Ensure your `config.json` is properly configured:

```json
{
  "aws": {
    "accountId": "891377317762",
    "region": "us-east-1"
  },
  "resources": {
    "types": ["lambda", "apigateway", "apigatewayv2"]
  }
}
```

### 2. Deploy Alarms

```bash
npm run deploy
```

This single command will:
1. Install all dependencies
2. Build the CDK application
3. Deploy CloudWatch alarms for all resources in your inventory

## 📁 Project Structure

```
monitoring/
├── config.json                      # Main configuration
├── alarm-mappings.json               # Alarm definitions
├── inventory-*.json                  # Resource inventory files
├── package.json                      # Root build scripts
├── README.md                         # This file
├── INSTALL.md                        # Installation guide
└── alarm-deployment-cdk/             # CDK application
    ├── app.ts                        # Main CDK app
    ├── lib/                          # Utility libraries
    │   ├── types.ts                  # Type definitions
    │   ├── config-loader.ts          # Configuration loader
    │   └── alarm-utils.ts            # Alarm utilities
    └── stacks/                       # CDK stacks
        ├── lambda-alarms-stack.ts    # Lambda alarms
        └── apigateway-alarms-stack.ts # API Gateway alarms
```

## ⚙️ Configuration

### Core Configuration (`config.json`)

- **aws.accountId**: Target AWS account ID
- **aws.region**: Target AWS region
- **resources.types**: Array of resource types to process

### Alarm Definitions (`alarm-mappings.json`)

Defines alarm rules for each resource type:

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

### Inventory Files

JSON files containing discovered AWS resources. The system automatically uses the latest inventory file found in the root directory.

## 🔧 Available Commands

```bash
# Deploy all alarm stacks
npm run deploy

# Destroy all alarm stacks
npm run destroy-alarms

# Show what would be deployed
npm run synth-alarms

# Show differences from current deployment
npm run diff-alarms
```

## 📊 Current Deployment

Based on the current inventory, the system creates alarms for:

### Lambda Functions (2 resources)
- **lambda2**: Error rate and duration alarms (timeout: 603s)
- **lambdai1**: Error rate and duration alarms (timeout: 303s)

### API Gateway (1 resource)
- **test-api**: 4XX error and latency alarms

### Alarm Types Created

**Lambda Alarms** (per function):
- `{function-name}-HighErrorRate`: Triggers when errors > 5
- `{function-name}-HighDuration`: Triggers when duration > 80% of timeout

**API Gateway Alarms** (per API):
- `{api-name}-High4XXErrors`: Triggers when 4XX errors > 10
- `{api-name}-HighLatency`: Triggers when latency > 5000ms

## 🔍 Features

- **Direct CDK Deployment**: No Lambda functions required
- **Resource-Specific Stacks**: Separate CloudFormation stacks for each resource type
- **Dynamic Thresholds**: Alarms adapt to resource configurations (e.g., Lambda timeout)
- **Comprehensive Tagging**: All alarms tagged with resource metadata
- **Automatic Discovery**: Finds latest inventory file automatically
- **Extensible**: Easy to add new resource types and alarm definitions

## 🛠️ Extending the System

### Adding New Resource Types

1. Add alarm definitions to `alarm-mappings.json`
2. Create a new stack in `alarm-deployment-cdk/stacks/`
3. Update the main app in `alarm-deployment-cdk/app.ts`
4. Include the resource type in `config.json`

### Customizing Alarms

Modify `alarm-mappings.json` to:
- Change thresholds
- Add new alarm types
- Modify evaluation periods
- Update comparison operators

## 🔧 Troubleshooting

### Common Issues

1. **No stacks created**: Verify inventory file exists and contains resources
2. **Permission errors**: Ensure AWS credentials have CloudWatch permissions
3. **Build failures**: Check Node.js version and run `npm install`
4. **CDK errors**: Ensure CDK is bootstrapped in target account/region

### Debug Commands

```bash
# Check what would be deployed
npm run synth-alarms

# View detailed differences
npm run diff-alarms

# Check CDK version
npx cdk --version
```

## 📋 Prerequisites Checklist

- [ ] Node.js 18.x+ installed
- [ ] AWS CLI configured
- [ ] AWS CDK v2 installed globally
- [ ] CDK bootstrapped in target account/region
- [ ] Inventory file present in root directory
- [ ] `config.json` configured with correct AWS account/region
- [ ] `alarm-mappings.json` contains alarm definitions

## 🎯 Next Steps

After successful deployment:

1. **Verify Alarms**: Check AWS CloudWatch console for created alarms
2. **Test Notifications**: Consider adding SNS topics to alarms
3. **Monitor Performance**: Review alarm states and adjust thresholds as needed
4. **Extend Coverage**: Add more resource types as needed

## 📚 Documentation

- [INSTALL.md](INSTALL.md) - Detailed installation instructions
- [alarm-deployment-cdk/README.md](alarm-deployment-cdk/README.md) - CDK application details

---

This monitoring module provides a robust, scalable foundation for AWS resource monitoring using CloudWatch alarms deployed directly via CDK.