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

// Bulk delete todos by IDs
function bulkDeleteTodos(ids, options = {}) {
  // Confirm operation if not forced
  if (!options.force && !confirmBulkDelete('selected todos', ids.length)) {
    console.log('❌ Operation cancelled by user');
    return false;
  }

  const result = todoCore.bulkDeleteTodos(ids);

  if (!result.success) {
    console.error(`❌ Error: ${result.error}`);
    return false;
  }

  console.log(`🗑️  Successfully deleted ${result.deletedCount} todos!`);
  console.log('');
  console.log('📋 Deleted todos:');
  result.deletedTodos.forEach(todo => {
    const status = todo.completed ? '✓' : ' ';
    console.log(`   [${status}] #${todo.id}: ${todo.description}`);
  });

  if (result.notFoundIds) {
    console.log('');
    console.log(`⚠️  Note: ${result.notFoundIds.length} todos not found with IDs: ${result.notFoundIds.join(', ')}`);
  }

  console.log('');
  console.log(`📊 Summary: ${result.deletedCount} deleted, ${result.remainingCount} remaining`);

  return true;
}

// Bulk delete completed todos
function bulkDeleteCompleted(options = {}) {
  // Confirm operation if not forced
  if (!options.force && !confirmBulkDelete('all completed todos')) {
    console.log('❌ Operation cancelled by user');
    return false;
  }

  const result = todoCore.bulkDeleteCompleted();

  if (!result.success) {
    console.error(`❌ Error: ${result.error}`);
    return false;
  }

  console.log(`🗑️  Successfully deleted ${result.deletedCount} completed todos!`);
  console.log('');
  console.log('📋 Deleted completed todos:');
  result.deletedTodos.forEach(todo => {
    console.log(`   [✓] #${todo.id}: ${todo.description}`);
  });

  console.log('');
  console.log(`📊 Summary: ${result.deletedCount} completed todos deleted, ${result.remainingCount} todos remaining`);

  return true;
}

// Bulk delete all todos
function bulkDeleteAll(options = {}) {
  // Confirm operation if not forced
  if (!options.force && !confirmBulkDelete('ALL todos (this cannot be undone!)')) {
    console.log('❌ Operation cancelled by user');
    return false;
  }

  const result = todoCore.bulkDeleteAll();

  if (!result.success) {
    console.error(`❌ Error: ${result.error}`);
    return false;
  }

  console.log(`🗑️  Successfully deleted ALL ${result.deletedCount} todos!`);
  console.log('');
  console.log('📋 All todos have been permanently removed from your list.');
  console.log('💡 Start fresh: node index.js add "Your first todo"');

  return true;
}

// Confirmation helper for bulk delete operations
function confirmBulkDelete(description, count = null) {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    const countText = count ? ` (${count} todos)` : '';
    const question = `⚠️  Are you sure you want to delete ${description}${countText}? This cannot be undone! (y/N): `;

    rl.question(question, (answer) => {
      rl.close();
      const confirmed = answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
      resolve(confirmed);
    });
  });
}

// Async wrapper for bulk delete confirmation
async function bulkDeleteTodosAsync(ids, options = {}) {
  // Confirm operation if not forced
  if (!options.force) {
    const confirmed = await confirmBulkDelete('selected todos', ids.length);
    if (!confirmed) {
      console.log('❌ Operation cancelled by user');
      return false;
    }
  }

  return bulkDeleteTodos(ids, { ...options, force: true });
}

async function bulkDeleteCompletedAsync(options = {}) {
  // Confirm operation if not forced
  if (!options.force) {
    const confirmed = await confirmBulkDelete('all completed todos');
    if (!confirmed) {
      console.log('❌ Operation cancelled by user');
      return false;
    }
  }

  return bulkDeleteCompleted({ ...options, force: true });
}

async function bulkDeleteAllAsync(options = {}) {
  // Confirm operation if not forced
  if (!options.force) {
    const confirmed = await confirmBulkDelete('ALL todos (this cannot be undone!)');
    if (!confirmed) {
      console.log('❌ Operation cancelled by user');
      return false;
    }
  }

  return bulkDeleteAll({ ...options, force: true });
}

// Show detailed help for delete command
function showDeleteHelp() {
  console.log('🗑️  DELETE COMMAND HELP');
  console.log('');
  console.log('Delete a todo item permanently from your list.');
  console.log('');
  console.log('📋 SYNTAX:');
  console.log('  node index.js delete <id>           - Delete todo by ID');
  console.log('  node index.js remove <id>           - Same as delete');
  console.log('  node index.js rm <id>               - Same as delete');
  console.log('');
  console.log('📝 PARAMETERS:');
  console.log('  <id>                                - The ID number of the todo to delete');
  console.log('                                        Must be a valid number (1, 2, 3, etc.)');
  console.log('');
  console.log('✨ EXAMPLES:');
  console.log('  node index.js delete 5              - Delete todo with ID 5');
  console.log('  node index.js remove 2              - Delete todo with ID 2 (alias)');
  console.log('  node index.js rm 10                 - Delete todo with ID 10 (alias)');
  console.log('');
  console.log('💡 TIPS:');
  console.log('  • Use "node index.js list" to see all todos and their IDs');
  console.log('  • Deleting a todo is permanent - it cannot be undone');
  console.log('  • You can delete both completed and pending todos');
  console.log('  • The app will show you what was deleted and remaining count');
  console.log('  • For deleting multiple todos, use "bulk-delete" command');
  console.log('');
  console.log('❌ COMMON ERRORS:');
  console.log('  • "Todo not found" - Use "list" to check available IDs');
  console.log('  • "Invalid ID" - Make sure to provide a number, not text');
  console.log('  • "Missing ID" - You must specify which todo to delete');
  console.log('');
  console.log('📚 MORE HELP:');
  console.log('  node index.js help                  - Show all available commands');
  console.log('  node index.js help bulk-delete      - Help for deleting multiple todos');
  console.log('  node index.js help <command>        - Get help for specific commands');
}

// Show detailed help for bulk delete command
function showBulkDeleteHelp() {
  console.log('🗑️  BULK DELETE COMMAND HELP');
  console.log('');
  console.log('Delete multiple todos at once from your list.');
  console.log('');
  console.log('📋 SYNTAX:');
  console.log('  node index.js bulk-delete <ids...>     - Delete multiple todos by ID');
  console.log('  node index.js bulk-delete --completed  - Delete all completed todos');
  console.log('  node index.js bulk-delete --all        - Delete ALL todos (use with caution!)');
  console.log('  node index.js bulk-remove <ids...>     - Same as bulk-delete');
  console.log('  node index.js bulk-rm <ids...>         - Same as bulk-delete');
  console.log('');
  console.log('🏃 OPTIONS:');
  console.log('  --force, -f                         - Skip confirmation prompt');
  console.log('  --completed, -c                     - Delete only completed todos');
  console.log('  --all, -a                           - Delete ALL todos');
  console.log('');
  console.log('📝 PARAMETERS:');
  console.log('  <ids...>                            - Space-separated list of todo IDs');
  console.log('                                        Must be valid numbers (1, 2, 3, etc.)');
  console.log('');
  console.log('✨ EXAMPLES:');
  console.log('  node index.js bulk-delete 1 3 5        - Delete todos #1, #3, and #5');
  console.log('  node index.js bulk-delete 2 4 6 --force - Delete without confirmation');
  console.log('  node index.js bulk-delete --completed   - Delete all completed todos');
  console.log('  node index.js bulk-delete --all --force - Delete everything (no confirmation)');
  console.log('  node index.js bulk-rm 7 8 9            - Same as bulk-delete (alias)');
  console.log('');
  console.log('⚠️  SAFETY FEATURES:');
  console.log('  • Confirmation prompt by default (except with --force)');
  console.log('  • Shows what will be deleted before confirmation');
  console.log('  • Reports any IDs that were not found');
  console.log('  • Displays summary of deletion results');
  console.log('');
  console.log('💡 TIPS:');
  console.log('  • Use "node index.js list" to see all todos and their IDs');
  console.log('  • Bulk deletion is permanent - it cannot be undone');
  console.log('  • Use --completed to clean up finished todos');
  console.log('  • Use --force to skip confirmations in scripts');
  console.log('  • The app will tell you exactly what was deleted');
  console.log('');
  console.log('❌ COMMON ERRORS:');
  console.log('  • "No IDs provided" - You must specify which todos to delete');
  console.log('  • "Invalid ID format" - Make sure all IDs are numbers');
  console.log('  • "No todos found" - Check available IDs with "list" command');
  console.log('  • "Cannot specify IDs with --completed/--all" - Choose one method');
  console.log('');
  console.log('📚 MORE HELP:');
  console.log('  node index.js help                  - Show all available commands');
  console.log('  node index.js help delete           - Help for deleting single todos');
  console.log('  node index.js list                  - See current todos and their IDs');
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
  console.log('  bulk-delete <ids...>                - Delete multiple todos by ID');
  console.log('  bulk-delete --completed             - Delete all completed todos');
  console.log('  bulk-delete --all                   - Delete ALL todos (caution!)');
  console.log('  help [command]                      - Show this help or help for specific command');
  console.log('');
  console.log('EXAMPLES:');
  console.log('  node index.js add "Buy groceries"   - Add a new todo');
  console.log('  node index.js list                  - Show all todos');
  console.log('  node index.js complete 1            - Mark todo #1 as done');
  console.log('  node index.js delete 2              - Delete todo #2');
  console.log('  node index.js bulk-delete 1 3 5     - Delete todos #1, #3, and #5');
  console.log('  node index.js bulk-delete --completed - Delete all completed todos');
  console.log('  node index.js help bulk-delete      - Get detailed help for bulk delete');
  console.log('');
  console.log('COMMAND ALIASES:');
  console.log('  ls, list                            - List todos');
  console.log('  done, complete                      - Mark complete');
  console.log('  rm, remove, delete                  - Delete todos');
  console.log('  bulk-rm, bulk-remove, bulk-delete   - Bulk delete todos');
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
    case 'bulk-delete':
    case 'bulk-remove':
    case 'bulk-rm':
      showBulkDeleteHelp();
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
      console.log('Available commands: add, list, complete, delete, bulk-delete');
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
    case 'bulk-delete':
    case 'bulk-remove':
    case 'bulk-rm':
      return parseBulkDeleteCommand(args);
    case 'help':
    case '--help':
    case '-h':
      return { command: 'help', subcommand: args[1] };
    default:
      return { command: 'unknown', original: command };
  }
}

// Parse bulk delete command with options
function parseBulkDeleteCommand(args) {
  const options = { force: false };
  const ids = [];
  let bulkType = 'ids'; // 'ids', 'completed', or 'all'

  // Parse arguments and flags
  for (let i = 1; i < args.length; i++) {
    const arg = args[i].toLowerCase();

    if (arg === '--force' || arg === '-f') {
      options.force = true;
    } else if (arg === '--completed' || arg === '-c') {
      bulkType = 'completed';
    } else if (arg === '--all' || arg === '-a') {
      bulkType = 'all';
    } else if (!isNaN(parseInt(arg))) {
      ids.push(arg);
    } else {
      return {
        command: 'bulk-delete',
        error: `Invalid argument: ${args[i]}`,
        help: true
      };
    }
  }

  // Validate arguments based on bulk type
  if (bulkType === 'ids' && ids.length === 0) {
    return {
      command: 'bulk-delete',
      error: 'No todo IDs provided',
      help: true
    };
  }

  if (bulkType !== 'ids' && ids.length > 0) {
    return {
      command: 'bulk-delete',
      error: `Cannot specify IDs with --${bulkType} option`,
      help: true
    };
  }

  return {
    command: 'bulk-delete',
    bulkType,
    ids,
    options
  };
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

    case 'bulk-delete':
      if (parsed.error) {
        console.error(`❌ Error: ${parsed.error}`);
        if (parsed.help) {
          showBulkDeleteHelp();
        }
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
async function main() {
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
    case 'bulk-delete':
      success = await handleBulkDelete(parsed);
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

// Handle bulk delete operations
async function handleBulkDelete(parsed) {
  switch (parsed.bulkType) {
    case 'ids':
      return await bulkDeleteTodosAsync(parsed.ids, parsed.options);
    case 'completed':
      return await bulkDeleteCompletedAsync(parsed.options);
    case 'all':
      return await bulkDeleteAllAsync(parsed.options);
    default:
      console.error('❌ Error: Invalid bulk delete type');
      return false;
  }
}

// Run the app
if (require.main === module) {
  main();
}