#!/usr/bin/env node

/**
 * Test suite for list filter functionality
 */

const assert = require('assert');
const { TodoCoreEnhanced } = require('./todo-core-enhanced');
const { StorageConfig } = require('./storage-config');

/**
 * Test data helper - creates todos with different properties
 */
function createTestTodos() {
  return [
    {
      id: 1,
      description: "High priority urgent task",
      completed: false,
      priority: "high",
      tags: ["urgent", "work"],
      createdAt: "2026-02-07T10:00:00.000Z"
    },
    {
      id: 2,
      description: "Medium priority work task",
      completed: false,
      priority: "medium",
      tags: ["work"],
      createdAt: "2026-02-07T11:00:00.000Z"
    },
    {
      id: 3,
      description: "Low priority personal task",
      completed: true,
      priority: "low",
      tags: ["personal"],
      createdAt: "2026-02-07T12:00:00.000Z",
      completedAt: "2026-02-07T15:00:00.000Z"
    },
    {
      id: 4,
      description: "Completed work project",
      completed: true,
      priority: "high",
      tags: ["work", "project"],
      createdAt: "2026-02-07T13:00:00.000Z",
      completedAt: "2026-02-07T16:00:00.000Z"
    },
    {
      id: 5,
      description: "Meeting with team",
      completed: false,
      priority: "medium",
      tags: ["meeting", "work"],
      createdAt: "2026-02-07T14:00:00.000Z"
    }
  ];
}

/**
 * Apply filters to todos array (mimics the logic in index.js)
 */
function applyFilters(todos, filter = {}) {
  let filteredTodos = todos;

  if (filter.status) {
    if (filter.status === 'pending') {
      filteredTodos = filteredTodos.filter(todo => !todo.completed);
    } else if (filter.status === 'completed') {
      filteredTodos = filteredTodos.filter(todo => todo.completed);
    }
  }

  if (filter.priority) {
    filteredTodos = filteredTodos.filter(todo => todo.priority === filter.priority);
  }

  if (filter.tag) {
    filteredTodos = filteredTodos.filter(todo =>
      todo.tags && todo.tags.includes(filter.tag)
    );
  }

  if (filter.search) {
    const searchTerm = filter.search.toLowerCase();
    filteredTodos = filteredTodos.filter(todo =>
      todo.description.toLowerCase().includes(searchTerm)
    );
  }

  return filteredTodos;
}

/**
 * Test suite runner
 */
async function runTests() {
  console.log('🧪 Running List Filter Tests...');
  console.log('');

  const testTodos = createTestTodos();
  let testsRun = 0;
  let testsPassed = 0;

  // Helper function for test assertions
  function test(description, actual, expected) {
    testsRun++;
    try {
      if (Array.isArray(expected)) {
        assert.deepStrictEqual(actual.map(t => t.id).sort(), expected.sort());
      } else {
        assert.strictEqual(actual, expected);
      }
      console.log(`✅ ${description}`);
      testsPassed++;
    } catch (error) {
      console.log(`❌ ${description}`);
      console.log(`   Expected: ${JSON.stringify(expected)}`);
      console.log(`   Actual: ${JSON.stringify(Array.isArray(actual) ? actual.map(t => t.id) : actual)}`);
    }
  }

  // Test 1: No filters (should return all todos)
  let result = applyFilters(testTodos);
  test('No filters returns all todos', result, [1, 2, 3, 4, 5]);

  // Test 2: Filter by pending status
  result = applyFilters(testTodos, { status: 'pending' });
  test('Filter by pending status', result, [1, 2, 5]);

  // Test 3: Filter by completed status
  result = applyFilters(testTodos, { status: 'completed' });
  test('Filter by completed status', result, [3, 4]);

  // Test 4: Filter by high priority
  result = applyFilters(testTodos, { priority: 'high' });
  test('Filter by high priority', result, [1, 4]);

  // Test 5: Filter by medium priority
  result = applyFilters(testTodos, { priority: 'medium' });
  test('Filter by medium priority', result, [2, 5]);

  // Test 6: Filter by low priority
  result = applyFilters(testTodos, { priority: 'low' });
  test('Filter by low priority', result, [3]);

  // Test 7: Filter by work tag
  result = applyFilters(testTodos, { tag: 'work' });
  test('Filter by work tag', result, [1, 2, 4, 5]);

  // Test 8: Filter by personal tag
  result = applyFilters(testTodos, { tag: 'personal' });
  test('Filter by personal tag', result, [3]);

  // Test 9: Filter by urgent tag
  result = applyFilters(testTodos, { tag: 'urgent' });
  test('Filter by urgent tag', result, [1]);

  // Test 10: Search for "task"
  result = applyFilters(testTodos, { search: 'task' });
  test('Search for "task"', result, [1, 2, 3]);

  // Test 11: Search for "meeting"
  result = applyFilters(testTodos, { search: 'meeting' });
  test('Search for "meeting"', result, [5]);

  // Test 12: Search for "project"
  result = applyFilters(testTodos, { search: 'project' });
  test('Search for "project"', result, [4]);

  // Test 13: Search is case insensitive
  result = applyFilters(testTodos, { search: 'URGENT' });
  test('Search is case insensitive', result, [1]);

  // Test 14: Combine filters - pending and high priority
  result = applyFilters(testTodos, { status: 'pending', priority: 'high' });
  test('Combine pending + high priority', result, [1]);

  // Test 15: Combine filters - work tag and completed status
  result = applyFilters(testTodos, { tag: 'work', status: 'completed' });
  test('Combine work tag + completed status', result, [4]);

  // Test 16: Combine filters - medium priority and search
  result = applyFilters(testTodos, { priority: 'medium', search: 'team' });
  test('Combine medium priority + search "team"', result, [5]);

  // Test 17: Combine filters - no results
  result = applyFilters(testTodos, { status: 'pending', tag: 'personal' });
  test('Combine pending + personal tag (no results)', result, []);

  // Test 18: Filter with non-existent tag
  result = applyFilters(testTodos, { tag: 'nonexistent' });
  test('Filter by non-existent tag', result, []);

  // Test 19: Filter with non-existent priority
  result = applyFilters(testTodos, { priority: 'nonexistent' });
  test('Filter by non-existent priority', result, []);

  // Test 20: Search with no matches
  result = applyFilters(testTodos, { search: 'xyznomatch' });
  test('Search with no matches', result, []);

  console.log('');
  console.log(`📊 Test Summary: ${testsPassed}/${testsRun} tests passed`);

  if (testsPassed === testsRun) {
    console.log('🎉 All filter tests passed!');
    return true;
  } else {
    console.log('❌ Some filter tests failed');
    return false;
  }
}

// Run the tests if this file is executed directly
if (require.main === module) {
  runTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('❌ Test execution failed:', error.message);
    process.exit(1);
  });
}

module.exports = { runTests, applyFilters, createTestTodos };