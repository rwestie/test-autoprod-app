#!/usr/bin/env node

const assert = require('assert');
const { spawn } = require('child_process');
const fs = require('fs');

console.log('🧪 Running confirmation prompt tests...');

// Helper function to run the todo app with input
function runTodoApp(args, inputs) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['index.js', ...args], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let errorOutput = '';

    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    child.on('close', (code) => {
      resolve({
        code,
        output,
        errorOutput
      });
    });

    child.on('error', (error) => {
      reject(error);
    });

    // Send inputs to stdin
    inputs.forEach(input => {
      child.stdin.write(input + '\n');
    });
    child.stdin.end();
  });
}

// Test setup - ensure we have test data
async function setupTestData() {
  console.log('📋 Setting up test data...');

  // Create some test todos
  const result1 = await runTodoApp(['add', 'Test todo 1'], []);
  const result2 = await runTodoApp(['add', 'Test todo 2'], []);
  const result3 = await runTodoApp(['add', 'Test todo 3'], []);

  // Get current list to see what IDs we have
  const listResult = await runTodoApp(['list'], []);
  console.log('Current todos after setup:', listResult.output);

  console.log('✅ Test data setup complete');
}

// Test 1: Delete with 'y' confirmation should work
async function testDeleteWithYes() {
  console.log('🧪 Test 1: Delete with "y" confirmation...');

  // Get the list to find an available ID
  const listResult = await runTodoApp(['list'], []);
  const todoMatch = listResult.output.match(/#(\d+):/);
  assert(todoMatch, 'Should have at least one todo available');
  const todoId = todoMatch[1];

  console.log(`Using todo ID: ${todoId}`);

  const result = await runTodoApp(['delete', todoId], ['y']);

  assert(result.code === 0, `Delete with "y" should succeed. Got exit code ${result.code}. Output: ${result.output}. Error: ${result.errorOutput}`);
  assert(result.output.includes('You are about to delete'), 'Should show delete confirmation');
  assert(result.output.includes('Successfully deleted'), 'Should confirm deletion');
  assert(!result.output.includes('Delete operation cancelled'), 'Should not show cancellation message');

  console.log('✅ Test 1 passed');
}

// Test 2: Delete with 'yes' confirmation should work
async function testDeleteWithYesWord() {
  console.log('🧪 Test 2: Delete with "yes" confirmation...');

  // Get the list to find an available ID
  const listResult = await runTodoApp(['list'], []);
  const todoMatch = listResult.output.match(/#(\d+):/);
  assert(todoMatch, 'Should have at least one todo available');
  const todoId = todoMatch[1];

  const result = await runTodoApp(['delete', todoId], ['yes']);

  assert(result.code === 0, 'Delete with "yes" should succeed');
  assert(result.output.includes('You are about to delete'), 'Should show delete confirmation');
  assert(result.output.includes('Successfully deleted'), 'Should confirm deletion');
  assert(!result.output.includes('Delete operation cancelled'), 'Should not show cancellation message');

  console.log('✅ Test 2 passed');
}

// Test 3: Delete with 'n' should cancel
async function testDeleteWithNo() {
  console.log('🧪 Test 3: Delete with "n" cancellation...');

  // Get the list to find an available ID
  const listResult = await runTodoApp(['list'], []);
  const todoMatch = listResult.output.match(/#(\d+):/);
  assert(todoMatch, 'Should have at least one todo available');
  const todoId = todoMatch[1];

  const result = await runTodoApp(['delete', todoId], ['n']);

  assert(result.code === 0, 'Delete cancellation should not be an error');
  assert(result.output.includes('You are about to delete'), 'Should show delete confirmation');
  assert(result.output.includes('Delete operation cancelled'), 'Should show cancellation message');
  assert(!result.output.includes('Successfully deleted'), 'Should not show deletion confirmation');

  console.log('✅ Test 3 passed');
}

// Test 4: Delete with 'no' should cancel
async function testDeleteWithNoWord() {
  console.log('🧪 Test 4: Delete with "no" cancellation...');

  // Get the list to find an available ID
  const listResult = await runTodoApp(['list'], []);
  const todoMatch = listResult.output.match(/#(\d+):/);
  assert(todoMatch, 'Should have at least one todo available');
  const todoId = todoMatch[1];

  const result = await runTodoApp(['delete', todoId], ['no']);

  assert(result.code === 0, 'Delete cancellation should not be an error');
  assert(result.output.includes('You are about to delete'), 'Should show delete confirmation');
  assert(result.output.includes('Delete operation cancelled'), 'Should show cancellation message');
  assert(!result.output.includes('Successfully deleted'), 'Should not show deletion confirmation');

  console.log('✅ Test 4 passed');
}

// Test 5: Delete with empty input (default 'no') should cancel
async function testDeleteWithEmptyInput() {
  console.log('🧪 Test 5: Delete with empty input (default no)...');

  // Get the list to find an available ID
  const listResult = await runTodoApp(['list'], []);
  const todoMatch = listResult.output.match(/#(\d+):/);
  assert(todoMatch, 'Should have at least one todo available');
  const todoId = todoMatch[1];

  const result = await runTodoApp(['delete', todoId], ['']);

  assert(result.code === 0, 'Delete cancellation should not be an error');
  assert(result.output.includes('You are about to delete'), 'Should show delete confirmation');
  assert(result.output.includes('Delete operation cancelled'), 'Should show cancellation message');
  assert(!result.output.includes('Successfully deleted'), 'Should not show deletion confirmation');

  console.log('✅ Test 5 passed');
}

// Test 6: Delete non-existent todo should still show error without confirmation
async function testDeleteNonExistent() {
  console.log('🧪 Test 6: Delete non-existent todo...');

  const result = await runTodoApp(['delete', '999'], []);

  assert(result.code === 1, 'Delete non-existent should fail');
  assert(result.errorOutput.includes('Todo with ID 999 not found'), 'Should show not found error');
  assert(!result.output.includes('You are about to delete'), 'Should not show delete confirmation');

  console.log('✅ Test 6 passed');
}

// Test 7: Verify todo details are shown in confirmation
async function testTodoDetailsShown() {
  console.log('🧪 Test 7: Verify todo details shown in confirmation...');

  // Add a new todo to check details
  await runTodoApp(['add', 'Test detailed todo'], []);

  // Get the list to find the ID
  const listResult = await runTodoApp(['list'], []);
  const todoMatch = listResult.output.match(/\[ \] #(\d+): Test detailed todo/);
  assert(todoMatch, 'Should find the test todo in list');
  const todoId = todoMatch[1];

  // Try to delete it and check the details
  const result = await runTodoApp(['delete', todoId], ['n']); // Cancel so we can check details

  assert(result.output.includes(`ID: #${todoId}`), 'Should show todo ID');
  assert(result.output.includes('Description: Test detailed todo'), 'Should show todo description');
  assert(result.output.includes('Status: [ ] Pending'), 'Should show todo status');
  assert(result.output.includes('Created:'), 'Should show creation date');

  console.log('✅ Test 7 passed');
}

// Run all tests
async function runAllTests() {
  try {
    await setupTestData();
    await testDeleteWithYes();
    await testDeleteWithYesWord();
    await testDeleteWithNo();
    await testDeleteWithNoWord();
    await testDeleteWithEmptyInput();
    await testDeleteNonExistent();
    await testTodoDetailsShown();

    console.log('');
    console.log('🎉 All confirmation prompt tests passed!');
    console.log('✅ Deletion confirmation feature is working correctly');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests();
}

module.exports = { runAllTests };