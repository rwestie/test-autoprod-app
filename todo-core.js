const fs = require('fs');
const path = require('path');
const os = require('os');
const { StorageConfig } = require('./storage-config');

class TodoCore {
  constructor(dataFile = null, config = null) {
    // Support both legacy dataFile parameter and new config system
    if (dataFile && typeof dataFile === 'object') {
      // If first parameter is an object, treat it as config
      this.config = dataFile instanceof StorageConfig ? dataFile : new StorageConfig(dataFile);
      this.dataFile = this.config.getDataFilePath();
    } else {
      // Legacy constructor - create config with legacy behavior for backward compatibility
      const legacyConfig = {
        backupRetention: 1, // Keep single backup for legacy compatibility
        enableLogging: true,
        logLevel: 'info'
      };

      if (dataFile) {
        // Extract directory and filename from provided path
        const dir = path.dirname(dataFile);
        const filename = path.basename(dataFile);
        legacyConfig.dataDir = dir;
        legacyConfig.dataFile = filename;
      }

      this.config = config || new StorageConfig(legacyConfig);
      this.dataFile = dataFile || this.config.getDataFilePath();
    }

    this.backupFile = this.config.getBackupFilePath();
    this.tempFile = this.config.getTempFilePath();
    this.todos = this.loadTodos();
    this.nextId = this.getNextId();
  }

  // Enhanced logging system
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

      if (data) {
        console.log(`${prefix} [${timestamp}] ${message}`, data);
      } else {
        console.log(`${prefix} [${timestamp}] ${message}`);
      }
    }
  }

  // Storage performance monitoring
  getStorageStats() {
    const stats = {
      todoCount: this.todos.length,
      dataFile: this.dataFile,
      fileExists: fs.existsSync(this.dataFile),
      backupExists: fs.existsSync(this.backupFile),
      fileSize: 0,
      lastModified: null,
      storageHealth: 'unknown'
    };

    try {
      if (stats.fileExists) {
        const fileStats = fs.statSync(this.dataFile);
        stats.fileSize = fileStats.size;
        stats.lastModified = fileStats.mtime.toISOString();
        stats.storageHealth = 'healthy';
      }
    } catch (error) {
      stats.storageHealth = 'error';
      this.log('error', 'Error getting storage stats', error.message);
    }

    return stats;
  }

  getDefaultDataFile() {
    // Use a more appropriate default location
    const homeDir = os.homedir();
    const todosDir = path.join(homeDir, '.todos');

    // Ensure the directory exists
    if (!fs.existsSync(todosDir)) {
      try {
        fs.mkdirSync(todosDir, { recursive: true, mode: this.config.options.dirMode });
        this.log('info', 'Created todos directory', todosDir);
      } catch (error) {
        this.log('warn', 'Failed to create home directory, falling back to current directory', error.message);
        // Fall back to current directory if we can't create home directory
        return './todos.json';
      }
    }

    return path.join(todosDir, 'todos.json');
  }

  validateTodoData(data) {
    if (!Array.isArray(data)) {
      throw new Error('Todo data must be an array');
    }

    return data.filter(todo => {
      // Validate each todo has required fields
      if (!todo ||
          typeof todo.id !== 'number' ||
          typeof todo.description !== 'string' ||
          typeof todo.completed !== 'boolean' ||
          typeof todo.createdAt !== 'string') {
        return false;
      }

      // Validate priority if present
      if (todo.priority !== undefined) {
        const validPriorities = ['low', 'medium', 'high'];
        if (!validPriorities.includes(todo.priority)) {
          return false;
        }
      }

      // Validate dueDate if present
      if (todo.dueDate !== undefined) {
        if (typeof todo.dueDate !== 'string' || isNaN(Date.parse(todo.dueDate))) {
          return false;
        }
      }

      // Validate tags if present
      if (todo.tags !== undefined) {
        if (!Array.isArray(todo.tags) || !todo.tags.every(tag => typeof tag === 'string')) {
          return false;
        }
      }

      // Validate completedAt if present
      if (todo.completedAt !== undefined) {
        if (typeof todo.completedAt !== 'string' || isNaN(Date.parse(todo.completedAt))) {
          return false;
        }
      }

      return true;
    }).map(todo => {
      // Migrate old todos to new structure
      return this.migrateTodoStructure(todo);
    });
  }

  migrateTodoStructure(todo) {
    // Ensure backward compatibility by adding default values for new fields
    const migrated = { ...todo };

    // Add priority if missing
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

  loadTodos() {
    try {
      if (fs.existsSync(this.dataFile)) {
        const data = fs.readFileSync(this.dataFile, 'utf8');
        const parsed = JSON.parse(data);
        const validated = this.validateTodoData(parsed);

        // If validation filtered out items, save the cleaned data
        if (validated.length !== parsed.length) {
          console.warn(`📋 Cleaned up ${parsed.length - validated.length} invalid todo items from storage`);
          this.todos = validated;
          const saveResult = this.saveTodos();
          if (!saveResult.success) {
            console.error(`❌ Failed to save cleaned data: ${saveResult.error}`);
          }
        }

        if (validated.length > 0) {
          console.log(`📂 Loaded ${validated.length} todo${validated.length === 1 ? '' : 's'} from ${this.dataFile}`);
        }

        return validated;
      } else {
        console.log(`📝 Creating new todo list at ${this.dataFile}`);
      }
    } catch (error) {
      console.error(`❌ Error loading todos from ${this.dataFile}:`, error.message);

      // Try to load from backup
      if (fs.existsSync(this.backupFile)) {
        console.log('🔄 Attempting to restore from backup...');
        try {
          const backupData = fs.readFileSync(this.backupFile, 'utf8');
          const parsed = JSON.parse(backupData);
          const validated = this.validateTodoData(parsed);
          console.log(`✅ Successfully restored ${validated.length} todo${validated.length === 1 ? '' : 's'} from backup`);
          return validated;
        } catch (backupError) {
          console.error(`❌ Backup restoration failed: ${backupError.message}`);
        }
      } else {
        console.log('⚠️  No backup file found, starting with empty todo list');
      }
    }
    return [];
  }

  rotateBackups() {
    if (!this.config.options.enableBackups || this.config.options.backupRetention <= 1) {
      return; // Don't rotate if we only want 1 backup or backups are disabled
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

      // If we have more than 1 backup retention, move current backup to backup.1
      // Otherwise, keep it as .backup for backward compatibility
      if (this.config.options.backupRetention > 1 && fs.existsSync(this.backupFile)) {
        const firstBackup = this.config.getRotatedBackupPath(1);
        fs.copyFileSync(this.backupFile, firstBackup);
        this.log('debug', `Copied current backup to: ${firstBackup}`);
      }
    } catch (error) {
      this.log('warn', 'Error during backup rotation', error.message);
    }
  }

  saveTodos() {
    const startTime = Date.now();

    for (let attempt = 1; attempt <= this.config.options.maxRetries + 1; attempt++) {
      try {
        // Create backup of current file before saving
        if (fs.existsSync(this.dataFile) && this.config.options.enableBackups) {
          this.rotateBackups();
          fs.copyFileSync(this.dataFile, this.backupFile);
          this.log('info', 'Created backup before saving changes');
        }

        // Prepare data for saving
        const data = JSON.stringify(this.todos, null, 2);

        // Write to temp file first for atomic operation
        if (this.config.options.useTempFiles) {
          fs.writeFileSync(this.tempFile, data, { mode: this.config.options.fileMode });

          // Verify the temp file can be parsed before finalizing
          const verification = fs.readFileSync(this.tempFile, 'utf8');
          JSON.parse(verification); // This will throw if invalid JSON

          // Atomic move to final location
          fs.renameSync(this.tempFile, this.dataFile);
        } else {
          // Direct write (for testing or specific scenarios)
          fs.writeFileSync(this.dataFile, data, { mode: this.config.options.fileMode });
        }

        const duration = Date.now() - startTime;
        this.log('info', `Successfully saved ${this.todos.length} todo${this.todos.length === 1 ? '' : 's'} to storage`);
        this.log('debug', `Save operation completed in ${duration}ms`);

        return {
          success: true,
          count: this.todos.length,
          location: this.dataFile,
          duration,
          attempt
        };

      } catch (error) {
        this.log('error', `Save attempt ${attempt} failed: ${error.message}`);

        // Clean up temp file if it exists
        if (fs.existsSync(this.tempFile)) {
          try {
            fs.unlinkSync(this.tempFile);
            this.log('debug', 'Cleaned up temporary file after save failure');
          } catch (cleanupError) {
            this.log('error', 'Error cleaning up temp file', cleanupError.message);
          }
        }

        // Retry logic
        if (attempt <= this.config.options.maxRetries) {
          const delay = this.config.options.retryDelay * attempt;
          this.log('warn', `Retrying save operation in ${delay}ms (attempt ${attempt}/${this.config.options.maxRetries})`);

          // Wait before retry (in real app, use setTimeout)
          const start = Date.now();
          while (Date.now() - start < delay) {
            // Busy wait for simplicity
          }
        } else {
          // All retries exhausted
          return {
            success: false,
            error: error.message,
            attempts: attempt - 1,
            duration: Date.now() - startTime
          };
        }
      }
    }
  }

  getNextId() {
    if (this.todos.length === 0) return 1;
    return Math.max(...this.todos.map(todo => todo.id)) + 1;
  }

  addTodo(description, options = {}) {
    if (!description || description.trim().length === 0) {
      return { success: false, error: 'Description is required' };
    }

    // Validate options
    const { priority = 'medium', dueDate, tags = [] } = options;

    if (!['low', 'medium', 'high'].includes(priority)) {
      return { success: false, error: 'Priority must be low, medium, or high' };
    }

    if (dueDate !== undefined) {
      if (typeof dueDate !== 'string' || isNaN(Date.parse(dueDate))) {
        return { success: false, error: 'Due date must be a valid ISO date string' };
      }
    }

    if (!Array.isArray(tags) || !tags.every(tag => typeof tag === 'string')) {
      return { success: false, error: 'Tags must be an array of strings' };
    }

    const todo = {
      id: this.nextId++,
      description: description.trim(),
      completed: false,
      priority,
      tags: tags.map(tag => tag.trim()).filter(tag => tag.length > 0),
      createdAt: new Date().toISOString()
    };

    // Add due date if provided
    if (dueDate !== undefined) {
      todo.dueDate = dueDate;
    }

    this.todos.push(todo);

    const saveResult = this.saveTodos();
    if (saveResult.success) {
      return {
        success: true,
        todo,
        storage: {
          saved: true,
          count: saveResult.count,
          location: saveResult.location,
          duration: saveResult.duration,
          attempt: saveResult.attempt
        }
      };
    } else {
      return {
        success: false,
        error: saveResult.error || 'Failed to save todo',
        storage: {
          saved: false,
          attempts: saveResult.attempts,
          duration: saveResult.duration
        }
      };
    }
  }

  listTodos() {
    return this.todos.slice();
  }

  completeTodo(id) {
    const numId = parseInt(id);
    if (isNaN(numId)) {
      return { success: false, error: 'Invalid ID format' };
    }

    const todo = this.todos.find(t => t.id === numId);
    if (!todo) {
      return { success: false, error: `Todo with ID ${numId} not found` };
    }

    if (todo.completed) {
      return { success: true, message: `Todo #${todo.id} was already completed` };
    }

    todo.completed = true;
    todo.completedAt = new Date().toISOString();

    const saveResult = this.saveTodos();
    if (saveResult.success) {
      return {
        success: true,
        todo,
        storage: {
          saved: true,
          count: saveResult.count,
          location: saveResult.location,
          duration: saveResult.duration,
          attempt: saveResult.attempt
        }
      };
    } else {
      return {
        success: false,
        error: saveResult.error || 'Failed to save todo',
        storage: {
          saved: false,
          attempts: saveResult.attempts,
          duration: saveResult.duration
        }
      };
    }
  }

  deleteTodo(id) {
    const numId = parseInt(id);
    if (isNaN(numId)) {
      return { success: false, error: 'Invalid ID format' };
    }

    const todoIndex = this.todos.findIndex(t => t.id === numId);
    if (todoIndex === -1) {
      return { success: false, error: `Todo with ID ${numId} not found` };
    }

    const todo = this.todos[todoIndex];
    this.todos.splice(todoIndex, 1);

    const saveResult = this.saveTodos();
    if (saveResult.success) {
      return { success: true, todo, storage: { saved: true, count: saveResult.count, location: saveResult.location } };
    } else {
      return { success: false, error: saveResult.error || 'Failed to save todo', storage: { saved: false } };
    }
  }

  updateTodo(id, updates) {
    const numId = parseInt(id);
    if (isNaN(numId)) {
      return { success: false, error: 'Invalid ID format' };
    }

    const todo = this.todos.find(t => t.id === numId);
    if (!todo) {
      return { success: false, error: `Todo with ID ${numId} not found` };
    }

    // Validate updates
    if (updates.priority !== undefined && !['low', 'medium', 'high'].includes(updates.priority)) {
      return { success: false, error: 'Priority must be low, medium, or high' };
    }

    if (updates.dueDate !== undefined) {
      if (typeof updates.dueDate !== 'string' || isNaN(Date.parse(updates.dueDate))) {
        return { success: false, error: 'Due date must be a valid ISO date string' };
      }
    }

    if (updates.tags !== undefined) {
      if (!Array.isArray(updates.tags) || !updates.tags.every(tag => typeof tag === 'string')) {
        return { success: false, error: 'Tags must be an array of strings' };
      }
    }

    // Apply updates
    if (updates.description !== undefined) {
      todo.description = updates.description.trim();
    }
    if (updates.priority !== undefined) {
      todo.priority = updates.priority;
    }
    if (updates.dueDate !== undefined) {
      todo.dueDate = updates.dueDate;
    }
    if (updates.tags !== undefined) {
      todo.tags = updates.tags.map(tag => tag.trim()).filter(tag => tag.length > 0);
    }

    const saveResult = this.saveTodos();
    if (saveResult.success) {
      return { success: true, todo, storage: { saved: true, count: saveResult.count, location: saveResult.location } };
    } else {
      return { success: false, error: saveResult.error || 'Failed to save todo', storage: { saved: false } };
    }
  }

  listTodosByPriority(priority) {
    if (!['low', 'medium', 'high'].includes(priority)) {
      return [];
    }
    return this.todos.filter(todo => todo.priority === priority);
  }

  listTodosByTag(tag) {
    return this.todos.filter(todo => todo.tags.includes(tag));
  }

  getTodoById(id) {
    const numId = parseInt(id);
    if (isNaN(numId)) {
      return null;
    }
    return this.todos.find(todo => todo.id === numId) || null;
  }

  getOverdueTodos() {
    const now = new Date().toISOString();
    return this.todos.filter(todo =>
      !todo.completed &&
      todo.dueDate &&
      todo.dueDate < now
    );
  }

  getDueTodosToday() {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format

    return this.todos.filter(todo =>
      !todo.completed &&
      todo.dueDate &&
      todo.dueDate.startsWith(todayStr)
    );
  }

  getAllTags() {
    const tagSet = new Set();
    this.todos.forEach(todo => {
      todo.tags.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }
}

// Singleton instance for functional API
let _globalTodoCore = null;

function getGlobalTodoCore() {
  if (!_globalTodoCore) {
    _globalTodoCore = new TodoCore();
  }
  return _globalTodoCore;
}

// Functional API
function add_todo(description, options) {
  const core = getGlobalTodoCore();
  return core.addTodo(description, options);
}

function list_todos() {
  const core = getGlobalTodoCore();
  return core.listTodos();
}

function complete_todo(id) {
  const core = getGlobalTodoCore();
  return core.completeTodo(id);
}

function delete_todo(id) {
  const core = getGlobalTodoCore();
  return core.deleteTodo(id);
}

function update_todo(id, updates) {
  const core = getGlobalTodoCore();
  return core.updateTodo(id, updates);
}

function get_todo_by_id(id) {
  const core = getGlobalTodoCore();
  return core.getTodoById(id);
}

function list_todos_by_priority(priority) {
  const core = getGlobalTodoCore();
  return core.listTodosByPriority(priority);
}

function list_todos_by_tag(tag) {
  const core = getGlobalTodoCore();
  return core.listTodosByTag(tag);
}

function get_overdue_todos() {
  const core = getGlobalTodoCore();
  return core.getOverdueTodos();
}

function get_due_todos_today() {
  const core = getGlobalTodoCore();
  return core.getDueTodosToday();
}

function get_all_tags() {
  const core = getGlobalTodoCore();
  return core.getAllTags();
}

// Function to reset the global instance (useful for testing)
function reset_global_core() {
  _globalTodoCore = null;
}

module.exports = {
  TodoCore,
  add_todo,
  list_todos,
  complete_todo,
  delete_todo,
  update_todo,
  get_todo_by_id,
  list_todos_by_priority,
  list_todos_by_tag,
  get_overdue_todos,
  get_due_todos_today,
  get_all_tags,
  reset_global_core
};