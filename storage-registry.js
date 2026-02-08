/**
 * Storage registry for managing available storage implementations
 */

const { StorageFactory } = require('./storage-interface');
const { JsonFileStorage } = require('./json-file-storage');
const { EnhancedJsonStorage } = require('./enhanced-json-storage');

// Register available storage implementations
StorageFactory.register('json-file', JsonFileStorage);
StorageFactory.register('enhanced-json', EnhancedJsonStorage);

// Export factory with pre-registered implementations
module.exports = {
  StorageFactory,
  // Also export specific implementations for direct use
  JsonFileStorage,
  EnhancedJsonStorage
};