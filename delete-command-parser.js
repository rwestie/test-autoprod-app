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

    // Check if command exists
    if (!this.commands.has(normalizedCommand)) {
      return this.handleUnknownCommand(command, args, options);
    }

    const commandInfo = this.commands.get(normalizedCommand);
    const canonicalCommand = commandInfo.canonical || normalizedCommand;
    const commandType = commandInfo.type;

    // Validate based on command type
    switch (commandType) {
      case 'single':
        return this.validateSingleDelete(normalizedCommand, args, options);
      case 'batch':
        return this.validateBatchDelete(normalizedCommand, args, options);
      case 'bulk':
        return this.validateBulkOperation(canonicalCommand, args, options);
      default:
        return this.createErrorResult('Unknown command type', command, args, options);
    }
  }

  /**
   * Validate single delete command (delete, del, remove, rm)
   */
  validateSingleDelete(command, args, options) {
    const { useIndex = false } = options;
    const identifierType = useIndex ? 'position' : 'ID';

    // Check for missing identifier
    if (args.length === 0) {
      return this.createErrorResult(
        `Missing ${identifierType}`,
        command,
        args,
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

    // Check for too many arguments
    if (args.length > 1) {
      return this.createErrorResult(
        'Too many arguments for single delete',
        command,
        args,
        options,
        {
          code: 'TOO_MANY_ARGS',
          suggestion: `Single delete takes only one ${identifierType}`,
          hint: 'For multiple deletes, use batch-delete: node index.js batch-delete <id1> <id2> ...'
        }
      );
    }

    const identifier = args[0];
    const validation = this.validateIdentifier(identifier, identifierType);

    if (!validation.valid) {
      return this.createErrorResult(
        validation.error,
        command,
        args,
        options,
        {
          code: 'INVALID_IDENTIFIER',
          suggestion: validation.suggestion,
          examples: this.getValidIdentifierExamples(identifierType)
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
      return this.createErrorResult(
        `Invalid ${identifierType} format`,
        command,
        args,
        options,
        {
          code: 'INVALID_IDENTIFIERS',
          suggestion: `Invalid ${identifierType}s: ${errorMessages}`,
          hint: `Use positive numbers only`,
          examples: this.getValidIdentifierExamples(identifierType)
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

    // Check if it's a valid integer
    if (!/^\d+$/.test(str)) {
      return {
        valid: false,
        error: `Invalid ${type} format`,
        suggestion: `"${identifier}" is not a valid ${type}. Use positive integers only.`
      };
    }

    const parsed = parseInt(str, 10);

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
      original: identifier
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

      // Common typos and variations
      if (inputLower === 'del' && cmdName === 'delete') score += 80;
      if (inputLower === 'rem' && cmdName === 'remove') score += 80;
      if (inputLower === 'batch' && cmdName.startsWith('batch')) score += 60;
      if (inputLower.includes('clean') && cmdName === 'clean') score += 70;
      if (inputLower.includes('clear') && cmdName === 'clear') score += 70;

      // Handle common typos for delete variations
      if (inputLower.includes('delet') && cmdName === 'delete') score += 40;
      if (inputLower.includes('dele') && cmdName === 'delete') score += 30;

      return { ...cmd, score };
    });

    return scored
      .filter(cmd => cmd.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(cmd => ({ command: cmd.command, description: cmd.description }));
  }

  /**
   * Get examples of valid identifiers
   */
  getValidIdentifierExamples(type = 'ID') {
    return [
      '✅ Valid: 1, 2, 3, 10, 25',
      '❌ Invalid: -1, 0, abc, 1.5, #1'
    ];
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