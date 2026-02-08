/**
 * State integration layer for enhanced todo application state management
 * Provides real-time state persistence, validation, and synchronization
 */

const EventEmitter = require('events');

class StateIntegration extends EventEmitter {
  constructor(todoCore, autoSaveIntegration, config = {}) {
    super();
    this.todoCore = todoCore;
    this.autoSaveIntegration = autoSaveIntegration;

    this.config = {
      // State monitoring
      enableStateMonitoring: config.enableStateMonitoring !== false, // Default enabled
      enableStateValidation: config.enableStateValidation !== false, // Default enabled
      enableIntegrityChecks: config.enableIntegrityChecks !== false, // Default enabled

      // Real-time features
      enableRealTimeSync: config.enableRealTimeSync !== false, // Default enabled
      syncInterval: config.syncInterval || 30000, // 30 second sync check

      // Performance monitoring
      trackStateChanges: config.trackStateChanges !== false, // Default enabled
      maxStateHistory: config.maxStateHistory || 50,

      // Validation settings
      deepValidation: config.deepValidation || false,
      validationOnRead: config.validationOnRead || true,
      validationOnWrite: config.validationOnWrite !== false, // Default enabled

      ...config
    };

    // State tracking
    this.stateHistory = [];
    this.lastSyncTime = null;
    this.stateMetrics = {
      totalOperations: 0,
      readOperations: 0,
      writeOperations: 0,
      validationErrors: 0,
      integrityErrors: 0
    };

    // Sync timer
    this.syncTimer = null;

    // Initialize state monitoring
    this.initialize();
  }

  /**
   * Initialize state integration
   */
  initialize() {
    if (this.config.enableStateMonitoring) {
      this.log('info', 'StateIntegration: Initializing state monitoring');

      // Start periodic sync monitoring
      if (this.config.enableRealTimeSync) {
        this.startSyncMonitoring();
      }
    }
  }

  /**
   * Enhanced logging with state context
   */
  log(level, message, data = null) {
    if (!this.todoCore.config.options.enableLogging) return;

    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    const configLevel = levels[this.todoCore.config.options.logLevel] || 1;
    const messageLevel = levels[level] || 1;

    if (messageLevel >= configLevel) {
      const timestamp = new Date().toISOString();
      const prefix = {
        debug: '🔍',
        info: 'ℹ️',
        warn: '⚠️',
        error: '❌'
      }[level] || 'ℹ️';

      if (data) {
        console.log(`${prefix} [${timestamp}] StateIntegration: ${message}`, data);
      } else {
        console.log(`${prefix} [${timestamp}] StateIntegration: ${message}`);
      }
    }
  }

  /**
   * Validate current application state
   */
  async validateState(options = {}) {
    if (!this.config.enableStateValidation) {
      return { success: true, message: 'State validation disabled' };
    }

    this.stateMetrics.totalOperations++;

    try {
      // Get current state from storage
      const storageStats = await this.todoCore.getStorageStats();
      const currentTodos = await this.todoCore.listTodos();

      const validation = {
        success: true,
        errors: [],
        warnings: [],
        stats: {
          todoCount: currentTodos.length,
          storageCount: storageStats.todoCount,
          memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024 // MB
        }
      };

      // Basic validation
      if (currentTodos.length !== storageStats.todoCount) {
        validation.errors.push(`State mismatch: Memory has ${currentTodos.length} todos, storage reports ${storageStats.todoCount}`);
      }

      // Deep validation if enabled
      if (this.config.deepValidation || options.deep) {
        await this.performDeepValidation(validation, currentTodos);
      }

      // Integrity checks
      if (this.config.enableIntegrityChecks) {
        await this.performIntegrityChecks(validation, currentTodos);
      }

      if (validation.errors.length > 0) {
        validation.success = false;
        this.stateMetrics.validationErrors++;
        this.log('error', `State validation failed: ${validation.errors.length} error(s)`, validation.errors);
        this.emit('validation-error', validation);
      } else if (validation.warnings.length > 0) {
        this.log('warn', `State validation warnings: ${validation.warnings.length} warning(s)`, validation.warnings);
        this.emit('validation-warning', validation);
      } else {
        this.log('debug', 'State validation passed', validation.stats);
        this.emit('validation-success', validation);
      }

      return validation;
    } catch (error) {
      this.stateMetrics.validationErrors++;
      this.log('error', `State validation exception: ${error.message}`);
      return {
        success: false,
        errors: [`Validation exception: ${error.message}`],
        warnings: []
      };
    }
  }

  /**
   * Perform deep validation of todo objects
   */
  async performDeepValidation(validation, todos) {
    const requiredFields = ['id', 'description', 'completed', 'createdAt'];
    const idSet = new Set();

    for (let i = 0; i < todos.length; i++) {
      const todo = todos[i];
      const todoPrefix = `Todo #${todo.id || i}`;

      // Check required fields
      for (const field of requiredFields) {
        if (todo[field] === undefined || todo[field] === null) {
          validation.errors.push(`${todoPrefix}: Missing required field '${field}'`);
        }
      }

      // Check for duplicate IDs
      if (todo.id) {
        if (idSet.has(todo.id)) {
          validation.errors.push(`${todoPrefix}: Duplicate ID detected`);
        } else {
          idSet.add(todo.id);
        }
      }

      // Validate data types
      if (todo.id && typeof todo.id !== 'number') {
        validation.errors.push(`${todoPrefix}: ID must be a number`);
      }

      if (todo.description && typeof todo.description !== 'string') {
        validation.errors.push(`${todoPrefix}: Description must be a string`);
      }

      if (todo.completed !== undefined && typeof todo.completed !== 'boolean') {
        validation.errors.push(`${todoPrefix}: Completed must be a boolean`);
      }

      // Validate dates
      if (todo.createdAt) {
        const createdDate = new Date(todo.createdAt);
        if (isNaN(createdDate.getTime())) {
          validation.errors.push(`${todoPrefix}: Invalid createdAt date`);
        }
      }

      if (todo.dueDate) {
        const dueDate = new Date(todo.dueDate);
        if (isNaN(dueDate.getTime())) {
          validation.errors.push(`${todoPrefix}: Invalid dueDate`);
        }
      }

      // Validate arrays
      if (todo.tags && !Array.isArray(todo.tags)) {
        validation.errors.push(`${todoPrefix}: Tags must be an array`);
      } else if (todo.tags) {
        for (const tag of todo.tags) {
          if (typeof tag !== 'string') {
            validation.warnings.push(`${todoPrefix}: Tag should be a string, found ${typeof tag}`);
          }
        }
      }

      // Validate priority
      if (todo.priority && !['low', 'medium', 'high'].includes(todo.priority)) {
        validation.warnings.push(`${todoPrefix}: Invalid priority '${todo.priority}', should be low/medium/high`);
      }
    }
  }

  /**
   * Perform integrity checks on the state
   */
  async performIntegrityChecks(validation, todos) {
    try {
      // Check storage health
      const healthCheck = await this.todoCore.performHealthCheck();
      if (!healthCheck.healthy) {
        validation.errors.push(`Storage health check failed: ${healthCheck.message || 'Unknown error'}`);
        this.stateMetrics.integrityErrors++;
      }

      // Check for state consistency with autosave integration
      if (this.autoSaveIntegration) {
        const performanceSummary = this.autoSaveIntegration.getPerformanceSummary();
        if (performanceSummary && performanceSummary.failedSaves > 0) {
          validation.warnings.push(`Autosave has ${performanceSummary.failedSaves} failed saves`);
        }
      }

      // Check for memory leaks or excessive resource usage
      const memoryUsage = process.memoryUsage();
      if (memoryUsage.heapUsed / 1024 / 1024 > 100) { // > 100MB
        validation.warnings.push(`High memory usage detected: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`);
      }

    } catch (error) {
      validation.errors.push(`Integrity check failed: ${error.message}`);
      this.stateMetrics.integrityErrors++;
    }
  }

  /**
   * Start periodic sync monitoring
   */
  startSyncMonitoring() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = setInterval(() => {
      this.performSyncCheck();
    }, this.config.syncInterval);

    this.log('info', `StateIntegration: Started sync monitoring (interval: ${this.config.syncInterval}ms)`);
  }

  /**
   * Stop sync monitoring
   */
  stopSyncMonitoring() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      this.log('info', 'StateIntegration: Stopped sync monitoring');
    }
  }

  /**
   * Perform periodic sync check
   */
  async performSyncCheck() {
    this.log('debug', 'StateIntegration: Performing sync check');

    const validation = await this.validateState();

    if (!validation.success) {
      this.emit('sync-error', validation);
    }

    this.lastSyncTime = new Date().toISOString();
    this.emit('sync-complete', {
      timestamp: this.lastSyncTime,
      validation,
      metrics: this.getStateMetrics()
    });
  }

  /**
   * Record state change
   */
  recordStateChange(operation, details = {}) {
    if (!this.config.trackStateChanges) return;

    const stateChange = {
      timestamp: new Date().toISOString(),
      operation,
      details,
      metrics: { ...this.stateMetrics }
    };

    this.stateHistory.push(stateChange);

    // Limit history size
    if (this.stateHistory.length > this.config.maxStateHistory) {
      this.stateHistory.shift();
    }

    // Update metrics
    this.stateMetrics.totalOperations++;
    if (['list', 'get', 'search'].includes(operation)) {
      this.stateMetrics.readOperations++;
    } else {
      this.stateMetrics.writeOperations++;
    }

    this.emit('state-change', stateChange);
    this.log('debug', `StateIntegration: Recorded state change: ${operation}`, details);
  }

  /**
   * Get state metrics and statistics
   */
  getStateMetrics() {
    return {
      ...this.stateMetrics,
      stateHistorySize: this.stateHistory.length,
      lastSyncTime: this.lastSyncTime,
      syncMonitoringActive: this.syncTimer !== null,
      uptime: process.uptime(),
      memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) // MB
    };
  }

  /**
   * Get recent state history
   */
  getStateHistory(limit = 10) {
    return this.stateHistory.slice(-limit);
  }

  /**
   * Cleanup and shutdown
   */
  shutdown() {
    this.stopSyncMonitoring();
    this.removeAllListeners();
    this.log('info', 'StateIntegration: Shutdown complete');
  }
}

module.exports = { StateIntegration };