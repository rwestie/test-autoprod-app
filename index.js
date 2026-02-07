#!/usr/bin/env node

const { TodoCore } = require('./todo-core');
const { AutoSaveIntegration } = require('./autosave-integration');
const { AutoSaveConfig } = require('./autosave-config');

// Create auto-save configuration based on environment
let autoSaveConfig;
if (process.env.NODE_ENV === 'development') {
  autoSaveConfig = AutoSaveConfig.development();
} else if (process.env.NODE_ENV === 'production') {
  autoSaveConfig = AutoSaveConfig.production();
} else {
  // Try to load from environment, fallback to default
  autoSaveConfig = AutoSaveConfig.fromEnvironment();
}

// Create a TodoCore instance with auto-save integration for the CLI
const todoCore = new TodoCore();
const autoSaveTodoCore = new AutoSaveIntegration(todoCore, autoSaveConfig);

// Add a new todo
function addTodo(description) {
  const result = autoSaveTodoCore.addTodo(description);

  if (!result.success) {
    console.error(`❌ Error: ${result.error}`);
    if (result.storage && !result.storage.saved) {
      console.error('⚠️  Warning: Changes were not saved to storage');
    }
    return false;
  }

  console.log(`✅ Added todo #${result.todo.id}: ${result.todo.description}`);

  // Display auto-save messages
  if (result.autoSaveMessages) {
    result.autoSaveMessages.forEach(msg => console.log(msg));
  }

  return true;
}

// List all todos
function listTodos() {
  const todos = autoSaveTodoCore.listTodos();

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
  const result = autoSaveTodoCore.completeTodo(id);

  if (!result.success) {
    console.error(`❌ Error: ${result.error}`);
    if (result.storage && !result.storage.saved) {
      console.error('⚠️  Warning: Changes were not saved to storage');
    }
    return false;
  }

  if (result.message) {
    console.log(`ℹ️  ${result.message}`);
  } else {
    console.log(`✅ Marked todo #${result.todo.id} as complete: ${result.todo.description}`);

    // Display auto-save messages
    if (result.autoSaveMessages) {
      result.autoSaveMessages.forEach(msg => console.log(msg));
    }
  }
  return true;
}

// Delete a todo
function deleteTodo(id) {
  const result = autoSaveTodoCore.deleteTodo(id);

  if (!result.success) {
    console.error(`❌ Error: ${result.error}`);
    console.error('💡 Use "node index.js list" to see available todos');
    if (result.storage && !result.storage.saved) {
      console.error('⚠️  Warning: Changes were not saved to storage');
    }
    return false;
  }

  const status = result.todo.completed ? '✓' : ' ';
  console.log(`🗑️  Successfully deleted todo #${result.todo.id}: ${result.todo.description}`);
  console.log(`   Status was: [${status}] ${result.todo.completed ? 'Completed' : 'Pending'}`);

  // Display auto-save messages
  if (result.autoSaveMessages) {
    result.autoSaveMessages.forEach(msg => console.log(msg));
  }

  // Show count of remaining todos
  const remaining = autoSaveTodoCore.listTodos();
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

// Show detailed help for cleanup commands
function showCleanupHelp() {
  console.log('🧹 CLEANUP COMMANDS HELP');
  console.log('');
  console.log('Bulk operations to clean up your todo list efficiently.');
  console.log('');
  console.log('📋 AVAILABLE CLEANUP COMMANDS:');
  console.log('');
  console.log('🟢 Clean Completed Todos:');
  console.log('  node index.js clean                 - Delete all completed todos');
  console.log('  node index.js cleanup               - Same as clean');
  console.log('');
  console.log('🔴 Clear All Todos:');
  console.log('  node index.js clear                 - Delete ALL todos (completed + pending)');
  console.log('  node index.js purge                 - Same as clear');
  console.log('');
  console.log('✨ EXAMPLES:');
  console.log('  node index.js clean                 - Remove all completed todos');
  console.log('  node index.js cleanup               - Remove all completed todos');
  console.log('  node index.js clear                 - Remove all todos (everything!)');
  console.log('  node index.js purge                 - Remove all todos (everything!)');
  console.log('');
  console.log('⚠️  SAFETY WARNINGS:');
  console.log('  • ALL cleanup operations are PERMANENT and cannot be undone');
  console.log('  • "clean/cleanup" only removes completed todos (✓ checked items)');
  console.log('  • "clear/purge" removes EVERYTHING - both pending and completed');
  console.log('  • You will be asked to confirm before any deletion occurs');
  console.log('  • Use "list" command first to review what will be deleted');
  console.log('');
  console.log('💡 TIPS:');
  console.log('  • Use "clean" regularly to keep your list manageable');
  console.log('  • Only use "clear" when starting fresh or for testing');
  console.log('  • Check your list with "node index.js list" before cleanup');
  console.log('  • Backup important todos elsewhere before bulk cleanup');
  console.log('');
  console.log('📊 WHAT GETS REMOVED:');
  console.log('  clean/cleanup → Only todos marked as completed [✓]');
  console.log('  clear/purge   → ALL todos (both [ ] pending and [✓] completed)');
  console.log('');
  console.log('📚 MORE HELP:');
  console.log('  node index.js help                  - Show all available commands');
  console.log('  node index.js help delete           - Help for single todo deletion');
}

// Show auto-save status and performance
function showAutoSaveStatus() {
  console.log('💾 AUTO-SAVE STATUS');
  console.log('');

  const config = autoSaveTodoCore.getConfig();
  const healthCheck = autoSaveTodoCore.performHealthCheck();

  console.log('⚙️  CONFIGURATION:');
  console.log(`  Auto-save enabled: ${config.isEnabled() ? '✅ Yes' : '❌ No'}`);
  console.log(`  Show progress: ${config.shouldShowProgress() ? '✅ Yes' : '❌ No'}`);
  console.log(`  Show timing: ${config.shouldShowTiming() ? '✅ Yes' : '❌ No'}`);
  console.log(`  Track performance: ${config.shouldTrackPerformance() ? '✅ Yes' : '❌ No'}`);
  console.log(`  Verbose logging: ${config.shouldShowVerbose() ? '✅ Yes' : '❌ No'}`);
  console.log('');

  if (healthCheck) {
    console.log('🏥 STORAGE HEALTH:');
    console.log(`  Status: ${healthCheck.storage.healthy ? '✅ Healthy' : '❌ Unhealthy'}`);
    console.log(`  Todo count: ${healthCheck.storage.todoCount}`);
    console.log(`  Data file exists: ${healthCheck.storage.fileExists ? '✅ Yes' : '❌ No'}`);
    console.log(`  Backup exists: ${healthCheck.storage.backupExists ? '✅ Yes' : '❌ No'}`);
    if (healthCheck.storage.fileSize !== undefined) {
      console.log(`  File size: ${healthCheck.storage.fileSize} bytes`);
    }
    console.log('');

    if (healthCheck.performance) {
      const perf = healthCheck.performance;
      console.log('📊 PERFORMANCE STATISTICS:');
      console.log(`  Total operations: ${perf.totalOperations}`);
      console.log(`  Successful saves: ${perf.successfulSaves}`);
      console.log(`  Failed saves: ${perf.failedSaves}`);
      console.log(`  Success rate: ${perf.successRate}%`);
      if (perf.averageDuration) {
        console.log(`  Average save time: ${perf.averageDuration}ms`);
      }
      if (perf.fastestSave !== null) {
        console.log(`  Fastest save: ${perf.fastestSave}ms`);
      }
      if (perf.slowestSave !== null) {
        console.log(`  Slowest save: ${perf.slowestSave}ms`);
      }
      if (perf.totalRetries > 0) {
        console.log(`  Total retries used: ${perf.totalRetries}`);
      }
      console.log('');
    }
  }

  console.log('🔧 CONFIGURATION OPTIONS:');
  console.log('  Set TODO_AUTOSAVE_ENABLED=false to disable auto-save');
  console.log('  Set TODO_AUTOSAVE_SHOW_PROGRESS=false to hide progress messages');
  console.log('  Set TODO_AUTOSAVE_SHOW_TIMING=true to show save timing');
  console.log('  Set TODO_AUTOSAVE_VERBOSE=true for detailed logging');
  console.log('  Set NODE_ENV=development for verbose auto-save mode');
  console.log('  Set NODE_ENV=production for minimal auto-save messages');
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
  console.log('  clear                               - Delete ALL todos');
  console.log('  autosave                            - Show auto-save status and performance');
  console.log('  help [command]                      - Show this help or help for specific command');
  console.log('');
  console.log('EXAMPLES:');
  console.log('  node index.js add "Buy groceries"   - Add a new todo');
  console.log('  node index.js list                  - Show all todos');
  console.log('  node index.js complete 1            - Mark todo #1 as done');
  console.log('  node index.js delete 2              - Delete todo #2');
  console.log('  node index.js clean                 - Remove all completed todos');
  console.log('  node index.js clear                 - Remove ALL todos');
  console.log('  node index.js autosave              - Show auto-save status and stats');
  console.log('  node index.js help delete           - Get detailed help for delete command');
  console.log('');
  console.log('COMMAND ALIASES:');
  console.log('  ls, list                            - List todos');
  console.log('  done, complete                      - Mark complete');
  console.log('  rm, remove, delete                  - Delete todos');
  console.log('  clean, cleanup                      - Delete completed todos');
  console.log('  clear, purge                        - Delete ALL todos');
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
    case 'cleanup':
    case 'clear':
    case 'purge':
      showCleanupHelp();
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
      console.log('Available commands: add, list, complete, delete, clean, clear');
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
    case 'cleanup':
      return { command: 'clean' };
    case 'clear':
    case 'purge':
      return { command: 'clear' };
    case 'autosave':
    case 'auto-save':
    case 'status':
      return { command: 'autosave' };
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
      console.log('🧹 Clean command (delete completed todos) - Coming soon!');
      console.log('💡 Use "node index.js help clean" to see detailed documentation.');
      break;
    case 'clear':
      console.log('🗑️  Clear command (delete ALL todos) - Coming soon!');
      console.log('💡 Use "node index.js help clear" to see detailed documentation.');
      break;
    case 'autosave':
      showAutoSaveStatus();
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