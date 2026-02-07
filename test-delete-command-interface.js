#!/usr/bin/env node

/**
 * Test file for the enhanced Delete Command Interface
 * Tests all the new functionality and improvements
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { TodoCoreEnhanced } = require('./todo-core-enhanced');
const { StorageConfig } = require('./storage-config');
const { DeleteCommandInterface } = require('./delete-command-interface');

// Test configuration
const TEST_DIR = path.join(os.tmpdir(), `delete-interface-test-${Date.now()}`);
let todoCore = null;
let deleteInterface = null;

/**
 * Setup test environment
 */
async function setupTest() {
  // Create temporary test directory
  await fs.promises.mkdir(TEST_DIR, { recursive: true });

  // Create storage configuration for test
  const storageConfig = new StorageConfig({
    dataDir: TEST_DIR,
    dataFile: 'test-todos.json',
    enableLogging: false,
    backupRetention: 2
  });

  // Initialize todo core
  todoCore = new TodoCoreEnhanced(storageConfig, null, 'json-file');
  await todoCore.initialize();

  // Initialize delete interface
  deleteInterface = new DeleteCommandInterface(todoCore);

  console.log('🧪 Test environment set up successfully');
}

/**
 * Create test todos for testing
 */
async function createTestTodos() {
  const testTodos = [
    { description: 'First test todo', priority: 'high' },
    { description: 'Second test todo', priority: 'medium', completed: true },
    { description: 'Third test todo', priority: 'low' },
    { description: 'Fourth test todo', completed: true },
    { description: 'Fifth test todo' }
  ];

  for (const todo of testTodos) {
    await todoCore.addTodo(todo.description);
    if (todo.completed) {
      const todos = await todoCore.listTodos();
      const lastTodo = todos[todos.length - 1];
      await todoCore.updateTodo(lastTodo.id, { completed: true });
    }
  }

  console.log('✅ Test todos created');
}

/**
 * Test single delete functionality
 */
async function testSingleDelete() {
  console.log('\n🔬 Testing single delete functionality...');

  // Test 1: Delete by ID with valid ID
  console.log('Test 1: Delete by ID');
  let result = await deleteInterface.executeCommand('delete', ['1'], { force: true });
  if (result.success) {
    console.log('✅ PASS - Delete by ID with valid ID');
  } else {
    console.log('❌ FAIL - Delete by ID with valid ID');
  }

  // Test 2: Delete by index
  console.log('Test 2: Delete by index');
  result = await deleteInterface.executeCommand('delete', ['1'], { useIndex: true, force: true });
  if (result.success) {
    console.log('✅ PASS - Delete by index');
  } else {
    console.log('❌ FAIL - Delete by index');
  }

  // Test 3: Invalid ID format
  console.log('Test 3: Invalid ID format');
  result = await deleteInterface.executeCommand('delete', ['abc'], { force: true });
  if (!result.success) {
    console.log('✅ PASS - Invalid ID format correctly rejected');
  } else {
    console.log('❌ FAIL - Invalid ID format should be rejected');
  }

  // Test 4: Missing identifier
  console.log('Test 4: Missing identifier');
  result = await deleteInterface.executeCommand('delete', [], { force: true });
  if (!result.success) {
    console.log('✅ PASS - Missing identifier correctly rejected');
  } else {
    console.log('❌ FAIL - Missing identifier should be rejected');
  }

  // Test 5: Non-existent ID
  console.log('Test 5: Non-existent ID');
  result = await deleteInterface.executeCommand('delete', ['999'], { force: true });
  if (!result.success) {
    console.log('✅ PASS - Non-existent ID correctly handled');
  } else {
    console.log('❌ FAIL - Non-existent ID should fail');
  }
}

/**
 * Test batch delete functionality
 */
async function testBatchDelete() {
  console.log('\n🔬 Testing batch delete functionality...');

  // Re-create some todos for batch testing
  await createTestTodos();

  // Test 1: Batch delete by IDs
  console.log('Test 1: Batch delete by IDs');

  // Get current todos to use valid IDs
  const currentTodos = await todoCore.listTodos();
  const validIds = currentTodos.slice(0, 2).map(todo => todo.id.toString()); // Get first 2 todo IDs

  let result = await deleteInterface.executeCommand('batch-delete', validIds, { force: true });
  if (result.success && result.count === 2) {
    console.log('✅ PASS - Batch delete by IDs');
  } else {
    console.log('❌ FAIL - Batch delete by IDs failed');
  }

  // Test 2: Empty identifiers
  console.log('Test 2: Empty identifiers');
  result = await deleteInterface.executeCommand('batch-delete', [], { force: true });
  if (!result.success) {
    console.log('✅ PASS - Empty identifiers correctly rejected');
  } else {
    console.log('❌ FAIL - Empty identifiers should be rejected');
  }

  // Test 3: Mixed valid/invalid IDs
  console.log('Test 3: Mixed valid/invalid IDs');
  result = await deleteInterface.executeCommand('batch-delete', ['2', 'abc', '4'], { force: true });
  if (!result.success) {
    console.log('✅ PASS - Mixed valid/invalid IDs correctly handled');
  } else {
    console.log('❌ FAIL - Mixed valid/invalid IDs should be handled');
  }
}

/**
 * Test clean and clear functionality
 */
async function testCleanAndClear() {
  console.log('\n🔬 Testing clean and clear functionality...');

  // Re-create todos with some completed
  await createTestTodos();

  // Test 1: Clean completed todos
  console.log('Test 1: Clean completed todos');
  let result = await deleteInterface.executeCommand('clean', [], { force: true });
  if (result.success) {
    const remaining = await todoCore.listTodos();
    const completedRemaining = remaining.filter(t => t.completed).length;
    if (completedRemaining === 0) {
      console.log('✅ PASS - Clean completed todos');
    } else {
      console.log('❌ FAIL - Some completed todos still remain');
    }
  } else {
    console.log('❌ FAIL - Clean operation failed');
  }

  // Test 2: Clear all todos
  console.log('Test 2: Clear all todos');
  result = await deleteInterface.executeCommand('clear', [], { force: true });
  if (result.success) {
    const remaining = await todoCore.listTodos();
    if (remaining.length === 0) {
      console.log('✅ PASS - Clear all todos');
    } else {
      console.log('❌ FAIL - Some todos still remain after clear');
    }
  } else {
    console.log('❌ FAIL - Clear operation failed');
  }

  // Test 3: Clean when no completed todos exist
  // Clear existing todos first
  await deleteInterface.executeCommand('clear', [], { force: true });

  // Create new todos and mark all as incomplete
  await createTestTodos();
  const todos = await todoCore.listTodos();
  for (const todo of todos) {
    await todoCore.updateTodo(todo.id, { completed: false });
  }

  console.log('Test 3: Clean when no completed todos');
  result = await deleteInterface.executeCommand('clean', [], { force: true });
  if (result.success && result.count === 0) {
    console.log('✅ PASS - Clean with no completed todos');
  } else {
    console.log('❌ FAIL - Clean should succeed with 0 count when no completed todos');
  }
}

/**
 * Test command aliases and suggestions
 */
async function testCommandAliases() {
  console.log('\n🔬 Testing command aliases and suggestions...');

  // Re-create test todos
  await createTestTodos();

  // Test 1: Delete aliases (del, remove, rm)
  console.log('Test 1: Delete aliases');
  const aliases = ['del', 'remove', 'rm'];
  let passCount = 0;

  for (const alias of aliases) {
    // Get current todos to find a valid ID
    const todos = await todoCore.listTodos();
    const validId = todos.length > 0 ? todos[0].id.toString() : null;

    if (validId) {
      const result = await deleteInterface.executeCommand(alias, [validId], { force: true });
      if (result.success) {
        passCount++;
        console.log(`✅ PASS - Alias "${alias}" works`);
      } else {
        console.log(`❌ FAIL - Alias "${alias}" failed`);
      }
    } else {
      console.log(`❌ FAIL - Alias "${alias}" failed - no todos to delete`);
    }

    // Re-create a todo for next test
    await todoCore.addTodo(`Test todo for ${alias}`);
  }

  // Test 2: Unknown command suggestions
  console.log('Test 2: Unknown command suggestions');
  const result = await deleteInterface.executeCommand('deleet', ['1'], { force: true });
  if (!result.success) {
    console.log('✅ PASS - Unknown command correctly handled with suggestions');
  } else {
    console.log('❌ FAIL - Unknown command should be rejected');
  }
}

/**
 * Test error handling and edge cases
 */
async function testErrorHandling() {
  console.log('\n🔬 Testing error handling and edge cases...');

  // Test 1: Empty todo list operations
  await deleteInterface.executeCommand('clear', [], { force: true });

  console.log('Test 1: Operations on empty list');
  let result = await deleteInterface.executeCommand('delete', ['1'], { force: true });
  if (!result.success) {
    console.log('✅ PASS - Delete on empty list handled correctly');
  } else {
    console.log('❌ FAIL - Delete on empty list should fail');
  }

  result = await deleteInterface.executeCommand('clean', [], { force: true });
  if (result.success && result.count === 0) {
    console.log('✅ PASS - Clean on empty list handled correctly');
  } else {
    console.log('❌ FAIL - Clean on empty list should succeed with 0 count');
  }

  // Test 2: Large batch operations
  console.log('Test 2: Large batch operations');
  // Create many todos
  for (let i = 1; i <= 20; i++) {
    await todoCore.addTodo(`Todo ${i}`);
  }

  // Get actual IDs of the first 15 todos
  const allTodos = await todoCore.listTodos();
  const manyIds = allTodos.slice(0, 15).map(todo => todo.id.toString());

  result = await deleteInterface.executeCommand('batch-delete', manyIds, { force: true });
  if (result.success && result.count === 15) {
    console.log('✅ PASS - Large batch delete handled correctly');
  } else {
    console.log('❌ FAIL - Large batch delete failed');
  }
}

/**
 * Cleanup test environment
 */
async function cleanup() {
  try {
    await fs.promises.rm(TEST_DIR, { recursive: true, force: true });
    console.log('🧹 Test environment cleaned up');
  } catch (error) {
    console.log('⚠️  Failed to clean up test environment:', error.message);
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('🧪 STARTING DELETE COMMAND INTERFACE TESTS');
  console.log('============================================\n');

  try {
    await setupTest();
    await createTestTodos();

    await testSingleDelete();
    await testBatchDelete();
    await testCleanAndClear();
    await testCommandAliases();
    await testErrorHandling();

    console.log('\n✅ All delete command interface tests completed!');

  } catch (error) {
    console.log('\n❌ Test suite failed with error:', error.message);
    console.log(error.stack);
  } finally {
    await cleanup();
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests();
}

module.exports = { runTests };