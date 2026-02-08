const fs = require('fs');
const path = require('path');

// Optional cron dependency - graceful fallback if not available
let cron;
try {
  cron = require('node-cron');
} catch (error) {
  // Mock cron for environments where node-cron is not available
  cron = {
    validate: (expression) => true, // Accept all expressions in mock mode
    schedule: (expression, task, options) => ({
      start: () => console.log(`Mock cron task started: ${expression}`),
      destroy: () => console.log(`Mock cron task stopped: ${expression}`),
      running: false
    })
  };
}

/**
 * Backup Scheduler for automated backup management
 * Handles scheduled backups, retention policies, and cleanup
 */
class BackupScheduler {
  constructor(config, recoveryManager) {
    this.config = config;
    this.recoveryManager = recoveryManager;
    this.scheduledTasks = new Map();
    this.retentionPolicies = new Map();
    this.isRunning = false;
  }

  /**
   * Start the backup scheduler
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️  Backup scheduler is already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Starting backup scheduler...');

    // Load saved schedules
    this.loadSchedules();

    // Schedule cleanup task (runs every hour)
    this.scheduleCleanup();

    console.log('✅ Backup scheduler started');
  }

  /**
   * Stop the backup scheduler
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️  Backup scheduler is not running');
      return;
    }

    console.log('🛑 Stopping backup scheduler...');

    // Stop all scheduled tasks
    for (const [name, task] of this.scheduledTasks) {
      task.destroy();
      console.log(`⏹️  Stopped scheduled backup: ${name}`);
    }

    this.scheduledTasks.clear();
    this.isRunning = false;

    console.log('✅ Backup scheduler stopped');
  }

  /**
   * Schedule a backup with cron expression
   */
  scheduleBackup(name, cronExpression, options = {}) {
    try {
      // Validate cron expression
      if (!cron.validate(cronExpression)) {
        return {
          success: false,
          error: `Invalid cron expression: ${cronExpression}`
        };
      }

      // Stop existing schedule if it exists
      if (this.scheduledTasks.has(name)) {
        this.scheduledTasks.get(name).destroy();
      }

      // Create the scheduled task
      const task = cron.schedule(cronExpression, async () => {
        await this.executeScheduledBackup(name, options);
      }, {
        scheduled: false,
        timezone: options.timezone || 'America/New_York'
      });

      // Start the task
      task.start();

      // Store the task
      this.scheduledTasks.set(name, task);

      // Save schedule configuration
      this.saveSchedule(name, cronExpression, options);

      return {
        success: true,
        scheduleName: name,
        cronExpression,
        nextRun: this.getNextRunTime(cronExpression),
        message: `Scheduled backup '${name}' created successfully`
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to schedule backup: ${error.message}`
      };
    }
  }

  /**
   * Execute a scheduled backup
   */
  async executeScheduledBackup(scheduleName, options) {
    try {
      console.log(`🔄 Executing scheduled backup: ${scheduleName}`);

      // Load current todos
      const todos = await this.loadCurrentTodos();
      if (!todos) {
        console.error(`❌ Failed to load todos for scheduled backup: ${scheduleName}`);
        return;
      }

      // Create backup with scheduled prefix
      const reason = `scheduled-${scheduleName}`;
      const result = await this.recoveryManager.createManualBackup(todos, reason);

      if (result.success) {
        console.log(`✅ Scheduled backup completed: ${scheduleName}`);
        console.log(`📁 Backup location: ${result.filename}`);

        // Apply retention policy
        await this.applyRetentionPolicy(scheduleName);

        // Log backup statistics
        this.logBackupStats(scheduleName, result);
      } else {
        console.error(`❌ Scheduled backup failed: ${scheduleName} - ${result.error}`);
      }

    } catch (error) {
      console.error(`❌ Error executing scheduled backup: ${scheduleName} - ${error.message}`);
    }
  }

  /**
   * Set retention policy for a backup schedule
   */
  setRetentionPolicy(scheduleName, policy) {
    const validatedPolicy = this.validateRetentionPolicy(policy);
    if (!validatedPolicy.valid) {
      return {
        success: false,
        error: validatedPolicy.error
      };
    }

    this.retentionPolicies.set(scheduleName, policy);
    this.saveRetentionPolicies();

    return {
      success: true,
      scheduleName,
      policy,
      message: `Retention policy set for ${scheduleName}`
    };
  }

  /**
   * Apply retention policy to clean up old backups
   */
  async applyRetentionPolicy(scheduleName) {
    const policy = this.retentionPolicies.get(scheduleName);
    if (!policy) {
      return; // No retention policy set
    }

    try {
      const backupPattern = `scheduled-${scheduleName}`;
      const backups = this.getBackupsByPattern(backupPattern);

      // Sort backups by date (newest first)
      backups.sort((a, b) => b.mtime - a.mtime);

      // Apply retention rules
      const toDelete = this.calculateBackupsToDelete(backups, policy);

      for (const backup of toDelete) {
        try {
          fs.unlinkSync(backup.path);
          console.log(`🗑️  Deleted old backup: ${backup.filename} (retention policy)`);
        } catch (error) {
          console.error(`⚠️  Failed to delete backup: ${backup.filename} - ${error.message}`);
        }
      }

      if (toDelete.length > 0) {
        console.log(`🧹 Retention policy applied: ${toDelete.length} old backups cleaned up`);
      }

    } catch (error) {
      console.error(`⚠️  Error applying retention policy for ${scheduleName}: ${error.message}`);
    }
  }

  /**
   * Calculate which backups to delete based on retention policy
   */
  calculateBackupsToDelete(backups, policy) {
    const toDelete = [];
    const now = new Date();

    // Keep backups based on count
    if (policy.keepCount && backups.length > policy.keepCount) {
      toDelete.push(...backups.slice(policy.keepCount));
    }

    // Keep backups based on age
    if (policy.keepDays) {
      const cutoffDate = new Date(now.getTime() - (policy.keepDays * 24 * 60 * 60 * 1000));
      for (const backup of backups) {
        if (backup.mtime < cutoffDate && !toDelete.includes(backup)) {
          toDelete.push(backup);
        }
      }
    }

    return toDelete;
  }

  /**
   * Get backups matching a pattern
   */
  getBackupsByPattern(pattern) {
    const dataDir = this.config.options.dataDir;
    const backups = [];

    try {
      const files = fs.readdirSync(dataDir);

      for (const file of files) {
        if (file.includes('backup') && file.includes(pattern)) {
          const filePath = path.join(dataDir, file);
          const stats = fs.statSync(filePath);

          backups.push({
            filename: file,
            path: filePath,
            mtime: stats.mtime,
            size: stats.size
          });
        }
      }
    } catch (error) {
      console.error(`Error reading backup directory: ${error.message}`);
    }

    return backups;
  }

  /**
   * Validate retention policy
   */
  validateRetentionPolicy(policy) {
    if (!policy || typeof policy !== 'object') {
      return { valid: false, error: 'Policy must be an object' };
    }

    if (policy.keepCount && (typeof policy.keepCount !== 'number' || policy.keepCount <= 0)) {
      return { valid: false, error: 'keepCount must be a positive number' };
    }

    if (policy.keepDays && (typeof policy.keepDays !== 'number' || policy.keepDays <= 0)) {
      return { valid: false, error: 'keepDays must be a positive number' };
    }

    if (!policy.keepCount && !policy.keepDays) {
      return { valid: false, error: 'Policy must specify keepCount or keepDays' };
    }

    return { valid: true };
  }

  /**
   * Schedule cleanup task for general backup maintenance
   */
  scheduleCleanup() {
    const cleanupTask = cron.schedule('0 * * * *', async () => {
      await this.performMaintenanceCleanup();
    }, {
      scheduled: false
    });

    cleanupTask.start();
    this.scheduledTasks.set('__maintenance__', cleanupTask);
  }

  /**
   * Perform general maintenance cleanup
   */
  async performMaintenanceCleanup() {
    try {
      console.log('🧹 Performing maintenance cleanup...');

      // Clean up temporary files
      await this.cleanupTemporaryFiles();

      // Clean up orphaned backup files
      await this.cleanupOrphanedBackups();

      // Generate backup report
      const report = await this.generateBackupReport();

      console.log('✅ Maintenance cleanup completed');
      console.log(`📊 Backup report: ${report.totalBackups} backups, ${this.formatBytes(report.totalSize)} total size`);

    } catch (error) {
      console.error(`⚠️  Error during maintenance cleanup: ${error.message}`);
    }
  }

  /**
   * Clean up temporary files
   */
  async cleanupTemporaryFiles() {
    const dataDir = this.config.options.dataDir;
    const tempFiles = [];

    try {
      const files = fs.readdirSync(dataDir);

      for (const file of files) {
        if (file.endsWith('.tmp') || file.includes('temp-')) {
          const filePath = path.join(dataDir, file);
          const stats = fs.statSync(filePath);

          // Delete temp files older than 1 hour
          if (Date.now() - stats.mtime.getTime() > 60 * 60 * 1000) {
            tempFiles.push(filePath);
          }
        }
      }

      for (const tempFile of tempFiles) {
        try {
          fs.unlinkSync(tempFile);
          console.log(`🗑️  Cleaned up temp file: ${path.basename(tempFile)}`);
        } catch (error) {
          console.error(`⚠️  Failed to delete temp file: ${error.message}`);
        }
      }

    } catch (error) {
      console.error(`Error during temp file cleanup: ${error.message}`);
    }
  }

  /**
   * Clean up orphaned backup files
   */
  async cleanupOrphanedBackups() {
    // Clean up backups that don't have valid schedule names
    const dataDir = this.config.options.dataDir;
    const orphanedBackups = [];

    try {
      const files = fs.readdirSync(dataDir);

      for (const file of files) {
        if (file.includes('backup') && file.startsWith('scheduled-')) {
          const scheduleName = this.extractScheduleNameFromBackup(file);
          if (scheduleName && !this.scheduledTasks.has(scheduleName)) {
            // This backup belongs to a schedule that no longer exists
            const filePath = path.join(dataDir, file);
            const stats = fs.statSync(filePath);

            // Delete orphaned backups older than 7 days
            if (Date.now() - stats.mtime.getTime() > 7 * 24 * 60 * 60 * 1000) {
              orphanedBackups.push(filePath);
            }
          }
        }
      }

      for (const backup of orphanedBackups) {
        try {
          fs.unlinkSync(backup);
          console.log(`🗑️  Cleaned up orphaned backup: ${path.basename(backup)}`);
        } catch (error) {
          console.error(`⚠️  Failed to delete orphaned backup: ${error.message}`);
        }
      }

    } catch (error) {
      console.error(`Error during orphaned backup cleanup: ${error.message}`);
    }
  }

  /**
   * Extract schedule name from backup filename
   */
  extractScheduleNameFromBackup(filename) {
    const match = filename.match(/scheduled-([^-]+)/);
    return match ? match[1] : null;
  }

  /**
   * Generate backup report
   */
  async generateBackupReport() {
    const dataDir = this.config.options.dataDir;
    const report = {
      totalBackups: 0,
      totalSize: 0,
      byType: {
        manual: 0,
        automatic: 0,
        scheduled: 0,
        migration: 0
      },
      bySchedule: {}
    };

    try {
      const files = fs.readdirSync(dataDir);

      for (const file of files) {
        if (file.includes('backup') || file.includes('export')) {
          const filePath = path.join(dataDir, file);
          const stats = fs.statSync(filePath);

          report.totalBackups++;
          report.totalSize += stats.size;

          // Categorize backup type
          if (file.includes('manual-backup')) {
            report.byType.manual++;
          } else if (file.includes('migration-backup')) {
            report.byType.migration++;
          } else if (file.includes('scheduled-')) {
            report.byType.scheduled++;
            const scheduleName = this.extractScheduleNameFromBackup(file);
            if (scheduleName) {
              report.bySchedule[scheduleName] = (report.bySchedule[scheduleName] || 0) + 1;
            }
          } else {
            report.byType.automatic++;
          }
        }
      }

    } catch (error) {
      console.error(`Error generating backup report: ${error.message}`);
    }

    return report;
  }

  /**
   * Get next run time for cron expression
   */
  getNextRunTime(cronExpression) {
    try {
      // This is a simplified implementation
      // In a real implementation, you'd use a proper cron parser
      return new Date(Date.now() + 60 * 60 * 1000); // Placeholder: 1 hour from now
    } catch (error) {
      return null;
    }
  }

  /**
   * Load current todos
   */
  async loadCurrentTodos() {
    try {
      // This would integrate with the main todo core
      // For now, return a placeholder
      return [];
    } catch (error) {
      console.error(`Error loading current todos: ${error.message}`);
      return null;
    }
  }

  /**
   * Format bytes to human readable format
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Save schedule configuration
   */
  saveSchedule(name, cronExpression, options) {
    const schedulesFile = path.join(this.config.options.dataDir, 'backup-schedules.json');
    let schedules = {};

    try {
      if (fs.existsSync(schedulesFile)) {
        schedules = JSON.parse(fs.readFileSync(schedulesFile, 'utf8'));
      }
    } catch (error) {
      console.error(`Error loading schedules: ${error.message}`);
    }

    schedules[name] = {
      cronExpression,
      options,
      createdAt: new Date().toISOString()
    };

    try {
      fs.writeFileSync(schedulesFile, JSON.stringify(schedules, null, 2));
    } catch (error) {
      console.error(`Error saving schedules: ${error.message}`);
    }
  }

  /**
   * Load saved schedules
   */
  loadSchedules() {
    const schedulesFile = path.join(this.config.options.dataDir, 'backup-schedules.json');

    try {
      if (fs.existsSync(schedulesFile)) {
        const schedules = JSON.parse(fs.readFileSync(schedulesFile, 'utf8'));

        for (const [name, schedule] of Object.entries(schedules)) {
          this.scheduleBackup(name, schedule.cronExpression, schedule.options);
        }

        console.log(`📅 Loaded ${Object.keys(schedules).length} backup schedules`);
      }
    } catch (error) {
      console.error(`Error loading schedules: ${error.message}`);
    }
  }

  /**
   * Save retention policies
   */
  saveRetentionPolicies() {
    const policiesFile = path.join(this.config.options.dataDir, 'retention-policies.json');
    const policies = Object.fromEntries(this.retentionPolicies);

    try {
      fs.writeFileSync(policiesFile, JSON.stringify(policies, null, 2));
    } catch (error) {
      console.error(`Error saving retention policies: ${error.message}`);
    }
  }

  /**
   * Log backup statistics
   */
  logBackupStats(scheduleName, result) {
    const statsFile = path.join(this.config.options.dataDir, 'backup-stats.json');
    let stats = {};

    try {
      if (fs.existsSync(statsFile)) {
        stats = JSON.parse(fs.readFileSync(statsFile, 'utf8'));
      }
    } catch (error) {
      console.error(`Error loading backup stats: ${error.message}`);
    }

    if (!stats[scheduleName]) {
      stats[scheduleName] = {
        totalBackups: 0,
        lastBackup: null,
        totalSize: 0
      };
    }

    stats[scheduleName].totalBackups++;
    stats[scheduleName].lastBackup = new Date().toISOString();
    stats[scheduleName].totalSize += result.fileSize || 0;

    try {
      fs.writeFileSync(statsFile, JSON.stringify(stats, null, 2));
    } catch (error) {
      console.error(`Error saving backup stats: ${error.message}`);
    }
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeSchedules: Array.from(this.scheduledTasks.keys()).filter(name => name !== '__maintenance__'),
      retentionPolicies: Array.from(this.retentionPolicies.keys()),
      nextMaintenanceRun: new Date(Date.now() + 60 * 60 * 1000) // Placeholder
    };
  }

  /**
   * List all scheduled backups
   */
  listSchedules() {
    const schedules = [];

    for (const [name, task] of this.scheduledTasks) {
      if (name !== '__maintenance__') {
        schedules.push({
          name,
          isRunning: task.running || false,
          retentionPolicy: this.retentionPolicies.get(name)
        });
      }
    }

    return schedules;
  }

  /**
   * Remove a scheduled backup
   */
  removeSchedule(name) {
    if (!this.scheduledTasks.has(name)) {
      return {
        success: false,
        error: `Schedule '${name}' not found`
      };
    }

    // Stop and remove the task
    this.scheduledTasks.get(name).destroy();
    this.scheduledTasks.delete(name);

    // Remove retention policy
    this.retentionPolicies.delete(name);

    // Remove from saved schedules
    this.removeFromSavedSchedules(name);

    return {
      success: true,
      message: `Schedule '${name}' removed successfully`
    };
  }

  /**
   * Remove from saved schedules
   */
  removeFromSavedSchedules(name) {
    const schedulesFile = path.join(this.config.options.dataDir, 'backup-schedules.json');

    try {
      if (fs.existsSync(schedulesFile)) {
        const schedules = JSON.parse(fs.readFileSync(schedulesFile, 'utf8'));
        delete schedules[name];
        fs.writeFileSync(schedulesFile, JSON.stringify(schedules, null, 2));
      }
    } catch (error) {
      console.error(`Error removing schedule: ${error.message}`);
    }
  }
}

module.exports = { BackupScheduler };