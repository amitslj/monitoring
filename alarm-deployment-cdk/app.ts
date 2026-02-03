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
  console.log(`Loaded inventory with ${inventory.totalResources} resources`);
  console.log(`Resource types in inventory: ${Object.keys(inventory.resourcesByType).join(', ')}`);
  console.log(`Alarm mappings available for: ${Object.keys(alarmMappings.alarmMappings).join(', ')}`);

  // Common stack configuration
  const stackEnv = {
    account: config.aws.accountId,
    region: config.aws.region
  };

  // Create stacks for each resource type that has resources and alarm definitions
  const resourceTypes = config.resources.types;

  for (const resourceType of resourceTypes) {
    const resources = configLoader.getResourcesByType(inventory, resourceType);
    const alarmDefinitions = configLoader.getAlarmDefinitionsForResourceType(alarmMappings, resourceType);

    if (resources.length === 0) {
      console.log(`Skipping ${resourceType}: No resources found in inventory`);
      continue;
    }

    if (alarmDefinitions.length === 0) {
      console.log(`Skipping ${resourceType}: No alarm definitions found`);
      continue;
    }

    console.log(`Creating stack for ${resourceType}: ${resources.length} resources, ${alarmDefinitions.length} alarm definitions`);

    const stackConfig: AlarmStackConfig = {
      config,
      inventory,
      alarmMappings,
      resourceType
    };

    // Create appropriate stack based on resource type
    switch (resourceType) {
      case 'lambda':
        new LambdaAlarmsStack(app, 'LambdaAlarmsStack', {
          config: stackConfig,
          env: stackEnv,
          description: `CloudWatch alarms for Lambda functions - ${resources.length} resources`
        });
        break;

      case 'apigateway':
        new ApiGatewayAlarmsStack(app, 'ApiGatewayAlarmsStack', {
          config: stackConfig,
          env: stackEnv,
          description: `CloudWatch alarms for API Gateway APIs - ${resources.length} resources`
        });
        break;

      case 'apigatewayv2':
        // For now, we'll skip API Gateway v2 as it's not in the current alarm mappings
        // You can add a separate stack for this later if needed
        console.log(`Skipping ${resourceType}: Stack not implemented yet`);
        break;

      default:
        console.log(`Skipping ${resourceType}: Unknown resource type`);
        break;
    }
  }

  console.log('CDK app initialization completed');

} catch (error) {
  console.error('Failed to initialize CDK app:', error);
  process.exit(1);
}

app.synth();
