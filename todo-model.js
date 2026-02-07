/**
 * Todo Data Model
 *
 * This module defines the Todo data structure and provides validation,
 * serialization, and utility methods for todo items.
 */

/**
 * Represents a single todo item with all its properties and behaviors
 */
class Todo {
  /**
   * Create a new Todo instance
   * @param {Object} data - The todo data
   * @param {number} [data.id] - Unique identifier (auto-generated if not provided)
   * @param {string} data.description - Todo description
   * @param {boolean} [data.completed=false] - Completion status
   * @param {string} [data.priority='medium'] - Priority level ('low', 'medium', 'high')
   * @param {string[]} [data.tags=[]] - Array of tags
   * @param {string} [data.dueDate] - Due date in ISO format
   * @param {string} [data.createdAt] - Creation timestamp (auto-generated if not provided)
   * @param {string} [data.completedAt] - Completion timestamp
   */
  constructor(data = {}) {
    this.validateRequiredFields(data);

    this.id = data.id || null; // Will be set by TodoCore if null
    this.description = this.validateDescription(data.description);
    this.completed = Boolean(data.completed || false);
    this.priority = this.validatePriority(data.priority || 'medium');
    this.tags = this.validateTags(data.tags || []);
    this.dueDate = this.validateDueDate(data.dueDate);
    this.createdAt = data.createdAt || new Date().toISOString();
    this.completedAt = this.validateCompletedAt(data.completedAt);

    // Validate consistency between completed status and completedAt
    this.validateCompletionConsistency();
  }

  /**
   * Validate that required fields are provided
   * @param {Object} data - The todo data
   */
  validateRequiredFields(data) {
    if (!data.description && data.description !== '') {
      throw new Error('Todo description is required');
    }
  }

  /**
   * Validate and sanitize description
   * @param {string} description - The description to validate
   * @returns {string} The validated description
   */
  validateDescription(description) {
    if (typeof description !== 'string') {
      throw new Error('Todo description must be a string');
    }

    const trimmed = description.trim();
    if (trimmed.length === 0) {
      throw new Error('Todo description cannot be empty');
    }

    if (trimmed.length > 1000) {
      throw new Error('Todo description cannot exceed 1000 characters');
    }

    return trimmed;
  }

  /**
   * Validate priority level
   * @param {string} priority - The priority to validate
   * @returns {string} The validated priority
   */
  validatePriority(priority) {
    const validPriorities = ['low', 'medium', 'high'];

    if (typeof priority !== 'string') {
      throw new Error('Priority must be a string');
    }

    const lowerPriority = priority.toLowerCase();
    if (!validPriorities.includes(lowerPriority)) {
      throw new Error(`Priority must be one of: ${validPriorities.join(', ')}`);
    }

    return lowerPriority;
  }

  /**
   * Validate tags array
   * @param {string[]} tags - The tags to validate
   * @returns {string[]} The validated tags
   */
  validateTags(tags) {
    if (!Array.isArray(tags)) {
      throw new Error('Tags must be an array');
    }

    const validatedTags = tags
      .map(tag => {
        if (typeof tag !== 'string') {
          throw new Error('All tags must be strings');
        }
        return tag.trim();
      })
      .filter(tag => tag.length > 0) // Remove empty tags
      .map(tag => {
        if (tag.length > 50) {
          throw new Error('Tags cannot exceed 50 characters');
        }
        return tag;
      });

    // Check count before deduplication to prevent excessive input
    if (validatedTags.length > 10) {
      throw new Error('Cannot have more than 10 tags per todo');
    }

    // Remove duplicates while preserving order
    const uniqueTags = [...new Set(validatedTags)];

    return uniqueTags;
  }

  /**
   * Validate due date
   * @param {string} [dueDate] - The due date to validate
   * @returns {string|undefined} The validated due date
   */
  validateDueDate(dueDate) {
    if (dueDate === undefined || dueDate === null) {
      return undefined;
    }

    if (typeof dueDate !== 'string') {
      throw new Error('Due date must be a string');
    }

    const date = new Date(dueDate);
    if (isNaN(date.getTime())) {
      throw new Error('Due date must be a valid ISO date string');
    }

    return dueDate;
  }

  /**
   * Validate completion timestamp
   * @param {string} [completedAt] - The completion timestamp to validate
   * @returns {string|undefined} The validated completion timestamp
   */
  validateCompletedAt(completedAt) {
    if (completedAt === undefined || completedAt === null) {
      return undefined;
    }

    if (typeof completedAt !== 'string') {
      throw new Error('Completed timestamp must be a string');
    }

    const date = new Date(completedAt);
    if (isNaN(date.getTime())) {
      throw new Error('Completed timestamp must be a valid ISO date string');
    }

    return completedAt;
  }

  /**
   * Validate consistency between completed status and completedAt timestamp
   */
  validateCompletionConsistency() {
    if (this.completed && !this.completedAt) {
      // Auto-set completedAt if todo is marked completed but no timestamp
      this.completedAt = new Date().toISOString();
    } else if (!this.completed && this.completedAt) {
      // Clear completedAt if todo is not completed
      this.completedAt = undefined;
    }
  }

  /**
   * Mark the todo as completed
   * @returns {Todo} Returns this instance for method chaining
   */
  markCompleted() {
    if (!this.completed) {
      this.completed = true;
      this.completedAt = new Date().toISOString();
    }
    return this;
  }

  /**
   * Mark the todo as incomplete
   * @returns {Todo} Returns this instance for method chaining
   */
  markIncomplete() {
    if (this.completed) {
      this.completed = false;
      this.completedAt = undefined;
    }
    return this;
  }

  /**
   * Update the todo's description
   * @param {string} newDescription - The new description
   * @returns {Todo} Returns this instance for method chaining
   */
  updateDescription(newDescription) {
    this.description = this.validateDescription(newDescription);
    return this;
  }

  /**
   * Update the todo's priority
   * @param {string} newPriority - The new priority
   * @returns {Todo} Returns this instance for method chaining
   */
  updatePriority(newPriority) {
    this.priority = this.validatePriority(newPriority);
    return this;
  }

  /**
   * Update the todo's tags
   * @param {string[]} newTags - The new tags
   * @returns {Todo} Returns this instance for method chaining
   */
  updateTags(newTags) {
    this.tags = this.validateTags(newTags);
    return this;
  }

  /**
   * Add a tag to the todo
   * @param {string} tag - The tag to add
   * @returns {Todo} Returns this instance for method chaining
   */
  addTag(tag) {
    if (typeof tag !== 'string') {
      throw new Error('Tag must be a string');
    }

    const trimmedTag = tag.trim();
    if (trimmedTag.length === 0) {
      throw new Error('Tag cannot be empty');
    }

    if (!this.tags.includes(trimmedTag)) {
      this.tags = this.validateTags([...this.tags, trimmedTag]);
    }
    return this;
  }

  /**
   * Remove a tag from the todo
   * @param {string} tag - The tag to remove
   * @returns {Todo} Returns this instance for method chaining
   */
  removeTag(tag) {
    this.tags = this.tags.filter(t => t !== tag);
    return this;
  }

  /**
   * Update the todo's due date
   * @param {string} [newDueDate] - The new due date
   * @returns {Todo} Returns this instance for method chaining
   */
  updateDueDate(newDueDate) {
    this.dueDate = this.validateDueDate(newDueDate);
    return this;
  }

  /**
   * Clear the due date
   * @returns {Todo} Returns this instance for method chaining
   */
  clearDueDate() {
    this.dueDate = undefined;
    return this;
  }

  /**
   * Check if the todo is overdue
   * @returns {boolean} True if the todo is overdue
   */
  isOverdue() {
    if (!this.dueDate || this.completed) {
      return false;
    }
    return new Date(this.dueDate) < new Date();
  }

  /**
   * Check if the todo is due today
   * @returns {boolean} True if the todo is due today
   */
  isDueToday() {
    if (!this.dueDate || this.completed) {
      return false;
    }

    const today = new Date();
    const dueDate = new Date(this.dueDate);

    return today.toDateString() === dueDate.toDateString();
  }

  /**
   * Check if the todo is due this week
   * @returns {boolean} True if the todo is due this week
   */
  isDueThisWeek() {
    if (!this.dueDate || this.completed) {
      return false;
    }

    const today = new Date();
    const dueDate = new Date(this.dueDate);
    const daysDiff = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

    return daysDiff >= 0 && daysDiff <= 7;
  }

  /**
   * Get days until due date
   * @returns {number|null} Number of days until due date, null if no due date
   */
  getDaysUntilDue() {
    if (!this.dueDate) {
      return null;
    }

    const today = new Date();
    const dueDate = new Date(this.dueDate);
    return Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
  }

  /**
   * Check if the todo has a specific tag
   * @param {string} tag - The tag to check for
   * @returns {boolean} True if the todo has the tag
   */
  hasTag(tag) {
    return this.tags.includes(tag);
  }

  /**
   * Check if the todo matches a search query
   * @param {string} query - The search query
   * @returns {boolean} True if the todo matches the query
   */
  matchesQuery(query) {
    if (!query || typeof query !== 'string') {
      return true;
    }

    const lowerQuery = query.toLowerCase();

    // Search in description
    if (this.description.toLowerCase().includes(lowerQuery)) {
      return true;
    }

    // Search in tags
    return this.tags.some(tag => tag.toLowerCase().includes(lowerQuery));
  }

  /**
   * Check if the todo can be safely deleted
   * @returns {boolean} True if the todo can be deleted
   */
  canBeDeleted() {
    // All todos can be deleted by default
    // This method can be extended for future business rules
    // e.g., prevent deletion of certain high-priority items, etc.
    return true;
  }

  /**
   * Get delete confirmation message for this todo
   * @returns {string} Confirmation message
   */
  getDeleteConfirmationMessage() {
    const status = this.completed ? 'completed' : 'pending';
    const priorityInfo = this.priority !== 'medium' ? ` (${this.priority} priority)` : '';
    const tagInfo = this.tags.length > 0 ? ` [${this.tags.join(', ')}]` : '';
    const dueInfo = this.dueDate ? ` (due: ${new Date(this.dueDate).toLocaleDateString()})` : '';

    return `Delete ${status} todo "${this.description}"${priorityInfo}${tagInfo}${dueInfo}?`;
  }

  /**
   * Get metadata relevant for delete operations
   * @returns {Object} Delete-relevant metadata
   */
  getDeleteMetadata() {
    return {
      id: this.id,
      description: this.description,
      completed: this.completed,
      priority: this.priority,
      tags: [...this.tags],
      dueDate: this.dueDate,
      createdAt: this.createdAt,
      completedAt: this.completedAt,
      isOverdue: this.isOverdue(),
      hasHighPriority: this.priority === 'high',
      hasWorkTag: this.tags.includes('work'),
      daysSinceCreated: Math.floor((new Date() - new Date(this.createdAt)) / (1000 * 60 * 60 * 24))
    };
  }

  /**
   * Check if this todo should be included in bulk delete operations
   * @param {string} operation - Type of bulk operation ('clean', 'clear', 'overdue', etc.)
   * @returns {boolean} True if todo should be deleted in this operation
   */
  shouldBeIncludedInBulkDelete(operation) {
    switch (operation.toLowerCase()) {
      case 'clean':
      case 'cleanup':
        // Only delete completed todos
        return this.completed;

      case 'clear':
      case 'purge':
        // Delete all todos
        return true;

      case 'overdue':
        // Delete overdue incomplete todos
        return !this.completed && this.isOverdue();

      case 'completed':
        // Delete only completed todos (same as clean)
        return this.completed;

      case 'pending':
        // Delete only pending todos
        return !this.completed;

      case 'low-priority':
        // Delete low priority todos
        return this.priority === 'low';

      case 'old':
        // Delete todos older than 30 days
        const daysSinceCreated = Math.floor((new Date() - new Date(this.createdAt)) / (1000 * 60 * 60 * 24));
        return daysSinceCreated > 30;

      default:
        return false;
    }
  }

  /**
   * Get a plain object representation of the todo
   * @returns {Object} Plain object representation
   */
  toObject() {
    return {
      id: this.id,
      description: this.description,
      completed: this.completed,
      priority: this.priority,
      tags: [...this.tags], // Create a copy
      dueDate: this.dueDate,
      createdAt: this.createdAt,
      completedAt: this.completedAt
    };
  }

  /**
   * Get a JSON string representation of the todo
   * @returns {string} JSON representation
   */
  toJSON() {
    return JSON.stringify(this.toObject());
  }

  /**
   * Create a copy of this todo
   * @returns {Todo} A new Todo instance with the same data
   */
  clone() {
    return new Todo(this.toObject());
  }

  /**
   * Create a Todo instance from a plain object
   * @param {Object} obj - Plain object with todo data
   * @returns {Todo} New Todo instance
   */
  static fromObject(obj) {
    return new Todo(obj);
  }

  /**
   * Create a Todo instance from a JSON string
   * @param {string} json - JSON string representation
   * @returns {Todo} New Todo instance
   */
  static fromJSON(json) {
    try {
      const obj = JSON.parse(json);
      return new Todo(obj);
    } catch (error) {
      throw new Error(`Invalid JSON for Todo: ${error.message}`);
    }
  }

  /**
   * Validate a plain object for todo data
   * @param {Object} obj - Object to validate
   * @returns {boolean} True if valid todo data
   */
  static isValidTodoData(obj) {
    try {
      new Todo(obj);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get the schema definition for a todo
   * @returns {Object} Schema definition
   */
  static getSchema() {
    return {
      id: {
        type: 'number',
        required: false,
        description: 'Unique identifier for the todo'
      },
      description: {
        type: 'string',
        required: true,
        maxLength: 1000,
        description: 'The todo description'
      },
      completed: {
        type: 'boolean',
        required: false,
        default: false,
        description: 'Whether the todo is completed'
      },
      priority: {
        type: 'string',
        required: false,
        enum: ['low', 'medium', 'high'],
        default: 'medium',
        description: 'Priority level of the todo'
      },
      tags: {
        type: 'array',
        items: {
          type: 'string',
          maxLength: 50
        },
        maxItems: 10,
        required: false,
        default: [],
        description: 'Array of tags for categorization'
      },
      dueDate: {
        type: 'string',
        format: 'date-time',
        required: false,
        description: 'Due date in ISO format'
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
        required: false,
        description: 'Creation timestamp'
      },
      completedAt: {
        type: 'string',
        format: 'date-time',
        required: false,
        description: 'Completion timestamp'
      }
    };
  }

  /**
   * Get available bulk delete operations
   * @returns {Object} Available bulk delete operations with descriptions
   */
  static getBulkDeleteOperations() {
    return {
      clean: {
        name: 'clean',
        aliases: ['cleanup'],
        description: 'Delete all completed todos',
        filter: 'completed',
        safety: 'medium'
      },
      clear: {
        name: 'clear',
        aliases: ['purge'],
        description: 'Delete ALL todos (completed and pending)',
        filter: 'all',
        safety: 'high'
      },
      overdue: {
        name: 'overdue',
        aliases: ['expired'],
        description: 'Delete overdue incomplete todos',
        filter: 'overdue',
        safety: 'medium'
      },
      old: {
        name: 'old',
        aliases: ['archive'],
        description: 'Delete todos older than 30 days',
        filter: 'old',
        safety: 'medium'
      },
      'low-priority': {
        name: 'low-priority',
        aliases: ['low'],
        description: 'Delete low priority todos',
        filter: 'priority',
        safety: 'low'
      }
    };
  }
}

module.exports = {
  Todo
};