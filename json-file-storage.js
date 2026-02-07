const fs = require('fs');
const path = require('path');
const os = require('os');
const { StorageInterface, StorageResult, StorageEventEmitter } = require('./storage-interface');

/**
 * JSON file-based storage implementation
 * Provides persistent storage using JSON files with backup and atomic write capabilities
 */
class JsonFileStorage extends StorageInterface {
  constructor(config) {
    super(config);
    this.eventEmitter = new StorageEventEmitter();
    this.dataFile = config.getDataFilePath();
    this.backupFile = config.getBackupFilePath();
    this.tempFile = config.getTempFilePath();
  }

  /**
   * Initialize the file storage system
   */
  async initialize() {
    try {
      // Ensure the data directory exists
      const dataDir = path.dirname(this.dataFile);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, {
          recursive: true,
          mode: this.config.options.dirMode
        });
        this.log('info', `Created data directory: ${dataDir}`);
      }

      this.isInitialized = true;
      this.eventEmitter.emit('initialized', { storage: 'json-file', dataFile: this.dataFile });

      return StorageResult.success(null, {
        initialized: true,
        dataFile: this.dataFile,
        dataDirectory: dataDir
      });
    } catch (error) {
      this.eventEmitter.emit('error', { operation: 'initialize', error: error.message });
      return StorageResult.failure(`Failed to initialize storage: ${error.message}`);
    }
  }

  /**
   * Load todo data from JSON file
   */
  async loadData() {
    const startTime = Date.now();

    try {
      let data = [];

      if (fs.existsSync(this.dataFile)) {
        const fileContent = fs.readFileSync(this.dataFile, 'utf8');
        const parsedData = JSON.parse(fileContent);
        data = this.validateData(parsedData);

        // If validation filtered out items, save the cleaned data
        if (data.length !== parsedData.length) {
          this.log('warn', `Cleaned up ${parsedData.length - data.length} invalid todo items`);
          await this.saveData(data);
        }

        this.log('info', `Loaded ${data.length} todo${data.length === 1 ? '' : 's'} from ${this.dataFile}`);
      } else {
        this.log('info', `No existing data file found, starting with empty dataset`);
      }

      const duration = Date.now() - startTime;
      this.eventEmitter.emit('load', {
        count: data.length,
        duration,
        cleaned: data.length !== (data.length || 0)
      });

      return StorageResult.success(data, {
        count: data.length,
        duration,
        source: this.dataFile
      });

    } catch (error) {
      this.log('error', `Error loading data: ${error.message}`);

      // Try to restore from backup
      const backupResult = await this.restoreFromBackup();
      if (backupResult.success) {
        this.log('info', 'Successfully restored from backup after load failure');
        return backupResult;
      }

      this.eventEmitter.emit('error', { operation: 'load', error: error.message });
      return StorageResult.failure(`Failed to load data: ${error.message}`);
    }
  }

  /**
   * Save todo data to JSON file with backup and atomic write
   */
  async saveData(todos) {
    const startTime = Date.now();

    for (let attempt = 1; attempt <= this.config.options.maxRetries + 1; attempt++) {
      try {
        // Create backup if current file exists
        if (fs.existsSync(this.dataFile) && this.config.options.enableBackups) {
          await this.createBackup();
        }

        // Prepare data for saving
        const data = JSON.stringify(todos, null, 2);

        // Write using atomic operation if enabled
        if (this.config.options.useTempFiles) {
          // Write to temporary file first
          fs.writeFileSync(this.tempFile, data, {
            mode: this.config.options.fileMode
          });

          // Verify the temp file is valid JSON
          const verification = fs.readFileSync(this.tempFile, 'utf8');
          JSON.parse(verification); // This will throw if invalid

          // Atomic move to final location
          fs.renameSync(this.tempFile, this.dataFile);
        } else {
          // Direct write (for specific scenarios)
          fs.writeFileSync(this.dataFile, data, {
            mode: this.config.options.fileMode
          });
        }

        const duration = Date.now() - startTime;
        this.log('info', `Saved ${todos.length} todo${todos.length === 1 ? '' : 's'} in ${duration}ms`);

        this.eventEmitter.emit('save', {
          count: todos.length,
          duration,
          attempt,
          location: this.dataFile
        });

        return StorageResult.success(null, {
          count: todos.length,
          location: this.dataFile,
          duration,
          attempt
        });

      } catch (error) {
        this.log('error', `Save attempt ${attempt} failed: ${error.message}`);

        // Cleanup temp file if it exists
        if (fs.existsSync(this.tempFile)) {
          try {
            fs.unlinkSync(this.tempFile);
          } catch (cleanupError) {
            this.log('error', `Error cleaning up temp file: ${cleanupError.message}`);
          }
        }

        // Retry logic
        if (attempt <= this.config.options.maxRetries) {
          const delay = this.config.options.retryDelay * attempt;
          this.log('warn', `Retrying save in ${delay}ms (attempt ${attempt}/${this.config.options.maxRetries})`);

          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          this.eventEmitter.emit('error', { operation: 'save', error: error.message, attempts: attempt - 1 });
          return StorageResult.failure(error.message, {
            attempts: attempt - 1,
            duration: Date.now() - startTime
          });
        }
      }
    }
  }

  /**
   * Create backup of current data file
   */
  async createBackup() {
    try {
      if (!fs.existsSync(this.dataFile)) {
        return StorageResult.success(null, { message: 'No data file to backup' });
      }

      // Handle backup rotation if needed
      if (this.config.options.backupRetention > 1) {
        this.rotateBackups();
      }

      // Create the backup
      fs.copyFileSync(this.dataFile, this.backupFile);
      this.log('info', `Created backup: ${this.backupFile}`);

      this.eventEmitter.emit('backup', {
        backupLocation: this.backupFile,
        originalFile: this.dataFile
      });

      return StorageResult.success(null, {
        backupLocation: this.backupFile,
        originalFile: this.dataFile
      });

    } catch (error) {
      this.eventEmitter.emit('error', { operation: 'backup', error: error.message });
      return StorageResult.failure(`Failed to create backup: ${error.message}`);
    }
  }

  /**
   * Restore data from backup file
   */
  async restoreFromBackup() {
    try {
      if (!fs.existsSync(this.backupFile)) {
        return StorageResult.failure('No backup file found');
      }

      const backupContent = fs.readFileSync(this.backupFile, 'utf8');
      const parsedData = JSON.parse(backupContent);
      const validatedData = this.validateData(parsedData);

      this.log('info', `Restored ${validatedData.length} todo${validatedData.length === 1 ? '' : 's'} from backup`);

      this.eventEmitter.emit('restore', {
        count: validatedData.length,
        source: this.backupFile
      });

      return StorageResult.success(validatedData, {
        count: validatedData.length,
        source: this.backupFile
      });

    } catch (error) {
      this.eventEmitter.emit('error', { operation: 'restore', error: error.message });
      return StorageResult.failure(`Failed to restore from backup: ${error.message}`);
    }
  }

  /**
   * Validate and filter todo data
   */
  validateData(data) {
    if (!Array.isArray(data)) {
      throw new Error('Todo data must be an array');
    }

    return data.filter(todo => {
      // Basic validation for required fields
      if (!todo ||
          typeof todo.id !== 'number' ||
          typeof todo.description !== 'string' ||
          typeof todo.completed !== 'boolean' ||
          typeof todo.createdAt !== 'string') {
        return false;
      }

      // Validate optional fields
      if (todo.priority !== undefined) {
        const validPriorities = ['low', 'medium', 'high'];
        if (!validPriorities.includes(todo.priority)) {
          return false;
        }
      }

      if (todo.dueDate !== undefined) {
        if (typeof todo.dueDate !== 'string' || isNaN(Date.parse(todo.dueDate))) {
          return false;
        }
      }

      if (todo.tags !== undefined) {
        if (!Array.isArray(todo.tags) || !todo.tags.every(tag => typeof tag === 'string')) {
          return false;
        }
      }

      if (todo.completedAt !== undefined) {
        if (typeof todo.completedAt !== 'string' || isNaN(Date.parse(todo.completedAt))) {
          return false;
        }
      }

      return true;
    }).map(todo => {
      // Migrate old todos to new structure
      return this.migrateTodo(todo);
    });
  }

  /**
   * Migrate todo structure for backward compatibility
   */
  migrateTodo(todo) {
    const migrated = { ...todo };

    // Add default priority if missing
    if (migrated.priority === undefined) {
      migrated.priority = 'medium';
    }

    // Add tags array if missing
    if (migrated.tags === undefined) {
      migrated.tags = [];
    }

    // Ensure description is trimmed
    migrated.description = migrated.description.trim();

    return migrated;
  }

  /**
   * Rotate backup files based on retention policy
   */
  rotateBackups() {
    if (!this.config.options.enableBackups || this.config.options.backupRetention <= 1) {
      return;
    }

    try {
      // Rotate existing numbered backups
      for (let i = this.config.options.backupRetention - 1; i >= 1; i--) {
        const oldBackup = this.config.getRotatedBackupPath(i);
        const newBackup = this.config.getRotatedBackupPath(i + 1);

        if (fs.existsSync(oldBackup)) {
          if (i === this.config.options.backupRetention - 1) {
            // Delete the oldest backup
            fs.unlinkSync(oldBackup);
            this.log('debug', `Removed oldest backup: ${oldBackup}`);
          } else {
            fs.renameSync(oldBackup, newBackup);
            this.log('debug', `Rotated backup: ${oldBackup} -> ${newBackup}`);
          }
        }
      }

      // Move current backup to numbered backup if we have multiple retention
      if (this.config.options.backupRetention > 1 && fs.existsSync(this.backupFile)) {
        const firstBackup = this.config.getRotatedBackupPath(1);
        fs.copyFileSync(this.backupFile, firstBackup);
        this.log('debug', `Copied current backup to: ${firstBackup}`);
      }
    } catch (error) {
      this.log('warn', `Error during backup rotation: ${error.message}`);
    }
  }

  /**
   * Get storage statistics
   */
  getStats() {
    const stats = {
      type: 'json-file',
      dataFile: this.dataFile,
      backupFile: this.backupFile,
      fileExists: fs.existsSync(this.dataFile),
      backupExists: fs.existsSync(this.backupFile),
      fileSize: 0,
      lastModified: null,
      health: 'unknown'
    };

    try {
      if (stats.fileExists) {
        const fileStats = fs.statSync(this.dataFile);
        stats.fileSize = fileStats.size;
        stats.lastModified = fileStats.mtime.toISOString();
        stats.health = 'healthy';
      }
    } catch (error) {
      stats.health = 'error';
      this.log('error', `Error getting storage stats: ${error.message}`);
    }

    return stats;
  }

  /**
   * Perform health check on storage
   */
  async healthCheck() {
    try {
      const stats = this.getStats();

      // Test write permissions
      const testFile = path.join(path.dirname(this.dataFile), '.write_test');
      try {
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
      } catch (error) {
        return {
          healthy: false,
          message: `Write permission test failed: ${error.message}`
        };
      }

      // Test data file integrity if it exists
      if (stats.fileExists) {
        try {
          const content = fs.readFileSync(this.dataFile, 'utf8');
          JSON.parse(content); // Verify it's valid JSON
        } catch (error) {
          return {
            healthy: false,
            message: `Data file integrity check failed: ${error.message}`
          };
        }
      }

      return {
        healthy: true,
        message: 'Storage is healthy and accessible',
        stats
      };

    } catch (error) {
      return {
        healthy: false,
        message: `Health check failed: ${error.message}`
      };
    }
  }

  /**
   * Cleanup temporary files and resources
   */
  async cleanup() {
    try {
      // Remove temp file if it exists
      if (fs.existsSync(this.tempFile)) {
        fs.unlinkSync(this.tempFile);
        this.log('debug', `Cleaned up temp file: ${this.tempFile}`);
      }

      return StorageResult.success(null, { cleaned: true });
    } catch (error) {
      return StorageResult.failure(`Cleanup failed: ${error.message}`);
    }
  }

  /**
   * Close storage and cleanup resources
   */
  async close() {
    await this.cleanup();
    this.eventEmitter = new StorageEventEmitter();
    await super.close();
  }

  /**
   * Subscribe to storage events
   */
  on(event, callback) {
    this.eventEmitter.on(event, callback);
  }

  /**
   * Unsubscribe from storage events
   */
  off(event, callback) {
    this.eventEmitter.off(event, callback);
  }

  /**
   * Enhanced logging system
   */
  log(level, message, data = null) {
    if (!this.config.options.enableLogging) return;

    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    const configLevel = levels[this.config.options.logLevel] || 1;
    const messageLevel = levels[level] || 1;

    if (messageLevel >= configLevel) {
      const timestamp = new Date().toISOString();
      const prefix = {
        debug: '🔍',
        info: 'ℹ️',
        warn: '⚠️',
        error: '❌'
      }[level] || 'ℹ️';

      const logMessage = `${prefix} [${timestamp}] JsonFileStorage: ${message}`;
      if (data) {
        console.log(logMessage, data);
      } else {
        console.log(logMessage);
      }
    }
  }
}

module.exports = { JsonFileStorage };