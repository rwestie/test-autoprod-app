const path = require('path');
const { StorageConfig } = require('./storage-config');
const { StorageFactory } = require('./storage-registry');
const { MigrationManager } = require('./migration-manager');
const { RecoveryManager } = require('./recovery-manager');
const { UndoManager } = require('./undo-manager');

// Optional import of Todo model for enhanced validation
let Todo = null;
try {
  const todoModel = require('./todo-model');
  Todo = todoModel.Todo;
} catch (error) {
  // Todo model not available, use legacy validation
  Todo = null;
}

/**
 * Enhanced TodoCore that uses the new storage interface
 * Maintains backward compatibility with the original TodoCore
 */
class TodoCoreEnhanced {
  constructor(dataFile = null, config = null, storageType = 'json-file') {
    // Support both legacy dataFile parameter and new config system
    if (dataFile && typeof dataFile === 'object') {
      // If first parameter is an object, treat it as config
      this.config = dataFile instanceof StorageConfig ? dataFile : new StorageConfig(dataFile);
      this.storageType = config || storageType;
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
      this.storageType = storageType;
    }

    // Initialize storage
    this.storage = StorageFactory.create(this.storageType, this.config);

    // Initialize migration and recovery managers
    this.migrationManager = new MigrationManager(this.config);
    this.recoveryManager = new RecoveryManager(this.config, this.storage);

    // Initialize undo manager
    this.undoManager = new UndoManager({
      maxHistorySize: 50,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      enableLogging: this.config.options.enableLogging || false
    });

    this.todos = [];
    this.nextId = 1;
    this.isInitialized = false;

    // Initialize on construction
    this.initialize();
  }

  /**
   * Initialize the todo core and storage
   */
  async initialize() {
    try {
      // Initialize storage backend
      const initResult = await this.storage.initialize();
      if (!initResult.success) {
        throw new Error(initResult.error);
      }

      // Load existing todos with migration support
      const loadResult = await this.storage.loadData();
      if (loadResult.success) {
        // Check if data needs migration
        const migrationResult = await this.migrationManager.migrateData(loadResult.data);

        if (migrationResult.success && migrationResult.migrations.length > 0) {
          this.log('info', `Applied ${migrationResult.migrations.length} migration(s): ${migrationResult.message}`);

          // Create migration backup
          await this.migrationManager.createMigrationBackup(loadResult.data, migrationResult);

          // Save migrated data (extract todos array for storage)
          const todosToSave = this.extractTodoArray(migrationResult.data);
          const saveResult = await this.storage.saveData(todosToSave);
          if (!saveResult.success) {
            this.log('warn', `Failed to save migrated data: ${saveResult.error}`);
          }

          this.todos = this.extractTodoArray(migrationResult.data);
        } else {
          this.todos = this.extractTodoArray(loadResult.data);
        }

        this.nextId = this.getNextId();
      } else {
        this.log('warn', `Failed to load data: ${loadResult.error}`);
        this.todos = [];
        this.nextId = 1;
      }

      this.isInitialized = true;
      this.log('info', `TodoCore initialized with ${this.todos.length} todos using ${this.storageType} storage`);

    } catch (error) {
      this.log('error', `Failed to initialize TodoCore: ${error.message}`);
      this.todos = [];
      this.nextId = 1;
      this.isInitialized = false;
    }
  }

  /**
   * Ensure storage is initialized (for async operations)
   */
  async ensureInitialized() {
    if (!this.isInitialized) {
      await this.initialize();
    }
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

      if (data) {
        console.log(`${prefix} [${timestamp}] TodoCore: ${message}`, data);
      } else {
        console.log(`${prefix} [${timestamp}] TodoCore: ${message}`);
      }
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats() {
    await this.ensureInitialized();
    const stats = this.storage.getStats();
    return {
      ...stats,
      todoCount: this.todos.length
    };
  }

  /**
   * Perform storage health check
   */
  async performHealthCheck() {
    await this.ensureInitialized();
    return await this.storage.healthCheck();
  }

  /**
   * Extract todo array from various data formats
   */
  extractTodoArray(data) {
    if (Array.isArray(data)) {
      return data;
    }

    if (data && typeof data === 'object' && Array.isArray(data.todos)) {
      return data.todos;
    }

    return [];
  }

  /**
   * Get next available ID
   */
  getNextId() {
    if (this.todos.length === 0) return 1;
    return Math.max(...this.todos.map(todo => todo.id)) + 1;
  }

  /**
   * Create a todo object using the new Todo model if available,
   * otherwise fall back to legacy object creation
   */
  createTodoObject(description, options = {}) {
    const todoData = {
      id: this.nextId++,
      description: description.trim(),
      completed: options.completed || false,
      priority: options.priority || 'medium',
      tags: options.tags || [],
      createdAt: new Date().toISOString()
    };

    // Add due date if provided
    if (options.dueDate !== undefined) {
      todoData.dueDate = options.dueDate;
    }

    // Add completed timestamp if todo is created as completed
    if (todoData.completed) {
      todoData.completedAt = new Date().toISOString();
    }

    if (Todo) {
      // Use new Todo model for enhanced validation
      try {
        return new Todo(todoData).toObject();
      } catch (error) {
        // If new model validation fails, throw the validation error
        throw new Error(error.message);
      }
    } else {
      // Legacy validation (existing code)
      const { priority = 'medium', dueDate, tags = [] } = options;

      if (!['low', 'medium', 'high'].includes(priority)) {
        throw new Error('Priority must be low, medium, or high');
      }

      if (dueDate !== undefined) {
        if (typeof dueDate !== 'string' || isNaN(Date.parse(dueDate))) {
          throw new Error('Due date must be a valid ISO date string');
        }
      }

      if (!Array.isArray(tags) || !tags.every(tag => typeof tag === 'string')) {
        throw new Error('Tags must be an array of strings');
      }

      return {
        ...todoData,
        tags: tags.map(tag => tag.trim()).filter(tag => tag.length > 0)
      };
    }
  }

  /**
   * Add a new todo item
   */
  async addTodo(description, options = {}) {
    await this.ensureInitialized();

    if (!description || description.trim().length === 0) {
      return { success: false, error: 'Description is required' };
    }

    try {
      const todo = this.createTodoObject(description, options);
      this.todos.push(todo);

      const saveResult = await this.storage.saveData(this.todos);
      if (saveResult.success) {
        return {
          success: true,
          todo,
          storage: {
            saved: true,
            count: saveResult.metadata.count,
            location: saveResult.metadata.location,
            duration: saveResult.metadata.duration,
            attempt: saveResult.metadata.attempt
          }
        };
      } else {
        // Remove the todo from memory since save failed
        this.todos.pop();
        this.nextId--;
        return {
          success: false,
          error: saveResult.error || 'Failed to save todo',
          storage: {
            saved: false,
            attempts: saveResult.metadata.attempts,
            duration: saveResult.metadata.duration
          }
        };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * List all todos
   */
  async listTodos() {
    await this.ensureInitialized();
    return this.todos.slice();
  }

  /**
   * Complete a todo item
   */
  async completeTodo(id) {
    await this.ensureInitialized();

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

    const saveResult = await this.storage.saveData(this.todos);
    if (saveResult.success) {
      return {
        success: true,
        todo,
        storage: {
          saved: true,
          count: saveResult.metadata.count,
          location: saveResult.metadata.location,
          duration: saveResult.metadata.duration,
          attempt: saveResult.metadata.attempt
        }
      };
    } else {
      // Revert changes since save failed
      todo.completed = false;
      delete todo.completedAt;
      return {
        success: false,
        error: saveResult.error || 'Failed to save todo',
        storage: {
          saved: false,
          attempts: saveResult.metadata.attempts,
          duration: saveResult.metadata.duration
        }
      };
    }
  }

  /**
   * Mark a completed todo item as incomplete (reactivate it)
   */
  async incompleteTodo(id) {
    await this.ensureInitialized();

    const numId = parseInt(id);
    if (isNaN(numId)) {
      return { success: false, error: 'Invalid ID format' };
    }

    const todo = this.todos.find(t => t.id === numId);
    if (!todo) {
      return { success: false, error: `Todo with ID ${numId} not found` };
    }

    if (!todo.completed) {
      return { success: true, message: `Todo #${todo.id} was already incomplete` };
    }

    todo.completed = false;
    delete todo.completedAt;

    const saveResult = await this.storage.saveData(this.todos);
    if (saveResult.success) {
      return {
        success: true,
        todo,
        storage: {
          saved: true,
          count: saveResult.metadata.count,
          location: saveResult.metadata.location,
          duration: saveResult.metadata.duration,
          attempt: saveResult.metadata.attempt
        }
      };
    } else {
      // Revert changes since save failed
      todo.completed = true;
      todo.completedAt = new Date().toISOString();
      return {
        success: false,
        error: saveResult.error || 'Failed to save todo',
        storage: {
          saved: false,
          attempts: saveResult.metadata.attempts,
          duration: saveResult.metadata.duration
        }
      };
    }
  }

  /**
   * Delete a todo item by ID or index
   * @param {number|string} identifier - The todo ID or index (1-based)
   * @param {Object} options - Options for deletion
   * @param {boolean} options.useIndex - If true, treat identifier as index (1-based position)
   * @returns {Object} Result with success status, deleted todo, and storage info
   */
  async deleteTodo(identifier, options = {}) {
    await this.ensureInitialized();

    const { useIndex = false } = options;
    let todoIndex = -1;
    let todo = null;

    if (useIndex) {
      // Index-based deletion (1-based indexing for user-friendly interface)
      const index = parseInt(identifier);
      if (isNaN(index) || index < 1) {
        return { success: false, error: 'Invalid index format. Index must be a positive number starting from 1.' };
      }

      // Convert 1-based user index to 0-based array index
      const arrayIndex = index - 1;
      if (arrayIndex >= this.todos.length) {
        return { success: false, error: `Index ${index} is out of range. Current list has ${this.todos.length} todo(s).` };
      }

      todoIndex = arrayIndex;
      todo = this.todos[todoIndex];
    } else {
      // ID-based deletion (existing functionality)
      const numId = parseInt(identifier);
      if (isNaN(numId)) {
        return { success: false, error: 'Invalid ID format' };
      }

      todoIndex = this.todos.findIndex(t => t.id === numId);
      if (todoIndex === -1) {
        return { success: false, error: `Todo with ID ${numId} not found` };
      }

      todo = this.todos[todoIndex];
    }

    // Create Todo model instance if available for enhanced delete validation
    if (Todo) {
      try {
        const todoInstance = new Todo(todo);
        if (!todoInstance.canBeDeleted()) {
          return {
            success: false,
            error: 'Todo cannot be deleted due to business rules'
          };
        }
      } catch (error) {
        this.log('warn', `Failed to validate delete for todo ${todo.id}: ${error.message}`);
      }
    }

    // Store metadata before deletion
    const totalBefore = this.todos.length;

    this.todos.splice(todoIndex, 1);

    const saveResult = await this.storage.saveData(this.todos);
    if (saveResult.success) {
      // Record deletion for undo capability
      const deletionId = this.undoManager.recordDeletion({
        type: 'single',
        deletedTodos: [todo],
        metadata: {
          deletionMethod: useIndex ? 'index' : 'id',
          originalPositions: { [todo.id]: todoIndex + 1 }, // Store 1-based position
          totalBefore,
          totalAfter: this.todos.length
        },
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        todo,
        method: useIndex ? 'index' : 'id',
        deletedFrom: useIndex ? `position ${identifier}` : `ID ${identifier}`,
        deletionId, // Include deletion ID for potential undo
        storage: {
          saved: true,
          count: saveResult.metadata.count,
          location: saveResult.metadata.location
        }
      };
    } else {
      // Revert changes since save failed
      this.todos.splice(todoIndex, 0, todo);
      return {
        success: false,
        error: saveResult.error || 'Failed to save todo',
        storage: { saved: false }
      };
    }
  }

  /**
   * Bulk delete todos based on criteria
   * @param {string} operation - The bulk delete operation (clean, clear, overdue, etc.)
   * @param {Object} options - Additional options
   * @returns {Object} Result with deleted todos count and details
   */
  async bulkDeleteTodos(operation, options = {}) {
    await this.ensureInitialized();

    const { dryRun = false, force = false } = options;

    // Find todos to delete
    let todosToDelete;
    if (Todo) {
      // Use enhanced Todo model filtering
      todosToDelete = this.todos.filter(todoData => {
        try {
          const todoInstance = new Todo(todoData);
          return todoInstance.shouldBeIncludedInBulkDelete(operation);
        } catch (error) {
          this.log('warn', `Failed to evaluate todo ${todoData.id} for bulk delete: ${error.message}`);
          return false;
        }
      });
    } else {
      // Fallback to basic filtering
      todosToDelete = this.todos.filter(todo => {
        switch (operation.toLowerCase()) {
          case 'clean':
          case 'cleanup':
          case 'completed':
            return todo.completed;
          case 'clear':
          case 'purge':
            return true;
          case 'overdue':
            return !todo.completed && todo.dueDate && new Date(todo.dueDate) < new Date();
          case 'pending':
            return !todo.completed;
          default:
            return false;
        }
      });
    }

    if (todosToDelete.length === 0) {
      return {
        success: true,
        operation,
        deleted: [],
        count: 0,
        message: `No todos found matching criteria for '${operation}' operation`
      };
    }

    // If dry run, return what would be deleted
    if (dryRun) {
      return {
        success: true,
        operation,
        dryRun: true,
        toBeDeleted: todosToDelete,
        count: todosToDelete.length,
        message: `Would delete ${todosToDelete.length} todos with '${operation}' operation`
      };
    }

    // Safety check for destructive operations
    if (!force && (operation === 'clear' || operation === 'purge')) {
      return {
        success: false,
        error: `Operation '${operation}' requires explicit force=true confirmation`,
        operation,
        wouldDelete: todosToDelete.length
      };
    }

    // Perform bulk delete
    const originalTodos = [...this.todos];
    const deletedTodos = [];
    const deletedIds = todosToDelete.map(t => t.id);

    // Store original positions for undo capability
    const originalPositions = {};
    originalTodos.forEach((todo, index) => {
      if (deletedIds.includes(todo.id)) {
        originalPositions[todo.id] = index + 1; // Store 1-based position
      }
    });

    // Remove todos from the list
    this.todos = this.todos.filter(todo => {
      if (deletedIds.includes(todo.id)) {
        deletedTodos.push(todo);
        return false;
      }
      return true;
    });

    // Save changes
    const saveResult = await this.storage.saveData(this.todos);
    if (saveResult.success) {
      this.log('info', `Bulk delete '${operation}': deleted ${deletedTodos.length} todos`);

      // Record deletion for undo capability
      const deletionId = this.undoManager.recordDeletion({
        type: 'bulk',
        deletedTodos,
        metadata: {
          operation,
          deletionMethod: 'bulk',
          originalPositions,
          totalBefore: originalTodos.length,
          totalAfter: this.todos.length
        },
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        operation,
        deleted: deletedTodos,
        count: deletedTodos.length,
        remaining: this.todos.length,
        deletionId, // Include deletion ID for potential undo
        storage: {
          saved: true,
          count: saveResult.metadata.count,
          location: saveResult.metadata.location
        },
        message: `Successfully deleted ${deletedTodos.length} todos with '${operation}' operation`
      };
    } else {
      // Revert changes since save failed
      this.todos = originalTodos;
      return {
        success: false,
        operation,
        error: saveResult.error || 'Failed to save after bulk delete',
        attempted: deletedTodos.length,
        storage: { saved: false }
      };
    }
  }

  /**
   * Clean completed todos (bulk delete completed items)
   */
  async cleanCompletedTodos(options = {}) {
    return await this.bulkDeleteTodos('clean', options);
  }

  /**
   * Clear all todos (bulk delete everything)
   */
  async clearAllTodos(options = {}) {
    return await this.bulkDeleteTodos('clear', { ...options, force: options.force || false });
  }

  /**
   * Delete overdue todos
   */
  async deleteOverdueTodos(options = {}) {
    return await this.bulkDeleteTodos('overdue', options);
  }

  /**
   * Get bulk delete preview (dry run)
   */
  async previewBulkDelete(operation) {
    return await this.bulkDeleteTodos(operation, { dryRun: true });
  }

  /**
   * Delete multiple specific todos by their IDs or indices
   * @param {Array} identifiers - Array of todo IDs or indices
   * @param {Object} options - Options for batch deletion
   * @param {boolean} options.useIndex - If true, treat identifiers as indices (1-based positions)
   * @param {boolean} options.dryRun - If true, return what would be deleted without deleting
   * @param {boolean} options.force - If true, skip confirmation prompts
   * @returns {Object} Result with deleted todos and details
   */
  async batchDeleteTodos(identifiers, options = {}) {
    await this.ensureInitialized();

    const { useIndex = false, dryRun = false, force = false } = options;

    if (!Array.isArray(identifiers) || identifiers.length === 0) {
      return {
        success: false,
        error: 'At least one todo ID or index must be provided'
      };
    }

    // Validate and resolve todos to delete
    const todosToDelete = [];
    const notFound = [];
    const errors = [];

    for (const identifier of identifiers) {
      try {
        if (useIndex) {
          // Index-based deletion (1-based indexing for user-friendly interface)
          const index = parseInt(identifier);
          if (isNaN(index) || index < 1) {
            errors.push(`Invalid index: "${identifier}" (must be a positive number)`);
            continue;
          }

          // Convert 1-based user index to 0-based array index
          const arrayIndex = index - 1;
          if (arrayIndex >= this.todos.length) {
            notFound.push(`Index ${index} (out of range, list has ${this.todos.length} todos)`);
            continue;
          }

          const todo = this.todos[arrayIndex];
          if (!todosToDelete.find(t => t.id === todo.id)) {
            todosToDelete.push({
              ...todo,
              identifier,
              resolvedBy: 'index',
              position: index
            });
          }
        } else {
          // ID-based deletion
          const numId = parseInt(identifier);
          if (isNaN(numId)) {
            errors.push(`Invalid ID format: "${identifier}" (must be a number)`);
            continue;
          }

          const todo = this.todos.find(t => t.id === numId);
          if (!todo) {
            notFound.push(`Todo with ID ${numId}`);
            continue;
          }

          if (!todosToDelete.find(t => t.id === todo.id)) {
            todosToDelete.push({
              ...todo,
              identifier,
              resolvedBy: 'id'
            });
          }
        }
      } catch (error) {
        errors.push(`Error processing "${identifier}": ${error.message}`);
      }
    }

    // Check if any todos were found
    if (todosToDelete.length === 0) {
      const errorMessages = [];
      if (errors.length > 0) {
        errorMessages.push(`Errors: ${errors.join(', ')}`);
      }
      if (notFound.length > 0) {
        errorMessages.push(`Not found: ${notFound.join(', ')}`);
      }
      return {
        success: false,
        error: errorMessages.join('; '),
        processed: identifiers.length,
        found: 0,
        errors: errors,
        notFound: notFound
      };
    }

    // Validate todos can be deleted using Todo model if available
    const undeletableTodos = [];
    if (Todo) {
      for (const todoData of todosToDelete) {
        try {
          const todoInstance = new Todo(todoData);
          if (!todoInstance.canBeDeleted()) {
            undeletableTodos.push(todoData.id);
          }
        } catch (error) {
          this.log('warn', `Failed to validate delete for todo ${todoData.id}: ${error.message}`);
        }
      }
    }

    if (undeletableTodos.length > 0) {
      return {
        success: false,
        error: `Some todos cannot be deleted due to business rules: IDs ${undeletableTodos.join(', ')}`,
        undeletableTodos
      };
    }

    // If dry run, return what would be deleted
    if (dryRun) {
      return {
        success: true,
        dryRun: true,
        toBeDeleted: todosToDelete,
        count: todosToDelete.length,
        processed: identifiers.length,
        found: todosToDelete.length,
        errors: errors,
        notFound: notFound,
        message: `Would delete ${todosToDelete.length} todos`
      };
    }

    // Perform batch delete
    const originalTodos = [...this.todos];
    const deletedTodos = [];
    const deletedIds = todosToDelete.map(t => t.id);

    // Store original positions for undo capability
    const originalPositions = {};
    originalTodos.forEach((todo, index) => {
      if (deletedIds.includes(todo.id)) {
        originalPositions[todo.id] = index + 1; // Store 1-based position
      }
    });

    // Remove todos from the list
    this.todos = this.todos.filter(todo => {
      if (deletedIds.includes(todo.id)) {
        // Find the corresponding todoToDelete to preserve metadata
        const todoToDelete = todosToDelete.find(t => t.id === todo.id);
        deletedTodos.push({
          ...todo,
          deletedBy: todoToDelete.resolvedBy,
          deletedFrom: todoToDelete.resolvedBy === 'index' ?
            `position ${todoToDelete.position}` :
            `ID ${todoToDelete.identifier}`
        });
        return false;
      }
      return true;
    });

    // Save changes
    const saveResult = await this.storage.saveData(this.todos);
    if (saveResult.success) {
      this.log('info', `Batch delete: deleted ${deletedTodos.length} todos by ${useIndex ? 'indices' : 'IDs'}`);

      // Record deletion for undo capability
      const deletionId = this.undoManager.recordDeletion({
        type: 'batch',
        deletedTodos: deletedTodos.map(todo => {
          // Remove batch-specific metadata for clean undo
          const { deletedBy, deletedFrom, ...cleanTodo } = todo;
          return cleanTodo;
        }),
        metadata: {
          deletionMethod: useIndex ? 'batch-index' : 'batch-id',
          originalPositions,
          totalBefore: originalTodos.length,
          totalAfter: this.todos.length,
          processed: identifiers.length,
          found: todosToDelete.length
        },
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        deleted: deletedTodos,
        count: deletedTodos.length,
        processed: identifiers.length,
        found: todosToDelete.length,
        errors: errors,
        notFound: notFound,
        remaining: this.todos.length,
        method: useIndex ? 'index' : 'id',
        deletionId, // Include deletion ID for potential undo
        storage: {
          saved: true,
          count: saveResult.metadata.count,
          location: saveResult.metadata.location
        },
        message: `Successfully deleted ${deletedTodos.length} todos by ${useIndex ? 'indices' : 'IDs'}`
      };
    } else {
      // Revert changes since save failed
      this.todos = originalTodos;
      return {
        success: false,
        error: saveResult.error || 'Failed to save after batch delete',
        attempted: deletedTodos.length,
        storage: { saved: false }
      };
    }
  }

  /**
   * Preview batch delete operation (dry run)
   * @param {Array} identifiers - Array of todo IDs or indices
   * @param {Object} options - Options for preview
   * @returns {Object} Preview result
   */
  async previewBatchDelete(identifiers, options = {}) {
    return await this.batchDeleteTodos(identifiers, { ...options, dryRun: true });
  }

  /**
   * Update a todo item
   */
  async updateTodo(id, updates) {
    await this.ensureInitialized();

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

    // Store original values for rollback
    const originalValues = {};
    if (updates.description !== undefined) {
      originalValues.description = todo.description;
      todo.description = updates.description.trim();
    }
    if (updates.priority !== undefined) {
      originalValues.priority = todo.priority;
      todo.priority = updates.priority;
    }
    if (updates.dueDate !== undefined) {
      originalValues.dueDate = todo.dueDate;
      todo.dueDate = updates.dueDate;
    }
    if (updates.tags !== undefined) {
      originalValues.tags = [...todo.tags];
      todo.tags = updates.tags.map(tag => tag.trim()).filter(tag => tag.length > 0);
    }

    const saveResult = await this.storage.saveData(this.todos);
    if (saveResult.success) {
      return {
        success: true,
        todo,
        storage: {
          saved: true,
          count: saveResult.metadata.count,
          location: saveResult.metadata.location
        }
      };
    } else {
      // Rollback changes since save failed
      Object.keys(originalValues).forEach(key => {
        todo[key] = originalValues[key];
      });
      return {
        success: false,
        error: saveResult.error || 'Failed to save todo',
        storage: { saved: false }
      };
    }
  }

  /**
   * Query methods
   */
  async listTodosByPriority(priority) {
    await this.ensureInitialized();
    if (!['low', 'medium', 'high'].includes(priority)) {
      return [];
    }
    return this.todos.filter(todo => todo.priority === priority);
  }

  async listTodosByTag(tag) {
    await this.ensureInitialized();
    return this.todos.filter(todo => todo.tags.includes(tag));
  }

  async getTodoById(id) {
    await this.ensureInitialized();
    const numId = parseInt(id);
    if (isNaN(numId)) {
      return null;
    }
    return this.todos.find(todo => todo.id === numId) || null;
  }

  async getOverdueTodos() {
    await this.ensureInitialized();
    const now = new Date().toISOString();
    return this.todos.filter(todo =>
      !todo.completed &&
      todo.dueDate &&
      todo.dueDate < now
    );
  }

  async getDueTodosToday() {
    await this.ensureInitialized();
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format

    return this.todos.filter(todo =>
      !todo.completed &&
      todo.dueDate &&
      todo.dueDate.startsWith(todayStr)
    );
  }

  async getAllTags() {
    await this.ensureInitialized();
    const tagSet = new Set();
    this.todos.forEach(todo => {
      todo.tags.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }

  /**
   * Storage management methods
   */
  async createBackup() {
    await this.ensureInitialized();
    return await this.storage.createBackup();
  }

  async restoreFromBackup() {
    await this.ensureInitialized();
    const result = await this.storage.restoreFromBackup();
    if (result.success) {
      this.todos = result.data;
      this.nextId = this.getNextId();
    }
    return result;
  }

  async cleanup() {
    await this.ensureInitialized();
    return await this.storage.cleanup();
  }

  /**
   * Migration and Recovery Methods
   */

  /**
   * Get migration status for current data
   */
  async getMigrationStatus() {
    await this.ensureInitialized();
    return this.migrationManager.getMigrationStatus(this.todos);
  }

  /**
   * Manually trigger data migration
   */
  async migrateData(targetVersion = null) {
    await this.ensureInitialized();

    const currentData = {
      version: this.migrationManager.currentVersion,
      todos: this.todos
    };

    const migrationResult = await this.migrationManager.migrateData(currentData, targetVersion);

    if (migrationResult.success && migrationResult.migrations.length > 0) {
      // Create backup before migration
      await this.migrationManager.createMigrationBackup(currentData, migrationResult);

      // Apply migration to in-memory data
      this.todos = this.extractTodoArray(migrationResult.data);
      this.nextId = this.getNextId();

      // Save migrated data (extract todos array for storage)
      const todosToSave = this.extractTodoArray(migrationResult.data);
      const saveResult = await this.storage.saveData(todosToSave);
      if (!saveResult.success) {
        this.log('error', `Failed to save migrated data: ${saveResult.error}`);
        migrationResult.saveError = saveResult.error;
      }
    }

    return migrationResult;
  }

  /**
   * Create a manual backup
   */
  async createBackup(reason = 'manual') {
    await this.ensureInitialized();
    return await this.recoveryManager.createManualBackup(this.todos, reason);
  }

  /**
   * List available backups
   */
  getAvailableBackups() {
    return this.recoveryManager.getAvailableBackups();
  }

  /**
   * Restore from a specific backup
   */
  async restoreFromSpecificBackup(backupPath, options = {}) {
    await this.ensureInitialized();

    const restoreResult = await this.recoveryManager.restoreFromBackup(backupPath, options);

    if (restoreResult.success) {
      // Update in-memory data
      this.todos = restoreResult.todos;
      this.nextId = this.getNextId();

      // Save restored data to storage
      const saveResult = await this.storage.saveData(this.todos);
      if (!saveResult.success) {
        this.log('error', `Failed to save restored data: ${saveResult.error}`);
        restoreResult.saveError = saveResult.error;
      }
    }

    return restoreResult;
  }

  /**
   * Export todos to various formats
   */
  async exportTodos(format = 'json', options = {}) {
    await this.ensureInitialized();
    return await this.recoveryManager.exportTodos(this.todos, format, options);
  }

  /**
   * Import todos from external files
   */
  async importTodos(filePath, options = {}) {
    await this.ensureInitialized();

    const importResult = await this.recoveryManager.importTodos(filePath, options);

    if (importResult.success) {
      // Create backup before import if requested
      if (options.createBackupBeforeImport !== false && this.todos.length > 0) {
        await this.createBackup('pre-import');
      }

      // Add imported todos to current data
      if (options.replaceExisting) {
        this.todos = importResult.todos;
      } else {
        this.todos.push(...importResult.todos);
      }

      this.nextId = this.getNextId();

      // Save updated data
      const saveResult = await this.storage.saveData(this.todos);
      if (!saveResult.success) {
        this.log('error', `Failed to save imported data: ${saveResult.error}`);
        importResult.saveError = saveResult.error;
      }
    }

    return importResult;
  }

  /**
   * Cleanup old backups
   */
  async cleanupBackups(options = {}) {
    return await this.recoveryManager.cleanupBackups(options);
  }

  /**
   * Get recovery statistics
   */
  getRecoveryStats() {
    return this.recoveryManager.getRecoveryStats();
  }

  /**
   * Get available migration backups
   */
  getAvailableMigrationBackups() {
    return this.migrationManager.getAvailableMigrationBackups();
  }

  /**
   * Cleanup migration backups
   */
  async cleanupMigrationBackups(keepCount = 5) {
    return await this.migrationManager.cleanupMigrationBackups(keepCount);
  }

  async close() {
    if (this.storage) {
      await this.storage.close();
    }
    this.isInitialized = false;
  }

  /**
   * Undo Methods - Restore recently deleted todos
   */

  /**
   * Get recent deletions that can be undone
   * @param {number} limit - Maximum number of entries to return
   * @returns {Array} - Array of recent deletion summaries
   */
  getRecentDeletions(limit = 10) {
    return this.undoManager.getRecentDeletions(limit);
  }

  /**
   * Undo a specific deletion by its ID
   * @param {string} deletionId - ID of the deletion to undo
   * @returns {Object} - Result with success status and restored todos
   */
  async undoDeletion(deletionId) {
    await this.ensureInitialized();

    const undoResult = this.undoManager.undoDeletion(deletionId, this.todos);

    if (!undoResult.success) {
      return undoResult;
    }

    try {
      // Add restored todos back to the list
      const restoredTodos = undoResult.restoredTodos;

      // For optimal user experience, try to restore todos at their original positions
      // However, this is complex due to potential conflicts, so we'll append them for now
      restoredTodos.forEach(todo => {
        // Ensure the todo has a unique ID that doesn't conflict
        while (this.todos.find(t => t.id === todo.id)) {
          todo.id = this.getNextId();
        }
        this.todos.push(todo);
      });

      // Update next ID to avoid conflicts
      this.nextId = this.getNextId();

      // Save the restored state
      const saveResult = await this.storage.saveData(this.todos);

      if (saveResult.success) {
        this.log('info', `Undid ${undoResult.deletionType} deletion, restored ${restoredTodos.length} todos`);

        return {
          success: true,
          restoredTodos,
          deletionType: undoResult.deletionType,
          restoredCount: restoredTodos.length,
          metadata: undoResult.metadata,
          storage: {
            saved: true,
            count: saveResult.metadata.count,
            location: saveResult.metadata.location
          }
        };
      } else {
        // Revert the restoration since save failed
        restoredTodos.forEach(todo => {
          const index = this.todos.findIndex(t => t.id === todo.id);
          if (index !== -1) {
            this.todos.splice(index, 1);
          }
        });

        return {
          success: false,
          error: `Undo succeeded but save failed: ${saveResult.error}`,
          storage: { saved: false }
        };
      }
    } catch (error) {
      this.log('error', `Failed to complete undo operation: ${error.message}`);
      return {
        success: false,
        error: `Failed to restore todos: ${error.message}`
      };
    }
  }

  /**
   * Undo the most recent deletion
   * @returns {Object} - Result with success status and restored todos
   */
  async undoLastDeletion() {
    await this.ensureInitialized();

    const recentDeletion = this.undoManager.getMostRecentDeletion();

    if (!recentDeletion) {
      return {
        success: false,
        error: 'No recent deletions available to undo'
      };
    }

    return await this.undoDeletion(recentDeletion.id);
  }

  /**
   * Get undo manager statistics
   * @returns {Object} - Statistics about undo history
   */
  getUndoStats() {
    return this.undoManager.getStats();
  }

  /**
   * Clear all undo history
   * @returns {Object} - Result with cleared count
   */
  clearUndoHistory() {
    return this.undoManager.clearHistory();
  }

  /**
   * Subscribe to storage events
   */
  on(event, callback) {
    if (this.storage && typeof this.storage.on === 'function') {
      this.storage.on(event, callback);
    }
  }

  /**
   * Unsubscribe from storage events
   */
  off(event, callback) {
    if (this.storage && typeof this.storage.off === 'function') {
      this.storage.off(event, callback);
    }
  }
}

// For backward compatibility, provide synchronous wrapper
// This simulates the original TodoCore behavior by handling async operations
// in the background while maintaining sync API
class TodoCoreSync {
  constructor(dataFile = null, config = null) {
    // Use the original TodoCore implementation from todo-core.js for backward compatibility
    // This ensures all existing code continues to work exactly as before
    const { TodoCore: OriginalTodoCore } = require('./todo-core');
    this.originalCore = new OriginalTodoCore(dataFile, config);
    this.config = this.originalCore.config;
  }

  addTodo(description, options = {}) {
    return this.originalCore.addTodo(description, options);
  }

  listTodos() {
    return this.originalCore.listTodos();
  }

  completeTodo(id) {
    return this.originalCore.completeTodo(id);
  }

  incompleteTodo(id) {
    return this.originalCore.incompleteTodo(id);
  }

  deleteTodo(id) {
    return this.originalCore.deleteTodo(id);
  }

  updateTodo(id, updates) {
    return this.originalCore.updateTodo(id, updates);
  }

  getTodoById(id) {
    return this.originalCore.getTodoById(id);
  }

  listTodosByPriority(priority) {
    return this.originalCore.listTodosByPriority(priority);
  }

  listTodosByTag(tag) {
    return this.originalCore.listTodosByTag(tag);
  }

  getOverdueTodos() {
    return this.originalCore.getOverdueTodos();
  }

  getDueTodosToday() {
    return this.originalCore.getDueTodosToday();
  }

  getAllTags() {
    return this.originalCore.getAllTags();
  }

  getStorageStats() {
    return this.originalCore.getStorageStats();
  }
}

module.exports = {
  TodoCoreEnhanced,
  // For backward compatibility with existing sync API
  TodoCore: TodoCoreSync
};