const { ConfirmationUtil } = require('./confirmation-util');
const { DeleteCommandParser } = require('./delete-command-parser');

/**
 * Delete Command Interface - Centralized interface for all delete operations
 *
 * This module provides a unified interface for delete commands with:
 * - Enhanced command parsing and validation
 * - Consistent error handling and user feedback
 * - Improved command validation and suggestions
 * - Enhanced help system and guidance
 * - Smart command parsing and autocompletion
 */
class DeleteCommandInterface {
  constructor(todoCore) {
    this.todoCore = todoCore;
    this.parser = new DeleteCommandParser();

    // Handler mapping based on command types
    this.handlers = new Map([
      ['single', this.handleSingleDelete.bind(this)],
      ['batch', this.handleBatchDelete.bind(this)],
      ['bulk', this.handleBulkOperation.bind(this)]
    ]);

    // Legacy command mapping for backward compatibility
    this.commands = new Map([
      ['delete', this.handleSingleDelete.bind(this)],
      ['del', this.handleSingleDelete.bind(this)],
      ['remove', this.handleSingleDelete.bind(this)],
      ['rm', this.handleSingleDelete.bind(this)],
      ['batch-delete', this.handleBatchDelete.bind(this)],
      ['batch-del', this.handleBatchDelete.bind(this)],
      ['batch-remove', this.handleBatchDelete.bind(this)],
      ['batch-rm', this.handleBatchDelete.bind(this)],
      ['clean', this.handleClean.bind(this)],
      ['cleanup', this.handleClean.bind(this)],
      ['clear', this.handleClear.bind(this)],
      ['purge', this.handleClear.bind(this)]
    ]);
  }

  /**
   * Main entry point for all delete commands
   * @param {string} command - The delete command
   * @param {Array} args - Command arguments
   * @param {Object} options - Command options
   */
  async executeCommand(command, args = [], options = {}) {
    try {
      // Use the new parser for validation and parsing
      const parseResult = this.parser.parseCommand(command, args, options);

      // Handle parsing errors
      if (!parseResult.success) {
        return this.handleParseError(parseResult);
      }

      // Get the appropriate handler based on command type
      const handler = this.handlers.get(parseResult.parsed.type);
      if (!handler) {
        return this.createErrorResult(`No handler for command type: ${parseResult.parsed.type}`, command, args, options);
      }

      // Execute the command with parsed information
      return await handler(parseResult.parsed, parseResult.options);

    } catch (error) {
      return this.handleError(error, command, args, options);
    }
  }

  /**
   * Validate command arguments and options
   * @param {string} command - Normalized command name
   * @param {Array} args - Command arguments
   * @param {Object} options - Command options
   */
  validateCommand(command, args, options) {
    switch (command) {
      case 'delete':
      case 'del':
      case 'remove':
      case 'rm':
        return this.validateSingleDelete(args, options);

      case 'batch-delete':
      case 'batch-del':
      case 'batch-remove':
      case 'batch-rm':
        return this.validateBatchDelete(args, options);

      case 'clean':
      case 'cleanup':
      case 'clear':
      case 'purge':
        return { valid: true };

      default:
        return { valid: false, error: 'Unknown command', suggestions: this.getSimilarCommands(command) };
    }
  }

  /**
   * Validate single delete command
   */
  validateSingleDelete(args, options) {
    if (args.length === 0) {
      return {
        valid: false,
        error: 'Missing todo identifier',
        help: 'delete-missing-id',
        suggestion: options.useIndex ?
          'Please specify a position: node index.js delete <position> --index' :
          'Please specify a todo ID: node index.js delete <id>'
      };
    }

    if (args.length > 1) {
      return {
        valid: false,
        error: 'Too many arguments',
        help: 'delete-too-many',
        suggestion: 'For multiple todos, use batch-delete: node index.js batch-delete <id1> <id2> ...'
      };
    }

    const identifier = args[0];
    if (!/^\d+$/.test(identifier)) {
      return {
        valid: false,
        error: 'Invalid identifier format',
        help: 'delete-invalid-format',
        suggestion: `"${identifier}" is not a valid ${options.useIndex ? 'position' : 'ID'}. Use a positive number.`
      };
    }

    return { valid: true };
  }

  /**
   * Validate batch delete command
   */
  validateBatchDelete(args, options) {
    if (args.length === 0) {
      return {
        valid: false,
        error: 'Missing todo identifiers',
        help: 'batch-delete-missing-ids',
        suggestion: options.useIndex ?
          'Please specify positions: node index.js batch-delete <pos1> <pos2> ... --index' :
          'Please specify todo IDs: node index.js batch-delete <id1> <id2> ...'
      };
    }

    const invalidIds = args.filter(arg => !/^\d+$/.test(arg));
    if (invalidIds.length > 0) {
      return {
        valid: false,
        error: 'Invalid identifier format',
        help: 'batch-delete-invalid-format',
        suggestion: `Invalid ${options.useIndex ? 'positions' : 'IDs'}: ${invalidIds.join(', ')}. Use positive numbers only.`
      };
    }

    return { valid: true };
  }

  /**
   * Handle parsing errors from the new parser
   */
  async handleParseError(parseResult) {
    console.log(`❌ Error: ${parseResult.error}`);
    console.log('');

    const details = parseResult.details || {};

    if (details.suggestion) {
      console.log(`💡 ${details.suggestion}`);
      console.log('');
    }

    if (details.hint) {
      console.log(`ℹ️  ${details.hint}`);
      console.log('');
    }

    if (details.suggestions && details.suggestions.length > 0) {
      console.log('🤔 Did you mean:');
      details.suggestions.forEach(suggestion => {
        console.log(`  • ${suggestion.command} - ${suggestion.description}`);
      });
      console.log('');
    }

    if (details.examples && details.examples.length > 0) {
      console.log('📝 EXAMPLES:');
      details.examples.forEach(example => {
        console.log(`  ${example}`);
      });
      console.log('');
    }

    // Show help for unknown commands
    if (details.code === 'UNKNOWN_COMMAND') {
      this.showQuickHelp();
    } else {
      console.log('Use "node index.js help delete" for detailed help.');
    }

    return { success: false, error: parseResult.error };
  }

  /**
   * Handle unknown commands with smart suggestions (legacy method)
   */
  async handleUnknownCommand(command, args) {
    console.log(`❌ Unknown delete command: "${command}"`);
    console.log('');

    const suggestions = this.getSimilarCommands(command);
    if (suggestions.length > 0) {
      console.log('🤔 Did you mean:');
      suggestions.forEach(suggestion => {
        console.log(`  • ${suggestion.command} - ${suggestion.description}`);
      });
      console.log('');
    }

    this.showQuickHelp();
    return { success: false, error: 'Unknown command' };
  }

  /**
   * Handle validation errors with helpful guidance
   */
  async handleValidationError(command, validation, args, options) {
    console.log(`❌ Error: ${validation.error}`);
    console.log('');

    if (validation.suggestion) {
      console.log(`💡 ${validation.suggestion}`);
      console.log('');
    }

    // Show specific help based on error type
    if (validation.help) {
      this.showSpecificHelp(validation.help, command, args, options);
    }

    return { success: false, error: validation.error };
  }

  /**
   * Show specific contextual help
   */
  showSpecificHelp(helpType, command, args, options) {
    switch (helpType) {
      case 'delete-missing-id':
        console.log('📝 EXAMPLES:');
        console.log(`  node index.js ${command} 1              - Delete todo #1`);
        console.log(`  node index.js ${command} 2 --index       - Delete second todo`);
        console.log(`  node index.js ${command} 5 --force       - Delete todo #5 without confirmation`);
        break;

      case 'delete-too-many':
        console.log('📝 FOR MULTIPLE TODOS:');
        console.log('  node index.js batch-delete 1 2 3        - Delete todos #1, #2, #3');
        console.log('  node index.js batch-delete 1 2 --index  - Delete 1st and 2nd todos');
        break;

      case 'batch-delete-missing-ids':
        console.log('📝 EXAMPLES:');
        console.log(`  node index.js ${command} 1 2 3          - Delete todos #1, #2, #3`);
        console.log(`  node index.js ${command} 1 3 --index     - Delete 1st and 3rd todos`);
        console.log(`  node index.js ${command} 2 5 8 --force   - Delete without confirmation`);
        break;

      case 'delete-invalid-format':
        console.log('📝 VALID FORMATS:');
        console.log('  ✅ Positive numbers: 1, 2, 3, 10, 25');
        console.log('  ❌ Invalid: -1, 0, abc, 1.5, #1');
        break;
    }
    console.log('');
    console.log('Use "node index.js help delete" for complete documentation.');
  }

  /**
   * Get similar commands for suggestions
   */
  getSimilarCommands(input) {
    const allCommands = [
      { command: 'delete', description: 'Delete a single todo by ID or position' },
      { command: 'batch-delete', description: 'Delete multiple todos at once' },
      { command: 'clean', description: 'Delete all completed todos' },
      { command: 'clear', description: 'Delete ALL todos (use with caution)' },
      { command: 'rm', description: 'Alias for delete' },
      { command: 'batch-rm', description: 'Alias for batch-delete' }
    ];

    // Simple fuzzy matching
    return allCommands.filter(cmd => {
      const cmdName = cmd.command.toLowerCase();
      const inputLower = input.toLowerCase();

      // Exact match or starts with
      if (cmdName.includes(inputLower) || inputLower.includes(cmdName)) {
        return true;
      }

      // Check for common typos/variations
      if (inputLower === 'del' && cmdName === 'delete') return true;
      if (inputLower === 'remove' && cmdName === 'delete') return true;
      if (inputLower.includes('batch') && cmdName.includes('batch')) return true;
      if (inputLower === 'cleanup' && cmdName === 'clean') return true;
      if (inputLower === 'purge' && cmdName === 'clear') return true;

      return false;
    }).slice(0, 3); // Limit to top 3 suggestions
  }

  /**
   * Show quick help overview
   */
  showQuickHelp() {
    console.log('🚀 AVAILABLE DELETE COMMANDS:');
    console.log('  delete <id>           - Delete a todo by ID');
    console.log('  delete <pos> --index  - Delete by position');
    console.log('  batch-delete <ids...> - Delete multiple todos');
    console.log('  clean                 - Delete completed todos');
    console.log('  clear                 - Delete ALL todos');
    console.log('');
    console.log('Use "node index.js help delete" for detailed help.');
  }

  /**
   * Handle general errors with context
   */
  async handleError(error, command, args, options) {
    console.log('❌ An unexpected error occurred:');
    console.log(`   ${error.message}`);
    console.log('');

    // Provide recovery suggestions
    console.log('🔄 TROUBLESHOOTING:');
    console.log('  • Check if todos.json file is accessible');
    console.log('  • Verify your todo list: node index.js list');
    console.log('  • Try the command again with --force flag');
    console.log('  • Get help: node index.js help delete');

    return { success: false, error: error.message };
  }

  /**
   * Unified bulk operation handler (for new parser)
   */
  async handleBulkOperation(parsed, options) {
    const operation = parsed.operation;
    const force = options.force || false;

    switch (operation) {
      case 'clean':
        return await this.handleClean([], { force });
      case 'clear':
        return await this.handleClear([], { force });
      default:
        return this.createErrorResult(`Unknown bulk operation: ${operation}`);
    }
  }

  /**
   * Create an error result object
   */
  createErrorResult(error, command = '', args = [], options = {}) {
    return {
      success: false,
      error,
      command,
      args,
      options,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Enhanced single delete with better feedback
   */
  async handleSingleDelete(parsed, options) {
    // Handle both new parser format and legacy args format
    let identifier, useIndex, force;

    if (parsed && typeof parsed === 'object' && parsed.type === 'single') {
      // New parser format
      identifier = parsed.identifier;
      useIndex = parsed.useIndex;
      force = options.force || false;
    } else {
      // Legacy args format for backward compatibility
      const args = parsed; // In legacy mode, parsed is actually args
      identifier = args[0];
      const opts = options || {};
      useIndex = opts.useIndex || false;
      force = opts.force || false;
    }

    console.log(`🗑️  DELETE ${useIndex ? 'BY POSITION' : 'BY ID'}`);
    console.log(`   Target: ${useIndex ? 'Position' : 'ID'} ${identifier}`);
    console.log('');

    // First, try to find the todo to provide better feedback
    let todo;
    try {
      if (useIndex) {
        const todos = await this.todoCore.listTodos();
        const index = parseInt(identifier) - 1;
        if (index < 0 || index >= todos.length) {
          console.log(`❌ Position ${identifier} is out of range.`);
          console.log(`   Valid positions: 1 to ${todos.length}`);
          console.log('');
          console.log('💡 Use "node index.js list" to see current positions.');
          return { success: false, error: 'Position out of range' };
        }
        todo = todos[index];
      } else {
        const todos = await this.todoCore.listTodos();
        todo = todos.find(t => t.id === parseInt(identifier));
        if (!todo) {
          console.log(`❌ Todo #${identifier} not found.`);
          const availableIds = todos.map(t => t.id).sort((a, b) => a - b);
          if (availableIds.length > 0) {
            console.log(`   Available IDs: ${availableIds.join(', ')}`);
          } else {
            console.log('   No todos found. Add one first!');
          }
          console.log('');
          console.log('💡 Use "node index.js list" to see all todos.');
          return { success: false, error: 'Todo not found' };
        }
      }

      // Show what will be deleted
      console.log('📋 PREVIEW:');
      const status = todo.completed ? '✓' : ' ';
      console.log(`   [${status}] #${todo.id}: ${todo.description}`);
      if (todo.priority && todo.priority !== 'medium') {
        console.log(`   Priority: ${todo.priority}`);
      }
      if (todo.tags && todo.tags.length > 0) {
        console.log(`   Tags: ${todo.tags.join(', ')}`);
      }
      console.log('');

      // Confirmation (unless forced)
      if (!force) {
        const confirmed = await ConfirmationUtil.confirmDelete('delete', todo, {
          skipConfirmation: force,
          showCancellation: true
        });

        if (!confirmed) {
          ConfirmationUtil.showCancellationMessage('Delete operation');
          console.log('💡 Add --force to skip confirmation: node index.js delete ' +
            identifier + (useIndex ? ' --index' : '') + ' --force');
          return { success: false, error: 'Cancelled by user' };
        }
      }

      // Execute deletion
      const result = await this.todoCore.deleteTodo(identifier, { useIndex });

      if (result.success) {
        const deleteMethod = useIndex ? 'position' : 'ID';
        console.log(`✅ Successfully deleted todo #${result.todo.id}: ${result.todo.description}`);
        console.log(`   Deleted by ${deleteMethod}: ${identifier}`);

        // Show remaining count
        const remaining = await this.todoCore.listTodos();
        if (remaining.length > 0) {
          console.log(`📊 ${remaining.length} todos remaining`);
        } else {
          console.log('🎉 All todos completed! Your list is empty.');
          console.log('   Add new todos: node index.js add "Your next task"');
        }

        return result;
      } else {
        console.log(`❌ Failed to delete todo: ${result.error}`);
        return result;
      }

    } catch (error) {
      return this.handleError(error, 'delete', args, options);
    }
  }

  /**
   * Enhanced batch delete with progress tracking
   */
  async handleBatchDelete(parsed, options) {
    // Handle both new parser format and legacy args format
    let identifiers, useIndex, force;

    if (parsed && typeof parsed === 'object' && parsed.type === 'batch') {
      // New parser format
      identifiers = parsed.identifiers;
      useIndex = parsed.useIndex;
      force = options.force || false;
    } else {
      // Legacy args format for backward compatibility
      const args = parsed; // In legacy mode, parsed is actually args
      identifiers = args;
      const opts = options || {};
      useIndex = opts.useIndex || false;
      force = opts.force || false;
    }

    console.log(`🗑️  BATCH DELETE BY ${useIndex ? 'POSITIONS' : 'IDS'}`);
    console.log(`   Targets: ${identifiers.join(', ')}`);
    console.log('');

    // Preview what will be deleted
    console.log('🔍 Analyzing targets...');
    const previewResult = await this.todoCore.previewBatchDelete(identifiers, { useIndex });

    if (!previewResult.success) {
      console.log(`❌ Failed to preview batch delete: ${previewResult.error}`);
      return previewResult;
    }

    // Handle case where nothing to delete
    if (previewResult.count === 0) {
      console.log('❌ No todos found to delete.');

      if (previewResult.notFound && previewResult.notFound.length > 0) {
        const method = useIndex ? 'positions' : 'IDs';
        console.log(`   Not found ${method}: ${previewResult.notFound.join(', ')}`);
      }

      if (previewResult.errors && previewResult.errors.length > 0) {
        console.log('   Errors:');
        previewResult.errors.forEach(error => {
          console.log(`     • ${error}`);
        });
      }

      console.log('');
      console.log('💡 Use "node index.js list" to see available todos.');
      return { success: false, error: 'No todos to delete' };
    }

    // Show preview
    console.log('📋 BATCH DELETE PREVIEW:');
    console.log(`   Found: ${previewResult.count} todos to delete`);

    if (previewResult.notFound && previewResult.notFound.length > 0) {
      const method = useIndex ? 'positions' : 'IDs';
      console.log(`   Not found: ${previewResult.notFound.length} ${method}`);
    }

    console.log('');
    console.log('📝 TODOS TO DELETE:');
    previewResult.toBeDeleted.forEach((todo, index) => {
      const status = todo.completed ? '✓' : ' ';
      const position = index + 1;
      console.log(`   ${position}. [${status}] #${todo.id}: ${todo.description}`);
    });
    console.log('');

    // Show errors/warnings
    if (previewResult.notFound && previewResult.notFound.length > 0) {
      const method = useIndex ? 'positions' : 'IDs';
      console.log(`⚠️  Not found ${method}: ${previewResult.notFound.join(', ')}`);
    }

    if (previewResult.errors && previewResult.errors.length > 0) {
      console.log('⚠️  Errors found:');
      previewResult.errors.forEach(error => {
        console.log(`   • ${error}`);
      });
    }

    // Confirmation
    if (!force) {
      console.log('');
      const confirmed = await ConfirmationUtil.confirmDelete('batch', previewResult.toBeDeleted, {
        skipConfirmation: force,
        showCancellation: true
      });

      if (!confirmed) {
        ConfirmationUtil.showCancellationMessage('Batch delete operation');
        console.log('💡 Add --force to skip confirmation: node index.js batch-delete ' +
          identifiers.join(' ') + (useIndex ? ' --index' : '') + ' --force');
        return { success: false, error: 'Cancelled by user' };
      }
    }

    // Execute batch deletion
    console.log('');
    console.log('⚡ Executing batch delete...');
    const result = await this.todoCore.batchDeleteTodos(identifiers, { useIndex });

    if (result.success) {
      console.log(`✅ Successfully deleted ${result.count} todos!`);

      if (result.deleted && result.deleted.length > 0) {
        console.log('');
        console.log('🗑️  Deleted todos:');
        result.deleted.forEach(todo => {
          const status = todo.completed ? '✓' : ' ';
          console.log(`   [${status}] #${todo.id}: ${todo.description}`);
        });
      }

      // Show final stats
      const remaining = await this.todoCore.listTodos();
      console.log('');
      console.log('📊 SUMMARY:');
      console.log(`   Deleted: ${result.count} todos`);
      console.log(`   Remaining: ${remaining.length} todos`);

      if (remaining.length === 0) {
        console.log('');
        console.log('🎉 All todos deleted! Your list is empty.');
      }

      return result;
    } else {
      console.log(`❌ Batch delete failed: ${result.error}`);
      return result;
    }
  }

  /**
   * Enhanced clean command
   */
  async handleClean(args, options) {
    const { force = false } = options;

    console.log('🧹 CLEAN COMPLETED TODOS');
    console.log('');

    // Preview what will be cleaned
    const previewResult = await this.todoCore.previewBulkDelete('clean');

    if (!previewResult.success) {
      console.log(`❌ Failed to preview clean operation: ${previewResult.error}`);
      return previewResult;
    }

    if (previewResult.count === 0) {
      console.log('✨ No completed todos to clean.');
      console.log('   Your list is already tidy!');

      const allTodos = await this.todoCore.listTodos();
      const pendingCount = allTodos.filter(t => !t.completed).length;

      if (pendingCount > 0) {
        console.log(`   You have ${pendingCount} pending todos.`);
        console.log('   Use "node index.js list" to see them.');
      }

      return { success: true, count: 0, message: 'Nothing to clean' };
    }

    console.log(`📋 Found ${previewResult.count} completed todos to clean:`);
    previewResult.toBeDeleted.forEach(todo => {
      console.log(`   [✓] #${todo.id}: ${todo.description}`);
    });
    console.log('');

    // Confirmation
    if (!force) {
      const confirmed = await ConfirmationUtil.confirmDelete('clean', previewResult.toBeDeleted, {
        skipConfirmation: force,
        showCancellation: true
      });

      if (!confirmed) {
        ConfirmationUtil.showCancellationMessage('Clean operation');
        console.log('💡 Add --force to skip confirmation: node index.js clean --force');
        return { success: false, error: 'Cancelled by user' };
      }
    }

    // Execute clean
    const result = await this.todoCore.bulkDeleteTodos('clean', { force: true });

    if (result.success) {
      console.log(`✅ Cleaned ${result.count} completed todos!`);

      const remaining = await this.todoCore.listTodos();
      if (remaining.length > 0) {
        console.log(`📊 ${remaining.length} todos remaining`);
      } else {
        console.log('🎉 All todos cleaned! Your list is empty.');
      }

      return result;
    } else {
      console.log(`❌ Clean operation failed: ${result.error}`);
      return result;
    }
  }

  /**
   * Enhanced clear command with extra safety
   */
  async handleClear(args, options) {
    const { force = false } = options;

    console.log('🚨 CLEAR ALL TODOS');
    console.log('');

    // Preview what will be cleared
    const previewResult = await this.todoCore.previewBulkDelete('clear');

    if (!previewResult.success) {
      console.log(`❌ Failed to preview clear operation: ${previewResult.error}`);
      return previewResult;
    }

    if (previewResult.count === 0) {
      console.log('✨ No todos to clear.');
      console.log('   Your list is already empty!');
      console.log('   Add new todos: node index.js add "Your task"');
      return { success: true, count: 0, message: 'Nothing to clear' };
    }

    console.log(`⚠️  This will delete ALL ${previewResult.count} todos (both pending and completed):`);
    previewResult.toBeDeleted.forEach(todo => {
      const status = todo.completed ? '✓' : ' ';
      console.log(`   [${status}] #${todo.id}: ${todo.description}`);
    });
    console.log('');
    console.log('🚨 WARNING: This action cannot be undone!');
    console.log('');

    // Extra confirmation for clear
    if (!force) {
      const confirmed = await ConfirmationUtil.confirmDelete('clear', previewResult.toBeDeleted, {
        skipConfirmation: force,
        showCancellation: true,
        requireExactMatch: true // Extra safety
      });

      if (!confirmed) {
        ConfirmationUtil.showCancellationMessage('Clear operation');
        console.log('💡 Add --force to skip confirmation: node index.js clear --force');
        console.log('💡 To clean only completed todos: node index.js clean');
        return { success: false, error: 'Cancelled by user' };
      }
    }

    // Execute clear
    const result = await this.todoCore.bulkDeleteTodos('clear', { force: true });

    if (result.success) {
      console.log(`✅ Cleared all ${result.count} todos!`);
      console.log('🎉 Your todo list is now empty.');
      console.log('   Start fresh: node index.js add "Your first task"');

      return result;
    } else {
      console.log(`❌ Clear operation failed: ${result.error}`);
      return result;
    }
  }
}

module.exports = { DeleteCommandInterface };