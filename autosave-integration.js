const { AutoSaveConfig } = require('./autosave-config');

/**
 * Enhanced auto-save integration layer
 * Provides detailed feedback, performance monitoring, and user control
 */
class AutoSaveIntegration {
  constructor(todoCore, config = null) {
    this.todoCore = todoCore;
    this.config = config || new AutoSaveConfig();
    this.performanceStats = {
      totalSaves: 0,
      totalDuration: 0,
      fastestSave: null,
      slowestSave: null,
      failedSaves: 0,
      retriesUsed: 0,
    };
  }

  // Enhanced feedback for auto-save operations
  formatAutoSaveMessage(operation, result) {
    const messages = [];

    if (!this.config.shouldShowProgress()) {
      return [];
    }

    if (result.success) {
      // Success message
      if (this.config.shouldShowSuccessDetails()) {
        messages.push(`💾 Auto-save: ${operation} completed successfully`);
      }

      // Storage information
      if (result.storage && result.storage.saved) {
        let storageMsg = `📁 Saved ${result.storage.count} todo${result.storage.count === 1 ? '' : 's'}`;

        // Add timing information if enabled
        if (this.config.shouldShowTiming() && result.storage.duration) {
          const level = this.config.getPerformanceLevel(result.storage.duration);
          const emoji = this.getPerformanceEmoji(level);
          storageMsg += ` ${emoji} ${result.storage.duration}ms`;
        }

        // Add attempt information if retries were used
        if (this.config.shouldShowRetryInfo() && result.storage.attempt > 1) {
          storageMsg += ` (attempt ${result.storage.attempt})`;
        }

        messages.push(storageMsg);
      }

      // Backup information
      if (this.config.shouldShowBackupInfo() && result.storage?.backupCreated) {
        messages.push(`🔄 Backup created before save`);
      }

      // Verbose logging
      if (this.config.shouldShowVerbose()) {
        messages.push(`🔧 Storage location: ${result.storage?.location || 'unknown'}`);
      }

    } else {
      // Error message
      messages.push(`❌ Auto-save failed: ${result.error}`);

      if (result.storage && !result.storage.saved) {
        messages.push('⚠️  Warning: Changes were not persisted to storage');

        if (this.config.shouldShowRetryInfo() && result.storage.attempts) {
          messages.push(`🔁 Failed after ${result.storage.attempts} attempt${result.storage.attempts === 1 ? '' : 's'}`);
        }
      }
    }

    return messages;
  }

  // Get performance emoji based on save time
  getPerformanceEmoji(level) {
    switch (level) {
      case 'critical': return '🐌';
      case 'slow': return '⚠️';
      case 'warning': return '⏰';
      case 'normal': return '⚡';
      default: return '📊';
    }
  }

  // Update performance statistics
  updatePerformanceStats(result) {
    if (!this.config.shouldTrackPerformance() || !result.storage) {
      return;
    }

    this.performanceStats.totalSaves++;

    if (result.success && result.storage.duration) {
      this.performanceStats.totalDuration += result.storage.duration;

      if (this.performanceStats.fastestSave === null || result.storage.duration < this.performanceStats.fastestSave) {
        this.performanceStats.fastestSave = result.storage.duration;
      }

      if (this.performanceStats.slowestSave === null || result.storage.duration > this.performanceStats.slowestSave) {
        this.performanceStats.slowestSave = result.storage.duration;
      }
    }

    if (!result.success) {
      this.performanceStats.failedSaves++;
    }

    if (result.storage.attempt && result.storage.attempt > 1) {
      this.performanceStats.retriesUsed += (result.storage.attempt - 1);
    }
  }

  // Get auto-save performance summary
  getPerformanceSummary() {
    if (!this.config.shouldTrackPerformance() || this.performanceStats.totalSaves === 0) {
      return null;
    }

    const stats = this.performanceStats;
    const avgDuration = stats.totalDuration / Math.max(stats.totalSaves - stats.failedSaves, 1);

    return {
      totalOperations: stats.totalSaves,
      successfulSaves: stats.totalSaves - stats.failedSaves,
      failedSaves: stats.failedSaves,
      averageDuration: Math.round(avgDuration),
      fastestSave: stats.fastestSave,
      slowestSave: stats.slowestSave,
      totalRetries: stats.retriesUsed,
      successRate: ((stats.totalSaves - stats.failedSaves) / stats.totalSaves * 100).toFixed(1),
    };
  }

  // Enhanced add todo with auto-save integration
  addTodo(description, options = {}) {
    if (!this.config.isEnabled()) {
      return this.todoCore.addTodo(description, options);
    }

    const result = this.todoCore.addTodo(description, options);

    // Update performance stats
    this.updatePerformanceStats(result);

    // Generate auto-save messages
    const messages = this.formatAutoSaveMessage('Add todo', result);

    // Add messages to result
    return {
      ...result,
      autoSaveMessages: messages,
      performanceLevel: result.storage?.duration ?
        this.config.getPerformanceLevel(result.storage.duration) : null,
    };
  }

  // Enhanced complete todo with auto-save integration
  completeTodo(id) {
    if (!this.config.isEnabled()) {
      return this.todoCore.completeTodo(id);
    }

    const result = this.todoCore.completeTodo(id);

    // Update performance stats
    this.updatePerformanceStats(result);

    // Generate auto-save messages
    const messages = this.formatAutoSaveMessage('Complete todo', result);

    return {
      ...result,
      autoSaveMessages: messages,
      performanceLevel: result.storage?.duration ?
        this.config.getPerformanceLevel(result.storage.duration) : null,
    };
  }

  // Enhanced delete todo with auto-save integration
  deleteTodo(id) {
    if (!this.config.isEnabled()) {
      return this.todoCore.deleteTodo(id);
    }

    const result = this.todoCore.deleteTodo(id);

    // Update performance stats
    this.updatePerformanceStats(result);

    // Generate auto-save messages
    const messages = this.formatAutoSaveMessage('Delete todo', result);

    return {
      ...result,
      autoSaveMessages: messages,
      performanceLevel: result.storage?.duration ?
        this.config.getPerformanceLevel(result.storage.duration) : null,
    };
  }

  // Enhanced update todo with auto-save integration
  updateTodo(id, updates) {
    if (!this.config.isEnabled()) {
      return this.todoCore.updateTodo(id, updates);
    }

    const result = this.todoCore.updateTodo(id, updates);

    // Update performance stats
    this.updatePerformanceStats(result);

    // Generate auto-save messages
    const messages = this.formatAutoSaveMessage('Update todo', result);

    return {
      ...result,
      autoSaveMessages: messages,
      performanceLevel: result.storage?.duration ?
        this.config.getPerformanceLevel(result.storage.duration) : null,
    };
  }

  // Pass-through methods for non-modifying operations
  listTodos() {
    return this.todoCore.listTodos();
  }

  getTodoById(id) {
    return this.todoCore.getTodoById(id);
  }

  listTodosByPriority(priority) {
    return this.todoCore.listTodosByPriority(priority);
  }

  listTodosByTag(tag) {
    return this.todoCore.listTodosByTag(tag);
  }

  getOverdueTodos() {
    return this.todoCore.getOverdueTodos();
  }

  getDueTodosToday() {
    return this.todoCore.getDueTodosToday();
  }

  getAllTags() {
    return this.todoCore.getAllTags();
  }

  getStorageStats() {
    return this.todoCore.getStorageStats();
  }

  // Health check functionality
  performHealthCheck() {
    if (!this.config.shouldMonitorHealth()) {
      return null;
    }

    const storageStats = this.todoCore.getStorageStats();
    const performanceStats = this.getPerformanceSummary();

    return {
      timestamp: new Date().toISOString(),
      storage: {
        healthy: storageStats.storageHealth === 'healthy',
        todoCount: storageStats.todoCount,
        fileExists: storageStats.fileExists,
        backupExists: storageStats.backupExists,
        fileSize: storageStats.fileSize,
      },
      performance: performanceStats,
      autoSave: {
        enabled: this.config.isEnabled(),
        showProgress: this.config.shouldShowProgress(),
        trackingPerformance: this.config.shouldTrackPerformance(),
      },
    };
  }

  // Update configuration
  updateConfig(newConfig) {
    if (newConfig instanceof AutoSaveConfig) {
      this.config = newConfig;
    } else {
      this.config = new AutoSaveConfig(newConfig);
    }
  }

  // Get current configuration
  getConfig() {
    return this.config;
  }
}

module.exports = { AutoSaveIntegration };