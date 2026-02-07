/**
 * Tests for Delete by ID/Index Functionality
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { TodoCoreEnhanced } = require("./todo-core-enhanced");
const { StorageConfig } = require("./storage-config");

console.log("Running delete by ID/index functionality tests...");

// Test data directory
const testDir = path.join(os.tmpdir(), 'delete-index-test-' + Date.now());
fs.mkdirSync(testDir, { recursive: true });

function cleanup() {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

// Helper to create test todo core with temporary storage
async function createTestTodoCore(filename = 'test-todos.json') {
  const config = new StorageConfig({
    dataDir: testDir,
    dataFile: filename,
    enableLogging: false // Disable logging for cleaner test output
  });
  const todoCore = new TodoCoreEnhanced(config);
  await todoCore.ensureInitialized();
  return todoCore;
}

async function runAllTests() {
  try {
    // Test 1: Delete by ID (existing functionality)
    console.log("✓ Delete by ID - existing functionality");
    const todoCore1 = await createTestTodoCore('delete-by-id.json');
    await todoCore1.addTodo("First todo");
    await todoCore1.addTodo("Second todo");
    await todoCore1.addTodo("Third todo");

    const todos1 = await todoCore1.listTodos();
    const deleteResult1 = await todoCore1.deleteTodo(todos1[1].id);

    assert(deleteResult1.success, "Delete by ID should succeed");
    assert(deleteResult1.method === 'id', "Should indicate ID-based deletion");
    await todoCore1.close();

    // Test 2: Delete by index (new functionality)
    console.log("✓ Delete by index - new functionality");
    const todoCore2 = await createTestTodoCore('delete-by-index.json');
    await todoCore2.addTodo("First todo");
    await todoCore2.addTodo("Second todo");
    await todoCore2.addTodo("Third todo");

    const deleteResult2 = await todoCore2.deleteTodo(2, { useIndex: true });

    assert(deleteResult2.success, "Delete by index should succeed");
    assert(deleteResult2.method === 'index', "Should indicate index-based deletion");
    assert(deleteResult2.todo.description === "Second todo", "Should delete second todo");
    await todoCore2.close();

    // Test 3: Index validation
    console.log("✓ Index validation and error handling");
    const todoCore3 = await createTestTodoCore('delete-validation.json');
    await todoCore3.addTodo("Test todo");

    const invalidResult = await todoCore3.deleteTodo(10, { useIndex: true });
    assert(!invalidResult.success, "Should fail with out of range index");
    assert(invalidResult.error.includes("out of range"), "Should have appropriate error message");
    await todoCore3.close();

    console.log("\n🎉 All delete by ID/index functionality tests passed!");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    throw error;
  }
}

// Main execution
(async () => {
  try {
    await runAllTests();
  } catch (error) {
    console.error("❌ Delete by ID/index functionality test failed:", error.message);
    process.exit(1);
  } finally {
    cleanup();
  }
})();