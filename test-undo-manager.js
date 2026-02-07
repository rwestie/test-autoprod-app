#!/usr/bin/env node

/**
 * Test suite for UndoManager
 * Tests deletion recording, undo operations, and history management
 */

const { UndoManager } = require('./undo-manager');

// Test utilities
let testCount = 0;
let passedTests = 0;
let failedTests = 0;

function test(description, testFn) {
  testCount++;
  try {
    console.log(`\n🔍 Test ${testCount}: ${description}`);
    testFn();
    passedTests++;
    console.log('✅ PASSED');
  } catch (error) {
    failedTests++;
    console.log('❌ FAILED:', error.message);
    console.log(error.stack);
  }
}

function assert(condition, message = 'Assertion failed') {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEquals(actual, expected, message = 'Values not equal') {
  if (actual !== expected) {
    throw new Error(`${message}. Expected: ${expected}, Actual: ${actual}`);
  }
}

function assertArrayLength(array, expectedLength, message = 'Array length mismatch') {
  if (!Array.isArray(array)) {
    throw new Error(`${message}. Expected array, got: ${typeof array}`);
  }
  if (array.length !== expectedLength) {
    throw new Error(`${message}. Expected length: ${expectedLength}, Actual: ${array.length}`);
  }
}

// Sample todo data for testing
const sampleTodos = [
  { id: 1, description: 'Buy groceries', completed: false, createdAt: '2024-01-01T10:00:00.000Z' },
  { id: 2, description: 'Walk the dog', completed: true, createdAt: '2024-01-01T11:00:00.000Z' },
  { id: 3, description: 'Write report', completed: false, createdAt: '2024-01-01T12:00:00.000Z' }
];

// Start tests
console.log('🧪 UNDO MANAGER TESTS');
console.log('=====================');

// Test 1: UndoManager initialization
test('UndoManager initialization with default options', () => {
  const undoManager = new UndoManager();

  assertEquals(undoManager.maxHistorySize, 50);
  assertEquals(undoManager.maxAge, 24 * 60 * 60 * 1000);
  assertArrayLength(undoManager.deletionHistory, 0);
});

// Test 2: UndoManager initialization with custom options
test('UndoManager initialization with custom options', () => {
  const options = {
    maxHistorySize: 25,
    maxAge: 12 * 60 * 60 * 1000, // 12 hours
    enableLogging: true
  };
  const undoManager = new UndoManager(options);

  assertEquals(undoManager.maxHistorySize, 25);
  assertEquals(undoManager.maxAge, 12 * 60 * 60 * 1000);
  assertEquals(undoManager.enableLogging, true);
});

// Test 3: Record single deletion
test('Record single todo deletion', () => {
  const undoManager = new UndoManager();

  const deleteOperation = {
    type: 'single',
    deletedTodos: [sampleTodos[0]],
    metadata: {
      deletionMethod: 'id',
      totalBefore: 3,
      totalAfter: 2
    },
    timestamp: new Date().toISOString()
  };

  const deletionId = undoManager.recordDeletion(deleteOperation);

  assert(deletionId.startsWith('del_'), 'Deletion ID should start with "del_"');
  assertArrayLength(undoManager.deletionHistory, 1);

  const entry = undoManager.deletionHistory[0];
  assertEquals(entry.type, 'single');
  assertEquals(entry.deletedTodos[0].id, 1);
  assert(entry.canUndo, 'Entry should be undoable');
});

// Test 4: Record batch deletion
test('Record batch todo deletion', () => {
  const undoManager = new UndoManager();

  const deleteOperation = {
    type: 'batch',
    deletedTodos: [sampleTodos[0], sampleTodos[2]],
    metadata: {
      deletionMethod: 'batch-id',
      totalBefore: 3,
      totalAfter: 1
    }
  };

  const deletionId = undoManager.recordDeletion(deleteOperation);

  assert(deletionId.startsWith('del_'), 'Deletion ID should start with "del_"');
  assertArrayLength(undoManager.deletionHistory, 1);

  const entry = undoManager.deletionHistory[0];
  assertEquals(entry.type, 'batch');
  assertArrayLength(entry.deletedTodos, 2);
  assertEquals(entry.deletedTodos[0].id, 1);
  assertEquals(entry.deletedTodos[1].id, 3);
});

// Test 5: Record bulk deletion
test('Record bulk todo deletion (clean)', () => {
  const undoManager = new UndoManager();

  const deleteOperation = {
    type: 'bulk',
    deletedTodos: [sampleTodos[1]], // Only completed todo
    metadata: {
      operation: 'clean',
      totalBefore: 3,
      totalAfter: 2
    }
  };

  const deletionId = undoManager.recordDeletion(deleteOperation);

  const entry = undoManager.deletionHistory[0];
  assertEquals(entry.type, 'bulk');
  assertEquals(entry.metadata.operation, 'clean');
  assertArrayLength(entry.deletedTodos, 1);
});

// Test 6: Get recent deletions
test('Get recent deletions', () => {
  const undoManager = new UndoManager();

  // Record multiple deletions
  undoManager.recordDeletion({
    type: 'single',
    deletedTodos: [sampleTodos[0]],
    metadata: { deletionMethod: 'id' }
  });

  undoManager.recordDeletion({
    type: 'batch',
    deletedTodos: [sampleTodos[1], sampleTodos[2]],
    metadata: { deletionMethod: 'batch' }
  });

  const recentDeletions = undoManager.getRecentDeletions(5);
  assertArrayLength(recentDeletions, 2);

  // Should be in reverse chronological order (most recent first)
  assertEquals(recentDeletions[0].type, 'batch');
  assertEquals(recentDeletions[1].type, 'single');

  // Check summary generation
  assert(recentDeletions[0].summary.includes('Batch deleted'), 'Should have batch deletion summary');
  assert(recentDeletions[1].summary.includes('Deleted "Buy groceries"'), 'Should have single deletion summary');
});

// Test 7: Get most recent deletion
test('Get most recent deletion', () => {
  const undoManager = new UndoManager();

  // No deletions recorded
  let recent = undoManager.getMostRecentDeletion();
  assertEquals(recent, null);

  // Record a deletion
  undoManager.recordDeletion({
    type: 'single',
    deletedTodos: [sampleTodos[0]],
    metadata: { deletionMethod: 'id' }
  });

  recent = undoManager.getMostRecentDeletion();
  assert(recent !== null, 'Should have a recent deletion');
  assertEquals(recent.type, 'single');
});

// Test 8: Undo single deletion
test('Undo single todo deletion', () => {
  const undoManager = new UndoManager();

  const deleteOperation = {
    type: 'single',
    deletedTodos: [sampleTodos[0]],
    metadata: { deletionMethod: 'id' }
  };

  const deletionId = undoManager.recordDeletion(deleteOperation);

  // Undo the deletion
  const undoResult = undoManager.undoDeletion(deletionId, []);

  assert(undoResult.success, 'Undo should succeed');
  assertEquals(undoResult.deletionType, 'single');
  assertArrayLength(undoResult.restoredTodos, 1);
  assertEquals(undoResult.restoredTodos[0].id, 1);
  assertEquals(undoResult.restoredTodos[0].description, 'Buy groceries');

  // Should not have deletion-specific metadata
  assert(!undoResult.restoredTodos[0].hasOwnProperty('deletedAt'), 'Should not have deletedAt');
  assert(!undoResult.restoredTodos[0].hasOwnProperty('originalPosition'), 'Should not have originalPosition');

  // Deletion should be marked as used
  const entry = undoManager.deletionHistory.find(e => e.id === deletionId);
  assert(!entry.canUndo, 'Entry should no longer be undoable');
  assert(entry.undoneAt, 'Entry should have undoneAt timestamp');
});

// Test 9: Undo last deletion
test('Undo last deletion', () => {
  const undoManager = new UndoManager();

  // No deletions to undo
  let undoResult = undoManager.undoLastDeletion();
  assert(!undoResult.success, 'Should fail when no deletions exist');
  assert(undoResult.error.includes('No recent deletions'), 'Should have appropriate error message');

  // Record and undo a deletion
  undoManager.recordDeletion({
    type: 'single',
    deletedTodos: [sampleTodos[0]],
    metadata: { deletionMethod: 'id' }
  });

  undoResult = undoManager.undoLastDeletion();
  assert(undoResult.success, 'Undo should succeed');
  assertEquals(undoResult.deletionType, 'single');
});

// Test 10: Undo non-existent deletion
test('Undo non-existent deletion', () => {
  const undoManager = new UndoManager();

  const undoResult = undoManager.undoDeletion('invalid_id', []);

  assert(!undoResult.success, 'Should fail for invalid ID');
  assert(undoResult.error.includes('not found'), 'Should have appropriate error message');
});

// Test 11: Multiple undos (should fail second undo)
test('Multiple undos of same deletion should fail', () => {
  const undoManager = new UndoManager();

  const deletionId = undoManager.recordDeletion({
    type: 'single',
    deletedTodos: [sampleTodos[0]],
    metadata: { deletionMethod: 'id' }
  });

  // First undo should succeed
  const firstUndo = undoManager.undoDeletion(deletionId, []);
  assert(firstUndo.success, 'First undo should succeed');

  // Second undo should fail
  const secondUndo = undoManager.undoDeletion(deletionId, []);
  assert(!secondUndo.success, 'Second undo should fail');
  assert(secondUndo.error.includes('cannot be undone'), 'Should have appropriate error message');
});

// Test 12: Batch undo
test('Undo batch deletion', () => {
  const undoManager = new UndoManager();

  const deletionId = undoManager.recordDeletion({
    type: 'batch',
    deletedTodos: [sampleTodos[0], sampleTodos[2]],
    metadata: { deletionMethod: 'batch-id' }
  });

  const undoResult = undoManager.undoDeletion(deletionId, []);

  assert(undoResult.success, 'Batch undo should succeed');
  assertEquals(undoResult.deletionType, 'batch');
  assertArrayLength(undoResult.restoredTodos, 2);
  assertEquals(undoResult.metadata.restoredCount, 2);
});

// Test 13: Clear history
test('Clear undo history', () => {
  const undoManager = new UndoManager();

  // Record some deletions
  undoManager.recordDeletion({
    type: 'single',
    deletedTodos: [sampleTodos[0]],
    metadata: { deletionMethod: 'id' }
  });

  undoManager.recordDeletion({
    type: 'single',
    deletedTodos: [sampleTodos[1]],
    metadata: { deletionMethod: 'id' }
  });

  assertArrayLength(undoManager.deletionHistory, 2);

  const clearResult = undoManager.clearHistory();
  assert(clearResult.success, 'Clear should succeed');
  assertEquals(clearResult.clearedCount, 2);
  assertArrayLength(undoManager.deletionHistory, 0);
});

// Test 14: Statistics
test('Get undo manager statistics', () => {
  const undoManager = new UndoManager();

  // Record different types of deletions
  const deletionId1 = undoManager.recordDeletion({
    type: 'single',
    deletedTodos: [sampleTodos[0]],
    metadata: { deletionMethod: 'id' }
  });

  undoManager.recordDeletion({
    type: 'batch',
    deletedTodos: [sampleTodos[1], sampleTodos[2]],
    metadata: { deletionMethod: 'batch' }
  });

  // Use one undo
  undoManager.undoDeletion(deletionId1, []);

  const stats = undoManager.getStats();
  assertEquals(stats.totalEntries, 2);
  assertEquals(stats.availableUndos, 1);
  assertEquals(stats.usedUndos, 1);
  assertEquals(stats.typeStats.single, 1);
  assertEquals(stats.typeStats.batch, 1);
});

// Test 15: History size limit
test('History size limit enforcement', () => {
  const undoManager = new UndoManager({ maxHistorySize: 3 });

  // Record 5 deletions (more than limit)
  for (let i = 0; i < 5; i++) {
    undoManager.recordDeletion({
      type: 'single',
      deletedTodos: [{ ...sampleTodos[0], id: i + 1 }],
      metadata: { deletionMethod: 'id' }
    });
  }

  // Should only keep the most recent 3
  assertArrayLength(undoManager.deletionHistory, 3);

  // Should be the most recent ones (IDs 5, 4, 3)
  assertEquals(undoManager.deletionHistory[0].deletedTodos[0].id, 5);
  assertEquals(undoManager.deletionHistory[1].deletedTodos[0].id, 4);
  assertEquals(undoManager.deletionHistory[2].deletedTodos[0].id, 3);
});

// Test 16: Summary generation for different deletion types
test('Deletion summary generation', () => {
  const undoManager = new UndoManager();

  // Single deletion summary
  const singleEntry = {
    type: 'single',
    deletedTodos: [{ description: 'Test todo' }],
    timestamp: '2024-01-01T12:00:00.000Z',
    metadata: {}
  };

  const singleSummary = undoManager.generateDeletionSummary(singleEntry);
  assert(singleSummary.includes('Deleted "Test todo"'), 'Should contain todo description');

  // Batch deletion summary
  const batchEntry = {
    type: 'batch',
    deletedTodos: [sampleTodos[0], sampleTodos[1]],
    timestamp: '2024-01-01T12:00:00.000Z',
    metadata: {}
  };

  const batchSummary = undoManager.generateDeletionSummary(batchEntry);
  assert(batchSummary.includes('Batch deleted 2 todos'), 'Should contain batch count');

  // Bulk clean summary
  const cleanEntry = {
    type: 'bulk',
    deletedTodos: [sampleTodos[1]],
    timestamp: '2024-01-01T12:00:00.000Z',
    metadata: { operation: 'clean' }
  };

  const cleanSummary = undoManager.generateDeletionSummary(cleanEntry);
  assert(cleanSummary.includes('Cleaned 1 completed todos'), 'Should contain clean operation info');

  // Bulk clear summary
  const clearEntry = {
    type: 'bulk',
    deletedTodos: sampleTodos,
    timestamp: '2024-01-01T12:00:00.000Z',
    metadata: { operation: 'clear' }
  };

  const clearSummary = undoManager.generateDeletionSummary(clearEntry);
  assert(clearSummary.includes('Cleared all 3 todos'), 'Should contain clear operation info');
});

// Test 17: Export and import history
test('Export and import undo history', () => {
  const undoManager1 = new UndoManager();

  // Record some deletions
  undoManager1.recordDeletion({
    type: 'single',
    deletedTodos: [sampleTodos[0]],
    metadata: { deletionMethod: 'id' }
  });

  // Export history
  const exportedHistory = undoManager1.exportHistory();
  assert(exportedHistory.deletionHistory, 'Should have deletion history');
  assert(exportedHistory.exportTimestamp, 'Should have export timestamp');
  assertArrayLength(exportedHistory.deletionHistory, 1);

  // Import to new manager
  const undoManager2 = new UndoManager();
  const importResult = undoManager2.importHistory(exportedHistory);

  assert(importResult.success, 'Import should succeed');
  assertEquals(importResult.importedEntries, 1);
  assertArrayLength(undoManager2.deletionHistory, 1);

  // Test invalid import
  const invalidImport = undoManager2.importHistory({ invalid: 'data' });
  assert(!invalidImport.success, 'Invalid import should fail');
});

// Run all tests and show summary
console.log('\n📊 TEST SUMMARY');
console.log('================');
console.log(`Total tests: ${testCount}`);
console.log(`✅ Passed: ${passedTests}`);
console.log(`❌ Failed: ${failedTests}`);

if (failedTests === 0) {
  console.log('\n🎉 All tests passed!');
  process.exit(0);
} else {
  console.log(`\n💥 ${failedTests} test(s) failed.`);
  process.exit(1);
}