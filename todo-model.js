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
   * @param {Object} options - Delete options
   * @param {boolean} options.force - Force deletion even if protected
   * @param {string[]} options.allowedRoles - Roles allowed to delete this todo
   * @returns {Object} Result with canDelete boolean and reason
   */
  canBeDeleted(options = {}) {
    const { force = false, allowedRoles = [] } = options;

    // If force deletion is requested, allow it
    if (force) {
      return { canDelete: true, reason: null };
    }

    // Check for deletion protection rules
    const protectionChecks = this.getDeleteProtectionChecks();

    for (const check of protectionChecks) {
      if (!check.passes) {
        return { canDelete: false, reason: check.reason };
      }
    }

    // Check role-based permissions if specified
    if (allowedRoles.length > 0 && this.hasTag('restricted')) {
      if (!allowedRoles.some(role => this.tags.includes(`role:${role}`))) {
        return {
          canDelete: false,
          reason: 'Insufficient permissions to delete restricted todo'
        };
      }
    }

    return { canDelete: true, reason: null };
  }

  /**
   * Get delete protection checks for this todo
   * @returns {Array} Array of protection check results
   */
  getDeleteProtectionChecks() {
    const checks = [];

    // Protect high priority overdue todos
    if (this.priority === 'high' && this.isOverdue() && !this.completed) {
      checks.push({
        name: 'high_priority_overdue',
        passes: false,
        reason: 'Cannot delete overdue high-priority todo. Complete it first or use force delete.'
      });
    }

    // Protect todos with critical tags
    if (this.hasTag('critical') || this.hasTag('important')) {
      checks.push({
        name: 'critical_tag',
        passes: false,
        reason: 'Todo marked as critical cannot be deleted without confirmation.'
      });
    }

    // Protect recently created todos (within 1 hour) to prevent accidental deletion
    const hoursSinceCreated = (new Date() - new Date(this.createdAt)) / (1000 * 60 * 60);
    if (hoursSinceCreated < 1 && !this.completed) {
      checks.push({
        name: 'recently_created',
        passes: false,
        reason: 'Todo created less than 1 hour ago. Wait or use force delete to prevent accidental deletion.'
      });
    }

    // All checks passed if no failing checks
    if (checks.length === 0) {
      checks.push({
        name: 'safe_to_delete',
        passes: true,
        reason: null
      });
    }

    return checks;
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
      daysSinceCreated: Math.floor((new Date() - new Date(this.createdAt)) / (1000 * 60 * 60 * 24)),
      // Enhanced delete metadata
      deleteRisk: this.calculateDeleteRisk(),
      deletionImpact: this.assessDeletionImpact(),
      suggestedAction: this.getSuggestedDeletionAction(),
      backupRecommended: this.isBackupRecommended()
    };
  }

  /**
   * Calculate the risk level of deleting this todo
   * @returns {string} Risk level: 'low', 'medium', 'high'
   */
  calculateDeleteRisk() {
    let riskScore = 0;

    // High priority increases risk
    if (this.priority === 'high') riskScore += 3;
    else if (this.priority === 'medium') riskScore += 1;

    // Overdue todos are risky to delete
    if (this.isOverdue() && !this.completed) riskScore += 3;

    // Critical tags increase risk
    if (this.hasTag('critical') || this.hasTag('important')) riskScore += 3;
    if (this.hasTag('urgent')) riskScore += 2;

    // Work-related todos have moderate risk
    if (this.hasTag('work') || this.hasTag('project')) riskScore += 1;

    // Due soon increases risk
    const daysUntilDue = this.getDaysUntilDue();
    if (daysUntilDue !== null && daysUntilDue <= 1) riskScore += 2;

    // Incomplete todos are riskier to delete
    if (!this.completed) riskScore += 1;

    if (riskScore >= 5) return 'high';
    if (riskScore >= 2) return 'medium';
    return 'low';
  }

  /**
   * Assess the impact of deleting this todo
   * @returns {Object} Impact assessment
   */
  assessDeletionImpact() {
    return {
      dataLoss: this.assessDataLoss(),
      workflowImpact: this.assessWorkflowImpact(),
      recoveryDifficulty: this.assessRecoveryDifficulty()
    };
  }

  /**
   * Assess the data loss from deleting this todo
   * @returns {string} Data loss level: 'minimal', 'moderate', 'significant'
   */
  assessDataLoss() {
    let score = 0;

    // Long descriptions contain more information
    if (this.description.length > 100) score += 2;
    else if (this.description.length > 50) score += 1;

    // Multiple tags indicate more organizational data
    if (this.tags.length > 3) score += 2;
    else if (this.tags.length > 1) score += 1;

    // Due dates add temporal information
    if (this.dueDate) score += 1;

    // Completion data has value
    if (this.completed && this.completedAt) score += 1;

    if (score >= 4) return 'significant';
    if (score >= 2) return 'moderate';
    return 'minimal';
  }

  /**
   * Assess workflow impact of deletion
   * @returns {string} Workflow impact: 'none', 'minor', 'major'
   */
  assessWorkflowImpact() {
    // High priority overdue items have major workflow impact
    if (this.priority === 'high' && this.isOverdue() && !this.completed) {
      return 'major';
    }

    // Critical or work-related todos have moderate impact
    if (this.hasTag('critical') || this.hasTag('work') || this.hasTag('project')) {
      return 'minor';
    }

    // Due soon has impact
    const daysUntilDue = this.getDaysUntilDue();
    if (daysUntilDue !== null && daysUntilDue <= 2 && !this.completed) {
      return 'minor';
    }

    return 'none';
  }

  /**
   * Assess difficulty of recovering this todo if deleted
   * @returns {string} Recovery difficulty: 'easy', 'moderate', 'difficult'
   */
  assessRecoveryDifficulty() {
    // Generic or short descriptions are hard to recreate
    if (this.description.length < 20) return 'difficult';

    // Todos with specific dates or many tags are moderately difficult
    if (this.dueDate || this.tags.length > 2) return 'moderate';

    return 'easy';
  }

  /**
   * Get suggested action for deletion
   * @returns {string} Suggested action
   */
  getSuggestedDeletionAction() {
    const risk = this.calculateDeleteRisk();

    if (risk === 'high') {
      return this.completed ? 'Archive instead of delete' : 'Complete before deleting';
    }

    if (risk === 'medium') {
      if (this.isOverdue() && !this.completed) {
        return 'Review and update due date or complete';
      }
      return 'Consider archiving or completing first';
    }

    return 'Safe to delete';
  }

  /**
   * Check if backup is recommended before deletion
   * @returns {boolean} True if backup is recommended
   */
  isBackupRecommended() {
    const metadata = this.assessDeletionImpact();
    return (
      this.calculateDeleteRisk() === 'high' ||
      metadata.dataLoss === 'significant' ||
      metadata.workflowImpact === 'major'
    );
  }

  /**
   * Check if this todo should be included in bulk delete operations
   * @param {string} operation - Type of bulk operation ('clean', 'clear', 'overdue', etc.)
   * @param {Object} options - Additional options for bulk operations
   * @returns {Object} Result with shouldDelete boolean and reason
   */
  shouldBeIncludedInBulkDelete(operation, options = {}) {
    const { respectProtection = true, includeProtected = false } = options;

    // Check protection rules if enabled
    if (respectProtection && !includeProtected) {
      const deleteCheck = this.canBeDeleted();
      if (!deleteCheck.canDelete) {
        return {
          shouldDelete: false,
          reason: `Protected: ${deleteCheck.reason}`,
          operation
        };
      }
    }

    let shouldDelete = false;
    let reason = null;

    switch (operation.toLowerCase()) {
      case 'clean':
      case 'cleanup':
        // Only delete completed todos
        shouldDelete = this.completed;
        reason = shouldDelete ? 'Completed todo eligible for cleanup' : 'Todo not completed';
        break;

      case 'clear':
      case 'purge':
        // Delete all todos
        shouldDelete = true;
        reason = 'All todos eligible for purge operation';
        break;

      case 'overdue':
        // Delete overdue incomplete todos
        shouldDelete = !this.completed && this.isOverdue();
        reason = shouldDelete ? 'Overdue incomplete todo' : 'Todo not overdue or already completed';
        break;

      case 'completed':
        // Delete only completed todos (same as clean)
        shouldDelete = this.completed;
        reason = shouldDelete ? 'Completed todo' : 'Todo not completed';
        break;

      case 'pending':
        // Delete only pending todos
        shouldDelete = !this.completed;
        reason = shouldDelete ? 'Pending todo' : 'Todo already completed';
        break;

      case 'low-priority':
        // Delete low priority todos
        shouldDelete = this.priority === 'low';
        reason = shouldDelete ? 'Low priority todo' : 'Todo priority is not low';
        break;

      case 'old':
        // Delete todos older than 30 days
        const daysSinceCreated = Math.floor((new Date() - new Date(this.createdAt)) / (1000 * 60 * 60 * 24));
        shouldDelete = daysSinceCreated > 30;
        reason = shouldDelete ? `Todo is ${daysSinceCreated} days old` : 'Todo is not old enough (< 30 days)';
        break;

      case 'inactive':
        // Delete todos without recent activity (no completion within 60 days)
        const daysSinceActivity = this.completed && this.completedAt ?
          Math.floor((new Date() - new Date(this.completedAt)) / (1000 * 60 * 60 * 24)) :
          Math.floor((new Date() - new Date(this.createdAt)) / (1000 * 60 * 60 * 24));
        shouldDelete = daysSinceActivity > 60;
        reason = shouldDelete ? `No activity for ${daysSinceActivity} days` : 'Recent activity detected';
        break;

      case 'safe':
        // Only delete todos with low delete risk
        shouldDelete = this.calculateDeleteRisk() === 'low';
        reason = shouldDelete ? 'Low risk todo safe for deletion' : 'Todo has elevated delete risk';
        break;

      case 'test':
      case 'demo':
        // Delete todos that appear to be test data
        const testWords = ['test', 'demo', 'example', 'sample', 'placeholder'];
        const hasTestWord = testWords.some(word =>
          this.description.toLowerCase().includes(word) ||
          this.tags.some(tag => tag.toLowerCase().includes(word))
        );
        shouldDelete = hasTestWord;
        reason = shouldDelete ? 'Appears to be test/demo data' : 'Not identified as test data';
        break;

      default:
        shouldDelete = false;
        reason = `Unknown bulk delete operation: ${operation}`;
    }

    return {
      shouldDelete,
      reason,
      operation,
      riskLevel: this.calculateDeleteRisk(),
      protectionChecks: respectProtection ? this.getDeleteProtectionChecks() : []
    };
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
   * Mark todo as soft deleted (for trash/recycle bin functionality)
   * @returns {Todo} Returns this instance for method chaining
   */
  markAsDeleted() {
    if (!this.hasTag('deleted')) {
      this.addTag('deleted');
    }
    this.addTag(`deleted-at:${new Date().toISOString()}`);
    return this;
  }

  /**
   * Restore todo from soft deleted state
   * @returns {Todo} Returns this instance for method chaining
   */
  restoreFromDeleted() {
    this.removeTag('deleted');
    // Remove all deletion timestamp tags
    this.tags = this.tags.filter(tag => !tag.startsWith('deleted-at:'));
    return this;
  }

  /**
   * Check if todo is soft deleted
   * @returns {boolean} True if todo is marked as deleted
   */
  isDeleted() {
    return this.hasTag('deleted');
  }

  /**
   * Get deletion timestamp for soft deleted todos
   * @returns {string|null} Deletion timestamp or null if not deleted
   */
  getDeletedAt() {
    const deletedTag = this.tags.find(tag => tag.startsWith('deleted-at:'));
    return deletedTag ? deletedTag.substring('deleted-at:'.length) : null;
  }

  /**
   * Check if soft deleted todo can be permanently deleted
   * @param {number} retentionDays - Days to retain deleted todos
   * @returns {boolean} True if todo can be permanently deleted
   */
  canBePermanentlyDeleted(retentionDays = 30) {
    const deletedAt = this.getDeletedAt();
    if (!deletedAt) return false;

    const daysSinceDeletion = Math.floor((new Date() - new Date(deletedAt)) / (1000 * 60 * 60 * 24));
    return daysSinceDeletion >= retentionDays;
  }

  /**
   * Get enhanced delete impact analysis
   * @param {Object} context - Additional context for analysis
   * @returns {Object} Comprehensive delete impact report
   */
  getDeleteImpactAnalysis(context = {}) {
    const { relatedTodos = [], userProfile = null } = context;

    return {
      todo: this.toObject(),
      riskAssessment: {
        level: this.calculateDeleteRisk(),
        checks: this.getDeleteProtectionChecks(),
        score: this.getDeleteRiskScore()
      },
      impactAnalysis: this.assessDeletionImpact(),
      recommendations: {
        action: this.getSuggestedDeletionAction(),
        alternatives: this.getDeleteAlternatives(),
        backupRecommended: this.isBackupRecommended()
      },
      metadata: {
        deleteMetadata: this.getDeleteMetadata(),
        relatedCount: relatedTodos.length,
        userContext: userProfile ? this.getUserDeleteContext(userProfile) : null
      },
      recovery: {
        difficulty: this.assessRecoveryDifficulty(),
        requirements: this.getRecoveryRequirements()
      }
    };
  }

  /**
   * Calculate numerical delete risk score
   * @returns {number} Risk score (0-10, higher is riskier)
   */
  getDeleteRiskScore() {
    let score = 0;

    // Priority scoring
    if (this.priority === 'high') score += 3;
    else if (this.priority === 'medium') score += 1;

    // Overdue penalty
    if (this.isOverdue() && !this.completed) score += 3;

    // Critical tags
    if (this.hasTag('critical')) score += 3;
    if (this.hasTag('important')) score += 2;
    if (this.hasTag('urgent')) score += 2;

    // Work context
    if (this.hasTag('work') || this.hasTag('project')) score += 1;

    // Due date proximity
    const daysUntilDue = this.getDaysUntilDue();
    if (daysUntilDue !== null) {
      if (daysUntilDue <= 0) score += 2;
      else if (daysUntilDue <= 1) score += 1;
    }

    // Incomplete status
    if (!this.completed) score += 1;

    return Math.min(score, 10); // Cap at 10
  }

  /**
   * Get alternative actions to deletion
   * @returns {Array} Array of alternative actions
   */
  getDeleteAlternatives() {
    const alternatives = [];

    if (!this.completed) {
      alternatives.push({
        action: 'complete',
        description: 'Mark as completed instead of deleting',
        benefit: 'Preserves record of accomplishment'
      });
    }

    if (this.isOverdue()) {
      alternatives.push({
        action: 'reschedule',
        description: 'Update due date to future',
        benefit: 'Keeps todo active with realistic timeline'
      });
    }

    if (this.priority === 'high') {
      alternatives.push({
        action: 'lower_priority',
        description: 'Reduce priority to medium or low',
        benefit: 'Reduces urgency while keeping todo'
      });
    }

    alternatives.push({
      action: 'archive',
      description: 'Archive instead of delete',
      benefit: 'Preserves data while removing from active list'
    });

    if (!this.hasTag('archived')) {
      alternatives.push({
        action: 'soft_delete',
        description: 'Soft delete for potential recovery',
        benefit: 'Allows restoration within retention period'
      });
    }

    return alternatives;
  }

  /**
   * Get requirements for recovering this todo
   * @returns {Object} Recovery requirements
   */
  getRecoveryRequirements() {
    return {
      minBackupData: ['id', 'description', 'createdAt'],
      recommendedData: ['priority', 'tags', 'dueDate'],
      complexityFactors: {
        hasComplexDescription: this.description.length > 100,
        hasMultipleTags: this.tags.length > 2,
        hasDueDate: !!this.dueDate,
        hasSpecialPriority: this.priority !== 'medium'
      },
      estimatedRecoveryTime: this.estimateRecoveryTime()
    };
  }

  /**
   * Estimate time required to manually recreate this todo
   * @returns {string} Estimated recovery time
   */
  estimateRecoveryTime() {
    let minutes = 1; // Base time

    // Complex description takes longer
    if (this.description.length > 100) minutes += 2;
    else if (this.description.length > 50) minutes += 1;

    // Multiple tags take time to recreate
    minutes += this.tags.length * 0.5;

    // Due dates require thought
    if (this.dueDate) minutes += 1;

    if (minutes <= 2) return '1-2 minutes';
    if (minutes <= 5) return '3-5 minutes';
    return '5+ minutes';
  }

  /**
   * Get user-specific delete context
   * @param {Object} userProfile - User profile information
   * @returns {Object} User-specific context
   */
  getUserDeleteContext(userProfile) {
    return {
      userPreferences: {
        confirmHighRisk: userProfile.confirmHighRiskDeletes || true,
        autoArchive: userProfile.autoArchiveInsteadDelete || false,
        retentionDays: userProfile.deletedTodoRetention || 30
      },
      statistics: {
        totalDeleted: userProfile.totalTodosDeleted || 0,
        avgDeletesPerDay: userProfile.avgDeletesPerDay || 0,
        mostDeletedPriority: userProfile.mostDeletedPriority || 'low'
      }
    };
  }

  /**
   * Get available bulk delete operations with enhanced metadata
   * @returns {Object} Available bulk delete operations with descriptions
   */
  static getBulkDeleteOperations() {
    return {
      clean: {
        name: 'clean',
        aliases: ['cleanup'],
        description: 'Delete all completed todos',
        filter: 'completed',
        safety: 'medium',
        riskLevel: 'low',
        confirmationRequired: false,
        estimatedImpact: 'Removes completed todos, preserves work history'
      },
      clear: {
        name: 'clear',
        aliases: ['purge'],
        description: 'Delete ALL todos (completed and pending)',
        filter: 'all',
        safety: 'high',
        riskLevel: 'high',
        confirmationRequired: true,
        estimatedImpact: 'Removes all todos permanently - use with extreme caution'
      },
      overdue: {
        name: 'overdue',
        aliases: ['expired'],
        description: 'Delete overdue incomplete todos',
        filter: 'overdue',
        safety: 'medium',
        riskLevel: 'medium',
        confirmationRequired: true,
        estimatedImpact: 'Removes stale overdue items that may no longer be relevant'
      },
      old: {
        name: 'old',
        aliases: ['archive'],
        description: 'Delete todos older than 30 days',
        filter: 'old',
        safety: 'medium',
        riskLevel: 'low',
        confirmationRequired: false,
        estimatedImpact: 'Removes old todos to keep list current'
      },
      'low-priority': {
        name: 'low-priority',
        aliases: ['low'],
        description: 'Delete low priority todos',
        filter: 'priority',
        safety: 'low',
        riskLevel: 'low',
        confirmationRequired: false,
        estimatedImpact: 'Removes less important todos to focus on priorities'
      },
      inactive: {
        name: 'inactive',
        aliases: ['stale'],
        description: 'Delete todos with no activity for 60+ days',
        filter: 'activity',
        safety: 'medium',
        riskLevel: 'low',
        confirmationRequired: false,
        estimatedImpact: 'Removes dormant todos that are likely abandoned'
      },
      safe: {
        name: 'safe',
        aliases: ['low-risk'],
        description: 'Delete only low-risk todos',
        filter: 'risk',
        safety: 'low',
        riskLevel: 'low',
        confirmationRequired: false,
        estimatedImpact: 'Conservative cleanup of todos with minimal impact'
      },
      test: {
        name: 'test',
        aliases: ['demo', 'sample'],
        description: 'Delete test and demo todos',
        filter: 'test-data',
        safety: 'low',
        riskLevel: 'low',
        confirmationRequired: false,
        estimatedImpact: 'Removes non-production test data'
      }
    };
  }
}

module.exports = {
  Todo
};