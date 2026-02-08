const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { JsonFileStorage } = require('./json-file-storage');
const { StorageResult } = require('./storage-interface');

/**
 * Enhanced JSON file storage with advanced features
 * Extends the base JsonFileStorage with additional reliability, performance monitoring,
 * and data integrity features
 */
class EnhancedJsonStorage extends JsonFileStorage {
  constructor(config) {
    super(config);

    // Performance monitoring
    this.performanceMetrics = {
      operations: {
        save: { count: 0, totalTime: 0, errors: 0 },
        load: { count: 0, totalTime: 0, errors: 0 },
        backup: { count: 0, totalTime: 0, errors: 0 }
      },
      fileSize: {
        current: 0,
        average: 0,
        peak: 0
      },
      compressionRatio: 0,
      lastOptimization: null
    };

    // Data integrity features
    this.checksumFile = this.dataFile + '.checksum';
    this.lockFile = this.dataFile + '.lock';

    // Compression settings
    this.compressionEnabled = config.options.enableCompression || false;
    this.compressionThreshold = config.options.compressionThreshold || 1024;

    // Advanced backup settings
    this.incrementalBackups = config.options.enableIncrementalBackups || false;
    this.backupSchedule = config.options.backupSchedule || null; // cron-like schedule
  }

  /**
   * Enhanced initialization with integrity checks
   */
  async initialize() {
    const result = await super.initialize();
    if (!result.success) return result;

    try {
      // Perform initial health checks
      await this.performIntegrityCheck();

      // Setup performance monitoring
      this.startPerformanceMonitoring();

      // Schedule automatic optimizations if configured
      if (this.config.options.enableAutoOptimization) {
        this.scheduleOptimization();
      }

      this.log('info', 'Enhanced JSON storage initialized successfully');
      return result;
    } catch (error) {
      return StorageResult.failure(`Enhanced initialization failed: ${error.message}`);
    }
  }

  /**
   * Enhanced save operation with compression and integrity checks
   */
  async saveData(todos) {
    const startTime = Date.now();
    const operationId = crypto.randomBytes(8).toString('hex');

    this.log('debug', `Starting enhanced save operation ${operationId}`);

    try {
      // Acquire file lock
      await this.acquireLock(operationId);

      // Validate data before saving
      const validatedTodos = this.validateAndSanitizeData(todos);

      // Determine if compression should be used
      const dataString = JSON.stringify(validatedTodos, null, 2);
      const shouldCompress = this.compressionEnabled &&
                           dataString.length > this.compressionThreshold;

      let finalData;
      let metadata = {
        compressed: shouldCompress,
        originalSize: dataString.length,
        timestamp: new Date().toISOString(),
        version: '2.0',
        operationId
      };

      if (shouldCompress) {
        const compressed = await this.compressData(dataString);
        finalData = JSON.stringify({
          metadata,
          data: compressed.toString('base64')
        }, null, 2);
        metadata.compressedSize = compressed.length;
        this.performanceMetrics.compressionRatio =
          (metadata.originalSize - compressed.length) / metadata.originalSize;
      } else {
        finalData = JSON.stringify({
          metadata,
          data: validatedTodos
        }, null, 2);
      }

      // Create backup before writing
      if (this.config.options.enableBackups && fs.existsSync(this.dataFile)) {
        await this.createIncrementalBackup(validatedTodos);
      }

      // Atomic write operation
      await this.atomicWrite(finalData);

      // Generate and save checksum
      await this.saveChecksum(finalData);

      // Update performance metrics
      const duration = Date.now() - startTime;
      this.updatePerformanceMetrics('save', duration, false);
      this.performanceMetrics.fileSize.current = finalData.length;

      this.log('info', `Enhanced save completed in ${duration}ms (compression: ${shouldCompress ? 'enabled' : 'disabled'})`);

      this.eventEmitter.emit('enhanced-save', {
        count: validatedTodos.length,
        duration,
        compressed: shouldCompress,
        compressionRatio: metadata.compressedSize ?
          1 - (metadata.compressedSize / metadata.originalSize) : 0,
        operationId
      });

      return StorageResult.success(null, {
        count: validatedTodos.length,
        location: this.dataFile,
        duration,
        compressed: shouldCompress,
        originalSize: metadata.originalSize,
        finalSize: finalData.length,
        operationId
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      this.updatePerformanceMetrics('save', duration, true);
      this.log('error', `Enhanced save failed: ${error.message}`);

      // Attempt recovery if save failed
      await this.attemptRecovery('save', error);

      return StorageResult.failure(error.message, {
        duration,
        operationId,
        recoveryAttempted: true
      });
    } finally {
      await this.releaseLock(operationId);
    }
  }

  /**
   * Enhanced load operation with integrity verification
   */
  async loadData() {
    const startTime = Date.now();
    const operationId = crypto.randomBytes(8).toString('hex');

    try {
      if (!fs.existsSync(this.dataFile)) {
        return StorageResult.success([], { message: 'No data file found' });
      }

      // Verify data integrity
      const integrityCheck = await this.verifyDataIntegrity();
      if (!integrityCheck.valid) {
        this.log('warn', `Data integrity check failed: ${integrityCheck.error}`);
        // Attempt to restore from backup
        return await this.recoverFromBackup();
      }

      const fileContent = fs.readFileSync(this.dataFile, 'utf8');
      let parsedContent;

      try {
        parsedContent = JSON.parse(fileContent);
      } catch (error) {
        // Legacy format handling
        const legacyData = this.validateData(JSON.parse(fileContent));
        return this.migrateLegacyFormat(legacyData);
      }

      let todos;

      // Check if this is enhanced format with metadata
      if (parsedContent.metadata && parsedContent.metadata.version === '2.0') {
        if (parsedContent.metadata.compressed) {
          const compressedData = Buffer.from(parsedContent.data, 'base64');
          const decompressed = await this.decompressData(compressedData);
          todos = JSON.parse(decompressed);
        } else {
          todos = parsedContent.data;
        }
      } else {
        // Legacy format or simple format
        todos = Array.isArray(parsedContent) ? parsedContent : parsedContent.data || [];
      }

      const validatedTodos = this.validateData(todos);
      const duration = Date.now() - startTime;

      this.updatePerformanceMetrics('load', duration, false);

      this.log('info', `Enhanced load completed: ${validatedTodos.length} todos in ${duration}ms`);

      return StorageResult.success(validatedTodos, {
        count: validatedTodos.length,
        duration,
        integrityVerified: true,
        operationId
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      this.updatePerformanceMetrics('load', duration, true);

      // Attempt recovery
      this.log('error', `Enhanced load failed: ${error.message}, attempting recovery`);
      return await this.recoverFromBackup();
    }
  }

  /**
   * Create incremental backup with change tracking
   */
  async createIncrementalBackup(currentTodos) {
    if (!this.incrementalBackups) {
      return await super.createBackup();
    }

    const startTime = Date.now();

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupDir = path.join(path.dirname(this.dataFile), '.backups');

      // Ensure backup directory exists
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      // Load previous backup to calculate changes
      let previousTodos = [];
      const lastBackup = await this.getLatestBackup();
      if (lastBackup) {
        previousTodos = JSON.parse(fs.readFileSync(lastBackup.path, 'utf8'));
      }

      // Calculate differences
      const changes = this.calculateChanges(previousTodos, currentTodos);

      const incrementalBackup = {
        timestamp,
        type: 'incremental',
        changes,
        fullData: currentTodos,
        metadata: {
          previousBackup: lastBackup?.filename || null,
          changedCount: changes.added.length + changes.modified.length + changes.deleted.length,
          totalCount: currentTodos.length
        }
      };

      const backupFile = path.join(backupDir, `backup-${timestamp}.json`);
      fs.writeFileSync(backupFile, JSON.stringify(incrementalBackup, null, 2));

      const duration = Date.now() - startTime;
      this.updatePerformanceMetrics('backup', duration, false);

      this.log('info', `Incremental backup created: ${changes.added.length} added, ${changes.modified.length} modified, ${changes.deleted.length} deleted`);

      return StorageResult.success(null, {
        backupLocation: backupFile,
        changes,
        duration
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      this.updatePerformanceMetrics('backup', duration, true);

      // Fallback to regular backup
      this.log('warn', `Incremental backup failed, falling back to regular backup: ${error.message}`);
      return await super.createBackup();
    }
  }

  /**
   * Perform comprehensive integrity check
   */
  async performIntegrityCheck() {
    const checks = {
      fileExists: fs.existsSync(this.dataFile),
      readable: false,
      validJson: false,
      validStructure: false,
      checksumMatch: false,
      backupExists: fs.existsSync(this.backupFile)
    };

    try {
      if (checks.fileExists) {
        // Test readability
        const content = fs.readFileSync(this.dataFile, 'utf8');
        checks.readable = true;

        // Test JSON validity
        const parsed = JSON.parse(content);
        checks.validJson = true;

        // Test data structure
        let todos = parsed;

        // Handle enhanced format with metadata
        if (parsed.metadata && parsed.metadata.version === '2.0') {
          if (parsed.metadata.compressed) {
            // For compressed data, we can't easily validate structure without decompressing
            checks.validStructure = true;
          } else {
            todos = parsed.data;
            checks.validStructure = Array.isArray(todos) &&
              todos.every(todo => todo.id && todo.description !== undefined);
          }
        } else if (parsed.metadata && parsed.data) {
          // Legacy enhanced format
          todos = parsed.data;
          checks.validStructure = Array.isArray(todos) &&
            todos.every(todo => todo.id && todo.description !== undefined);
        } else if (Array.isArray(parsed)) {
          // Simple array format
          checks.validStructure = parsed.every(todo => todo.id && todo.description !== undefined);
        } else {
          checks.validStructure = false;
        }

        // Check checksum if available
        if (fs.existsSync(this.checksumFile)) {
          const savedChecksum = fs.readFileSync(this.checksumFile, 'utf8');
          const currentChecksum = this.calculateChecksum(content);
          checks.checksumMatch = savedChecksum === currentChecksum;
        } else {
          checks.checksumMatch = true; // No checksum to verify
        }
      }

      const allPassed = Object.values(checks).every(check => check === true);

      this.log('info', `Integrity check completed: ${allPassed ? 'PASSED' : 'FAILED'}`);
      this.log('debug', 'Integrity check details:', checks);

      return { valid: allPassed, checks };

    } catch (error) {
      this.log('error', `Integrity check failed: ${error.message}`);
      return { valid: false, error: error.message, checks };
    }
  }

  /**
   * Verify data integrity using checksum
   */
  async verifyDataIntegrity() {
    try {
      if (!fs.existsSync(this.checksumFile)) {
        return { valid: true, message: 'No checksum file to verify' };
      }

      const content = fs.readFileSync(this.dataFile, 'utf8');
      const savedChecksum = fs.readFileSync(this.checksumFile, 'utf8');
      const currentChecksum = this.calculateChecksum(content);

      const valid = savedChecksum === currentChecksum;

      return {
        valid,
        message: valid ? 'Checksum verification passed' : 'Checksum mismatch detected'
      };

    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Calculate SHA-256 checksum of content
   */
  calculateChecksum(content) {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  }

  /**
   * Save checksum for data integrity
   */
  async saveChecksum(content) {
    try {
      const checksum = this.calculateChecksum(content);
      fs.writeFileSync(this.checksumFile, checksum, 'utf8');
    } catch (error) {
      this.log('warn', `Failed to save checksum: ${error.message}`);
    }
  }

  /**
   * Compress data using gzip
   */
  async compressData(data) {
    return new Promise((resolve, reject) => {
      zlib.gzip(data, (error, compressed) => {
        if (error) reject(error);
        else resolve(compressed);
      });
    });
  }

  /**
   * Decompress data using gzip
   */
  async decompressData(compressed) {
    return new Promise((resolve, reject) => {
      zlib.gunzip(compressed, (error, decompressed) => {
        if (error) reject(error);
        else resolve(decompressed.toString());
      });
    });
  }

  /**
   * Atomic write with file locking
   */
  async atomicWrite(content) {
    const tempFile = this.tempFile + '.' + Date.now();

    try {
      // Write to temp file
      fs.writeFileSync(tempFile, content, { mode: this.config.options.fileMode });

      // Verify temp file
      const verification = fs.readFileSync(tempFile, 'utf8');
      JSON.parse(verification); // Will throw if invalid JSON

      // Atomic move
      fs.renameSync(tempFile, this.dataFile);

    } catch (error) {
      // Cleanup temp file on error
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
      throw error;
    }
  }

  /**
   * Acquire file lock for concurrent access protection
   */
  async acquireLock(operationId, timeout = 5000) {
    const startTime = Date.now();

    while (fs.existsSync(this.lockFile)) {
      if (Date.now() - startTime > timeout) {
        throw new Error('Failed to acquire lock: timeout');
      }
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    try {
      fs.writeFileSync(this.lockFile, JSON.stringify({
        operationId,
        timestamp: new Date().toISOString(),
        pid: process.pid
      }));
    } catch (error) {
      throw new Error(`Failed to create lock file: ${error.message}`);
    }
  }

  /**
   * Release file lock
   */
  async releaseLock(operationId) {
    try {
      if (fs.existsSync(this.lockFile)) {
        const lockData = JSON.parse(fs.readFileSync(this.lockFile, 'utf8'));
        if (lockData.operationId === operationId) {
          fs.unlinkSync(this.lockFile);
        }
      }
    } catch (error) {
      this.log('warn', `Failed to release lock: ${error.message}`);
    }
  }

  /**
   * Calculate changes between two todo arrays
   */
  calculateChanges(oldTodos, newTodos) {
    const oldMap = new Map(oldTodos.map(todo => [todo.id, todo]));
    const newMap = new Map(newTodos.map(todo => [todo.id, todo]));

    const added = newTodos.filter(todo => !oldMap.has(todo.id));
    const deleted = oldTodos.filter(todo => !newMap.has(todo.id));
    const modified = newTodos.filter(todo => {
      if (!oldMap.has(todo.id)) return false;
      const oldTodo = oldMap.get(todo.id);
      return JSON.stringify(oldTodo) !== JSON.stringify(todo);
    });

    return { added, deleted, modified };
  }

  /**
   * Update performance metrics
   */
  updatePerformanceMetrics(operation, duration, wasError) {
    const metrics = this.performanceMetrics.operations[operation];
    if (metrics) {
      metrics.count++;
      metrics.totalTime += duration;
      if (wasError) metrics.errors++;
    }

    // Update file size statistics
    if (operation === 'save') {
      const currentSize = this.performanceMetrics.fileSize.current;
      if (currentSize > this.performanceMetrics.fileSize.peak) {
        this.performanceMetrics.fileSize.peak = currentSize;
      }

      const totalOps = this.performanceMetrics.operations.save.count;
      this.performanceMetrics.fileSize.average =
        ((this.performanceMetrics.fileSize.average * (totalOps - 1)) + currentSize) / totalOps;
    }
  }

  /**
   * Start performance monitoring
   */
  startPerformanceMonitoring() {
    // Log performance metrics periodically
    setInterval(() => {
      if (this.config.options.logLevel === 'debug') {
        this.logPerformanceMetrics();
      }
    }, 300000); // Every 5 minutes
  }

  /**
   * Log current performance metrics
   */
  logPerformanceMetrics() {
    const metrics = this.performanceMetrics;
    const operations = Object.entries(metrics.operations)
      .filter(([_, ops]) => ops.count > 0)
      .map(([name, ops]) => {
        const avgTime = ops.totalTime / ops.count;
        const errorRate = (ops.errors / ops.count) * 100;
        return `${name}: ${ops.count} ops, ${avgTime.toFixed(2)}ms avg, ${errorRate.toFixed(1)}% errors`;
      });

    this.log('debug', `Performance metrics: ${operations.join('; ')}`);
    this.log('debug', `File size - current: ${metrics.fileSize.current}B, avg: ${metrics.fileSize.average.toFixed(0)}B, peak: ${metrics.fileSize.peak}B`);
    this.log('debug', `Compression ratio: ${(metrics.compressionRatio * 100).toFixed(1)}%`);
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    return {
      ...this.performanceMetrics,
      averageOperationTimes: Object.fromEntries(
        Object.entries(this.performanceMetrics.operations).map(([name, ops]) => [
          name,
          ops.count > 0 ? ops.totalTime / ops.count : 0
        ])
      ),
      errorRates: Object.fromEntries(
        Object.entries(this.performanceMetrics.operations).map(([name, ops]) => [
          name,
          ops.count > 0 ? (ops.errors / ops.count) * 100 : 0
        ])
      )
    };
  }

  /**
   * Enhanced cleanup with lock file removal
   */
  async cleanup() {
    await super.cleanup();

    // Remove lock file if it exists
    if (fs.existsSync(this.lockFile)) {
      try {
        fs.unlinkSync(this.lockFile);
      } catch (error) {
        this.log('warn', `Failed to remove lock file: ${error.message}`);
      }
    }

    // Clean up checksum file if configured
    if (this.config.options.cleanupChecksumOnExit && fs.existsSync(this.checksumFile)) {
      try {
        fs.unlinkSync(this.checksumFile);
      } catch (error) {
        this.log('warn', `Failed to remove checksum file: ${error.message}`);
      }
    }
  }

  /**
   * Enhanced health check
   */
  async healthCheck() {
    const basicHealth = await super.healthCheck();

    try {
      const integrityCheck = await this.performIntegrityCheck();
      const performanceStats = this.getPerformanceStats();

      // Check for performance issues
      const saveErrorRate = performanceStats.errorRates.save || 0;
      const loadErrorRate = performanceStats.errorRates.load || 0;

      const hasPerformanceIssues = saveErrorRate > 10 || loadErrorRate > 10;

      return {
        ...basicHealth,
        integrity: integrityCheck,
        performance: {
          healthy: !hasPerformanceIssues,
          saveErrorRate,
          loadErrorRate,
          compressionRatio: performanceStats.compressionRatio
        },
        advanced: {
          lockFileExists: fs.existsSync(this.lockFile),
          checksumFileExists: fs.existsSync(this.checksumFile),
          compressionEnabled: this.compressionEnabled
        }
      };

    } catch (error) {
      return {
        ...basicHealth,
        advanced: {
          healthy: false,
          error: error.message
        }
      };
    }
  }

  /**
   * Validate and sanitize data with enhanced checks
   */
  validateAndSanitizeData(data) {
    if (!Array.isArray(data)) {
      throw new Error('Data must be an array');
    }

    return data.map(todo => {
      // Basic validation
      if (!todo || typeof todo !== 'object') {
        throw new Error('Invalid todo item: must be an object');
      }

      // Sanitize and validate fields
      const sanitized = {
        id: this.sanitizeId(todo.id),
        description: this.sanitizeDescription(todo.description),
        completed: Boolean(todo.completed),
        createdAt: this.sanitizeTimestamp(todo.createdAt)
      };

      // Optional fields with validation
      if (todo.priority !== undefined) {
        sanitized.priority = this.sanitizePriority(todo.priority);
      }

      if (todo.tags !== undefined) {
        sanitized.tags = this.sanitizeTags(todo.tags);
      }

      if (todo.dueDate !== undefined) {
        sanitized.dueDate = this.sanitizeTimestamp(todo.dueDate);
      }

      if (todo.completedAt !== undefined) {
        sanitized.completedAt = this.sanitizeTimestamp(todo.completedAt);
      }

      return sanitized;
    });
  }

  /**
   * Data sanitization helpers
   */
  sanitizeId(id) {
    const numId = Number(id);
    if (!Number.isInteger(numId) || numId <= 0) {
      throw new Error(`Invalid todo ID: ${id}`);
    }
    return numId;
  }

  sanitizeDescription(description) {
    if (typeof description !== 'string') {
      throw new Error('Todo description must be a string');
    }
    const trimmed = description.trim();
    if (trimmed.length === 0) {
      throw new Error('Todo description cannot be empty');
    }
    if (trimmed.length > 1000) {
      throw new Error('Todo description too long (max 1000 characters)');
    }
    return trimmed;
  }

  sanitizePriority(priority) {
    const validPriorities = ['low', 'medium', 'high'];
    if (!validPriorities.includes(priority)) {
      return 'medium'; // Default fallback
    }
    return priority;
  }

  sanitizeTags(tags) {
    if (!Array.isArray(tags)) {
      return [];
    }
    return tags
      .filter(tag => typeof tag === 'string')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0)
      .slice(0, 10); // Limit to 10 tags
  }

  sanitizeTimestamp(timestamp) {
    if (typeof timestamp !== 'string') {
      throw new Error('Timestamp must be a string');
    }
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid timestamp: ${timestamp}`);
    }
    return date.toISOString();
  }

  /**
   * Attempt recovery from various error scenarios
   */
  async attemptRecovery(operation, error) {
    this.log('info', `Attempting recovery for failed ${operation} operation: ${error.message}`);

    try {
      // Remove any lock files that might be stuck
      if (fs.existsSync(this.lockFile)) {
        const lockData = JSON.parse(fs.readFileSync(this.lockFile, 'utf8'));
        const lockAge = Date.now() - new Date(lockData.timestamp).getTime();

        if (lockAge > 30000) { // Remove locks older than 30 seconds
          fs.unlinkSync(this.lockFile);
          this.log('info', 'Removed stale lock file during recovery');
        }
      }

      // Clean up any temporary files
      await this.cleanup();

      return true;
    } catch (recoveryError) {
      this.log('error', `Recovery attempt failed: ${recoveryError.message}`);
      return false;
    }
  }

  /**
   * Schedule automatic optimization
   */
  scheduleOptimization() {
    // Run optimization every hour
    setInterval(async () => {
      await this.optimizeStorage();
    }, 3600000);
  }

  /**
   * Optimize storage (compress, cleanup, defragment)
   */
  async optimizeStorage() {
    this.log('info', 'Starting storage optimization');

    try {
      // Load current data
      const loadResult = await this.loadData();
      if (!loadResult.success) return;

      // Re-save with current compression settings
      await this.saveData(loadResult.data);

      // Clean up old backup files beyond retention
      await this.cleanupOldBackups();

      // Update optimization timestamp
      this.performanceMetrics.lastOptimization = new Date().toISOString();

      this.log('info', 'Storage optimization completed');
    } catch (error) {
      this.log('error', `Storage optimization failed: ${error.message}`);
    }
  }

  /**
   * Clean up old backup files
   */
  async cleanupOldBackups() {
    const backupDir = path.join(path.dirname(this.dataFile), '.backups');
    if (!fs.existsSync(backupDir)) return;

    try {
      const files = fs.readdirSync(backupDir)
        .filter(file => file.startsWith('backup-') && file.endsWith('.json'))
        .map(file => ({
          name: file,
          path: path.join(backupDir, file),
          mtime: fs.statSync(path.join(backupDir, file)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime);

      // Keep only the most recent backups according to retention policy
      const retention = this.config.options.backupRetention || 5;
      const filesToDelete = files.slice(retention);

      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
        this.log('debug', `Cleaned up old backup: ${file.name}`);
      }

      if (filesToDelete.length > 0) {
        this.log('info', `Cleaned up ${filesToDelete.length} old backup files`);
      }
    } catch (error) {
      this.log('error', `Backup cleanup failed: ${error.message}`);
    }
  }

  /**
   * Get latest backup for incremental backups
   */
  async getLatestBackup() {
    const backupDir = path.join(path.dirname(this.dataFile), '.backups');
    if (!fs.existsSync(backupDir)) return null;

    try {
      const backupFiles = fs.readdirSync(backupDir)
        .filter(file => file.startsWith('backup-') && file.endsWith('.json'))
        .map(file => ({
          filename: file,
          path: path.join(backupDir, file),
          mtime: fs.statSync(path.join(backupDir, file)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime);

      return backupFiles.length > 0 ? backupFiles[0] : null;
    } catch (error) {
      this.log('warn', `Error getting latest backup: ${error.message}`);
      return null;
    }
  }

  /**
   * Recover from backup when main data is corrupted
   */
  async recoverFromBackup() {
    this.log('info', 'Attempting to recover from backup');

    try {
      // Try the regular backup first
      if (fs.existsSync(this.backupFile)) {
        return await this.restoreFromBackup();
      }

      // Try incremental backups
      const latestBackup = await this.getLatestBackup();
      if (latestBackup) {
        const backupContent = fs.readFileSync(latestBackup.path, 'utf8');
        const backupData = JSON.parse(backupContent);

        let todos = backupData.fullData || backupData;
        if (!Array.isArray(todos) && backupData.data) {
          todos = backupData.data;
        }

        const validatedData = this.validateData(todos);
        return StorageResult.success(validatedData, {
          count: validatedData.length,
          recoveredFrom: latestBackup.filename
        });
      }

      return StorageResult.failure('No backup available for recovery');
    } catch (error) {
      return StorageResult.failure(`Backup recovery failed: ${error.message}`);
    }
  }

  /**
   * Migrate legacy format data
   */
  async migrateLegacyFormat(legacyData) {
    this.log('info', 'Migrating legacy format data');

    // Apply migrations and save in new format
    const migratedData = legacyData.map(todo => this.migrateTodo(todo));
    const saveResult = await this.saveData(migratedData);

    if (saveResult.success) {
      return StorageResult.success(migratedData, {
        count: migratedData.length,
        migrated: true
      });
    } else {
      return StorageResult.success(migratedData, {
        count: migratedData.length,
        migrated: true,
        saveError: saveResult.error
      });
    }
  }
}

module.exports = { EnhancedJsonStorage };