#!/usr/bin/env node

const { TodoCore } = require('./todo-core');

// Create a TodoCore instance for the CLI
const todoCore = new TodoCore();

// Add a new todo
function addTodo(description) {
  const result = todoCore.addTodo(description);

  if (!result.success) {
    console.error(`Error: ${result.error}`);
    return false;
  }

  console.log(`Added todo #${result.todo.id}: ${result.todo.description}`);
  return true;
}

// List all todos
function listTodos() {
  const todos = todoCore.listTodos();

  if (todos.length === 0) {
    console.log('No todos found. Add one with: node index.js add "Your todo description"');
    return;
  }

  console.log('Your todos:');
  todos.forEach(todo => {
    const status = todo.completed ? '✓' : ' ';
    console.log(`  [${status}] #${todo.id}: ${todo.description}`);
  });
}

// Mark todo as complete
function completeTodo(id) {
  const result = todoCore.completeTodo(id);

  if (!result.success) {
    console.error(`Error: ${result.error}`);
    return false;
  }

  if (result.message) {
    console.log(result.message);
  } else {
    console.log(`Marked todo #${result.todo.id} as complete: ${result.todo.description}`);
  }
  return true;
}

// Delete a todo
function deleteTodo(id) {
  const result = todoCore.deleteTodo(id);

  if (!result.success) {
    console.error(`❌ Error: ${result.error}`);
    console.error('💡 Use "node index.js list" to see available todos');
    return false;
  }

  const status = result.todo.completed ? '✓' : ' ';
  console.log(`🗑️  Successfully deleted todo #${result.todo.id}: ${result.todo.description}`);
  console.log(`   Status was: [${status}] ${result.todo.completed ? 'Completed' : 'Pending'}`);

  // Show count of remaining todos
  const remaining = todoCore.listTodos();
  const remainingCount = remaining.length;
  const pendingCount = remaining.filter(t => !t.completed).length;
  const completedCount = remaining.filter(t => t.completed).length;

  if (remainingCount === 0) {
    console.log('📝 No todos remaining. Add one with: node index.js add "Your todo description"');
  } else {
    console.log(`📊 Remaining todos: ${remainingCount} total (${pendingCount} pending, ${completedCount} completed)`);
  }

  return true;
}

// Bulk delete completed todos
function bulkDeleteCompleted() {
  const result = todoCore.bulkDeleteCompleted();

  if (!result.success) {
    console.error(`❌ Error: ${result.error}`);
    return false;
  }

  if (result.deletedCount === 0) {
    console.log('✨ No completed todos to delete');
    console.log('💡 Use "node index.js list" to see your current todos');
    return true;
  }

  console.log(`🧹 ${result.message}`);

  // Show details of deleted todos
  if (result.deletedTodos && result.deletedTodos.length > 0) {
    console.log('\nDeleted todos:');
    result.deletedTodos.forEach(todo => {
      console.log(`  [✓] #${todo.id}: ${todo.description}`);
    });
  }

  // Show count of remaining todos
  const remaining = todoCore.listTodos();
  const remainingCount = remaining.length;
  const pendingCount = remaining.filter(t => !t.completed).length;
  const completedCount = remaining.filter(t => t.completed).length;

  console.log('');
  if (remainingCount === 0) {
    console.log('📝 No todos remaining. Add one with: node index.js add "Your todo description"');
  } else {
    console.log(`📊 Remaining todos: ${remainingCount} total (${pendingCount} pending, ${completedCount} completed)`);
  }

  return true;
}

// Show detailed help for delete command
function showDeleteHelp() {
  console.log('🗑️  DELETE COMMAND HELP');
  console.log('');
  console.log('Delete todo items permanently from your list.');
  console.log('');
  console.log('📋 SYNTAX:');
  console.log('  node index.js delete <id>           - Delete todo by ID');
  console.log('  node index.js remove <id>           - Same as delete');
  console.log('  node index.js rm <id>               - Same as delete');
  console.log('  node index.js clean                 - Delete all completed todos');
  console.log('  node index.js clear-completed       - Same as clean');
  console.log('');
  console.log('📝 PARAMETERS:');
  console.log('  <id>                                - The ID number of the todo to delete');
  console.log('                                        Must be a valid number (1, 2, 3, etc.)');
  console.log('');
  console.log('✨ EXAMPLES:');
  console.log('  node index.js delete 5              - Delete todo with ID 5');
  console.log('  node index.js remove 2              - Delete todo with ID 2 (alias)');
  console.log('  node index.js rm 10                 - Delete todo with ID 10 (alias)');
  console.log('  node index.js clean                 - Delete all completed todos at once');
  console.log('  node index.js clear-completed       - Same as clean');
  console.log('');
  console.log('💡 TIPS:');
  console.log('  • Use "node index.js list" to see all todos and their IDs');
  console.log('  • Deleting a todo is permanent - it cannot be undone');
  console.log('  • You can delete both completed and pending todos individually');
  console.log('  • Use "clean" to quickly remove all completed todos');
  console.log('  • The app will show you what was deleted and remaining count');
  console.log('');
  console.log('❌ COMMON ERRORS:');
  console.log('  • "Todo not found" - Use "list" to check available IDs');
  console.log('  • "Invalid ID" - Make sure to provide a number, not text');
  console.log('  • "Missing ID" - You must specify which todo to delete');
  console.log('');
  console.log('📚 MORE HELP:');
  console.log('  node index.js help                  - Show all available commands');
  console.log('  node index.js help <command>        - Get help for specific commands');
}

// Show usage information
function showUsage() {
  console.log('📝 Todo List Application');
  console.log('');
  console.log('USAGE:');
  console.log('  node index.js <command> [arguments]');
  console.log('');
  console.log('COMMANDS:');
  console.log('  add "description"                   - Add a new todo');
  console.log('  list                                - List all todos');
  console.log('  complete <id>                       - Mark todo as complete');
  console.log('  delete <id>                         - Delete a todo');
  console.log('  clean                               - Delete all completed todos');
  console.log('  help [command]                      - Show this help or help for specific command');
  console.log('');
  console.log('EXAMPLES:');
  console.log('  node index.js add "Buy groceries"   - Add a new todo');
  console.log('  node index.js list                  - Show all todos');
  console.log('  node index.js complete 1            - Mark todo #1 as done');
  console.log('  node index.js delete 2              - Delete todo #2');
  console.log('  node index.js clean                 - Delete all completed todos');
  console.log('  node index.js help delete           - Get detailed help for delete command');
  console.log('');
  console.log('COMMAND ALIASES:');
  console.log('  ls, list                            - List todos');
  console.log('  done, complete                      - Mark complete');
  console.log('  rm, remove, delete                  - Delete todos');
  console.log('  clean, clear-completed              - Delete all completed todos');
  console.log('  -h, --help, help                    - Show help');
  console.log('');
  console.log('💡 TIP: Run "node index.js help <command>" for detailed help on any command.');
}

// Show command-specific help
function showCommandHelp(command) {
  switch (command.toLowerCase()) {
    case 'delete':
    case 'remove':
    case 'rm':
      showDeleteHelp();
      break;
    case 'clean':
    case 'clear-completed':
      console.log('🧹 CLEAN COMMAND HELP');
      console.log('');
      console.log('Delete all completed todos at once.');
      console.log('');
      console.log('📋 SYNTAX:');
      console.log('  node index.js clean');
      console.log('  node index.js clear-completed');
      console.log('');
      console.log('📝 BEHAVIOR:');
      console.log('  • Removes all todos marked as completed (✓)');
      console.log('  • Leaves pending todos unchanged');
      console.log('  • Shows summary of deleted todos');
      console.log('  • Reports remaining todo counts');
      console.log('');
      console.log('✨ EXAMPLES:');
      console.log('  node index.js clean                 - Delete all completed todos');
      console.log('  node index.js clear-completed       - Same as clean');
      console.log('');
      console.log('💡 TIPS:');
      console.log('  • Use this after completing many todos to clean up your list');
      console.log('  • The operation is permanent and cannot be undone');
      console.log('  • If no completed todos exist, no action is taken');
      console.log('  • Use "list" first to see which todos are completed');
      break;
    case 'add':
      console.log('➕ ADD COMMAND HELP');
      console.log('');
      console.log('Add a new todo item to your list.');
      console.log('');
      console.log('📋 SYNTAX:');
      console.log('  node index.js add "description"');
      console.log('');
      console.log('📝 PARAMETERS:');
      console.log('  "description"                     - The todo description in quotes');
      console.log('');
      console.log('✨ EXAMPLES:');
      console.log('  node index.js add "Buy groceries"');
      console.log('  node index.js add "Call mom"');
      console.log('  node index.js add "Finish project"');
      break;
    case 'list':
    case 'ls':
      console.log('📋 LIST COMMAND HELP');
      console.log('');
      console.log('Display all todos in your list.');
      console.log('');
      console.log('📋 SYNTAX:');
      console.log('  node index.js list');
      console.log('  node index.js ls');
      console.log('');
      console.log('✨ OUTPUT FORMAT:');
      console.log('  [✓] #1: Completed todo');
      console.log('  [ ] #2: Pending todo');
      break;
    case 'complete':
    case 'done':
      console.log('✅ COMPLETE COMMAND HELP');
      console.log('');
      console.log('Mark a todo as completed.');
      console.log('');
      console.log('📋 SYNTAX:');
      console.log('  node index.js complete <id>');
      console.log('  node index.js done <id>');
      console.log('');
      console.log('✨ EXAMPLES:');
      console.log('  node index.js complete 1');
      console.log('  node index.js done 5');
      break;
    default:
      console.log(`❌ Unknown command: "${command}"`);
      console.log('');
      console.log('Available commands: add, list, complete, delete, clean');
      console.log('Use "node index.js help" to see all commands.');
  }
}

// Parse command line arguments
function parseArguments() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    return { command: 'list' };
  }

  const command = args[0].toLowerCase();

  switch (command) {
    case 'add':
      return { command: 'add', description: args.slice(1).join(' ') };
    case 'list':
    case 'ls':
      return { command: 'list' };
    case 'complete':
    case 'done':
      return { command: 'complete', id: args[1] };
    case 'delete':
    case 'remove':
    case 'rm':
      return { command: 'delete', id: args[1] };
    case 'clean':
    case 'clear-completed':
      return { command: 'clean' };
    case 'help':
    case '--help':
    case '-h':
      return { command: 'help', subcommand: args[1] };
    default:
      return { command: 'unknown', original: command };
  }
}

// Validate command arguments
function validateCommand(parsed) {
  switch (parsed.command) {
    case 'add':
      if (!parsed.description || parsed.description.trim().length === 0) {
        console.error('Error: Add command requires a description');
        console.error('Usage: node index.js add "Your todo description"');
        return false;
      }
      break;

    case 'complete':
      if (!parsed.id) {
        console.error('Error: Complete command requires a todo ID');
        console.error('Usage: node index.js complete <id>');
        return false;
      }
      if (isNaN(parseInt(parsed.id))) {
        console.error('Error: Todo ID must be a valid number');
        return false;
      }
      break;

    case 'delete':
      if (!parsed.id) {
        console.error('❌ Error: Delete command requires a todo ID');
        console.error('📋 Usage: node index.js delete <id>');
        console.error('💡 Tip: Use "node index.js list" to see available todo IDs');
        return false;
      }
      if (isNaN(parseInt(parsed.id))) {
        console.error('❌ Error: Todo ID must be a valid number');
        console.error(`📋 You provided: "${parsed.id}" - this should be a number like 1, 2, 3, etc.`);
        console.error('💡 Tip: Use "node index.js list" to see available todo IDs');
        return false;
      }
      break;

    case 'unknown':
      console.error(`Error: Unknown command "${parsed.original}"`);
      console.error('Run "node index.js help" to see available commands');
      return false;
  }

  return true;
}

// Main function
function main() {
  const parsed = parseArguments();

  if (!validateCommand(parsed)) {
    process.exit(1);
  }

  let success = true;

  switch (parsed.command) {
    case 'add':
      success = addTodo(parsed.description);
      break;
    case 'list':
      listTodos();
      break;
    case 'complete':
      success = completeTodo(parsed.id);
      break;
    case 'delete':
      success = deleteTodo(parsed.id);
      break;
    case 'clean':
      success = bulkDeleteCompleted();
      break;
    case 'help':
      if (parsed.subcommand) {
        showCommandHelp(parsed.subcommand);
      } else {
        showUsage();
      }
      break;
  }

  if (!success) {
    process.exit(1);
  }
}

// Run the app
if (require.main === module) {
  main();
}