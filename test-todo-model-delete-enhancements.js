/**
 * Tests for Todo Model Delete Enhancements
 */

const assert = require('assert');
const { Todo } = require('./todo-model');

console.log('Testing Todo model delete enhancements...');

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
  // Test 1: canBeDeleted method
  runTest('canBeDeleted method', () => {
    const todo = new Todo({ description: 'Test todo' });
    assert(todo.canBeDeleted() === true, 'All todos should be deletable by default');
  });

  // Test 2: getDeleteConfirmationMessage method
  runTest('getDeleteConfirmationMessage method', () => {
    // Simple pending todo
    const pendingTodo = new Todo({ description: 'Buy milk' });
    const pendingMessage = pendingTodo.getDeleteConfirmationMessage();
    assert(pendingMessage.includes('pending'), 'Should indicate pending status');
    assert(pendingMessage.includes('Buy milk'), 'Should include description');

    // Completed todo with priority and tags
    const completedTodo = new Todo({
      description: 'Important task',
      completed: true,
      priority: 'high',
      tags: ['work', 'urgent'],
      dueDate: '2024-12-31T23:59:59Z'
    });
    const completedMessage = completedTodo.getDeleteConfirmationMessage();
    assert(completedMessage.includes('completed'), 'Should indicate completed status');
    assert(completedMessage.includes('Important task'), 'Should include description');
    assert(completedMessage.includes('high priority'), 'Should include priority');
    assert(completedMessage.includes('work, urgent'), 'Should include tags');
    assert(completedMessage.includes('due:'), 'Should include due date');
  });

  // Test 3: getDeleteMetadata method
  runTest('getDeleteMetadata method', () => {
    const todo = new Todo({
      id: 5,
      description: 'Work task',
      completed: false,
      priority: 'high',
      tags: ['work', 'urgent'],
      dueDate: '2020-01-01T00:00:00Z', // Overdue date
      createdAt: '2024-01-01T00:00:00Z'
    });

    const metadata = todo.getDeleteMetadata();

    assert(metadata.id === 5, 'Should include ID');
    assert(metadata.description === 'Work task', 'Should include description');
    assert(metadata.completed === false, 'Should include completion status');
    assert(metadata.priority === 'high', 'Should include priority');
    assert(Array.isArray(metadata.tags), 'Should include tags array');
    assert(metadata.tags.includes('work'), 'Should include tags');
    assert(metadata.dueDate, 'Should include due date');
    assert(metadata.isOverdue === true, 'Should calculate overdue status');
    assert(metadata.hasHighPriority === true, 'Should identify high priority');
    assert(metadata.hasWorkTag === true, 'Should identify work tag');
    assert(typeof metadata.daysSinceCreated === 'number', 'Should calculate days since created');
  });

  // Test 4: shouldBeIncludedInBulkDelete method - clean operation
  runTest('shouldBeIncludedInBulkDelete - clean operation', () => {
    const completedTodo = new Todo({ description: 'Done task', completed: true });
    const pendingTodo = new Todo({ description: 'Pending task', completed: false });

    assert(completedTodo.shouldBeIncludedInBulkDelete('clean') === true, 'Completed todo should be cleaned');
    assert(completedTodo.shouldBeIncludedInBulkDelete('cleanup') === true, 'Completed todo should be cleaned (alias)');
    assert(pendingTodo.shouldBeIncludedInBulkDelete('clean') === false, 'Pending todo should not be cleaned');
  });

  // Test 5: shouldBeIncludedInBulkDelete method - clear operation
  runTest('shouldBeIncludedInBulkDelete - clear operation', () => {
    const completedTodo = new Todo({ description: 'Done task', completed: true });
    const pendingTodo = new Todo({ description: 'Pending task', completed: false });

    assert(completedTodo.shouldBeIncludedInBulkDelete('clear') === true, 'All todos should be cleared');
    assert(completedTodo.shouldBeIncludedInBulkDelete('purge') === true, 'All todos should be purged (alias)');
    assert(pendingTodo.shouldBeIncludedInBulkDelete('clear') === true, 'All todos should be cleared');
  });

  // Test 6: shouldBeIncludedInBulkDelete method - overdue operation
  runTest('shouldBeIncludedInBulkDelete - overdue operation', () => {
    const overdueTodo = new Todo({
      description: 'Overdue task',
      completed: false,
      dueDate: '2020-01-01T00:00:00Z' // Old date
    });

    const pendingTodo = new Todo({ description: 'Normal task', completed: false });
    const completedOverdueTodo = new Todo({
      description: 'Completed overdue task',
      completed: true,
      dueDate: '2020-01-01T00:00:00Z'
    });

    assert(overdueTodo.shouldBeIncludedInBulkDelete('overdue') === true, 'Overdue incomplete todo should be included');
    assert(pendingTodo.shouldBeIncludedInBulkDelete('overdue') === false, 'Non-overdue todo should not be included');
    assert(completedOverdueTodo.shouldBeIncludedInBulkDelete('overdue') === false, 'Completed todo should not be included in overdue cleanup');
  });

  // Test 7: shouldBeIncludedInBulkDelete method - priority operations
  runTest('shouldBeIncludedInBulkDelete - priority operations', () => {
    const lowPriorityTodo = new Todo({ description: 'Low priority task', priority: 'low' });
    const mediumPriorityTodo = new Todo({ description: 'Medium priority task', priority: 'medium' });
    const highPriorityTodo = new Todo({ description: 'High priority task', priority: 'high' });

    assert(lowPriorityTodo.shouldBeIncludedInBulkDelete('low-priority') === true, 'Low priority todo should be included');
    assert(mediumPriorityTodo.shouldBeIncludedInBulkDelete('low-priority') === false, 'Medium priority todo should not be included');
    assert(highPriorityTodo.shouldBeIncludedInBulkDelete('low-priority') === false, 'High priority todo should not be included');
  });

  // Test 8: shouldBeIncludedInBulkDelete method - status operations
  runTest('shouldBeIncludedInBulkDelete - status operations', () => {
    const completedTodo = new Todo({ description: 'Done task', completed: true });
    const pendingTodo = new Todo({ description: 'Pending task', completed: false });

    assert(completedTodo.shouldBeIncludedInBulkDelete('completed') === true, 'Completed todo should be included in completed operation');
    assert(pendingTodo.shouldBeIncludedInBulkDelete('completed') === false, 'Pending todo should not be included in completed operation');

    assert(completedTodo.shouldBeIncludedInBulkDelete('pending') === false, 'Completed todo should not be included in pending operation');
    assert(pendingTodo.shouldBeIncludedInBulkDelete('pending') === true, 'Pending todo should be included in pending operation');
  });

  // Test 9: shouldBeIncludedInBulkDelete method - old operation
  runTest('shouldBeIncludedInBulkDelete - old operation', () => {
    const oldTodo = new Todo({
      description: 'Old task',
      createdAt: '2023-01-01T00:00:00Z' // Over 30 days ago
    });

    const recentTodo = new Todo({
      description: 'Recent task'
      // Uses current date by default
    });

    assert(oldTodo.shouldBeIncludedInBulkDelete('old') === true, 'Old todo should be included');
    assert(recentTodo.shouldBeIncludedInBulkDelete('old') === false, 'Recent todo should not be included');
  });

  // Test 10: shouldBeIncludedInBulkDelete method - unknown operation
  runTest('shouldBeIncludedInBulkDelete - unknown operation', () => {
    const todo = new Todo({ description: 'Test task' });

    assert(todo.shouldBeIncludedInBulkDelete('unknown-operation') === false, 'Unknown operations should return false');
    assert(todo.shouldBeIncludedInBulkDelete('') === false, 'Empty operation should return false');
  });

  // Test 11: getBulkDeleteOperations static method
  runTest('getBulkDeleteOperations static method', () => {
    const operations = Todo.getBulkDeleteOperations();

    assert(typeof operations === 'object', 'Should return an object');
    assert(operations.clean, 'Should include clean operation');
    assert(operations.clear, 'Should include clear operation');
    assert(operations.overdue, 'Should include overdue operation');
    assert(operations.old, 'Should include old operation');
    assert(operations['low-priority'], 'Should include low-priority operation');

    // Verify structure of an operation
    const cleanOp = operations.clean;
    assert(cleanOp.name === 'clean', 'Operation should have correct name');
    assert(Array.isArray(cleanOp.aliases), 'Operation should have aliases array');
    assert(cleanOp.aliases.includes('cleanup'), 'Clean operation should include cleanup alias');
    assert(typeof cleanOp.description === 'string', 'Operation should have description');
    assert(typeof cleanOp.filter === 'string', 'Operation should have filter');
    assert(typeof cleanOp.safety === 'string', 'Operation should have safety level');
  });

  console.log('\n🎉 All Todo model delete enhancement tests passed!');

} catch (error) {
  console.error('❌ Todo model delete enhancement test failed:', error.message);
  process.exit(1);
}