import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';
import { AlarmStackConfig, ResourceInfo, AlarmDefinition } from '../lib/types';
import { AlarmUtils } from '../lib/alarm-utils';

export interface LambdaAlarmsStackProps extends cdk.StackProps {
  config: AlarmStackConfig;
}

export class LambdaAlarmsStack extends cdk.Stack {
  public readonly alarms: cloudwatch.Alarm[] = [];

  constructor(scope: Construct, id: string, props: LambdaAlarmsStackProps) {
    super(scope, id, props);

    const { config } = props;
    const lambdaResources = config.inventory.resources.filter(r => r.type === 'lambda');
    const alarmDefinitions = config.alarmMappings.alarmMappings.lambda || [];

    if (lambdaResources.length === 0) {
      console.log('No Lambda resources found in inventory');
      return;
    }

    if (alarmDefinitions.length === 0) {
      console.log('No alarm definitions found for Lambda resources');
      return;
    }

    console.log(`Creating alarms for ${lambdaResources.length} Lambda functions with ${alarmDefinitions.length} alarm definitions`);

    // Create alarms for each Lambda function
    for (const resource of lambdaResources) {
      for (const alarmDef of alarmDefinitions) {
        try {
          const alarm = this.createLambdaAlarm(resource, alarmDef);
          this.alarms.push(alarm);
        } catch (error) {
          console.error(`Failed to create alarm ${alarmDef.alarmName} for Lambda ${resource.name}:`, error);
        }
      }
    }

    // Output summary
    new cdk.CfnOutput(this, 'LambdaAlarmsCount', {
      value: this.alarms.length.toString(),
      description: 'Number of Lambda alarms created'
    });

    new cdk.CfnOutput(this, 'LambdaResourcesCount', {
      value: lambdaResources.length.toString(),
      description: 'Number of Lambda resources processed'
    });

    // Output alarm names for reference
    if (this.alarms.length > 0) {
      new cdk.CfnOutput(this, 'LambdaAlarmNames', {
        value: this.alarms.map(alarm => alarm.alarmName).join(', '),
        description: 'Names of created Lambda alarms'
      });
    }
  }

  /**
   * Create a CloudWatch alarm for a Lambda function
   */
  private createLambdaAlarm(resource: ResourceInfo, alarmDef: AlarmDefinition): cloudwatch.Alarm {
    const alarmName = AlarmUtils.generateAlarmName(resource, alarmDef);
    const description = AlarmUtils.generateAlarmDescription(resource, alarmDef);
    const threshold = AlarmUtils.calculateThreshold(resource, alarmDef);

    // Build dimensions
    const dimensions: Record<string, string> = {};
    for (const dim of alarmDef.dimensions) {
      dimensions[dim.name] = AlarmUtils.getResourceValue(resource, dim.valueFromResource);
    }

    // Create the metric
    const metric = new cloudwatch.Metric({
      namespace: alarmDef.namespace,
      metricName: alarmDef.metricName,
      dimensionsMap: dimensions,
      statistic: alarmDef.statistic as cloudwatch.Statistic,
      period: cdk.Duration.seconds(alarmDef.period)
    });

    // Create the alarm
    const alarm = new cloudwatch.Alarm(this, `${resource.name}-${alarmDef.alarmName}`, {
      alarmName,
      alarmDescription: description,
      metric,
      threshold,
      evaluationPeriods: alarmDef.evaluationPeriods,
      comparisonOperator: this.mapComparisonOperator(alarmDef.comparisonOperator),
      treatMissingData: this.mapTreatMissingData(alarmDef.treatMissingData)
    });

    // Add tags
    const tags = AlarmUtils.convertResourceTagsToCdkTags(resource);
    for (const [key, value] of Object.entries(tags)) {
      cdk.Tags.of(alarm).add(key, value);
    }

    console.log(`Created Lambda alarm: ${alarmName} (threshold: ${threshold})`);

    return alarm;
  }

  /**
   * Map comparison operator string to CDK enum
   */
  private mapComparisonOperator(operator: string): cloudwatch.ComparisonOperator {
    switch (operator) {
      case 'GreaterThanThreshold':
        return cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD;
      case 'GreaterThanOrEqualToThreshold':
        return cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD;
      case 'LessThanThreshold':
        return cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD;
      case 'LessThanOrEqualToThreshold':
        return cloudwatch.ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD;
      default:
        return cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD;
    }
  }

  /**
   * Map treat missing data string to CDK enum
   */
  private mapTreatMissingData(treatMissingData: string): cloudwatch.TreatMissingData {
    switch (treatMissingData) {
      case 'breaching':
        return cloudwatch.TreatMissingData.BREACHING;
      case 'notBreaching':
        return cloudwatch.TreatMissingData.NOT_BREACHING;
      case 'ignore':
        return cloudwatch.TreatMissingData.IGNORE;
      case 'missing':
        return cloudwatch.TreatMissingData.MISSING;
      default:
        return cloudwatch.TreatMissingData.NOT_BREACHING;
    }
  }
}
