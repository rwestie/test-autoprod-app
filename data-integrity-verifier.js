const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Data Integrity Verifier
 * Provides comprehensive data verification, corruption detection, and repair capabilities
 */
class DataIntegrityVerifier {
  constructor(config) {
    this.config = config;
    this.checksumCache = new Map();
    this.verificationHistory = [];
    this.corruptionPatterns = new Set();
  }

  /**
   * Perform comprehensive data integrity check
   */
  async verifyDataIntegrity(todos, options = {}) {
    const startTime = Date.now();
    const verification = {
      timestamp: new Date().toISOString(),
      overall: { passed: false, score: 0 },
      checks: {},
      issues: [],
      recommendations: [],
      statistics: {}
    };

    try {
      // 1. Structure validation
      verification.checks.structure = await this.validateDataStructure(todos);

      // 2. Content integrity
      verification.checks.content = await this.validateContentIntegrity(todos);

      // 3. Consistency checks
      verification.checks.consistency = await this.validateDataConsistency(todos);

      // 4. Checksum validation
      verification.checks.checksum = await this.validateChecksums(todos);

      // 5. Corruption detection
      verification.checks.corruption = await this.detectCorruption(todos);

      // 6. Cross-reference validation
      verification.checks.crossReference = await this.validateCrossReferences(todos);

      // Calculate overall score and status
      verification.overall = this.calculateOverallScore(verification.checks);

      // Generate recommendations
      verification.recommendations = this.generateRecommendations(verification.checks);

      // Collect statistics
      verification.statistics = this.gatherStatistics(todos, verification.checks);

      // Store verification history
      this.verificationHistory.push(verification);

      // Calculate duration
      verification.duration = Date.now() - startTime;

      return {
        success: true,
        verification,
        repairNeeded: verification.overall.score < 90,
        criticalIssues: verification.issues.filter(issue => issue.severity === 'critical').length
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        verification: null
      };
    }
  }

  /**
   * Validate data structure
   */
  async validateDataStructure(todos) {
    const result = {
      passed: true,
      score: 100,
      issues: [],
      details: {
        totalTodos: todos.length,
        validTodos: 0,
        invalidTodos: 0
      }
    };

    const requiredFields = ['id', 'description', 'completed'];
    const optionalFields = ['priority', 'tags', 'createdAt', 'dueDate', 'completedAt'];

    for (let i = 0; i < todos.length; i++) {
      const todo = todos[i];
      const todoIssues = [];

      // Check if todo is an object
      if (typeof todo !== 'object' || todo === null) {
        todoIssues.push({
          field: 'root',
          issue: 'Todo is not a valid object',
          severity: 'critical'
        });
      } else {
        // Check required fields
        for (const field of requiredFields) {
          if (!(field in todo)) {
            todoIssues.push({
              field,
              issue: `Missing required field: ${field}`,
              severity: 'critical'
            });
          }
        }

        // Validate field types
        if ('id' in todo && (typeof todo.id !== 'number' || !Number.isInteger(todo.id) || todo.id <= 0)) {
          todoIssues.push({
            field: 'id',
            issue: 'ID must be a positive integer',
            severity: 'critical'
          });
        }

        if ('description' in todo && (typeof todo.description !== 'string' || todo.description.trim() === '')) {
          todoIssues.push({
            field: 'description',
            issue: 'Description must be a non-empty string',
            severity: 'critical'
          });
        }

        if ('completed' in todo && typeof todo.completed !== 'boolean') {
          todoIssues.push({
            field: 'completed',
            issue: 'Completed must be a boolean',
            severity: 'high'
          });
        }

        if ('priority' in todo && !['low', 'medium', 'high'].includes(todo.priority)) {
          todoIssues.push({
            field: 'priority',
            issue: 'Priority must be low, medium, or high',
            severity: 'medium'
          });
        }

        if ('tags' in todo && !Array.isArray(todo.tags)) {
          todoIssues.push({
            field: 'tags',
            issue: 'Tags must be an array',
            severity: 'medium'
          });
        }

        // Validate date fields
        const dateFields = ['createdAt', 'dueDate', 'completedAt'];
        for (const field of dateFields) {
          if (field in todo && todo[field] !== null) {
            const date = new Date(todo[field]);
            if (isNaN(date.getTime())) {
              todoIssues.push({
                field,
                issue: `${field} is not a valid ISO date string`,
                severity: 'medium'
              });
            }
          }
        }
      }

      if (todoIssues.length > 0) {
        result.issues.push({
          todoIndex: i,
          todoId: todo?.id || 'unknown',
          issues: todoIssues
        });
        result.details.invalidTodos++;
        result.passed = false;
      } else {
        result.details.validTodos++;
      }
    }

    // Calculate score
    if (result.details.invalidTodos > 0) {
      result.score = Math.max(0, Math.round(
        (result.details.validTodos / todos.length) * 100
      ));
    }

    return result;
  }

  /**
   * Validate content integrity
   */
  async validateContentIntegrity(todos) {
    const result = {
      passed: true,
      score: 100,
      issues: [],
      details: {
        suspiciousContent: 0,
        encoding: 'valid',
        specialCharacters: 0
      }
    };

    for (let i = 0; i < todos.length; i++) {
      const todo = todos[i];

      // Check for suspicious content patterns
      if (todo.description) {
        // Check for potential encoding issues
        if (/\uFFFD/.test(todo.description)) {
          result.issues.push({
            todoIndex: i,
            todoId: todo.id,
            issue: 'Description contains replacement characters (encoding issue)',
            severity: 'high',
            field: 'description'
          });
          result.details.suspiciousContent++;
        }

        // Check for extremely long descriptions
        if (todo.description.length > 1000) {
          result.issues.push({
            todoIndex: i,
            todoId: todo.id,
            issue: 'Description is unusually long',
            severity: 'medium',
            field: 'description'
          });
        }

        // Check for control characters
        if (/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/.test(todo.description)) {
          result.issues.push({
            todoIndex: i,
            todoId: todo.id,
            issue: 'Description contains control characters',
            severity: 'medium',
            field: 'description'
          });
          result.details.specialCharacters++;
        }

        // Check for SQL injection patterns (just in case)
        const sqlPatterns = [
          /';.*--/i,
          /union.*select/i,
          /drop.*table/i,
          /insert.*into/i,
          /delete.*from/i
        ];

        for (const pattern of sqlPatterns) {
          if (pattern.test(todo.description)) {
            result.issues.push({
              todoIndex: i,
              todoId: todo.id,
              issue: 'Description contains potentially malicious SQL patterns',
              severity: 'critical',
              field: 'description'
            });
            result.details.suspiciousContent++;
          }
        }
      }

      // Check tags content
      if (todo.tags && Array.isArray(todo.tags)) {
        for (const tag of todo.tags) {
          if (typeof tag !== 'string' || tag.trim() === '') {
            result.issues.push({
              todoIndex: i,
              todoId: todo.id,
              issue: 'Tag must be a non-empty string',
              severity: 'medium',
              field: 'tags'
            });
          }
        }
      }
    }

    // Calculate score based on issues
    if (result.issues.length > 0) {
      const criticalIssues = result.issues.filter(issue => issue.severity === 'critical').length;
      const highIssues = result.issues.filter(issue => issue.severity === 'high').length;
      const mediumIssues = result.issues.filter(issue => issue.severity === 'medium').length;

      result.score = Math.max(0, 100 - (criticalIssues * 25) - (highIssues * 10) - (mediumIssues * 5));
      result.passed = result.score >= 70;
    }

    return result;
  }

  /**
   * Validate data consistency
   */
  async validateDataConsistency(todos) {
    const result = {
      passed: true,
      score: 100,
      issues: [],
      details: {
        duplicateIds: 0,
        logicalInconsistencies: 0,
        temporalInconsistencies: 0
      }
    };

    // Check for duplicate IDs
    const idSet = new Set();
    const duplicateIds = new Set();

    for (let i = 0; i < todos.length; i++) {
      const todo = todos[i];

      if (todo.id !== undefined) {
        if (idSet.has(todo.id)) {
          duplicateIds.add(todo.id);
          result.issues.push({
            todoIndex: i,
            todoId: todo.id,
            issue: `Duplicate ID: ${todo.id}`,
            severity: 'critical',
            field: 'id'
          });
        } else {
          idSet.add(todo.id);
        }
      }
    }

    result.details.duplicateIds = duplicateIds.size;

    // Check logical consistency
    for (let i = 0; i < todos.length; i++) {
      const todo = todos[i];

      // Check if completed todos have completedAt timestamp
      if (todo.completed && !todo.completedAt) {
        result.issues.push({
          todoIndex: i,
          todoId: todo.id,
          issue: 'Completed todo is missing completedAt timestamp',
          severity: 'medium',
          field: 'completedAt'
        });
        result.details.logicalInconsistencies++;
      }

      // Check if incomplete todos don't have completedAt timestamp
      if (!todo.completed && todo.completedAt) {
        result.issues.push({
          todoIndex: i,
          todoId: todo.id,
          issue: 'Incomplete todo has completedAt timestamp',
          severity: 'medium',
          field: 'completedAt'
        });
        result.details.logicalInconsistencies++;
      }

      // Check temporal consistency
      if (todo.createdAt && todo.completedAt) {
        const created = new Date(todo.createdAt);
        const completed = new Date(todo.completedAt);

        if (!isNaN(created.getTime()) && !isNaN(completed.getTime()) && completed < created) {
          result.issues.push({
            todoIndex: i,
            todoId: todo.id,
            issue: 'Todo completed before it was created',
            severity: 'high',
            field: 'completedAt'
          });
          result.details.temporalInconsistencies++;
        }
      }

      if (todo.createdAt && todo.dueDate) {
        const created = new Date(todo.createdAt);
        const due = new Date(todo.dueDate);

        if (!isNaN(created.getTime()) && !isNaN(due.getTime()) && due < created) {
          result.issues.push({
            todoIndex: i,
            todoId: todo.id,
            issue: 'Todo due date is before creation date',
            severity: 'medium',
            field: 'dueDate'
          });
          result.details.temporalInconsistencies++;
        }
      }
    }

    // Calculate score
    const criticalIssues = result.issues.filter(issue => issue.severity === 'critical').length;
    const highIssues = result.issues.filter(issue => issue.severity === 'high').length;
    const mediumIssues = result.issues.filter(issue => issue.severity === 'medium').length;

    result.score = Math.max(0, 100 - (criticalIssues * 30) - (highIssues * 15) - (mediumIssues * 5));
    result.passed = result.score >= 80;

    return result;
  }

  /**
   * Validate checksums if available
   */
  async validateChecksums(todos) {
    const result = {
      passed: true,
      score: 100,
      issues: [],
      details: {
        checksumAvailable: false,
        checksumValid: false,
        currentChecksum: null
      }
    };

    try {
      // Generate current checksum
      const currentChecksum = this.generateDataChecksum(todos);
      result.details.currentChecksum = currentChecksum;

      // Check if we have a stored checksum to compare against
      const storedChecksum = await this.getStoredChecksum();
      if (storedChecksum) {
        result.details.checksumAvailable = true;
        result.details.checksumValid = currentChecksum === storedChecksum;

        if (!result.details.checksumValid) {
          result.issues.push({
            issue: 'Data checksum mismatch - data may have been corrupted or tampered with',
            severity: 'critical',
            field: 'checksum',
            expected: storedChecksum,
            actual: currentChecksum
          });
          result.passed = false;
          result.score = 0;
        }
      } else {
        // No stored checksum available - this is not necessarily bad
        result.details.checksumAvailable = false;
        result.score = 70; // Neutral score since we can't verify
      }

    } catch (error) {
      result.issues.push({
        issue: `Checksum validation failed: ${error.message}`,
        severity: 'high',
        field: 'checksum'
      });
      result.passed = false;
      result.score = 50;
    }

    return result;
  }

  /**
   * Detect data corruption patterns
   */
  async detectCorruption(todos) {
    const result = {
      passed: true,
      score: 100,
      issues: [],
      details: {
        corruptionIndicators: 0,
        patternsDetected: []
      }
    };

    for (let i = 0; i < todos.length; i++) {
      const todo = todos[i];

      // Check for null bytes
      const todoStr = JSON.stringify(todo);
      if (todoStr.includes('\0')) {
        result.issues.push({
          todoIndex: i,
          todoId: todo.id,
          issue: 'Todo contains null bytes (corruption indicator)',
          severity: 'critical',
          field: 'data'
        });
        result.details.corruptionIndicators++;
        result.details.patternsDetected.push('null-bytes');
      }

      // Check for truncation patterns
      if (todo.description && todo.description.endsWith('\uFFFD')) {
        result.issues.push({
          todoIndex: i,
          todoId: todo.id,
          issue: 'Todo description appears truncated',
          severity: 'high',
          field: 'description'
        });
        result.details.corruptionIndicators++;
        result.details.patternsDetected.push('truncation');
      }

      // Check for repeated characters (possible corruption)
      if (todo.description && /(.)\1{20,}/.test(todo.description)) {
        result.issues.push({
          todoIndex: i,
          todoId: todo.id,
          issue: 'Todo description contains suspicious character repetition',
          severity: 'medium',
          field: 'description'
        });
        result.details.corruptionIndicators++;
        result.details.patternsDetected.push('repetition');
      }

      // Check for binary data in text fields
      if (todo.description && /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(todo.description)) {
        result.issues.push({
          todoIndex: i,
          todoId: todo.id,
          issue: 'Todo description contains binary data',
          severity: 'high',
          field: 'description'
        });
        result.details.corruptionIndicators++;
        result.details.patternsDetected.push('binary-data');
      }
    }

    // Calculate score based on corruption indicators
    if (result.details.corruptionIndicators > 0) {
      result.score = Math.max(0, 100 - (result.details.corruptionIndicators * 15));
      result.passed = result.score >= 60;
    }

    return result;
  }

  /**
   * Validate cross-references and relationships
   */
  async validateCrossReferences(todos) {
    const result = {
      passed: true,
      score: 100,
      issues: [],
      details: {
        orphanedReferences: 0,
        circularReferences: 0
      }
    };

    // This is a placeholder for more complex cross-reference validation
    // In a real application, you might check:
    // - Parent-child relationships
    // - Tag references
    // - User assignments
    // - Project associations

    // For now, we'll do basic tag consistency checking
    const allTags = new Set();
    const tagStats = new Map();

    for (const todo of todos) {
      if (todo.tags && Array.isArray(todo.tags)) {
        for (const tag of todo.tags) {
          allTags.add(tag);
          tagStats.set(tag, (tagStats.get(tag) || 0) + 1);
        }
      }
    }

    // Check for suspicious tag patterns
    for (const [tag, count] of tagStats) {
      if (count === 1 && tag.length > 20) {
        // Single-use very long tags might be corruption
        result.issues.push({
          issue: `Suspicious single-use long tag: ${tag}`,
          severity: 'low',
          field: 'tags'
        });
      }
    }

    return result;
  }

  /**
   * Calculate overall verification score
   */
  calculateOverallScore(checks) {
    const weights = {
      structure: 0.3,
      content: 0.2,
      consistency: 0.25,
      checksum: 0.15,
      corruption: 0.1
    };

    let totalScore = 0;
    let totalWeight = 0;

    for (const [checkName, result] of Object.entries(checks)) {
      if (weights[checkName] && result.score !== undefined) {
        totalScore += result.score * weights[checkName];
        totalWeight += weights[checkName];
      }
    }

    const overall = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;

    return {
      passed: overall >= 80,
      score: overall,
      grade: this.getGrade(overall)
    };
  }

  /**
   * Get grade letter for score
   */
  getGrade(score) {
    if (score >= 95) return 'A+';
    if (score >= 90) return 'A';
    if (score >= 85) return 'B+';
    if (score >= 80) return 'B';
    if (score >= 75) return 'C+';
    if (score >= 70) return 'C';
    if (score >= 65) return 'D+';
    if (score >= 60) return 'D';
    return 'F';
  }

  /**
   * Generate recommendations based on verification results
   */
  generateRecommendations(checks) {
    const recommendations = [];

    // Structure recommendations
    if (checks.structure && checks.structure.score < 90) {
      recommendations.push({
        category: 'structure',
        priority: 'high',
        action: 'Fix data structure issues',
        description: 'Some todos have invalid or missing required fields'
      });
    }

    // Content recommendations
    if (checks.content && checks.content.score < 80) {
      recommendations.push({
        category: 'content',
        priority: 'medium',
        action: 'Clean up content issues',
        description: 'Content contains suspicious patterns or encoding issues'
      });
    }

    // Consistency recommendations
    if (checks.consistency && checks.consistency.score < 85) {
      recommendations.push({
        category: 'consistency',
        priority: 'high',
        action: 'Resolve data inconsistencies',
        description: 'Found logical or temporal inconsistencies in the data'
      });
    }

    // Corruption recommendations
    if (checks.corruption && checks.corruption.score < 70) {
      recommendations.push({
        category: 'corruption',
        priority: 'critical',
        action: 'Investigate potential data corruption',
        description: 'Data shows signs of corruption and may need restoration from backup'
      });
    }

    // Checksum recommendations
    if (checks.checksum && !checks.checksum.passed) {
      recommendations.push({
        category: 'checksum',
        priority: 'critical',
        action: 'Verify data integrity',
        description: 'Checksum mismatch indicates data tampering or corruption'
      });
    }

    return recommendations;
  }

  /**
   * Gather statistics about the verification
   */
  gatherStatistics(todos, checks) {
    const stats = {
      totalTodos: todos.length,
      totalIssues: 0,
      issuesBySeverity: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      },
      checksPerformed: Object.keys(checks).length,
      checksPassed: 0
    };

    for (const result of Object.values(checks)) {
      if (result.passed) {
        stats.checksPassed++;
      }

      if (result.issues) {
        stats.totalIssues += result.issues.length;

        for (const issue of result.issues) {
          if (issue.severity && stats.issuesBySeverity[issue.severity] !== undefined) {
            stats.issuesBySeverity[issue.severity]++;
          }
        }
      }
    }

    return stats;
  }

  /**
   * Generate data checksum for integrity verification
   */
  generateDataChecksum(data) {
    // Normalize data for consistent checksums
    const normalized = data.map(todo => ({
      id: todo.id,
      description: todo.description?.trim() || '',
      completed: Boolean(todo.completed),
      priority: todo.priority || 'medium',
      tags: (todo.tags || []).sort(),
      createdAt: todo.createdAt || null,
      dueDate: todo.dueDate || null,
      completedAt: todo.completedAt || null
    })).sort((a, b) => a.id - b.id);

    return crypto.createHash('sha256')
      .update(JSON.stringify(normalized))
      .digest('hex');
  }

  /**
   * Store data checksum for future verification
   */
  async storeChecksum(checksum) {
    try {
      const checksumFile = path.join(this.config.options.dataDir, '.data-checksum');
      const checksumData = {
        checksum,
        timestamp: new Date().toISOString()
      };

      fs.writeFileSync(checksumFile, JSON.stringify(checksumData, null, 2));
      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get stored checksum
   */
  async getStoredChecksum() {
    try {
      const checksumFile = path.join(this.config.options.dataDir, '.data-checksum');

      if (fs.existsSync(checksumFile)) {
        const checksumData = JSON.parse(fs.readFileSync(checksumFile, 'utf8'));
        return checksumData.checksum;
      }

      return null;

    } catch (error) {
      console.error(`Error reading stored checksum: ${error.message}`);
      return null;
    }
  }

  /**
   * Repair data issues (basic repair functionality)
   */
  async repairDataIssues(todos, verificationResult) {
    const repaired = JSON.parse(JSON.stringify(todos)); // Deep copy
    const repairs = [];

    if (!verificationResult.verification) {
      return {
        success: false,
        error: 'No verification result provided'
      };
    }

    const checks = verificationResult.verification.checks;

    // Repair structure issues
    if (checks.structure && checks.structure.issues) {
      for (const structureIssue of checks.structure.issues) {
        const todoIndex = structureIssue.todoIndex;
        const todo = repaired[todoIndex];

        if (!todo) continue;

        for (const issue of structureIssue.issues) {
          switch (issue.field) {
            case 'id':
              if (!todo.id || typeof todo.id !== 'number') {
                todo.id = Date.now() + Math.random();
                repairs.push(`Fixed invalid ID for todo at index ${todoIndex}`);
              }
              break;

            case 'description':
              if (!todo.description || typeof todo.description !== 'string') {
                todo.description = 'Restored todo item';
                repairs.push(`Fixed invalid description for todo ${todo.id}`);
              }
              break;

            case 'completed':
              if (typeof todo.completed !== 'boolean') {
                todo.completed = false;
                repairs.push(`Fixed invalid completed status for todo ${todo.id}`);
              }
              break;

            case 'priority':
              if (!['low', 'medium', 'high'].includes(todo.priority)) {
                todo.priority = 'medium';
                repairs.push(`Fixed invalid priority for todo ${todo.id}`);
              }
              break;

            case 'tags':
              if (!Array.isArray(todo.tags)) {
                todo.tags = [];
                repairs.push(`Fixed invalid tags for todo ${todo.id}`);
              }
              break;
          }
        }
      }
    }

    // Repair consistency issues
    if (checks.consistency && checks.consistency.issues) {
      for (const issue of checks.consistency.issues) {
        const todo = repaired.find(t => t.id === issue.todoId);
        if (!todo) continue;

        if (issue.issue.includes('missing completedAt')) {
          todo.completedAt = new Date().toISOString();
          repairs.push(`Added missing completedAt timestamp for todo ${todo.id}`);
        } else if (issue.issue.includes('has completedAt timestamp')) {
          delete todo.completedAt;
          repairs.push(`Removed invalid completedAt timestamp for todo ${todo.id}`);
        }
      }
    }

    return {
      success: true,
      repairedData: repaired,
      repairs,
      repairCount: repairs.length
    };
  }

  /**
   * Get verification history
   */
  getVerificationHistory() {
    return this.verificationHistory.slice(-10); // Last 10 verifications
  }

  /**
   * Get verification statistics
   */
  getVerificationStats() {
    if (this.verificationHistory.length === 0) {
      return { totalVerifications: 0 };
    }

    const recent = this.verificationHistory.slice(-5);
    const scores = recent.map(v => v.overall.score).filter(s => s !== undefined);

    return {
      totalVerifications: this.verificationHistory.length,
      averageScore: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      lastVerification: this.verificationHistory[this.verificationHistory.length - 1].timestamp,
      recentTrend: scores.length >= 2 ? scores[scores.length - 1] - scores[0] : 0
    };
  }
}

module.exports = { DataIntegrityVerifier };