import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { InventoryReport } from './types';

/**
 * S3 Uploader for inventory reports
 */
export class S3Uploader {
  private s3Client: S3Client;

  constructor(region: string = process.env.AWS_REGION || 'us-east-1') {
    this.s3Client = new S3Client({ region });
  }

  /**
   * Upload inventory report to S3
   */
  async uploadInventoryReport(
    report: InventoryReport,
    bucket: string,
    prefix: string
  ): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `inventory-${timestamp}.json`;
    const key = `${prefix}${fileName}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(report, null, 2),
      ContentType: 'application/json',
      Metadata: {
        'generated-at': report.generatedAt,
        'total-resources': report.totalResources.toString(),
        'resource-types': report.config.resourceTypes.join(','),
        'scan-duration-ms': report.statistics.scanDurationMs.toString()
      }
    });

    try {
      await this.s3Client.send(command);
      const s3Url = `s3://${bucket}/${key}`;
      console.log(`Successfully uploaded inventory report to ${s3Url}`);
      return s3Url;
    } catch (error) {
      const errorMessage = `Failed to upload inventory report to S3: ${error}`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  }

  /**
   * Upload summary report with just statistics
   */
  async uploadSummaryReport(
    report: InventoryReport,
    bucket: string,
    prefix: string
  ): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `summary-${timestamp}.json`;
    const key = `${prefix}summary/${fileName}`;

    const summary = {
      generatedAt: report.generatedAt,
      totalResources: report.totalResources,
      resourcesByType: report.resourcesByType,
      statistics: report.statistics,
      config: {
        resourceTypes: report.config.resourceTypes,
        tagFiltersCount: report.config.tagFilters.length
      }
    };

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(summary, null, 2),
      ContentType: 'application/json',
      Metadata: {
        'report-type': 'summary',
        'generated-at': report.generatedAt,
        'total-resources': report.totalResources.toString()
      }
    });

    try {
      await this.s3Client.send(command);
      const s3Url = `s3://${bucket}/${key}`;
      console.log(`Successfully uploaded summary report to ${s3Url}`);
      return s3Url;
    } catch (error) {
      const errorMessage = `Failed to upload summary report to S3: ${error}`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  }
}
