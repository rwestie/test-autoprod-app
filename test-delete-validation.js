#!/usr/bin/env node

const { TodoCore } = require('./todo-core');
const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

/**
 * Comprehensive test suite for delete command parsing and validation
 */

console.log('🧪 Running Delete Command Validation Tests...\n');

const testCases = [
  // Basic validation tests
  {
    name: 'No arguments provided',
    command: 'node index.js delete',
    expectError: true,
    expectedMessage: 'Delete command requires a todo ID'
  },
  {
    name: 'Empty string argument',
    command: 'node index.js delete ""',
    expectError: true,
    expectedMessage: 'Todo ID cannot be empty'
  },
  {
    name: 'Whitespace only argument',
    command: 'node index.js delete "   "',
    expectError: true,
    expectedMessage: 'Todo ID cannot be empty'
  },

  // Number format validation
  {
    name: 'Valid positive integer',
    command: 'node index.js delete 1',
    expectError: false,
    setup: () => addTestTodo('Test todo for validation')
  },
  {
    name: 'Decimal number',
    command: 'node index.js delete 1.5',
    expectError: true,
    expectedMessage: 'Todo ID must be a whole number'
  },
  {
    name: 'Negative number',
    command: 'node index.js delete -5',
    expectError: true,
    expectedMessage: 'Todo ID must be a positive number'
  },
  {
    name: 'Zero',
    command: 'node index.js delete 0',
    expectError: true,
    expectedMessage: 'Todo ID must be greater than 0'
  },
  {
    name: 'Very large number',
    command: 'node index.js delete 9007199254740992',
    expectError: true,
    expectedMessage: 'Todo ID is too large'
  },

  // Invalid character tests
  {
    name: 'Letters only',
    command: 'node index.js delete abc',
    expectError: true,
    expectedMessage: 'Todo ID cannot contain letters'
  },
  {
    name: 'Mixed letters and numbers',
    command: 'node index.js delete todo5',
    expectError: true,
    expectedMessage: 'Todo ID cannot contain letters'
  },
  {
    name: 'Special characters',
    command: 'node index.js delete "#5"',
    expectError: true,
    expectedMessage: 'Todo ID cannot contain special characters'
  },
  {
    name: 'Special characters at end',
    command: 'node index.js delete "5!"',
    expectError: true,
    expectedMessage: 'Todo ID cannot contain special characters'
  },

  // Multiple arguments
  {
    name: 'Too many arguments',
    command: 'node index.js delete 1 2',
    expectError: true,
    expectedMessage: 'Too many arguments provided'
  },
  {
    name: 'Multiple arguments with mixed types',
    command: 'node index.js delete 1 abc 3',
    expectError: true,
    expectedMessage: 'Too many arguments provided'
  },

  // Edge cases with quotes and spaces
  {
    name: 'Quoted valid number',
    command: 'node index.js delete "1"',
    expectError: false,
    setup: () => addTestTodo('Test todo for quoted validation')
  },
  {
    name: 'Number with leading/trailing spaces',
    command: 'node index.js delete " 1 "',
    expectError: false,
    setup: () => addTestTodo('Test todo for space validation')
  },

  // Alias commands
  {
    name: 'Remove alias with valid ID',
    command: 'node index.js remove 1',
    expectError: false,
    setup: () => addTestTodo('Test todo for remove alias')
  },
  {
    name: 'RM alias with invalid ID',
    command: 'node index.js rm abc',
    expectError: true,
    expectedMessage: 'Todo ID cannot contain letters'
  }
];

async function addTestTodo(description) {
  const core = new TodoCore();
  return core.addTodo(description);
}

async function clearTodos() {
  const core = new TodoCore();
  const todos = core.listTodos();
  if (todos.length > 0) {
    core.bulkDeleteAll();
  }
}

async function runTest(testCase) {
  try {
    // Setup if needed
    if (testCase.setup) {
      await testCase.setup();
    }

    // Run the command
    const { stdout, stderr } = await execAsync(testCase.command);
    const output = stderr || stdout;

    if (testCase.expectError) {
      // Test should have failed
      if (!stderr) {
        console.log(`❌ ${testCase.name}: Expected error but command succeeded`);
        console.log(`   Output: ${output.trim()}\n`);
        return false;
      }

      // Check if expected message is in the error output
      if (!output.includes(testCase.expectedMessage)) {
        console.log(`❌ ${testCase.name}: Error message doesn't match`);
        console.log(`   Expected: "${testCase.expectedMessage}"`);
        console.log(`   Got: "${output.trim()}"\n`);
        return false;
      }

      console.log(`✅ ${testCase.name}: Correctly failed with expected error`);
      return true;
    } else {
      // Test should have succeeded
      if (stderr) {
        console.log(`❌ ${testCase.name}: Expected success but got error`);
        console.log(`   Error: ${stderr.trim()}\n`);
        return false;
      }

      console.log(`✅ ${testCase.name}: Successfully executed`);
      return true;
    }
  } catch (error) {
    if (testCase.expectError) {
      // Check if the error message contains what we expect
      if (error.stderr && error.stderr.includes(testCase.expectedMessage)) {
        console.log(`✅ ${testCase.name}: Correctly failed with expected error`);
        return true;
      } else {
        console.log(`❌ ${testCase.name}: Error but wrong message`);
        console.log(`   Expected: "${testCase.expectedMessage}"`);
        console.log(`   Got: "${error.stderr ? error.stderr.trim() : error.message}"\n`);
        return false;
      }
    } else {
      console.log(`❌ ${testCase.name}: Unexpected error`);
      console.log(`   Error: ${error.message}\n`);
      return false;
    }
  }
}

async function runAllTests() {
  let passed = 0;
  let total = testCases.length;

  // Clear any existing todos before starting
  await clearTodos();

  for (const testCase of testCases) {
    const result = await runTest(testCase);
    if (result) passed++;

    // Clean up after each test
    await clearTodos();
  }

  console.log(`\n📊 Test Results: ${passed}/${total} tests passed`);

  if (passed === total) {
    console.log('🎉 All delete command validation tests passed!');
    process.exit(0);
  } else {
    console.log(`❌ ${total - passed} tests failed`);
    process.exit(1);
  }
}

// Run the tests
runAllTests().catch(error => {
  console.error('💥 Test runner error:', error);
  process.exit(1);
});