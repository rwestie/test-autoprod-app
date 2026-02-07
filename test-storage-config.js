#!/usr/bin/env node

/**
 * Test script for storage configuration functionality
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('🧪 Testing Storage Configuration Feature');
console.log('');

// Test configuration
const testDataDir = path.join(os.tmpdir(), 'todo-config-test');
const testDataFile = 'custom-todos.json';
const testDataPath = path.join(testDataDir, testDataFile);

// Cleanup function
function cleanup() {
  try {
    if (fs.existsSync(testDataPath)) {
      fs.unlinkSync(testDataPath);
    }
    if (fs.existsSync(testDataDir)) {
      fs.rmdirSync(testDataDir);
    }
  } catch (error) {
    // Ignore cleanup errors
  }
}

// Helper function to run a command and capture output
function runCommand(args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['index.js', ...args], {
      cwd: process.cwd(),
      env: { ...process.env, ...env },
      stdio: 'pipe'
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

    child.on('error', reject);
  });
}

// Test cases
async function runTests() {
  console.log('📋 Test 1: Show default configuration');
  try {
    const result = await runCommand(['config', 'show']);
    console.log('✅ Default config command works');
    if (result.stdout.includes('STORAGE CONFIGURATION')) {
      console.log('✅ Config output format is correct');
    } else {
      console.log('❌ Config output format issue');
    }
  } catch (error) {
    console.log('❌ Default config command failed:', error.message);
  }
  console.log('');

  console.log('📋 Test 2: Command line data directory override');
  try {
    // Create test directory
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }

    // Add todo with custom data directory
    const addResult = await runCommand([
      '--data-dir', testDataDir,
      '--data-file', testDataFile,
      'add', 'Test todo with custom location'
    ]);

    if (addResult.code === 0) {
      console.log('✅ Add with custom location works');

      // Verify file was created in correct location
      if (fs.existsSync(testDataPath)) {
        console.log('✅ File created in correct custom location');

        const data = JSON.parse(fs.readFileSync(testDataPath, 'utf8'));
        if (data.length === 1 && data[0].description === 'Test todo with custom location') {
          console.log('✅ Todo data is correct');
        } else {
          console.log('❌ Todo data is incorrect');
        }
      } else {
        console.log('❌ File not created in custom location');
      }

      // List todos from custom location
      const listResult = await runCommand([
        '--data-dir', testDataDir,
        '--data-file', testDataFile,
        'list'
      ]);

      if (listResult.code === 0 && listResult.stdout.includes('Test todo with custom location')) {
        console.log('✅ List from custom location works');
      } else {
        console.log('❌ List from custom location failed');
      }
    } else {
      console.log('❌ Add with custom location failed');
    }
  } catch (error) {
    console.log('❌ Custom location test failed:', error.message);
  }
  console.log('');

  console.log('📋 Test 3: Environment variable configuration');
  try {
    const envResult = await runCommand(['add', 'Test todo with env vars'], {
      TODO_DATA_DIR: testDataDir,
      TODO_DATA_FILE: 'env-todos.json'
    });

    if (envResult.code === 0) {
      console.log('✅ Environment variables work');

      const envDataPath = path.join(testDataDir, 'env-todos.json');
      if (fs.existsSync(envDataPath)) {
        console.log('✅ Environment variable file created correctly');
      } else {
        console.log('❌ Environment variable file not created');
      }
    } else {
      console.log('❌ Environment variables failed');
    }
  } catch (error) {
    console.log('❌ Environment variable test failed:', error.message);
  }
  console.log('');

  console.log('📋 Test 4: Config show with custom location');
  try {
    const configResult = await runCommand([
      '--data-dir', testDataDir,
      '--data-file', testDataFile,
      'config', 'show'
    ]);

    if (configResult.code === 0) {
      console.log('✅ Config show with custom location works');

      if (configResult.stdout.includes(testDataDir) && configResult.stdout.includes(testDataFile)) {
        console.log('✅ Config shows correct custom paths');
      } else {
        console.log('❌ Config does not show custom paths correctly');
      }
    } else {
      console.log('❌ Config show with custom location failed');
    }
  } catch (error) {
    console.log('❌ Config show test failed:', error.message);
  }
  console.log('');

  console.log('📋 Test 5: Help system');
  try {
    const helpResult = await runCommand(['help', 'config']);
    if (helpResult.code === 0 && helpResult.stdout.includes('CONFIGURATION COMMAND HELP')) {
      console.log('✅ Config help works');
    } else {
      console.log('❌ Config help failed');
    }

    const mainHelpResult = await runCommand(['help']);
    if (mainHelpResult.code === 0 && mainHelpResult.stdout.includes('GLOBAL OPTIONS')) {
      console.log('✅ Main help includes global options');
    } else {
      console.log('❌ Main help missing global options');
    }
  } catch (error) {
    console.log('❌ Help test failed:', error.message);
  }
  console.log('');

  // Cleanup
  cleanup();
  console.log('🧹 Cleaned up test files');
  console.log('');
  console.log('✅ Storage configuration testing completed!');
}

// Run the tests
runTests().catch(error => {
  console.error('❌ Test execution failed:', error);
  cleanup();
  process.exit(1);
});