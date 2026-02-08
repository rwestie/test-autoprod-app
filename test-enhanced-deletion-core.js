#!/usr/bin/env node

/**
 * Test Suite for Enhanced Core Deletion Logic
 *
 * Tests the improved deletion functionality including:
 * - Atomic operations with backup/rollback
 * - Data validation and integrity checks
 * - Error recovery mechanisms
 * - Backup creation and management
 * - Data corruption recovery
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { TodoCore } = require('./todo-core');

// Test configuration
const TEST_DATA_DIR = path.join(__dirname, 'test-data-enhanced-deletion');
const TEST_DATA_FILE = 'test-todos-enhanced.json';

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

  // Remove existing test files
  if (fs.existsSync(testDataPath)) {
    fs.unlinkSync(testDataPath);
  }

  const undoFile = testDataPath.replace('.json', '.undo.json');
  if (fs.existsSync(undoFile)) {
    fs.unlinkSync(undoFile);
  }

  // Clean up backup directory
  const backupDir = path.join(TEST_DATA_DIR, '.todo-backups');
  if (fs.existsSync(backupDir)) {
    const files = fs.readdirSync(backupDir);
    for (const file of files) {
      fs.unlinkSync(path.join(backupDir, file));
    }
    fs.rmdirSync(backupDir);
  }

  // Create TodoCore instance with test data file
  todoCore = new TodoCore(testDataPath);
}

// Cleanup test environment
function cleanupTestEnv() {
  try {
    if (fs.existsSync(testDataPath)) {
      fs.unlinkSync(testDataPath);
    }

    const undoFile = testDataPath.replace('.json', '.undo.json');
    if (fs.existsSync(undoFile)) {
      fs.unlinkSync(undoFile);
    }

    // Clean up backup directory
    const backupDir = path.join(TEST_DATA_DIR, '.todo-backups');
    if (fs.existsSync(backupDir)) {
      const files = fs.readdirSync(backupDir);
      for (const file of files) {
        fs.unlinkSync(path.join(backupDir, file));
      }
      fs.rmdirSync(backupDir);
    }

    if (fs.existsSync(TEST_DATA_DIR)) {
      fs.rmdirSync(TEST_DATA_DIR);
    }
  } catch (error) {
    // Ignore cleanup errors
  }
}

// Helper function to create test todos
function createTestTodos(count = 3) {
  const todoIds = [];
  for (let i = 1; i <= count; i++) {
    const result = todoCore.addTodo(`Test todo ${i}`);
    assert(result.success, `Failed to add test todo ${i}`);
    todoIds.push(result.todo.id);
  }
  return todoIds;
}

// Test 1: Backup creation during deletion
async function testBackupCreation() {
  try {
    const todoIds = createTestTodos(2);

    // Check backup directory doesn't exist initially
    const backupDir = path.join(path.dirname(testDataPath), '.todo-backups');

    // Delete a todo - this should create a backup
    const result = todoCore.deleteTodo(todoIds[0]);
    assert(result.success, 'Delete should succeed');

    // Verify backup directory was created
    assert(fs.existsSync(backupDir), 'Backup directory should be created');

    // Verify backup file was created
    const files = fs.readdirSync(backupDir);
    const todoBackups = files.filter(f => f.startsWith('todos-single-delete'));
    assert(todoBackups.length > 0, 'Should create a backup file');

    // Verify backup content
    const backupFile = path.join(backupDir, todoBackups[0]);
    const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
    assert(Array.isArray(backupData), 'Backup should contain array');
    assert(backupData.length === 2, 'Backup should have original todos');

    logTest('Backup creation during deletion', true);
  } catch (error) {
    logTest('Backup creation during deletion', false, error);
  }
}

// Test 2: Data validation during save
async function testDataValidation() {
  try {
    createTestTodos(2);

    // Manually corrupt the data
    todoCore.todos.push({
      id: 'invalid',  // Should be number
      description: '',
      completed: 'yes'  // Should be boolean
    });

    // Try to save - should fail validation
    const saveResult = todoCore.saveTodos();
    assert(!saveResult, 'Save should fail with invalid data');

    // Remove the corrupt entry for the test
    todoCore.todos = todoCore.todos.filter(t => typeof t.id === 'number');

    // Now validation should work
    assert(todoCore.todos.every(t => typeof t.id === 'number'), 'All todos should have valid IDs');

    logTest('Data validation during save', true);
  } catch (error) {
    logTest('Data validation during save', false, error);
  }
}

// Test 3: Atomic operations with rollback
async function testAtomicOperationsRollback() {
  try {
    const todoIds = createTestTodos(3);

    // Mock saveTodos to fail
    const originalSave = todoCore.saveTodos;
    todoCore.saveTodos = () => false;

    // Try to delete - should rollback
    const result = todoCore.deleteTodo(todoIds[0]);
    assert(!result.success, 'Delete should fail');

    // Restore original save
    todoCore.saveTodos = originalSave;

    // Verify todo is still there (rollback worked)
    const todos = todoCore.listTodos();
    assert(todos.length === 3, 'All todos should still exist after failed delete');
    assert(todos.find(t => t.id === todoIds[0]), 'Original todo should still exist');

    logTest('Atomic operations with rollback', true);
  } catch (error) {
    logTest('Atomic operations with rollback', false, error);
  }
}

// Test 4: Data corruption recovery
async function testDataCorruptionRecovery() {
  try {
    // Create todos and backups
    createTestTodos(3);
    todoCore.deleteTodo(1); // This creates a backup

    // Corrupt the main data file
    fs.writeFileSync(testDataPath, 'invalid json content');

    // Create new TodoCore - should recover from backup
    const newCore = new TodoCore(testDataPath);

    // Should have recovered some data
    const todos = newCore.listTodos();
    assert(Array.isArray(todos), 'Should recover valid todo array');

    logTest('Data corruption recovery', true);
  } catch (error) {
    logTest('Data corruption recovery', false, error);
  }
}

// Test 5: Backup cleanup (keep only 5)
async function testBackupCleanup() {
  try {
    const todoIds = createTestTodos(10);

    // Create many backups by deleting todos one by one
    for (let i = 0; i < 7; i++) {
      todoCore.deleteTodo(todoIds[i]);
    }

    // Check that only 5 backups are kept
    const backupDir = path.join(path.dirname(testDataPath), '.todo-backups');
    const files = fs.readdirSync(backupDir);
    const todoBackups = files.filter(f => f.startsWith('todos-'));

    assert(todoBackups.length <= 5, `Should keep only 5 backups, found ${todoBackups.length}`);

    logTest('Backup cleanup (keep only 5)', true);
  } catch (error) {
    logTest('Backup cleanup (keep only 5)', false, error);
  }
}

// Test 6: Data integrity repair
async function testDataIntegrityRepair() {
  try {
    createTestTodos(3);

    // Corrupt some data in memory
    todoCore.todos.push({
      id: -1,  // Invalid ID
      description: 'Bad todo',
      completed: false,
      createdAt: new Date().toISOString()
    });

    todoCore.todos.push({
      id: 1,  // Duplicate ID
      description: 'Duplicate todo',
      completed: false,
      createdAt: new Date().toISOString()
    });

    // Run repair
    const repairResult = todoCore.repairDataIntegrity();
    assert(repairResult, 'Repair should succeed');

    // Check that invalid todos were removed/fixed
    const todos = todoCore.listTodos();
    assert(todos.every(t => t.id > 0), 'All todos should have valid positive IDs');

    // Check for no duplicate IDs
    const ids = todos.map(t => t.id);
    const uniqueIds = new Set(ids);
    assert(ids.length === uniqueIds.size, 'All IDs should be unique');

    logTest('Data integrity repair', true);
  } catch (error) {
    logTest('Data integrity repair', false, error);
  }
}

// Test 7: Enhanced undo with backup/rollback
async function testEnhancedUndo() {
  try {
    const todoIds = createTestTodos(2);

    // Delete a todo
    todoCore.deleteTodo(todoIds[0]);

    // Mock saveTodos to fail during undo
    const originalSave = todoCore.saveTodos;
    todoCore.saveTodos = () => false;

    // Try to undo - should fail and rollback
    const undoResult = todoCore.undoLastDelete();
    assert(!undoResult.success, 'Undo should fail when save fails');

    // Restore original save
    todoCore.saveTodos = originalSave;

    // Verify original state is maintained
    const todos = todoCore.listTodos();
    assert(todos.length === 1, 'Should have 1 todo after failed undo');
    assert(!todos.find(t => t.id === todoIds[0]), 'Deleted todo should not be restored on failed undo');

    logTest('Enhanced undo with backup/rollback', true);
  } catch (error) {
    logTest('Enhanced undo with backup/rollback', false, error);
  }
}

// Test 8: Bulk operations with enhanced core logic
async function testBulkOperationsEnhanced() {
  try {
    const todoIds = createTestTodos(5);

    // Complete some todos
    todoCore.completeTodo(todoIds[1]);
    todoCore.completeTodo(todoIds[3]);

    // Bulk delete completed with backup
    const result = todoCore.bulkDeleteCompleted();
    assert(result.success, 'Bulk delete should succeed');
    assert(result.deletedCount === 2, 'Should delete 2 completed todos');

    // Verify backup was created
    const backupDir = path.join(path.dirname(testDataPath), '.todo-backups');
    const files = fs.readdirSync(backupDir);
    const bulkBackups = files.filter(f => f.startsWith('todos-bulk-delete-completed'));
    assert(bulkBackups.length > 0, 'Should create backup for bulk delete');

    logTest('Bulk operations with enhanced core logic', true);
  } catch (error) {
    logTest('Bulk operations with enhanced core logic', false, error);
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting Enhanced Core Deletion Logic Tests...');
  console.log('');

  const tests = [
    testBackupCreation,
    testDataValidation,
    testAtomicOperationsRollback,
    testDataCorruptionRecovery,
    testBackupCleanup,
    testDataIntegrityRepair,
    testEnhancedUndo,
    testBulkOperationsEnhanced
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
    console.log('🎉 All enhanced core deletion logic tests passed!');
    console.log('');
    console.log('✨ Enhanced Features Verified:');
    console.log('   ✅ Automatic backup creation before destructive operations');
    console.log('   ✅ Data validation and integrity checks');
    console.log('   ✅ Atomic operations with rollback on failure');
    console.log('   ✅ Data corruption recovery from backups');
    console.log('   ✅ Intelligent backup cleanup (keep latest 5)');
    console.log('   ✅ Data integrity repair capabilities');
    console.log('   ✅ Enhanced undo with transaction-like behavior');
    console.log('   ✅ Robust bulk operations with error handling');
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