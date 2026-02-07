const path = require('path');
const { StorageConfig } = require('./storage-config');
const { StorageFactory } = require('./storage-registry');

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

      // Load existing todos
      const loadResult = await this.storage.loadData();
      if (loadResult.success) {
        this.todos = loadResult.data;
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
      completed: false,
      priority: options.priority || 'medium',
      tags: options.tags || [],
      createdAt: new Date().toISOString()
    };

    // Add due date if provided
    if (options.dueDate !== undefined) {
      todoData.dueDate = options.dueDate;
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
   * Delete a todo item
   */
  async deleteTodo(id) {
    await this.ensureInitialized();

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

  async close() {
    if (this.storage) {
      await this.storage.close();
    }
    this.isInitialized = false;
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