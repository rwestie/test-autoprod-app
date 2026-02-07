/**
 * Comprehensive Tests for Enhanced Todo Model Delete Functionality
 *
 * Tests the new delete enhancement features:
 * - Enhanced delete protection and validation
 * - Delete risk assessment and impact analysis
 * - Soft delete functionality
 * - Improved bulk delete operations
 * - Delete metadata and recommendations
 */

const assert = require("assert");
const { Todo } = require("./todo-model");

console.log("Running enhanced Todo model delete functionality tests...");

// Helper function to run tests
function runTest(testName, testFn) {
  try {
    testFn();
    console.log(`✓ ${testName}`);
  } catch (error) {
    console.error(`✗ ${testName}: ${error.message}`);
    throw error;
  }
}

// Test 1: Enhanced delete protection
runTest("Enhanced delete protection", () => {
  // Test high priority overdue todo protection
  const overdueTodo = new Todo({
    id: 1,
    description: "Critical system maintenance",
    priority: "high",
    dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString() // 2 days ago
  });

  const protectionResult = overdueTodo.canBeDeleted();
  assert.strictEqual(protectionResult.canDelete, false);
  assert(protectionResult.reason.includes("overdue high-priority"));

  // Test force delete override
  const forceResult = overdueTodo.canBeDeleted({ force: true });
  assert.strictEqual(forceResult.canDelete, true);

  // Test critical tag protection
  const criticalTodo = new Todo({
    id: 2,
    description: "Important project milestone",
    tags: ["critical", "project"]
  });

  const criticalResult = criticalTodo.canBeDeleted();
  assert.strictEqual(criticalResult.canDelete, false);
  assert(criticalResult.reason.includes("critical"));
});

// Test 2: Delete risk assessment
runTest("Delete risk assessment", () => {
  // High risk todo
  const highRiskTodo = new Todo({
    id: 1,
    description: "Complete quarterly report for board meeting",
    priority: "high",
    tags: ["critical", "work", "urgent"],
    dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // Tomorrow
  });

  const risk = highRiskTodo.calculateDeleteRisk();
  const riskScore = highRiskTodo.getDeleteRiskScore();

  assert.strictEqual(risk, "high");
  assert(riskScore >= 5);

  // Low risk todo
  const lowRiskTodo = new Todo({
    id: 2,
    description: "Read a book",
    priority: "low",
    completed: true,
    completedAt: new Date().toISOString()
  });

  assert.strictEqual(lowRiskTodo.calculateDeleteRisk(), "low");
  assert(lowRiskTodo.getDeleteRiskScore() < 3);
});

// Test 3: Delete impact analysis
runTest("Delete impact analysis", () => {
  const complexTodo = new Todo({
    id: 1,
    description: "Implement comprehensive testing framework for the new user authentication system with OAuth 2.0 integration",
    priority: "high",
    tags: ["development", "security", "work", "oauth"],
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 1 week from now
  });

  const impact = complexTodo.assessDeletionImpact();

  assert.strictEqual(impact.dataLoss, "significant");
  assert.strictEqual(impact.workflowImpact, "minor");
  assert.strictEqual(impact.recoveryDifficulty, "moderate");

  // Test backup recommendation
  assert.strictEqual(complexTodo.isBackupRecommended(), true);

  const simpleTodo = new Todo({
    id: 2,
    description: "Buy milk",
    priority: "low",
    completed: true
  });

  const simpleImpact = simpleTodo.assessDeletionImpact();
  assert.strictEqual(simpleImpact.dataLoss, "minimal");
  assert.strictEqual(simpleTodo.isBackupRecommended(), false);
});

// Test 4: Suggested deletion actions
runTest("Suggested deletion actions", () => {
  // High priority overdue todo
  const overdueTodo = new Todo({
    id: 1,
    description: "Submit tax documents",
    priority: "high",
    dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  });

  const suggestion = overdueTodo.getSuggestedDeletionAction();
  assert(suggestion.includes("Complete before deleting"));

  // Completed todo
  const completedTodo = new Todo({
    id: 2,
    description: "File quarterly reports",
    completed: true,
    priority: "high"
  });

  const completedSuggestion = completedTodo.getSuggestedDeletionAction();
  assert(completedSuggestion.includes("archiving"));

  // Low risk todo
  const safeTodo = new Todo({
    id: 3,
    description: "Water plants",
    priority: "low"
  });

  assert.strictEqual(safeTodo.getSuggestedDeletionAction(), "Safe to delete");
});

// Test 5: Soft delete functionality
runTest("Soft delete functionality", () => {
  const todo = new Todo({
    id: 1,
    description: "Test soft delete",
    tags: ["test"]
  });

  // Initially not deleted
  assert.strictEqual(todo.isDeleted(), false);
  assert.strictEqual(todo.getDeletedAt(), null);

  // Mark as deleted
  todo.markAsDeleted();
  assert.strictEqual(todo.isDeleted(), true);
  assert(todo.hasTag("deleted"));

  const deletedAt = todo.getDeletedAt();
  assert(deletedAt !== null);
  assert(!isNaN(Date.parse(deletedAt)));

  // Restore from deleted state
  todo.restoreFromDeleted();
  assert.strictEqual(todo.isDeleted(), false);
  assert.strictEqual(todo.getDeletedAt(), null);
  assert(!todo.hasTag("deleted"));
});

// Test 6: Permanent deletion eligibility
runTest("Permanent deletion eligibility", () => {
  const todo = new Todo({
    id: 1,
    description: "Old deleted todo",
    tags: ["deleted", `deleted-at:${new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString()}`] // 31 days ago
  });

  // Should be eligible for permanent deletion (older than 30 days)
  assert.strictEqual(todo.canBePermanentlyDeleted(), true);
  assert.strictEqual(todo.canBePermanentlyDeleted(40), false); // With 40 day retention

  const recentTodo = new Todo({
    id: 2,
    description: "Recently deleted todo",
    tags: ["deleted", `deleted-at:${new Date().toISOString()}`] // Just deleted
  });

  // Should not be eligible for permanent deletion
  assert.strictEqual(recentTodo.canBePermanentlyDeleted(), false);
});

// Test 7: Enhanced bulk delete operations
runTest("Enhanced bulk delete operations", () => {
  // Test safe operation
  const safeTodo = new Todo({
    id: 1,
    description: "Simple task",
    priority: "low",
    completed: true
  });

  const safeResult = safeTodo.shouldBeIncludedInBulkDelete("safe");
  assert.strictEqual(safeResult.shouldDelete, true);
  assert.strictEqual(safeResult.riskLevel, "low");

  // Test protection in bulk operations
  const protectedTodo = new Todo({
    id: 2,
    description: "Critical system task",
    priority: "high",
    tags: ["critical"],
    dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  });

  const protectedResult = protectedTodo.shouldBeIncludedInBulkDelete("clean");
  assert.strictEqual(protectedResult.shouldDelete, false);
  assert(protectedResult.reason.includes("Protected"));

  // Test force include protected
  const forceResult = protectedTodo.shouldBeIncludedInBulkDelete("clear", { includeProtected: true });
  assert.strictEqual(forceResult.shouldDelete, true);

  // Test test data detection
  const testTodo = new Todo({
    id: 3,
    description: "This is a test todo",
    tags: ["demo"],
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2 hours ago to bypass protection
  });

  const testResult = testTodo.shouldBeIncludedInBulkDelete("test");
  assert.strictEqual(testResult.shouldDelete, true);
  assert(testResult.reason.includes("test/demo"));
});

// Test 8: Delete impact analysis report
runTest("Delete impact analysis report", () => {
  const todo = new Todo({
    id: 1,
    description: "Complex project todo with multiple dependencies",
    priority: "high",
    tags: ["project", "important", "work"],
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
  });

  const analysis = todo.getDeleteImpactAnalysis({
    relatedTodos: [{ id: 2 }, { id: 3 }],
    userProfile: { confirmHighRiskDeletes: true, totalTodosDeleted: 150 }
  });

  // Check structure
  assert(analysis.todo);
  assert(analysis.riskAssessment);
  assert(analysis.impactAnalysis);
  assert(analysis.recommendations);
  assert(analysis.metadata);
  assert(analysis.recovery);

  // Check risk assessment
  assert.strictEqual(analysis.riskAssessment.level, "high");
  assert(analysis.riskAssessment.score > 5);

  // Check recommendations
  assert(analysis.recommendations.alternatives);
  assert(Array.isArray(analysis.recommendations.alternatives));
  assert(analysis.recommendations.alternatives.length > 0);

  // Check metadata
  assert.strictEqual(analysis.metadata.relatedCount, 2);
  assert(analysis.metadata.userContext);

  // Check recovery
  assert(analysis.recovery.requirements);
  assert(typeof analysis.recovery.requirements.estimatedRecoveryTime === "string");
});

// Test 9: Delete alternatives
runTest("Delete alternatives", () => {
  const incompleteTodo = new Todo({
    id: 1,
    description: "Overdue high priority task",
    priority: "high",
    dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  });

  const alternatives = incompleteTodo.getDeleteAlternatives();

  assert(Array.isArray(alternatives));
  assert(alternatives.length > 0);

  // Should have completion alternative for incomplete todos
  const hasComplete = alternatives.some(alt => alt.action === "complete");
  assert(hasComplete);

  // Should have reschedule alternative for overdue todos
  const hasReschedule = alternatives.some(alt => alt.action === "reschedule");
  assert(hasReschedule);

  // Should have priority reduction for high priority
  const hasPriorityReduction = alternatives.some(alt => alt.action === "lower_priority");
  assert(hasPriorityReduction);

  // All alternatives should have required properties
  alternatives.forEach(alt => {
    assert(alt.action);
    assert(alt.description);
    assert(alt.benefit);
  });
});

// Test 10: Enhanced bulk operations metadata
runTest("Enhanced bulk operations metadata", () => {
  const operations = Todo.getBulkDeleteOperations();

  // Check for enhanced operations
  assert(operations.safe);
  assert(operations.inactive);
  assert(operations.test);

  // Check enhanced metadata structure
  Object.values(operations).forEach(op => {
    assert(op.name);
    assert(op.description);
    assert(op.riskLevel);
    assert(typeof op.confirmationRequired === "boolean");
    assert(op.estimatedImpact);
  });

  // Test specific operation properties
  assert.strictEqual(operations.clear.riskLevel, "high");
  assert.strictEqual(operations.clear.confirmationRequired, true);
  assert.strictEqual(operations.safe.riskLevel, "low");
  assert.strictEqual(operations.safe.confirmationRequired, false);
});

// Test 11: Recovery time estimation
runTest("Recovery time estimation", () => {
  const simpleTodo = new Todo({
    id: 1,
    description: "Buy milk"
  });

  const complexTodo = new Todo({
    id: 2,
    description: "Implement complex authentication system with OAuth 2.0, JWT tokens, refresh token rotation, and comprehensive security audit logging for the enterprise application",
    priority: "high",
    tags: ["development", "security", "oauth", "jwt", "enterprise"],
    dueDate: new Date().toISOString()
  });

  const simpleTime = simpleTodo.estimateRecoveryTime();
  const complexTime = complexTodo.estimateRecoveryTime();

  assert(simpleTime.includes("1-2"));
  assert(complexTime.includes("5+"));

  // Check requirements structure
  const requirements = complexTodo.getRecoveryRequirements();
  assert(Array.isArray(requirements.minBackupData));
  assert(Array.isArray(requirements.recommendedData));
  assert(typeof requirements.complexityFactors === "object");
  assert(requirements.complexityFactors.hasComplexDescription);
  assert(requirements.complexityFactors.hasMultipleTags);
});

console.log("\n🎉 All enhanced Todo model delete functionality tests passed!");
console.log("\nNew delete enhancements successfully implemented:");
console.log("✓ Enhanced delete protection with business rules");
console.log("✓ Comprehensive delete risk assessment");
console.log("✓ Delete impact analysis and recommendations");
console.log("✓ Soft delete functionality with recovery");
console.log("✓ Enhanced bulk delete operations with safety checks");
console.log("✓ Delete alternatives and recovery planning");
console.log("✓ Comprehensive delete metadata and reporting");