/**
 * Comprehensive integration test for delete command CLI flow
 *
 * This test verifies that all delete commands are properly integrated
 * into the main CLI application flow.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class DeleteIntegrationTest {
  constructor() {
    this.testDataDir = '/tmp/test-delete-integration';
    this.testFile = 'test-todos.json';
    this.results = [];
  }

  async runTest(name, command, expectedPattern, shouldFail = false) {
    return new Promise((resolve) => {
      console.log(`\n🧪 Testing: ${name}`);
      console.log(`   Command: node index.js ${command}`);

      const child = spawn('node', ['index.js', ...command.split(' ')], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          TODO_DATA_DIR: this.testDataDir,
          TODO_DATA_FILE: this.testFile
        },
        timeout: 10000
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
        const output = stdout + stderr;
        const success = shouldFail ? (code !== 0) : (code === 0);

        let patternMatch = true;
        if (expectedPattern) {
          patternMatch = expectedPattern.test(output);
        }

        const result = {
          name,
          command,
          success: success && patternMatch,
          code,
          output: output.substring(0, 500), // Limit output length
          shouldFail,
          patternMatch
        };

        this.results.push(result);

        if (result.success) {
          console.log(`   ✅ PASSED`);
        } else {
          console.log(`   ❌ FAILED (exit code: ${code}, pattern match: ${patternMatch})`);
          console.log(`   Output: ${output.substring(0, 200)}...`);
        }

        resolve(result);
      });

      child.on('error', (error) => {
        console.log(`   ❌ ERROR: ${error.message}`);
        this.results.push({
          name,
          command,
          success: false,
          error: error.message
        });
        resolve({ success: false, error: error.message });
      });
    });
  }

  setupTestData() {
    // Create test directory
    if (!fs.existsSync(this.testDataDir)) {
      fs.mkdirSync(this.testDataDir, { recursive: true });
    }

    // Create test data file - data should be a simple array
    const testTodos = [
      { id: 1, description: 'Test todo 1', completed: false, createdAt: new Date().toISOString() },
      { id: 2, description: 'Test todo 2', completed: false, createdAt: new Date().toISOString() },
      { id: 3, description: 'Test todo 3', completed: true, createdAt: new Date().toISOString() },
      { id: 4, description: 'Test todo 4', completed: false, createdAt: new Date().toISOString() },
      { id: 5, description: 'Test todo 5', completed: true, createdAt: new Date().toISOString() }
    ];

    fs.writeFileSync(
      path.join(this.testDataDir, this.testFile),
      JSON.stringify(testTodos, null, 2)
    );

    console.log(`📋 Created test data with ${testTodos.length} todos`);
  }

  async runAllTests() {
    console.log('🔄 Delete Command Integration Tests\n');

    this.setupTestData();

    // Test basic delete command
    await this.runTest(
      'Basic delete command',
      'delete 1 --force',
      /Successfully deleted todo #1/
    );

    // Test delete aliases
    await this.runTest(
      'Delete alias: remove',
      'remove 2 --force',
      /Successfully deleted todo #2/
    );

    await this.runTest(
      'Delete alias: rm',
      'rm 4 --force',
      /Successfully deleted todo #4/
    );

    // Test batch delete
    this.setupTestData(); // Reset data
    await this.runTest(
      'Batch delete command',
      'batch-delete 1 2 --force',
      /Successfully deleted \d+ todos/
    );

    // Test batch delete aliases
    this.setupTestData(); // Reset data
    await this.runTest(
      'Batch delete alias: batch-remove',
      'batch-remove 3 4 --force',
      /Successfully deleted \d+ todos/
    );

    this.setupTestData(); // Reset data
    await this.runTest(
      'Batch delete alias: batch-rm',
      'batch-rm 1 5 --force',
      /Successfully deleted \d+ todos/
    );

    // Test cleanup commands
    this.setupTestData(); // Reset data
    await this.runTest(
      'Clean completed todos',
      'clean --force',
      /Successfully deleted.*completed/
    );

    this.setupTestData(); // Reset data
    await this.runTest(
      'Clear all todos',
      'clear --force',
      /Successfully deleted.*todos/
    );

    // Test delete by index
    this.setupTestData(); // Reset data
    await this.runTest(
      'Delete by position/index',
      'delete 1 --index --force',
      /Successfully deleted todo/
    );

    // Test help commands
    await this.runTest(
      'Delete help command',
      'help delete',
      /DELETE COMMAND HELP|Delete a todo by ID/
    );

    await this.runTest(
      'Batch delete help command',
      'help batch-delete',
      /BATCH DELETE HELP|Delete multiple todos/
    );

    // Test error cases
    await this.runTest(
      'Delete non-existent todo',
      'delete 999 --force',
      /Error.*not found|No todo found/,
      true
    );

    await this.runTest(
      'Delete without ID',
      'delete',
      /Error.*requires.*ID/,
      true
    );

    await this.runTest(
      'Batch delete without IDs',
      'batch-delete',
      /Error.*requires.*at least one/,
      true
    );

    this.printResults();
    this.cleanup();
  }

  printResults() {
    console.log('\n📊 TEST RESULTS SUMMARY\n');

    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const total = this.results.length;

    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Total:  ${total}`);
    console.log(`📊 Success Rate: ${((passed/total)*100).toFixed(1)}%\n`);

    if (failed > 0) {
      console.log('❌ FAILED TESTS:');
      this.results
        .filter(r => !r.success)
        .forEach(result => {
          console.log(`   • ${result.name}: ${result.command}`);
          if (result.error) {
            console.log(`     Error: ${result.error}`);
          }
        });
      console.log();
    }

    if (passed === total) {
      console.log('🎉 ALL TESTS PASSED! Delete commands are fully integrated.');
    } else {
      console.log('⚠️  Some tests failed. Check integration status.');
    }
  }

  cleanup() {
    // Clean up test directory
    try {
      if (fs.existsSync(this.testDataDir)) {
        fs.rmSync(this.testDataDir, { recursive: true, force: true });
        console.log('🧹 Cleaned up test data');
      }
    } catch (error) {
      console.log(`⚠️ Could not clean up test data: ${error.message}`);
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const test = new DeleteIntegrationTest();
  test.runAllTests().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = DeleteIntegrationTest;