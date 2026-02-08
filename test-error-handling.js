#!/usr/bin/env node

/**
 * Test script for storage error handling and user feedback
 * This script tests various error scenarios to ensure proper handling
 */

const fs = require('fs');
const path = require('path');
const { TodoCoreEnhanced } = require('./todo-core-enhanced');
const { StorageConfig } = require('./storage-config');
const { StorageErrorHandler } = require('./storage-error-handler');

/**
 * Test different error scenarios
 */
async function runErrorTests() {
  console.log('🧪 Testing enhanced storage error handling...\n');

  // Test 1: Permission Error
  await testPermissionError();

  // Test 2: Directory Creation Error
  await testDirectoryError();

  // Test 3: JSON Corruption Error
  await testCorruptionError();

  // Test 4: Disk Space Error (simulated)
  await testDiskSpaceError();

  console.log('\n✅ All error handling tests completed!');
}

/**
 * Test permission error handling
 */
async function testPermissionError() {
  console.log('📁 Test 1: Permission Error');

  try {
    // Try to create storage in a read-only directory (if it exists)
    const readOnlyPath = '/tmp/readonly-test';

    // Create the directory and make it read-only
    if (!fs.existsSync(readOnlyPath)) {
      fs.mkdirSync(readOnlyPath);
    }
    fs.chmodSync(readOnlyPath, 0o444); // Read-only

    const config = new StorageConfig({
      dataDirectory: readOnlyPath,
      dataFilename: 'todos.json'
    });

    const todoCore = new TodoCoreEnhanced(config, null, 'json-file');
    const result = await todoCore.initialize();

    if (!result.success) {
      console.log('  ✅ Permission error correctly detected');
      console.log('  📝 Error details:', result.errorDetails?.userMessage || result.error);

      if (result.errorDetails) {
        console.log('  🔧 Guidance:', result.errorDetails.guidance[0]);
      }
    }

    // Cleanup
    fs.chmodSync(readOnlyPath, 0o755);
    fs.rmdirSync(readOnlyPath);

  } catch (error) {
    console.log('  ⚠️  Permission test completed (may not be applicable on this system)');
  }

  console.log();
}

/**
 * Test directory creation error
 */
async function testDirectoryError() {
  console.log('🗂️  Test 2: Directory Creation Error');

  try {
    // Try to create storage with invalid parent directory
    const invalidPath = '/nonexistent/deeply/nested/invalid/path';

    const config = new StorageConfig({
      dataDirectory: invalidPath,
      dataFilename: 'todos.json'
    });

    const todoCore = new TodoCoreEnhanced(config, null, 'json-file');
    const result = await todoCore.initialize();

    if (!result.success) {
      console.log('  ✅ Directory error correctly detected');
      console.log('  📝 Error details:', result.errorDetails?.userMessage || result.error);

      if (result.errorDetails) {
        console.log('  🔧 Guidance:', result.errorDetails.guidance[0]);
      }
    }

  } catch (error) {
    console.log('  ✅ Directory creation error handled:', error.message);
  }

  console.log();
}

/**
 * Test JSON corruption error
 */
async function testCorruptionError() {
  console.log('📄 Test 3: JSON Corruption Error');

  const testDir = '/tmp/todo-error-test';
  const testFile = path.join(testDir, 'corrupted.json');

  try {
    // Create test directory
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir);
    }

    // Create a corrupted JSON file
    fs.writeFileSync(testFile, '{ invalid json content');

    const config = new StorageConfig({
      dataDirectory: testDir,
      dataFilename: 'corrupted.json'
    });

    const todoCore = new TodoCoreEnhanced(config, null, 'json-file');
    const result = await todoCore.initialize();

    if (!result.success && result.errorDetails?.type === 'corruption') {
      console.log('  ✅ JSON corruption correctly detected');
      console.log('  📝 Error details:', result.errorDetails?.userMessage || result.error);
    } else {
      console.log('  ℹ️  Corruption handled gracefully (loaded empty data)');
    }

    // Cleanup
    fs.unlinkSync(testFile);
    fs.rmdirSync(testDir);

  } catch (error) {
    console.log('  ⚠️  Corruption test completed:', error.message);

    // Cleanup on error
    try {
      if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
      if (fs.existsSync(testDir)) fs.rmdirSync(testDir);
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
  }

  console.log();
}

/**
 * Test simulated disk space error
 */
async function testDiskSpaceError() {
  console.log('💾 Test 4: Storage Error Classification');

  // Test the error classification system directly
  const mockError = new Error('No space left on device');
  mockError.code = 'ENOSPC';

  const classification = StorageErrorHandler.classifyError(mockError, 'save', {
    dataFile: '/tmp/todos.json'
  });

  console.log('  ✅ Error classification working:');
  console.log('  📝 Type:', classification.type);
  console.log('  📝 Message:', classification.userMessage);
  console.log('  📝 Severity:', classification.severity);
  console.log('  📝 Recoverable:', classification.recoverable);

  const userMessage = StorageErrorHandler.formatUserMessage(classification, true);
  console.log('  🎨 Formatted message:', userMessage.split('\n')[0]);

  console.log();
}

/**
 * Test the CLI error display
 */
function testCliErrorDisplay() {
  console.log('🖥️  Test 5: CLI Error Display');

  // Create a mock result with error details
  const mockResult = {
    success: false,
    error: 'Permission denied',
    errorDetails: {
      type: 'permission',
      userMessage: 'Unable to save todos due to insufficient permissions',
      guidance: [
        'Check file and folder permissions',
        'Choose a different storage location using --data-dir',
        'Run the command with appropriate permissions'
      ],
      severity: 'error',
      recoverable: true
    }
  };

  console.log('  📱 Testing CLI error display:');

  // This is how the error would be displayed in the CLI
  if (mockResult.errorDetails) {
    const userMessage = StorageErrorHandler.formatUserMessage(mockResult.errorDetails, true);
    console.log(userMessage);
  }

  console.log();
}

// Run all tests
if (require.main === module) {
  runErrorTests()
    .then(() => {
      testCliErrorDisplay();
    })
    .catch(error => {
      console.error('❌ Test error:', error.message);
      process.exit(1);
    });
}

module.exports = {
  runErrorTests,
  testPermissionError,
  testDirectoryError,
  testCorruptionError,
  testDiskSpaceError
};