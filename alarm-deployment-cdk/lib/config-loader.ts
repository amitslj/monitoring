import * as fs from 'fs';
import * as path from 'path';
import { MonitoringConfig, InventoryData, AlarmMapping, ResourceAlarmMapping } from './types';

/**
 * Configuration and data loader utility
 */
export class ConfigLoader {
  private rootDir: string;

  constructor(rootDir: string = path.join(__dirname, '..', '..')) {
    this.rootDir = rootDir;
  }

  /**
   * Load monitoring configuration from config.json
   */
  loadConfig(): MonitoringConfig {
    const configPath = path.join(this.rootDir, 'config.json');
    
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

    return config;
  }

  /**
   * Load inventory data from the latest inventory file
   */
  loadInventory(): InventoryData {
    // Look for inventory files in the root directory
    const inventoryFiles = fs.readdirSync(this.rootDir)
      .filter(file => file.startsWith('inventory-') && file.endsWith('.json'))
      .sort()
      .reverse(); // Get the latest file first

    if (inventoryFiles.length === 0) {
      throw new Error(`No inventory files found in ${this.rootDir}`);
    }

    const latestInventoryFile = inventoryFiles[0];
    const inventoryPath = path.join(this.rootDir, latestInventoryFile);
    
    console.log(`Loading inventory from: ${latestInventoryFile}`);
    
    const inventoryContent = fs.readFileSync(inventoryPath, 'utf8');
    return JSON.parse(inventoryContent) as InventoryData;
  }

  /**
   * Load alarm mappings configuration from separate files
   */
  loadAlarmMappings(): AlarmMapping {
    const mappingsDir = path.join(__dirname, '..', 'mappings');
    
    // Load Lambda alarm mappings
    const lambdaMappingsPath = path.join(mappingsDir, 'lambda-alarm-mappings.json');
    const apiGwMappingsPath = path.join(mappingsDir, 'api-gw-alarm-mappings.json');
    
    const alarmMappings: AlarmMapping = {
      version: '1.0',
      generatedAt: new Date().toISOString(),
      alarmMappings: {}
    };

    // Load Lambda mappings if file exists
    if (fs.existsSync(lambdaMappingsPath)) {
      const lambdaContent = fs.readFileSync(lambdaMappingsPath, 'utf8');
      const lambdaMapping: ResourceAlarmMapping = JSON.parse(lambdaContent);
      alarmMappings.alarmMappings[lambdaMapping.resourceType] = lambdaMapping.alarmDefinitions;
      console.log(`Loaded ${lambdaMapping.alarmDefinitions.length} Lambda alarm definitions`);
    }

    // Load API Gateway mappings if file exists
    if (fs.existsSync(apiGwMappingsPath)) {
      const apiGwContent = fs.readFileSync(apiGwMappingsPath, 'utf8');
      const apiGwMapping: ResourceAlarmMapping = JSON.parse(apiGwContent);
      alarmMappings.alarmMappings[apiGwMapping.resourceType] = apiGwMapping.alarmDefinitions;
      console.log(`Loaded ${apiGwMapping.alarmDefinitions.length} API Gateway alarm definitions`);
    }

    return alarmMappings;
  }

  /**
   * Load alarm mappings for a specific resource type
   */
  loadResourceAlarmMappings(resourceType: string): ResourceAlarmMapping | null {
    const mappingsDir = path.join(__dirname, '..', 'mappings');
    let mappingFile: string;

    switch (resourceType) {
      case 'lambda':
        mappingFile = 'lambda-alarm-mappings.json';
        break;
      case 'apigateway':
        mappingFile = 'api-gw-alarm-mappings.json';
        break;
      default:
        console.warn(`No mapping file found for resource type: ${resourceType}`);
        return null;
    }

    const mappingPath = path.join(mappingsDir, mappingFile);
    
    if (!fs.existsSync(mappingPath)) {
      console.warn(`Mapping file not found: ${mappingPath}`);
      return null;
    }

    const mappingContent = fs.readFileSync(mappingPath, 'utf8');
    return JSON.parse(mappingContent) as ResourceAlarmMapping;
  }

  /**
   * Get Lambda function names from inventory
   */
  getLambdaFunctions(inventory: InventoryData): string[] {
    return inventory.lambdas || [];
  }

  /**
   * Get API Gateway resources from inventory
   */
  getApiGatewayResources(inventory: InventoryData) {
    return inventory.apiGateways || [];
  }

  /**
   * Get resources by type from inventory (simplified structure)
   */
  getResourcesByType(inventory: InventoryData, resourceType: string) {
    switch (resourceType) {
      case 'lambda':
        return this.getLambdaFunctions(inventory);
      case 'apigateway':
        return this.getApiGatewayResources(inventory);
      default:
        return [];
    }
  }

  /**
   * Get alarm definitions for a resource type
   */
  getAlarmDefinitionsForResourceType(alarmMappings: AlarmMapping, resourceType: string) {
    return alarmMappings.alarmMappings[resourceType] || [];
  }
}
