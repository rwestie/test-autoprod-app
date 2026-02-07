const fs = require('fs');
const path = require('path');

/**
 * Migration Manager for handling data format upgrades and migrations
 */
class MigrationManager {
  constructor(config) {
    this.config = config;
    this.migrations = new Map();
    this.currentVersion = '1.3.0'; // Current data schema version

    // Register built-in migrations
    this.registerMigrations();
  }

  /**
   * Register all available migrations
   */
  registerMigrations() {
    // Migration from v1.0.0 to v1.1.0: Add priority and tags
    this.addMigration('1.0.0', '1.1.0', (data) => {
      return data.map(todo => ({
        ...todo,
        priority: todo.priority || 'medium',
        tags: todo.tags || []
      }));
    });

    // Migration from v1.1.0 to v1.2.0: Add createdAt timestamp
    this.addMigration('1.1.0', '1.2.0', (data) => {
      return data.map(todo => ({
        ...todo,
        createdAt: todo.createdAt || new Date().toISOString()
      }));
    });

    // Migration from v1.2.0 to v1.3.0: Ensure data structure consistency
    this.addMigration('1.2.0', '1.3.0', (data) => {
      // For v1.3.0, we keep the array format but ensure data consistency
      // The metadata is stored separately in migration backups
      return data.map(todo => ({
        ...todo,
        // Ensure all fields are properly structured
        id: typeof todo.id === 'number' ? todo.id : parseInt(todo.id),
        description: String(todo.description).trim(),
        completed: Boolean(todo.completed),
        priority: ['low', 'medium', 'high'].includes(todo.priority) ? todo.priority : 'medium',
        tags: Array.isArray(todo.tags) ? todo.tags : [],
        createdAt: todo.createdAt || new Date().toISOString(),
        ...(todo.dueDate && { dueDate: todo.dueDate }),
        ...(todo.completedAt && { completedAt: todo.completedAt })
      }));
    });
  }

  /**
   * Add a new migration
   */
  addMigration(fromVersion, toVersion, migrationFunction) {
    const key = `${fromVersion}->${toVersion}`;
    this.migrations.set(key, {
      from: fromVersion,
      to: toVersion,
      migrate: migrationFunction,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Detect the version of the data
   */
  detectVersion(data) {
    // New format with version metadata
    if (data && typeof data === 'object' && data.version) {
      return data.version;
    }

    // Array format (legacy)
    if (Array.isArray(data)) {
      if (data.length === 0) {
        return this.currentVersion; // Empty data, use current version
      }

      const sampleTodo = data[0];

      // Check for v1.3.0+ features (all fields properly structured)
      if (sampleTodo.createdAt && sampleTodo.priority && Array.isArray(sampleTodo.tags)) {
        return '1.3.0';
      }

      // Check for v1.2.0+ features (createdAt)
      if (sampleTodo.createdAt) {
        return '1.2.0';
      }

      // Check for v1.1.0+ features (priority, tags)
      if (sampleTodo.priority || sampleTodo.tags) {
        return '1.1.0';
      }

      // Original format (v1.0.0)
      return '1.0.0';
    }

    // Unknown format, assume current version
    return this.currentVersion;
  }

  /**
   * Get migration path from one version to another
   */
  getMigrationPath(fromVersion, toVersion) {
    const path = [];
    let current = fromVersion;

    // Simple linear migration path
    const versions = ['1.0.0', '1.1.0', '1.2.0', '1.3.0'];
    const fromIndex = versions.indexOf(fromVersion);
    const toIndex = versions.indexOf(toVersion);

    if (fromIndex === -1 || toIndex === -1) {
      throw new Error(`Invalid version range: ${fromVersion} -> ${toVersion}`);
    }

    if (fromIndex >= toIndex) {
      return path; // No migration needed or downgrade not supported
    }

    for (let i = fromIndex; i < toIndex; i++) {
      const migrationKey = `${versions[i]}->${versions[i + 1]}`;
      if (this.migrations.has(migrationKey)) {
        path.push(this.migrations.get(migrationKey));
      }
    }

    return path;
  }

  /**
   * Execute migrations to upgrade data
   */
  async migrateData(data, targetVersion = null) {
    targetVersion = targetVersion || this.currentVersion;

    try {
      const currentVersion = this.detectVersion(data);
      this.log('info', `Detected data version: ${currentVersion}, target: ${targetVersion}`);

      if (currentVersion === targetVersion) {
        return {
          success: true,
          data: data,
          migrations: [],
          message: 'No migration needed'
        };
      }

      const migrationPath = this.getMigrationPath(currentVersion, targetVersion);

      if (migrationPath.length === 0) {
        return {
          success: false,
          error: `No migration path found from ${currentVersion} to ${targetVersion}`
        };
      }

      let migrationData = this.extractTodoData(data);
      const appliedMigrations = [];

      // Apply each migration in sequence
      for (const migration of migrationPath) {
        this.log('info', `Applying migration: ${migration.from} -> ${migration.to}`);

        try {
          migrationData = migration.migrate(migrationData);
          appliedMigrations.push({
            from: migration.from,
            to: migration.to,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          return {
            success: false,
            error: `Migration failed (${migration.from} -> ${migration.to}): ${error.message}`,
            partialMigrations: appliedMigrations
          };
        }
      }

      return {
        success: true,
        data: migrationData,
        migrations: appliedMigrations,
        originalVersion: currentVersion,
        newVersion: targetVersion,
        message: `Successfully migrated from ${currentVersion} to ${targetVersion}`
      };

    } catch (error) {
      return {
        success: false,
        error: `Migration error: ${error.message}`
      };
    }
  }

  /**
   * Extract todo data from various formats
   */
  extractTodoData(data) {
    if (Array.isArray(data)) {
      return data;
    }

    if (data && typeof data === 'object' && Array.isArray(data.todos)) {
      return data.todos;
    }

    return [];
  }

  /**
   * Create a migration backup
   */
  async createMigrationBackup(originalData, migrationInfo) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFilename = `migration-backup-${timestamp}.json`;
      const backupPath = path.join(this.config.options.dataDir, backupFilename);

      const backupData = {
        timestamp,
        originalVersion: migrationInfo.originalVersion,
        targetVersion: migrationInfo.newVersion,
        migrations: migrationInfo.migrations,
        data: originalData
      };

      fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));

      return {
        success: true,
        backupPath,
        timestamp
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to create migration backup: ${error.message}`
      };
    }
  }

  /**
   * Restore from migration backup
   */
  async restoreFromMigrationBackup(backupPath) {
    try {
      if (!fs.existsSync(backupPath)) {
        return {
          success: false,
          error: 'Backup file not found'
        };
      }

      const backupContent = fs.readFileSync(backupPath, 'utf8');
      const backupData = JSON.parse(backupContent);

      return {
        success: true,
        data: backupData.data,
        metadata: {
          originalVersion: backupData.originalVersion,
          timestamp: backupData.timestamp,
          migrations: backupData.migrations
        }
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to restore from backup: ${error.message}`
      };
    }
  }

  /**
   * Get available migration backups
   */
  getAvailableMigrationBackups() {
    try {
      if (!fs.existsSync(this.config.options.dataDir)) {
        return [];
      }

      const files = fs.readdirSync(this.config.options.dataDir);
      const backupFiles = files
        .filter(file => file.startsWith('migration-backup-') && file.endsWith('.json'))
        .map(file => {
          const filePath = path.join(this.config.options.dataDir, file);
          const stats = fs.statSync(filePath);

          try {
            const content = fs.readFileSync(filePath, 'utf8');
            const data = JSON.parse(content);

            return {
              filename: file,
              path: filePath,
              timestamp: data.timestamp,
              originalVersion: data.originalVersion,
              targetVersion: data.targetVersion,
              size: stats.size,
              created: stats.ctime
            };
          } catch {
            return null; // Invalid backup file
          }
        })
        .filter(backup => backup !== null)
        .sort((a, b) => new Date(b.created) - new Date(a.created));

      return backupFiles;

    } catch (error) {
      this.log('error', `Error listing migration backups: ${error.message}`);
      return [];
    }
  }

  /**
   * Cleanup old migration backups
   */
  async cleanupMigrationBackups(keepCount = 5) {
    try {
      const backups = this.getAvailableMigrationBackups();

      if (backups.length <= keepCount) {
        return {
          success: true,
          message: `No cleanup needed (${backups.length} backups found)`
        };
      }

      const toDelete = backups.slice(keepCount);
      let deletedCount = 0;

      for (const backup of toDelete) {
        try {
          fs.unlinkSync(backup.path);
          deletedCount++;
        } catch (error) {
          this.log('warn', `Failed to delete backup ${backup.filename}: ${error.message}`);
        }
      }

      return {
        success: true,
        deletedCount,
        remainingCount: backups.length - deletedCount,
        message: `Cleaned up ${deletedCount} migration backup(s)`
      };

    } catch (error) {
      return {
        success: false,
        error: `Cleanup failed: ${error.message}`
      };
    }
  }

  /**
   * Get migration status and information
   */
  getMigrationStatus(data) {
    const currentVersion = this.detectVersion(data);
    const isLatest = currentVersion === this.currentVersion;
    const availableMigrations = this.getMigrationPath(currentVersion, this.currentVersion);

    return {
      currentVersion,
      latestVersion: this.currentVersion,
      isLatest,
      availableMigrations: availableMigrations.length,
      migrationPath: availableMigrations.map(m => `${m.from} -> ${m.to}`),
      availableBackups: this.getAvailableMigrationBackups().length
    };
  }

  /**
   * Enhanced logging
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

      const logMessage = `${prefix} [${timestamp}] MigrationManager: ${message}`;
      if (data) {
        console.log(logMessage, data);
      } else {
        console.log(logMessage);
      }
    }
  }
}

module.exports = { MigrationManager };