#!/usr/bin/env node

/**
 * Test Suite for Batch Delete Functionality
 *
 * Tests the new batch deletion features including:
 * - Multiple ID deletion
 * - Multiple index/position deletion
 * - Error handling and validation
 * - Preview functionality
 * - CLI integration
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { TodoCoreEnhanced } = require('./todo-core-enhanced');
const { StorageConfig } = require('./storage-config');

// Test configuration
const TEST_DATA_DIR = path.join(__dirname, 'test-data-batch-delete');
const TEST_DATA_FILE = 'test-todos-batch.json';

let testDataPath;
let todoCore;
let testResults = [];

function logTest(testName, passed, error = null) {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} - ${testName}`);
  if (!passed && error) {
    console.log(`   Error: ${error.message || error}`);
  }
  testResults.push({ testName, passed, error });
}

// Setup test environment
async function setupTestEnv() {
  // Create test directory
  if (!fs.existsSync(TEST_DATA_DIR)) {
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
  }

  testDataPath = path.join(TEST_DATA_DIR, TEST_DATA_FILE);

  // Remove existing test file
  if (fs.existsSync(testDataPath)) {
    fs.unlinkSync(testDataPath);
  }

  // Create storage config for testing
  const storageConfig = new StorageConfig({
    dataDir: TEST_DATA_DIR,
    dataFile: TEST_DATA_FILE,
    enableLogging: false,
    enableValidation: true
  });

  // Initialize TodoCore
  todoCore = new TodoCoreEnhanced(storageConfig, null, 'json-file');
  await todoCore.initialize();
}

// Cleanup test environment
async function cleanupTestEnv() {
  if (todoCore) {
    await todoCore.close();
  }

  // Clean up test files
  if (fs.existsSync(testDataPath)) {
    fs.unlinkSync(testDataPath);
  }

  if (fs.existsSync(TEST_DATA_DIR)) {
    try {
      fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

// Helper function to create test todos
async function createTestTodos() {
  const testTodos = [
    'First todo item',
    'Second todo item',
    'Third todo item',
    'Fourth todo item',
    'Fifth todo item',
    'Sixth todo item',
    'Seventh todo item'
  ];

  const createdTodos = [];
  for (const description of testTodos) {
    const result = await todoCore.addTodo(description);
    assert(result.success, `Failed to create test todo: ${description}`);
    createdTodos.push(result.todo);
  }

  // Mark some todos as completed for testing
  await todoCore.completeTodo(createdTodos[1].id); // Second todo
  await todoCore.completeTodo(createdTodos[3].id); // Fourth todo
  await todoCore.completeTodo(createdTodos[5].id); // Sixth todo

  return createdTodos;
}

// Test batch delete by IDs
async function testBatchDeleteByIds() {
  console.log('\n🔬 Testing batch delete by IDs...');

  try {
    const todos = await createTestTodos();
    const initialCount = todos.length;

    // Delete multiple todos by ID
    const idsToDelete = [todos[0].id, todos[2].id, todos[4].id]; // 1st, 3rd, 5th todos
    const result = await todoCore.batchDeleteTodos(idsToDelete, { useIndex: false });

    logTest('Batch delete by IDs should succeed', result.success);
    logTest('Should delete correct number of todos', result.count === 3);
    logTest('Should have correct remaining count', result.remaining === initialCount - 3);

    // Verify deleted todos
    const deletedIds = result.deleted.map(t => t.id);
    logTest('Should delete correct todos by ID',
      idsToDelete.every(id => deletedIds.includes(id)));

    // Verify remaining todos
    const remainingTodos = await todoCore.listTodos();
    const remainingIds = remainingTodos.map(t => t.id);
    logTest('Remaining todos should not include deleted IDs',
      !idsToDelete.some(id => remainingIds.includes(id)));

    logTest('Should report correct method', result.method === 'id');

  } catch (error) {
    logTest('Batch delete by IDs', false, error);
  }
}

// Test batch delete by indices
async function testBatchDeleteByIndices() {
  console.log('\n🔬 Testing batch delete by indices...');

  try {
    await cleanupTestEnv();
    await setupTestEnv();
    const todos = await createTestTodos();
    const initialCount = todos.length;

    // Delete multiple todos by index (1-based)
    const indicesToDelete = [1, 3, 5]; // 1st, 3rd, 5th positions
    const result = await todoCore.batchDeleteTodos(indicesToDelete, { useIndex: true });

    logTest('Batch delete by indices should succeed', result.success);
    logTest('Should delete correct number of todos', result.count === 3);
    logTest('Should have correct remaining count', result.remaining === initialCount - 3);
    logTest('Should report correct method', result.method === 'index');

    // Verify the correct todos were deleted (by position)
    const expectedDeletedTodos = [todos[0], todos[2], todos[4]]; // 0-based array indices
    const deletedIds = result.deleted.map(t => t.id);
    const expectedIds = expectedDeletedTodos.map(t => t.id);
    logTest('Should delete correct todos by position',
      expectedIds.every(id => deletedIds.includes(id)));

  } catch (error) {
    logTest('Batch delete by indices', false, error);
  }
}

// Test preview functionality
async function testBatchDeletePreview() {
  console.log('\n🔬 Testing batch delete preview...');

  try {
    await cleanupTestEnv();
    await setupTestEnv();
    const todos = await createTestTodos();

    // Preview batch delete by IDs
    const idsToDelete = [todos[0].id, todos[2].id];
    const previewResult = await todoCore.previewBatchDelete(idsToDelete, { useIndex: false });

    logTest('Preview should succeed', previewResult.success);
    logTest('Preview should be marked as dry run', previewResult.dryRun === true);
    logTest('Preview should show correct count', previewResult.count === 2);
    logTest('Preview should include todos to be deleted',
      previewResult.toBeDeleted.length === 2);

    // Verify no actual deletion occurred
    const remainingTodos = await todoCore.listTodos();
    logTest('Preview should not delete any todos', remainingTodos.length === todos.length);

    // Preview batch delete by indices
    const indicesToDelete = [1, 3];
    const indexPreviewResult = await todoCore.previewBatchDelete(indicesToDelete, { useIndex: true });

    logTest('Index preview should succeed', indexPreviewResult.success);
    logTest('Index preview should show correct count', indexPreviewResult.count === 2);

  } catch (error) {
    logTest('Batch delete preview', false, error);
  }
}

// Test error handling and validation
async function testErrorHandling() {
  console.log('\n🔬 Testing error handling and validation...');

  try {
    await cleanupTestEnv();
    await setupTestEnv();
    const todos = await createTestTodos();

    // Test empty identifiers array
    const emptyResult = await todoCore.batchDeleteTodos([], { useIndex: false });
    logTest('Empty identifiers should fail', !emptyResult.success);

    // Test invalid identifiers array
    const invalidResult = await todoCore.batchDeleteTodos(null, { useIndex: false });
    logTest('Null identifiers should fail', !invalidResult.success);

    // Test non-existent IDs
    const nonExistentIds = [999, 1000, 1001];
    const nonExistentResult = await todoCore.batchDeleteTodos(nonExistentIds, { useIndex: false });
    logTest('Non-existent IDs should fail gracefully', !nonExistentResult.success);
    logTest('Should report not found items',
      nonExistentResult.notFound && nonExistentResult.notFound.length > 0);

    // Test out of range indices
    const outOfRangeIndices = [10, 20, 30];
    const outOfRangeResult = await todoCore.batchDeleteTodos(outOfRangeIndices, { useIndex: true });
    logTest('Out of range indices should fail gracefully', !outOfRangeResult.success);

    // Test mixed valid and invalid identifiers
    const mixedIds = [todos[0].id, 999, todos[1].id];
    const mixedResult = await todoCore.previewBatchDelete(mixedIds, { useIndex: false });
    logTest('Mixed valid/invalid IDs should partially succeed', mixedResult.success);
    logTest('Should find valid todos', mixedResult.found === 2);
    logTest('Should report errors', mixedResult.notFound && mixedResult.notFound.length === 1);

  } catch (error) {
    logTest('Error handling tests', false, error);
  }
}

// Test duplicate handling
async function testDuplicateHandling() {
  console.log('\n🔬 Testing duplicate identifier handling...');

  try {
    await cleanupTestEnv();
    await setupTestEnv();
    const todos = await createTestTodos();

    // Test duplicate IDs
    const duplicateIds = [todos[0].id, todos[1].id, todos[0].id, todos[1].id];
    const result = await todoCore.batchDeleteTodos(duplicateIds, { useIndex: false });

    logTest('Duplicate IDs should succeed', result.success);
    logTest('Should delete each todo only once', result.count === 2);

    // Verify only unique todos were deleted
    const remainingTodos = await todoCore.listTodos();
    const deletedIds = [todos[0].id, todos[1].id];
    const remainingIds = remainingTodos.map(t => t.id);
    logTest('Should not find deleted todos in remaining list',
      !deletedIds.some(id => remainingIds.includes(id)));

  } catch (error) {
    logTest('Duplicate handling tests', false, error);
  }
}

// Test large batch operations
async function testLargeBatchOperations() {
  console.log('\n🔬 Testing large batch operations...');

  try {
    await cleanupTestEnv();
    await setupTestEnv();

    // Create a larger number of test todos
    const largeTodos = [];
    for (let i = 1; i <= 20; i++) {
      const result = await todoCore.addTodo(`Large test todo ${i}`);
      assert(result.success);
      largeTodos.push(result.todo);
    }

    // Delete all even-numbered todos by ID (10 todos)
    const evenIds = largeTodos.filter((_, index) => (index + 1) % 2 === 0).map(t => t.id);
    const result = await todoCore.batchDeleteTodos(evenIds, { useIndex: false });

    logTest('Large batch delete should succeed', result.success);
    logTest('Should delete correct number of todos', result.count === 10);
    logTest('Should have correct remaining count', result.remaining === 10);

    // Verify performance (should complete quickly)
    const startTime = Date.now();
    await todoCore.previewBatchDelete(evenIds.slice(0, 5), { useIndex: false });
    const endTime = Date.now();
    logTest('Large batch preview should be fast', (endTime - startTime) < 1000);

  } catch (error) {
    logTest('Large batch operations tests', false, error);
  }
}

// Test edge cases
async function testEdgeCases() {
  console.log('\n🔬 Testing edge cases...');

  try {
    await cleanupTestEnv();
    await setupTestEnv();

    // Test batch delete with empty todo list
    const emptyListResult = await todoCore.batchDeleteTodos([1, 2, 3], { useIndex: false });
    logTest('Batch delete on empty list should fail gracefully', !emptyListResult.success);

    // Create single todo
    const singleResult = await todoCore.addTodo('Single todo');
    assert(singleResult.success);

    // Test batch delete with single item by ID
    const singleIdResult = await todoCore.batchDeleteTodos([singleResult.todo.id], { useIndex: false });
    logTest('Single ID batch delete should work', singleIdResult.success);
    logTest('Should delete the single todo', singleIdResult.count === 1);

    // Test batch delete with single item by index (recreate todo first)
    const singleResult2 = await todoCore.addTodo('Another single todo');
    assert(singleResult2.success);

    const singleIndexResult = await todoCore.batchDeleteTodos([1], { useIndex: true });
    logTest('Single index batch delete should work', singleIndexResult.success);
    logTest('Should delete by index correctly', singleIndexResult.count === 1);

  } catch (error) {
    logTest('Edge cases tests', false, error);
  }
}

// Test storage consistency
async function testStorageConsistency() {
  console.log('\n🔬 Testing storage consistency...');

  try {
    await cleanupTestEnv();
    await setupTestEnv();
    const todos = await createTestTodos();

    // Perform batch delete
    const idsToDelete = [todos[0].id, todos[2].id, todos[4].id];
    const result = await todoCore.batchDeleteTodos(idsToDelete, { useIndex: false });

    logTest('Batch delete should save to storage', result.success);
    logTest('Storage metadata should be present', result.storage && result.storage.saved);

    // Reload TodoCore and verify persistence
    await todoCore.close();
    const newTodoCore = new TodoCoreEnhanced(todoCore.config, null, 'json-file');
    await newTodoCore.initialize();

    const reloadedTodos = await newTodoCore.listTodos();
    logTest('Deleted todos should not persist after reload',
      !idsToDelete.some(id => reloadedTodos.find(t => t.id === id)));
    logTest('Remaining todos should persist after reload',
      reloadedTodos.length === todos.length - 3);

    await newTodoCore.close();

  } catch (error) {
    logTest('Storage consistency tests', false, error);
  }
}

// Main test runner
async function runTests() {
  console.log('🧪 Starting Batch Delete Functionality Tests');
  console.log('='.repeat(50));

  try {
    await setupTestEnv();

    // Run all test suites
    await testBatchDeleteByIds();
    await testBatchDeleteByIndices();
    await testBatchDeletePreview();
    await testErrorHandling();
    await testDuplicateHandling();
    await testLargeBatchOperations();
    await testEdgeCases();
    await testStorageConsistency();

  } catch (error) {
    console.error('💥 Test setup failed:', error.message);
  } finally {
    await cleanupTestEnv();
  }

  // Summary
  console.log('\n📊 Test Results Summary');
  console.log('='.repeat(50));

  const totalTests = testResults.length;
  const passedTests = testResults.filter(t => t.passed).length;
  const failedTests = totalTests - passedTests;

  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ✅ ${passedTests}`);
  console.log(`Failed: ❌ ${failedTests}`);

  if (failedTests > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.filter(t => !t.passed).forEach(test => {
      console.log(`  - ${test.testName}: ${test.error?.message || 'Unknown error'}`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed! Batch delete functionality is working correctly.');
    process.exit(0);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('💥 Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = { runTests };