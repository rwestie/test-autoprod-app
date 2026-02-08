const assert = require('assert');
const fs = require('fs');
const { TodoCore } = require('./todo-core');

console.log('🔄 Running undo functionality tests...');
console.log('');

// Test helper function to clean up test data
function cleanupTestData(dataFile) {
  if (fs.existsSync(dataFile)) {
    fs.unlinkSync(dataFile);
  }
}

// Test 1: Basic single todo deletion and undo
function testSingleTodoUndoBasic() {
  console.log('📝 Test 1: Basic single todo deletion and undo');

  const testFile = './test-undo-1.json';
  cleanupTestData(testFile);

  const core = new TodoCore(testFile);

  // Add a todo
  const addResult = core.addTodo('Test todo for deletion');
  assert(addResult.success, 'Should add todo successfully');
  assert.equal(addResult.todo.description, 'Test todo for deletion');

  const todoId = addResult.todo.id;

  // Delete the todo
  const deleteResult = core.deleteTodo(todoId);
  assert(deleteResult.success, 'Should delete todo successfully');
  assert.equal(deleteResult.todo.id, todoId);

  // Verify todo is gone
  const todosAfterDelete = core.listTodos();
  assert.equal(todosAfterDelete.length, 0, 'Should have no todos after deletion');

  // Undo the deletion
  const undoResult = core.undoLastDelete();
  assert(undoResult.success, 'Should undo deletion successfully');
  assert.equal(undoResult.restoredCount, 1, 'Should restore 1 todo');
  assert.equal(undoResult.operation.type, 'single-delete');

  // Verify todo is restored
  const todosAfterUndo = core.listTodos();
  assert.equal(todosAfterUndo.length, 1, 'Should have 1 todo after undo');
  assert.equal(todosAfterUndo[0].description, 'Test todo for deletion');
  assert.equal(todosAfterUndo[0].id, todoId);

  // Try to undo again (should fail)
  const undoResult2 = core.undoLastDelete();
  assert(!undoResult2.success, 'Should not be able to undo twice');
  assert(undoResult2.error.includes('No delete operations to undo'));

  cleanupTestData(testFile);
  console.log('✅ Test 1 passed!');
  console.log('');
}

// Test 2: Bulk delete by IDs and undo
function testBulkDeleteIdsUndo() {
  console.log('📝 Test 2: Bulk delete by IDs and undo');

  const testFile = './test-undo-2.json';
  cleanupTestData(testFile);

  const core = new TodoCore(testFile);

  // Add multiple todos
  const todo1 = core.addTodo('First todo');
  const todo2 = core.addTodo('Second todo');
  const todo3 = core.addTodo('Third todo');
  const todo4 = core.addTodo('Fourth todo');

  assert(todo1.success && todo2.success && todo3.success && todo4.success);

  const ids = [todo1.todo.id, todo3.todo.id, todo4.todo.id];

  // Bulk delete specific todos
  const deleteResult = core.bulkDeleteTodos(ids);
  assert(deleteResult.success, 'Should bulk delete successfully');
  assert.equal(deleteResult.deletedCount, 3, 'Should delete 3 todos');

  // Verify correct todos remain
  const todosAfterDelete = core.listTodos();
  assert.equal(todosAfterDelete.length, 1, 'Should have 1 todo remaining');
  assert.equal(todosAfterDelete[0].description, 'Second todo');

  // Undo the bulk deletion
  const undoResult = core.undoLastDelete();
  assert(undoResult.success, 'Should undo bulk deletion successfully');
  assert.equal(undoResult.restoredCount, 3, 'Should restore 3 todos');
  assert.equal(undoResult.operation.type, 'bulk-delete-ids');

  // Verify all todos are restored
  const todosAfterUndo = core.listTodos();
  assert.equal(todosAfterUndo.length, 4, 'Should have 4 todos after undo');

  // Verify todos are in correct order (sorted by ID)
  todosAfterUndo.forEach((todo, index) => {
    assert.equal(todo.id, index + 1, `Todo ${index + 1} should have ID ${index + 1}`);
  });

  cleanupTestData(testFile);
  console.log('✅ Test 2 passed!');
  console.log('');
}

// Test 3: Bulk delete completed todos and undo
function testBulkDeleteCompletedUndo() {
  console.log('📝 Test 3: Bulk delete completed todos and undo');

  const testFile = './test-undo-3.json';
  cleanupTestData(testFile);

  const core = new TodoCore(testFile);

  // Add multiple todos
  const todo1 = core.addTodo('Pending todo 1');
  const todo2 = core.addTodo('Completed todo 1');
  const todo3 = core.addTodo('Pending todo 2');
  const todo4 = core.addTodo('Completed todo 2');

  // Complete some todos
  core.completeTodo(todo2.todo.id);
  core.completeTodo(todo4.todo.id);

  // Verify initial state
  const initialTodos = core.listTodos();
  assert.equal(initialTodos.length, 4, 'Should have 4 todos initially');
  assert.equal(initialTodos.filter(t => t.completed).length, 2, 'Should have 2 completed todos');

  // Bulk delete completed todos
  const deleteResult = core.bulkDeleteCompleted();
  assert(deleteResult.success, 'Should bulk delete completed todos successfully');
  assert.equal(deleteResult.deletedCount, 2, 'Should delete 2 completed todos');

  // Verify only pending todos remain
  const todosAfterDelete = core.listTodos();
  assert.equal(todosAfterDelete.length, 2, 'Should have 2 todos remaining');
  assert(todosAfterDelete.every(t => !t.completed), 'All remaining todos should be pending');

  // Undo the bulk deletion
  const undoResult = core.undoLastDelete();
  assert(undoResult.success, 'Should undo bulk deletion successfully');
  assert.equal(undoResult.restoredCount, 2, 'Should restore 2 completed todos');
  assert.equal(undoResult.operation.type, 'bulk-delete-completed');

  // Verify all todos are restored
  const todosAfterUndo = core.listTodos();
  assert.equal(todosAfterUndo.length, 4, 'Should have 4 todos after undo');
  assert.equal(todosAfterUndo.filter(t => t.completed).length, 2, 'Should have 2 completed todos again');

  cleanupTestData(testFile);
  console.log('✅ Test 3 passed!');
  console.log('');
}

// Test 4: Bulk delete all todos and undo
function testBulkDeleteAllUndo() {
  console.log('📝 Test 4: Bulk delete all todos and undo');

  const testFile = './test-undo-4.json';
  cleanupTestData(testFile);

  const core = new TodoCore(testFile);

  // Add multiple todos with different states
  core.addTodo('Pending todo 1');
  const todo2 = core.addTodo('Completed todo 1');
  core.addTodo('Pending todo 2');
  const todo4 = core.addTodo('Completed todo 2');

  // Complete some todos
  core.completeTodo(todo2.todo.id);
  core.completeTodo(todo4.todo.id);

  // Verify initial state
  const initialTodos = core.listTodos();
  assert.equal(initialTodos.length, 4, 'Should have 4 todos initially');

  // Bulk delete all todos
  const deleteResult = core.bulkDeleteAll();
  assert(deleteResult.success, 'Should bulk delete all todos successfully');
  assert.equal(deleteResult.deletedCount, 4, 'Should delete 4 todos');

  // Verify no todos remain
  const todosAfterDelete = core.listTodos();
  assert.equal(todosAfterDelete.length, 0, 'Should have no todos remaining');

  // Undo the bulk deletion
  const undoResult = core.undoLastDelete();
  assert(undoResult.success, 'Should undo bulk deletion successfully');
  assert.equal(undoResult.restoredCount, 4, 'Should restore 4 todos');
  assert.equal(undoResult.operation.type, 'bulk-delete-all');

  // Verify all todos are restored
  const todosAfterUndo = core.listTodos();
  assert.equal(todosAfterUndo.length, 4, 'Should have 4 todos after undo');
  assert.equal(todosAfterUndo.filter(t => t.completed).length, 2, 'Should have 2 completed todos');

  cleanupTestData(testFile);
  console.log('✅ Test 4 passed!');
  console.log('');
}

// Test 5: Multiple operations - only last can be undone
function testMultipleOperationsUndo() {
  console.log('📝 Test 5: Multiple operations - only last can be undone');

  const testFile = './test-undo-5.json';
  cleanupTestData(testFile);

  const core = new TodoCore(testFile);

  // Add todos
  const todo1 = core.addTodo('Todo 1');
  const todo2 = core.addTodo('Todo 2');
  const todo3 = core.addTodo('Todo 3');

  // Delete first todo
  core.deleteTodo(todo1.todo.id);

  // Delete second todo
  core.deleteTodo(todo2.todo.id);

  // Only the last delete should be undoable
  const undoResult = core.undoLastDelete();
  assert(undoResult.success, 'Should undo last deletion');
  assert.equal(undoResult.restoredTodos[0].description, 'Todo 2', 'Should restore Todo 2');

  // Verify state - should have Todo 2 and Todo 3, but not Todo 1
  const todos = core.listTodos();
  assert.equal(todos.length, 2, 'Should have 2 todos');
  assert(todos.some(t => t.description === 'Todo 2'), 'Should have Todo 2');
  assert(todos.some(t => t.description === 'Todo 3'), 'Should have Todo 3');
  assert(!todos.some(t => t.description === 'Todo 1'), 'Should not have Todo 1');

  cleanupTestData(testFile);
  console.log('✅ Test 5 passed!');
  console.log('');
}

// Test 6: ID conflicts during undo
function testIdConflictsUndo() {
  console.log('📝 Test 6: ID conflicts during undo');

  const testFile = './test-undo-6.json';
  cleanupTestData(testFile);

  const core = new TodoCore(testFile);

  // Add and delete a todo
  const todo1 = core.addTodo('Original todo');
  const originalId = todo1.todo.id; // Should be 1
  core.deleteTodo(originalId);

  // Add a new todo (will get next ID, not reuse)
  const todo2 = core.addTodo('New todo');
  const newId = todo2.todo.id; // Should be 2

  // Manually add a todo with conflicting ID to test conflict handling
  // We'll directly manipulate the todos array to create a conflict
  core.todos.push({
    id: originalId, // This creates a conflict for undo
    description: 'Conflicting todo',
    completed: false,
    createdAt: new Date().toISOString()
  });

  // Try to undo - should handle ID conflict
  const undoResult = core.undoLastDelete();
  assert(undoResult.success, 'Undo should succeed even with conflicts');
  assert.equal(undoResult.restoredCount, 0, 'Should restore 0 todos due to conflict');
  assert(undoResult.conflictingIds.includes(originalId), 'Should report conflicting ID');

  // Verify the conflicting todo is still there
  const todos = core.listTodos();
  assert.equal(todos.length, 2, 'Should have 2 todos'); // newTodo + conflictingTodo
  assert(todos.some(t => t.description === 'New todo'), 'Should have new todo');
  assert(todos.some(t => t.description === 'Conflicting todo'), 'Should have conflicting todo');

  cleanupTestData(testFile);
  console.log('✅ Test 6 passed!');
  console.log('');
}

// Test 7: Undo history limit
function testUndoHistoryLimit() {
  console.log('📝 Test 7: Undo history limit');

  const testFile = './test-undo-7.json';
  cleanupTestData(testFile);

  const core = new TodoCore(testFile);

  // Add many todos
  const todos = [];
  for (let i = 1; i <= 12; i++) {
    const todo = core.addTodo(`Todo ${i}`);
    todos.push(todo.todo);
  }

  // Delete todos one by one (more than the history limit)
  for (let i = 0; i < 12; i++) {
    core.deleteTodo(todos[i].id);
  }

  // The undo history should be limited (default is 10)
  assert(core.undoHistory.length <= core.maxUndoHistory, 'History should be limited');

  // Should be able to undo the last operation
  const undoResult = core.undoLastDelete();
  assert(undoResult.success, 'Should undo last operation');
  assert.equal(undoResult.restoredTodos[0].description, 'Todo 12');

  cleanupTestData(testFile);
  console.log('✅ Test 7 passed!');
  console.log('');
}

// Test 8: Get last undo operation
function testGetLastUndoOperation() {
  console.log('📝 Test 8: Get last undo operation');

  const testFile = './test-undo-8.json';
  cleanupTestData(testFile);

  const core = new TodoCore(testFile);

  // Initially no operations
  assert.equal(core.getLastUndoOperation(), null, 'Should have no operations initially');

  // Add and delete a todo
  const todo = core.addTodo('Test todo');
  core.deleteTodo(todo.todo.id);

  // Should have an operation now
  const operation = core.getLastUndoOperation();
  assert(operation, 'Should have an operation');
  assert.equal(operation.type, 'single-delete');
  assert.equal(operation.deletedCount, 1);
  assert.equal(operation.deletedTodos[0].description, 'Test todo');
  assert(operation.timestamp, 'Should have timestamp');

  // After undo, should have no operations
  core.undoLastDelete();
  assert.equal(core.getLastUndoOperation(), null, 'Should have no operations after undo');

  cleanupTestData(testFile);
  console.log('✅ Test 8 passed!');
  console.log('');
}

// Test 9: Undo with empty list
function testUndoWithEmptyList() {
  console.log('📝 Test 9: Undo with empty list');

  const testFile = './test-undo-9.json';
  cleanupTestData(testFile);

  const core = new TodoCore(testFile);

  // Try to undo without any operations
  const undoResult = core.undoLastDelete();
  assert(!undoResult.success, 'Should fail to undo with no operations');
  assert(undoResult.error.includes('No delete operations to undo'));

  cleanupTestData(testFile);
  console.log('✅ Test 9 passed!');
  console.log('');
}

// Test 10: Save failure during undo
function testUndoSaveFailure() {
  console.log('📝 Test 10: Save failure during undo (simulated)');

  const testFile = './test-undo-10.json';
  cleanupTestData(testFile);

  const core = new TodoCore(testFile);

  // Add and delete a todo
  const todo = core.addTodo('Test todo');
  core.deleteTodo(todo.todo.id);

  // Simulate save failure by making the file read-only (this is tricky to test reliably)
  // For now, we'll just verify the error handling structure exists
  const originalSave = core.saveTodos;
  core.saveTodos = () => false; // Simulate save failure

  const undoResult = core.undoLastDelete();
  assert(!undoResult.success, 'Should fail when save fails');
  assert(undoResult.error.includes('Failed to save restored todos'));

  // History should be restored
  assert(core.getLastUndoOperation(), 'History should be restored after failed undo');

  // Restore original save function
  core.saveTodos = originalSave;

  cleanupTestData(testFile);
  console.log('✅ Test 10 passed!');
  console.log('');
}

// Run all tests
function runAllTests() {
  try {
    testSingleTodoUndoBasic();
    testBulkDeleteIdsUndo();
    testBulkDeleteCompletedUndo();
    testBulkDeleteAllUndo();
    testMultipleOperationsUndo();
    testIdConflictsUndo();
    testUndoHistoryLimit();
    testGetLastUndoOperation();
    testUndoWithEmptyList();
    testUndoSaveFailure();

    console.log('🎉 All undo functionality tests passed!');
    console.log('');
    console.log('📊 Test Summary:');
    console.log('   ✅ Single todo deletion and undo');
    console.log('   ✅ Bulk delete by IDs and undo');
    console.log('   ✅ Bulk delete completed todos and undo');
    console.log('   ✅ Bulk delete all todos and undo');
    console.log('   ✅ Multiple operations (only last undoable)');
    console.log('   ✅ ID conflicts during undo');
    console.log('   ✅ Undo history limit');
    console.log('   ✅ Get last undo operation');
    console.log('   ✅ Undo with empty list');
    console.log('   ✅ Save failure during undo');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the tests
runAllTests();