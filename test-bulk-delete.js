#!/usr/bin/env node

/**
 * Test Suite for Bulk Delete Functionality
 *
 * Tests the new bulk delete features including:
 * - Bulk delete by multiple IDs
 * - Bulk delete completed todos
 * - Bulk delete all todos
 * - Error handling and validation
 * - CLI integration
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { TodoCore } = require('./todo-core');

// Test configuration
const TEST_DATA_DIR = path.join(__dirname, 'test-data-bulk-delete');
const TEST_DATA_FILE = 'test-todos-bulk.json';

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

  // Create TodoCore instance with test data file
  todoCore = new TodoCore(testDataPath);
}

// Cleanup test environment
function cleanupTestEnv() {
  if (fs.existsSync(testDataPath)) {
    fs.unlinkSync(testDataPath);
  }
  if (fs.existsSync(TEST_DATA_DIR)) {
    fs.rmdirSync(TEST_DATA_DIR);
  }
}

// Helper function to create test todos
function createTestTodos() {
  const descriptions = [
    'First todo',
    'Second todo',
    'Third todo',
    'Fourth todo',
    'Fifth todo'
  ];

  const todoIds = [];
  descriptions.forEach((desc, index) => {
    const result = todoCore.addTodo(desc);
    assert(result.success, `Failed to add test todo: ${desc}`);
    todoIds.push(result.todo.id);

    // Complete some todos
    if (index % 2 === 0) {
      const completeResult = todoCore.completeTodo(result.todo.id);
      assert(completeResult.success, `Failed to complete test todo: ${desc}`);
    }
  });

  return todoIds;
}

// Test 1: Bulk delete by IDs - valid IDs
async function testBulkDeleteByIds() {
  try {
    const todoIds = createTestTodos();
    const idsToDelete = [todoIds[0], todoIds[2]]; // Delete first and third

    const result = todoCore.bulkDeleteTodos(idsToDelete);

    assert(result.success, 'Bulk delete should succeed');
    assert.strictEqual(result.deletedCount, 2, 'Should delete 2 todos');
    assert.strictEqual(result.deletedTodos.length, 2, 'Should return 2 deleted todos');
    assert.strictEqual(result.remainingCount, 3, 'Should have 3 remaining todos');

    // Verify todos were actually deleted
    const remainingTodos = todoCore.listTodos();
    assert.strictEqual(remainingTodos.length, 3, 'Should have 3 remaining todos');
    assert(!remainingTodos.find(t => t.id === todoIds[0]), 'First todo should be deleted');
    assert(!remainingTodos.find(t => t.id === todoIds[2]), 'Third todo should be deleted');

    logTest('Bulk delete by valid IDs', true);
  } catch (error) {
    logTest('Bulk delete by valid IDs', false, error);
  }
}

// Test 2: Bulk delete by IDs - invalid IDs
async function testBulkDeleteInvalidIds() {
  try {
    createTestTodos();

    const result = todoCore.bulkDeleteTodos(['abc', 'xyz']);
    assert(!result.success, 'Bulk delete should fail with invalid IDs');
    assert(result.error.includes('Invalid ID format'), 'Should have invalid ID error');

    logTest('Bulk delete with invalid IDs', true);
  } catch (error) {
    logTest('Bulk delete with invalid IDs', false, error);
  }
}

// Test 3: Bulk delete by IDs - non-existent IDs
async function testBulkDeleteNonExistentIds() {
  try {
    createTestTodos();

    const result = todoCore.bulkDeleteTodos([999, 1000]);
    assert(!result.success, 'Bulk delete should fail with non-existent IDs');
    assert(result.error.includes('No todos found'), 'Should have not found error');

    logTest('Bulk delete with non-existent IDs', true);
  } catch (error) {
    logTest('Bulk delete with non-existent IDs', false, error);
  }
}

// Test 4: Bulk delete by IDs - mixed valid and invalid
async function testBulkDeleteMixedIds() {
  try {
    const todoIds = createTestTodos();
    const mixedIds = [todoIds[0], 999]; // One valid, one invalid

    const result = todoCore.bulkDeleteTodos(mixedIds);
    assert(result.success, 'Bulk delete should succeed for valid IDs');
    assert.strictEqual(result.deletedCount, 1, 'Should delete 1 todo');
    assert.strictEqual(result.notFoundIds.length, 1, 'Should have 1 not found ID');
    assert.strictEqual(result.notFoundIds[0], 999, 'Should report correct not found ID');

    logTest('Bulk delete with mixed valid/invalid IDs', true);
  } catch (error) {
    logTest('Bulk delete with mixed valid/invalid IDs', false, error);
  }
}

// Test 5: Bulk delete completed todos
async function testBulkDeleteCompleted() {
  try {
    createTestTodos(); // This creates todos where even indices are completed

    const result = todoCore.bulkDeleteCompleted();
    assert(result.success, 'Bulk delete completed should succeed');
    assert.strictEqual(result.deletedCount, 3, 'Should delete 3 completed todos'); // 0, 2, 4

    // Verify only incomplete todos remain
    const remainingTodos = todoCore.listTodos();
    assert.strictEqual(remainingTodos.length, 2, 'Should have 2 remaining todos');
    assert(remainingTodos.every(t => !t.completed), 'All remaining todos should be incomplete');

    logTest('Bulk delete completed todos', true);
  } catch (error) {
    logTest('Bulk delete completed todos', false, error);
  }
}

// Test 6: Bulk delete completed todos - none completed
async function testBulkDeleteCompletedNone() {
  try {
    // Create todos but don't complete any
    const todoIds = createTestTodos();
    todoIds.forEach(id => {
      // Make sure all are incomplete
      const todo = todoCore.listTodos().find(t => t.id === id);
      if (todo && todo.completed) {
        todo.completed = false;
        delete todo.completedAt;
      }
    });
    todoCore.saveTodos();

    const result = todoCore.bulkDeleteCompleted();
    assert(!result.success, 'Bulk delete completed should fail when none completed');
    assert(result.error.includes('No completed todos found'), 'Should have no completed error');

    logTest('Bulk delete completed when none exist', true);
  } catch (error) {
    logTest('Bulk delete completed when none exist', false, error);
  }
}

// Test 7: Bulk delete all todos
async function testBulkDeleteAll() {
  try {
    createTestTodos();

    const result = todoCore.bulkDeleteAll();
    assert(result.success, 'Bulk delete all should succeed');
    assert.strictEqual(result.deletedCount, 5, 'Should delete all 5 todos');
    assert.strictEqual(result.remainingCount, 0, 'Should have 0 remaining todos');

    // Verify all todos were deleted
    const remainingTodos = todoCore.listTodos();
    assert.strictEqual(remainingTodos.length, 0, 'Should have no remaining todos');

    logTest('Bulk delete all todos', true);
  } catch (error) {
    logTest('Bulk delete all todos', false, error);
  }
}

// Test 8: Bulk delete all todos - empty list
async function testBulkDeleteAllEmpty() {
  try {
    // Start with empty list
    const result = todoCore.bulkDeleteAll();
    assert(!result.success, 'Bulk delete all should fail with empty list');
    assert(result.error.includes('No todos found'), 'Should have no todos error');

    logTest('Bulk delete all with empty list', true);
  } catch (error) {
    logTest('Bulk delete all with empty list', false, error);
  }
}

// Test 9: Bulk delete with empty IDs array
async function testBulkDeleteEmptyIds() {
  try {
    createTestTodos();

    const result = todoCore.bulkDeleteTodos([]);
    assert(!result.success, 'Bulk delete should fail with empty IDs array');
    assert(result.error.includes('No IDs provided'), 'Should have no IDs error');

    logTest('Bulk delete with empty IDs array', true);
  } catch (error) {
    logTest('Bulk delete with empty IDs array', false, error);
  }
}

// Test 10: File system error handling
async function testFileSystemError() {
  try {
    createTestTodos();

    // Make file read-only to simulate save error
    const todoIds = createTestTodos().slice(0, 2);

    // Mock the saveTodos method to return false
    const originalSaveTodos = todoCore.saveTodos;
    todoCore.saveTodos = () => false;

    const result = todoCore.bulkDeleteTodos(todoIds);
    assert(!result.success, 'Bulk delete should fail on save error');
    assert(result.error.includes('Failed to save'), 'Should have save error');

    // Restore original method
    todoCore.saveTodos = originalSaveTodos;

    logTest('File system error handling', true);
  } catch (error) {
    logTest('File system error handling', false, error);
  }
}

// Run all tests
async function runAllTests() {
  console.log('🧪 Starting Bulk Delete Tests...');
  console.log('');

  const tests = [
    testBulkDeleteByIds,
    testBulkDeleteInvalidIds,
    testBulkDeleteNonExistentIds,
    testBulkDeleteMixedIds,
    testBulkDeleteCompleted,
    testBulkDeleteCompletedNone,
    testBulkDeleteAll,
    testBulkDeleteAllEmpty,
    testBulkDeleteEmptyIds,
    testFileSystemError
  ];

  for (const test of tests) {
    // Setup fresh environment for each test
    await setupTestEnv();
    await test();
    cleanupTestEnv();
  }

  // Print summary
  console.log('');
  console.log('📊 Test Summary:');
  const totalTests = testResults.length;
  const passedTests = testResults.filter(r => r.passed).length;
  const failedTests = totalTests - passedTests;

  console.log(`   Total: ${totalTests}`);
  console.log(`   ✅ Passed: ${passedTests}`);
  console.log(`   ❌ Failed: ${failedTests}`);

  if (failedTests > 0) {
    console.log('');
    console.log('❌ Failed Tests:');
    testResults.filter(r => !r.passed).forEach(result => {
      console.log(`   - ${result.testName}: ${result.error?.message || result.error}`);
    });
    process.exit(1);
  } else {
    console.log('');
    console.log('🎉 All bulk delete tests passed!');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
  });
}

module.exports = {
  runAllTests
};