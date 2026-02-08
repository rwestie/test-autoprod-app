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

module.exports = {
  TodoCore,
  add_todo,
  list_todos,
  complete_todo,
  delete_todo,
  bulk_delete_todos,
  bulk_delete_completed,
  bulk_delete_all
};