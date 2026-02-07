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

// Test 1: Delete by ID (primary method)
function testDeleteById() {
  console.log("  Testing delete by ID...");
  const core = createTestTodoCore();

  // Add some todos
  core.addTodo("First todo");
  core.addTodo("Second todo");
  core.addTodo("Third todo");

  const firstTodo = core.listTodos()[0];
  const result = core.deleteTodo(firstTodo.id);

  assert(result.success === true, "Delete by ID should succeed");
  assert(result.method === "ID", "Should indicate deletion by ID");
  assert(result.todo.id === firstTodo.id, "Should return the deleted todo");
  assert(core.listTodos().length === 2, "Should have 2 todos remaining");

  core.cleanup();
  console.log("    ✅ Delete by ID test passed");
}

// Test 2: Delete by position (index-based, 1-indexed for user convenience)
function testDeleteByPosition() {
  console.log("  Testing delete by position...");
  const core = createTestTodoCore();

  // Add some todos with high IDs to ensure position-based deletion
  core.addTodo("First todo");   // ID: 1
  core.addTodo("Second todo");  // ID: 2
  core.addTodo("Third todo");   // ID: 3
  core.addTodo("Fourth todo");  // ID: 4
  core.addTodo("Fifth todo");   // ID: 5

  // Delete todos with IDs 1 and 2 to create a gap
  core.deleteTodo(1);
  core.deleteTodo(2);

  // Now we have positions 1, 2, 3 with IDs 3, 4, 5
  // Position 1: "Third todo" (ID: 3)
  // Position 2: "Fourth todo" (ID: 4)
  // Position 3: "Fifth todo" (ID: 5)

  const todoAtPosition2 = core.listTodos()[1]; // Fourth todo (ID: 4)

  // Try to delete position 2 by asking for ID "2" - since ID 2 no longer exists,
  // it should fall back to position-based deletion
  const result = core.deleteTodo(2);

  assert(result.success === true, "Delete by position should succeed");
  assert(result.method === "position", "Should indicate deletion by position");
  assert(result.todo.id === todoAtPosition2.id, "Should return the correct deleted todo");
  assert(core.listTodos().length === 2, "Should have 2 todos remaining");

  core.cleanup();
  console.log("    ✅ Delete by position test passed");
}

// Test 3: Delete by array index (0-based, using dedicated method)
function testDeleteByIndex() {
  console.log("  Testing delete by array index...");
  const core = createTestTodoCore();

  // Add some todos
  core.addTodo("First todo");
  core.addTodo("Second todo");
  core.addTodo("Third todo");

  const thirdTodo = core.listTodos()[2];

  // Delete index 2 (third todo, using 0-based indexing)
  const result = core.deleteTodoByIndex(2);

  assert(result.success === true, "Delete by index should succeed");
  assert(result.method === "index", "Should indicate deletion by index");
  assert(result.todo.id === thirdTodo.id, "Should return the correct deleted todo");
  assert(core.listTodos().length === 2, "Should have 2 todos remaining");

  core.cleanup();
  console.log("    ✅ Delete by array index test passed");
}

// Test 4: Edge case - empty list
function testDeleteFromEmptyList() {
  console.log("  Testing delete from empty list...");
  const core = createTestTodoCore();

  const result = core.deleteTodo(1);

  assert(result.success === false, "Delete from empty list should fail");
  assert(result.error === "No todos available to delete", "Should provide appropriate error message");

  core.cleanup();
  console.log("    ✅ Delete from empty list test passed");
}

// Test 5: Edge case - invalid ID
function testDeleteInvalidId() {
  console.log("  Testing delete with invalid ID...");
  const core = createTestTodoCore();

  core.addTodo("Test todo");

  const result = core.deleteTodo(999);

  assert(result.success === false, "Delete with invalid ID should fail");
  assert(result.error.includes("Invalid position"), "Should provide appropriate error message");

  core.cleanup();
  console.log("    ✅ Delete with invalid ID test passed");
}

// Test 6: Edge case - invalid format
function testDeleteInvalidFormat() {
  console.log("  Testing delete with invalid format...");
  const core = createTestTodoCore();

  core.addTodo("Test todo");

  const result = core.deleteTodo("not-a-number");

  assert(result.success === false, "Delete with invalid format should fail");
  assert(result.error === "Invalid identifier format - must be a number", "Should provide appropriate error message");

  core.cleanup();
  console.log("    ✅ Delete with invalid format test passed");
}

// Test 7: Edge case - null/undefined identifier
function testDeleteNullIdentifier() {
  console.log("  Testing delete with null identifier...");
  const core = createTestTodoCore();

  core.addTodo("Test todo");

  const resultNull = core.deleteTodo(null);
  const resultUndefined = core.deleteTodo(undefined);

  assert(resultNull.success === false, "Delete with null should fail");
  assert(resultUndefined.success === false, "Delete with undefined should fail");
  assert(resultNull.error === "Identifier is required", "Should provide appropriate error message for null");
  assert(resultUndefined.error === "Identifier is required", "Should provide appropriate error message for undefined");

  core.cleanup();
  console.log("    ✅ Delete with null identifier test passed");
}

// Test 8: Edge case - out of bounds position
function testDeleteOutOfBounds() {
  console.log("  Testing delete with out of bounds position...");
  const core = createTestTodoCore();

  core.addTodo("Test todo");

  const resultHigh = core.deleteTodo(10);
  const resultZero = core.deleteTodo(0);
  const resultNegative = core.deleteTodo(-1);

  assert(resultHigh.success === false, "Delete with high position should fail");
  assert(resultZero.success === false, "Delete with zero position should fail");
  assert(resultNegative.success === false, "Delete with negative position should fail");

  core.cleanup();
  console.log("    ✅ Delete with out of bounds position test passed");
}

// Test 9: Data persistence after deletion
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

// Test 10: Atomic operation with save failure recovery
function testSaveFailureRecovery() {
  console.log("  Testing save failure recovery...");
  const core = createTestTodoCore();

  core.addTodo("Test todo");
  const originalCount = core.listTodos().length;

  // Mock save failure by making the data file path invalid
  const originalSaveTodos = core.saveTodos;
  core.saveTodos = () => false;

  const result = core.deleteTodo(1);

  assert(result.success === false, "Delete should fail when save fails");
  assert(result.error === "Failed to save changes - deletion rolled back", "Should provide rollback message");
  assert(core.listTodos().length === originalCount, "Todo count should remain unchanged after rollback");

  // Restore original save method
  core.saveTodos = originalSaveTodos;

  core.cleanup();
  console.log("    ✅ Save failure recovery test passed");
}

// Run all tests
function runDeleteTests() {
  try {
    testDeleteById();
    testDeleteByPosition();
    testDeleteByIndex();
    testDeleteFromEmptyList();
    testDeleteInvalidId();
    testDeleteInvalidFormat();
    testDeleteNullIdentifier();
    testDeleteOutOfBounds();
    testDataPersistence();
    testSaveFailureRecovery();

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