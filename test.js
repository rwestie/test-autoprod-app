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

  // Test 7: Storage operation feedback
  runTest("Storage operation feedback", () => {
    const testFile = path.join(testDir, 'feedback-test.json');
    const todoCore = new TodoCore(testFile);

    // Test adding todo with storage feedback
    const addResult = todoCore.addTodo("Test feedback");
    assert(addResult.success, "Should successfully add todo");
    assert(addResult.storage, "Should include storage information");
    assert(addResult.storage.saved === true, "Should confirm save success");
    assert(addResult.storage.count === 1, "Should report correct count");
    assert(addResult.storage.location === testFile, "Should report storage location");

    // Test completing todo with storage feedback
    const completeResult = todoCore.completeTodo(1);
    assert(completeResult.success, "Should successfully complete todo");
    assert(completeResult.storage, "Should include storage information");
    assert(completeResult.storage.saved === true, "Should confirm save success");
    assert(completeResult.storage.count === 1, "Should report correct count");

    // Test deleting todo with storage feedback
    const deleteResult = todoCore.deleteTodo(1);
    assert(deleteResult.success, "Should successfully delete todo");
    assert(deleteResult.storage, "Should include storage information");
    assert(deleteResult.storage.saved === true, "Should confirm save success");
    assert(deleteResult.storage.count === 0, "Should report correct count after deletion");
  });

  // Test 8: Storage feedback with save failures
  runTest("Storage feedback with failures", () => {
    const invalidPath = "/root/nonexistent/feedback-fail-test.json";
    const todoCore = new TodoCore(invalidPath);

    // Test adding todo with storage failure
    const addResult = todoCore.addTodo("Test failure");
    assert(!addResult.success, "Should fail to add todo with invalid path");
    assert(addResult.storage, "Should include storage information");
    assert(addResult.storage.saved === false, "Should confirm save failure");
    assert(typeof addResult.error === 'string', "Should include error message");
  });

  // Test 9: Enhanced data structure with priority, tags, and due dates
  runTest("Enhanced data structure", () => {
    const testFile = path.join(testDir, 'enhanced-test.json');
    const todoCore = new TodoCore(testFile);

    // Test adding todo with priority and tags
    const result = todoCore.addTodo("Enhanced todo", {
      priority: 'high',
      tags: ['work', 'urgent'],
      dueDate: '2024-12-31T23:59:59Z'
    });

    assert(result.success, "Should successfully add enhanced todo");
    assert(result.todo.priority === 'high', "Priority should be set correctly");
    assert(Array.isArray(result.todo.tags), "Tags should be an array");
    assert(result.todo.tags.includes('work'), "Tags should include 'work'");
    assert(result.todo.tags.includes('urgent'), "Tags should include 'urgent'");
    assert(result.todo.dueDate === '2024-12-31T23:59:59Z', "Due date should be set correctly");

    // Test default priority for todos without explicit priority
    const simpleResult = todoCore.addTodo("Simple todo");
    assert(simpleResult.success, "Should add simple todo");
    assert(simpleResult.todo.priority === 'medium', "Should default to medium priority");
    assert(Array.isArray(simpleResult.todo.tags), "Should have empty tags array");
    assert(simpleResult.todo.tags.length === 0, "Default tags should be empty");
  });

  // Test 10: Data structure validation with enhanced fields
  runTest("Enhanced data validation", () => {
    const testFile = path.join(testDir, 'validation-enhanced-test.json');

    // Create file with mixed valid and invalid data
    const mixedData = [
      {
        id: 1,
        description: "Valid enhanced todo",
        completed: false,
        priority: 'high',
        tags: ['work'],
        dueDate: '2024-12-31T23:59:59Z',
        createdAt: "2024-01-01T00:00:00Z"
      },
      {
        id: 2,
        description: "Invalid priority todo",
        completed: false,
        priority: 'invalid_priority',
        tags: ['test'],
        createdAt: "2024-01-01T00:00:00Z"
      },
      {
        id: 3,
        description: "Invalid tags todo",
        completed: false,
        tags: 'not_an_array',
        createdAt: "2024-01-01T00:00:00Z"
      },
      {
        id: 4,
        description: "Valid old format todo",
        completed: true,
        createdAt: "2024-01-01T00:00:00Z"
      }
    ];

    fs.writeFileSync(testFile, JSON.stringify(mixedData));

    const todoCore = new TodoCore(testFile);
    const todos = todoCore.listTodos();

    // Should have 2 valid todos (1 enhanced + 1 migrated old format)
    assert(todos.length === 2, "Should filter invalid and migrate valid todos");

    const enhancedTodo = todos.find(t => t.id === 1);
    assert(enhancedTodo, "Enhanced todo should be preserved");
    assert(enhancedTodo.priority === 'high', "Priority should be preserved");
    assert(enhancedTodo.tags.includes('work'), "Tags should be preserved");

    const migratedTodo = todos.find(t => t.id === 4);
    assert(migratedTodo, "Old format todo should be migrated");
    assert(migratedTodo.priority === 'medium', "Should have default priority");
    assert(Array.isArray(migratedTodo.tags), "Should have tags array");
  });

  // Test 11: Update functionality
  runTest("Update todo functionality", () => {
    const testFile = path.join(testDir, 'update-test.json');
    const todoCore = new TodoCore(testFile);

    // Add initial todo
    todoCore.addTodo("Todo to update", { priority: 'low', tags: ['test'] });

    // Update priority and tags
    const updateResult = todoCore.updateTodo(1, {
      priority: 'high',
      tags: ['urgent', 'work'],
      description: 'Updated description'
    });

    assert(updateResult.success, "Should successfully update todo");
    assert(updateResult.todo.priority === 'high', "Priority should be updated");
    assert(updateResult.todo.description === 'Updated description', "Description should be updated");
    assert(updateResult.todo.tags.includes('urgent'), "Should include new tag 'urgent'");
    assert(updateResult.todo.tags.includes('work'), "Should include new tag 'work'");
    assert(!updateResult.todo.tags.includes('test'), "Should not include old tag 'test'");
  });

  // Test 12: Query functionality
  runTest("Query functionality", () => {
    const testFile = path.join(testDir, 'query-test.json');
    const todoCore = new TodoCore(testFile);

    // Add test todos
    todoCore.addTodo("High priority todo", { priority: 'high', tags: ['work'] });
    todoCore.addTodo("Low priority todo", { priority: 'low', tags: ['personal'] });
    todoCore.addTodo("Work todo", { priority: 'medium', tags: ['work', 'project'] });

    // Test priority filtering
    const highPriorityTodos = todoCore.listTodosByPriority('high');
    assert(highPriorityTodos.length === 1, "Should find one high priority todo");
    assert(highPriorityTodos[0].description === 'High priority todo', "Should find correct high priority todo");

    // Test tag filtering
    const workTodos = todoCore.listTodosByTag('work');
    assert(workTodos.length === 2, "Should find two work todos");

    // Test get by ID
    const todo = todoCore.getTodoById(1);
    assert(todo !== null, "Should find todo by ID");
    assert(todo.description === 'High priority todo', "Should find correct todo by ID");

    // Test all tags
    const allTags = todoCore.getAllTags();
    assert(allTags.includes('work'), "Should include 'work' tag");
    assert(allTags.includes('personal'), "Should include 'personal' tag");
    assert(allTags.includes('project'), "Should include 'project' tag");
  });

  // Test 13: Due date functionality
  runTest("Due date functionality", () => {
    const testFile = path.join(testDir, 'duedate-test.json');
    const todoCore = new TodoCore(testFile);

    // Use simple, fixed dates for testing
    todoCore.addTodo("Overdue todo", { dueDate: '2024-01-01T10:00:00Z' });
    todoCore.addTodo("Due today", { dueDate: '2026-02-07T23:59:59Z' }); // Today's date
    todoCore.addTodo("Due future", { dueDate: '2026-12-31T10:00:00Z' });
    todoCore.addTodo("No due date");

    // Test overdue todos
    const overdueTodos = todoCore.getOverdueTodos();
    assert(overdueTodos.length === 1, "Should find one overdue todo");
    assert(overdueTodos[0].description === 'Overdue todo', "Should find correct overdue todo");

    // Test due today - this tests if the date matches today's date
    const dueTodayTodos = todoCore.getDueTodosToday();
    assert(dueTodayTodos.length === 1, "Should find one todo due today");
    assert(dueTodayTodos[0].description === 'Due today', "Should find correct todo due today");
  });

  console.log("\n🎉 All storage and enhanced data structure tests passed!");

} catch (error) {
  console.error("❌ Test failed:", error.message);
  process.exit(1);
} finally {
  cleanup();
}
