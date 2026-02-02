/**
 * Configuration for resource inventory scanning
 */
export interface InventoryConfig {
  /** List of AWS resource types to scan */
  resourceTypes: ResourceType[];
  /** Tag filters for resource selection */
  tagFilters: TagFilter[];
  /** S3 bucket for storing inventory */
  s3Bucket: string;
  /** S3 prefix for organizing inventory files */
  s3Prefix: string;
}

/**
 * Supported AWS resource types
 */
export enum ResourceType {
  LAMBDA = 'lambda',
  API_GATEWAY = 'apigateway',
  API_GATEWAY_V2 = 'apigatewayv2'
}

/**
 * Tag filter for resource selection
 */
export interface TagFilter {
  /** Tag key */
  key: string;
  /** Tag value (optional - if not provided, matches any value) */
  value?: string;
}

/**
 * AWS resource information
 */
export interface ResourceInfo {
  /** Resource ARN */
  arn: string;
  /** Resource type */
  type: ResourceType;
  /** Resource name */
  name: string;
  /** AWS region */
  region: string;
  /** Resource tags */
  tags: Record<string, string>;
  /** Additional resource-specific metadata */
  metadata: Record<string, any>;
  /** Timestamp when resource was discovered */
  discoveredAt: string;
}

/**
 * Inventory report structure
 */
export interface InventoryReport {
  /** Report generation timestamp */
  generatedAt: string;
  /** Configuration used for this scan */
  config: InventoryConfig;
  /** Total number of resources found */
  totalResources: number;
  /** Resources by type */
  resourcesByType: Record<ResourceType, number>;
  /** List of discovered resources */
  resources: ResourceInfo[];
  /** Scan statistics */
  statistics: {
    /** Scan duration in milliseconds */
    scanDurationMs: number;
    /** Number of API calls made */
    apiCalls: number;
    /** Any errors encountered during scan */
    errors: string[];
  };
}

/**
 * Lambda event input
 */
export interface InventoryEvent {
  /** Override default resource types */
  resourceTypes?: ResourceType[];
  /** Override default tag filters */
  tagFilters?: TagFilter[];
  /** Override default S3 bucket */
  s3Bucket?: string;
  /** Override default S3 prefix */
  s3Prefix?: string;
}
