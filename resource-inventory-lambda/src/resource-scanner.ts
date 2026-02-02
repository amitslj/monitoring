import {
  LambdaClient,
  ListFunctionsCommand,
  GetFunctionCommand,
  ListTagsCommand as ListLambdaTagsCommand
} from '@aws-sdk/client-lambda';
import {
  APIGatewayClient,
  GetRestApisCommand,
  GetTagsCommand as GetApiGatewayTagsCommand,
  GetStagesCommand
} from '@aws-sdk/client-api-gateway';
import {
  ApiGatewayV2Client,
  GetApisCommand,
  GetTagsCommand as GetApiGatewayV2TagsCommand
} from '@aws-sdk/client-apigatewayv2';
import {
  ResourceGroupsTaggingAPIClient,
  GetResourcesCommand
} from '@aws-sdk/client-resource-groups-tagging-api';
import { ResourceInfo, ResourceType, TagFilter, InventoryConfig } from './types';

/**
 * AWS Resource Scanner
 */
export class ResourceScanner {
  private lambdaClient: LambdaClient;
  private apiGatewayClient: APIGatewayClient;
  private apiGatewayV2Client: ApiGatewayV2Client;
  private resourceGroupsTaggingClient: ResourceGroupsTaggingAPIClient;
  private region: string;
  private apiCallCount = 0;
  private errors: string[] = [];

  constructor(region: string = process.env.AWS_REGION || 'us-east-1') {
    this.region = region;
    this.lambdaClient = new LambdaClient({ region });
    this.apiGatewayClient = new APIGatewayClient({ region });
    this.apiGatewayV2Client = new ApiGatewayV2Client({ region });
    this.resourceGroupsTaggingClient = new ResourceGroupsTaggingAPIClient({ region });
  }

  /**
   * Scan resources based on configuration
   */
  async scanResources(config: InventoryConfig): Promise<{
    resources: ResourceInfo[];
    apiCalls: number;
    errors: string[];
  }> {
    this.apiCallCount = 0;
    this.errors = [];
    const resources: ResourceInfo[] = [];

    for (const resourceType of config.resourceTypes) {
      try {
        const typeResources = await this.scanResourceType(resourceType, config.tagFilters);
        resources.push(...typeResources);
      } catch (error) {
        const errorMessage = `Failed to scan ${resourceType}: ${error}`;
        console.error(errorMessage);
        this.errors.push(errorMessage);
      }
    }

    return {
      resources,
      apiCalls: this.apiCallCount,
      errors: this.errors
    };
  }

  /**
   * Scan resources of a specific type
   */
  private async scanResourceType(resourceType: ResourceType, tagFilters: TagFilter[]): Promise<ResourceInfo[]> {
    switch (resourceType) {
      case ResourceType.LAMBDA:
        return this.scanLambdaFunctions(tagFilters);
      case ResourceType.API_GATEWAY:
        return this.scanApiGatewayApis(tagFilters);
      case ResourceType.API_GATEWAY_V2:
        return this.scanApiGatewayV2Apis(tagFilters);
      default:
        throw new Error(`Unsupported resource type: ${resourceType}`);
    }
  }

  /**
   * Scan Lambda functions
   */
  private async scanLambdaFunctions(tagFilters: TagFilter[]): Promise<ResourceInfo[]> {
    const resources: ResourceInfo[] = [];
    let nextMarker: string | undefined;

    do {
      const command = new ListFunctionsCommand({
        Marker: nextMarker,
        MaxItems: 50
      });

      const response = await this.lambdaClient.send(command);
      this.apiCallCount++;

      if (response.Functions) {
        for (const func of response.Functions) {
          if (!func.FunctionArn || !func.FunctionName) continue;

          try {
            // Get function tags
            const tagsCommand = new ListLambdaTagsCommand({
              Resource: func.FunctionArn
            });
            const tagsResponse = await this.lambdaClient.send(tagsCommand);
            this.apiCallCount++;

            const tags = tagsResponse.Tags || {};

            // Apply tag filters
            if (this.matchesTagFilters(tags, tagFilters)) {
              resources.push({
                arn: func.FunctionArn,
                type: ResourceType.LAMBDA,
                name: func.FunctionName,
                region: this.region,
                tags,
                metadata: {
                  runtime: func.Runtime,
                  handler: func.Handler,
                  codeSize: func.CodeSize,
                  timeout: func.Timeout,
                  memorySize: func.MemorySize,
                  lastModified: func.LastModified,
                  version: func.Version,
                  description: func.Description
                },
                discoveredAt: new Date().toISOString()
              });
            }
          } catch (error) {
            const errorMessage = `Failed to get tags for Lambda function ${func.FunctionName}: ${error}`;
            console.warn(errorMessage);
            this.errors.push(errorMessage);
          }
        }
      }

      nextMarker = response.NextMarker;
    } while (nextMarker);

    return resources;
  }

  /**
   * Scan API Gateway REST APIs
   */
  private async scanApiGatewayApis(tagFilters: TagFilter[]): Promise<ResourceInfo[]> {
    const resources: ResourceInfo[] = [];

    try {
      const command = new GetRestApisCommand({
        limit: 500
      });

      const response = await this.apiGatewayClient.send(command);
      this.apiCallCount++;

      console.log(`Found ${response.items?.length || 0} API Gateway REST APIs`);

      if (response.items) {
        for (const api of response.items) {
          console.log(`Processing API: ${api.name || 'unnamed'} (${api.id || 'no-id'})`);
          if (!api.id || !api.name) {
            console.log(`Skipping API due to missing id or name: id=${api.id}, name=${api.name}`);
            continue;
          }

          try {
            // Get API Gateway tags from stages (where tags are actually stored)
            console.log(`Getting tags for API Gateway: ${api.name} (${api.id})`);

            let tags = {};

            try {
              // First, get all stages for this API
              const stagesCommand = new GetStagesCommand({
                restApiId: api.id
              });
              const stagesResponse = await this.apiGatewayClient.send(stagesCommand);
              this.apiCallCount++;

              console.log(`Found ${stagesResponse.item?.length || 0} stages for API Gateway ${api.name}`);

              if (stagesResponse.item && stagesResponse.item.length > 0) {
                // Get tags from the first stage (most APIs have one main stage)
                const stage = stagesResponse.item[0];
                console.log(`Getting tags from stage: ${stage.stageName}`);

                if (stage.stageName) {
                  try {
                    // Get tags for this specific stage
                    const stageArn = `arn:aws:apigateway:${this.region}::/restapis/${api.id}/stages/${stage.stageName}`;
                    const tagsCommand = new GetApiGatewayTagsCommand({
                      resourceArn: stageArn
                    });
                    const tagsResponse = await this.apiGatewayClient.send(tagsCommand);
                    this.apiCallCount++;
                    tags = tagsResponse.tags || {};
                    console.log(`API Gateway ${api.name} stage ${stage.stageName} tags:`, JSON.stringify(tags));
                  } catch (stageTagError: any) {
                    console.warn(`Failed to get tags for stage ${stage.stageName}:`, stageTagError.message);

                    // Fallback: Try Resource Groups API with stage ARN
                    try {
                      const stageArn = `arn:aws:apigateway:${this.region}::/restapis/${api.id}/stages/${stage.stageName}`;
                      const resourcesCommand = new GetResourcesCommand({
                        ResourceARNList: [stageArn]
                      });
                      const resourcesResponse = await this.resourceGroupsTaggingClient.send(resourcesCommand);
                      this.apiCallCount++;

                      if (resourcesResponse.ResourceTagMappingList && resourcesResponse.ResourceTagMappingList.length > 0) {
                        const resource = resourcesResponse.ResourceTagMappingList[0];
                        if (resource.Tags) {
                          tags = resource.Tags.reduce((acc, tag) => {
                            if (tag.Key && tag.Value) {
                              acc[tag.Key] = tag.Value;
                            }
                            return acc;
                          }, {} as Record<string, string>);
                        }
                      }
                      console.log(`API Gateway ${api.name} stage ${stage.stageName} tags from Resource Groups:`, JSON.stringify(tags));
                    } catch (resourceGroupError: any) {
                      console.warn(`Failed to get stage tags using Resource Groups API:`, resourceGroupError.message);
                    }
                  }
                }
              } else {
                console.log(`No stages found for API Gateway ${api.name}`);
              }
            } catch (stagesError: any) {
              console.warn(`Failed to get stages for API Gateway ${api.name}:`, stagesError.message);
              tags = {};
            }

            // Apply tag filters
            const matches = this.matchesTagFilters(tags, tagFilters);
            console.log(`API Gateway ${api.name} ${matches ? 'MATCHES' : 'does NOT match'} tag filters`);
            console.log(`API Gateway ${api.name} final tags:`, JSON.stringify(tags));
            console.log(`Tag filters:`, JSON.stringify(tagFilters));
            if (matches) {
              resources.push({
                arn: `arn:aws:apigateway:${this.region}::/restapis/${api.id}`,
                type: ResourceType.API_GATEWAY,
                name: api.name,
                region: this.region,
                tags,
                metadata: {
                  id: api.id,
                  description: api.description,
                  createdDate: api.createdDate?.toISOString(),
                  version: api.version,
                  binaryMediaTypes: api.binaryMediaTypes,
                  minimumCompressionSize: api.minimumCompressionSize,
                  apiKeySource: api.apiKeySource,
                  endpointConfiguration: api.endpointConfiguration
                },
                discoveredAt: new Date().toISOString()
              });
            }
          } catch (error) {
            const errorMessage = `Failed to get tags for API Gateway ${api.name}: ${error}`;
            console.warn(errorMessage);
            this.errors.push(errorMessage);
          }
        }
      }
    } catch (error) {
      throw new Error(`Failed to list API Gateway APIs: ${error}`);
    }

    return resources;
  }

  /**
   * Scan API Gateway v2 APIs (HTTP APIs and WebSocket APIs)
   */
  private async scanApiGatewayV2Apis(tagFilters: TagFilter[]): Promise<ResourceInfo[]> {
    const resources: ResourceInfo[] = [];

    try {
      const command = new GetApisCommand({
        MaxResults: '500'
      });

      const response = await this.apiGatewayV2Client.send(command);
      this.apiCallCount++;

      if (response.Items) {
        for (const api of response.Items) {
          if (!api.ApiId || !api.Name) continue;

          try {
            // Get API tags
            const tagsCommand = new GetApiGatewayV2TagsCommand({
              ResourceArn: `arn:aws:apigateway:${this.region}::/apis/${api.ApiId}`
            });
            const tagsResponse = await this.apiGatewayV2Client.send(tagsCommand);
            this.apiCallCount++;

            const tags = tagsResponse.Tags || {};

            // Apply tag filters
            if (this.matchesTagFilters(tags, tagFilters)) {
              resources.push({
                arn: `arn:aws:apigateway:${this.region}::/apis/${api.ApiId}`,
                type: ResourceType.API_GATEWAY_V2,
                name: api.Name,
                region: this.region,
                tags,
                metadata: {
                  apiId: api.ApiId,
                  description: api.Description,
                  createdDate: api.CreatedDate?.toISOString(),
                  version: api.Version,
                  protocolType: api.ProtocolType,
                  routeSelectionExpression: api.RouteSelectionExpression,
                  apiKeySelectionExpression: api.ApiKeySelectionExpression,
                  corsConfiguration: api.CorsConfiguration,
                  importInfo: api.ImportInfo,
                  warnings: api.Warnings
                },
                discoveredAt: new Date().toISOString()
              });
            }
          } catch (error) {
            const errorMessage = `Failed to get tags for API Gateway v2 ${api.Name}: ${error}`;
            console.warn(errorMessage);
            this.errors.push(errorMessage);
          }
        }
      }
    } catch (error) {
      throw new Error(`Failed to list API Gateway v2 APIs: ${error}`);
    }

    return resources;
  }

  /**
   * Check if resource tags match the configured filters
   */
  private matchesTagFilters(resourceTags: Record<string, string>, tagFilters: TagFilter[]): boolean {
    // If no filters are configured, include all resources
    if (tagFilters.length === 0) {
      return true;
    }

    // Resource must match ALL tag filters (AND logic)
    return tagFilters.every(filter => {
      const resourceTagValue = resourceTags[filter.key];

      // If resource doesn't have the required tag key, it doesn't match
      if (resourceTagValue === undefined) {
        return false;
      }

      // If filter has no value specified, just check for key existence
      if (filter.value === undefined) {
        return true;
      }

      // Check for exact value match
      return resourceTagValue === filter.value;
    });
  }
}
