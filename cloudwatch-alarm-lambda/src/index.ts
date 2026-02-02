import { Handler, Context } from 'aws-lambda';
import { AlarmGenerator } from './alarm-generator';
import { S3ClientHelper } from './s3-client';
import { AlarmMapping, InventoryData, AlarmCreationResult } from './types';

interface AlarmLambdaEvent {
  bucket?: string;
  inventoryPrefix?: string;
  source?: string;
}

interface AlarmLambdaResponse {
  success: boolean;
  requestId: string;
  alarmResultsUrl?: string;
  summary?: {
    totalResources: number;
    totalAlarms: number;
    alarmsByStatus: Record<string, number>;
    alarmsByResourceType: Record<string, number>;
    processingDurationMs: number;
  };
  error?: string;
}

export const handler: Handler<AlarmLambdaEvent, AlarmLambdaResponse> = async (
  event: AlarmLambdaEvent,
  context: Context
): Promise<AlarmLambdaResponse> => {
  const startTime = Date.now();

  console.log('CloudWatch Alarm Generator Lambda started');
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    // Get configuration from environment variables
    const bucket = event.bucket || process.env.S3_BUCKET;
    const inventoryPrefix = event.inventoryPrefix || process.env.S3_PREFIX || 'inventory/';
    const alarmPrefix = process.env.S3_ALARM_PREFIX || 'alarm/';

    if (!bucket) {
      throw new Error('S3 bucket not specified in event or environment');
    }

    console.log(`Using S3 bucket: ${bucket}, inventory prefix: ${inventoryPrefix}`);

    // Initialize services
    const s3Helper = new S3ClientHelper();
    const alarmGenerator = new AlarmGenerator();

    // Get alarm mappings configuration
    console.log('Loading alarm mappings configuration...');
    const alarmMappings: AlarmMapping = await s3Helper.getAlarmMappings(bucket);
    console.log(`Loaded alarm mappings for resource types: ${Object.keys(alarmMappings.alarmMappings).join(', ')}`);

    // Get the latest inventory data
    console.log('Loading latest inventory data...');
    const inventoryData: InventoryData = await s3Helper.getLatestInventory(bucket, inventoryPrefix);
    console.log(`Loaded inventory with ${inventoryData.totalResources} resources`);

    // Process alarms for each resource type
    const allResults: AlarmCreationResult[] = [];

    for (const [resourceType, resources] of Object.entries(groupResourcesByType(inventoryData.resources))) {
      const alarmDefinitions = alarmMappings.alarmMappings[resourceType];

      if (!alarmDefinitions || alarmDefinitions.length === 0) {
        console.log(`No alarm definitions found for resource type: ${resourceType}`);
        continue;
      }

      console.log(`Creating alarms for ${resources.length} ${resourceType} resources with ${alarmDefinitions.length} alarm definitions`);

      const results = await alarmGenerator.createAlarmsForResources(resources, alarmDefinitions);
      allResults.push(...results);

      console.log(`Completed alarm creation for ${resourceType}: ${results.length} alarms processed`);
    }

    // Upload results to S3
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsUrl = await s3Helper.uploadAlarmResults(bucket, allResults, timestamp, alarmPrefix);

    const processingDuration = Date.now() - startTime;

    // Generate summary
    const summary = {
      totalResources: inventoryData.totalResources,
      totalAlarms: allResults.length,
      alarmsByStatus: {
        created: allResults.filter(r => r.status === 'created').length,
        updated: allResults.filter(r => r.status === 'updated').length,
        failed: allResults.filter(r => r.status === 'failed').length
      },
      alarmsByResourceType: allResults.reduce((acc, result) => {
        acc[result.resourceType] = (acc[result.resourceType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      processingDurationMs: processingDuration
    };

    console.log('Alarm generation completed successfully');
    console.log('Summary:', JSON.stringify(summary, null, 2));

    return {
      success: true,
      requestId: context.awsRequestId,
      alarmResultsUrl: resultsUrl,
      summary
    };

  } catch (error) {
    console.error('Error in alarm generation:', error);

    return {
      success: false,
      requestId: context.awsRequestId,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
};

/**
 * Group resources by type
 */
function groupResourcesByType(resources: any[]): Record<string, any[]> {
  return resources.reduce((acc, resource) => {
    if (!acc[resource.type]) {
      acc[resource.type] = [];
    }
    acc[resource.type].push(resource);
    return acc;
  }, {} as Record<string, any[]>);
}
