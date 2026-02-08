const fs = require('fs');
const path = require('path');

class TodoCore {
  constructor(dataFile = './todos.json') {
    this.dataFile = dataFile;
    this.undoHistoryFile = dataFile.replace('.json', '.undo.json');
    this.backupDir = path.join(path.dirname(dataFile), '.todo-backups');
    this.lockFile = dataFile + '.lock';
    this.todos = this.loadTodos();
    this.nextId = this.getNextId();
    this.undoHistory = this.loadUndoHistory(); // History of delete operations for undo functionality
    this.maxUndoHistory = 10; // Maximum number of operations to keep in history

    // Ensure backup directory exists
    this.ensureBackupDirectory();
  }

  loadTodos() {
    try {
      if (fs.existsSync(this.dataFile)) {
        const data = fs.readFileSync(this.dataFile, 'utf8');
        const todos = JSON.parse(data);

        // Validate data integrity on load
        this.validateTodoData(todos);
        return todos;
      }
    } catch (error) {
      console.error('Error loading todos:', error.message);

      // Try to recover from backup
      const recoveredData = this.recoverFromBackup();
      if (recoveredData) {
        console.log('Successfully recovered todo data from backup');
        return recoveredData;
      }
    }
    return [];
  }

  // Ensure backup directory exists
  ensureBackupDirectory() {
    try {
      if (!fs.existsSync(this.backupDir)) {
        fs.mkdirSync(this.backupDir, { recursive: true });
      }
    } catch (error) {
      console.error('Warning: Could not create backup directory:', error.message);
    }
  }

  // Create a backup of the current data before destructive operations
  createBackup(operation = 'unknown') {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = path.join(this.backupDir, `todos-${operation}-${timestamp}.json`);

      if (fs.existsSync(this.dataFile)) {
        fs.copyFileSync(this.dataFile, backupFile);
      }

      // Also backup undo history
      const undoBackupFile = path.join(this.backupDir, `undo-${operation}-${timestamp}.json`);
      if (fs.existsSync(this.undoHistoryFile)) {
        fs.copyFileSync(this.undoHistoryFile, undoBackupFile);
      }

      // Clean up old backups (keep only last 5)
      this.cleanupOldBackups();

      return backupFile;
    } catch (error) {
      console.error('Warning: Could not create backup:', error.message);
      return null;
    }
  }

  // Clean up old backup files
  cleanupOldBackups() {
    try {
      const files = fs.readdirSync(this.backupDir);
      const todoBackups = files.filter(f => f.startsWith('todos-')).sort();
      const undoBackups = files.filter(f => f.startsWith('undo-')).sort();

      // Keep only last 5 of each type
      while (todoBackups.length > 5) {
        const oldFile = todoBackups.shift();
        fs.unlinkSync(path.join(this.backupDir, oldFile));
      }

      while (undoBackups.length > 5) {
        const oldFile = undoBackups.shift();
        fs.unlinkSync(path.join(this.backupDir, oldFile));
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  // Recover data from the most recent backup
  recoverFromBackup() {
    try {
      if (!fs.existsSync(this.backupDir)) {
        return null;
      }

      const files = fs.readdirSync(this.backupDir);
      const todoBackups = files
        .filter(f => f.startsWith('todos-') && f.endsWith('.json'))
        .sort()
        .reverse(); // Get newest first

      for (const backupFile of todoBackups) {
        try {
          const backupPath = path.join(this.backupDir, backupFile);
          const data = fs.readFileSync(backupPath, 'utf8');
          const todos = JSON.parse(data);

          // Validate the backup data
          this.validateTodoData(todos);

          // Copy backup to main file
          fs.writeFileSync(this.dataFile, data);

          console.log(`Recovered data from backup: ${backupFile}`);
          return todos;

        } catch (backupError) {
          console.error(`Backup file ${backupFile} is corrupted, trying next...`);
          continue;
        }
      }

    } catch (error) {
      console.error('Error during backup recovery:', error.message);
    }

    return null;
  }

  // Check and repair data integrity
  repairDataIntegrity() {
    try {
      // Remove any invalid todos
      const validTodos = [];
      const seenIds = new Set();

      for (const todo of this.todos) {
        try {
          // Check required fields and fix if possible
          if (typeof todo.id !== 'number' || todo.id <= 0) {
            console.warn(`Skipping todo with invalid ID: ${todo.id}`);
            continue;
          }

          if (typeof todo.description !== 'string') {
            console.warn(`Skipping todo ${todo.id} with invalid description`);
            continue;
          }

          if (typeof todo.completed !== 'boolean') {
            // Try to fix
            todo.completed = Boolean(todo.completed);
          }

          if (!todo.createdAt) {
            // Add missing timestamp
            todo.createdAt = new Date().toISOString();
          } else if (isNaN(new Date(todo.createdAt).getTime())) {
            // Fix invalid timestamp
            todo.createdAt = new Date().toISOString();
          }

          // Check for duplicate IDs
          if (seenIds.has(todo.id)) {
            console.warn(`Duplicate ID ${todo.id} found, assigning new ID`);
            todo.id = this.getNextAvailableId(seenIds);
          }

          seenIds.add(todo.id);
          validTodos.push(todo);

        } catch (todoError) {
          console.warn(`Skipping corrupted todo: ${todoError.message}`);
        }
      }

      // Update todos with repaired data
      this.todos = validTodos;
      this.nextId = this.getNextId();

      // Save repaired data
      if (validTodos.length !== this.todos.length) {
        console.log(`Data integrity repair completed: ${validTodos.length} todos retained`);
        this.saveTodos();
      }

      return true;

    } catch (error) {
      console.error('Error during data repair:', error.message);
      return false;
    }
  }

  // Get next available ID that's not in the seen set
  getNextAvailableId(seenIds) {
    let id = Math.max(...Array.from(seenIds), 0) + 1;
    while (seenIds.has(id)) {
      id++;
    }
    return id;
  }

  // Validate todo data structure
  validateTodoData(todos = this.todos) {
    if (!Array.isArray(todos)) {
      throw new Error('Todo data must be an array');
    }

    const seenIds = new Set();
    for (const todo of todos) {
      // Check required fields
      if (typeof todo.id !== 'number' || todo.id <= 0) {
        throw new Error(`Invalid todo ID: ${todo.id}`);
      }

      if (typeof todo.description !== 'string' || todo.description.trim().length === 0) {
        throw new Error(`Invalid todo description for ID ${todo.id}`);
      }

      if (typeof todo.completed !== 'boolean') {
        throw new Error(`Invalid completed status for todo ID ${todo.id}`);
      }

      if (!todo.createdAt || isNaN(new Date(todo.createdAt).getTime())) {
        throw new Error(`Invalid createdAt date for todo ID ${todo.id}`);
      }

      // Check for duplicate IDs
      if (seenIds.has(todo.id)) {
        throw new Error(`Duplicate todo ID found: ${todo.id}`);
      }
      seenIds.add(todo.id);
    }

    return true;
  }

  // Atomic save operation with validation and rollback capability
  saveTodos() {
    try {
      // Validate data before saving
      this.validateTodoData();

      // Create atomic write by writing to temp file first
      const tempFile = this.dataFile + '.tmp';
      const dataToSave = JSON.stringify(this.todos, null, 2);

      fs.writeFileSync(tempFile, dataToSave);

      // Atomically replace the original file
      fs.renameSync(tempFile, this.dataFile);

      return true;
    } catch (error) {
      console.error('Error saving todos:', error.message);

      // Clean up temp file if it exists
      const tempFile = this.dataFile + '.tmp';
      try {
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      } catch (cleanupError) {
        // Ignore cleanup errors
      }

      return false;
    }
  }

  loadUndoHistory() {
    try {
      if (fs.existsSync(this.undoHistoryFile)) {
        const data = fs.readFileSync(this.undoHistoryFile, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading undo history:', error.message);
    }
    return [];
  }

  // Atomic save operation for undo history
  saveUndoHistory() {
    try {
      // Create atomic write by writing to temp file first
      const tempFile = this.undoHistoryFile + '.tmp';
      const dataToSave = JSON.stringify(this.undoHistory, null, 2);

      fs.writeFileSync(tempFile, dataToSave);

      // Atomically replace the original file
      fs.renameSync(tempFile, this.undoHistoryFile);

      return true;
    } catch (error) {
      console.error('Error saving undo history:', error.message);

      // Clean up temp file if it exists
      const tempFile = this.undoHistoryFile + '.tmp';
      try {
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      } catch (cleanupError) {
        // Ignore cleanup errors
      }

      return false;
    }
  }

  getNextId() {
    if (this.todos.length === 0) return 1;
    return Math.max(...this.todos.map(todo => todo.id)) + 1;
  }

  // Add a delete operation to the undo history
  addToUndoHistory(operation) {
    this.undoHistory.push({
      ...operation,
      timestamp: new Date().toISOString()
    });

    // Limit history size
    if (this.undoHistory.length > this.maxUndoHistory) {
      this.undoHistory.shift();
    }

    // Save to disk
    this.saveUndoHistory();
  }

  // Get the last undoable operation
  getLastUndoOperation() {
    return this.undoHistory.length > 0 ? this.undoHistory[this.undoHistory.length - 1] : null;
  }

  // Clear undo history
  clearUndoHistory() {
    this.undoHistory = [];
    this.saveUndoHistory();
  }

  // Undo the last delete operation with transaction-like behavior
  undoLastDelete() {
    if (this.undoHistory.length === 0) {
      return { success: false, error: 'No delete operations to undo' };
    }

    // Create backup before undo operation
    const backupFile = this.createBackup('undo');

    // Store original state for rollback
    const originalTodos = [...this.todos];
    const originalUndoHistory = [...this.undoHistory];
    const originalNextId = this.nextId;

    try {
      const lastOperation = originalUndoHistory.pop();

      // Restore deleted todos
      const restoredTodos = lastOperation.deletedTodos;
      const conflictingIds = [];
      const restoredSuccessfully = [];

      for (const todo of restoredTodos) {
        // Check if a todo with this ID already exists
        if (this.todos.find(t => t.id === todo.id)) {
          conflictingIds.push(todo.id);
        } else {
          this.todos.push(todo);
          restoredSuccessfully.push(todo);
        }
      }

      // Sort todos by ID to maintain order
      this.todos.sort((a, b) => a.id - b.id);

      // Update nextId if necessary
      if (this.todos.length > 0) {
        this.nextId = Math.max(this.nextId, ...this.todos.map(t => t.id)) + 1;
      }

      // Validate data integrity
      this.validateTodoData();

      // Save todos with atomic operation
      if (!this.saveTodos()) {
        throw new Error('Failed to save restored todos');
      }

      // Update undo history (operation was removed from history)
      this.undoHistory = originalUndoHistory.slice(0, -1);
      if (!this.saveUndoHistory()) {
        throw new Error('Failed to save undo history');
      }

      return {
        success: true,
        operation: lastOperation,
        restoredTodos: restoredSuccessfully,
        restoredCount: restoredSuccessfully.length,
        conflictingIds: conflictingIds.length > 0 ? conflictingIds : undefined,
        totalCount: this.todos.length
      };

    } catch (error) {
      // Rollback on any error
      this.todos = originalTodos;
      this.undoHistory = originalUndoHistory;
      this.nextId = originalNextId;

      // Try to restore from backup if needed
      if (backupFile && fs.existsSync(backupFile)) {
        try {
          const backupData = fs.readFileSync(backupFile, 'utf8');
          const backupTodos = JSON.parse(backupData);
          this.validateTodoData(backupTodos);
          fs.writeFileSync(this.dataFile, backupData);
        } catch (restoreError) {
          console.error('Warning: Could not restore from backup:', restoreError.message);
        }
      }

      return { success: false, error: error.message || 'Failed to complete undo operation' };
    }
  }

  addTodo(description) {
    if (!description || description.trim().length === 0) {
      return { success: false, error: 'Description is required' };
    }

    const todo = {
      id: this.nextId++,
      description: description.trim(),
      completed: false,
      createdAt: new Date().toISOString()
    };

    this.todos.push(todo);

    if (this.saveTodos()) {
      return { success: true, todo };
    } else {
      return { success: false, error: 'Failed to save todo' };
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

    if (this.saveTodos()) {
      return { success: true, todo };
    } else {
      return { success: false, error: 'Failed to save todo' };
    }
  }

  // Execute a deletion operation with full transaction-like behavior
  executeDeleteOperation(operationType, deleteFn, undoData) {
    // Create backup before destructive operation
    const backupFile = this.createBackup(operationType);

    // Store original state for rollback
    const originalTodos = [...this.todos];
    const originalUndoHistory = [...this.undoHistory];

    try {
      // Execute the delete function
      const result = deleteFn();

      if (!result.success) {
        return result;
      }

      // Save todos with validation
      if (!this.saveTodos()) {
        throw new Error('Failed to save todos');
      }

      // Add to undo history
      this.addToUndoHistory(undoData);

      return result;

    } catch (error) {
      // Rollback on any error
      this.todos = originalTodos;
      this.undoHistory = originalUndoHistory;

      // Try to restore from backup if needed
      if (backupFile && fs.existsSync(backupFile)) {
        try {
          const backupData = fs.readFileSync(backupFile, 'utf8');
          const backupTodos = JSON.parse(backupData);
          this.validateTodoData(backupTodos);
          fs.writeFileSync(this.dataFile, backupData);
        } catch (restoreError) {
          console.error('Warning: Could not restore from backup:', restoreError.message);
        }
      }

      return { success: false, error: error.message || 'Failed to complete delete operation' };
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

    // Use transaction-like operation
    return this.executeDeleteOperation(
      'single-delete',
      () => {
        this.todos.splice(todoIndex, 1);
        return { success: true, todo };
      },
      {
        type: 'single-delete',
        deletedTodos: [{ ...todo }],
        deletedCount: 1
      }
    );
  }

  bulkDeleteTodos(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      return { success: false, error: 'No IDs provided for bulk deletion' };
    }

    const numIds = [];
    const invalidIds = [];

    // Validate all IDs first
    for (const id of ids) {
      const numId = parseInt(id);
      if (isNaN(numId)) {
        invalidIds.push(id);
      } else {
        numIds.push(numId);
      }
    }

    if (invalidIds.length > 0) {
      return { success: false, error: `Invalid ID format: ${invalidIds.join(', ')}` };
    }

    const deletedTodos = [];
    const notFoundIds = [];
    const originalTodosLength = this.todos.length;

    // Find todos to delete
    for (const numId of numIds) {
      const todo = this.todos.find(t => t.id === numId);
      if (todo) {
        deletedTodos.push({ ...todo });
      } else {
        notFoundIds.push(numId);
      }
    }

    if (deletedTodos.length === 0) {
      return { success: false, error: `No todos found with IDs: ${numIds.join(', ')}` };
    }

    // Use transaction-like operation
    return this.executeDeleteOperation(
      'bulk-delete-ids',
      () => {
        // Remove todos from the list
        this.todos = this.todos.filter(todo => !numIds.includes(todo.id));

        return {
          success: true,
          deletedTodos,
          deletedCount: deletedTodos.length,
          notFoundIds: notFoundIds.length > 0 ? notFoundIds : undefined,
          originalCount: originalTodosLength,
          remainingCount: this.todos.length
        };
      },
      {
        type: 'bulk-delete-ids',
        deletedTodos: deletedTodos.map(todo => ({ ...todo })),
        deletedCount: deletedTodos.length,
        originalIds: numIds
      }
    );
  }

  bulkDeleteCompleted() {
    const completedTodos = this.todos.filter(todo => todo.completed);

    if (completedTodos.length === 0) {
      return { success: false, error: 'No completed todos found to delete' };
    }

    const originalTodosLength = this.todos.length;

    // Use transaction-like operation
    return this.executeDeleteOperation(
      'bulk-delete-completed',
      () => {
        // Remove completed todos
        this.todos = this.todos.filter(todo => !todo.completed);

        return {
          success: true,
          deletedTodos: completedTodos,
          deletedCount: completedTodos.length,
          originalCount: originalTodosLength,
          remainingCount: this.todos.length
        };
      },
      {
        type: 'bulk-delete-completed',
        deletedTodos: completedTodos.map(todo => ({ ...todo })),
        deletedCount: completedTodos.length
      }
    );
  }

  bulkDeleteAll() {
    const allTodos = [...this.todos];

    if (allTodos.length === 0) {
      return { success: false, error: 'No todos found to delete' };
    }

    const originalTodosLength = this.todos.length;

    // Use transaction-like operation
    return this.executeDeleteOperation(
      'bulk-delete-all',
      () => {
        // Clear all todos
        this.todos = [];

        return {
          success: true,
          deletedTodos: allTodos,
          deletedCount: allTodos.length,
          originalCount: originalTodosLength,
          remainingCount: 0
        };
      },
      {
        type: 'bulk-delete-all',
        deletedTodos: allTodos.map(todo => ({ ...todo })),
        deletedCount: allTodos.length
      }
    );
  }
}

// Functional API
function add_todo(description) {
  const core = new TodoCore();
  return core.addTodo(description);
}

function list_todos() {
  const core = new TodoCore();
  return core.listTodos();
}

function complete_todo(id) {
  const core = new TodoCore();
  return core.completeTodo(id);
}

function delete_todo(id) {
  const core = new TodoCore();
  return core.deleteTodo(id);
}

function bulk_delete_todos(ids) {
  const core = new TodoCore();
  return core.bulkDeleteTodos(ids);
}

function bulk_delete_completed() {
  const core = new TodoCore();
  return core.bulkDeleteCompleted();
}

function bulk_delete_all() {
  const core = new TodoCore();
  return core.bulkDeleteAll();
}

function undo_last_delete() {
  const core = new TodoCore();
  return core.undoLastDelete();
}

function get_last_undo_operation() {
  const core = new TodoCore();
  return core.getLastUndoOperation();
}

module.exports = {
  TodoCore,
  add_todo,
  list_todos,
  complete_todo,
  delete_todo,
  bulk_delete_todos,
  bulk_delete_completed,
  bulk_delete_all,
  undo_last_delete,
  get_last_undo_operation
};