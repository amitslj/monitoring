# Installation Guide - AWS Monitoring Module

Complete installation and setup guide for the AWS CloudWatch alarm deployment system.

## Prerequisites

### System Requirements

- **Node.js**: Version 18.x or later
- **npm**: Version 8.x or later (comes with Node.js)
- **AWS CLI**: Version 2.x (configured with credentials)
- **AWS CDK**: Version 2.x installed globally

### AWS Requirements

- AWS account with appropriate permissions
- AWS CLI configured with credentials
- CDK bootstrapped in target account/region

## Step-by-Step Installation

### 1. Install Node.js

Download and install Node.js 18.x+ from [nodejs.org](https://nodejs.org/)

Verify installation:
```bash
node --version  # Should show v18.x.x or higher
npm --version   # Should show 8.x.x or higher
```

### 2. Install AWS CLI

#### Windows
Download from [AWS CLI Installation Guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)

#### macOS
```bash
curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
sudo installer -pkg AWSCLIV2.pkg -target /
```

#### Linux
```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

Verify installation:
```bash
aws --version  # Should show aws-cli/2.x.x
```

### 3. Configure AWS Credentials

Configure your AWS credentials using one of these methods:

#### Option A: AWS Configure (Recommended)
```bash
aws configure
```

Enter your:
- AWS Access Key ID
- AWS Secret Access Key
- Default region (e.g., `us-east-1`)
- Default output format (e.g., `json`)

#### Option B: Environment Variables
```bash
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
export AWS_DEFAULT_REGION=us-east-1
```

#### Option C: IAM Roles (for EC2/Lambda)
If running on AWS infrastructure, use IAM roles instead of credentials.

### 4. Install AWS CDK

Install CDK globally:
```bash
npm install -g aws-cdk
```

Verify installation:
```bash
cdk --version  # Should show 2.x.x
```

### 5. Bootstrap CDK (One-time setup)

Bootstrap CDK in your target AWS account and region:

```bash
cdk bootstrap aws://ACCOUNT-ID/REGION
```

Example:
```bash
cdk bootstrap aws://891377317762/us-east-1
```

**Note**: Replace `ACCOUNT-ID` and `REGION` with your actual values from `config.json`.

### 6. Verify Prerequisites

Run this verification script to check all prerequisites:

```bash
# Check Node.js
node --version

# Check npm
npm --version

# Check AWS CLI
aws --version

# Check CDK
cdk --version

# Check AWS credentials
aws sts get-caller-identity

# Check CDK bootstrap status
aws cloudformation describe-stacks --stack-name CDKToolkit --region us-east-1
```

## Configuration Setup

### 1. Update config.json

Ensure your `config.json` is configured for your environment:

```json
{
  "aws": {
    "accountId": "YOUR-ACCOUNT-ID",
    "region": "YOUR-REGION"
  },
  "resources": {
    "types": ["lambda", "apigateway", "apigatewayv2"],
    "tagFilters": [
      {"key": "environment", "value": "qa"},
      {"key": "cmd-saas", "value": "12345"}
    ]
  }
}
```

**Important**: Update `accountId` and `region` to match your AWS environment.

### 2. Verify Inventory File

Ensure you have an inventory file in the root directory:
- File should be named like `inventory-YYYY-MM-DDTHH-MM-SS-sssZ.json`
- Contains discovered AWS resources
- Matches the resource types in your `config.json`

### 3. Review Alarm Mappings

Check `alarm-mappings.json` contains appropriate alarm definitions for your resource types.

## Deployment

### First-Time Deployment

1. **Install Dependencies**:
   ```bash
   cd alarm-deployment-cdk
   npm install
   cd ..
   ```

2. **Preview Deployment** (Optional):
   ```bash
   npm run synth-alarms
   ```

3. **Deploy Alarms**:
   ```bash
   npm run deploy
   ```

## Verification

### 1. Check CloudFormation Stacks

```bash
aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE
```

Look for:
- `LambdaAlarmsStack`
- `ApiGatewayAlarmsStack`

### 2. Verify CloudWatch Alarms

```bash
# List all alarms
aws cloudwatch describe-alarms --region us-east-1

# List alarms by prefix
aws cloudwatch describe-alarms --alarm-name-prefix "lambda2-" --region us-east-1
aws cloudwatch describe-alarms --alarm-name-prefix "test-api-" --region us-east-1
```

### 3. Check AWS Console

1. Go to AWS CloudWatch Console
2. Navigate to "Alarms" section
3. Verify alarms are created with correct names and configurations

## Troubleshooting

### Common Installation Issues

#### Node.js Version Issues
```bash
# Check current version
node --version

# If using nvm, switch to Node 18+
nvm install 18
nvm use 18
```

#### AWS CLI Not Found
```bash
# Check if AWS CLI is in PATH
which aws

# If not found, add to PATH or reinstall
export PATH=$PATH:/usr/local/bin/aws
```

#### CDK Bootstrap Issues
```bash
# Check if bootstrap stack exists
aws cloudformation describe-stacks --stack-name CDKToolkit

# If not found, run bootstrap again
cdk bootstrap aws://YOUR-ACCOUNT-ID/YOUR-REGION
```

#### Permission Errors
Ensure your AWS credentials have these permissions:
- `cloudformation:*`
- `cloudwatch:*`
- `iam:CreateRole`
- `iam:AttachRolePolicy`
- `s3:GetObject` (if using S3 for assets)

### Deployment Issues

#### No Stacks Created
```bash
# Check if inventory file exists
ls -la inventory-*.json

# Check if alarm mappings exist
cat alarm-mappings.json

# Verify configuration
cat config.json
```

#### Build Errors
```bash
# Clean and rebuild
cd alarm-deployment-cdk
rm -rf node_modules dist
npm install
npm run build
```

#### CDK Deployment Errors
```bash
# Check CDK diff to see what would change
npm run diff-alarms

# Deploy with verbose output
cd alarm-deployment-cdk
npx cdk deploy --all --verbose
```

### Getting Help

#### Check Logs
```bash
# CDK logs are in the terminal output
# CloudFormation events in AWS Console
# CloudWatch logs for any Lambda functions (if applicable)
```

#### Validate Configuration
```bash
# Test AWS credentials
aws sts get-caller-identity

# Test CDK
cdk doctor

# Validate JSON files
python -m json.tool config.json
python -m json.tool alarm-mappings.json
```

## Post-Installation

### 1. Test Alarms

You can test alarms by:
- Triggering Lambda function errors
- Generating API Gateway 4XX responses
- Monitoring alarm states in CloudWatch

### 2. Set Up Notifications (Optional)

Consider adding SNS topics to your alarms for notifications:

1. Create SNS topic
2. Subscribe email/SMS to topic
3. Update alarm definitions to include SNS topic ARN

### 3. Monitor and Adjust

- Review alarm states regularly
- Adjust thresholds based on actual performance
- Add new alarm types as needed

## Cleanup

To remove all deployed resources:

```bash
npm run destroy-alarms
```

This will delete all CloudFormation stacks and associated alarms.

## Support

For issues:
1. Check this troubleshooting guide
2. Review AWS CloudFormation events in the console
3. Check CDK documentation: https://docs.aws.amazon.com/cdk/
4. Verify AWS service limits and permissions

## Next Steps

After successful installation:
- Review created alarms in CloudWatch console
- Consider adding SNS notifications
- Plan for additional resource types
- Set up monitoring dashboards