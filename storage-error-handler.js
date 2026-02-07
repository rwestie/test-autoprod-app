const fs = require('fs');
const path = require('path');

/**
 * Storage Error Handler for the todo application
 * Provides user-friendly error messages and recovery guidance
 */
class StorageErrorHandler {

  /**
   * Classify a storage error and provide user-friendly guidance
   * @param {Error} error - The error to classify
   * @param {string} operation - The operation that failed ('save', 'load', 'directory_creation', etc.)
   * @param {object} context - Additional context about the operation
   * @returns {object} Classification with user message and guidance
   */
  static classifyError(error, operation, context = {}) {
    const classification = {
      type: 'unknown',
      userMessage: '',
      guidance: [],
      severity: 'error',
      recoverable: false,
      context: context,
      originalError: error.message
    };

    // Handle different error codes
    if (error.code) {
      switch (error.code) {
        case 'EACCES':
          classification.type = 'permission';
          classification.userMessage = this._getPermissionMessage(operation, context);
          classification.guidance = this._getPermissionGuidance(operation, context);
          classification.severity = 'error';
          classification.recoverable = true;
          break;

        case 'ENOSPC':
          classification.type = 'disk_full';
          classification.userMessage = 'Cannot save todos - insufficient disk space';
          classification.guidance = this._getDiskFullGuidance(context);
          classification.severity = 'critical';
          classification.recoverable = true;
          break;

        case 'ENOENT':
          classification.type = 'file_not_found';
          classification.userMessage = this._getFileNotFoundMessage(operation, context);
          classification.guidance = this._getFileNotFoundGuidance(operation, context);
          classification.severity = operation === 'load' ? 'warning' : 'error';
          classification.recoverable = true;
          break;

        case 'EEXIST':
          classification.type = 'file_exists';
          classification.userMessage = 'File already exists where we expected to create a new one';
          classification.guidance = ['Remove the existing file or choose a different location'];
          classification.severity = 'warning';
          classification.recoverable = true;
          break;

        case 'EBUSY':
          classification.type = 'file_busy';
          classification.userMessage = 'Todo storage file is currently in use by another process';
          classification.guidance = [
            'Wait a moment and try again',
            'Close any programs that might be accessing the file',
            'Check if another instance of the todo app is running'
          ];
          classification.severity = 'warning';
          classification.recoverable = true;
          break;

        case 'EMFILE':
        case 'ENFILE':
          classification.type = 'too_many_files';
          classification.userMessage = 'System has too many files open';
          classification.guidance = [
            'Close some applications to free up file handles',
            'Try again in a moment'
          ];
          classification.severity = 'warning';
          classification.recoverable = true;
          break;

        case 'EROFS':
          classification.type = 'read_only';
          classification.userMessage = 'Cannot save to this location - filesystem is read-only';
          classification.guidance = [
            'Choose a writable location using --data-dir',
            'Check if the disk is mounted read-only'
          ];
          classification.severity = 'error';
          classification.recoverable = true;
          break;

        default:
          classification.type = 'system_error';
          classification.userMessage = `System error occurred: ${error.code}`;
          classification.guidance = ['Try again or contact support if the problem persists'];
          classification.severity = 'error';
          classification.recoverable = false;
      }
    } else if (error.message.includes('JSON')) {
      // JSON parsing errors
      classification.type = 'corruption';
      classification.userMessage = 'Todo storage file appears to be corrupted';
      classification.guidance = [
        'Backup recovery will be attempted automatically',
        'If problems persist, check the storage location for disk errors'
      ];
      classification.severity = 'error';
      classification.recoverable = true;
    } else if (error.message.includes('validation')) {
      // Data validation errors
      classification.type = 'validation';
      classification.userMessage = 'Todo data structure is invalid';
      classification.guidance = [
        'Data cleanup will be attempted automatically',
        'Some todos might be lost if they are corrupted'
      ];
      classification.severity = 'warning';
      classification.recoverable = true;
    } else {
      // Generic error handling
      classification.type = 'unknown';
      classification.userMessage = 'An unexpected error occurred during storage operation';
      classification.guidance = [
        'Try the operation again',
        'Use a different storage location with --data-dir if problems persist'
      ];
      classification.severity = 'error';
      classification.recoverable = false;
    }

    return classification;
  }

  /**
   * Format a user-friendly error message with emoji and guidance
   * @param {object} classification - Error classification from classifyError
   * @param {boolean} includeGuidance - Whether to include recovery guidance
   * @returns {string} Formatted message
   */
  static formatUserMessage(classification, includeGuidance = true) {
    let message = '';

    // Add emoji based on severity
    const emoji = {
      warning: '⚠️',
      error: '❌',
      critical: '🚨'
    };

    message += `${emoji[classification.severity]} ${classification.userMessage}`;

    if (includeGuidance && classification.guidance.length > 0) {
      message += '\n🔧 Try: ' + classification.guidance[0];

      if (classification.guidance.length > 1) {
        message += '\n💡 More options:';
        classification.guidance.slice(1).forEach(guidance => {
          message += `\n   • ${guidance}`;
        });
      }
    }

    return message;
  }

  /**
   * Generate permission-specific error messages
   */
  static _getPermissionMessage(operation, context) {
    switch (operation) {
      case 'save':
        return 'Unable to save todos due to insufficient permissions';
      case 'load':
        return 'Unable to read todo storage due to insufficient permissions';
      case 'directory_creation':
        return `Cannot create storage directory ${context.targetDir || ''}`;
      case 'backup':
        return 'Unable to create backup due to insufficient permissions';
      default:
        return 'Insufficient permissions for storage operation';
    }
  }

  /**
   * Generate permission-specific guidance
   */
  static _getPermissionGuidance(operation, context) {
    const guidance = [];

    if (operation === 'directory_creation') {
      guidance.push(`Run 'mkdir -p ${context.targetDir || '~/.todos'} && chmod 755 ${context.targetDir || '~/.todos'}'`);
    } else {
      guidance.push('Check file and folder permissions');
    }

    guidance.push('Choose a different storage location using --data-dir');
    guidance.push('Run the command with appropriate permissions');

    return guidance;
  }

  /**
   * Generate disk space guidance with context
   */
  static _getDiskFullGuidance(context) {
    const guidance = [
      'Free up disk space by removing unnecessary files',
      'Choose a location with more available storage using --data-dir'
    ];

    if (context.dataFile) {
      guidance.push(`Check available space at ${path.dirname(context.dataFile)}`);
    }

    return guidance;
  }

  /**
   * Generate file not found messages based on operation
   */
  static _getFileNotFoundMessage(operation, context) {
    switch (operation) {
      case 'load':
        return 'No existing todo storage found - this appears to be your first time using the app';
      case 'backup':
        return 'Backup file not found - continuing without backup recovery';
      case 'directory_creation':
        return `Parent directory for ${context.targetDir || 'storage'} does not exist`;
      default:
        return `File not found: ${context.dataFile || 'storage file'}`;
    }
  }

  /**
   * Generate file not found guidance
   */
  static _getFileNotFoundGuidance(operation, context) {
    switch (operation) {
      case 'load':
        return ['No action needed - a new storage file will be created when you add your first todo'];
      case 'directory_creation':
        return [
          `Create the parent directory first: mkdir -p ${path.dirname(context.targetDir || '')}`,
          'Or choose a different storage location using --data-dir'
        ];
      default:
        return [
          'The file will be created automatically when needed',
          'Verify the storage path is correct'
        ];
    }
  }

  /**
   * Create a structured error result object
   * @param {object} classification - Error classification
   * @param {object} originalResult - Original operation result to extend
   * @returns {object} Enhanced result object
   */
  static createErrorResult(classification, originalResult = {}) {
    return {
      ...originalResult,
      success: false,
      error: classification.originalError || classification.userMessage,
      errorDetails: {
        type: classification.type,
        userMessage: classification.userMessage,
        guidance: classification.guidance,
        severity: classification.severity,
        recoverable: classification.recoverable,
        context: classification.context
      }
    };
  }

  /**
   * Check if an error is retryable based on its classification
   * @param {object} classification - Error classification
   * @returns {boolean} Whether the operation should be retried
   */
  static isRetryable(classification) {
    const retryableTypes = ['file_busy', 'too_many_files', 'disk_full'];
    return retryableTypes.includes(classification.type) && classification.recoverable;
  }

  /**
   * Get retry delay based on error type
   * @param {object} classification - Error classification
   * @param {number} attempt - Current retry attempt (1-based)
   * @returns {number} Delay in milliseconds
   */
  static getRetryDelay(classification, attempt) {
    const baseDelays = {
      file_busy: 100,
      too_many_files: 200,
      disk_full: 500,
      default: 100
    };

    const baseDelay = baseDelays[classification.type] || baseDelays.default;
    return baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
  }
}

module.exports = { StorageErrorHandler };