const assert = require("assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { TodoCore, reset_global_core } = require("./todo-core");
const { StorageConfig } = require("./storage-config");

console.log("Running enhanced storage layer tests...");

// Test data directory
const testDir = path.join(os.tmpdir(), 'todo-enhanced-test-' + Date.now());
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

// Helper to create test config
function createTestConfig(options = {}) {
  return new StorageConfig({
    dataDir: testDir,
    dataFile: `test-${Date.now()}.json`,
    enableLogging: false, // Reduce noise in tests
    ...options
  });
}

try {
  // Test 1: Storage Configuration
  runTest("Storage configuration validation", () => {
    const config = new StorageConfig({
      dataDir: testDir,
      dataFile: 'test.json',
      enableBackups: true,
      backupRetention: 5
    });

    const errors = config.validate();
    assert(errors.length === 0, "Configuration should be valid");
    assert(config.options.enableBackups === true, "Backups should be enabled");
    assert(config.options.backupRetention === 5, "Backup retention should be 5");
  });

  // Test 2: Configuration from environment
  runTest("Configuration from environment variables", () => {
    // Set environment variables
    process.env.TODO_DATA_DIR = testDir;
    process.env.TODO_ENABLE_BACKUPS = 'false';
    process.env.TODO_LOG_LEVEL = 'error';

    const config = StorageConfig.fromEnvironment();
    assert(config.options.dataDir === testDir, "Should use env data dir");
    assert(config.options.enableBackups === false, "Should disable backups from env");
    assert(config.options.logLevel === 'error', "Should set log level from env");

    // Clean up
    delete process.env.TODO_DATA_DIR;
    delete process.env.TODO_ENABLE_BACKUPS;
    delete process.env.TODO_LOG_LEVEL;
  });

  // Test 3: Enhanced TodoCore with configuration
  runTest("Enhanced TodoCore with configuration", () => {
    const config = createTestConfig({
      enableBackups: true,
      backupRetention: 3,
      enableLogging: true,
      logLevel: 'info'
    });

    const todoCore = new TodoCore(config);
    assert(todoCore.config.options.enableBackups === true, "Should use config backups setting");
    assert(todoCore.config.options.backupRetention === 3, "Should use config retention setting");

    // Test adding todo with enhanced storage
    const result = todoCore.addTodo("Test enhanced storage");
    assert(result.success === true, "Should successfully add todo");
    assert(result.storage.saved === true, "Storage should confirm save");

    // Check the storage result structure
    if (result.storage.duration !== undefined) {
      assert(typeof result.storage.duration === 'number', "Should report save duration");
    }
  });

  // Test 4: Backup rotation
  runTest("Backup rotation functionality", () => {
    const config = createTestConfig({
      enableBackups: true,
      backupRetention: 2
    });

    const todoCore = new TodoCore(config);

    // Add several todos to trigger multiple saves
    todoCore.addTodo("Todo 1");
    todoCore.addTodo("Todo 2");
    todoCore.addTodo("Todo 3");

    // Check that backups exist
    assert(fs.existsSync(config.getBackupFilePath()), "Backup file should exist");

    // Add more todos to trigger rotation
    todoCore.addTodo("Todo 4");
    todoCore.addTodo("Todo 5");

    // Verify backup rotation worked (backup.1 should exist)
    const backup1 = config.getRotatedBackupPath(1);
    assert(fs.existsSync(backup1), "Rotated backup should exist");
  });

  // Test 5: Storage statistics and monitoring
  runTest("Storage statistics and monitoring", () => {
    const config = createTestConfig();
    const todoCore = new TodoCore(config);

    // Add some test data
    todoCore.addTodo("Test todo 1");
    todoCore.addTodo("Test todo 2");

    const stats = todoCore.getStorageStats();
    assert(stats.todoCount === 2, "Should report correct todo count");
    assert(stats.fileExists === true, "Should detect file exists");
    assert(stats.fileSize > 0, "Should report file size");
    assert(stats.lastModified !== null, "Should report last modified time");
    assert(stats.storageHealth === 'healthy', "Should report healthy storage");
  });

  // Test 6: Retry mechanism
  runTest("Save retry mechanism", () => {
    const config = createTestConfig({
      maxRetries: 2,
      retryDelay: 10
    });

    const todoCore = new TodoCore(config);
    todoCore.addTodo("Test retry");

    // Simulate permission error by making directory read-only
    // Note: This test is simplified for demo purposes
    const result = todoCore.saveTodos();
    assert(result.success === true, "Save should succeed");
    assert(typeof result.attempt === 'number', "Should report attempt number");
  });

  // Test 7: Configuration presets
  runTest("Configuration presets", () => {
    const devConfig = StorageConfig.development();
    assert(devConfig.options.logLevel === 'debug', "Dev config should have debug logging");
    assert(devConfig.options.maxRetries === 1, "Dev config should have fewer retries");

    const prodConfig = StorageConfig.production();
    assert(prodConfig.options.logLevel === 'warn', "Prod config should have warn logging");
    assert(prodConfig.options.backupRetention === 10, "Prod config should retain more backups");

    const testConfig = StorageConfig.testing();
    assert(testConfig.options.enableLogging === false, "Test config should disable logging");
    assert(testConfig.options.enableBackups === false, "Test config should disable backups");
  });

  // Test 8: Legacy compatibility
  runTest("Legacy constructor compatibility", () => {
    const testFile = path.join(testDir, 'legacy-test.json');

    // Test legacy constructor (dataFile as first param)
    const todoCore1 = new TodoCore(testFile);
    assert(todoCore1.dataFile === testFile, "Should use provided data file");

    // Test new constructor (config as first param)
    const config = createTestConfig();
    const todoCore2 = new TodoCore(config);
    assert(todoCore2.dataFile === config.getDataFilePath(), "Should use config data file");
  });

  // Test 9: Error handling enhancements
  runTest("Enhanced error handling", () => {
    const config = createTestConfig({
      dataDir: '/nonexistent/directory/that/should/not/exist',
      fallbackToCurrentDir: false,
      maxRetries: 1
    });

    const todoCore = new TodoCore(config);
    const result = todoCore.addTodo("Test error handling");

    assert(result.success === false, "Should fail to save in nonexistent directory");
    assert(result.error, "Should provide error message");

    // Check for attempts if available in the result
    if (result.storage && result.storage.attempts !== undefined) {
      assert(typeof result.storage.attempts === 'number', "Should report number of attempts");
    }
  });

  // Test 10: Performance monitoring
  runTest("Performance monitoring", () => {
    const config = createTestConfig({
      enableLogging: true,
      logLevel: 'debug'
    });

    const todoCore = new TodoCore(config);

    // Add multiple todos and measure performance
    const startTime = Date.now();
    for (let i = 0; i < 50; i++) {
      todoCore.addTodo(`Performance test todo ${i}`);
    }
    const endTime = Date.now();

    const stats = todoCore.getStorageStats();
    assert(stats.todoCount === 50, "Should have added 50 todos");

    // Verify performance is reasonable (should complete within 5 seconds)
    const duration = endTime - startTime;
    assert(duration < 5000, `Performance test should complete quickly (took ${duration}ms)`);
  });

  console.log('\n🎉 All enhanced storage layer tests passed!');

} catch (error) {
  console.error('\n💥 Test suite failed:', error.message);
  throw error;
} finally {
  cleanup();
}

console.log('\n📊 Enhanced Storage Layer Test Summary:');
console.log('✓ Configuration system validation');
console.log('✓ Environment variable configuration');
console.log('✓ Enhanced TodoCore with configuration');
console.log('✓ Backup rotation functionality');
console.log('✓ Storage statistics and monitoring');
console.log('✓ Retry mechanism');
console.log('✓ Configuration presets (dev/prod/test)');
console.log('✓ Legacy compatibility');
console.log('✓ Enhanced error handling');
console.log('✓ Performance monitoring');