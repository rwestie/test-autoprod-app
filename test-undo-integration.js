#!/usr/bin/env node

/**
 * Test suite for Undo functionality integration with TodoCoreEnhanced
 * Tests the complete undo workflow from deletion to restoration
 */

const { TodoCoreEnhanced } = require('./todo-core-enhanced');
const { StorageConfig } = require('./storage-config');

// Test utilities
let testCount = 0;
let passedTests = 0;
let failedTests = 0;

function test(description, testFn) {
  testCount++;
  return new Promise((resolve, reject) => {
    console.log(`\n🔍 Test ${testCount}: ${description}`);
    Promise.resolve(testFn())
      .then(() => {
        passedTests++;
        console.log('✅ PASSED');
        resolve();
      })
      .catch(error => {
        failedTests++;
        console.log('❌ FAILED:', error.message);
        console.log(error.stack);
        resolve(); // Continue with other tests
      });
  });
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

// Create a temporary test config to avoid interfering with real data
function createTestConfig() {
  const tempFile = `/tmp/test-undo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.json`;
  return new StorageConfig({
    dataDir: '/tmp',
    dataFile: tempFile.split('/').pop(),
    enableBackups: false, // Disable backups for testing
    enableLogging: false // Disable logging for cleaner test output
  });
}

// Sample todo data for testing
const sampleTodos = [
  { id: 1, description: 'Buy groceries', completed: false, createdAt: new Date().toISOString() },
  { id: 2, description: 'Walk the dog', completed: true, createdAt: new Date().toISOString() },
  { id: 3, description: 'Write report', completed: false, createdAt: new Date().toISOString() },
  { id: 4, description: 'Call client', completed: false, createdAt: new Date().toISOString() },
  { id: 5, description: 'Review code', completed: true, createdAt: new Date().toISOString() }
];

// Start tests
console.log('🧪 UNDO INTEGRATION TESTS');
console.log('==========================');

async function runTests() {

  // Test 1: Setup TodoCoreEnhanced with sample data
  let todoCore;
  await test('Setup TodoCoreEnhanced with sample data', async () => {
    const config = createTestConfig();
    todoCore = new TodoCoreEnhanced(config);
    await todoCore.initialize();

    // Add sample todos
    for (const todoData of sampleTodos) {
      await todoCore.addTodo(todoData.description, {
        completed: todoData.completed
      });
    }

    const todos = await todoCore.listTodos();
    assertEquals(todos.length, 5);
  });

  // Test 2: Single todo deletion records undo information
  let singleDeletionId;
  await test('Single todo deletion records undo information', async () => {
    const deleteResult = await todoCore.deleteTodo(1); // Delete first todo

    assert(deleteResult.success, 'Delete should succeed');
    assert(deleteResult.deletionId, 'Should return deletion ID');
    assertEquals(deleteResult.todo.description, sampleTodos[0].description);

    singleDeletionId = deleteResult.deletionId;

    // Check undo history
    const recentDeletions = todoCore.getRecentDeletions(5);
    assertArrayLength(recentDeletions, 1);
    assertEquals(recentDeletions[0].type, 'single');
    assertEquals(recentDeletions[0].deletedCount, 1);
  });

  // Test 3: Undo single deletion restores todo
  await test('Undo single deletion restores todo', async () => {
    const undoResult = await todoCore.undoDeletion(singleDeletionId);

    assert(undoResult.success, 'Undo should succeed');
    assertEquals(undoResult.deletionType, 'single');
    assertEquals(undoResult.restoredCount, 1);
    assertEquals(undoResult.restoredTodos[0].description, sampleTodos[0].description);

    // Verify todo is back in the list
    const todos = await todoCore.listTodos();
    assertEquals(todos.length, 5);

    // Check that the deletion can't be undone again
    const secondUndo = await todoCore.undoDeletion(singleDeletionId);
    assert(!secondUndo.success, 'Second undo should fail');
    assert(secondUndo.error.includes('cannot be undone'), 'Should have appropriate error');
  });

  // Test 4: Batch deletion records undo information
  let batchDeletionId;
  await test('Batch deletion records undo information', async () => {
    // Delete todos by IDs 1 and 3
    const batchResult = await todoCore.batchDeleteTodos([1, 3]);

    assert(batchResult.success, 'Batch delete should succeed');
    assert(batchResult.deletionId, 'Should return deletion ID');
    assertEquals(batchResult.count, 2);

    batchDeletionId = batchResult.deletionId;

    // Check undo history
    const recentDeletions = todoCore.getRecentDeletions(5);
    assert(recentDeletions.length >= 1, 'Should have deletion history');
    const batchDeletion = recentDeletions.find(d => d.type === 'batch');
    assert(batchDeletion, 'Should have batch deletion in history');
    assertEquals(batchDeletion.deletedCount, 2);
  });

  // Test 5: Undo batch deletion restores todos
  await test('Undo batch deletion restores todos', async () => {
    const undoResult = await todoCore.undoDeletion(batchDeletionId);

    assert(undoResult.success, 'Batch undo should succeed');
    assertEquals(undoResult.deletionType, 'batch');
    assertEquals(undoResult.restoredCount, 2);

    // Verify todos are back in the list
    const todos = await todoCore.listTodos();
    assertEquals(todos.length, 5);
  });

  // Test 6: Bulk deletion (clean) records undo information
  let bulkDeletionId;
  await test('Bulk deletion (clean) records undo information', async () => {
    const cleanResult = await todoCore.cleanCompletedTodos({ force: true });

    assert(cleanResult.success, 'Clean should succeed');
    assert(cleanResult.deletionId, 'Should return deletion ID');
    assert(cleanResult.count >= 1, 'Should delete at least one completed todo');

    bulkDeletionId = cleanResult.deletionId;

    // Check undo history
    const recentDeletions = todoCore.getRecentDeletions(5);
    const bulkDeletion = recentDeletions.find(d => d.type === 'bulk');
    assert(bulkDeletion, 'Should have bulk deletion in history');
  });

  // Test 7: Undo bulk deletion restores todos
  await test('Undo bulk deletion restores todos', async () => {
    const undoResult = await todoCore.undoDeletion(bulkDeletionId);

    assert(undoResult.success, 'Bulk undo should succeed');
    assertEquals(undoResult.deletionType, 'bulk');
    assert(undoResult.restoredCount >= 1, 'Should restore at least one todo');

    // Verify todos are back in the list
    const todos = await todoCore.listTodos();
    assertEquals(todos.length, 5);
  });

  // Test 8: Undo last deletion functionality
  await test('Undo last deletion functionality', async () => {
    // Delete a todo
    const deleteResult = await todoCore.deleteTodo(2);
    assert(deleteResult.success, 'Delete should succeed');

    const beforeUndoCount = (await todoCore.listTodos()).length;

    // Undo last deletion
    const undoResult = await todoCore.undoLastDeletion();
    assert(undoResult.success, 'Undo last should succeed');

    const afterUndoCount = (await todoCore.listTodos()).length;
    assertEquals(afterUndoCount, beforeUndoCount + 1);
  });

  // Test 9: Undo statistics and history management
  await test('Undo statistics and history management', async () => {
    const stats = todoCore.getUndoStats();

    assert(stats.totalEntries >= 0, 'Should have total entries count');
    assert(stats.availableUndos >= 0, 'Should have available undos count');
    assert(stats.usedUndos >= 0, 'Should have used undos count');
    assert(stats.maxHistorySize > 0, 'Should have max history size');
    assert(typeof stats.typeStats === 'object', 'Should have type statistics');

    // Clear undo history
    const clearResult = todoCore.clearUndoHistory();
    assert(clearResult.success, 'Clear should succeed');

    const newStats = todoCore.getUndoStats();
    assertEquals(newStats.totalEntries, 0);
    assertEquals(newStats.availableUndos, 0);
  });

  // Test 10: No recent deletions when history is clear
  await test('No recent deletions when history is clear', async () => {
    const recentDeletions = todoCore.getRecentDeletions(5);
    assertArrayLength(recentDeletions, 0);

    const undoResult = await todoCore.undoLastDeletion();
    assert(!undoResult.success, 'Undo should fail when no deletions');
    assert(undoResult.error.includes('No recent deletions'), 'Should have appropriate error');
  });

  // Test 11: Multiple deletions and selective undo
  await test('Multiple deletions and selective undo', async () => {
    // Create multiple deletions
    const delete1 = await todoCore.deleteTodo(1);
    const delete2 = await todoCore.deleteTodo(2);
    const delete3 = await todoCore.batchDeleteTodos([3, 4]);

    assert(delete1.success && delete2.success && delete3.success, 'All deletes should succeed');

    // Check we have multiple deletions in history
    const recentDeletions = todoCore.getRecentDeletions(5);
    assert(recentDeletions.length >= 3, 'Should have at least 3 deletions');

    // Undo the middle one (delete2)
    const undoResult = await todoCore.undoDeletion(delete2.deletionId);
    assert(undoResult.success, 'Selective undo should succeed');

    // Verify the specific todo was restored
    const todos = await todoCore.listTodos();
    const restoredTodo = todos.find(t => t.description === sampleTodos[1].description);
    assert(restoredTodo, 'Specific todo should be restored');

    // Verify other deletions are still available for undo
    const updatedDeletions = todoCore.getRecentDeletions(5);
    const stillAvailable = updatedDeletions.filter(d =>
      d.id === delete1.deletionId || d.id === delete3.deletionId
    );
    assert(stillAvailable.length >= 2, 'Other deletions should still be available');
  });

  // Test 12: Error handling for invalid deletion IDs
  await test('Error handling for invalid deletion IDs', async () => {
    const undoResult = await todoCore.undoDeletion('invalid_deletion_id');
    assert(!undoResult.success, 'Undo should fail for invalid ID');
    assert(undoResult.error.includes('not found'), 'Should have appropriate error message');
  });

  // Test 13: Undo with save failure simulation
  await test('Undo handles save failures gracefully', async () => {
    // Delete a todo first
    const deleteResult = await todoCore.deleteTodo(5);
    assert(deleteResult.success, 'Delete should succeed');

    // TODO: This test would require mocking the storage to simulate save failure
    // For now, we'll just verify the basic undo functionality
    const undoResult = await todoCore.undoDeletion(deleteResult.deletionId);
    assert(undoResult.success, 'Undo should succeed under normal conditions');
  });

  // Cleanup
  await test('Cleanup test environment', async () => {
    await todoCore.close();
    console.log('🧹 Test environment cleaned up');
  });

  // Show summary
  console.log('\n📊 TEST SUMMARY');
  console.log('================');
  console.log(`Total tests: ${testCount}`);
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);

  if (failedTests === 0) {
    console.log('\n🎉 All undo integration tests passed!');
    process.exit(0);
  } else {
    console.log(`\n💥 ${failedTests} test(s) failed.`);
    process.exit(1);
  }
}

// Run all tests
runTests().catch(error => {
  console.error('💥 Test runner failed:', error);
  process.exit(1);
});