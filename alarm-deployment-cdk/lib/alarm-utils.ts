import { ApiGatewayResource, AlarmDefinition, MonitoringConfig } from './types';

/**
 * Utility functions for alarm creation
 */
export class AlarmUtils {
  /**
   * Construct Lambda ARN from function name and config
   */
  static constructLambdaArn(functionName: string, config: MonitoringConfig): string {
    return `arn:aws:lambda:${config.aws.region}:${config.aws.accountId}:function:${functionName}`;
  }

  /**
   * Construct API Gateway ARN from API name and config (simplified)
   */
  static constructApiGatewayArn(apiName: string, config: MonitoringConfig): string {
    // For simplicity, we'll use the API name as the API ID in the ARN
    // In a real scenario, you might need to look up the actual API ID
    return `arn:aws:apigateway:${config.aws.region}::/restapis/${apiName}`;
  }

  /**
   * Get a value from Lambda resource based on the field path
   */
  static getLambdaResourceValue(functionName: string, fieldPath: string, config: MonitoringConfig): string {
    switch (fieldPath) {
      case 'name':
        return functionName;
      case 'arn':
        return this.constructLambdaArn(functionName, config);
      default:
        return functionName;
    }
  }

  /**
   * Get a value from API Gateway resource based on the field path
   */
  static getApiGatewayResourceValue(resource: ApiGatewayResource, fieldPath: string, config: MonitoringConfig): string {
    switch (fieldPath) {
      case 'name':
        return resource.apiName;
      case 'arn':
        return this.constructApiGatewayArn(resource.apiName, config);
      case 'stage':
        return resource.stage;
      default:
        return resource.apiName;
    }
  }

  /**
   * Calculate threshold for Lambda resource
   */
  static calculateLambdaThreshold(alarmDef: AlarmDefinition): number {
    if (alarmDef.threshold !== undefined) {
      return alarmDef.threshold;
    }

    if (alarmDef.thresholdFromResource) {
      switch (alarmDef.thresholdFromResource) {
        case 'timeout_80_percent':
          // Default Lambda timeout is 3 seconds, use 80% of that
          // In a real scenario, you might want to fetch this from AWS API
          return Math.floor(3 * 0.8 * 1000); // 2.4 seconds in milliseconds
        default:
          return 100;
      }
    }

    return 100;
  }

  /**
   * Calculate threshold for API Gateway resource
   */
  static calculateApiGatewayThreshold(alarmDef: AlarmDefinition): number {
    if (alarmDef.threshold !== undefined) {
      return alarmDef.threshold;
    }

    // Default threshold for API Gateway
    return 100;
  }

  /**
   * Generate alarm name for Lambda resource
   */
  static generateLambdaAlarmName(functionName: string, alarmDef: AlarmDefinition): string {
    return `${functionName}-${alarmDef.alarmName}`;
  }

  /**
   * Generate alarm name for API Gateway resource
   */
  static generateApiGatewayAlarmName(resource: ApiGatewayResource, alarmDef: AlarmDefinition): string {
    return `${resource.apiName}-${alarmDef.alarmName}`;
  }

  /**
   * Generate alarm description for Lambda resource
   */
  static generateLambdaAlarmDescription(functionName: string, alarmDef: AlarmDefinition): string {
    return `${alarmDef.description} for ${functionName}`;
  }

  /**
   * Generate alarm description for API Gateway resource
   */
  static generateApiGatewayAlarmDescription(resource: ApiGatewayResource, alarmDef: AlarmDefinition): string {
    return `${alarmDef.description} for ${resource.apiName}`;
  }

  /**
   * Convert Lambda resource to CDK tags format
   */
  static convertLambdaResourceToCdkTags(functionName: string, inventoryTags: Record<string, string>, config: MonitoringConfig): Record<string, string> {
    return {
      CreatedBy: 'MonitoringSystem',
      ResourceArn: this.constructLambdaArn(functionName, config),
      ResourceType: 'lambda',
      ResourceName: functionName,
      ...inventoryTags
    };
  }

  /**
   * Convert API Gateway resource to CDK tags format
   */
  static convertApiGatewayResourceToCdkTags(resource: ApiGatewayResource, inventoryTags: Record<string, string>, config: MonitoringConfig): Record<string, string> {
    return {
      CreatedBy: 'MonitoringSystem',
      ResourceArn: this.constructApiGatewayArn(resource.apiName, config),
      ResourceType: 'apigateway',
      ResourceName: resource.apiName,
      ...inventoryTags
    };
  }
}
