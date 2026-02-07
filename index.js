#!/usr/bin/env node

const { TodoCoreEnhanced } = require('./todo-core-enhanced');
const { StorageConfig } = require('./storage-config');
const { ConfirmationUtil } = require('./confirmation-util');
const { DeleteCommandInterface } = require('./delete-command-interface');

// Global variables for configuration - will be initialized in main()
let todoCore = null;
let deleteInterface = null;

// Initialize todo core with storage options
async function initializeTodoCore(storageOptions = {}) {
  // Create storage configuration
  const storageConfig = StorageConfig.fromEnvironment().merge(storageOptions);

  // Create a TodoCoreEnhanced instance with the new storage interface
  todoCore = new TodoCoreEnhanced(storageConfig, null, 'json-file');

  // Ensure initialization is complete
  await todoCore.initialize();

  // Initialize delete command interface
  deleteInterface = new DeleteCommandInterface(todoCore);
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

// List all todos with optional filtering
async function listTodos(filter = {}) {
  const todos = await todoCore.listTodos();

  // Apply filters
  let filteredTodos = todos;
  let filterDescription = '';

  if (filter.status) {
    if (filter.status === 'pending') {
      filteredTodos = filteredTodos.filter(todo => !todo.completed);
      filterDescription = 'pending ';
    } else if (filter.status === 'completed') {
      filteredTodos = filteredTodos.filter(todo => todo.completed);
      filterDescription = 'completed ';
    }
  }

  if (filter.priority) {
    filteredTodos = filteredTodos.filter(todo => todo.priority === filter.priority);
    filterDescription += `${filter.priority} priority `;
  }

  if (filter.tag) {
    filteredTodos = filteredTodos.filter(todo =>
      todo.tags && todo.tags.includes(filter.tag)
    );
    filterDescription += `tagged with "${filter.tag}" `;
  }

  if (filter.search) {
    const searchTerm = filter.search.toLowerCase();
    filteredTodos = filteredTodos.filter(todo =>
      todo.description.toLowerCase().includes(searchTerm)
    );
    filterDescription += `containing "${filter.search}" `;
  }

  // Handle empty results
  if (filteredTodos.length === 0) {
    if (filterDescription) {
      console.log(`No ${filterDescription}todos found.`);
      if (todos.length > 0) {
        console.log(`Total todos in list: ${todos.length}`);
        console.log('Use "node index.js list" to see all todos.');
      }
    } else {
      console.log('No todos found. Add one with: node index.js add "Your todo description"');
    }
    return;
  }

  // Show header with filter information
  if (filterDescription) {
    console.log(`Your ${filterDescription}todos:`);
  } else {
    console.log('Your todos:');
  }

  // Group todos by completion status for better visual organization
  const pendingTodos = filteredTodos.filter(todo => !todo.completed);
  const completedTodos = filteredTodos.filter(todo => todo.completed);

  // Display pending todos first
  if (pendingTodos.length > 0) {
    console.log('  📋 Pending:');
    pendingTodos.forEach(todo => {
      let line = `    [ ] #${todo.id}: ${todo.description}`;

      // Add priority and tags if present
      const extras = [];
      if (todo.priority && todo.priority !== 'medium') {
        const priorityIcon = todo.priority === 'high' ? '🔴' : '🔵';
        extras.push(`${priorityIcon}${todo.priority}`);
      }
      if (todo.tags && todo.tags.length > 0) {
        extras.push(`🏷️${todo.tags.join(', ')}`);
      }
      if (extras.length > 0) {
        line += ` (${extras.join(' | ')})`;
      }

      console.log(line);
    });
  }

  // Display completed todos with visual separation
  if (completedTodos.length > 0) {
    if (pendingTodos.length > 0) {
      console.log(''); // Add spacing between sections
    }
    console.log('  ✅ Completed:');
    completedTodos.forEach(todo => {
      let line = `    [✓] #${todo.id}: ${todo.description}`;

      // Add priority and tags if present
      const extras = [];
      if (todo.priority && todo.priority !== 'medium') {
        const priorityIcon = todo.priority === 'high' ? '🔴' : '🔵';
        extras.push(`${priorityIcon}${todo.priority}`);
      }
      if (todo.tags && todo.tags.length > 0) {
        extras.push(`🏷️${todo.tags.join(', ')}`);
      }
      if (extras.length > 0) {
        line += ` (${extras.join(' | ')})`;
      }

      console.log(line);
    });
  }

  // Show summary counts
  console.log('');
  if (filterDescription) {
    console.log(`📊 Filtered results: ${filteredTodos.length} ${filterDescription}todos (${pendingTodos.length} pending, ${completedTodos.length} completed)`);
    console.log(`📊 Total in list: ${todos.length} todos`);
  } else {
    console.log(`📊 Summary: ${filteredTodos.length} total (${pendingTodos.length} pending, ${completedTodos.length} completed)`);
  }
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

async function uncompleteTodo(id) {
  const result = await todoCore.incompleteTodo(id);

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
    console.log(`🔄 Marked todo #${result.todo.id} as incomplete: ${result.todo.description}`);

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

// Delete a todo by ID or index
async function deleteTodo(identifier, options = {}) {
  const { useIndex = false, force = false } = options;

  // First, check if the todo exists and get its details without actually deleting it
  const todos = await todoCore.listTodos();
  let todo = null;

  if (useIndex) {
    const index = parseInt(identifier);
    if (isNaN(index) || index < 1 || index > todos.length) {
      console.error(`❌ Error: Invalid index. Index must be between 1 and ${todos.length}`);
      console.error('💡 Use "node index.js list" to see todo positions (1-based indexing)');
      return false;
    }
    todo = todos[index - 1]; // Convert 1-based to 0-based
  } else {
    const numId = parseInt(identifier);
    if (isNaN(numId)) {
      console.error('❌ Error: Invalid ID format');
      console.error('💡 Use "node index.js list" to see available todo IDs');
      return false;
    }
    todo = todos.find(t => t.id === numId);
    if (!todo) {
      console.error(`❌ Error: Todo with ID ${numId} not found`);
      console.error('💡 Use "node index.js list" to see available todo IDs');
      return false;
    }
  }

  // Ask for confirmation before deleting
  const confirmed = await ConfirmationUtil.confirmDelete('delete', todo, {
    force,
    showItems: true
  });

  if (!confirmed) {
    ConfirmationUtil.showCancellationMessage('Delete operation');
    ConfirmationUtil.showForceHelp(`delete ${identifier}${useIndex ? ' --index' : ''}`);
    return false;
  }

  // Now perform the actual deletion
  const result = await todoCore.deleteTodo(identifier, { useIndex });

  if (!result.success) {
    console.error(`❌ Error: ${result.error}`);
    if (useIndex) {
      console.error('💡 Use "node index.js list" to see todo positions (1-based indexing)');
    } else {
      console.error('💡 Use "node index.js list" to see available todo IDs');
    }
    if (result.storage && !result.storage.saved) {
      console.error('⚠️  Warning: Changes were not saved to storage');
    }
    return false;
  }

  const status = result.todo.completed ? '✓' : ' ';
  const deleteMethod = result.method === 'index' ? 'position' : 'ID';
  console.log(`🗑️  Successfully deleted todo #${result.todo.id}: ${result.todo.description}`);
  console.log(`   Deleted by ${deleteMethod}: ${result.deletedFrom}`);
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

// Clean completed todos (bulk delete)
async function cleanCompletedTodos(options = {}) {
  console.log('🧹 CLEANING COMPLETED TODOS');
  console.log('');

  // Preview what will be deleted
  const previewResult = await todoCore.previewBulkDelete('clean');

  if (!previewResult.success) {
    console.error(`❌ Error: ${previewResult.error}`);
    return false;
  }

  if (previewResult.count === 0) {
    console.log('✨ No completed todos to clean up.');
    console.log('💡 Use "node index.js list" to see your current todos.');
    return true;
  }

  console.log(`📋 Found ${previewResult.count} completed todos to delete:`);
  previewResult.toBeDeleted.forEach(todo => {
    console.log(`  [✓] #${todo.id}: ${todo.description}`);
  });
  console.log('');

  // Confirm deletion
  const confirmed = await ConfirmationUtil.confirmDelete('clean', previewResult.toBeDeleted, {
    force: options.force,
    showItems: true
  });

  if (!confirmed) {
    ConfirmationUtil.showCancellationMessage('Clean operation');
    ConfirmationUtil.showForceHelp('clean');
    return false;
  }

  // Perform the cleanup
  const result = await todoCore.cleanCompletedTodos();

  if (!result.success) {
    console.error(`❌ Error: ${result.error}`);
    if (result.storage && !result.storage.saved) {
      console.error('⚠️  Warning: Changes were not saved to storage');
    }
    return false;
  }

  console.log(`✅ Successfully cleaned up ${result.count} completed todos!`);

  // Display storage info if available
  if (result.storage && result.storage.saved) {
    console.log(`💾 Saved ${result.storage.count} todos to ${result.storage.location}`);
  }

  // Show remaining todos
  console.log(`📊 Remaining todos: ${result.remaining} total`);
  if (result.remaining === 0) {
    console.log('📝 All todos cleaned! Add new ones with: node index.js add "Description"');
  }

  return true;
}

// Clear all todos (bulk delete everything)
async function clearAllTodos(options = {}) {
  console.log('🗑️  CLEARING ALL TODOS');
  console.log('');

  // Preview what will be deleted
  const previewResult = await todoCore.previewBulkDelete('clear');

  if (!previewResult.success) {
    console.error(`❌ Error: ${previewResult.error}`);
    return false;
  }

  if (previewResult.count === 0) {
    console.log('✨ No todos to clear.');
    return true;
  }

  console.log(`📋 Found ${previewResult.count} todos to delete (EVERYTHING):`);
  previewResult.toBeDeleted.forEach(todo => {
    const status = todo.completed ? '✓' : ' ';
    console.log(`  [${status}] #${todo.id}: ${todo.description}`);
  });
  console.log('');

  // Confirm deletion - this is a very destructive operation
  console.log('🚨 WARNING: This will delete ALL todos (both pending and completed)!');
  const confirmed = await ConfirmationUtil.confirmDelete('clear', previewResult.toBeDeleted, {
    force: options.force,
    showItems: false  // Items already shown above
  });

  if (!confirmed) {
    ConfirmationUtil.showCancellationMessage('Clear operation');
    ConfirmationUtil.showForceHelp('clear');
    return false;
  }

  // Perform the clear
  const result = await todoCore.clearAllTodos({ force: true });

  if (!result.success) {
    console.error(`❌ Error: ${result.error}`);
    if (result.storage && !result.storage.saved) {
      console.error('⚠️  Warning: Changes were not saved to storage');
    }
    return false;
  }

  console.log(`✅ Successfully cleared ${result.count} todos!`);

  // Display storage info if available
  if (result.storage && result.storage.saved) {
    console.log(`💾 Saved ${result.storage.count} todos to ${result.storage.location}`);
  }

  console.log('📝 Todo list is now empty. Add new todos with: node index.js add "Description"');

  return true;
}

// Batch delete multiple todos by IDs or indices
async function batchDeleteTodos(identifiers, options = {}) {
  const { useIndex = false, force = false } = options;
  const method = useIndex ? 'indices' : 'IDs';

  console.log(`🗑️  BATCH DELETE BY ${method.toUpperCase()}`);
  console.log('');

  // Preview what will be deleted
  const previewResult = await todoCore.previewBatchDelete(identifiers, { useIndex });

  if (!previewResult.success) {
    console.error(`❌ Error: ${previewResult.error}`);

    if (previewResult.errors && previewResult.errors.length > 0) {
      console.error('🔍 Issues found:');
      previewResult.errors.forEach(error => {
        console.error(`  • ${error}`);
      });
    }

    if (previewResult.notFound && previewResult.notFound.length > 0) {
      console.error('❌ Not found:');
      previewResult.notFound.forEach(item => {
        console.error(`  • ${item}`);
      });
    }

    console.error('💡 Use "node index.js list" to see available todos');
    return false;
  }

  if (previewResult.count === 0) {
    console.log(`✨ No todos found to delete with the provided ${method}.`);
    console.log('💡 Use "node index.js list" to see your current todos.');
    return true;
  }

  // Show summary
  console.log(`📊 BATCH DELETE SUMMARY:`);
  console.log(`  Requested: ${previewResult.processed} ${method}`);
  console.log(`  Found: ${previewResult.found} todos`);
  if (previewResult.errors && previewResult.errors.length > 0) {
    console.log(`  Errors: ${previewResult.errors.length} issues`);
  }
  if (previewResult.notFound && previewResult.notFound.length > 0) {
    console.log(`  Not found: ${previewResult.notFound.length} ${method}`);
  }
  console.log('');

  // Show what will be deleted
  console.log(`📋 Found ${previewResult.count} todos to delete:`);
  previewResult.toBeDeleted.forEach(todo => {
    const status = todo.completed ? '✓' : ' ';
    const position = todo.position ? ` (pos: ${todo.position})` : '';
    const resolvedBy = todo.resolvedBy === 'index' ? ` [by index]` : ` [by ID]`;
    console.log(`  [${status}] #${todo.id}: ${todo.description}${position}${resolvedBy}`);
  });
  console.log('');

  // Show any issues found
  if (previewResult.errors && previewResult.errors.length > 0) {
    console.log('⚠️  Issues encountered:');
    previewResult.errors.forEach(error => {
      console.log(`  • ${error}`);
    });
    console.log('');
  }

  if (previewResult.notFound && previewResult.notFound.length > 0) {
    console.log('❌ Could not find:');
    previewResult.notFound.forEach(item => {
      console.log(`  • ${item}`);
    });
    console.log('');
  }

  // Confirm deletion
  const confirmed = await ConfirmationUtil.confirmDelete('batch', previewResult.toBeDeleted, {
    force,
    showItems: false  // Items already shown above
  });

  if (!confirmed) {
    ConfirmationUtil.showCancellationMessage('Batch delete operation');
    ConfirmationUtil.showForceHelp(`batch-delete ${identifiers.join(' ')}${useIndex ? ' --index' : ''}`);
    return false;
  }

  // Perform the batch deletion
  const result = await todoCore.batchDeleteTodos(identifiers, { useIndex });

  if (!result.success) {
    console.error(`❌ Error: ${result.error}`);
    if (result.storage && !result.storage.saved) {
      console.error('⚠️  Warning: Changes were not saved to storage');
    }
    return false;
  }

  console.log(`✅ Successfully deleted ${result.count} todos by ${result.method === 'index' ? 'indices' : 'IDs'}!`);
  console.log('');

  // Show deleted todos
  if (result.deleted && result.deleted.length > 0) {
    console.log('🗑️  Deleted todos:');
    result.deleted.forEach(todo => {
      const status = todo.completed ? '✓' : ' ';
      console.log(`  [${status}] #${todo.id}: ${todo.description} (${todo.deletedFrom})`);
    });
    console.log('');
  }

  // Display storage info if available
  if (result.storage && result.storage.saved) {
    console.log(`💾 Saved ${result.storage.count} todos to ${result.storage.location}`);
  }

  // Show remaining todos summary
  console.log(`📊 Remaining todos: ${result.remaining} total`);
  if (result.remaining === 0) {
    console.log('📝 All todos deleted! Add new ones with: node index.js add "Description"');
  }

  // Show summary statistics
  if (result.processed > result.count) {
    console.log('');
    console.log('📈 BATCH DELETE STATISTICS:');
    console.log(`  Processed: ${result.processed} ${method}`);
    console.log(`  Successfully deleted: ${result.count} todos`);
    if (result.errors && result.errors.length > 0) {
      console.log(`  Errors: ${result.errors.length} issues`);
    }
    if (result.notFound && result.notFound.length > 0) {
      console.log(`  Not found: ${result.notFound.length} ${method}`);
    }
  }

  return true;
}

// Show detailed help for delete command
function showDeleteHelp() {
  console.log('🗑️  DELETE COMMAND HELP');
  console.log('');
  console.log('Delete a todo item permanently from your list by ID or position.');
  console.log('');
  console.log('📋 SYNTAX:');
  console.log('  node index.js delete <id>           - Delete todo by ID (with confirmation)');
  console.log('  node index.js delete <position> --index - Delete todo by position (1-based)');
  console.log('  node index.js delete <id/position> --force - Skip confirmation prompt');
  console.log('  node index.js remove <id/position>  - Same as delete');
  console.log('  node index.js rm <id/position>      - Same as delete');
  console.log('');
  console.log('📝 PARAMETERS:');
  console.log('  <id>                                - The ID number of the todo to delete');
  console.log('  <position>                          - The position in the list (1-based indexing)');
  console.log('  --index                             - Use position-based deletion instead of ID');
  console.log('  --force                             - Skip confirmation prompt (immediate deletion)');
  console.log('');
  console.log('✨ EXAMPLES:');
  console.log('  🔢 By ID (default behavior):');
  console.log('  node index.js delete 5              - Delete todo with ID 5');
  console.log('  node index.js remove 2              - Delete todo with ID 2 (alias)');
  console.log('  node index.js rm 10                 - Delete todo with ID 10 (alias)');
  console.log('');
  console.log('  📍 By Position (with --index flag):');
  console.log('  node index.js delete 1 --index      - Delete first todo in list');
  console.log('  node index.js delete 3 --index      - Delete third todo in list');
  console.log('  node index.js rm 2 --index          - Delete second todo in list');
  console.log('');
  console.log('  ⚡ Skip Confirmation (with --force flag):');
  console.log('  node index.js delete 5 --force      - Delete without confirmation');
  console.log('  node index.js rm 1 --index --force  - Delete first todo without confirmation');
  console.log('');
  console.log('🔄 DIFFERENCE BETWEEN ID AND POSITION:');
  console.log('  • ID: Unique identifier (e.g., #5, #7, #12) - never changes');
  console.log('  • Position: Current order in list (1st, 2nd, 3rd) - changes as you add/remove');
  console.log('  • Use ID when you know the specific todo number shown in list');
  console.log('  • Use position when you want to delete "the first todo" or "the last todo"');
  console.log('');
  console.log('🛡️  CONFIRMATION BEHAVIOR:');
  console.log('  • By default, you will be asked to confirm before deleting any todo');
  console.log('  • The app will show you what will be deleted before asking for confirmation');
  console.log('  • Type "y" or "yes" to proceed with deletion');
  console.log('  • Type "n" or "no" to cancel the operation');
  console.log('  • Use --force flag to skip confirmation and delete immediately');
  console.log('  • This helps prevent accidental deletions of important todos');
  console.log('');
  console.log('💡 TIPS:');
  console.log('  • Use "node index.js list" to see all todos with their IDs and positions');
  console.log('  • Position counting starts at 1 (not 0) for user-friendly interface');
  console.log('  • Deleting a todo is permanent - it cannot be undone');
  console.log('  • You can delete both completed and pending todos');
  console.log('  • The app will show you what was deleted and remaining count');
  console.log('');
  console.log('❌ COMMON ERRORS:');
  console.log('  • "Todo not found" - ID doesn\'t exist, use "list" to check available IDs');
  console.log('  • "Index out of range" - Position is beyond list size');
  console.log('  • "Invalid ID/position" - Must provide a valid number');
  console.log('  • "Missing ID/position" - You must specify which todo to delete');
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
  console.log('  🔍 With Confirmation (default):');
  console.log('  node index.js clean                 - Remove completed todos (with confirmation)');
  console.log('  node index.js clear                 - Remove all todos (with confirmation)');
  console.log('');
  console.log('  ⚡ Skip Confirmation (--force flag):');
  console.log('  node index.js clean --force         - Remove completed todos immediately');
  console.log('  node index.js clear --force         - Remove all todos immediately');
  console.log('');
  console.log('🛡️  CONFIRMATION & SAFETY:');
  console.log('  • You will be prompted to confirm before any deletion occurs');
  console.log('  • The app shows exactly what will be deleted before asking confirmation');
  console.log('  • Type "y" or "yes" to proceed, "n" or "no" to cancel');
  console.log('  • Use --force flag to skip confirmation (immediate deletion)');
  console.log('  • ALL cleanup operations are PERMANENT and cannot be undone');
  console.log('');
  console.log('⚠️  SAFETY WARNINGS:');
  console.log('  • "clean/cleanup" only removes completed todos (✓ checked items)');
  console.log('  • "clear/purge" removes EVERYTHING - both pending and completed');
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
  console.log('  node index.js help batch-delete     - Help for batch todo deletion');
}

// Show detailed help for batch delete command
function showBatchDeleteHelp() {
  console.log('🗑️  BATCH DELETE COMMAND HELP');
  console.log('');
  console.log('Delete multiple todo items permanently from your list by IDs or positions in one operation.');
  console.log('');
  console.log('📋 SYNTAX:');
  console.log('  node index.js batch-delete <id1> <id2> [id3...]           - Delete multiple todos by IDs');
  console.log('  node index.js batch-delete <pos1> <pos2> [pos3...] --index - Delete multiple todos by positions');
  console.log('  node index.js batch-delete <ids...> --force               - Skip confirmation prompt');
  console.log('  node index.js batch-remove <ids...>                       - Same as batch-delete');
  console.log('  node index.js batch-rm <ids...>                           - Same as batch-delete');
  console.log('');
  console.log('📝 PARAMETERS:');
  console.log('  <id1> <id2> ...                     - Multiple ID numbers separated by spaces');
  console.log('  <pos1> <pos2> ...                   - Multiple positions in the list (1-based indexing)');
  console.log('  --index                             - Use position-based deletion instead of IDs');
  console.log('  --force                             - Skip confirmation prompt (immediate deletion)');
  console.log('');
  console.log('✨ EXAMPLES:');
  console.log('  🔢 By IDs (default behavior):');
  console.log('  node index.js batch-delete 5 7 12          - Delete todos with IDs 5, 7, and 12');
  console.log('  node index.js batch-remove 2 8 15          - Delete todos with IDs 2, 8, and 15');
  console.log('  node index.js batch-rm 3 9                 - Delete todos with IDs 3 and 9');
  console.log('');
  console.log('  📍 By Positions (with --index flag):');
  console.log('  node index.js batch-delete 1 3 5 --index   - Delete 1st, 3rd, and 5th todos');
  console.log('  node index.js batch-delete 2 4 --index     - Delete 2nd and 4th todos');
  console.log('  node index.js batch-rm 1 2 3 --index       - Delete first three todos');
  console.log('');
  console.log('  ⚡ Skip Confirmation (with --force flag):');
  console.log('  node index.js batch-delete 5 7 --force     - Delete without confirmation');
  console.log('  node index.js batch-rm 1 2 --index --force - Delete first two todos without confirmation');
  console.log('');
  console.log('🔄 DIFFERENCE BETWEEN ID AND POSITION:');
  console.log('  • ID: Unique identifier (e.g., #5, #7, #12) - never changes');
  console.log('  • Position: Current order in list (1st, 2nd, 3rd) - changes as you add/remove');
  console.log('  • Use IDs when you know the specific todo numbers shown in list');
  console.log('  • Use positions when you want to delete "the first few todos" or "every other todo"');
  console.log('');
  console.log('⚙️  BATCH OPERATION FEATURES:');
  console.log('  • Validates all identifiers before deleting any todos');
  console.log('  • Shows preview of what will be deleted before confirmation');
  console.log('  • Handles duplicates automatically (each todo deleted only once)');
  console.log('  • Reports detailed statistics of success/failure for each identifier');
  console.log('  • Continues processing even if some identifiers are invalid');
  console.log('  • Atomic operation - either all valid deletes succeed or all fail');
  console.log('');
  console.log('🛡️  CONFIRMATION BEHAVIOR:');
  console.log('  • By default, you will be asked to confirm before deleting any todos');
  console.log('  • The app shows exactly what will be deleted and any issues found');
  console.log('  • Reports both successful finds and any errors or missing items');
  console.log('  • Type "y" or "yes" to proceed with deletion');
  console.log('  • Type "n" or "no" to cancel the entire operation');
  console.log('  • Use --force flag to skip confirmation and delete immediately');
  console.log('  • This helps prevent accidental deletions of important todos');
  console.log('');
  console.log('📊 PROCESSING DETAILS:');
  console.log('  • Duplicate identifiers are automatically removed');
  console.log('  • Invalid formats (non-numbers) are reported as errors');
  console.log('  • Non-existent IDs or out-of-range positions are reported as not found');
  console.log('  • Only valid, found todos are included in the deletion operation');
  console.log('  • Detailed success/failure statistics are shown after completion');
  console.log('');
  console.log('💡 TIPS:');
  console.log('  • Use "node index.js list" to see all todos with their IDs and positions');
  console.log('  • Position counting starts at 1 (not 0) for user-friendly interface');
  console.log('  • Batch deleting is permanent - it cannot be undone');
  console.log('  • You can mix IDs but not mix IDs with positions in one command');
  console.log('  • Large batch operations show progress and detailed reporting');
  console.log('  • Use single delete for individual todos, batch for multiple');
  console.log('');
  console.log('❌ COMMON ERRORS:');
  console.log('  • "Invalid format" - Some identifiers are not numbers');
  console.log('  • "Not found" - Some IDs don\'t exist or positions are out of range');
  console.log('  • "No identifiers" - Must provide at least one ID or position');
  console.log('  • "Mixed usage" - Cannot use both --index and regular IDs simultaneously');
  console.log('');
  console.log('🔗 RELATED COMMANDS:');
  console.log('  delete <id>                         - Delete a single todo');
  console.log('  clean                               - Delete all completed todos');
  console.log('  clear                               - Delete ALL todos');
  console.log('');
  console.log('📚 MORE HELP:');
  console.log('  node index.js help                  - Show all available commands');
  console.log('  node index.js help delete           - Help for single todo deletion');
  console.log('  node index.js help clean            - Help for cleaning completed todos');
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

// Undo the most recent deletion
async function undoLastDeletion() {
  console.log('↩️  UNDO LAST DELETION');
  console.log('');

  const undoResult = await todoCore.undoLastDeletion();

  if (!undoResult.success) {
    console.error(`❌ Error: ${undoResult.error}`);
    if (undoResult.error.includes('No recent deletions')) {
      console.log('💡 Delete some todos first, then you can undo those deletions.');
      console.log('💡 Use "node index.js undo list" to see available deletions to undo.');
    }
    return false;
  }

  console.log(`✅ Successfully undid ${undoResult.deletionType} deletion!`);
  console.log(`📝 Restored ${undoResult.restoredCount} todo(s):`);

  undoResult.restoredTodos.forEach(todo => {
    const status = todo.completed ? '✓' : ' ';
    console.log(`  [${status}] #${todo.id}: ${todo.description}`);
  });

  // Display storage info if available
  if (undoResult.storage && undoResult.storage.saved) {
    console.log(`💾 Saved ${undoResult.storage.count} todos to ${undoResult.storage.location}`);
  }

  // Show current todo count
  const todos = await todoCore.listTodos();
  console.log(`📊 Current todos: ${todos.length} total`);

  return true;
}

// Undo a specific deletion by ID
async function undoSpecificDeletion(deletionId) {
  console.log(`↩️  UNDO DELETION: ${deletionId}`);
  console.log('');

  const undoResult = await todoCore.undoDeletion(deletionId);

  if (!undoResult.success) {
    console.error(`❌ Error: ${undoResult.error}`);
    if (undoResult.error.includes('not found')) {
      console.log('💡 Use "node index.js undo list" to see available deletions to undo.');
    }
    return false;
  }

  console.log(`✅ Successfully undid ${undoResult.deletionType} deletion!`);
  console.log(`📝 Restored ${undoResult.restoredCount} todo(s):`);

  undoResult.restoredTodos.forEach(todo => {
    const status = todo.completed ? '✓' : ' ';
    console.log(`  [${status}] #${todo.id}: ${todo.description}`);
  });

  // Show deletion details
  if (undoResult.metadata && undoResult.metadata.originalDeletion) {
    const original = undoResult.metadata.originalDeletion;
    console.log('');
    console.log('🔍 Original deletion details:');
    console.log(`  Deletion ID: ${original.id}`);
    console.log(`  Type: ${original.type}`);
    console.log(`  Deleted at: ${new Date(original.timestamp).toLocaleString()}`);
    console.log(`  Undone at: ${new Date(undoResult.metadata.undoneAt).toLocaleString()}`);
  }

  // Display storage info if available
  if (undoResult.storage && undoResult.storage.saved) {
    console.log(`💾 Saved ${undoResult.storage.count} todos to ${undoResult.storage.location}`);
  }

  return true;
}

// List recent deletions that can be undone
async function listRecentDeletions(limit = 10) {
  console.log('📜 RECENT DELETIONS');
  console.log('');

  const recentDeletions = todoCore.getRecentDeletions(limit);

  if (recentDeletions.length === 0) {
    console.log('No recent deletions available for undo.');
    console.log('');
    console.log('💡 TIP: When you delete todos, they\'ll appear here and can be undone.');
    console.log('💡 Deletions are kept for 24 hours and up to 50 entries.');
    return true;
  }

  console.log(`Found ${recentDeletions.length} recent deletion(s) that can be undone:`);
  console.log('');

  recentDeletions.forEach((deletion, index) => {
    const typeIcon = {
      'single': '🗑️',
      'batch': '📦',
      'bulk': '🧹'
    }[deletion.type] || '❌';

    console.log(`${index + 1}. ${typeIcon} ${deletion.summary}`);
    console.log(`   ID: ${deletion.id}`);
    console.log(`   Count: ${deletion.deletedCount} todo(s)`);
    console.log(`   Time: ${new Date(deletion.timestamp).toLocaleString()}`);
    console.log('');
  });

  console.log('💡 To undo a specific deletion:');
  console.log('   node index.js undo <deletion-id>');
  console.log('');
  console.log('💡 To undo the most recent deletion:');
  console.log('   node index.js undo');

  return true;
}

// Show undo statistics and status
async function showUndoStats() {
  console.log('📊 UNDO STATISTICS');
  console.log('');

  const stats = todoCore.getUndoStats();

  console.log('📈 HISTORY OVERVIEW:');
  console.log(`  Total deletion entries: ${stats.totalEntries}`);
  console.log(`  Available for undo: ${stats.availableUndos}`);
  console.log(`  Already used: ${stats.usedUndos}`);
  console.log(`  Max history size: ${stats.maxHistorySize}`);
  console.log('');

  if (Object.keys(stats.typeStats).length > 0) {
    console.log('📋 DELETION TYPES:');
    Object.entries(stats.typeStats).forEach(([type, count]) => {
      const typeIcon = {
        'single': '🗑️',
        'batch': '📦',
        'bulk': '🧹'
      }[type] || '❌';
      console.log(`  ${typeIcon} ${type}: ${count} deletion(s)`);
    });
    console.log('');
  }

  console.log('ℹ️  INFORMATION:');
  console.log('  • Deletions are stored for 24 hours');
  console.log('  • Maximum 50 deletion entries kept');
  console.log('  • Each deletion can only be undone once');
  console.log('  • Undoing restores todos with new IDs if conflicts exist');

  return true;
}

// Clear all undo history
async function clearUndoHistory() {
  console.log('🗑️  CLEAR UNDO HISTORY');
  console.log('');

  console.log('⚠️  WARNING: This will permanently remove all undo history!');
  console.log('After clearing, you will not be able to undo any previous deletions.');
  console.log('');

  const confirmed = await ConfirmationUtil.confirmDelete('clear-undo', [], {
    force: false,
    showItems: false
  });

  if (!confirmed) {
    ConfirmationUtil.showCancellationMessage('Clear undo history operation');
    console.log('💡 Use --force flag to skip confirmation: node index.js undo clear --force');
    return false;
  }

  const clearResult = todoCore.clearUndoHistory();

  if (clearResult.success) {
    console.log(`✅ Successfully cleared ${clearResult.clearedCount} undo entries.`);
    console.log('📝 Undo history is now empty.');
  } else {
    console.error('❌ Failed to clear undo history.');
    return false;
  }

  return true;
}

// Show detailed help for undo commands
function showUndoHelp() {
  console.log('↩️  UNDO COMMAND HELP');
  console.log('');
  console.log('Restore recently deleted todos back to your list.');
  console.log('');
  console.log('📋 SYNTAX:');
  console.log('  node index.js undo                     - Undo the most recent deletion');
  console.log('  node index.js undo <deletion-id>       - Undo a specific deletion');
  console.log('  node index.js undo list [count]        - List recent deletions');
  console.log('  node index.js undo stats               - Show undo statistics');
  console.log('  node index.js undo clear [--force]     - Clear undo history');
  console.log('');
  console.log('📝 SUBCOMMANDS:');
  console.log('  (no args)                               - Undo most recent deletion');
  console.log('  <deletion-id>                           - Undo specific deletion by its ID');
  console.log('  list [count]                            - Show recent deletions (default: 10)');
  console.log('  stats                                   - Show undo statistics and limits');
  console.log('  clear                                   - Clear all undo history (with confirmation)');
  console.log('');
  console.log('✨ EXAMPLES:');
  console.log('  🔄 Basic undo operations:');
  console.log('  node index.js undo                     - Undo the last deletion');
  console.log('  node index.js undo del_1234567890_abc  - Undo specific deletion');
  console.log('');
  console.log('  📜 List and browse deletions:');
  console.log('  node index.js undo list                - Show last 10 deletions');
  console.log('  node index.js undo list 20             - Show last 20 deletions');
  console.log('  node index.js undo stats               - Show undo statistics');
  console.log('');
  console.log('  🗑️  Manage undo history:');
  console.log('  node index.js undo clear               - Clear history (with confirmation)');
  console.log('  node index.js undo clear --force       - Clear history (skip confirmation)');
  console.log('');
  console.log('🔄 HOW UNDO WORKS:');
  console.log('  • When you delete todos, they\'re saved in an undo history');
  console.log('  • You can restore deleted todos using the undo command');
  console.log('  • Each deletion gets a unique ID for specific undo operations');
  console.log('  • Restored todos get new IDs to avoid conflicts');
  console.log('  • Each deletion can only be undone once');
  console.log('');
  console.log('📊 SUPPORTED DELETION TYPES:');
  console.log('  🗑️  Single: Individual todo deletions (delete, remove, rm)');
  console.log('  📦 Batch: Multiple todo deletions (batch-delete, batch-remove)');
  console.log('  🧹 Bulk: Mass operations (clean completed, clear all)');
  console.log('');
  console.log('⏰ TIME LIMITS:');
  console.log('  • Deletions are kept for 24 hours');
  console.log('  • Maximum 50 deletion entries stored');
  console.log('  • Older entries are automatically cleaned up');
  console.log('');
  console.log('💡 TIPS:');
  console.log('  • Use "list" to see what can be undone');
  console.log('  • Deletion IDs are shown when deleting todos');
  console.log('  • Undo immediately after accidental deletions');
  console.log('  • Use "stats" to monitor undo history usage');
  console.log('  • Clear history periodically for privacy');
  console.log('');
  console.log('❌ LIMITATIONS:');
  console.log('  • Cannot undo the same deletion twice');
  console.log('  • Restored todos may have different positions');
  console.log('  • Undo history is not persisted between application restarts');
  console.log('  • Cannot undo operations from previous application sessions');
  console.log('');
  console.log('📚 MORE HELP:');
  console.log('  node index.js help                     - Show all available commands');
  console.log('  node index.js help delete              - Help for deletion commands');
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
  console.log('  list [filter-options]               - List todos with optional filtering');
  console.log('    --status pending                  - List only pending todos');
  console.log('    --priority high                   - List only high priority todos');
  console.log('    --tag work                        - List todos tagged with "work"');
  console.log('    --search "meeting"                - Search todos containing "meeting"');
  console.log('  complete <id>                       - Mark todo as complete');
  console.log('  uncomplete <id>                     - Mark completed todo as incomplete');
  console.log('  delete <id>                         - Delete a todo by ID (with confirmation)');
  console.log('  delete <position> --index           - Delete a todo by position (with confirmation)');
  console.log('  delete <id> --force                 - Delete without confirmation');
  console.log('  batch-delete <ids...>               - Delete multiple todos by IDs');
  console.log('  batch-delete <positions...> --index - Delete multiple todos by positions');
  console.log('  clean                               - Delete all completed todos (with confirmation)');
  console.log('  clean --force                       - Delete completed todos without confirmation');
  console.log('  clear                               - Delete ALL todos (with confirmation)');
  console.log('  clear --force                       - Delete all todos without confirmation');
  console.log('  undo [deletion-id]                  - Undo recent deletions');
  console.log('  undo list [count]                   - List recent deletions that can be undone');
  console.log('  undo stats                          - Show undo statistics and limits');
  console.log('  undo clear [--force]                - Clear undo history');
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
  console.log('  node index.js uncomplete 1          - Mark todo #1 as incomplete again');
  console.log('  node index.js delete 2              - Delete todo #2');
  console.log('  node index.js batch-delete 1 3 5    - Delete todos #1, #3, and #5');
  console.log('  node index.js clean                 - Remove all completed todos');
  console.log('  node index.js clear                 - Remove ALL todos');
  console.log('  node index.js undo                  - Undo the last deletion');
  console.log('  node index.js undo list             - Show recent deletions');
  console.log('  node index.js undo del_123_abc      - Undo specific deletion');
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
  console.log('  incomplete, uncomplete              - Mark incomplete');
  console.log('  rm, remove, delete                  - Delete todos');
  console.log('  batch-rm, batch-remove, batch-delete - Delete multiple todos');
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
    case 'batch-delete':
    case 'batch-remove':
    case 'batch-rm':
      showBatchDeleteHelp();
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
    case 'undo':
      showUndoHelp();
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
      console.log('Display todos in your list with optional filtering options.');
      console.log('');
      console.log('📋 SYNTAX:');
      console.log('  node index.js list [filter-options]');
      console.log('  node index.js ls [filter-options]');
      console.log('');
      console.log('🔍 FILTER OPTIONS:');
      console.log('  --status <status>               - Filter by completion status');
      console.log('  --priority <priority>           - Filter by priority level');
      console.log('  --tag <tag>                     - Filter by tag');
      console.log('  --search <text>                 - Search in todo descriptions');
      console.log('');
      console.log('📝 FILTER VALUES:');
      console.log('  status: pending, completed');
      console.log('  priority: low, medium, high');
      console.log('  tag: any tag string');
      console.log('  search: any text to search for');
      console.log('');
      console.log('✨ EXAMPLES:');
      console.log('  node index.js list              - Show all todos');
      console.log('  node index.js list --status pending - Show only incomplete todos');
      console.log('  node index.js list --priority high - Show only high priority todos');
      console.log('  node index.js list --tag work   - Show todos tagged with "work"');
      console.log('  node index.js list --search meeting - Show todos containing "meeting"');
      console.log('');
      console.log('🔗 COMBINING FILTERS:');
      console.log('  node index.js list --status pending --priority high');
      console.log('  node index.js list --tag work --search project');
      console.log('  node index.js list --priority low --status completed');
      console.log('');
      console.log('✨ OUTPUT FORMAT:');
      console.log('  [✓] #1: Completed todo (🔴high | 🏷️work)');
      console.log('  [ ] #2: Pending todo (🔵low | 🏷️personal, urgent)');
      console.log('');
      console.log('💡 TIPS:');
      console.log('  • Filters can be combined for more specific results');
      console.log('  • Search is case-insensitive');
      console.log('  • Priority and tag information is shown when available');
      console.log('  • Use quotes for search terms with spaces: --search "team meeting"');
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
    case 'uncomplete':
    case 'incomplete':
      console.log('🔄 UNCOMPLETE COMMAND HELP');
      console.log('');
      console.log('Mark a completed todo as incomplete (reactivate it).');
      console.log('');
      console.log('📋 SYNTAX:');
      console.log('  node index.js uncomplete <id>');
      console.log('  node index.js incomplete <id>');
      console.log('');
      console.log('✨ EXAMPLES:');
      console.log('  node index.js uncomplete 1');
      console.log('  node index.js incomplete 5');
      console.log('');
      console.log('💡 NOTES:');
      console.log('  • Use "list" command to see all todos with their completion status');
      console.log('  • Can only uncomplete todos that are already completed');
      console.log('  • This removes the completion date from the todo');
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
      console.log('Available commands: add, list, complete, uncomplete, delete, clean, clear, undo, config, autosave, migrate, backup, export, import');
      console.log('Use "node index.js help" to see all commands.');
  }
}

// Parse command line arguments with support for global storage options
function parseArguments() {
  const args = process.argv.slice(2);
  const parsed = {
    storageOptions: {}
  };

  // Extract global storage options and flags first
  const filteredArgs = [];
  let forceFlag = false;
  let indexFlag = false;

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
    } else if (arg === '--force') {
      forceFlag = true;
    } else if (arg === '--index') {
      indexFlag = true;
    } else {
      filteredArgs.push(arg);
    }
  }

  parsed.force = forceFlag;
  parsed.useIndex = indexFlag;

  if (filteredArgs.length === 0) {
    return { command: 'list', ...parsed };
  }

  const command = filteredArgs[0].toLowerCase();

  switch (command) {
    case 'add':
      return { command: 'add', description: filteredArgs.slice(1).join(' '), ...parsed };
    case 'list':
    case 'ls':
      // Parse list filters: list --status pending --priority high --tag work --search "meeting"
      const listFilters = {};
      let remainingArgs = [...filteredArgs.slice(1)];

      // Parse filter arguments
      for (let i = 0; i < remainingArgs.length; i++) {
        const arg = remainingArgs[i];

        if (arg === '--status' && i + 1 < remainingArgs.length) {
          const status = remainingArgs[i + 1].toLowerCase();
          if (['pending', 'completed'].includes(status)) {
            listFilters.status = status;
          } else {
            console.error(`❌ Error: Invalid status "${remainingArgs[i + 1]}". Must be "pending" or "completed"`);
            process.exit(1);
          }
          i++; // Skip next argument as it's the value
        } else if (arg === '--priority' && i + 1 < remainingArgs.length) {
          const priority = remainingArgs[i + 1].toLowerCase();
          if (['low', 'medium', 'high'].includes(priority)) {
            listFilters.priority = priority;
          } else {
            console.error(`❌ Error: Invalid priority "${remainingArgs[i + 1]}". Must be "low", "medium", or "high"`);
            process.exit(1);
          }
          i++; // Skip next argument as it's the value
        } else if (arg === '--tag' && i + 1 < remainingArgs.length) {
          listFilters.tag = remainingArgs[i + 1];
          i++; // Skip next argument as it's the value
        } else if (arg === '--search' && i + 1 < remainingArgs.length) {
          listFilters.search = remainingArgs[i + 1];
          i++; // Skip next argument as it's the value
        } else if (arg.startsWith('--status=')) {
          const status = arg.split('=', 2)[1].toLowerCase();
          if (['pending', 'completed'].includes(status)) {
            listFilters.status = status;
          } else {
            console.error(`❌ Error: Invalid status "${arg.split('=', 2)[1]}". Must be "pending" or "completed"`);
            process.exit(1);
          }
        } else if (arg.startsWith('--priority=')) {
          const priority = arg.split('=', 2)[1].toLowerCase();
          if (['low', 'medium', 'high'].includes(priority)) {
            listFilters.priority = priority;
          } else {
            console.error(`❌ Error: Invalid priority "${arg.split('=', 2)[1]}". Must be "low", "medium", or "high"`);
            process.exit(1);
          }
        } else if (arg.startsWith('--tag=')) {
          listFilters.tag = arg.split('=', 2)[1];
        } else if (arg.startsWith('--search=')) {
          listFilters.search = arg.split('=', 2)[1];
        } else if (arg.startsWith('--')) {
          console.error(`❌ Error: Unknown filter option "${arg}"`);
          console.error('Available filters: --status, --priority, --tag, --search');
          process.exit(1);
        } else {
          console.error(`❌ Error: Unexpected argument "${arg}"`);
          console.error('Use "node index.js help list" for usage information');
          process.exit(1);
        }
      }

      return { command: 'list', filter: listFilters, ...parsed };
    case 'complete':
    case 'done':
      return { command: 'complete', id: filteredArgs[1], ...parsed };
    case 'uncomplete':
    case 'incomplete':
      return { command: 'uncomplete', id: filteredArgs[1], ...parsed };
    case 'delete':
    case 'remove':
    case 'rm':
      return { command: 'delete', identifier: filteredArgs[1], useIndex: parsed.useIndex, ...parsed };
    case 'batch-delete':
    case 'batch-remove':
    case 'batch-rm':
      // Parse multiple identifiers for batch deletion
      const identifiers = filteredArgs.slice(1);
      return { command: 'batch-delete', identifiers, useIndex: parsed.useIndex, ...parsed };
    case 'clean':
    case 'cleanup':
      return { command: 'clean', force: parsed.force, ...parsed };
    case 'clear':
    case 'purge':
      return { command: 'clear', force: parsed.force, ...parsed };
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
    case 'undo':
      // Parse undo subcommands: undo, undo <id>, undo list [count], undo stats, undo clear
      const undoSubcommand = filteredArgs[1];
      const undoArgs = filteredArgs.slice(2);

      if (!undoSubcommand) {
        // Just "undo" - undo last deletion
        return { command: 'undo', subcommand: 'last', ...parsed };
      } else if (undoSubcommand === 'list') {
        // "undo list [count]"
        const count = undoArgs[0] ? parseInt(undoArgs[0]) : 10;
        return { command: 'undo', subcommand: 'list', count, ...parsed };
      } else if (undoSubcommand === 'stats') {
        // "undo stats"
        return { command: 'undo', subcommand: 'stats', ...parsed };
      } else if (undoSubcommand === 'clear') {
        // "undo clear [--force]"
        return { command: 'undo', subcommand: 'clear', force: parsed.force, ...parsed };
      } else {
        // "undo <deletion-id>" - undo specific deletion
        return { command: 'undo', subcommand: 'specific', deletionId: undoSubcommand, ...parsed };
      }
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

    case 'uncomplete':
      if (!parsed.id) {
        console.error('Error: Uncomplete command requires a todo ID');
        console.error('Usage: node index.js uncomplete <id>');
        return false;
      }
      if (isNaN(parseInt(parsed.id))) {
        console.error('Error: Todo ID must be a valid number');
        return false;
      }
      break;

    case 'delete':
      if (!parsed.identifier) {
        console.error(`❌ Error: Delete command requires a ${parsed.useIndex ? 'position' : 'todo ID'}`);
        console.error('💡 Use "node index.js help delete" for detailed guidance.');
        return false;
      }
      if (isNaN(parseInt(parsed.identifier))) {
        console.error(`❌ Error: Invalid ${parsed.useIndex ? 'position' : 'ID'} format: "${parsed.identifier}"`);
        console.error(`💡 Use positive numbers only. Get help: node index.js help delete`);
        return false;
      }
      break;

    case 'batch-delete':
      if (!parsed.identifiers || parsed.identifiers.length === 0) {
        console.error(`❌ Error: Batch delete requires at least one ${parsed.useIndex ? 'position' : 'todo ID'}`);
        console.error('💡 Use "node index.js help batch-delete" for detailed guidance.');
        return false;
      }
      // Check if identifiers are valid numbers
      const invalidIds = parsed.identifiers.filter(id => isNaN(parseInt(id)));
      if (invalidIds.length > 0) {
        console.error(`❌ Error: Invalid ${parsed.useIndex ? 'position' : 'ID'} format: ${invalidIds.join(', ')}`);
        console.error(`💡 Use positive numbers only. Get help: node index.js help batch-delete`);
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
        await listTodos(parsed.filter || {});
        break;
      case 'complete':
        success = await completeTodo(parsed.id);
        break;
      case 'uncomplete':
        success = await uncompleteTodo(parsed.id);
        break;
      case 'delete':
        const deleteResult = await deleteInterface.executeCommand('delete', [parsed.identifier], { useIndex: parsed.useIndex, force: parsed.force });
        success = deleteResult.success;
        break;
      case 'batch-delete':
        const batchResult = await deleteInterface.executeCommand('batch-delete', parsed.identifiers, { useIndex: parsed.useIndex, force: parsed.force });
        success = batchResult.success;
        break;
      case 'clean':
        const cleanResult = await deleteInterface.executeCommand('clean', [], { force: parsed.force });
        success = cleanResult.success;
        break;
      case 'clear':
        const clearResult = await deleteInterface.executeCommand('clear', [], { force: parsed.force });
        success = clearResult.success;
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
      case 'undo':
        switch (parsed.subcommand) {
          case 'last':
            success = await undoLastDeletion();
            break;
          case 'specific':
            if (!parsed.deletionId) {
              console.error('❌ Error: Deletion ID is required');
              console.error('Usage: node index.js undo <deletion-id>');
              console.error('Use "node index.js undo list" to see available deletions');
              success = false;
            } else {
              success = await undoSpecificDeletion(parsed.deletionId);
            }
            break;
          case 'list':
            success = await listRecentDeletions(parsed.count || 10);
            break;
          case 'stats':
            success = await showUndoStats();
            break;
          case 'clear':
            success = await clearUndoHistory();
            break;
          default:
            console.error(`❌ Error: Unknown undo subcommand "${parsed.subcommand}"`);
            console.error('Available subcommands: list, stats, clear');
            console.error('Use "node index.js help undo" for detailed help');
            success = false;
            break;
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