import * as fs from 'fs';
import * as path from 'path';
import { MonitoringConfig, InventoryData, AlarmMapping } from './types';

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
   * Load alarm mappings configuration
   */
  loadAlarmMappings(): AlarmMapping {
    const alarmMappingsPath = path.join(this.rootDir, 'alarm-mappings.json');
    
    if (!fs.existsSync(alarmMappingsPath)) {
      throw new Error(`Alarm mappings file not found: ${alarmMappingsPath}`);
    }

    const alarmMappingsContent = fs.readFileSync(alarmMappingsPath, 'utf8');
    return JSON.parse(alarmMappingsContent) as AlarmMapping;
  }

  /**
   * Get resources by type from inventory
   */
  getResourcesByType(inventory: InventoryData, resourceType: string) {
    return inventory.resources.filter(resource => resource.type === resourceType);
  }

  /**
   * Get alarm definitions for a resource type
   */
  getAlarmDefinitionsForResourceType(alarmMappings: AlarmMapping, resourceType: string) {
    return alarmMappings.alarmMappings[resourceType] || [];
  }
}
