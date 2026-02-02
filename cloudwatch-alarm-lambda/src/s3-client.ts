import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { AlarmMapping, InventoryData, AlarmCreationResult } from './types';

export class S3ClientHelper {
  private s3Client: S3Client;
  private region: string;

  constructor(region: string = process.env.AWS_REGION || 'us-east-1') {
    this.region = region;
    this.s3Client = new S3Client({ region });
  }

  /**
   * Download and parse the latest inventory file
   */
  async getLatestInventory(bucket: string, prefix: string): Promise<InventoryData> {
    console.log(`Getting latest inventory from s3://${bucket}/${prefix}`);

    // For now, we'll use a simple approach - get the most recent inventory file
    // In a production system, you might want to list objects and find the latest
    const inventoryKey = await this.findLatestInventoryFile(bucket, prefix);

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: inventoryKey
    });

    const response = await this.s3Client.send(command);

    if (!response.Body) {
      throw new Error('Empty response from S3');
    }

    const content = await response.Body.transformToString();
    return JSON.parse(content) as InventoryData;
  }

  /**
   * Get alarm mappings configuration
   */
  async getAlarmMappings(bucket: string): Promise<AlarmMapping> {
    console.log(`Getting alarm mappings from s3://${bucket}/alarm-mappings.json`);

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: 'alarm-mappings.json'
    });

    const response = await this.s3Client.send(command);

    if (!response.Body) {
      throw new Error('Empty alarm mappings response from S3');
    }

    const content = await response.Body.transformToString();
    return JSON.parse(content) as AlarmMapping;
  }

  /**
   * Upload alarm creation results
   */
  async uploadAlarmResults(
    bucket: string,
    results: AlarmCreationResult[],
    timestamp: string,
    alarmPrefix?: string
  ): Promise<string> {
    const prefix = alarmPrefix || process.env.S3_ALARM_PREFIX || 'alarm/';
    const key = `${prefix}alarm-results-${timestamp}.json`;

    const alarmReport = {
      generatedAt: new Date().toISOString(),
      totalAlarms: results.length,
      alarmsByStatus: {
        created: results.filter(r => r.status === 'created').length,
        updated: results.filter(r => r.status === 'updated').length,
        failed: results.filter(r => r.status === 'failed').length
      },
      alarmsByResourceType: this.groupByResourceType(results),
      results
    };

    console.log(`Uploading alarm results to s3://${bucket}/${key}`);

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(alarmReport, null, 2),
      ContentType: 'application/json'
    });

    await this.s3Client.send(command);

    return `s3://${bucket}/${key}`;
  }

  /**
   * Find the latest inventory file by listing S3 objects
   */
  private async findLatestInventoryFile(bucket: string, prefix: string): Promise<string> {
    console.log(`Listing inventory files in s3://${bucket}/${prefix}`);

    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      MaxKeys: 1000 // Should be enough for inventory files
    });

    const response = await this.s3Client.send(command);

    if (!response.Contents || response.Contents.length === 0) {
      throw new Error(`No inventory files found in s3://${bucket}/${prefix}`);
    }

    // Filter for inventory files (exclude summary and other files)
    const inventoryFiles = response.Contents
      .filter(obj => obj.Key && obj.Key.includes('inventory-') && obj.Key.endsWith('.json'))
      .filter(obj => !obj.Key!.includes('summary') && !obj.Key!.includes('alarm'))
      .sort((a, b) => {
        // Sort by LastModified date, newest first
        const dateA = a.LastModified ? a.LastModified.getTime() : 0;
        const dateB = b.LastModified ? b.LastModified.getTime() : 0;
        return dateB - dateA;
      });

    if (inventoryFiles.length === 0) {
      throw new Error(`No valid inventory files found in s3://${bucket}/${prefix}`);
    }

    const latestFile = inventoryFiles[0];
    console.log(`Found latest inventory file: ${latestFile.Key} (modified: ${latestFile.LastModified})`);

    return latestFile.Key!;
  }

  /**
   * Group alarm results by resource type
   */
  private groupByResourceType(results: AlarmCreationResult[]): Record<string, number> {
    return results.reduce((acc, result) => {
      acc[result.resourceType] = (acc[result.resourceType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }
}
