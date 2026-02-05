import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';
import { AlarmStackConfig, ApiGatewayResource, AlarmDefinition } from '../lib/types';
import { AlarmUtils } from '../lib/alarm-utils';

export interface ApiGatewayAlarmsStackProps extends cdk.StackProps {
  config: AlarmStackConfig;
}

export class ApiGatewayAlarmsStack extends cdk.Stack {
  public readonly alarms: cloudwatch.Alarm[] = [];

  constructor(scope: Construct, id: string, props: ApiGatewayAlarmsStackProps) {
    super(scope, id, props);

    const { config } = props;
    const apiGatewayResources = config.inventory.apiGateways || [];
    const alarmDefinitions = config.alarmMappings.alarmMappings.apigateway || [];

    if (apiGatewayResources.length === 0) {
      console.log('No API Gateway resources found in inventory');
      return;
    }

    if (alarmDefinitions.length === 0) {
      console.log('No alarm definitions found for API Gateway resources');
      return;
    }

    console.log(`Creating alarms for ${apiGatewayResources.length} API Gateway APIs with ${alarmDefinitions.length} alarm definitions`);

    // Create alarms for each API Gateway
    for (const resource of apiGatewayResources) {
      for (const alarmDef of alarmDefinitions) {
        try {
          const alarm = this.createApiGatewayAlarm(resource, alarmDef, config.inventory.tags, config.config);
          this.alarms.push(alarm);
        } catch (error) {
          console.error(`Failed to create alarm ${alarmDef.alarmName} for API Gateway ${resource.apiName}:`, error);
        }
      }
    }

    // Output summary
    new cdk.CfnOutput(this, 'ApiGatewayAlarmsCount', {
      value: this.alarms.length.toString(),
      description: 'Number of API Gateway alarms created'
    });

    new cdk.CfnOutput(this, 'ApiGatewayResourcesCount', {
      value: apiGatewayResources.length.toString(),
      description: 'Number of API Gateway resources processed'
    });

    // Output alarm names for reference
    if (this.alarms.length > 0) {
      new cdk.CfnOutput(this, 'ApiGatewayAlarmNames', {
        value: this.alarms.map(alarm => alarm.alarmName).join(', '),
        description: 'Names of created API Gateway alarms'
      });
    }
  }

  /**
   * Create a CloudWatch alarm for an API Gateway
   */
  private createApiGatewayAlarm(resource: ApiGatewayResource, alarmDef: AlarmDefinition, inventoryTags: Record<string, string>, config: any): cloudwatch.Alarm {
    const alarmName = AlarmUtils.generateApiGatewayAlarmName(resource, alarmDef);
    const description = AlarmUtils.generateApiGatewayAlarmDescription(resource, alarmDef);
    const threshold = AlarmUtils.calculateApiGatewayThreshold(alarmDef);

    // Build dimensions
    const dimensions: Record<string, string> = {};
    for (const dim of alarmDef.dimensions) {
      dimensions[dim.name] = AlarmUtils.getApiGatewayResourceValue(resource, dim.valueFromResource, config);
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
    const alarm = new cloudwatch.Alarm(this, `${resource.apiName}-${alarmDef.alarmName}`, {
      alarmName,
      alarmDescription: description,
      metric,
      threshold,
      evaluationPeriods: alarmDef.evaluationPeriods,
      comparisonOperator: this.mapComparisonOperator(alarmDef.comparisonOperator),
      treatMissingData: this.mapTreatMissingData(alarmDef.treatMissingData)
    });

    // Add tags
    const tags = AlarmUtils.convertApiGatewayResourceToCdkTags(resource, inventoryTags, config);
    for (const [key, value] of Object.entries(tags)) {
      cdk.Tags.of(alarm).add(key, value);
    }

    console.log(`Created API Gateway alarm: ${alarmName} (threshold: ${threshold})`);

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
