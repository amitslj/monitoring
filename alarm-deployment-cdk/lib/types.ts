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
 * Inventory types
 */
export interface InventoryData {
  generatedAt: string;
  config: {
    resourceTypes: string[];
    tagFilters: TagFilter[];
    s3Bucket: string;
    s3Prefix: string;
  };
  totalResources: number;
  resourcesByType: Record<string, number>;
  resources: ResourceInfo[];
  statistics: {
    scanDurationMs: number;
    apiCalls: number;
    errors: string[];
  };
}

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
 * Alarm mapping types
 */
export interface AlarmMapping {
  version: string;
  generatedAt: string;
  alarmMappings: {
    [resourceType: string]: AlarmDefinition[];
  };
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
