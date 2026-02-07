const fs = require('fs');
const path = require('path');

/**
 * Recovery Manager for data backup and restoration operations
 */
class RecoveryManager {
  constructor(config, storage) {
    this.config = config;
    this.storage = storage;
  }

  /**
   * Create a manual backup with metadata
   */
  async createManualBackup(todos, reason = 'manual') {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFilename = `manual-backup-${timestamp}.json`;
      const backupPath = path.join(this.config.options.dataDir, backupFilename);

      const backupData = {
        timestamp: new Date().toISOString(),
        reason,
        todoCount: todos.length,
        source: this.config.getDataFilePath(),
        version: '1.3.0',
        data: {
          version: '1.3.0',
          migrationDate: new Date().toISOString(),
          todos: todos
        }
      };

      fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));

      return {
        success: true,
        backupPath,
        filename: backupFilename,
        timestamp: backupData.timestamp,
        todoCount: todos.length,
        message: `Created manual backup with ${todos.length} todo(s)`
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to create manual backup: ${error.message}`
      };
    }
  }

  /**
   * List all available backups (manual and automatic)
   */
  getAvailableBackups() {
    try {
      const backups = [];
      const dataDir = this.config.options.dataDir;

      if (!fs.existsSync(dataDir)) {
        return { success: true, backups: [] };
      }

      const files = fs.readdirSync(dataDir);

      // Add automatic backup (.backup file)
      const autoBackupFile = this.config.getBackupFilePath();
      if (fs.existsSync(autoBackupFile)) {
        const stats = fs.statSync(autoBackupFile);

        try {
          const content = fs.readFileSync(autoBackupFile, 'utf8');
          const data = JSON.parse(content);
          const todoCount = Array.isArray(data) ? data.length :
                          (data.todos ? data.todos.length : 0);

          backups.push({
            type: 'automatic',
            filename: path.basename(autoBackupFile),
            path: autoBackupFile,
            timestamp: stats.mtime.toISOString(),
            size: stats.size,
            todoCount,
            description: 'Automatic backup (latest)'
          });
        } catch (error) {
          // Invalid backup file, skip it
        }
      }

      // Add manual backups
      const manualBackups = files
        .filter(file => file.startsWith('manual-backup-') && file.endsWith('.json'))
        .map(file => {
          const filePath = path.join(dataDir, file);

          try {
            const stats = fs.statSync(filePath);
            const content = fs.readFileSync(filePath, 'utf8');
            const backupData = JSON.parse(content);

            return {
              type: 'manual',
              filename: file,
              path: filePath,
              timestamp: backupData.timestamp,
              reason: backupData.reason || 'manual',
              size: stats.size,
              todoCount: backupData.todoCount || 0,
              description: `Manual backup: ${backupData.reason || 'user created'}`
            };
          } catch (error) {
            return null; // Invalid backup file
          }
        })
        .filter(backup => backup !== null);

      backups.push(...manualBackups);

      // Add migration backups
      const migrationBackups = files
        .filter(file => file.startsWith('migration-backup-') && file.endsWith('.json'))
        .map(file => {
          const filePath = path.join(dataDir, file);

          try {
            const stats = fs.statSync(filePath);
            const content = fs.readFileSync(filePath, 'utf8');
            const backupData = JSON.parse(content);
            const todoCount = Array.isArray(backupData.data) ? backupData.data.length :
                            (backupData.data && backupData.data.todos ? backupData.data.todos.length : 0);

            return {
              type: 'migration',
              filename: file,
              path: filePath,
              timestamp: backupData.timestamp,
              size: stats.size,
              todoCount,
              originalVersion: backupData.originalVersion,
              targetVersion: backupData.targetVersion,
              description: `Migration backup (${backupData.originalVersion} -> ${backupData.targetVersion})`
            };
          } catch (error) {
            return null;
          }
        })
        .filter(backup => backup !== null);

      backups.push(...migrationBackups);

      // Sort by timestamp (newest first)
      backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      return {
        success: true,
        backups,
        totalBackups: backups.length,
        automaticBackups: backups.filter(b => b.type === 'automatic').length,
        manualBackups: backups.filter(b => b.type === 'manual').length,
        migrationBackups: backups.filter(b => b.type === 'migration').length
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to list backups: ${error.message}`
      };
    }
  }

  /**
   * Restore data from a specific backup
   */
  async restoreFromBackup(backupPath, options = {}) {
    try {
      if (!fs.existsSync(backupPath)) {
        return {
          success: false,
          error: 'Backup file not found'
        };
      }

      const backupContent = fs.readFileSync(backupPath, 'utf8');
      const backupData = JSON.parse(backupContent);

      // Extract todo data based on backup format
      let todos = [];
      let metadata = {};

      if (Array.isArray(backupData)) {
        // Direct array format (automatic backup)
        todos = backupData;
        metadata = {
          type: 'automatic',
          source: 'automatic backup'
        };
      } else if (backupData.data) {
        // Structured backup format
        if (Array.isArray(backupData.data)) {
          todos = backupData.data;
        } else if (backupData.data.todos) {
          todos = backupData.data.todos;
        }

        metadata = {
          type: backupData.reason ? 'manual' : 'migration',
          timestamp: backupData.timestamp,
          originalVersion: backupData.originalVersion,
          reason: backupData.reason,
          source: backupPath
        };
      } else {
        return {
          success: false,
          error: 'Invalid backup file format'
        };
      }

      // Validate the restored data
      if (!Array.isArray(todos)) {
        return {
          success: false,
          error: 'Backup contains invalid todo data'
        };
      }

      // Create current data backup before restore if requested
      if (options.createBackupBeforeRestore !== false) {
        const currentTodos = await this.getCurrentTodos();
        if (currentTodos.length > 0) {
          const backupResult = await this.createManualBackup(currentTodos, 'pre-restore');
          if (backupResult.success) {
            metadata.preRestoreBackup = backupResult.filename;
          }
        }
      }

      return {
        success: true,
        todos,
        metadata,
        restoredCount: todos.length,
        message: `Successfully restored ${todos.length} todo(s) from backup`
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to restore from backup: ${error.message}`
      };
    }
  }

  /**
   * Export todos to various formats
   */
  async exportTodos(todos, format = 'json', options = {}) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const exportDir = options.exportDir || this.config.options.dataDir;

      // Ensure export directory exists
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }

      let exportData;
      let filename;
      let extension;

      switch (format.toLowerCase()) {
        case 'json':
          exportData = JSON.stringify({
            export: {
              timestamp: new Date().toISOString(),
              todoCount: todos.length,
              version: '1.3.0',
              format: 'json'
            },
            todos
          }, null, 2);
          filename = `todo-export-${timestamp}.json`;
          extension = 'json';
          break;

        case 'csv':
          const csvHeaders = ['ID', 'Description', 'Completed', 'Priority', 'Tags', 'Created At', 'Due Date', 'Completed At'];
          const csvRows = todos.map(todo => [
            todo.id,
            `"${todo.description.replace(/"/g, '""')}"`, // Escape quotes
            todo.completed ? 'Yes' : 'No',
            todo.priority || 'medium',
            `"${(todo.tags || []).join(', ')}"`,
            todo.createdAt || '',
            todo.dueDate || '',
            todo.completedAt || ''
          ]);

          exportData = [csvHeaders, ...csvRows]
            .map(row => row.join(','))
            .join('\n');
          filename = `todo-export-${timestamp}.csv`;
          extension = 'csv';
          break;

        case 'txt':
          const txtLines = [
            '# Todo Export',
            `# Exported on: ${new Date().toISOString()}`,
            `# Total todos: ${todos.length}`,
            '',
            ...todos.map(todo => {
              const status = todo.completed ? '✓' : ' ';
              const priority = todo.priority ? ` [${todo.priority.toUpperCase()}]` : '';
              const tags = todo.tags && todo.tags.length ? ` Tags: ${todo.tags.join(', ')}` : '';
              const dueDate = todo.dueDate ? ` Due: ${todo.dueDate}` : '';

              return `[${status}] #${todo.id}: ${todo.description}${priority}${tags}${dueDate}`;
            })
          ];

          exportData = txtLines.join('\n');
          filename = `todo-export-${timestamp}.txt`;
          extension = 'txt';
          break;

        default:
          return {
            success: false,
            error: `Unsupported export format: ${format}`
          };
      }

      const exportPath = path.join(exportDir, filename);
      fs.writeFileSync(exportPath, exportData);

      return {
        success: true,
        exportPath,
        filename,
        format: extension,
        todoCount: todos.length,
        size: Buffer.byteLength(exportData, 'utf8'),
        message: `Exported ${todos.length} todo(s) to ${format.toUpperCase()} format`
      };

    } catch (error) {
      return {
        success: false,
        error: `Export failed: ${error.message}`
      };
    }
  }

  /**
   * Import todos from external files
   */
  async importTodos(filePath, options = {}) {
    try {
      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          error: 'Import file not found'
        };
      }

      const content = fs.readFileSync(filePath, 'utf8');
      const ext = path.extname(filePath).toLowerCase();
      let importedTodos = [];

      switch (ext) {
        case '.json':
          try {
            const jsonData = JSON.parse(content);

            if (Array.isArray(jsonData)) {
              importedTodos = jsonData;
            } else if (jsonData.todos && Array.isArray(jsonData.todos)) {
              importedTodos = jsonData.todos;
            } else if (jsonData.data && Array.isArray(jsonData.data)) {
              importedTodos = jsonData.data;
            } else {
              return {
                success: false,
                error: 'JSON file does not contain valid todo array'
              };
            }
          } catch (parseError) {
            return {
              success: false,
              error: `Invalid JSON file: ${parseError.message}`
            };
          }
          break;

        case '.csv':
          const lines = content.split('\n').filter(line => line.trim());
          if (lines.length < 2) {
            return {
              success: false,
              error: 'CSV file must have header and at least one data row'
            };
          }

          const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
          const dataLines = lines.slice(1);

          importedTodos = dataLines.map((line, index) => {
            const values = this.parseCSVLine(line);
            const todo = { id: Date.now() + index }; // Temporary ID

            // Map CSV columns to todo fields
            for (let i = 0; i < headers.length && i < values.length; i++) {
              const header = headers[i];
              const value = values[i].trim();

              switch (header) {
                case 'description':
                  todo.description = value;
                  break;
                case 'completed':
                  todo.completed = ['yes', 'true', '1', 'completed'].includes(value.toLowerCase());
                  break;
                case 'priority':
                  todo.priority = ['low', 'medium', 'high'].includes(value.toLowerCase()) ? value.toLowerCase() : 'medium';
                  break;
                case 'tags':
                  todo.tags = value ? value.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
                  break;
                case 'due date':
                case 'duedate':
                  if (value && !isNaN(Date.parse(value))) {
                    todo.dueDate = value;
                  }
                  break;
              }
            }

            // Set defaults
            todo.completed = todo.completed || false;
            todo.priority = todo.priority || 'medium';
            todo.tags = todo.tags || [];
            todo.createdAt = new Date().toISOString();

            return todo;
          }).filter(todo => todo.description && todo.description.trim());

          break;

        default:
          return {
            success: false,
            error: `Unsupported import format: ${ext}`
          };
      }

      // Validate imported todos
      const validTodos = importedTodos.filter(todo => {
        return todo &&
               typeof todo.description === 'string' &&
               todo.description.trim().length > 0;
      });

      if (validTodos.length === 0) {
        return {
          success: false,
          error: 'No valid todos found in import file'
        };
      }

      // Reassign IDs to avoid conflicts
      const currentTodos = await this.getCurrentTodos();
      const maxId = currentTodos.length > 0 ? Math.max(...currentTodos.map(t => t.id)) : 0;

      validTodos.forEach((todo, index) => {
        todo.id = maxId + index + 1;
      });

      return {
        success: true,
        todos: validTodos,
        importedCount: validTodos.length,
        skippedCount: importedTodos.length - validTodos.length,
        message: `Successfully imported ${validTodos.length} todo(s)${importedTodos.length !== validTodos.length ? ` (skipped ${importedTodos.length - validTodos.length} invalid entries)` : ''}`
      };

    } catch (error) {
      return {
        success: false,
        error: `Import failed: ${error.message}`
      };
    }
  }

  /**
   * Parse a CSV line with proper quote handling
   */
  parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Start or end of quoted field
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // Field separator
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current); // Add last field
    return values;
  }

  /**
   * Get current todos from storage
   */
  async getCurrentTodos() {
    try {
      const loadResult = await this.storage.loadData();
      if (loadResult.success) {
        return Array.isArray(loadResult.data) ? loadResult.data :
               (loadResult.data.todos || []);
      }
      return [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Delete old backups based on retention policy
   */
  async cleanupBackups(options = {}) {
    try {
      const keepManual = options.keepManual || 10;
      const keepMigration = options.keepMigration || 5;

      const backupsResult = this.getAvailableBackups();
      if (!backupsResult.success) {
        return backupsResult;
      }

      const backups = backupsResult.backups;
      let deletedCount = 0;

      // Clean up manual backups
      const manualBackups = backups.filter(b => b.type === 'manual').slice(keepManual);
      for (const backup of manualBackups) {
        try {
          fs.unlinkSync(backup.path);
          deletedCount++;
        } catch (error) {
          this.log('warn', `Failed to delete backup ${backup.filename}: ${error.message}`);
        }
      }

      // Clean up migration backups
      const migrationBackups = backups.filter(b => b.type === 'migration').slice(keepMigration);
      for (const backup of migrationBackups) {
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
        remainingBackups: backups.length - deletedCount,
        message: `Cleaned up ${deletedCount} old backup(s)`
      };

    } catch (error) {
      return {
        success: false,
        error: `Cleanup failed: ${error.message}`
      };
    }
  }

  /**
   * Get recovery statistics
   */
  getRecoveryStats() {
    try {
      const backupsResult = this.getAvailableBackups();
      if (!backupsResult.success) {
        return { success: false, error: backupsResult.error };
      }

      const backups = backupsResult.backups;
      const stats = {
        totalBackups: backups.length,
        automaticBackups: backups.filter(b => b.type === 'automatic').length,
        manualBackups: backups.filter(b => b.type === 'manual').length,
        migrationBackups: backups.filter(b => b.type === 'migration').length,
        totalSize: backups.reduce((sum, b) => sum + (b.size || 0), 0),
        oldestBackup: backups.length > 0 ? backups[backups.length - 1].timestamp : null,
        newestBackup: backups.length > 0 ? backups[0].timestamp : null
      };

      return { success: true, stats };

    } catch (error) {
      return {
        success: false,
        error: `Failed to get recovery stats: ${error.message}`
      };
    }
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

      const logMessage = `${prefix} [${timestamp}] RecoveryManager: ${message}`;
      if (data) {
        console.log(logMessage, data);
      } else {
        console.log(logMessage);
      }
    }
  }
}

module.exports = { RecoveryManager };