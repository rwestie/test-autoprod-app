/**
 * Unit Tests for Todo Data Model
 */

const assert = require('assert');
const { Todo } = require('./todo-model');

console.log('Running Todo data model tests...');

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
  // Test 1: Basic Todo creation
  runTest('Basic Todo creation', () => {
    const todo = new Todo({
      description: 'Test todo'
    });

    assert(todo.description === 'Test todo', 'Description should be set');
    assert(todo.completed === false, 'Should default to incomplete');
    assert(todo.priority === 'medium', 'Should default to medium priority');
    assert(Array.isArray(todo.tags), 'Tags should be an array');
    assert(todo.tags.length === 0, 'Should have no tags by default');
    assert(typeof todo.createdAt === 'string', 'Should have createdAt timestamp');
    assert(todo.id === null, 'ID should be null initially');
    assert(todo.completedAt === undefined, 'Should not have completedAt initially');
    assert(todo.dueDate === undefined, 'Should not have dueDate initially');
  });

  // Test 2: Todo with all properties
  runTest('Todo with all properties', () => {
    const todo = new Todo({
      id: 1,
      description: 'Complete todo',
      completed: true,
      priority: 'high',
      tags: ['work', 'urgent'],
      dueDate: '2024-12-31T23:59:59Z',
      createdAt: '2024-01-01T00:00:00Z',
      completedAt: '2024-01-02T00:00:00Z'
    });

    assert(todo.id === 1, 'ID should be set');
    assert(todo.description === 'Complete todo', 'Description should be set');
    assert(todo.completed === true, 'Should be completed');
    assert(todo.priority === 'high', 'Priority should be high');
    assert(todo.tags.length === 2, 'Should have 2 tags');
    assert(todo.tags.includes('work'), 'Should include work tag');
    assert(todo.tags.includes('urgent'), 'Should include urgent tag');
    assert(todo.dueDate === '2024-12-31T23:59:59Z', 'Due date should be set');
    assert(todo.createdAt === '2024-01-01T00:00:00Z', 'Created at should be set');
    assert(todo.completedAt === '2024-01-02T00:00:00Z', 'Completed at should be set');
  });

  // Test 3: Description validation
  runTest('Description validation', () => {
    // Valid descriptions
    new Todo({ description: 'Valid todo' });
    new Todo({ description: '   Trimmed todo   ' }); // Should trim

    // Invalid descriptions
    assert.throws(() => new Todo({}), /description is required/);
    assert.throws(() => new Todo({ description: '' }), /cannot be empty/);
    assert.throws(() => new Todo({ description: '   ' }), /cannot be empty/);
    assert.throws(() => new Todo({ description: 123 }), /must be a string/);
    assert.throws(() => new Todo({ description: 'x'.repeat(1001) }), /cannot exceed 1000 characters/);
  });

  // Test 4: Priority validation
  runTest('Priority validation', () => {
    // Valid priorities
    new Todo({ description: 'Test', priority: 'low' });
    new Todo({ description: 'Test', priority: 'medium' });
    new Todo({ description: 'Test', priority: 'high' });
    new Todo({ description: 'Test', priority: 'HIGH' }); // Should convert to lowercase

    // Invalid priorities
    assert.throws(() => new Todo({ description: 'Test', priority: 'invalid' }), /must be one of/);
    assert.throws(() => new Todo({ description: 'Test', priority: 123 }), /must be a string/);
  });

  // Test 5: Tags validation
  runTest('Tags validation', () => {
    // Valid tags
    new Todo({ description: 'Test', tags: [] });
    new Todo({ description: 'Test', tags: ['work'] });
    new Todo({ description: 'Test', tags: ['work', 'urgent'] });

    // Should trim and filter empty tags
    const todo = new Todo({
      description: 'Test',
      tags: ['  work  ', '', 'urgent', '   ']
    });
    assert(todo.tags.length === 2, 'Should filter empty tags');
    assert(todo.tags.includes('work'), 'Should trim tags');
    assert(todo.tags.includes('urgent'), 'Should include non-empty tags');

    // Should remove duplicates
    const todoWithDupes = new Todo({
      description: 'Test',
      tags: ['work', 'work', 'urgent']
    });
    assert(todoWithDupes.tags.length === 2, 'Should remove duplicates');

    // Invalid tags
    assert.throws(() => new Todo({ description: 'Test', tags: 'not-array' }), /Tags must be an array/);
    assert.throws(() => new Todo({ description: 'Test', tags: [123] }), /All tags must be strings/);
    assert.throws(() => new Todo({ description: 'Test', tags: ['x'.repeat(51)] }), /Tags cannot exceed 50 characters/);
    assert.throws(() => new Todo({
      description: 'Test',
      tags: Array(11).fill('tag')
    }), /Cannot have more than 10 tags/);
  });

  // Test 6: Due date validation
  runTest('Due date validation', () => {
    // Valid due dates
    new Todo({ description: 'Test', dueDate: '2024-12-31T23:59:59Z' });
    new Todo({ description: 'Test' }); // No due date should work

    // Invalid due dates
    assert.throws(() => new Todo({ description: 'Test', dueDate: 'invalid-date' }), /valid ISO date string/);
    assert.throws(() => new Todo({ description: 'Test', dueDate: 123 }), /must be a string/);
  });

  // Test 7: Completion consistency
  runTest('Completion consistency', () => {
    // Completed todo without completedAt should auto-set
    const completedTodo = new Todo({
      description: 'Test',
      completed: true
    });
    assert(completedTodo.completedAt !== undefined, 'Should auto-set completedAt for completed todo');

    // Incomplete todo with completedAt should clear it
    const incompleteTodo = new Todo({
      description: 'Test',
      completed: false,
      completedAt: '2024-01-01T00:00:00Z'
    });
    assert(incompleteTodo.completedAt === undefined, 'Should clear completedAt for incomplete todo');
  });

  // Test 8: Method chaining
  runTest('Method chaining', () => {
    const todo = new Todo({ description: 'Test' });

    const result = todo
      .markCompleted()
      .updatePriority('high')
      .addTag('work')
      .updateDescription('Updated test');

    assert(result === todo, 'Should return same instance');
    assert(todo.completed === true, 'Should be completed');
    assert(todo.priority === 'high', 'Should have high priority');
    assert(todo.tags.includes('work'), 'Should have work tag');
    assert(todo.description === 'Updated test', 'Should have updated description');
  });

  // Test 9: Completion methods
  runTest('Completion methods', () => {
    const todo = new Todo({ description: 'Test' });

    // Mark completed
    todo.markCompleted();
    assert(todo.completed === true, 'Should be completed');
    assert(todo.completedAt !== undefined, 'Should have completedAt');

    // Mark incomplete
    todo.markIncomplete();
    assert(todo.completed === false, 'Should be incomplete');
    assert(todo.completedAt === undefined, 'Should not have completedAt');
  });

  // Test 10: Tag manipulation
  runTest('Tag manipulation', () => {
    const todo = new Todo({ description: 'Test', tags: ['existing'] });

    // Add tag
    todo.addTag('new');
    assert(todo.tags.includes('new'), 'Should have new tag');

    // Don't add duplicate
    todo.addTag('existing');
    const existingCount = todo.tags.filter(t => t === 'existing').length;
    assert(existingCount === 1, 'Should not add duplicate tag');

    // Remove tag
    todo.removeTag('existing');
    assert(!todo.tags.includes('existing'), 'Should remove tag');

    // Invalid tag addition
    assert.throws(() => todo.addTag(''), /cannot be empty/);
    assert.throws(() => todo.addTag(123), /must be a string/);
  });

  // Test 11: Due date utilities
  runTest('Due date utilities', () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Overdue todo
    const overdueTodo = new Todo({
      description: 'Overdue',
      dueDate: yesterday.toISOString()
    });
    assert(overdueTodo.isOverdue() === true, 'Should be overdue');

    // Due today
    const dueTodayTodo = new Todo({
      description: 'Due today',
      dueDate: today.toISOString()
    });
    assert(dueTodayTodo.isDueToday() === true, 'Should be due today');

    // Due this week
    const dueThisWeekTodo = new Todo({
      description: 'Due this week',
      dueDate: tomorrow.toISOString()
    });
    assert(dueThisWeekTodo.isDueThisWeek() === true, 'Should be due this week');

    // Days until due
    assert(typeof overdueTodo.getDaysUntilDue() === 'number', 'Should return number of days');

    // No due date
    const noDueTodo = new Todo({ description: 'No due date' });
    assert(noDueTodo.isOverdue() === false, 'Should not be overdue without due date');
    assert(noDueTodo.isDueToday() === false, 'Should not be due today without due date');
    assert(noDueTodo.getDaysUntilDue() === null, 'Should return null for days until due');

    // Completed todos should not be overdue/due
    const completedOverdue = new Todo({
      description: 'Completed overdue',
      completed: true,
      dueDate: yesterday.toISOString()
    });
    assert(completedOverdue.isOverdue() === false, 'Completed todo should not be overdue');
  });

  // Test 12: Search functionality
  runTest('Search functionality', () => {
    const todo = new Todo({
      description: 'Buy groceries for dinner',
      tags: ['shopping', 'food']
    });

    // Search in description
    assert(todo.matchesQuery('groceries') === true, 'Should match description');
    assert(todo.matchesQuery('DINNER') === true, 'Should be case insensitive');

    // Search in tags
    assert(todo.matchesQuery('shopping') === true, 'Should match tags');
    assert(todo.matchesQuery('food') === true, 'Should match tags');

    // No match
    assert(todo.matchesQuery('work') === false, 'Should not match unrelated query');

    // Empty query should match
    assert(todo.matchesQuery('') === true, 'Empty query should match');
    assert(todo.matchesQuery() === true, 'Undefined query should match');
  });

  // Test 13: Serialization
  runTest('Serialization', () => {
    const originalTodo = new Todo({
      id: 1,
      description: 'Test todo',
      completed: true,
      priority: 'high',
      tags: ['work'],
      dueDate: '2024-12-31T23:59:59Z'
    });

    // toObject
    const obj = originalTodo.toObject();
    assert(typeof obj === 'object', 'Should return object');
    assert(obj.id === 1, 'Should include id');
    assert(obj.description === 'Test todo', 'Should include description');

    // toJSON
    const json = originalTodo.toJSON();
    assert(typeof json === 'string', 'Should return JSON string');

    // fromObject
    const todoFromObj = Todo.fromObject(obj);
    assert(todoFromObj.description === originalTodo.description, 'Should recreate from object');

    // fromJSON
    const todoFromJson = Todo.fromJSON(json);
    assert(todoFromJson.description === originalTodo.description, 'Should recreate from JSON');

    // Invalid JSON
    assert.throws(() => Todo.fromJSON('invalid json'), /Invalid JSON/);
  });

  // Test 14: Cloning
  runTest('Cloning', () => {
    const original = new Todo({
      description: 'Original todo',
      tags: ['original']
    });

    const clone = original.clone();
    assert(clone !== original, 'Should be different instance');
    assert(clone.description === original.description, 'Should have same description');
    assert(clone.tags.includes('original'), 'Should have same tags');

    // Modifying clone should not affect original
    clone.addTag('modified');
    assert(!original.tags.includes('modified'), 'Original should not be affected');
  });

  // Test 15: Validation utility
  runTest('Validation utility', () => {
    // Valid data
    assert(Todo.isValidTodoData({ description: 'Valid' }) === true, 'Should validate valid data');

    // Invalid data
    assert(Todo.isValidTodoData({}) === false, 'Should reject invalid data');
    assert(Todo.isValidTodoData({ description: '' }) === false, 'Should reject empty description');
  });

  // Test 16: Schema
  runTest('Schema definition', () => {
    const schema = Todo.getSchema();
    assert(typeof schema === 'object', 'Should return schema object');
    assert(schema.description.required === true, 'Description should be required in schema');
    assert(Array.isArray(schema.priority.enum), 'Priority should have enum values');
  });

  // Test 17: Edge cases
  runTest('Edge cases', () => {
    // Very long description at limit
    const longDesc = 'x'.repeat(1000);
    const todoWithLongDesc = new Todo({ description: longDesc });
    assert(todoWithLongDesc.description.length === 1000, 'Should accept 1000 char description');

    // Maximum tags
    const maxTags = Array.from({ length: 10 }, (_, i) => `tag${i}`);
    const todoWithMaxTags = new Todo({ description: 'Test', tags: maxTags });
    assert(todoWithMaxTags.tags.length === 10, 'Should accept 10 tags');

    // Tag at character limit
    const maxLengthTag = 'x'.repeat(50);
    const todoWithMaxTag = new Todo({ description: 'Test', tags: [maxLengthTag] });
    assert(todoWithMaxTag.tags[0].length === 50, 'Should accept 50 char tag');
  });

  console.log('\n🎉 All Todo data model tests passed!');

} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}