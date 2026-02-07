/**
 * UndoManager - Manages undo functionality for deleted todos
 *
 * Features:
 * - Tracks recent deletions with metadata
 * - Supports undoing single, batch, and bulk deletions
 * - Configurable history size limit
 * - Automatic cleanup of old entries
 * - Preservation of original todo positions when possible
 */

class UndoManager {
  constructor(options = {}) {
    this.maxHistorySize = options.maxHistorySize || 50;
    this.maxAge = options.maxAge || 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    this.deletionHistory = []; // Array of deletion entries
    this.enableLogging = options.enableLogging || false;
  }

  /**
   * Log a message if logging is enabled
   */
  log(level, message, data = null) {
    if (!this.enableLogging) return;

    const timestamp = new Date().toISOString();
    const prefix = {
      debug: '🔍',
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌'
    }[level] || 'ℹ️';

    const logMessage = `${prefix} [${timestamp}] UndoManager: ${message}`;
    if (data) {
      console.log(logMessage, data);
    } else {
      console.log(logMessage);
    }
  }

  /**
   * Record a deletion operation
   * @param {Object} deleteOperation - Details of the deletion
   * @param {string} deleteOperation.type - Type of deletion ('single', 'batch', 'bulk')
   * @param {Array} deleteOperation.deletedTodos - Array of deleted todo objects
   * @param {Object} deleteOperation.metadata - Additional metadata about the deletion
   * @param {Date} deleteOperation.timestamp - When the deletion occurred
   * @returns {string} - Unique deletion ID for undo operations
   */
  recordDeletion(deleteOperation) {
    // Generate unique deletion ID
    const deletionId = this.generateDeletionId();

    // Create deletion entry
    const deletionEntry = {
      id: deletionId,
      type: deleteOperation.type,
      deletedTodos: deleteOperation.deletedTodos.map(todo => ({
        ...todo,
        // Preserve original position if available
        originalPosition: deleteOperation.metadata?.originalPositions?.[todo.id] || null,
        deletedAt: deleteOperation.timestamp || new Date().toISOString()
      })),
      metadata: {
        ...deleteOperation.metadata,
        deletionMethod: deleteOperation.metadata?.deletionMethod || 'unknown',
        totalBefore: deleteOperation.metadata?.totalBefore || 0,
        totalAfter: deleteOperation.metadata?.totalAfter || 0
      },
      timestamp: deleteOperation.timestamp || new Date().toISOString(),
      canUndo: true
    };

    // Add to history
    this.deletionHistory.unshift(deletionEntry);

    // Cleanup old entries
    this.cleanupHistory();

    this.log('info', `Recorded ${deleteOperation.type} deletion`, {
      deletionId,
      deletedCount: deleteOperation.deletedTodos.length,
      historySize: this.deletionHistory.length
    });

    return deletionId;
  }

  /**
   * Get recent deletions that can be undone
   * @param {number} limit - Maximum number of entries to return
   * @returns {Array} - Array of deletion entries
   */
  getRecentDeletions(limit = 10) {
    this.cleanupHistory();
    return this.deletionHistory
      .filter(entry => entry.canUndo)
      .slice(0, limit)
      .map(entry => ({
        id: entry.id,
        type: entry.type,
        deletedCount: entry.deletedTodos.length,
        timestamp: entry.timestamp,
        summary: this.generateDeletionSummary(entry)
      }));
  }

  /**
   * Get the most recent deletion that can be undone
   * @returns {Object|null} - Most recent deletion entry or null if none available
   */
  getMostRecentDeletion() {
    this.cleanupHistory();
    return this.deletionHistory.find(entry => entry.canUndo) || null;
  }

  /**
   * Undo a specific deletion by ID
   * @param {string} deletionId - ID of the deletion to undo
   * @param {Array} currentTodos - Current todo list for position restoration
   * @returns {Object} - Result object with success status and restored todos
   */
  undoDeletion(deletionId, currentTodos = []) {
    const deletionEntry = this.deletionHistory.find(entry =>
      entry.id === deletionId && entry.canUndo
    );

    if (!deletionEntry) {
      return {
        success: false,
        error: `Deletion with ID ${deletionId} not found or cannot be undone`
      };
    }

    try {
      // Prepare todos for restoration
      const todosToRestore = deletionEntry.deletedTodos.map(todo => {
        // Remove undo-specific metadata
        const { originalPosition, deletedAt, ...restoredTodo } = todo;
        return restoredTodo;
      });

      // Mark deletion as used (cannot be undone again)
      deletionEntry.canUndo = false;
      deletionEntry.undoneAt = new Date().toISOString();

      this.log('info', `Undid ${deletionEntry.type} deletion`, {
        deletionId,
        restoredCount: todosToRestore.length
      });

      return {
        success: true,
        deletionType: deletionEntry.type,
        restoredTodos: todosToRestore,
        metadata: {
          originalDeletion: {
            id: deletionEntry.id,
            timestamp: deletionEntry.timestamp,
            type: deletionEntry.type
          },
          restoredCount: todosToRestore.length,
          undoneAt: deletionEntry.undoneAt
        }
      };
    } catch (error) {
      this.log('error', `Failed to undo deletion ${deletionId}`, error);
      return {
        success: false,
        error: `Failed to undo deletion: ${error.message}`
      };
    }
  }

  /**
   * Undo the most recent deletion
   * @param {Array} currentTodos - Current todo list for position restoration
   * @returns {Object} - Result object with success status and restored todos
   */
  undoLastDeletion(currentTodos = []) {
    const recentDeletion = this.getMostRecentDeletion();

    if (!recentDeletion) {
      return {
        success: false,
        error: 'No recent deletions available to undo'
      };
    }

    return this.undoDeletion(recentDeletion.id, currentTodos);
  }

  /**
   * Clear all undo history
   */
  clearHistory() {
    const clearedCount = this.deletionHistory.length;
    this.deletionHistory = [];

    this.log('info', `Cleared undo history`, { clearedCount });

    return {
      success: true,
      clearedCount
    };
  }

  /**
   * Get undo manager statistics
   * @returns {Object} - Statistics about undo history
   */
  getStats() {
    this.cleanupHistory();

    const totalEntries = this.deletionHistory.length;
    const availableUndos = this.deletionHistory.filter(entry => entry.canUndo).length;
    const usedUndos = totalEntries - availableUndos;

    const typeStats = this.deletionHistory.reduce((stats, entry) => {
      stats[entry.type] = (stats[entry.type] || 0) + 1;
      return stats;
    }, {});

    return {
      totalEntries,
      availableUndos,
      usedUndos,
      maxHistorySize: this.maxHistorySize,
      typeStats
    };
  }

  /**
   * Generate unique deletion ID
   * @returns {string} - Unique deletion ID
   */
  generateDeletionId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `del_${timestamp}_${random}`;
  }

  /**
   * Generate human-readable summary of deletion
   * @param {Object} deletionEntry - Deletion entry to summarize
   * @returns {string} - Human-readable summary
   */
  generateDeletionSummary(deletionEntry) {
    const count = deletionEntry.deletedTodos.length;
    const time = new Date(deletionEntry.timestamp).toLocaleTimeString();

    switch (deletionEntry.type) {
      case 'single':
        const todo = deletionEntry.deletedTodos[0];
        return `Deleted "${todo.description}" at ${time}`;

      case 'batch':
        return `Batch deleted ${count} todos at ${time}`;

      case 'bulk':
        const operation = deletionEntry.metadata?.operation || 'unknown';
        if (operation === 'clean') {
          return `Cleaned ${count} completed todos at ${time}`;
        } else if (operation === 'clear') {
          return `Cleared all ${count} todos at ${time}`;
        }
        return `Bulk deleted ${count} todos (${operation}) at ${time}`;

      default:
        return `Deleted ${count} todos at ${time}`;
    }
  }

  /**
   * Clean up old and expired history entries
   */
  cleanupHistory() {
    const now = Date.now();
    const initialSize = this.deletionHistory.length;

    // Remove expired entries
    this.deletionHistory = this.deletionHistory.filter(entry => {
      const entryTime = new Date(entry.timestamp).getTime();
      return (now - entryTime) <= this.maxAge;
    });

    // Enforce size limit (keep most recent entries)
    if (this.deletionHistory.length > this.maxHistorySize) {
      this.deletionHistory = this.deletionHistory.slice(0, this.maxHistorySize);
    }

    const removedCount = initialSize - this.deletionHistory.length;
    if (removedCount > 0) {
      this.log('debug', `Cleaned up ${removedCount} old deletion entries`);
    }
  }

  /**
   * Export undo history for backup/debugging
   * @returns {Object} - Exported undo history
   */
  exportHistory() {
    return {
      maxHistorySize: this.maxHistorySize,
      maxAge: this.maxAge,
      exportTimestamp: new Date().toISOString(),
      deletionHistory: this.deletionHistory
    };
  }

  /**
   * Import undo history from backup
   * @param {Object} historyData - Exported history data
   * @returns {Object} - Import result
   */
  importHistory(historyData) {
    try {
      if (!historyData || !Array.isArray(historyData.deletionHistory)) {
        throw new Error('Invalid history data format');
      }

      this.deletionHistory = historyData.deletionHistory;
      this.cleanupHistory(); // Clean up after import

      this.log('info', 'Imported undo history', {
        importedEntries: this.deletionHistory.length
      });

      return {
        success: true,
        importedEntries: this.deletionHistory.length
      };
    } catch (error) {
      this.log('error', 'Failed to import undo history', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = {
  UndoManager
};