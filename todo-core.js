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
    // Handle edge case: empty todo list
    if (this.todos.length === 0) {
      return { success: false, error: 'No todos available to delete' };
    }

    // Handle edge case: null or undefined identifier
    if (id === null || id === undefined) {
      return { success: false, error: 'ID is required' };
    }

    const numId = parseInt(id);
    if (isNaN(numId)) {
      return { success: false, error: 'Invalid ID format - must be a number' };
    }

    const todoIndex = this.todos.findIndex(t => t.id === numId);
    if (todoIndex === -1) {
      return { success: false, error: `Todo with ID ${numId} not found` };
    }

    const todo = this.todos[todoIndex];

    // Create a backup copy for atomic operation rollback
    const todoBackup = { ...todo };

    // Perform the deletion
    this.todos.splice(todoIndex, 1);

    // Attempt to save with error recovery
    if (this.saveTodos()) {
      return {
        success: true,
        todo: todoBackup,
        message: `Todo deleted successfully (ID: ${todoBackup.id})`
      };
    } else {
      // Restore the todo if save failed (rollback for atomic operation)
      this.todos.splice(todoIndex, 0, todoBackup);
      return { success: false, error: 'Failed to save changes - deletion rolled back' };
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

module.exports = {
  TodoCore,
  add_todo,
  list_todos,
  complete_todo,
  delete_todo
};