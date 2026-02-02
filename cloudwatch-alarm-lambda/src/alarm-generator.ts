import {
  CloudWatchClient,
  PutMetricAlarmCommand,
  DescribeAlarmsCommand,
  ComparisonOperator,
  Statistic,
  StandardUnit
} from '@aws-sdk/client-cloudwatch';
import { AlarmDefinition, ResourceInfo, AlarmCreationResult } from './types';

export class AlarmGenerator {
  private cloudWatchClient: CloudWatchClient;
  private region: string;

  constructor(region: string = process.env.AWS_REGION || 'us-east-1') {
    this.region = region;
    this.cloudWatchClient = new CloudWatchClient({ region });
  }

  /**
   * Create CloudWatch alarms for resources based on alarm definitions
   */
  async createAlarmsForResources(
    resources: ResourceInfo[],
    alarmDefinitions: AlarmDefinition[]
  ): Promise<AlarmCreationResult[]> {
    const results: AlarmCreationResult[] = [];

    for (const resource of resources) {
      for (const alarmDef of alarmDefinitions) {
        try {
          const result = await this.createAlarmForResource(resource, alarmDef);
          results.push(result);
        } catch (error) {
          console.error(`Failed to create alarm ${alarmDef.alarmName} for resource ${resource.name}:`, error);
          results.push({
            resourceArn: resource.arn,
            resourceName: resource.name,
            resourceType: resource.type,
            alarmName: `${resource.name}-${alarmDef.alarmName}`,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }

    return results;
  }

  /**
   * Create a single alarm for a resource
   */
  private async createAlarmForResource(
    resource: ResourceInfo,
    alarmDef: AlarmDefinition
  ): Promise<AlarmCreationResult> {
    const alarmName = `${resource.name}-${alarmDef.alarmName}`;

    console.log(`Creating alarm ${alarmName} for resource ${resource.name}`);

    // Build dimensions
    const dimensions = alarmDef.dimensions.map(dim => ({
      Name: dim.name,
      Value: this.getResourceValue(resource, dim.valueFromResource)
    }));

    // Calculate threshold
    const threshold = this.calculateThreshold(resource, alarmDef);

    // Check if alarm already exists
    const existingAlarm = await this.getExistingAlarm(alarmName);
    const isUpdate = !!existingAlarm;

    // Create the alarm
    const putAlarmCommand = new PutMetricAlarmCommand({
      AlarmName: alarmName,
      AlarmDescription: `${alarmDef.description} for ${resource.name}`,
      MetricName: alarmDef.metricName,
      Namespace: alarmDef.namespace,
      Statistic: alarmDef.statistic as Statistic,
      Period: alarmDef.period,
      EvaluationPeriods: alarmDef.evaluationPeriods,
      Threshold: threshold,
      ComparisonOperator: alarmDef.comparisonOperator as ComparisonOperator,
      TreatMissingData: alarmDef.treatMissingData,
      Dimensions: dimensions,
      Tags: [
        { Key: 'CreatedBy', Value: 'MonitoringSystem' },
        { Key: 'ResourceArn', Value: resource.arn },
        { Key: 'ResourceType', Value: resource.type },
        ...Object.entries(resource.tags).map(([key, value]) => ({ Key: key, Value: value }))
      ]
    });

    await this.cloudWatchClient.send(putAlarmCommand);

    console.log(`Successfully ${isUpdate ? 'updated' : 'created'} alarm ${alarmName}`);

    return {
      resourceArn: resource.arn,
      resourceName: resource.name,
      resourceType: resource.type,
      alarmName,
      status: isUpdate ? 'updated' : 'created'
    };
  }

  /**
   * Get a value from the resource based on the field path
   */
  private getResourceValue(resource: ResourceInfo, fieldPath: string): string {
    switch (fieldPath) {
      case 'name':
        return resource.name;
      case 'arn':
        return resource.arn;
      case 'region':
        return resource.region;
      default:
        // Try to get from metadata
        if (resource.metadata && resource.metadata[fieldPath]) {
          return String(resource.metadata[fieldPath]);
        }
        // Fallback to resource name
        return resource.name;
    }
  }

  /**
   * Calculate threshold based on alarm definition and resource metadata
   */
  private calculateThreshold(resource: ResourceInfo, alarmDef: AlarmDefinition): number {
    if (alarmDef.threshold !== undefined) {
      return alarmDef.threshold;
    }

    if (alarmDef.thresholdFromResource) {
      switch (alarmDef.thresholdFromResource) {
        case 'timeout_80_percent':
          // For Lambda timeout alarms, use 80% of the timeout value
          if (resource.metadata && resource.metadata.timeout) {
            return Math.floor(resource.metadata.timeout * 0.8 * 1000); // Convert to milliseconds
          }
          break;
        default:
          if (resource.metadata && resource.metadata[alarmDef.thresholdFromResource]) {
            return Number(resource.metadata[alarmDef.thresholdFromResource]);
          }
      }
    }

    // Default threshold
    return 100;
  }

  /**
   * Check if an alarm already exists
   */
  private async getExistingAlarm(alarmName: string): Promise<any> {
    try {
      const command = new DescribeAlarmsCommand({
        AlarmNames: [alarmName]
      });
      const response = await this.cloudWatchClient.send(command);
      return response.MetricAlarms && response.MetricAlarms.length > 0 ? response.MetricAlarms[0] : null;
    } catch (error) {
      console.warn(`Failed to check existing alarm ${alarmName}:`, error);
      return null;
    }
  }
}
