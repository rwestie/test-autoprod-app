const fs = require('fs');
const path = require('path');
const os = require('os');

class TodoCore {
  constructor(dataFile = null) {
    this.dataFile = dataFile || this.getDefaultDataFile();
    this.backupFile = this.dataFile + '.backup';
    this.tempFile = this.dataFile + '.tmp';
    this.todos = this.loadTodos();
    this.nextId = this.getNextId();
  }

  getDefaultDataFile() {
    // Use a more appropriate default location
    const homeDir = os.homedir();
    const todosDir = path.join(homeDir, '.todos');

    // Ensure the directory exists
    if (!fs.existsSync(todosDir)) {
      try {
        fs.mkdirSync(todosDir, { recursive: true });
      } catch (error) {
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
      return todo &&
             typeof todo.id === 'number' &&
             typeof todo.description === 'string' &&
             typeof todo.completed === 'boolean' &&
             typeof todo.createdAt === 'string';
    });
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

  saveTodos() {
    try {
      // Create backup of current file before saving
      if (fs.existsSync(this.dataFile)) {
        fs.copyFileSync(this.dataFile, this.backupFile);
        console.log(`💾 Created backup before saving changes`);
      }

      // Atomic write: write to temp file first, then rename
      const data = JSON.stringify(this.todos, null, 2);
      fs.writeFileSync(this.tempFile, data);

      // Verify the temp file can be parsed before finalizing
      const verification = fs.readFileSync(this.tempFile, 'utf8');
      JSON.parse(verification); // This will throw if invalid JSON

      // Atomic move to final location
      fs.renameSync(this.tempFile, this.dataFile);

      console.log(`✅ Successfully saved ${this.todos.length} todo${this.todos.length === 1 ? '' : 's'} to storage`);
      return { success: true, count: this.todos.length, location: this.dataFile };
    } catch (error) {
      console.error(`❌ Error saving todos to ${this.dataFile}:`, error.message);

      // Clean up temp file if it exists
      if (fs.existsSync(this.tempFile)) {
        try {
          fs.unlinkSync(this.tempFile);
          console.log('🧹 Cleaned up temporary file after save failure');
        } catch (cleanupError) {
          console.error('❌ Error cleaning up temp file:', cleanupError.message);
        }
      }

      return { success: false, error: error.message };
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

    const saveResult = this.saveTodos();
    if (saveResult.success) {
      return { success: true, todo, storage: { saved: true, count: saveResult.count, location: saveResult.location } };
    } else {
      return { success: false, error: saveResult.error || 'Failed to save todo', storage: { saved: false } };
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
      return { success: true, todo, storage: { saved: true, count: saveResult.count, location: saveResult.location } };
    } else {
      return { success: false, error: saveResult.error || 'Failed to save todo', storage: { saved: false } };
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
function add_todo(description) {
  const core = getGlobalTodoCore();
  return core.addTodo(description);
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
  reset_global_core
};