/**
 * Configuration types
 */
export interface MonitoringConfig {
  aws: {
    accountId: string;
    region: string;
  };
  s3: {
    bucket: string;
    prefix: string;
    alarmPrefix: string;
  };
  resources: {
    types: string[];
    tagFilters: TagFilter[];
  };
  lambda: {
    timeout: number;
    memorySize: number;
    logLevel: string;
  };
  schedule: {
    enabled: boolean;
    expression: string;
    description: string;
  };
}

export interface TagFilter {
  key: string;
  value: string;
}

/**
 * Inventory types - Simplified structure
 */
export interface InventoryData {
  environment: string;
  tags: Record<string, string>;
  lambdas: string[];
  apiGateways: ApiGatewayResource[];
}

export interface ApiGatewayResource {
  apiName: string;
  stage: string;
}

// Legacy interface for backward compatibility (if needed)
export interface ResourceInfo {
  arn: string;
  type: string;
  name: string;
  region: string;
  tags: Record<string, string>;
  metadata: Record<string, any>;
  discoveredAt: string;
}

/**
 * Alarm mapping types - New structure with separate files
 */
export interface AlarmMapping {
  version: string;
  generatedAt: string;
  alarmMappings: {
    [resourceType: string]: AlarmDefinition[];
  };
}

/**
 * Individual resource type alarm mapping
 */
export interface ResourceAlarmMapping {
  version: string;
  generatedAt: string;
  resourceType: string;
  alarmDefinitions: AlarmDefinition[];
}

export interface AlarmDefinition {
  alarmName: string;
  description: string;
  metricName: string;
  namespace: string;
  statistic: string;
  period: number;
  evaluationPeriods: number;
  threshold?: number;
  thresholdFromResource?: string;
  comparisonOperator: string;
  treatMissingData: string;
  dimensions: AlarmDimension[];
}

export interface AlarmDimension {
  name: string;
  valueFromResource: string;
}

/**
 * Stack configuration
 */
export interface AlarmStackConfig {
  config: MonitoringConfig;
  inventory: InventoryData;
  alarmMappings: AlarmMapping;
  resourceType: string;
}
