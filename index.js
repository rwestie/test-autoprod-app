#!/usr/bin/env node

const { TodoCoreEnhanced } = require('./todo-core-enhanced');
const { StorageConfig } = require('./storage-config');

// Global variables for configuration - will be initialized in main()
let todoCore = null;

// Initialize todo core with storage options
async function initializeTodoCore(storageOptions = {}) {
  // Create storage configuration
  const storageConfig = StorageConfig.fromEnvironment().merge(storageOptions);

  // Create a TodoCoreEnhanced instance with the new storage interface
  todoCore = new TodoCoreEnhanced(storageConfig, null, 'json-file');

  // Ensure initialization is complete
  await todoCore.initialize();
}

// Add a new todo
async function addTodo(description) {
  const result = await todoCore.addTodo(description);

  if (!result.success) {
    console.error(`❌ Error: ${result.error}`);
    if (result.storage && !result.storage.saved) {
      console.error('⚠️  Warning: Changes were not saved to storage');
    }
    return false;
  }

  console.log(`✅ Added todo #${result.todo.id}: ${result.todo.description}`);

  // Display storage info if available
  if (result.storage && result.storage.saved) {
    console.log(`💾 Saved ${result.storage.count} todos to ${result.storage.location}`);
    if (result.storage.duration !== undefined) {
      console.log(`⚡ Save completed in ${result.storage.duration}ms`);
    }
  }

  return true;
}

// List all todos
async function listTodos() {
  const todos = await todoCore.listTodos();

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
async function completeTodo(id) {
  const result = await todoCore.completeTodo(id);

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

    // Display storage info if available
    if (result.storage && result.storage.saved) {
      console.log(`💾 Saved ${result.storage.count} todos to ${result.storage.location}`);
      if (result.storage.duration !== undefined) {
        console.log(`⚡ Save completed in ${result.storage.duration}ms`);
      }
    }
  }
  return true;
}

// Delete a todo
async function deleteTodo(id) {
  const result = await todoCore.deleteTodo(id);

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

  // Display storage info if available
  if (result.storage && result.storage.saved) {
    console.log(`💾 Saved ${result.storage.count} todos to ${result.storage.location}`);
  }

  // Show count of remaining todos
  const remaining = await todoCore.listTodos();
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

// Show storage configuration
async function showStorageConfig() {
  console.log('💾 STORAGE CONFIGURATION');
  console.log('');

  const config = todoCore.config;
  const stats = await todoCore.getStorageStats();

  console.log('📁 CURRENT SETTINGS:');
  console.log(`  Data directory: ${config.options.dataDir}`);
  console.log(`  Data file: ${config.options.dataFile}`);
  console.log(`  Full path: ${config.getDataFilePath()}`);
  console.log(`  Backup file: ${config.getBackupFilePath()}`);
  console.log(`  Temp file: ${config.getTempFilePath()}`);
  console.log('');

  console.log('📊 FILE STATUS:');
  console.log(`  Data file exists: ${stats.fileExists ? '✅ Yes' : '❌ No'}`);
  console.log(`  Backup file exists: ${stats.backupExists ? '✅ Yes' : '❌ No'}`);
  console.log(`  Todo count: ${stats.todoCount}`);
  if (stats.fileSize > 0) {
    console.log(`  File size: ${stats.fileSize} bytes`);
  }
  if (stats.lastModified) {
    console.log(`  Last modified: ${stats.lastModified}`);
  }
  console.log('');

  console.log('⚙️  STORAGE OPTIONS:');
  console.log(`  Backups enabled: ${config.options.enableBackups ? '✅ Yes' : '❌ No'}`);
  console.log(`  Backup retention: ${config.options.backupRetention}`);
  console.log(`  Atomic writes: ${config.options.useTempFiles ? '✅ Yes' : '❌ No'}`);
  console.log(`  Validation enabled: ${config.options.enableValidation ? '✅ Yes' : '❌ No'}`);
  console.log(`  Migration enabled: ${config.options.enableMigration ? '✅ Yes' : '❌ No'}`);
  console.log(`  Max retries: ${config.options.maxRetries}`);
  console.log(`  Retry delay: ${config.options.retryDelay}ms`);
  console.log('');

  console.log('🔧 CONFIGURATION OPTIONS:');
  console.log('  Command line flags:');
  console.log('    --data-dir <path>               - Set data directory');
  console.log('    --data-file <filename>          - Set data filename');
  console.log('');
  console.log('  Environment variables:');
  console.log('    TODO_DATA_DIR                   - Set data directory');
  console.log('    TODO_DATA_FILE                  - Set data filename');
  console.log('    TODO_ENABLE_BACKUPS             - Enable/disable backups (true/false)');
  console.log('    TODO_BACKUP_RETENTION           - Number of backups to keep');
  console.log('    TODO_LOG_LEVEL                  - Logging level (debug/info/warn/error)');
  console.log('    TODO_MAX_RETRIES                - Maximum save retries');
  console.log('');

  console.log('💡 EXAMPLES:');
  console.log('    node index.js --data-dir ~/.mytodos list');
  console.log('    node index.js --data-file my-todos.json add "Task"');
  console.log('    TODO_DATA_DIR=~/work/todos node index.js list');
  console.log('    TODO_ENABLE_BACKUPS=false node index.js list');
}

// Set storage configuration
function setStorageConfig(option, value) {
  console.log('🔧 STORAGE CONFIGURATION');
  console.log('');

  if (!option || !value) {
    console.error('❌ Error: Both option and value are required');
    console.error('');
    console.error('Usage: node index.js config set <option> <value>');
    console.error('');
    console.error('Available options:');
    console.error('  data-dir          - Set data directory path');
    console.error('  data-file         - Set data filename');
    console.error('');
    console.error('Examples:');
    console.error('  node index.js config set data-dir ~/.mytodos');
    console.error('  node index.js config set data-file my-todos.json');
    return false;
  }

  console.log('⚠️  NOTE: Configuration changes only apply to the current session.');
  console.log('   To make persistent changes, use environment variables or command line flags.');
  console.log('');

  switch (option.toLowerCase()) {
    case 'data-dir':
      console.log(`📁 Setting data directory to: ${value}`);
      process.env.TODO_DATA_DIR = value;
      console.log('✅ Data directory set for current session');
      break;

    case 'data-file':
      console.log(`📄 Setting data filename to: ${value}`);
      process.env.TODO_DATA_FILE = value;
      console.log('✅ Data filename set for current session');
      break;

    default:
      console.error(`❌ Error: Unknown configuration option "${option}"`);
      console.error('Available options: data-dir, data-file');
      return false;
  }

  console.log('');
  console.log('💡 Restart the command or use a new command to see changes take effect.');
  return true;
}

// Show configuration help
function showConfigHelp() {
  console.log('⚙️  CONFIGURATION COMMAND HELP');
  console.log('');
  console.log('Manage storage configuration for the todo application.');
  console.log('');
  console.log('📋 SYNTAX:');
  console.log('  node index.js config <subcommand>');
  console.log('');
  console.log('📝 SUBCOMMANDS:');
  console.log('  show                                - Show current storage configuration');
  console.log('  set <option> <value>                - Set configuration option');
  console.log('');
  console.log('⚙️  CONFIGURABLE OPTIONS:');
  console.log('  data-dir                            - Directory where todos are stored');
  console.log('  data-file                           - Filename for the todo data');
  console.log('');
  console.log('✨ EXAMPLES:');
  console.log('  node index.js config show          - Show current configuration');
  console.log('  node index.js config set data-dir ~/.mytodos');
  console.log('  node index.js config set data-file work-todos.json');
  console.log('');
  console.log('🔧 GLOBAL FLAGS:');
  console.log('  --data-dir <path>                   - Override data directory');
  console.log('  --data-file <name>                  - Override data filename');
  console.log('');
  console.log('🌍 ENVIRONMENT VARIABLES:');
  console.log('  TODO_DATA_DIR                       - Set data directory');
  console.log('  TODO_DATA_FILE                      - Set data filename');
  console.log('  TODO_ENABLE_BACKUPS                 - Enable backups (true/false)');
  console.log('  TODO_BACKUP_RETENTION               - Number of backups to keep');
  console.log('');
  console.log('💡 TIPS:');
  console.log('  • Global flags override environment variables');
  console.log('  • Environment variables persist across sessions');
  console.log('  • Use absolute paths for data directories');
  console.log('  • The default location is ~/.todos/todos.json');
}

// Show storage status and performance
async function showStorageStatus() {
  console.log('💾 STORAGE STATUS');
  console.log('');

  const stats = await todoCore.getStorageStats();
  const healthCheck = await todoCore.performHealthCheck();

  console.log('⚙️  CONFIGURATION:');
  console.log(`  Storage type: JSON file storage`);
  console.log(`  Auto-save enabled: ✅ Yes (built-in persistence)`);
  console.log(`  Data directory: ${todoCore.config.options.dataDir}`);
  console.log(`  Data file: ${todoCore.config.options.dataFile}`);
  console.log(`  Backups enabled: ${todoCore.config.options.enableBackups ? '✅ Yes' : '❌ No'}`);
  console.log('');

  if (stats) {
    console.log('🏥 STORAGE HEALTH:');
    console.log(`  Status: ${healthCheck.success ? '✅ Healthy' : '❌ Unhealthy'}`);
    console.log(`  Todo count: ${stats.todoCount}`);
    console.log(`  Data file exists: ${stats.fileExists ? '✅ Yes' : '❌ No'}`);
    console.log(`  Backup exists: ${stats.backupExists ? '✅ Yes' : '❌ No'}`);
    if (stats.fileSize !== undefined) {
      console.log(`  File size: ${stats.fileSize} bytes`);
    }
    if (stats.lastModified) {
      console.log(`  Last modified: ${stats.lastModified}`);
    }
    console.log('');
  }

  console.log('🔧 CONFIGURATION OPTIONS:');
  console.log('  Environment variables:');
  console.log('  TODO_DATA_DIR                       - Set data directory');
  console.log('  TODO_DATA_FILE                      - Set data filename');
  console.log('  TODO_ENABLE_BACKUPS                 - Enable backups (true/false)');
  console.log('  TODO_BACKUP_RETENTION               - Number of backups to keep');
  console.log('  TODO_LOG_LEVEL                      - Logging level (debug/info/warn/error)');
}

// Show migration status and information
async function showMigrationStatus() {
  console.log('🔄 MIGRATION STATUS');
  console.log('');

  const status = await todoCore.getMigrationStatus();

  console.log('📊 DATA VERSION:');
  console.log(`  Current version: ${status.currentVersion}`);
  console.log(`  Latest version: ${status.latestVersion}`);
  console.log(`  Status: ${status.isLatest ? '✅ Up to date' : '⚠️  Migration available'}`);
  console.log('');

  if (!status.isLatest) {
    console.log('🔄 AVAILABLE MIGRATIONS:');
    console.log(`  Migrations needed: ${status.availableMigrations}`);
    console.log('  Migration path:');
    status.migrationPath.forEach(path => {
      console.log(`    ${path}`);
    });
    console.log('');

    console.log('💡 TO MIGRATE:');
    console.log('  node index.js migrate              - Apply all available migrations');
    console.log('  node index.js backup create        - Create backup before migration');
  }

  console.log(`📦 BACKUP STATUS:`);
  console.log(`  Migration backups: ${status.availableBackups}`);

  // Show recent migration backups
  const migrationBackups = todoCore.getAvailableMigrationBackups();
  if (migrationBackups.length > 0) {
    console.log('');
    console.log('📋 RECENT MIGRATION BACKUPS:');
    migrationBackups.slice(0, 3).forEach((backup, index) => {
      console.log(`  ${index + 1}. ${backup.filename} (${backup.originalVersion} -> ${backup.targetVersion})`);
    });
  }
}

// Perform data migration
async function performMigration(targetVersion = null) {
  console.log('🔄 STARTING DATA MIGRATION');
  console.log('');

  const migrationResult = await todoCore.migrateData(targetVersion);

  if (migrationResult.success) {
    if (migrationResult.migrations.length === 0) {
      console.log('✅ No migration needed - data is already up to date');
    } else {
      console.log(`✅ ${migrationResult.message}`);
      console.log('');
      console.log('📋 APPLIED MIGRATIONS:');
      migrationResult.migrations.forEach((migration, index) => {
        console.log(`  ${index + 1}. ${migration.from} -> ${migration.to} (${migration.timestamp})`);
      });

      if (migrationResult.saveError) {
        console.log('');
        console.log(`⚠️  Warning: Migration succeeded but save failed: ${migrationResult.saveError}`);
      }
    }
  } else {
    console.error(`❌ Migration failed: ${migrationResult.error}`);
    if (migrationResult.partialMigrations) {
      console.log('');
      console.log('⚠️  Partial migrations applied:');
      migrationResult.partialMigrations.forEach((migration, index) => {
        console.log(`  ${index + 1}. ${migration.from} -> ${migration.to}`);
      });
    }
    return false;
  }

  return true;
}

// Create manual backup
async function createBackup(reason = 'manual') {
  console.log('💾 CREATING BACKUP');
  console.log('');

  const backupResult = await todoCore.createBackup(reason);

  if (backupResult.success) {
    console.log(`✅ ${backupResult.message}`);
    console.log(`📁 Backup location: ${backupResult.filename}`);
    console.log(`📊 Backup contains: ${backupResult.todoCount} todo(s)`);
    console.log(`🕒 Created: ${backupResult.timestamp}`);
  } else {
    console.error(`❌ Failed to create backup: ${backupResult.error}`);
    return false;
  }

  return true;
}

// List available backups
async function listBackups() {
  console.log('📦 AVAILABLE BACKUPS');
  console.log('');

  const backupsResult = todoCore.getAvailableBackups();

  if (!backupsResult.success) {
    console.error(`❌ Failed to list backups: ${backupsResult.error}`);
    return false;
  }

  const backups = backupsResult.backups;

  if (backups.length === 0) {
    console.log('No backups found.');
    console.log('');
    console.log('💡 To create a backup:');
    console.log('  node index.js backup create');
    return true;
  }

  console.log(`📊 SUMMARY: ${backups.length} backup(s) found`);
  console.log(`  Automatic: ${backupsResult.automaticBackups}`);
  console.log(`  Manual: ${backupsResult.manualBackups}`);
  console.log(`  Migration: ${backupsResult.migrationBackups}`);
  console.log('');

  console.log('📋 BACKUP LIST:');
  backups.forEach((backup, index) => {
    const typeIcon = {
      automatic: '🔄',
      manual: '👤',
      migration: '⬆️'
    }[backup.type] || '📦';

    console.log(`  ${index + 1}. ${typeIcon} ${backup.filename}`);
    console.log(`     ${backup.description}`);
    console.log(`     Date: ${new Date(backup.timestamp).toLocaleString()}`);
    console.log(`     Size: ${backup.size} bytes | Todos: ${backup.todoCount}`);
    console.log('');
  });

  console.log('💡 To restore from a backup:');
  console.log('  node index.js backup restore <filename>');

  return true;
}

// Restore from backup
async function restoreFromBackup(filename) {
  if (!filename) {
    console.error('❌ Error: Backup filename is required');
    console.error('Usage: node index.js backup restore <filename>');
    console.error('Use "node index.js backup list" to see available backups');
    return false;
  }

  console.log(`🔄 RESTORING FROM BACKUP: ${filename}`);
  console.log('');

  // Find backup path
  const backupsResult = todoCore.getAvailableBackups();
  if (!backupsResult.success) {
    console.error(`❌ Failed to list backups: ${backupsResult.error}`);
    return false;
  }

  const backup = backupsResult.backups.find(b => b.filename === filename);
  if (!backup) {
    console.error(`❌ Backup file not found: ${filename}`);
    console.error('Use "node index.js backup list" to see available backups');
    return false;
  }

  const restoreResult = await todoCore.restoreFromSpecificBackup(backup.path);

  if (restoreResult.success) {
    console.log(`✅ ${restoreResult.message}`);
    console.log(`📊 Restored: ${restoreResult.restoredCount} todo(s)`);

    if (restoreResult.metadata.preRestoreBackup) {
      console.log(`💾 Pre-restore backup created: ${restoreResult.metadata.preRestoreBackup}`);
    }

    if (restoreResult.saveError) {
      console.log(`⚠️  Warning: Restore succeeded but save failed: ${restoreResult.saveError}`);
    }
  } else {
    console.error(`❌ Restore failed: ${restoreResult.error}`);
    return false;
  }

  return true;
}

// Export todos
async function exportTodos(format = 'json', filename = null) {
  console.log(`📤 EXPORTING TODOS TO ${format.toUpperCase()}`);
  console.log('');

  const options = {};
  if (filename) {
    options.exportDir = path.dirname(filename);
    options.filename = path.basename(filename);
  }

  const exportResult = await todoCore.exportTodos(format, options);

  if (exportResult.success) {
    console.log(`✅ ${exportResult.message}`);
    console.log(`📁 Export file: ${exportResult.filename}`);
    console.log(`📊 Exported: ${exportResult.todoCount} todo(s)`);
    console.log(`💽 File size: ${exportResult.size} bytes`);
    console.log(`📍 Location: ${exportResult.exportPath}`);
  } else {
    console.error(`❌ Export failed: ${exportResult.error}`);
    return false;
  }

  return true;
}

// Import todos
async function importTodos(filePath, options = {}) {
  if (!filePath) {
    console.error('❌ Error: Import file path is required');
    console.error('Usage: node index.js import <filepath> [--replace]');
    return false;
  }

  console.log(`📥 IMPORTING TODOS FROM: ${filePath}`);
  console.log('');

  const importResult = await todoCore.importTodos(filePath, options);

  if (importResult.success) {
    console.log(`✅ ${importResult.message}`);

    if (importResult.skippedCount > 0) {
      console.log(`⚠️  Skipped ${importResult.skippedCount} invalid entries`);
    }

    if (importResult.saveError) {
      console.log(`⚠️  Warning: Import succeeded but save failed: ${importResult.saveError}`);
    }

    console.log('');
    console.log('📊 IMPORT SUMMARY:');
    console.log(`  Imported: ${importResult.importedCount} todo(s)`);
    if (importResult.skippedCount > 0) {
      console.log(`  Skipped: ${importResult.skippedCount} invalid entries`);
    }
  } else {
    console.error(`❌ Import failed: ${importResult.error}`);
    return false;
  }

  return true;
}

// Show usage information
function showUsage() {
  console.log('📝 Todo List Application');
  console.log('');
  console.log('USAGE:');
  console.log('  node index.js [global-options] <command> [arguments]');
  console.log('');
  console.log('GLOBAL OPTIONS:');
  console.log('  --data-dir <path>                   - Override data directory');
  console.log('  --data-file <name>                  - Override data filename');
  console.log('');
  console.log('COMMANDS:');
  console.log('  add "description"                   - Add a new todo');
  console.log('  list                                - List all todos');
  console.log('  complete <id>                       - Mark todo as complete');
  console.log('  delete <id>                         - Delete a todo');
  console.log('  clean                               - Delete all completed todos');
  console.log('  clear                               - Delete ALL todos');
  console.log('  config <subcommand>                 - Manage storage configuration');
  console.log('  autosave                            - Show auto-save status and performance');
  console.log('  migrate                             - Show migration status or apply migrations');
  console.log('  backup <subcommand>                 - Create, list, or restore backups');
  console.log('  export <format> [filename]          - Export todos (json/csv/txt)');
  console.log('  import <filepath> [--replace]       - Import todos from file');
  console.log('  help [command]                      - Show this help or help for specific command');
  console.log('');
  console.log('EXAMPLES:');
  console.log('  node index.js add "Buy groceries"   - Add a new todo');
  console.log('  node index.js list                  - Show all todos');
  console.log('  node index.js complete 1            - Mark todo #1 as done');
  console.log('  node index.js delete 2              - Delete todo #2');
  console.log('  node index.js clean                 - Remove all completed todos');
  console.log('  node index.js clear                 - Remove ALL todos');
  console.log('  node index.js config show           - Show storage configuration');
  console.log('  node index.js autosave              - Show auto-save status and stats');
  console.log('  node index.js migrate               - Show migration status');
  console.log('  node index.js backup list           - List available backups');
  console.log('  node index.js export csv            - Export todos to CSV');
  console.log('  node index.js import todos.csv      - Import todos from CSV');
  console.log('  node index.js help delete           - Get detailed help for delete command');
  console.log('');
  console.log('STORAGE CONFIGURATION:');
  console.log('  node index.js --data-dir ~/.work config show');
  console.log('  TODO_DATA_DIR=~/projects node index.js list');
  console.log('  node index.js --data-file work.json add "Task"');
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
    case 'config':
      showConfigHelp();
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
    case 'autosave':
    case 'auto-save':
    case 'status':
      console.log('📊 AUTOSAVE COMMAND HELP');
      console.log('');
      console.log('Display auto-save status and performance statistics.');
      console.log('');
      console.log('📋 SYNTAX:');
      console.log('  node index.js autosave');
      console.log('  node index.js auto-save');
      console.log('  node index.js status');
      console.log('');
      console.log('📊 INFORMATION SHOWN:');
      console.log('  • Auto-save configuration settings');
      console.log('  • Storage health and file status');
      console.log('  • Performance statistics and timing');
      console.log('  • Configuration environment variables');
      break;
    case 'migrate':
    case 'migration':
      console.log('🔄 MIGRATION COMMAND HELP');
      console.log('');
      console.log('Manage data format migrations and upgrades.');
      console.log('');
      console.log('📋 SYNTAX:');
      console.log('  node index.js migrate               - Show migration status');
      console.log('  node index.js migrate apply         - Apply available migrations');
      console.log('');
      console.log('📊 FEATURES:');
      console.log('  • Automatic data format detection');
      console.log('  • Safe migration with backups');
      console.log('  • Version compatibility checking');
      console.log('  • Migration history tracking');
      console.log('');
      console.log('⚠️  SAFETY:');
      console.log('  • Automatic backups are created before migration');
      console.log('  • Use "backup create" to manually backup first');
      console.log('  • Migrations cannot be undone automatically');
      break;
    case 'backup':
      console.log('💾 BACKUP COMMAND HELP');
      console.log('');
      console.log('Create, list, and restore data backups.');
      console.log('');
      console.log('📋 SYNTAX:');
      console.log('  node index.js backup create [reason]    - Create manual backup');
      console.log('  node index.js backup list               - List available backups');
      console.log('  node index.js backup restore <filename> - Restore from backup');
      console.log('');
      console.log('✨ EXAMPLES:');
      console.log('  node index.js backup create             - Create backup');
      console.log('  node index.js backup create "pre-import" - Create backup with reason');
      console.log('  node index.js backup list               - Show all backups');
      console.log('  node index.js backup restore manual-backup-2024-01-01.json');
      console.log('');
      console.log('📦 BACKUP TYPES:');
      console.log('  • Automatic: Created during saves (todos.json.backup)');
      console.log('  • Manual: Created on demand with metadata');
      console.log('  • Migration: Created before data migrations');
      break;
    case 'export':
      console.log('📤 EXPORT COMMAND HELP');
      console.log('');
      console.log('Export todos to various formats for sharing or archiving.');
      console.log('');
      console.log('📋 SYNTAX:');
      console.log('  node index.js export <format> [filename]');
      console.log('');
      console.log('📄 SUPPORTED FORMATS:');
      console.log('  json                             - JSON format (default)');
      console.log('  csv                              - Comma-separated values');
      console.log('  txt                              - Plain text format');
      console.log('');
      console.log('✨ EXAMPLES:');
      console.log('  node index.js export json       - Export to timestamped JSON file');
      console.log('  node index.js export csv        - Export to CSV format');
      console.log('  node index.js export txt        - Export to plain text');
      console.log('');
      console.log('💡 FEATURES:');
      console.log('  • Includes all todo metadata (dates, priorities, tags)');
      console.log('  • Automatic timestamped filenames');
      console.log('  • Export metadata for tracking');
      break;
    case 'import':
      console.log('📥 IMPORT COMMAND HELP');
      console.log('');
      console.log('Import todos from external files.');
      console.log('');
      console.log('📋 SYNTAX:');
      console.log('  node index.js import <filepath> [--replace]');
      console.log('');
      console.log('📄 SUPPORTED FORMATS:');
      console.log('  .json                            - JSON format');
      console.log('  .csv                             - CSV format');
      console.log('');
      console.log('✨ EXAMPLES:');
      console.log('  node index.js import todos.json     - Import and add to existing');
      console.log('  node index.js import todos.csv      - Import CSV file');
      console.log('  node index.js import data.json --replace - Replace all existing todos');
      console.log('');
      console.log('📊 CSV FORMAT:');
      console.log('  Expected columns: description, completed, priority, tags, due date');
      console.log('  Header row required');
      console.log('  Automatic ID assignment');
      console.log('');
      console.log('💡 SAFETY:');
      console.log('  • Automatic backup created before import');
      console.log('  • Invalid entries are skipped with reporting');
      console.log('  • Use --replace to clear existing data first');
      break;
    default:
      console.log(`❌ Unknown command: "${command}"`);
      console.log('');
      console.log('Available commands: add, list, complete, delete, clean, clear, config, autosave, migrate, backup, export, import');
      console.log('Use "node index.js help" to see all commands.');
  }
}

// Parse command line arguments with support for global storage options
function parseArguments() {
  const args = process.argv.slice(2);
  const parsed = {
    storageOptions: {}
  };

  // Extract global storage options first
  const filteredArgs = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--data-dir' && i + 1 < args.length) {
      parsed.storageOptions.dataDir = args[i + 1];
      i++; // Skip next argument as it's the value
    } else if (arg === '--data-file' && i + 1 < args.length) {
      parsed.storageOptions.dataFile = args[i + 1];
      i++; // Skip next argument as it's the value
    } else if (arg.startsWith('--data-dir=')) {
      parsed.storageOptions.dataDir = arg.split('=', 2)[1];
    } else if (arg.startsWith('--data-file=')) {
      parsed.storageOptions.dataFile = arg.split('=', 2)[1];
    } else {
      filteredArgs.push(arg);
    }
  }

  if (filteredArgs.length === 0) {
    return { command: 'list', ...parsed };
  }

  const command = filteredArgs[0].toLowerCase();

  switch (command) {
    case 'add':
      return { command: 'add', description: filteredArgs.slice(1).join(' '), ...parsed };
    case 'list':
    case 'ls':
      return { command: 'list', ...parsed };
    case 'complete':
    case 'done':
      return { command: 'complete', id: filteredArgs[1], ...parsed };
    case 'delete':
    case 'remove':
    case 'rm':
      return { command: 'delete', id: filteredArgs[1], ...parsed };
    case 'clean':
    case 'cleanup':
      return { command: 'clean', ...parsed };
    case 'clear':
    case 'purge':
      return { command: 'clear', ...parsed };
    case 'config':
      return { command: 'config', subcommand: filteredArgs[1], args: filteredArgs.slice(2), ...parsed };
    case 'autosave':
    case 'auto-save':
    case 'status':
      return { command: 'autosave', ...parsed };
    case 'migrate':
    case 'migration':
      return { command: 'migrate', subcommand: filteredArgs[1], args: filteredArgs.slice(2), ...parsed };
    case 'backup':
      return { command: 'backup', subcommand: filteredArgs[1], args: filteredArgs.slice(2), ...parsed };
    case 'export':
      return { command: 'export', format: filteredArgs[1], filename: filteredArgs[2], ...parsed };
    case 'import':
      const importArgs = filteredArgs.slice(1);
      const replaceIndex = importArgs.indexOf('--replace');
      const filePath = importArgs[0];
      const replaceExisting = replaceIndex !== -1;

      return {
        command: 'import',
        filePath,
        replaceExisting,
        ...parsed
      };
    case 'help':
    case '--help':
    case '-h':
      return { command: 'help', subcommand: filteredArgs[1], ...parsed };
    default:
      return { command: 'unknown', original: command, ...parsed };
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
async function main() {
  const parsed = parseArguments();

  try {
    // Initialize TodoCore with storage options from command line
    await initializeTodoCore(parsed.storageOptions || {});

    if (!validateCommand(parsed)) {
      process.exit(1);
    }

    let success = true;

    switch (parsed.command) {
      case 'add':
        success = await addTodo(parsed.description);
        break;
      case 'list':
        await listTodos();
        break;
      case 'complete':
        success = await completeTodo(parsed.id);
        break;
      case 'delete':
        success = await deleteTodo(parsed.id);
        break;
      case 'clean':
        console.log('🧹 Clean command (delete completed todos) - Coming soon!');
        console.log('💡 Use "node index.js help clean" to see detailed documentation.');
        break;
      case 'clear':
        console.log('🗑️  Clear command (delete ALL todos) - Coming soon!');
        console.log('💡 Use "node index.js help clear" to see detailed documentation.');
        break;
      case 'config':
        if (parsed.subcommand === 'show' || !parsed.subcommand) {
          await showStorageConfig();
        } else if (parsed.subcommand === 'set' && parsed.args && parsed.args.length >= 2) {
          success = setStorageConfig(parsed.args[0], parsed.args[1]);
        } else if (parsed.subcommand === 'set') {
          console.error('❌ Error: Set command requires option and value');
          console.error('Usage: node index.js config set <option> <value>');
          success = false;
        } else {
          console.error(`❌ Error: Unknown config subcommand "${parsed.subcommand}"`);
          console.error('Available subcommands: show, set');
          console.error('Use "node index.js help config" for detailed help');
          success = false;
        }
        break;
      case 'autosave':
        await showStorageStatus();
        break;
      case 'migrate':
        if (parsed.subcommand === 'apply' || (parsed.subcommand && parsed.subcommand !== 'status')) {
          success = await performMigration();
        } else {
          await showMigrationStatus();
        }
        break;
      case 'backup':
        if (parsed.subcommand === 'create') {
          const reason = parsed.args && parsed.args.length > 0 ? parsed.args.join(' ') : 'manual';
          success = await createBackup(reason);
        } else if (parsed.subcommand === 'list') {
          success = await listBackups();
        } else if (parsed.subcommand === 'restore' && parsed.args && parsed.args.length > 0) {
          success = await restoreFromBackup(parsed.args[0]);
        } else {
          console.error('❌ Error: Invalid backup subcommand');
          console.error('Usage: node index.js backup <create|list|restore> [args]');
          console.error('Examples:');
          console.error('  node index.js backup create');
          console.error('  node index.js backup list');
          console.error('  node index.js backup restore backup-filename.json');
          success = false;
        }
        break;
      case 'export':
        const exportFormat = parsed.format || 'json';
        success = await exportTodos(exportFormat, parsed.filename);
        break;
      case 'import':
        if (!parsed.filePath) {
          console.error('❌ Error: Import file path is required');
          console.error('Usage: node index.js import <filepath> [--replace]');
          success = false;
        } else {
          const importOptions = {
            replaceExisting: parsed.replaceExisting
          };
          success = await importTodos(parsed.filePath, importOptions);
        }
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
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Run the app
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  });
}