import { InventoryConfig, ResourceType, TagFilter } from './types';

/**
 * Get inventory configuration from environment variables
 */
export function getInventoryConfig(): InventoryConfig {
  const resourceTypesEnv = process.env.RESOURCE_TYPES || '["lambda", "apigateway"]';
  const tagFiltersEnv = process.env.TAG_FILTERS || '[]';
  const s3Bucket = process.env.S3_BUCKET;
  const s3Prefix = process.env.S3_PREFIX || 'inventory/';

  if (!s3Bucket) {
    throw new Error('S3_BUCKET environment variable is required');
  }

  let resourceTypes: ResourceType[];
  let tagFilters: TagFilter[];

  try {
    resourceTypes = JSON.parse(resourceTypesEnv);
  } catch (error) {
    throw new Error(`Invalid RESOURCE_TYPES JSON: ${error}`);
  }

  try {
    tagFilters = JSON.parse(tagFiltersEnv);
  } catch (error) {
    throw new Error(`Invalid TAG_FILTERS JSON: ${error}`);
  }

  // Validate resource types
  const validResourceTypes = Object.values(ResourceType);
  for (const resourceType of resourceTypes) {
    if (!validResourceTypes.includes(resourceType)) {
      throw new Error(`Invalid resource type: ${resourceType}. Valid types: ${validResourceTypes.join(', ')}`);
    }
  }

  // Validate tag filters
  for (const tagFilter of tagFilters) {
    if (!tagFilter.key || typeof tagFilter.key !== 'string') {
      throw new Error('Tag filter must have a valid key');
    }
  }

  return {
    resourceTypes,
    tagFilters,
    s3Bucket,
    s3Prefix: s3Prefix.endsWith('/') ? s3Prefix : `${s3Prefix}/`
  };
}

/**
 * Merge event overrides with default configuration
 */
export function mergeConfigWithEvent(
  defaultConfig: InventoryConfig,
  eventOverrides: Partial<InventoryConfig>
): InventoryConfig {
  return {
    resourceTypes: eventOverrides.resourceTypes || defaultConfig.resourceTypes,
    tagFilters: eventOverrides.tagFilters || defaultConfig.tagFilters,
    s3Bucket: eventOverrides.s3Bucket || defaultConfig.s3Bucket,
    s3Prefix: eventOverrides.s3Prefix || defaultConfig.s3Prefix
  };
}
