#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Helper function to run CLI commands
function runCommand(args, input = null) {
  return new Promise((resolve) => {
    const child = spawn('node', ['index.js', ...args], {
      stdio: input ? ['pipe', 'pipe', 'pipe'] : ['inherit', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });

    if (input) {
      child.stdin.write(input);
      child.stdin.end();
    }
  });
}

// Helper function to clean up test data
function cleanup() {
  const testFile = './test-todos-force-delete.json';
  if (fs.existsSync(testFile)) {
    fs.unlinkSync(testFile);
  }
}

// Test runner
async function runTests() {
  console.log('🧪 Testing Force Delete Functionality');
  console.log('=====================================');

  let testsPassed = 0;
  let totalTests = 0;

  // Test 1: Force delete should work without confirmation
  totalTests++;
  try {
    console.log('\n📋 Test 1: Force delete with --force flag');

    // First add a todo via CLI
    await runCommand(['add', 'Test todo for force delete']);

    // Then try to delete it with --force
    const result = await runCommand(['delete', '1', '--force']);

    if (result.code === 0 && result.stdout.includes('Force deleting todo') && result.stdout.includes('Successfully deleted')) {
      console.log('✅ Test 1 PASSED: Force delete with --force works');
      testsPassed++;
    } else {
      console.log('❌ Test 1 FAILED: Force delete with --force failed');
      console.log('Code:', result.code);
      console.log('Stdout:', result.stdout);
      console.log('Stderr:', result.stderr);
    }
  } catch (error) {
    console.log('❌ Test 1 FAILED: Error during test -', error.message);
  }

  // Test 2: Force delete should work with -f flag
  totalTests++;
  try {
    console.log('\n📋 Test 2: Force delete with -f flag');

    // First add a todo via CLI
    await runCommand(['add', 'Test todo for force delete with -f']);

    // Get the ID of the last added todo
    const listResult = await runCommand(['list']);
    const match = listResult.stdout.match(/#(\d+):/);
    const todoId = match ? match[1] : '1';

    // Then try to delete it with -f
    const result = await runCommand(['delete', todoId, '-f']);

    if (result.code === 0 && result.stdout.includes('Force deleting todo') && result.stdout.includes('Successfully deleted')) {
      console.log('✅ Test 2 PASSED: Force delete with -f works');
      testsPassed++;
    } else {
      console.log('❌ Test 2 FAILED: Force delete with -f failed');
      console.log('Code:', result.code);
      console.log('Stdout:', result.stdout);
      console.log('Stderr:', result.stderr);
    }
  } catch (error) {
    console.log('❌ Test 2 FAILED: Error during test -', error.message);
  }

  // Test 3: Regular delete should still ask for confirmation
  totalTests++;
  try {
    console.log('\n📋 Test 3: Regular delete should ask for confirmation');

    // First add a todo via CLI
    await runCommand(['add', 'Test todo for regular delete']);

    // Get the ID of the last added todo
    const listResult = await runCommand(['list']);
    const match = listResult.stdout.match(/#(\d+):/);
    const todoId = match ? match[1] : '1';

    // Then try to delete it normally and refuse
    const result = await runCommand(['delete', todoId], 'n\n');  // Send 'n' to refuse deletion

    if (result.code === 0 && result.stdout.includes('Are you sure') && result.stdout.includes('cancelled')) {
      console.log('✅ Test 3 PASSED: Regular delete asks for confirmation');
      testsPassed++;
    } else {
      console.log('❌ Test 3 FAILED: Regular delete did not ask for confirmation');
      console.log('Code:', result.code);
      console.log('Stdout:', result.stdout);
      console.log('Stderr:', result.stderr);
    }
  } catch (error) {
    console.log('❌ Test 3 FAILED: Error during test -', error.message);
  }

  // Test 4: Test flag placement flexibility (flag before ID)
  totalTests++;
  try {
    console.log('\n📋 Test 4: Force delete with flag before ID');

    // First add a todo via CLI
    await runCommand(['add', 'Test todo for flag before ID']);

    // Get the ID of the last added todo
    const listResult = await runCommand(['list']);
    const match = listResult.stdout.match(/#(\d+):/);
    const todoId = match ? match[1] : '1';

    // Then try to delete it with flag before ID
    const result = await runCommand(['delete', '--force', todoId]);

    if (result.code === 0 && result.stdout.includes('Force deleting todo') && result.stdout.includes('Successfully deleted')) {
      console.log('✅ Test 4 PASSED: Force delete with flag before ID works');
      testsPassed++;
    } else {
      console.log('❌ Test 4 FAILED: Force delete with flag before ID failed');
      console.log('Code:', result.code);
      console.log('Stdout:', result.stdout);
      console.log('Stderr:', result.stderr);
    }
  } catch (error) {
    console.log('❌ Test 4 FAILED: Error during test -', error.message);
  }

  // Test 5: Test invalid ID with force
  totalTests++;
  try {
    console.log('\n📋 Test 5: Force delete with invalid ID');
    const result = await runCommand(['delete', '999', '--force']);

    if (result.code === 1 && result.stderr.includes('Todo with ID 999 not found')) {
      console.log('✅ Test 5 PASSED: Force delete with invalid ID properly fails');
      testsPassed++;
    } else {
      console.log('❌ Test 5 FAILED: Force delete with invalid ID did not fail properly');
      console.log('Code:', result.code);
      console.log('Stdout:', result.stdout);
      console.log('Stderr:', result.stderr);
    }
  } catch (error) {
    console.log('❌ Test 5 FAILED: Error during test -', error.message);
  }

  // Cleanup
  cleanup();

  // Summary
  console.log('\n🏁 Test Summary');
  console.log('===============');
  console.log(`Tests passed: ${testsPassed}/${totalTests}`);

  if (testsPassed === totalTests) {
    console.log('🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log(`❌ ${totalTests - testsPassed} test(s) failed`);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests };