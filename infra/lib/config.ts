import * as fs from 'fs';
import * as path from 'path';

export interface TagFilter {
  key: string;
  value: string;
}

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

export function loadConfig(): MonitoringConfig {
  const configPath = path.join(__dirname, '..', '..', 'config.json');

  if (!fs.existsSync(configPath)) {
    throw new Error(`Configuration file not found: ${configPath}`);
  }

  const configContent = fs.readFileSync(configPath, 'utf8');
  const config: MonitoringConfig = JSON.parse(configContent);

  // Validate required fields
  if (!config.aws?.accountId) {
    throw new Error('Missing required config: aws.accountId');
  }
  if (!config.aws?.region) {
    throw new Error('Missing required config: aws.region');
  }
  if (!config.s3?.bucket) {
    throw new Error('Missing required config: s3.bucket');
  }
  if (!config.s3?.alarmPrefix) {
    throw new Error('Missing required config: s3.alarmPrefix');
  }

  return config;
}
