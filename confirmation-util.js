const readline = require('readline');

/**
 * Utility for handling user confirmation prompts
 * Provides interactive yes/no prompts for destructive operations
 */
class ConfirmationUtil {

  /**
   * Creates a readline interface for user input
   * @returns {Object} readline interface
   */
  static createInterface() {
    return readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  /**
   * Prompts user for yes/no confirmation
   * @param {string} message - The confirmation message to display
   * @param {Object} options - Configuration options
   * @param {boolean} options.defaultAnswer - Default answer if user presses enter (true for yes, false for no)
   * @param {boolean} options.requireExplicit - If true, require explicit y/n, no default
   * @returns {Promise<boolean>} True if user confirms, false otherwise
   */
  static async askConfirmation(message, options = {}) {
    const {
      defaultAnswer = null,
      requireExplicit = false
    } = options;

    return new Promise((resolve) => {
      const rl = this.createInterface();

      let promptSuffix = requireExplicit ? ' (y/n): ' :
        defaultAnswer === true ? ' (Y/n): ' :
        defaultAnswer === false ? ' (y/N): ' : ' (y/n): ';

      const fullPrompt = message + promptSuffix;

      rl.question(fullPrompt, (answer) => {
        rl.close();

        const normalizedAnswer = answer.trim().toLowerCase();

        // Handle explicit answers
        if (normalizedAnswer === 'y' || normalizedAnswer === 'yes') {
          resolve(true);
          return;
        }

        if (normalizedAnswer === 'n' || normalizedAnswer === 'no') {
          resolve(false);
          return;
        }

        // Handle empty answer (Enter key)
        if (normalizedAnswer === '' && !requireExplicit && defaultAnswer !== null) {
          resolve(defaultAnswer);
          return;
        }

        // Invalid answer - default to false for safety
        resolve(false);
      });
    });
  }

  /**
   * Prompts for confirmation with detailed information about what will be deleted
   * @param {string} operation - Type of operation (delete, clean, clear)
   * @param {Array|Object} itemsToDelete - Items that will be deleted
   * @param {Object} options - Configuration options
   * @returns {Promise<boolean>} True if user confirms
   */
  static async confirmDelete(operation, itemsToDelete, options = {}) {
    const {
      force = false,
      showItems = true,
      maxItemsToShow = 5
    } = options;

    // Skip confirmation if force flag is used
    if (force) {
      return true;
    }

    console.log(''); // Empty line for spacing

    let items = [];
    let count = 0;

    // Handle different input types
    if (Array.isArray(itemsToDelete)) {
      items = itemsToDelete;
      count = itemsToDelete.length;
    } else if (itemsToDelete && typeof itemsToDelete === 'object') {
      // Single item
      items = [itemsToDelete];
      count = 1;
    } else {
      count = 0;
    }

    if (count === 0) {
      // Nothing to delete
      return true;
    }

    // Show what will be deleted
    if (showItems) {
      console.log(`📋 The following ${count === 1 ? 'todo will' : `${count} todos will`} be deleted:`);

      const itemsToDisplay = items.slice(0, maxItemsToShow);
      itemsToDisplay.forEach(todo => {
        const status = todo.completed ? '✓' : ' ';
        console.log(`  [${status}] #${todo.id}: ${todo.description}`);
      });

      if (items.length > maxItemsToShow) {
        const remaining = items.length - maxItemsToShow;
        console.log(`  ... and ${remaining} more todo${remaining > 1 ? 's' : ''}`);
      }
      console.log('');
    }

    // Enhanced warnings for destructive operations
    const isVeryDestructive = operation === 'clear' || operation === 'purge';
    const isBulkOperation = operation === 'batch' || operation === 'clean' || isVeryDestructive;

    if (isVeryDestructive) {
      console.log('🚨 WARNING: This will delete ALL todos from your list!');
      console.log('🚨 This includes both completed and pending items!');
      console.log('⚠️  This action is PERMANENT and cannot be undone!');
      console.log('💡 Consider using "clean" instead to only remove completed todos.');
      console.log('');
    } else if (isBulkOperation && count > 1) {
      console.log('⚠️  This action is PERMANENT and cannot be undone!');
      if (count >= 5) {
        console.log(`🚨 You are about to delete ${count} todos at once!`);
      }
      console.log('💡 Remember: You can use "undo" command to restore recent deletions.');
      console.log('');
    } else {
      console.log('⚠️  This action is PERMANENT and cannot be undone!');
      console.log('💡 Remember: You can use "undo" command to restore recent deletions.');
      console.log('');
    }

    // First confirmation
    const firstConfirmed = await this.askConfirmation(
      '🗑️  Are you sure you want to proceed?',
      {
        defaultAnswer: false,
        requireExplicit: true
      }
    );

    if (!firstConfirmed) {
      return false;
    }

    // Double confirmation for very destructive operations
    if (isVeryDestructive && count > 3) {
      console.log('');
      console.log('🔴 FINAL CONFIRMATION REQUIRED');
      console.log(`🔴 You are about to permanently delete ALL ${count} todos!`);
      console.log('🔴 This action cannot be undone!');
      console.log('');

      const finalConfirmed = await this.askConfirmation(
        '🔴 Type "yes" to confirm this destructive action',
        {
          defaultAnswer: false,
          requireExplicit: true
        }
      );

      console.log(''); // Empty line for spacing
      return finalConfirmed;
    }

    console.log(''); // Empty line for spacing
    return true;
  }

  /**
   * Prompts for confirmation with a custom message
   * @param {string} message - Custom confirmation message
   * @param {Object} options - Configuration options
   * @returns {Promise<boolean>} True if user confirms
   */
  static async confirmAction(message, options = {}) {
    const {
      force = false,
      defaultAnswer = false,
      requireExplicit = true
    } = options;

    // Skip confirmation if force flag is used
    if (force) {
      return true;
    }

    console.log(''); // Empty line for spacing

    const confirmed = await this.askConfirmation(message, {
      defaultAnswer,
      requireExplicit
    });

    console.log(''); // Empty line for spacing

    return confirmed;
  }

  /**
   * Shows a cancellation message when user declines confirmation
   * @param {string} operation - The operation that was cancelled
   */
  static showCancellationMessage(operation) {
    console.log(`❌ ${operation} cancelled.`);
    console.log('💡 No changes have been made to your todos.');

    // Add helpful context for different operations
    if (operation.toLowerCase().includes('delete') || operation.toLowerCase().includes('clear')) {
      console.log('💡 Tip: If you accidentally delete todos, use "undo" command to restore them.');
    }
  }

  /**
   * Shows help about force flag usage
   * @param {string} command - The command that supports force flag
   */
  static showForceHelp(command) {
    console.log('💡 To skip confirmation in the future, use the --force flag:');
    console.log(`   node index.js ${command} --force`);
  }
}

module.exports = { ConfirmationUtil };