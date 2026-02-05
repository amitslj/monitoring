#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ConfigLoader } from './lib/config-loader';
import { LambdaAlarmsStack } from './stacks/lambda-alarms-stack';
import { ApiGatewayAlarmsStack } from './stacks/apigateway-alarms-stack';
import { AlarmStackConfig } from './lib/types';

const app = new cdk.App();

try {
  // Load configuration and data
  const configLoader = new ConfigLoader();
  const config = configLoader.loadConfig();
  const inventory = configLoader.loadInventory();
  const alarmMappings = configLoader.loadAlarmMappings();

  console.log(`Loaded configuration for account: ${config.aws.accountId}, region: ${config.aws.region}`);
  console.log(`Loaded inventory for environment: ${inventory.environment}`);
  console.log(`Lambda functions: ${inventory.lambdas?.length || 0}`);
  console.log(`API Gateways: ${inventory.apiGateways?.length || 0}`);
  console.log(`Alarm mappings available for: ${Object.keys(alarmMappings.alarmMappings).join(', ')}`);

  // Common stack configuration
  const stackEnv = {
    account: config.aws.accountId,
    region: config.aws.region
  };

  const stackConfig: AlarmStackConfig = {
    config,
    inventory,
    alarmMappings,
    resourceType: '' // Not used in new structure
  };

  // Create Lambda alarms stack if there are Lambda functions
  if (inventory.lambdas && inventory.lambdas.length > 0) {
    const lambdaAlarmDefinitions = configLoader.getAlarmDefinitionsForResourceType(alarmMappings, 'lambda');
    
    if (lambdaAlarmDefinitions.length > 0) {
      console.log(`Creating Lambda alarms stack: ${inventory.lambdas.length} functions, ${lambdaAlarmDefinitions.length} alarm definitions`);
      console.log(`Lambda functions: ${inventory.lambdas.join(', ')}`);
      
      new LambdaAlarmsStack(app, 'LambdaAlarmsStack', {
        config: stackConfig,
        env: stackEnv,
        description: `CloudWatch alarms for Lambda functions - ${inventory.lambdas.length} functions`
      });
    } else {
      console.log('Skipping Lambda alarms: No alarm definitions found');
    }
  } else {
    console.log('Skipping Lambda alarms: No Lambda functions found in inventory');
  }

  // Create API Gateway alarms stack if there are API Gateways
  if (inventory.apiGateways && inventory.apiGateways.length > 0) {
    const apiGatewayAlarmDefinitions = configLoader.getAlarmDefinitionsForResourceType(alarmMappings, 'apigateway');
    
    if (apiGatewayAlarmDefinitions.length > 0) {
      console.log(`Creating API Gateway alarms stack: ${inventory.apiGateways.length} APIs, ${apiGatewayAlarmDefinitions.length} alarm definitions`);
      console.log(`API Gateways: ${inventory.apiGateways.map(api => `${api.apiName}:${api.stage}`).join(', ')}`);
      
      new ApiGatewayAlarmsStack(app, 'ApiGatewayAlarmsStack', {
        config: stackConfig,
        env: stackEnv,
        description: `CloudWatch alarms for API Gateway APIs - ${inventory.apiGateways.length} APIs`
      });
    } else {
      console.log('Skipping API Gateway alarms: No alarm definitions found');
    }
  } else {
    console.log('Skipping API Gateway alarms: No API Gateways found in inventory');
  }

  console.log('CDK app initialization completed');

} catch (error) {
  console.error('Failed to initialize CDK app:', error);
  process.exit(1);
}

app.synth();
