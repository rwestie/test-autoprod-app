const assert = require("assert");
const fs = require('fs');
const path = require('path');
const { TodoCore } = require('./todo-core');

console.log("Running delete functionality tests...");

// Helper function to create a test instance with a temporary file
function createTestTodoCore() {
  const testFile = path.join(__dirname, `test-todos-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.json`);
  const core = new TodoCore(testFile);

  // Clean up function
  core.cleanup = () => {
    try {
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
    } catch (error) {
      console.warn(`Failed to cleanup test file: ${error.message}`);
    }
  };

  return core;
}

// Test 1: Delete existing todo by ID
function testDeleteById() {
  console.log("  Testing delete by ID...");
  const core = createTestTodoCore();

  // Add some todos
  core.addTodo("First todo");
  core.addTodo("Second todo");
  core.addTodo("Third todo");

  const firstTodo = core.listTodos()[0];
  const initialCount = core.listTodos().length;
  const result = core.deleteTodo(firstTodo.id);

  assert(result.success === true, "Delete by ID should succeed");
  assert(result.todo.id === firstTodo.id, "Should return the deleted todo");
  assert(result.message.includes("Todo deleted successfully"), "Should provide success message");
  assert(core.listTodos().length === initialCount - 1, "Should have one less todo");

  // Verify the specific todo was removed
  const remaining = core.listTodos();
  assert(!remaining.find(t => t.id === firstTodo.id), "Deleted todo should not exist in list");

  core.cleanup();
  console.log("    ✅ Delete by ID test passed");
}

// Test 2: Delete from empty list
function testDeleteFromEmptyList() {
  console.log("  Testing delete from empty list...");
  const core = createTestTodoCore();

  const result = core.deleteTodo(1);

  assert(result.success === false, "Delete from empty list should fail");
  assert(result.error === "No todos available to delete", "Should provide appropriate error message");

  core.cleanup();
  console.log("    ✅ Delete from empty list test passed");
}

// Test 3: Delete with non-existent ID
function testDeleteNonExistentId() {
  console.log("  Testing delete with non-existent ID...");
  const core = createTestTodoCore();

  core.addTodo("Test todo");

  const result = core.deleteTodo(999);

  assert(result.success === false, "Delete with non-existent ID should fail");
  assert(result.error === "Todo with ID 999 not found", "Should provide appropriate error message");
  assert(core.listTodos().length === 1, "Should not affect existing todos");

  core.cleanup();
  console.log("    ✅ Delete with non-existent ID test passed");
}

// Test 4: Delete with invalid ID format
function testDeleteInvalidFormat() {
  console.log("  Testing delete with invalid ID format...");
  const core = createTestTodoCore();

  core.addTodo("Test todo");

  const result = core.deleteTodo("not-a-number");

  assert(result.success === false, "Delete with invalid format should fail");
  assert(result.error === "Invalid ID format - must be a number", "Should provide appropriate error message");
  assert(core.listTodos().length === 1, "Should not affect existing todos");

  core.cleanup();
  console.log("    ✅ Delete with invalid format test passed");
}

// Test 5: Delete with null/undefined ID
function testDeleteNullUndefinedId() {
  console.log("  Testing delete with null/undefined ID...");
  const core = createTestTodoCore();

  core.addTodo("Test todo");

  const resultNull = core.deleteTodo(null);
  const resultUndefined = core.deleteTodo(undefined);

  assert(resultNull.success === false, "Delete with null should fail");
  assert(resultUndefined.success === false, "Delete with undefined should fail");
  assert(resultNull.error === "ID is required", "Should provide appropriate error message for null");
  assert(resultUndefined.error === "ID is required", "Should provide appropriate error message for undefined");
  assert(core.listTodos().length === 1, "Should not affect existing todos");

  core.cleanup();
  console.log("    ✅ Delete with null/undefined ID test passed");
}

// Test 6: Data persistence after deletion
function testDataPersistence() {
  console.log("  Testing data persistence after deletion...");
  const testFile = path.join(__dirname, `test-persistence-${Date.now()}.json`);

  // Create core, add todos, delete one
  let core = new TodoCore(testFile);
  core.addTodo("First todo");
  core.addTodo("Second todo");
  core.addTodo("Third todo");

  const beforeCount = core.listTodos().length;
  const deleteResult = core.deleteTodo(2);

  assert(deleteResult.success === true, "Delete should succeed");

  // Create new core instance to test persistence
  core = new TodoCore(testFile);
  const afterCount = core.listTodos().length;

  assert(afterCount === beforeCount - 1, "Data should persist after deletion");

  // Verify the specific todo was removed from persisted data
  const persistedTodos = core.listTodos();
  assert(!persistedTodos.find(t => t.id === 2), "Deleted todo should not exist in persisted data");

  // Cleanup
  try {
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }
  } catch (error) {
    console.warn(`Failed to cleanup test file: ${error.message}`);
  }

  console.log("    ✅ Data persistence test passed");
}

// Test 7: Atomic operation with save failure recovery
function testSaveFailureRecovery() {
  console.log("  Testing save failure recovery...");
  const core = createTestTodoCore();

  core.addTodo("Test todo");
  const originalTodos = [...core.listTodos()];
  const originalCount = originalTodos.length;

  // Mock save failure by making the save method return false
  const originalSaveTodos = core.saveTodos;
  core.saveTodos = () => false;

  const result = core.deleteTodo(1);

  assert(result.success === false, "Delete should fail when save fails");
  assert(result.error === "Failed to save changes - deletion rolled back", "Should provide rollback message");
  assert(core.listTodos().length === originalCount, "Todo count should remain unchanged after rollback");

  // Verify the todo was restored
  const currentTodos = core.listTodos();
  assert(currentTodos.find(t => t.id === 1), "Todo should be restored after rollback");

  // Restore original save method
  core.saveTodos = originalSaveTodos;

  core.cleanup();
  console.log("    ✅ Save failure recovery test passed");
}

// Test 8: Data integrity after multiple deletions
function testDataIntegrityMultipleDeletions() {
  console.log("  Testing data integrity after multiple deletions...");
  const core = createTestTodoCore();

  // Add several todos
  for (let i = 1; i <= 5; i++) {
    core.addTodo(`Todo ${i}`);
  }

  const initialTodos = core.listTodos();
  const initialCount = initialTodos.length;

  // Delete multiple todos
  const deletedIds = [1, 3, 5];
  for (const id of deletedIds) {
    const result = core.deleteTodo(id);
    assert(result.success === true, `Delete of ID ${id} should succeed`);
  }

  const remainingTodos = core.listTodos();
  const expectedCount = initialCount - deletedIds.length;

  assert(remainingTodos.length === expectedCount, "Correct number of todos should remain");

  // Verify correct todos were deleted
  for (const id of deletedIds) {
    assert(!remainingTodos.find(t => t.id === id), `Todo with ID ${id} should be deleted`);
  }

  // Verify remaining todos are correct
  const remainingIds = [2, 4];
  for (const id of remainingIds) {
    assert(remainingTodos.find(t => t.id === id), `Todo with ID ${id} should remain`);
  }

  core.cleanup();
  console.log("    ✅ Data integrity after multiple deletions test passed");
}

// Test 9: Return value validation
function testReturnValueValidation() {
  console.log("  Testing return value validation...");
  const core = createTestTodoCore();

  core.addTodo("Test todo");
  const todo = core.listTodos()[0];

  const result = core.deleteTodo(todo.id);

  // Verify return object structure
  assert(typeof result === 'object', "Return value should be an object");
  assert(typeof result.success === 'boolean', "Should have boolean success property");
  assert(result.success === true, "Success should be true for valid deletion");
  assert(typeof result.todo === 'object', "Should return the deleted todo object");
  assert(result.todo.id === todo.id, "Returned todo should have correct ID");
  assert(result.todo.description === todo.description, "Returned todo should have correct description");
  assert(typeof result.message === 'string', "Should have string message property");

  core.cleanup();
  console.log("    ✅ Return value validation test passed");
}

// Test 10: Delete with zero ID (edge case)
function testDeleteZeroId() {
  console.log("  Testing delete with zero ID...");
  const core = createTestTodoCore();

  core.addTodo("Test todo");

  const result = core.deleteTodo(0);

  assert(result.success === false, "Delete with zero ID should fail");
  assert(result.error === "Todo with ID 0 not found", "Should provide appropriate error message");

  core.cleanup();
  console.log("    ✅ Delete with zero ID test passed");
}

// Run all tests
function runDeleteTests() {
  try {
    testDeleteById();
    testDeleteFromEmptyList();
    testDeleteNonExistentId();
    testDeleteInvalidFormat();
    testDeleteNullUndefinedId();
    testDataPersistence();
    testSaveFailureRecovery();
    testDataIntegrityMultipleDeletions();
    testReturnValueValidation();
    testDeleteZeroId();

    console.log("✅ All delete functionality tests passed!");
    return true;
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error(error.stack);
    return false;
  }
}

// Export for integration with main test suite
module.exports = { runDeleteTests };

// Run tests if this file is executed directly
if (require.main === module) {
  const success = runDeleteTests();
  process.exit(success ? 0 : 1);
}