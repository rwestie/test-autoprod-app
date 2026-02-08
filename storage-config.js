const path = require('path');
const os = require('os');

/**
 * Storage configuration for the todo application
 */
class StorageConfig {
  constructor(options = {}) {
    this.options = {
      // Data file location
      dataDir: options.dataDir || this.getDefaultDataDir(),
      dataFile: options.dataFile || 'todos.json',

      // Backup settings
      enableBackups: options.enableBackups !== false, // Default true
      backupRetention: options.backupRetention || 5,
      backupSuffix: options.backupSuffix || '.backup',

      // Atomic write settings
      useTempFiles: options.useTempFiles !== false, // Default true
      tempSuffix: options.tempSuffix || '.tmp',

      // Validation settings
      enableValidation: options.enableValidation !== false, // Default true
      enableMigration: options.enableMigration !== false, // Default true

      // Logging settings
      enableLogging: options.enableLogging !== false, // Default true
      logLevel: options.logLevel || 'info', // debug, info, warn, error

      // Performance settings
      batchSize: options.batchSize || 1000,
      compressionThreshold: options.compressionThreshold || 1024,
      enableCompression: options.enableCompression || false,

      // Enhanced storage features
      enableIncrementalBackups: options.enableIncrementalBackups || false,
      enableIntegrityChecks: options.enableIntegrityChecks !== false, // Default true
      enablePerformanceMonitoring: options.enablePerformanceMonitoring !== false, // Default true
      enableAutoOptimization: options.enableAutoOptimization || false,
      cleanupChecksumOnExit: options.cleanupChecksumOnExit !== false, // Default true

      // Error handling
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 100,
      fallbackToCurrentDir: options.fallbackToCurrentDir !== false, // Default true

      // File permissions (Node.js file mode)
      fileMode: options.fileMode || 0o644,
      dirMode: options.dirMode || 0o755
    };
  }

  getDefaultDataDir() {
    return path.join(os.homedir(), '.todos');
  }

  getDataFilePath() {
    return path.join(this.options.dataDir, this.options.dataFile);
  }

  getBackupFilePath() {
    return this.getDataFilePath() + this.options.backupSuffix;
  }

  getTempFilePath() {
    return this.getDataFilePath() + this.options.tempSuffix;
  }

  // Generate numbered backup files for rotation
  getRotatedBackupPath(index) {
    const basePath = this.getDataFilePath();
    return `${basePath}.backup.${index}`;
  }

  // Validate configuration options
  validate() {
    const errors = [];

    if (!this.options.dataDir) {
      errors.push('dataDir is required');
    }

    if (!this.options.dataFile) {
      errors.push('dataFile is required');
    }

    if (this.options.backupRetention < 0) {
      errors.push('backupRetention must be >= 0');
    }

    if (!['debug', 'info', 'warn', 'error'].includes(this.options.logLevel)) {
      errors.push('logLevel must be one of: debug, info, warn, error');
    }

    if (this.options.maxRetries < 0) {
      errors.push('maxRetries must be >= 0');
    }

    if (this.options.retryDelay < 0) {
      errors.push('retryDelay must be >= 0');
    }

    return errors;
  }

  // Create a copy of the configuration
  clone() {
    return new StorageConfig(JSON.parse(JSON.stringify(this.options)));
  }

  // Merge with another configuration
  merge(other) {
    const mergedOptions = { ...this.options, ...other };
    return new StorageConfig(mergedOptions);
  }

  // Export configuration as JSON
  toJSON() {
    return JSON.stringify(this.options, null, 2);
  }

  // Create configuration from environment variables
  static fromEnvironment() {
    const options = {};

    if (process.env.TODO_DATA_DIR) {
      options.dataDir = process.env.TODO_DATA_DIR;
    }

    if (process.env.TODO_DATA_FILE) {
      options.dataFile = process.env.TODO_DATA_FILE;
    }

    if (process.env.TODO_ENABLE_BACKUPS !== undefined) {
      options.enableBackups = process.env.TODO_ENABLE_BACKUPS === 'true';
    }

    if (process.env.TODO_BACKUP_RETENTION) {
      options.backupRetention = parseInt(process.env.TODO_BACKUP_RETENTION, 10);
    }

    if (process.env.TODO_LOG_LEVEL) {
      options.logLevel = process.env.TODO_LOG_LEVEL;
    }

    if (process.env.TODO_MAX_RETRIES) {
      options.maxRetries = parseInt(process.env.TODO_MAX_RETRIES, 10);
    }

    if (process.env.TODO_ENABLE_COMPRESSION !== undefined) {
      options.enableCompression = process.env.TODO_ENABLE_COMPRESSION === 'true';
    }

    if (process.env.TODO_COMPRESSION_THRESHOLD) {
      options.compressionThreshold = parseInt(process.env.TODO_COMPRESSION_THRESHOLD, 10);
    }

    if (process.env.TODO_ENABLE_INCREMENTAL_BACKUPS !== undefined) {
      options.enableIncrementalBackups = process.env.TODO_ENABLE_INCREMENTAL_BACKUPS === 'true';
    }

    if (process.env.TODO_ENABLE_AUTO_OPTIMIZATION !== undefined) {
      options.enableAutoOptimization = process.env.TODO_ENABLE_AUTO_OPTIMIZATION === 'true';
    }

    if (process.env.TODO_ENABLE_INTEGRITY_CHECKS !== undefined) {
      options.enableIntegrityChecks = process.env.TODO_ENABLE_INTEGRITY_CHECKS === 'true';
    }

    return new StorageConfig(options);
  }

  // Create development configuration
  static development() {
    return new StorageConfig({
      logLevel: 'debug',
      enableBackups: true,
      backupRetention: 3,
      maxRetries: 1,
      retryDelay: 50
    });
  }

  // Create production configuration
  static production() {
    return new StorageConfig({
      logLevel: 'warn',
      enableBackups: true,
      backupRetention: 10,
      maxRetries: 5,
      retryDelay: 200,
      enableCompression: true,
      compressionThreshold: 2048,
      enableIncrementalBackups: true,
      enableIntegrityChecks: true,
      enablePerformanceMonitoring: true,
      enableAutoOptimization: true
    });
  }

  // Create high-performance configuration
  static highPerformance() {
    return new StorageConfig({
      logLevel: 'error',
      enableBackups: false,
      maxRetries: 1,
      retryDelay: 50,
      enableCompression: true,
      compressionThreshold: 512,
      enableIncrementalBackups: false,
      enableIntegrityChecks: false,
      enablePerformanceMonitoring: true,
      enableAutoOptimization: false,
      useTempFiles: false // Faster writes, less safety
    });
  }

  // Create testing configuration
  static testing() {
    return new StorageConfig({
      enableLogging: false,
      enableBackups: false,
      maxRetries: 0,
      dataDir: os.tmpdir(),
      dataFile: `test-todos-${Date.now()}.json`
    });
  }
}

module.exports = { StorageConfig };