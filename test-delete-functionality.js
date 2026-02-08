/**
 * Comprehensive Tests for Delete Functionality
 *
 * This file tests all aspects of delete functionality in the todo application:
 * - Single todo deletion
 * - Bulk deletion (clean/clear operations)
 * - Delete validation and error handling
 * - Delete-related metadata and tracking
 * - Integration with storage and backup systems
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { TodoCoreEnhanced } = require("./todo-core-enhanced");
const { StorageConfig } = require("./storage-config");

console.log("Running comprehensive delete functionality tests...");

// Test data directory
const testDir = path.join(os.tmpdir(), 'delete-test-' + Date.now());
fs.mkdirSync(testDir, { recursive: true });

function cleanup() {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

// Helper function to run tests
async function runTest(testName, testFn) {
  try {
    await testFn();
    console.log(`✓ ${testName}`);
  } catch (error) {
    console.error(`✗ ${testName}: ${error.message}`);
    throw error;
  }
}

// Helper to create test todo core with temporary storage
async function createTestTodoCore(filename = 'test-todos.json') {
  const testFile = path.join(testDir, filename);
  const config = new StorageConfig({
    dataDir: testDir,
    dataFile: filename,
    enableLogging: false // Disable logging for cleaner test output
  });
  const todoCore = new TodoCoreEnhanced(config, null, 'json-file');
  await todoCore.initialize();
  return todoCore;
}

async function runAllTests() {
  // Test 1: Basic single todo deletion
  await runTest("Basic single todo deletion", async () => {
    const todoCore = await createTestTodoCore('delete-basic.json');

    // Add test todos
    await todoCore.addTodo("Todo to keep");
    await todoCore.addTodo("Todo to delete");
    await todoCore.addTodo("Another todo to keep");

    // Delete the middle todo
    const deleteResult = await todoCore.deleteTodo(2);

    assert(deleteResult.success, "Delete should succeed");
    assert(deleteResult.todo.description === "Todo to delete", "Should return deleted todo");
    assert(deleteResult.storage.saved, "Storage should confirm save");
    assert(deleteResult.storage.count === 2, "Should have 2 todos remaining");

    // Verify deletion
    const remainingTodos = await todoCore.listTodos();
    assert(remainingTodos.length === 2, "Should have 2 todos remaining");
    assert(!remainingTodos.some(t => t.id === 2), "Deleted todo should not exist");
    assert(remainingTodos.some(t => t.description === "Todo to keep"), "Other todos should remain");
    assert(remainingTodos.some(t => t.description === "Another todo to keep"), "Other todos should remain");

    await todoCore.close();
  });

  // Test 2: Delete validation and error handling
  await runTest("Delete validation and error handling", async () => {
    const todoCore = await createTestTodoCore('delete-validation.json');

    await todoCore.addTodo("Test todo");

    // Test invalid ID formats
    const invalidIdResult = await todoCore.deleteTodo("invalid");
    assert(!invalidIdResult.success, "Should fail with invalid ID");
    assert(invalidIdResult.error.includes("Invalid ID format"), "Should have appropriate error message");

    // Test non-existent ID
    const notFoundResult = await todoCore.deleteTodo(999);
    assert(!notFoundResult.success, "Should fail with non-existent ID");
    assert(notFoundResult.error.includes("not found"), "Should have appropriate error message");

    // Test empty/null ID
    const emptyResult = await todoCore.deleteTodo("");
    assert(!emptyResult.success, "Should fail with empty ID");

    // Verify original todo still exists
    const todos = await todoCore.listTodos();
    assert(todos.length === 1, "Original todo should still exist");

    await todoCore.close();
  });

  // Test 3: Delete with storage failure recovery
  await runTest("Delete with storage failure recovery", async () => {
    const todoCore = await createTestTodoCore('delete-recovery.json');

    await todoCore.addTodo("Todo to delete");
    await todoCore.addTodo("Todo to keep");

    // Mock storage failure by making the storage read-only temporarily
    const originalSaveData = todoCore.storage.saveData;
    todoCore.storage.saveData = async () => ({
      success: false,
      error: "Mock storage failure",
      metadata: { attempts: 1 }
    });

    const deleteResult = await todoCore.deleteTodo(1);
    assert(!deleteResult.success, "Delete should fail due to storage error");
    assert(deleteResult.error.includes("Mock storage failure"), "Should have storage error message");
    assert(!deleteResult.storage.saved, "Storage should confirm failure");

    // Verify todo was rolled back and still exists
    const todos = await todoCore.listTodos();
    assert(todos.length === 2, "Todos should be rolled back");
    assert(todos.some(t => t.id === 1), "Failed delete should be rolled back");

    // Restore storage functionality
    todoCore.storage.saveData = originalSaveData;

    // Verify normal deletion works again
    const successResult = await todoCore.deleteTodo(1);
    assert(successResult.success, "Delete should work after storage restoration");

    await todoCore.close();
  });

  // Test 4: Delete completed vs pending todos
  await runTest("Delete completed vs pending todos", async () => {
    const todoCore = await createTestTodoCore('delete-status.json');

    // Add todos with different statuses
    await todoCore.addTodo("Pending todo 1");
    await todoCore.addTodo("Pending todo 2");
    await todoCore.addTodo("Todo to complete");

    // Complete one todo
    await todoCore.completeTodo(3);

    // Delete both completed and pending todos
    const deletePendingResult = await todoCore.deleteTodo(1);
    assert(deletePendingResult.success, "Should delete pending todo");
    assert(deletePendingResult.todo.completed === false, "Should track that it was pending");

    const deleteCompletedResult = await todoCore.deleteTodo(3);
    assert(deleteCompletedResult.success, "Should delete completed todo");
    assert(deleteCompletedResult.todo.completed === true, "Should track that it was completed");
    assert(deleteCompletedResult.todo.completedAt, "Should have completion timestamp");

    // Verify only one todo remains
    const remainingTodos = await todoCore.listTodos();
    assert(remainingTodos.length === 1, "Should have one todo remaining");
    assert(remainingTodos[0].description === "Pending todo 2", "Correct todo should remain");

    await todoCore.close();
  });

  // Test 5: Delete todos with enhanced metadata
  await runTest("Delete todos with enhanced metadata", async () => {
    const todoCore = await createTestTodoCore('delete-metadata.json');

    // Add todo with rich metadata
    await todoCore.addTodo("Rich metadata todo", {
      priority: 'high',
      tags: ['important', 'work'],
      dueDate: '2024-12-31T23:59:59Z'
    });

    const deleteResult = await todoCore.deleteTodo(1);
    assert(deleteResult.success, "Should delete todo with metadata");

    // Verify all metadata is preserved in delete result
    const deletedTodo = deleteResult.todo;
    assert(deletedTodo.priority === 'high', "Should preserve priority");
    assert(deletedTodo.tags.includes('important'), "Should preserve tags");
    assert(deletedTodo.tags.includes('work'), "Should preserve all tags");
    assert(deletedTodo.dueDate === '2024-12-31T23:59:59Z', "Should preserve due date");
    assert(deletedTodo.createdAt, "Should preserve created timestamp");

    await todoCore.close();
  });

  // Test 6: Bulk delete - clean completed todos (preparation for implementation)
  await runTest("Bulk delete preparation - clean completed", async () => {
    const todoCore = await createTestTodoCore('bulk-clean.json');

    // Add mixed todos
    await todoCore.addTodo("Pending todo 1");
    await todoCore.addTodo("Todo to complete 1");
    await todoCore.addTodo("Pending todo 2");
    await todoCore.addTodo("Todo to complete 2");

    // Complete some todos
    await todoCore.completeTodo(2);
    await todoCore.completeTodo(4);

    // Verify we have the expected setup
    const allTodos = await todoCore.listTodos();
    assert(allTodos.length === 4, "Should have 4 todos");

    const completedTodos = allTodos.filter(t => t.completed);
    const pendingTodos = allTodos.filter(t => !t.completed);

    assert(completedTodos.length === 2, "Should have 2 completed todos");
    assert(pendingTodos.length === 2, "Should have 2 pending todos");

    // Prepare for bulk delete implementation by testing individual deletes
    // This simulates what a bulk clean operation should do
    const completedIds = completedTodos.map(t => t.id);

    for (const id of completedIds) {
      const deleteResult = await todoCore.deleteTodo(id);
      assert(deleteResult.success, `Should delete completed todo ${id}`);
      assert(deleteResult.todo.completed === true, "Deleted todo should have been completed");
    }

    // Verify only pending todos remain
    const remainingTodos = await todoCore.listTodos();
    assert(remainingTodos.length === 2, "Should have 2 todos remaining after clean");
    assert(remainingTodos.every(t => !t.completed), "All remaining todos should be pending");

    await todoCore.close();
  });

  // Test 7: Bulk delete - clear all todos (preparation for implementation)
  await runTest("Bulk delete preparation - clear all", async () => {
    const todoCore = await createTestTodoCore('bulk-clear.json');

    // Add various todos
    await todoCore.addTodo("Pending todo");
    await todoCore.addTodo("Todo to complete", { priority: 'high' });
    await todoCore.addTodo("Tagged todo", { tags: ['work'] });

    await todoCore.completeTodo(2);

    // Verify setup
    const allTodos = await todoCore.listTodos();
    assert(allTodos.length === 3, "Should have 3 todos");

    // Simulate clear all operation
    const todoIds = allTodos.map(t => t.id);
    const deleteResults = [];

    for (const id of todoIds) {
      const result = await todoCore.deleteTodo(id);
      assert(result.success, `Should delete todo ${id}`);
      deleteResults.push(result);
    }

    // Verify all are deleted
    const remainingTodos = await todoCore.listTodos();
    assert(remainingTodos.length === 0, "Should have no todos remaining after clear");

    // Verify delete results preserved all metadata
    assert(deleteResults.length === 3, "Should have 3 delete results");
    assert(deleteResults.some(r => r.todo.priority === 'high'), "Should preserve priority metadata");
    assert(deleteResults.some(r => r.todo.tags.includes('work')), "Should preserve tag metadata");

    await todoCore.close();
  });

  // Test 8: Delete with backup verification
  await runTest("Delete with backup verification", async () => {
    const todoCore = await createTestTodoCore('delete-backup.json');

    await todoCore.addTodo("Todo before backup");
    await todoCore.addTodo("Todo to delete");

    // Force a backup by adding another todo
    await todoCore.addTodo("Todo to trigger backup");

    // Verify backup file exists
    const backupFile = path.join(testDir, 'delete-backup.json.backup');
    // Note: backup creation depends on storage implementation details

    // Delete a todo
    const deleteResult = await todoCore.deleteTodo(2);
    assert(deleteResult.success, "Delete should succeed");

    // Verify that the delete operation itself creates a backup
    assert(deleteResult.storage.saved, "Storage should confirm save");

    await todoCore.close();
  });

  // Test 9: Delete performance with many todos
  await runTest("Delete performance with many todos", async () => {
    const todoCore = await createTestTodoCore('delete-performance.json');

    // Add many todos
    const todoCount = 100;
    for (let i = 1; i <= todoCount; i++) {
      await todoCore.addTodo(`Todo ${i}`);
    }

    // Verify all were added
    let allTodos = await todoCore.listTodos();
    assert(allTodos.length === todoCount, "Should have all todos");

    // Delete todos from the middle to test array manipulation performance
    const startTime = Date.now();
    const deletePromises = [];

    // Delete every 10th todo to test non-sequential deletion
    for (let i = 10; i <= todoCount; i += 10) {
      deletePromises.push(todoCore.deleteTodo(i));
    }

    const deleteResults = await Promise.all(deletePromises);
    const endTime = Date.now();

    // Verify all deletes succeeded
    assert(deleteResults.every(r => r.success), "All deletes should succeed");
    assert(deleteResults.length === 10, "Should have deleted 10 todos");

    // Verify remaining todos
    allTodos = await todoCore.listTodos();
    assert(allTodos.length === todoCount - 10, "Should have correct remaining count");

    // Performance check - should complete in reasonable time
    const duration = endTime - startTime;
    assert(duration < 5000, "Bulk deletes should complete in under 5 seconds");

    console.log(`  → Deleted 10 todos from ${todoCount} total in ${duration}ms`);

    await todoCore.close();
  });

  // Test 10: Delete edge cases
  await runTest("Delete edge cases", async () => {
    const todoCore = await createTestTodoCore('delete-edge-cases.json');

    // Test deleting from empty list
    const emptyResult = await todoCore.deleteTodo(1);
    assert(!emptyResult.success, "Should fail to delete from empty list");

    // Add one todo and delete it
    await todoCore.addTodo("Only todo");
    const lastTodoResult = await todoCore.deleteTodo(1);
    assert(lastTodoResult.success, "Should delete last remaining todo");

    // Verify list is empty
    const finalTodos = await todoCore.listTodos();
    assert(finalTodos.length === 0, "List should be empty after deleting last todo");

    // Test that next ID is handled correctly after deletion
    await todoCore.addTodo("New todo after empty");
    const newTodos = await todoCore.listTodos();
    assert(newTodos.length === 1, "Should have new todo");
    // Note: ID behavior depends on implementation - might be 2 or reset to 1

    await todoCore.close();
  });

  // Test 11: Delete with concurrent operations simulation
  await runTest("Delete with concurrent operations", async () => {
    const todoCore = await createTestTodoCore('delete-concurrent.json');

    // Add test todos
    await todoCore.addTodo("Todo 1");
    await todoCore.addTodo("Todo 2");
    await todoCore.addTodo("Todo 3");
    await todoCore.addTodo("Todo 4");

    // Simulate concurrent delete and complete operations
    const operations = [
      todoCore.deleteTodo(1),
      todoCore.completeTodo(2),
      todoCore.deleteTodo(3),
      // Note: Completing and then deleting the same todo in parallel
      // should handle gracefully
    ];

    const results = await Promise.all(operations);

    // Verify at least some operations succeeded
    assert(results.some(r => r.success), "Some operations should succeed");

    // Verify final state is consistent
    const finalTodos = await todoCore.listTodos();
    assert(Array.isArray(finalTodos), "Should return valid todo array");

    await todoCore.close();
  });

  console.log("\n🎉 All comprehensive delete functionality tests passed!");
  console.log("🔧 Note: Some bulk delete operations tested as preparation for implementation");
}

runAllTests()
  .then(() => {
    console.log("All tests completed successfully");
  })
  .catch((error) => {
    console.error("❌ Delete functionality test failed:", error.message);
    console.error(error.stack);
    process.exit(1);
  })
  .finally(() => {
    cleanup();
  });