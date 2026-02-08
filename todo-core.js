const fs = require('fs');

class TodoCore {
  constructor(dataFile = './todos.json') {
    this.dataFile = dataFile;
    this.undoHistoryFile = dataFile.replace('.json', '.undo.json');
    this.todos = this.loadTodos();
    this.nextId = this.getNextId();
    this.undoHistory = this.loadUndoHistory(); // History of delete operations for undo functionality
    this.maxUndoHistory = 10; // Maximum number of operations to keep in history
  }

  loadTodos() {
    try {
      if (fs.existsSync(this.dataFile)) {
        const data = fs.readFileSync(this.dataFile, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading todos:', error.message);
    }
    return [];
  }

  saveTodos() {
    try {
      fs.writeFileSync(this.dataFile, JSON.stringify(this.todos, null, 2));
      return true;
    } catch (error) {
      console.error('Error saving todos:', error.message);
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

  saveUndoHistory() {
    try {
      fs.writeFileSync(this.undoHistoryFile, JSON.stringify(this.undoHistory, null, 2));
      return true;
    } catch (error) {
      console.error('Error saving undo history:', error.message);
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

  // Undo the last delete operation
  undoLastDelete() {
    if (this.undoHistory.length === 0) {
      return { success: false, error: 'No delete operations to undo' };
    }

    const lastOperation = this.undoHistory.pop();

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

    if (this.saveTodos()) {
      // Save undo history (operation was removed from history)
      this.saveUndoHistory();

      return {
        success: true,
        operation: lastOperation,
        restoredTodos: restoredSuccessfully,
        restoredCount: restoredSuccessfully.length,
        conflictingIds: conflictingIds.length > 0 ? conflictingIds : undefined,
        totalCount: this.todos.length
      };
    } else {
      // If save fails, restore the undo history
      this.undoHistory.push(lastOperation);
      this.saveUndoHistory();
      // Reload todos to restore original state
      this.todos = this.loadTodos();
      return { success: false, error: 'Failed to save restored todos' };
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

    if (this.saveTodos()) {
      // Add to undo history
      this.addToUndoHistory({
        type: 'single-delete',
        deletedTodos: [{ ...todo }],
        deletedCount: 1
      });

      return { success: true, todo };
    } else {
      return { success: false, error: 'Failed to save todo' };
    }
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

    // Remove todos from the list
    this.todos = this.todos.filter(todo => !numIds.includes(todo.id));

    if (this.saveTodos()) {
      // Add to undo history
      this.addToUndoHistory({
        type: 'bulk-delete-ids',
        deletedTodos: deletedTodos.map(todo => ({ ...todo })),
        deletedCount: deletedTodos.length,
        originalIds: numIds
      });

      return {
        success: true,
        deletedTodos,
        deletedCount: deletedTodos.length,
        notFoundIds: notFoundIds.length > 0 ? notFoundIds : undefined,
        originalCount: originalTodosLength,
        remainingCount: this.todos.length
      };
    } else {
      // Restore todos if saving failed
      this.todos = this.loadTodos();
      return { success: false, error: 'Failed to save changes' };
    }
  }

  bulkDeleteCompleted() {
    const completedTodos = this.todos.filter(todo => todo.completed);

    if (completedTodos.length === 0) {
      return { success: false, error: 'No completed todos found to delete' };
    }

    const originalTodosLength = this.todos.length;

    // Remove completed todos
    this.todos = this.todos.filter(todo => !todo.completed);

    if (this.saveTodos()) {
      // Add to undo history
      this.addToUndoHistory({
        type: 'bulk-delete-completed',
        deletedTodos: completedTodos.map(todo => ({ ...todo })),
        deletedCount: completedTodos.length
      });

      return {
        success: true,
        deletedTodos: completedTodos,
        deletedCount: completedTodos.length,
        originalCount: originalTodosLength,
        remainingCount: this.todos.length
      };
    } else {
      // Restore todos if saving failed
      this.todos = this.loadTodos();
      return { success: false, error: 'Failed to save changes' };
    }
  }

  bulkDeleteAll() {
    const allTodos = [...this.todos];

    if (allTodos.length === 0) {
      return { success: false, error: 'No todos found to delete' };
    }

    const originalTodosLength = this.todos.length;

    // Clear all todos
    this.todos = [];

    if (this.saveTodos()) {
      // Add to undo history
      this.addToUndoHistory({
        type: 'bulk-delete-all',
        deletedTodos: allTodos.map(todo => ({ ...todo })),
        deletedCount: allTodos.length
      });

      return {
        success: true,
        deletedTodos: allTodos,
        deletedCount: allTodos.length,
        originalCount: originalTodosLength,
        remainingCount: 0
      };
    } else {
      // Restore todos if saving failed
      this.todos = this.loadTodos();
      return { success: false, error: 'Failed to save changes' };
    }
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