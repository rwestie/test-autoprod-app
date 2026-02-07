const assert = require('assert');
const fs = require('fs');
const { TodoCore } = require('./todo-core');

// Test file path
const TEST_DATA_FILE = './test-archive-data.json';

// Clean up test data before and after tests
function cleanupTestData() {
  if (fs.existsSync(TEST_DATA_FILE)) {
    fs.unlinkSync(TEST_DATA_FILE);
  }
}

function runArchiveTests() {
  console.log('🧪 Running archive functionality tests...');

  let testCount = 0;
  let passedCount = 0;

  function runTest(testName, testFn) {
    testCount++;
    try {
      testFn();
      console.log(`  ✅ ${testName}`);
      passedCount++;
    } catch (error) {
      console.log(`  ❌ ${testName}: ${error.message}`);
    }
  }

  // Setup fresh test environment
  cleanupTestData();
  const todoCore = new TodoCore(TEST_DATA_FILE);

  // Test 1: Archive a todo
  runTest('Archive a todo', () => {
    const addResult = todoCore.addTodo('Test todo for archiving');
    assert(addResult.success, 'Failed to add todo');
    assert.strictEqual(addResult.todo.archived, false, 'New todo should not be archived');

    const archiveResult = todoCore.archiveTodo(addResult.todo.id);
    assert(archiveResult.success, 'Failed to archive todo');
    assert.strictEqual(archiveResult.todo.archived, true, 'Todo should be archived');
    assert(archiveResult.todo.archivedAt, 'Archived todo should have archivedAt timestamp');
  });

  // Test 2: Archive already archived todo
  runTest('Archive already archived todo', () => {
    const addResult = todoCore.addTodo('Already archived todo');
    todoCore.archiveTodo(addResult.todo.id);

    const archiveResult = todoCore.archiveTodo(addResult.todo.id);
    assert(archiveResult.success, 'Should succeed when archiving already archived todo');
    assert(archiveResult.message, 'Should return message when todo is already archived');
  });

  // Test 3: Archive invalid todo ID
  runTest('Archive invalid todo ID', () => {
    const result = todoCore.archiveTodo(999);
    assert(!result.success, 'Should fail for non-existent todo');
    assert(result.error, 'Should return error message');
  });

  // Test 4: Archive with invalid ID format
  runTest('Archive with invalid ID format', () => {
    const result = todoCore.archiveTodo('abc');
    assert(!result.success, 'Should fail for invalid ID format');
    assert(result.error, 'Should return error message');
  });

  // Test 5: Unarchive a todo
  runTest('Unarchive a todo', () => {
    const addResult = todoCore.addTodo('Test todo for unarchiving');
    todoCore.archiveTodo(addResult.todo.id);

    const unarchiveResult = todoCore.unarchiveTodo(addResult.todo.id);
    assert(unarchiveResult.success, 'Failed to unarchive todo');
    assert.strictEqual(unarchiveResult.todo.archived, false, 'Todo should not be archived');
    assert(!unarchiveResult.todo.archivedAt, 'Unarchived todo should not have archivedAt timestamp');
  });

  // Test 6: Unarchive non-archived todo
  runTest('Unarchive non-archived todo', () => {
    const addResult = todoCore.addTodo('Non-archived todo');

    const unarchiveResult = todoCore.unarchiveTodo(addResult.todo.id);
    assert(unarchiveResult.success, 'Should succeed when unarchiving non-archived todo');
    assert(unarchiveResult.message, 'Should return message when todo is not archived');
  });

  // Test 7: Unarchive invalid todo ID
  runTest('Unarchive invalid todo ID', () => {
    const result = todoCore.unarchiveTodo(999);
    assert(!result.success, 'Should fail for non-existent todo');
    assert(result.error, 'Should return error message');
  });

  // Test 8: List todos with archive filtering
  runTest('List todos with archive filtering', () => {
    cleanupTestData();
    const todoCore2 = new TodoCore(TEST_DATA_FILE);

    // Add some todos
    const todo1 = todoCore2.addTodo('Active todo 1');
    const todo2 = todoCore2.addTodo('Active todo 2');
    const todo3 = todoCore2.addTodo('Todo to archive');

    // Archive one todo
    todoCore2.archiveTodo(todo3.todo.id);

    // Test default listing (includes all)
    const allTodos = todoCore2.listTodos();
    assert.strictEqual(allTodos.length, 3, 'Should return all todos by default');

    // Test excluding archived
    const activeTodos = todoCore2.listTodos({ includeArchived: false });
    assert.strictEqual(activeTodos.length, 2, 'Should return only active todos');

    // Test archived only
    const archivedTodos = todoCore2.listTodos({ archivedOnly: true });
    assert.strictEqual(archivedTodos.length, 1, 'Should return only archived todos');
    assert.strictEqual(archivedTodos[0].archived, true, 'Returned todo should be archived');
  });

  // Test 9: Archive completed todo
  runTest('Archive completed todo', () => {
    const addResult = todoCore.addTodo('Todo to complete and archive');
    todoCore.completeTodo(addResult.todo.id);

    const archiveResult = todoCore.archiveTodo(addResult.todo.id);
    assert(archiveResult.success, 'Should be able to archive completed todo');
    assert.strictEqual(archiveResult.todo.completed, true, 'Archived todo should remain completed');
    assert.strictEqual(archiveResult.todo.archived, true, 'Todo should be archived');
  });

  // Test 10: Data persistence for archived todos
  runTest('Data persistence for archived todos', () => {
    cleanupTestData();
    const todoCore1 = new TodoCore(TEST_DATA_FILE);

    const addResult = todoCore1.addTodo('Persistent archived todo');
    const archiveResult = todoCore1.archiveTodo(addResult.todo.id);
    assert(archiveResult.success, 'Failed to archive todo');

    // Create new instance to test persistence
    const todoCore2 = new TodoCore(TEST_DATA_FILE);
    const todos = todoCore2.listTodos();

    assert.strictEqual(todos.length, 1, 'Should load archived todo from file');
    assert.strictEqual(todos[0].archived, true, 'Loaded todo should be archived');
    assert.strictEqual(todos[0].description, 'Persistent archived todo', 'Todo description should match');
  });

  // Clean up
  cleanupTestData();

  // Report results
  console.log(`📊 Archive tests: ${passedCount}/${testCount} passed`);

  if (passedCount === testCount) {
    console.log('🎉 All archive tests passed!');
    return true;
  } else {
    console.log('❌ Some archive tests failed!');
    return false;
  }
}

module.exports = { runArchiveTests };