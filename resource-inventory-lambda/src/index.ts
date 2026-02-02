import { Handler, Context } from 'aws-lambda';
import { ResourceScanner } from './resource-scanner';
import { S3Uploader } from './s3-uploader';
import { getInventoryConfig, mergeConfigWithEvent } from './config';
import { InventoryEvent, InventoryReport, ResourceType } from './types';

/**
 * Lambda handler for AWS resource inventory
 */
export const handler: Handler<InventoryEvent, any> = async (
  event: InventoryEvent,
  context: Context
) => {
  const startTime = Date.now();

  console.log('Starting AWS resource inventory scan', {
    requestId: context.awsRequestId,
    event: JSON.stringify(event, null, 2)
  });

  try {
    // Get configuration
    const defaultConfig = getInventoryConfig();
    const config = mergeConfigWithEvent(defaultConfig, event);

    console.log('Using configuration:', JSON.stringify(config, null, 2));

    // Initialize scanner and uploader
    const scanner = new ResourceScanner();
    const uploader = new S3Uploader();

    // Scan resources
    console.log('Starting resource scan...');
    const scanResult = await scanner.scanResources(config);

    const endTime = Date.now();
    const scanDurationMs = endTime - startTime;

    // Count resources by type
    const resourcesByType: Record<ResourceType, number> = {
      [ResourceType.LAMBDA]: 0,
      [ResourceType.API_GATEWAY]: 0,
      [ResourceType.API_GATEWAY_V2]: 0
    };

    scanResult.resources.forEach(resource => {
      resourcesByType[resource.type]++;
    });

    // Create inventory report
    const report: InventoryReport = {
      generatedAt: new Date().toISOString(),
      config,
      totalResources: scanResult.resources.length,
      resourcesByType,
      resources: scanResult.resources,
      statistics: {
        scanDurationMs,
        apiCalls: scanResult.apiCalls,
        errors: scanResult.errors
      }
    };

    console.log('Scan completed:', {
      totalResources: report.totalResources,
      resourcesByType: report.resourcesByType,
      scanDurationMs: report.statistics.scanDurationMs,
      apiCalls: report.statistics.apiCalls,
      errors: report.statistics.errors.length
    });

    // Upload to S3
    console.log('Uploading inventory report to S3...');
    const inventoryUrl = await uploader.uploadInventoryReport(
      report,
      config.s3Bucket,
      config.s3Prefix
    );

    const response = {
      success: true,
      requestId: context.awsRequestId,
      inventoryUrl,
      summary: {
        totalResources: report.totalResources,
        resourcesByType: report.resourcesByType,
        scanDurationMs: report.statistics.scanDurationMs,
        apiCalls: report.statistics.apiCalls,
        errorsCount: report.statistics.errors.length
      }
    };

    console.log('Inventory scan completed successfully:', response);
    return response;

  } catch (error) {
    const errorMessage = `Inventory scan failed: ${error}`;
    console.error(errorMessage, error);

    const response = {
      success: false,
      requestId: context.awsRequestId,
      error: errorMessage,
      scanDurationMs: Date.now() - startTime
    };

    // Don't throw - return error response instead
    return response;
  }
};
