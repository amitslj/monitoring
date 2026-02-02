import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { MonitoringConfig } from '../lib/config';

export interface MonitoringStackProps extends cdk.StackProps {
  config: MonitoringConfig;
}

export class MonitoringStack extends cdk.Stack {
  public readonly resourceInventoryFunction: lambda.Function;
  public readonly alarmGeneratorFunction: lambda.Function;
  public readonly inventoryBucket: s3.IBucket;

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    const { config } = props;

    // Create or reference the S3 bucket for inventory storage
    this.inventoryBucket = this.createOrReferenceBucket(config.s3.bucket);

    // Create the resource inventory Lambda function
    this.resourceInventoryFunction = this.createResourceInventoryFunction(config);

    // Create the alarm generator Lambda function
    this.alarmGeneratorFunction = this.createAlarmGeneratorFunction(config);

    // Grant permissions to the Lambda functions
    this.grantLambdaPermissions(this.resourceInventoryFunction, this.inventoryBucket);
    this.grantAlarmLambdaPermissions(this.alarmGeneratorFunction, this.inventoryBucket);

    // Create EventBridge rule for scheduled execution (if enabled)
    if (config.schedule.enabled) {
      this.createScheduledExecution(config, this.resourceInventoryFunction);
    }

    // Create EventBridge rule to trigger alarm generation after inventory
    this.createAlarmGenerationTrigger(this.alarmGeneratorFunction);

    // Output important information
    new cdk.CfnOutput(this, 'ResourceInventoryFunctionArn', {
      value: this.resourceInventoryFunction.functionArn,
      description: 'ARN of the Resource Inventory Lambda function',
      exportName: 'MonitoringResourceInventoryFunctionArn-dev'
    });

    new cdk.CfnOutput(this, 'ResourceInventoryFunctionName', {
      value: this.resourceInventoryFunction.functionName,
      description: 'Name of the Resource Inventory Lambda function',
      exportName: 'MonitoringResourceInventoryFunctionName-dev'
    });

    new cdk.CfnOutput(this, 'InventoryBucketName', {
      value: this.inventoryBucket.bucketName,
      description: 'S3 bucket for storing inventory reports',
      exportName: 'MonitoringInventoryBucketName-dev'
    });

    new cdk.CfnOutput(this, 'AlarmGeneratorFunctionArn', {
      value: this.alarmGeneratorFunction.functionArn,
      description: 'ARN of the CloudWatch Alarm Generator Lambda function',
      exportName: 'MonitoringAlarmGeneratorFunctionArn-dev'
    });

    new cdk.CfnOutput(this, 'AlarmGeneratorFunctionName', {
      value: this.alarmGeneratorFunction.functionName,
      description: 'Name of the CloudWatch Alarm Generator Lambda function',
      exportName: 'MonitoringAlarmGeneratorFunctionName-dev'
    });
  }

  private createOrReferenceBucket(bucketName: string): s3.IBucket {
    // Reference existing bucket
    return s3.Bucket.fromBucketName(this, 'InventoryBucket', bucketName);
  }

  private createResourceInventoryFunction(config: MonitoringConfig): lambda.Function {
    return new lambda.Function(this, 'ResourceInventoryFunction', {
      functionName: 'monitoring-resource-inventory-dev',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../resource-inventory-lambda/dist'),
      timeout: cdk.Duration.seconds(config.lambda.timeout),
      memorySize: config.lambda.memorySize,
      environment: {
        S3_BUCKET: config.s3.bucket,
        S3_PREFIX: config.s3.prefix,
        RESOURCE_TYPES: JSON.stringify(config.resources.types),
        TAG_FILTERS: JSON.stringify(config.resources.tagFilters),
        AWS_ACCOUNT_ID: config.aws.accountId,
        LOG_LEVEL: config.lambda.logLevel
      },
      description: 'AWS Resource Inventory Lambda Function - PoC'
    });
  }

  private grantLambdaPermissions(func: lambda.Function, bucket: s3.IBucket): void {
    // Grant S3 permissions
    bucket.grantWrite(func);

    // Grant permissions to describe AWS resources
    func.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        // Lambda permissions
        'lambda:ListFunctions',
        'lambda:GetFunction',
        'lambda:ListTags',

        // API Gateway permissions
        'apigateway:GET',
        'apigateway:GetRestApis',
        'apigateway:GetTags',

        // API Gateway v2 permissions
        'apigateway:GetApis',

        // Resource Groups Tagging API
        'resourcegroupstaggingapi:GetResources',
        'resourcegroupstaggingapi:GetTagKeys',
        'resourcegroupstaggingapi:GetTagValues',

        // General describe permissions
        'tag:GetResources'
      ],
      resources: ['*'] // These are read-only operations that require * resource
    }));
  }

  private createScheduledExecution(config: MonitoringConfig, func: lambda.Function): void {
    // Create EventBridge rule for scheduled execution
    const rule = new events.Rule(this, 'DailyInventoryRule', {
      ruleName: 'monitoring-daily-inventory-dev',
      description: config.schedule.description,
      schedule: events.Schedule.expression(config.schedule.expression),
      enabled: config.schedule.enabled
    });

    // Add Lambda function as target
    rule.addTarget(new targets.LambdaFunction(func, {
      event: events.RuleTargetInput.fromObject({
        source: 'scheduled-execution',
        scheduledAt: events.EventField.fromPath('$.time')
      })
    }));

    // Output the rule ARN
    new cdk.CfnOutput(this, 'DailyInventoryRuleArn', {
      value: rule.ruleArn,
      description: 'ARN of the scheduled inventory EventBridge rule',
      exportName: 'MonitoringDailyInventoryRuleArn-dev'
    });
  }

  private createAlarmGeneratorFunction(config: MonitoringConfig): lambda.Function {
    return new lambda.Function(this, 'AlarmGeneratorFunction', {
      functionName: 'monitoring-alarm-generator-dev',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../cloudwatch-alarm-lambda/dist'),
      timeout: cdk.Duration.seconds(config.lambda.timeout),
      memorySize: config.lambda.memorySize,
      environment: {
        S3_BUCKET: config.s3.bucket,
        S3_PREFIX: config.s3.prefix,
        S3_ALARM_PREFIX: config.s3.alarmPrefix,
        AWS_ACCOUNT_ID: config.aws.accountId,
        LOG_LEVEL: config.lambda.logLevel
      },
      description: 'CloudWatch Alarm Generator Lambda Function - PoC'
    });
  }

  private grantAlarmLambdaPermissions(func: lambda.Function, bucket: s3.IBucket): void {
    // Grant S3 permissions
    bucket.grantRead(func);
    bucket.grantWrite(func);

    // Grant CloudWatch permissions
    func.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        // CloudWatch Alarms
        'cloudwatch:PutMetricAlarm',
        'cloudwatch:DescribeAlarms',
        'cloudwatch:DeleteAlarms',
        'cloudwatch:TagResource',
        'cloudwatch:UntagResource',
        'cloudwatch:ListTagsForResource'
      ],
      resources: ['*'] // CloudWatch alarms require * resource
    }));
  }

  private createAlarmGenerationTrigger(func: lambda.Function): void {
    // Create EventBridge rule to trigger alarm generation
    // This could be triggered after inventory completion or on a separate schedule
    const rule = new events.Rule(this, 'AlarmGenerationRule', {
      ruleName: 'monitoring-alarm-generation-dev',
      description: 'Trigger CloudWatch alarm generation',
      schedule: events.Schedule.expression('cron(15 2 * * ? *)'), // 15 minutes after inventory
      enabled: true
    });

    // Add Lambda function as target
    rule.addTarget(new targets.LambdaFunction(func, {
      event: events.RuleTargetInput.fromObject({
        source: 'scheduled-alarm-generation',
        scheduledAt: events.EventField.fromPath('$.time')
      })
    }));

    // Output the rule ARN
    new cdk.CfnOutput(this, 'AlarmGenerationRuleArn', {
      value: rule.ruleArn,
      description: 'ARN of the alarm generation EventBridge rule',
      exportName: 'MonitoringAlarmGenerationRuleArn-dev'
    });
  }
}
