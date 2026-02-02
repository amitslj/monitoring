import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MonitoringStack } from './stacks/monitoring-stack';
import { loadConfig } from './lib/config';

const app = new cdk.App();

// Load configuration from config.json
const config = loadConfig();

const monitoringStack = new MonitoringStack(app, 'monitoring-dev', {
  env: {
    account: config.aws.accountId,
    region: config.aws.region
  },
  config,
  description: 'Standalone AWS Resource Monitoring Infrastructure - PoC',
});

app.synth();
