/**
 * Abstract storage interface for the todo application
 *
 * This interface provides a standardized way to store and retrieve todo data
 * regardless of the underlying storage mechanism (file system, database, cloud, etc.)
 */

/**
 * Base StorageInterface class
 * All storage implementations must extend this class and implement its methods
 */
class StorageInterface {
  /**
   * Constructor for storage interface
   * @param {StorageConfig} config - Configuration object for storage
   */
  constructor(config) {
    this.config = config;
    this.isInitialized = false;
  }

  /**
   * Initialize the storage backend
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async initialize() {
    throw new Error('initialize() method must be implemented by storage backend');
  }

  /**
   * Load all todo data from storage
   * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
   */
  async loadData() {
    throw new Error('loadData() method must be implemented by storage backend');
  }

  /**
   * Save all todo data to storage
   * @param {Array} todos - Array of todo objects to save
   * @returns {Promise<{success: boolean, count?: number, location?: string, duration?: number, error?: string}>}
   */
  async saveData(todos) {
    throw new Error('saveData() method must be implemented by storage backend');
  }

  /**
   * Create a backup of current data
   * @returns {Promise<{success: boolean, backupLocation?: string, error?: string}>}
   */
  async createBackup() {
    throw new Error('createBackup() method must be implemented by storage backend');
  }

  /**
   * Restore data from backup
   * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
   */
  async restoreFromBackup() {
    throw new Error('restoreFromBackup() method must be implemented by storage backend');
  }

  /**
   * Validate data structure
   * @param {Array} data - Data to validate
   * @returns {Array} - Validated and filtered data
   */
  validateData(data) {
    throw new Error('validateData() method must be implemented by storage backend');
  }

  /**
   * Get storage statistics and health information
   * @returns {Object} - Storage stats including file size, count, health, etc.
   */
  getStats() {
    throw new Error('getStats() method must be implemented by storage backend');
  }

  /**
   * Check if storage is healthy and accessible
   * @returns {Promise<{healthy: boolean, message?: string}>}
   */
  async healthCheck() {
    throw new Error('healthCheck() method must be implemented by storage backend');
  }

  /**
   * Cleanup temporary files and resources
   * @returns {Promise<void>}
   */
  async cleanup() {
    throw new Error('cleanup() method must be implemented by storage backend');
  }

  /**
   * Close storage connections and cleanup resources
   * @returns {Promise<void>}
   */
  async close() {
    this.isInitialized = false;
  }
}

/**
 * Storage operation result structure
 */
class StorageResult {
  constructor(success, data = null, error = null, metadata = {}) {
    this.success = success;
    this.data = data;
    this.error = error;
    this.timestamp = new Date().toISOString();
    this.metadata = metadata;
  }

  static success(data, metadata = {}) {
    return new StorageResult(true, data, null, metadata);
  }

  static failure(error, metadata = {}) {
    return new StorageResult(false, null, error, metadata);
  }
}

/**
 * Storage factory for creating storage instances
 */
class StorageFactory {
  static registeredStorages = new Map();

  /**
   * Register a storage implementation
   * @param {string} type - Storage type identifier
   * @param {Class} storageClass - Storage implementation class
   */
  static register(type, storageClass) {
    if (!(storageClass.prototype instanceof StorageInterface)) {
      throw new Error('Storage class must extend StorageInterface');
    }
    this.registeredStorages.set(type, storageClass);
  }

  /**
   * Create a storage instance
   * @param {string} type - Storage type
   * @param {StorageConfig} config - Configuration object
   * @returns {StorageInterface} - Storage instance
   */
  static create(type, config) {
    const StorageClass = this.registeredStorages.get(type);
    if (!StorageClass) {
      throw new Error(`Unknown storage type: ${type}`);
    }
    return new StorageClass(config);
  }

  /**
   * Get list of available storage types
   * @returns {Array<string>} - Array of storage type names
   */
  static getAvailableTypes() {
    return Array.from(this.registeredStorages.keys());
  }
}

/**
 * Storage event emitter for monitoring storage operations
 */
class StorageEventEmitter {
  constructor() {
    this.listeners = new Map();
  }

  /**
   * Subscribe to storage events
   * @param {string} event - Event name ('save', 'load', 'backup', 'error')
   * @param {Function} callback - Event callback
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  /**
   * Remove event listener
   * @param {string} event - Event name
   * @param {Function} callback - Event callback to remove
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Emit a storage event
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in storage event listener for ${event}:`, error);
        }
      });
    }
  }
}

module.exports = {
  StorageInterface,
  StorageResult,
  StorageFactory,
  StorageEventEmitter
};