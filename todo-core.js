const fs = require('fs');

class TodoCore {
  constructor(dataFile = './todos.json') {
    this.dataFile = dataFile;
    this.todos = this.loadTodos();
    this.nextId = this.getNextId();
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

  getNextId() {
    if (this.todos.length === 0) return 1;
    return Math.max(...this.todos.map(todo => todo.id)) + 1;
  }

  addTodo(description) {
    if (!description || description.trim().length === 0) {
      return { success: false, error: 'Description is required' };
    }

    const todo = {
      id: this.nextId++,
      description: description.trim(),
      completed: false,
      archived: false,
      createdAt: new Date().toISOString()
    };

    this.todos.push(todo);

    if (this.saveTodos()) {
      return { success: true, todo };
    } else {
      return { success: false, error: 'Failed to save todo' };
    }
  }

  listTodos(options = {}) {
    let filteredTodos = this.todos.slice();

    // Filter by archive status
    if (options.includeArchived === false) {
      filteredTodos = filteredTodos.filter(todo => !todo.archived);
    } else if (options.archivedOnly === true) {
      filteredTodos = filteredTodos.filter(todo => todo.archived);
    }
    // Default behavior includes all todos (archived and non-archived)

    return filteredTodos;
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

  archiveTodo(id) {
    const numId = parseInt(id);
    if (isNaN(numId)) {
      return { success: false, error: 'Invalid ID format' };
    }

    const todo = this.todos.find(t => t.id === numId);
    if (!todo) {
      return { success: false, error: `Todo with ID ${numId} not found` };
    }

    if (todo.archived) {
      return { success: true, message: `Todo #${todo.id} was already archived` };
    }

    todo.archived = true;
    todo.archivedAt = new Date().toISOString();

    if (this.saveTodos()) {
      return { success: true, todo };
    } else {
      return { success: false, error: 'Failed to save todo' };
    }
  }

  unarchiveTodo(id) {
    const numId = parseInt(id);
    if (isNaN(numId)) {
      return { success: false, error: 'Invalid ID format' };
    }

    const todo = this.todos.find(t => t.id === numId);
    if (!todo) {
      return { success: false, error: `Todo with ID ${numId} not found` };
    }

    if (!todo.archived) {
      return { success: true, message: `Todo #${todo.id} was not archived` };
    }

    todo.archived = false;
    delete todo.archivedAt;

    if (this.saveTodos()) {
      return { success: true, todo };
    } else {
      return { success: false, error: 'Failed to save todo' };
    }
  }

  deleteTodo(identifier) {
    // Handle edge case: empty todo list
    if (this.todos.length === 0) {
      return { success: false, error: 'No todos available to delete' };
    }

    // Handle edge case: null or undefined identifier
    if (identifier === null || identifier === undefined) {
      return { success: false, error: 'Identifier is required' };
    }

    const idOrIndex = parseInt(identifier);
    if (isNaN(idOrIndex)) {
      return { success: false, error: 'Invalid identifier format - must be a number' };
    }

    let todoIndex = -1;
    let todo = null;
    let deletionMethod = '';

    // Try ID-based deletion first (primary method)
    todoIndex = this.todos.findIndex(t => t.id === idOrIndex);
    if (todoIndex !== -1) {
      todo = this.todos[todoIndex];
      deletionMethod = 'ID';
    } else {
      // Try index-based deletion (0-based indexing for internal, 1-based for user convenience)
      const userIndex = idOrIndex - 1; // Convert 1-based user input to 0-based array index

      if (userIndex < 0 || userIndex >= this.todos.length) {
        return {
          success: false,
          error: `Invalid position ${idOrIndex}. Available positions: 1-${this.todos.length}. Use "list" to see todos with their IDs and positions.`
        };
      }

      todoIndex = userIndex;
      todo = this.todos[todoIndex];
      deletionMethod = 'position';
    }

    // Create a backup copy of the todo before deletion
    const todoBackup = { ...todo };

    // Perform the deletion
    this.todos.splice(todoIndex, 1);

    // Attempt to save with error recovery
    if (this.saveTodos()) {
      return {
        success: true,
        todo: todoBackup,
        method: deletionMethod,
        message: deletionMethod === 'ID'
          ? `Todo deleted by ID ${todoBackup.id}`
          : `Todo deleted by position ${idOrIndex} (ID: ${todoBackup.id})`
      };
    } else {
      // Restore the todo if save failed (rollback)
      this.todos.splice(todoIndex, 0, todoBackup);
      return { success: false, error: 'Failed to save changes - deletion rolled back' };
    }
  }

  // Additional method for deletion by index specifically (0-based for API consistency)
  deleteTodoByIndex(index) {
    // Handle edge case: empty todo list
    if (this.todos.length === 0) {
      return { success: false, error: 'No todos available to delete' };
    }

    const arrayIndex = parseInt(index);
    if (isNaN(arrayIndex)) {
      return { success: false, error: 'Invalid index format - must be a number' };
    }

    if (arrayIndex < 0 || arrayIndex >= this.todos.length) {
      return {
        success: false,
        error: `Index out of bounds. Valid range: 0-${this.todos.length - 1}`
      };
    }

    const todo = this.todos[arrayIndex];
    const todoBackup = { ...todo };

    this.todos.splice(arrayIndex, 1);

    if (this.saveTodos()) {
      return {
        success: true,
        todo: todoBackup,
        method: 'index',
        message: `Todo deleted by index ${arrayIndex} (ID: ${todoBackup.id})`
      };
    } else {
      // Restore the todo if save failed (rollback)
      this.todos.splice(arrayIndex, 0, todoBackup);
      return { success: false, error: 'Failed to save changes - deletion rolled back' };
    }
  }

  // Bulk delete completed todos
  bulkDeleteCompleted() {
    // Get completed todos before deletion for reporting
    const completedTodos = this.todos.filter(todo => todo.completed);

    if (completedTodos.length === 0) {
      return {
        success: true,
        deletedCount: 0,
        message: 'No completed todos to delete'
      };
    }

    // Create backup for rollback in case save fails
    const todosBackup = [...this.todos];

    // Remove completed todos
    this.todos = this.todos.filter(todo => !todo.completed);

    // Try to save the changes
    if (this.saveTodos()) {
      return {
        success: true,
        deletedCount: completedTodos.length,
        deletedTodos: completedTodos,
        message: `Successfully deleted ${completedTodos.length} completed todo${completedTodos.length === 1 ? '' : 's'}`
      };
    } else {
      // Restore the todos if save failed (rollback)
      this.todos = todosBackup;
      return {
        success: false,
        error: 'Failed to save changes - bulk deletion rolled back'
      };
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

function delete_todo(identifier) {
  const core = new TodoCore();
  return core.deleteTodo(identifier);
}

function delete_todo_by_index(index) {
  const core = new TodoCore();
  return core.deleteTodoByIndex(index);
}

function bulk_delete_completed() {
  const core = new TodoCore();
  return core.bulkDeleteCompleted();
}

function archive_todo(id) {
  const core = new TodoCore();
  return core.archiveTodo(id);
}

function unarchive_todo(id) {
  const core = new TodoCore();
  return core.unarchiveTodo(id);
}

module.exports = {
  TodoCore,
  add_todo,
  list_todos,
  complete_todo,
  delete_todo,
  delete_todo_by_index,
  bulk_delete_completed,
  archive_todo,
  unarchive_todo
};