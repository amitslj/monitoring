import { ResourceInfo, AlarmDefinition } from './types';

/**
 * Utility functions for alarm creation
 */
export class AlarmUtils {
  /**
   * Get a value from the resource based on the field path
   */
  static getResourceValue(resource: ResourceInfo, fieldPath: string): string {
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
  static calculateThreshold(resource: ResourceInfo, alarmDef: AlarmDefinition): number {
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
   * Generate alarm name for a resource
   */
  static generateAlarmName(resource: ResourceInfo, alarmDef: AlarmDefinition): string {
    return `${resource.name}-${alarmDef.alarmName}`;
  }

  /**
   * Generate alarm description for a resource
   */
  static generateAlarmDescription(resource: ResourceInfo, alarmDef: AlarmDefinition): string {
    return `${alarmDef.description} for ${resource.name}`;
  }

  /**
   * Convert resource tags to CDK tags format
   */
  static convertResourceTagsToCdkTags(resource: ResourceInfo): Record<string, string> {
    return {
      CreatedBy: 'MonitoringSystem',
      ResourceArn: resource.arn,
      ResourceType: resource.type,
      ResourceName: resource.name,
      ...resource.tags
    };
  }
}
