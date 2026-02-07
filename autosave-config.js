const path = require('path');
const os = require('os');

/**
 * Auto-save configuration for the todo application
 */
class AutoSaveConfig {
  constructor(options = {}) {
    this.options = {
      // Auto-save behavior
      enabled: options.enabled !== false, // Default enabled
      showProgress: options.showProgress !== false, // Default show progress
      showTiming: options.showTiming !== false, // Default show timing
      verboseLogging: options.verboseLogging || false, // Default quiet

      // Performance monitoring
      trackPerformance: options.trackPerformance !== false, // Default enabled
      performanceThresholds: options.performanceThresholds || {
        slow: options.slowThreshold || 1000, // 1s is considered slow
        warning: options.warningThreshold || 500, // 500ms warning
        critical: options.criticalThreshold || 2000, // 2s is critical
      },

      // Auto-save frequency options
      batchOperations: options.batchOperations || false, // Default immediate
      batchTimeout: options.batchTimeout || 5000, // 5s batch window

      // User feedback options
      showBackupInfo: options.showBackupInfo !== false, // Default show backup info
      showRetryInfo: options.showRetryInfo !== false, // Default show retry info
      showSuccessDetails: options.showSuccessDetails !== false, // Default show details

      // Auto-save health monitoring
      monitorHealth: options.monitorHealth !== false, // Default enabled
      healthCheckInterval: options.healthCheckInterval || 30000, // 30s health checks
    };
  }

  // Check if auto-save is enabled
  isEnabled() {
    return this.options.enabled;
  }

  // Check if we should show progress feedback
  shouldShowProgress() {
    return this.options.enabled && this.options.showProgress;
  }

  // Check if we should show timing information
  shouldShowTiming() {
    return this.options.enabled && this.options.showTiming;
  }

  // Check if we should show verbose logging
  shouldShowVerbose() {
    return this.options.enabled && this.options.verboseLogging;
  }

  // Check if we should track performance
  shouldTrackPerformance() {
    return this.options.enabled && this.options.trackPerformance;
  }

  // Get performance threshold for a given level
  getPerformanceThreshold(level) {
    return this.options.performanceThresholds[level] || 1000;
  }

  // Determine performance level based on duration
  getPerformanceLevel(duration) {
    if (duration >= this.options.performanceThresholds.critical) {
      return 'critical';
    } else if (duration >= this.options.performanceThresholds.slow) {
      return 'slow';
    } else if (duration >= this.options.performanceThresholds.warning) {
      return 'warning';
    }
    return 'normal';
  }

  // Check if we should show backup information
  shouldShowBackupInfo() {
    return this.options.enabled && this.options.showBackupInfo;
  }

  // Check if we should show retry information
  shouldShowRetryInfo() {
    return this.options.enabled && this.options.showRetryInfo;
  }

  // Check if we should show success details
  shouldShowSuccessDetails() {
    return this.options.enabled && this.options.showSuccessDetails;
  }

  // Check if we should monitor health
  shouldMonitorHealth() {
    return this.options.enabled && this.options.monitorHealth;
  }

  // Get health check interval
  getHealthCheckInterval() {
    return this.options.healthCheckInterval;
  }

  // Create a copy of the configuration
  clone() {
    return new AutoSaveConfig(JSON.parse(JSON.stringify(this.options)));
  }

  // Merge with another configuration
  merge(other) {
    const mergedOptions = { ...this.options, ...other };
    return new AutoSaveConfig(mergedOptions);
  }

  // Export configuration as JSON
  toJSON() {
    return JSON.stringify(this.options, null, 2);
  }

  // Create configuration from environment variables
  static fromEnvironment() {
    const options = {};

    if (process.env.TODO_AUTOSAVE_ENABLED !== undefined) {
      options.enabled = process.env.TODO_AUTOSAVE_ENABLED === 'true';
    }

    if (process.env.TODO_AUTOSAVE_SHOW_PROGRESS !== undefined) {
      options.showProgress = process.env.TODO_AUTOSAVE_SHOW_PROGRESS === 'true';
    }

    if (process.env.TODO_AUTOSAVE_SHOW_TIMING !== undefined) {
      options.showTiming = process.env.TODO_AUTOSAVE_SHOW_TIMING === 'true';
    }

    if (process.env.TODO_AUTOSAVE_VERBOSE !== undefined) {
      options.verboseLogging = process.env.TODO_AUTOSAVE_VERBOSE === 'true';
    }

    if (process.env.TODO_AUTOSAVE_SLOW_THRESHOLD) {
      options.slowThreshold = parseInt(process.env.TODO_AUTOSAVE_SLOW_THRESHOLD, 10);
    }

    if (process.env.TODO_AUTOSAVE_WARNING_THRESHOLD) {
      options.warningThreshold = parseInt(process.env.TODO_AUTOSAVE_WARNING_THRESHOLD, 10);
    }

    return new AutoSaveConfig(options);
  }

  // Create development configuration
  static development() {
    return new AutoSaveConfig({
      enabled: true,
      showProgress: true,
      showTiming: true,
      verboseLogging: true,
      trackPerformance: true,
      showBackupInfo: true,
      showRetryInfo: true,
      showSuccessDetails: true,
      monitorHealth: true,
      performanceThresholds: {
        slow: 500,
        warning: 200,
        critical: 1000,
      },
    });
  }

  // Create production configuration
  static production() {
    return new AutoSaveConfig({
      enabled: true,
      showProgress: true,
      showTiming: false,
      verboseLogging: false,
      trackPerformance: true,
      showBackupInfo: false,
      showRetryInfo: true,
      showSuccessDetails: false,
      monitorHealth: true,
      performanceThresholds: {
        slow: 2000,
        warning: 1000,
        critical: 5000,
      },
    });
  }

  // Create minimal configuration (quiet mode)
  static minimal() {
    return new AutoSaveConfig({
      enabled: true,
      showProgress: false,
      showTiming: false,
      verboseLogging: false,
      trackPerformance: false,
      showBackupInfo: false,
      showRetryInfo: false,
      showSuccessDetails: false,
      monitorHealth: false,
    });
  }
}

module.exports = { AutoSaveConfig };