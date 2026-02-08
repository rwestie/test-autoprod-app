/**
 * Delete Command Parser - Enhanced parsing and validation for delete operations
 *
 * This module provides comprehensive parsing and validation for all delete-related commands:
 * - Single delete (by ID or position)
 * - Batch delete (multiple IDs or positions)
 * - Bulk operations (clean, clear, purge)
 * - Smart error handling with helpful suggestions
 * - Input sanitization and normalization
 */
class DeleteCommandParser {
  constructor() {
    this.commands = new Map([
      // Single delete commands
      ['delete', { type: 'single', aliases: ['del', 'remove', 'rm'] }],
      ['del', { type: 'single', canonical: 'delete' }],
      ['remove', { type: 'single', canonical: 'delete' }],
      ['rm', { type: 'single', canonical: 'delete' }],

      // Batch delete commands
      ['batch-delete', { type: 'batch', aliases: ['batch-del', 'batch-remove', 'batch-rm'] }],
      ['batch-del', { type: 'batch', canonical: 'batch-delete' }],
      ['batch-remove', { type: 'batch', canonical: 'batch-delete' }],
      ['batch-rm', { type: 'batch', canonical: 'batch-delete' }],

      // Bulk operations
      ['clean', { type: 'bulk', aliases: ['cleanup'] }],
      ['cleanup', { type: 'bulk', canonical: 'clean' }],
      ['clear', { type: 'bulk', aliases: ['purge'] }],
      ['purge', { type: 'bulk', canonical: 'clear' }]
    ]);
  }

  /**
   * Parse and validate a delete command with arguments
   * @param {string} command - The command name
   * @param {Array} args - Command arguments
   * @param {Object} options - Command options (useIndex, force, etc.)
   * @returns {Object} Parsed and validated command result
   */
  parseCommand(command, args = [], options = {}) {
    const normalizedCommand = command.toLowerCase().trim();

    // Check for help flags in arguments
    const helpFlags = ['--help', '-h', 'help'];
    const hasHelpFlag = args.some(arg => helpFlags.includes(arg.toLowerCase()));

    if (hasHelpFlag) {
      return this.createHelpResult(normalizedCommand);
    }

    // Check if command exists
    if (!this.commands.has(normalizedCommand)) {
      return this.handleUnknownCommand(command, args, options);
    }

    const commandInfo = this.commands.get(normalizedCommand);
    const canonicalCommand = commandInfo.canonical || normalizedCommand;
    const commandType = commandInfo.type;

    // Preprocess arguments to handle enhanced input formats
    const processedArgs = this.preprocessArguments(args, commandType);

    // Validate based on command type
    // Note: For single commands, we need to detect if user tried batch syntax before preprocessing
    switch (commandType) {
      case 'single':
        return this.validateSingleDelete(normalizedCommand, args, processedArgs, options);
      case 'batch':
        return this.validateBatchDelete(normalizedCommand, processedArgs, options);
      case 'bulk':
        return this.validateBulkOperation(canonicalCommand, processedArgs, options);
      default:
        return this.createErrorResult('Unknown command type', command, args, options);
    }
  }

  /**
   * Create help result for delete commands
   * @param {string} command - The command requesting help
   * @returns {Object} Help result with detailed command information
   */
  createHelpResult(command) {
    const commandType = this.getCommandType(command) || 'single';
    const canonicalCommand = this.getCanonicalCommand(command) || command;

    return {
      success: true,
      type: 'help',
      command,
      canonicalCommand,
      commandType,
      helpContent: this.generateHelpContent(canonicalCommand, commandType),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate detailed help content for a specific command
   * @param {string} command - Canonical command name
   * @param {string} type - Command type (single, batch, bulk)
   * @returns {Object} Structured help content
   */
  generateHelpContent(command, type) {
    const helpMap = {
      delete: {
        title: 'Delete Single Todo',
        description: 'Delete a single todo item by ID or position',
        usage: [
          'node index.js delete <id>',
          'node index.js delete <position> --index'
        ],
        examples: [
          'node index.js delete 5         # Delete todo with ID 5',
          'node index.js delete 2 --index # Delete todo at position 2',
          'node index.js delete 3 --force # Delete without confirmation'
        ],
        aliases: ['del', 'remove', 'rm']
      },
      'batch-delete': {
        title: 'Batch Delete Todos',
        description: 'Delete multiple todo items at once by IDs or positions',
        usage: [
          'node index.js batch-delete <id1> <id2> ...',
          'node index.js batch-delete <pos1> <pos2> ... --index',
          'node index.js batch-delete <id1>,<id2>,<id3>',
          'node index.js batch-delete <start>-<end>'
        ],
        examples: [
          'node index.js batch-delete 1 3 5      # Delete todos with IDs 1, 3, 5',
          'node index.js batch-delete 1,2,3      # Delete using comma-separated format',
          'node index.js batch-delete 2-5        # Delete todos with IDs 2, 3, 4, 5',
          'node index.js batch-delete 1 2 --index # Delete todos at positions 1, 2'
        ],
        aliases: ['batch-del', 'batch-remove', 'batch-rm']
      },
      clean: {
        title: 'Clean Completed Todos',
        description: 'Delete all completed todo items',
        usage: ['node index.js clean'],
        examples: [
          'node index.js clean         # Clean with confirmation',
          'node index.js clean --force # Clean without confirmation'
        ],
        aliases: ['cleanup']
      },
      clear: {
        title: 'Clear All Todos',
        description: 'Delete ALL todo items (completed and pending)',
        usage: ['node index.js clear'],
        examples: [
          'node index.js clear         # Clear all with confirmation',
          'node index.js clear --force # Clear all without confirmation'
        ],
        aliases: ['purge']
      }
    };

    return helpMap[command] || helpMap.delete;
  }

  /**
   * Preprocess command arguments to handle enhanced input formats
   * @param {Array} args - Raw command arguments
   * @param {string} commandType - Type of command (single, batch, bulk)
   * @returns {Array} Processed arguments
   */
  preprocessArguments(args, commandType) {
    if (commandType === 'bulk') {
      return args; // Bulk operations don't process arguments
    }

    const processed = [];

    for (const arg of args) {
      // Skip flags and options
      if (typeof arg === 'string' && arg.startsWith('-')) {
        continue;
      }

      const normalizedArg = String(arg).trim();

      // Handle comma-separated input (for batch operations)
      if (normalizedArg.includes(',')) {
        const commaSeparated = normalizedArg.split(',')
          .map(item => item.trim())
          .filter(item => item.length > 0);
        processed.push(...commaSeparated);
        continue;
      }

      // Handle range input (e.g., "1-5" becomes ["1", "2", "3", "4", "5"])
      if (normalizedArg.includes('-') && /^\d+\s*-\s*\d+$/.test(normalizedArg)) {
        const [startStr, endStr] = normalizedArg.split('-').map(s => s.trim());
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);

        if (!isNaN(start) && !isNaN(end) && start <= end) {
          for (let i = start; i <= end; i++) {
            processed.push(String(i));
          }
          continue;
        }
      }

      // Regular argument processing (normalize spaces and leading zeros)
      if (normalizedArg.length > 0) {
        processed.push(normalizedArg);
      }
    }

    return processed;
  }

  /**
   * Validate single delete command (delete, del, remove, rm)
   */
  validateSingleDelete(command, originalArgs, processedArgs, options) {
    const { useIndex = false } = options;
    const identifierType = useIndex ? 'position' : 'ID';

    // Check for missing identifier
    if (originalArgs.length === 0) {
      return this.createErrorResult(
        `Missing ${identifierType}`,
        command,
        originalArgs,
        options,
        {
          code: 'MISSING_IDENTIFIER',
          suggestion: `Please specify a ${identifierType}: node index.js ${command} <${identifierType.toLowerCase()}>`,
          examples: [
            `node index.js ${command} 1`,
            `node index.js ${command} ${useIndex ? '1 --index' : '5'}`,
            `node index.js ${command} 2 --force`
          ]
        }
      );
    }

    // Detect if user tried batch syntax (comma-separated or range)
    const firstArg = String(originalArgs[0]).trim();
    const isBatchSyntax = firstArg.includes(',') || /^\d+\s*-\s*\d+$/.test(firstArg);

    // Check for too many arguments or batch syntax
    if (originalArgs.length > 1 || processedArgs.length > 1) {
      const contextualSuggestions = [];

      // Add specific suggestions based on detected patterns
      if (isBatchSyntax) {
        if (firstArg.includes(',')) {
          contextualSuggestions.push(`🔄 For comma-separated inputs, use: node index.js batch-delete ${firstArg}`);
        }
        if (/^\d+\s*-\s*\d+$/.test(firstArg)) {
          contextualSuggestions.push(`🔄 For range inputs, use: node index.js batch-delete ${firstArg}`);
        }
      } else if (processedArgs.length > 1) {
        contextualSuggestions.push('🔄 For multiple deletes, use: node index.js batch-delete <id1> <id2> ...');
      }

      contextualSuggestions.push(`📋 View current todos: node index.js list`);

      return this.createErrorResult(
        'Too many arguments for single delete',
        command,
        originalArgs,
        options,
        {
          code: 'TOO_MANY_ARGS',
          suggestion: `Single delete takes only one ${identifierType}`,
          hint: 'For multiple deletes, use batch-delete: node index.js batch-delete <id1> <id2> ...',
          contextualSuggestions
        }
      );
    }

    const identifier = originalArgs[0];
    const validation = this.validateIdentifier(identifier, identifierType);

    if (!validation.valid) {
      return this.createErrorResult(
        validation.error,
        command,
        originalArgs,
        options,
        {
          code: 'INVALID_IDENTIFIER',
          suggestion: validation.suggestion,
          examples: this.getValidIdentifierExamples(identifierType),
          contextualSuggestions: this.getContextualSuggestions(identifier, validation.error, identifierType)
        }
      );
    }

    return this.createSuccessResult(command, {
      type: 'single',
      identifier: validation.parsed,
      originalIdentifier: identifier,
      useIndex,
      identifierType
    }, options);
  }

  /**
   * Validate batch delete command (batch-delete, batch-remove, etc.)
   */
  validateBatchDelete(command, args, options) {
    const { useIndex = false } = options;
    const identifierType = useIndex ? 'position' : 'ID';

    // Check for missing identifiers
    if (args.length === 0) {
      return this.createErrorResult(
        `Missing ${identifierType}s`,
        command,
        args,
        options,
        {
          code: 'MISSING_IDENTIFIERS',
          suggestion: `Please specify multiple ${identifierType}s: node index.js ${command} <${identifierType.toLowerCase()}1> <${identifierType.toLowerCase()}2> ...`,
          examples: [
            `node index.js ${command} 1 2 3`,
            `node index.js ${command} 1 3 5${useIndex ? ' --index' : ''}`,
            `node index.js ${command} 2 4 6 --force`
          ]
        }
      );
    }

    // Validate all identifiers
    const validationResults = [];
    const validIdentifiers = [];
    const invalidIdentifiers = [];

    for (let i = 0; i < args.length; i++) {
      const identifier = args[i];
      const validation = this.validateIdentifier(identifier, identifierType);

      validationResults.push({
        original: identifier,
        index: i,
        ...validation
      });

      if (validation.valid) {
        validIdentifiers.push(validation.parsed);
      } else {
        invalidIdentifiers.push({ identifier, error: validation.error });
      }
    }

    // Check if any identifiers are invalid
    if (invalidIdentifiers.length > 0) {
      const errorMessages = invalidIdentifiers.map(item => `"${item.identifier}"`).join(', ');
      const firstInvalidId = invalidIdentifiers[0].identifier;

      return this.createErrorResult(
        `Invalid ${identifierType} format`,
        command,
        args,
        options,
        {
          code: 'INVALID_IDENTIFIERS',
          suggestion: `Invalid ${identifierType}s: ${errorMessages}`,
          hint: `Use positive numbers only`,
          examples: this.getValidIdentifierExamples(identifierType),
          contextualSuggestions: this.getContextualSuggestions(firstInvalidId, 'format', identifierType)
        }
      );
    }

    // Remove duplicates and maintain order
    const uniqueIdentifiers = [...new Set(validIdentifiers)];
    const duplicateCount = validIdentifiers.length - uniqueIdentifiers.length;

    return this.createSuccessResult(command, {
      type: 'batch',
      identifiers: uniqueIdentifiers,
      originalIdentifiers: args,
      useIndex,
      identifierType,
      duplicatesRemoved: duplicateCount,
      validationResults
    }, options);
  }

  /**
   * Validate bulk operation command (clean, clear, etc.)
   */
  validateBulkOperation(command, args, options) {
    // Bulk operations shouldn't have arguments
    if (args.length > 0) {
      const hint = command === 'clean' ?
        'Use "clean" to delete completed todos, or "clear" to delete all todos' :
        'Clear operation deletes ALL todos and takes no arguments';

      return this.createErrorResult(
        `Unexpected arguments for ${command} command`,
        command,
        args,
        options,
        {
          code: 'UNEXPECTED_ARGS',
          suggestion: `The ${command} command takes no arguments`,
          hint,
          examples: [
            `node index.js ${command}`,
            `node index.js ${command} --force`
          ]
        }
      );
    }

    // Special validation for dangerous operations
    if (command === 'clear' || command === 'purge') {
      return this.createSuccessResult(command, {
        type: 'bulk',
        operation: 'clear',
        destructive: true,
        requiresConfirmation: true
      }, options);
    }

    return this.createSuccessResult(command, {
      type: 'bulk',
      operation: command,
      destructive: false,
      requiresConfirmation: true
    }, options);
  }

  /**
   * Validate a single identifier (ID or position)
   * @param {string} identifier - The identifier to validate
   * @param {string} type - Either 'ID' or 'position'
   * @returns {Object} Validation result
   */
  validateIdentifier(identifier, type = 'ID') {
    // Check if it's a string representation of a number
    if (typeof identifier !== 'string' && typeof identifier !== 'number') {
      return {
        valid: false,
        error: `${type} must be a number`,
        suggestion: `"${identifier}" is not a valid ${type}. Use positive numbers only.`
      };
    }

    const str = String(identifier).trim();

    // Check for empty string
    if (str === '') {
      return {
        valid: false,
        error: `Empty ${type}`,
        suggestion: `${type} cannot be empty. Use a positive number.`
      };
    }

    // Enhanced validation: handle different numeric formats
    let normalizedStr = str;

    // Handle decimal numbers with .0 (convert to integer)
    if (/^\d+\.0+$/.test(normalizedStr)) {
      normalizedStr = normalizedStr.split('.')[0];
    }

    // Check for invalid formats that could be confusing
    if (normalizedStr.includes('.')) {
      return {
        valid: false,
        error: `Invalid ${type} format`,
        suggestion: `"${identifier}" is not a valid ${type}. Use positive integers only.`
      };
    }

    // Check if it contains non-numeric characters (except leading zeros)
    if (!/^\d+$/.test(normalizedStr)) {
      return {
        valid: false,
        error: `Invalid ${type} format`,
        suggestion: `"${identifier}" is not a valid ${type}. Use positive integers only.`
      };
    }

    const parsed = parseInt(normalizedStr, 10);

    // Check for zero or negative numbers
    if (parsed <= 0) {
      return {
        valid: false,
        error: `${type} must be positive`,
        suggestion: `${type} must be a positive number (1, 2, 3, ...). Got: ${parsed}`
      };
    }

    // Check for unreasonably large numbers (basic sanity check)
    if (parsed > 1000000) {
      return {
        valid: false,
        error: `${type} too large`,
        suggestion: `${type} ${parsed} seems unreasonably large. Please check your input.`
      };
    }

    return {
      valid: true,
      parsed,
      original: identifier,
      normalized: normalizedStr !== str // Indicate if normalization occurred
    };
  }

  /**
   * Handle unknown command with smart suggestions
   */
  handleUnknownCommand(command, args, options) {
    const suggestions = this.getSimilarCommands(command);

    return this.createErrorResult(
      'Unknown command',
      command,
      args,
      options,
      {
        code: 'UNKNOWN_COMMAND',
        suggestion: `"${command}" is not a recognized delete command`,
        suggestions,
        hint: 'Use "node index.js help delete" for available commands'
      }
    );
  }

  /**
   * Get similar commands for suggestions using fuzzy matching
   */
  getSimilarCommands(input) {
    const allCommands = [
      { command: 'delete', description: 'Delete a single todo by ID or position' },
      { command: 'batch-delete', description: 'Delete multiple todos at once' },
      { command: 'clean', description: 'Delete all completed todos' },
      { command: 'clear', description: 'Delete ALL todos (use with caution)' },
      { command: 'rm', description: 'Alias for delete' },
      { command: 'remove', description: 'Alias for delete' }
    ];

    const inputLower = input.toLowerCase();
    const scored = allCommands.map(cmd => {
      const cmdName = cmd.command.toLowerCase();
      let score = 0;

      // Exact match
      if (cmdName === inputLower) score += 100;

      // Starts with
      if (cmdName.startsWith(inputLower)) score += 50;

      // Contains
      if (cmdName.includes(inputLower)) score += 30;

      // Input contains command name
      if (inputLower.includes(cmdName)) score += 25;

      // Enhanced common typos and variations
      if (inputLower === 'del' && cmdName === 'delete') score += 80;
      if (inputLower === 'rem' && cmdName === 'remove') score += 80;
      if (inputLower === 'batch' && cmdName.startsWith('batch')) score += 60;
      if (inputLower.includes('clean') && cmdName === 'clean') score += 70;
      if (inputLower.includes('clear') && cmdName === 'clear') score += 70;

      // Handle common typos for delete variations
      if (inputLower.includes('delet') && cmdName === 'delete') score += 40;
      if (inputLower.includes('dele') && cmdName === 'delete') score += 30;

      // New: Handle context-aware suggestions
      if (inputLower.includes('multi') && cmdName.includes('batch')) score += 60;
      if (inputLower.includes('all') && cmdName === 'clear') score += 70;
      if (inputLower.includes('complete') && cmdName === 'clean') score += 65;

      // Handle common command confusion
      if ((inputLower.includes('undelete') || inputLower.includes('restore')) && cmdName === 'undo') score += 50;

      return { ...cmd, score };
    });

    const suggestions = scored
      .filter(cmd => cmd.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(cmd => ({ command: cmd.command, description: cmd.description }));

    // Add contextual suggestions if no good matches found
    if (suggestions.length === 0) {
      return [
        { command: 'delete', description: 'Delete a single todo by ID' },
        { command: 'list', description: 'View all todos to find IDs' },
        { command: 'help', description: 'Show all available commands' }
      ];
    }

    return suggestions;
  }

  /**
   * Get examples of valid identifiers with enhanced guidance
   */
  getValidIdentifierExamples(type = 'ID') {
    const baseExamples = [
      '✅ Valid: 1, 2, 3, 10, 25',
      '❌ Invalid: -1, 0, abc, 1.5, #1'
    ];

    if (type.toLowerCase() === 'position') {
      baseExamples.push('💡 Tip: Use "node index.js list" to see positions');
    } else {
      baseExamples.push('💡 Tip: Use "node index.js list" to see available IDs');
    }

    return baseExamples;
  }

  /**
   * Generate contextual suggestions based on input type and error
   * @param {string} invalidInput - The invalid input that caused the error
   * @param {string} errorType - Type of validation error
   * @param {string} identifierType - ID or position
   * @returns {Array} Array of contextual suggestions
   */
  getContextualSuggestions(invalidInput, errorType, identifierType = 'ID') {
    const suggestions = [];

    // Handle specific input patterns
    if (invalidInput && typeof invalidInput === 'string') {
      const input = invalidInput.toLowerCase().trim();

      // Comma-separated input in wrong command
      if (input.includes(',')) {
        suggestions.push('🔄 For comma-separated inputs, use: node index.js batch-delete 1,2,3');
      }

      // Range input in wrong command
      if (input.includes('-') && /\d+\s*-\s*\d+/.test(input)) {
        suggestions.push('🔄 For range inputs, use: node index.js batch-delete 1-5');
      }

      // Hash prefix (common mistake)
      if (input.startsWith('#')) {
        const numPart = input.substring(1);
        if (/^\d+$/.test(numPart)) {
          suggestions.push(`🔄 Remove the # prefix: node index.js delete ${numPart}`);
        }
      }

      // Decimal numbers
      if (input.includes('.') && /^\d+\.\d+$/.test(input)) {
        const intPart = Math.floor(parseFloat(input));
        if (intPart > 0) {
          suggestions.push(`🔄 Use integer instead: node index.js delete ${intPart}`);
        }
      }

      // Non-English characters or special chars
      if (/[^\w\s.-]/.test(input)) {
        suggestions.push('🔄 Use only numbers (0-9) for identifiers');
      }

      // Word-based input that might indicate confusion
      if (/^(first|last|latest|oldest|newest)$/i.test(input)) {
        suggestions.push('💡 Use position numbers: node index.js delete 1 --index (for first)');
        suggestions.push('💡 Or find the ID: node index.js list');
      }
    }

    // Add general helpful suggestions
    suggestions.push(`📋 View current todos: node index.js list`);

    if (identifierType === 'position') {
      suggestions.push('🔢 Positions start from 1 (first todo = position 1)');
    } else {
      suggestions.push('🔑 Each todo has a unique ID number');
    }

    return suggestions.slice(0, 4); // Limit to avoid overwhelming user
  }

  /**
   * Create a success result object
   */
  createSuccessResult(command, parsed, options) {
    return {
      success: true,
      command, // This preserves the original command used
      parsed,
      options,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Create an error result object with helpful information
   */
  createErrorResult(error, command, args, options, details = {}) {
    return {
      success: false,
      error,
      command,
      args,
      options,
      details,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get command type for a given command
   */
  getCommandType(command) {
    const normalizedCommand = command.toLowerCase().trim();
    if (!this.commands.has(normalizedCommand)) {
      return null;
    }
    return this.commands.get(normalizedCommand).type;
  }

  /**
   * Get canonical command name (resolves aliases)
   */
  getCanonicalCommand(command) {
    const normalizedCommand = command.toLowerCase().trim();
    if (!this.commands.has(normalizedCommand)) {
      return null;
    }
    const commandInfo = this.commands.get(normalizedCommand);
    return commandInfo.canonical || normalizedCommand;
  }

  /**
   * Check if a command exists
   */
  isValidCommand(command) {
    return this.commands.has(command.toLowerCase().trim());
  }

  /**
   * Get all available commands with their types
   */
  getAllCommands() {
    const commands = new Map();

    for (const [cmd, info] of this.commands.entries()) {
      if (!info.canonical) { // Only canonical commands, not aliases
        commands.set(cmd, {
          type: info.type,
          aliases: info.aliases || []
        });
      }
    }

    return commands;
  }
}

module.exports = { DeleteCommandParser };