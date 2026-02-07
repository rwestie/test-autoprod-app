const assert = require("assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { TodoCore, reset_global_core } = require("./todo-core");

console.log("Running todo storage tests...");

// Test data directory
const testDir = path.join(os.tmpdir(), 'todo-test-' + Date.now());
fs.mkdirSync(testDir, { recursive: true });

function cleanup() {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  reset_global_core();
}

// Helper function to run tests
function runTest(testName, testFn) {
  try {
    testFn();
    console.log(`✓ ${testName}`);
  } catch (error) {
    console.error(`✗ ${testName}: ${error.message}`);
    throw error;
  }
}

try {
  // Test 1: Basic file storage functionality
  runTest("Basic file storage", () => {
    const testFile = path.join(testDir, 'test-todos.json');
    const todoCore = new TodoCore(testFile);

    // Add a todo
    const result = todoCore.addTodo("Test todo");
    assert(result.success, "Should successfully add todo");
    assert(result.todo.id === 1, "First todo should have ID 1");
    assert(result.todo.description === "Test todo", "Description should match");
    assert(result.todo.completed === false, "Todo should start incomplete");

    // Verify file exists
    assert(fs.existsSync(testFile), "Todo file should be created");

    // Create new instance to test persistence
    const todoCore2 = new TodoCore(testFile);
    const todos = todoCore2.listTodos();
    assert(todos.length === 1, "Should load one todo from file");
    assert(todos[0].description === "Test todo", "Loaded todo should match");
  });

  // Test 2: Data validation
  runTest("Data validation", () => {
    const testFile = path.join(testDir, 'invalid-todos.json');

    // Create invalid JSON file
    const invalidData = [
      { id: 1, description: "Valid todo", completed: false, createdAt: "2024-01-01T00:00:00Z" },
      { id: "invalid", description: "Invalid ID", completed: false }, // Missing createdAt, invalid ID
      { description: "Missing ID", completed: true }, // Missing ID
      { id: 2, completed: false }, // Missing description
      null // Null item
    ];

    fs.writeFileSync(testFile, JSON.stringify(invalidData));

    const todoCore = new TodoCore(testFile);
    const todos = todoCore.listTodos();

    // Should only have the valid todo
    assert(todos.length === 1, "Should filter out invalid todos");
    assert(todos[0].description === "Valid todo", "Valid todo should remain");
  });

  // Test 3: Backup and recovery
  runTest("Backup and recovery", () => {
    const testFile = path.join(testDir, 'backup-test.json');
    const backupFile = testFile + '.backup';

    const todoCore = new TodoCore(testFile);
    todoCore.addTodo("Original todo");

    // Add second todo to trigger another save (which creates backup)
    todoCore.addTodo("Second todo");

    // Verify backup was created during the second save
    assert(fs.existsSync(backupFile), "Backup file should be created on second save");

    // Corrupt main file
    fs.writeFileSync(testFile, "invalid json {");

    // Create new instance - should recover from backup
    const todoCore2 = new TodoCore(testFile);
    const todos = todoCore2.listTodos();

    assert(todos.length === 1, "Should recover from backup (first todo only since backup was from first save)");
    assert(todos[0].description === "Original todo", "Recovered data should match");
  });

  // Test 4: Atomic writes
  runTest("Atomic writes", () => {
    const testFile = path.join(testDir, 'atomic-test.json');
    const todoCore = new TodoCore(testFile);

    todoCore.addTodo("Test todo 1");
    todoCore.addTodo("Test todo 2");

    // File should exist and be valid JSON
    assert(fs.existsSync(testFile), "File should exist");
    const data = JSON.parse(fs.readFileSync(testFile, 'utf8'));
    assert(Array.isArray(data), "File should contain valid JSON array");
    assert(data.length === 2, "Should contain 2 todos");

    // Temp file should not exist after successful write
    const tempFile = testFile + '.tmp';
    assert(!fs.existsSync(tempFile), "Temp file should be cleaned up");
  });

  // Test 5: Error handling for unwritable directory
  runTest("Error handling", () => {
    const invalidPath = "/root/nonexistent/todos.json";
    const todoCore = new TodoCore(invalidPath);

    // Should handle errors gracefully and return empty array
    const todos = todoCore.listTodos();
    assert(Array.isArray(todos), "Should return array even with invalid path");
    assert(todos.length === 0, "Should return empty array for invalid path");

    // Add todo should fail gracefully
    const result = todoCore.addTodo("Test");
    assert(!result.success, "Should fail to add todo to invalid path");
  });

  // Test 6: Complete workflow
  runTest("Complete workflow", () => {
    const testFile = path.join(testDir, 'workflow-test.json');
    const todoCore = new TodoCore(testFile);

    // Add multiple todos
    todoCore.addTodo("Todo 1");
    todoCore.addTodo("Todo 2");
    todoCore.addTodo("Todo 3");

    // Complete one
    const completeResult = todoCore.completeTodo(2);
    assert(completeResult.success, "Should complete todo");

    // Delete one
    const deleteResult = todoCore.deleteTodo(1);
    assert(deleteResult.success, "Should delete todo");

    // Verify persistence by creating new instance
    const todoCore2 = new TodoCore(testFile);
    const todos = todoCore2.listTodos();

    assert(todos.length === 2, "Should have 2 remaining todos");
    assert(todos.some(t => t.id === 2 && t.completed), "Todo 2 should be completed");
    assert(todos.some(t => t.id === 3 && !t.completed), "Todo 3 should be pending");
    assert(!todos.some(t => t.id === 1), "Todo 1 should be deleted");
  });

  console.log("\n🎉 All storage tests passed!");

} catch (error) {
  console.error("❌ Test failed:", error.message);
  process.exit(1);
} finally {
  cleanup();
}
