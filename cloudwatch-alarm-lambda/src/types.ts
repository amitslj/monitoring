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

export interface ResourceInfo {
  arn: string;
  type: string;
  name: string;
  region: string;
  tags: Record<string, string>;
  metadata: Record<string, any>;
  discoveredAt: string;
}

export interface InventoryData {
  generatedAt: string;
  config: {
    resourceTypes: string[];
    tagFilters: Array<{key: string; value: string}>;
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

export interface AlarmCreationResult {
  resourceArn: string;
  resourceName: string;
  resourceType: string;
  alarmName: string;
  status: 'created' | 'updated' | 'failed';
  error?: string;
}
