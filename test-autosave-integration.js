const assert = require("assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { TodoCore } = require("./todo-core");
const { AutoSaveIntegration } = require("./autosave-integration");
const { AutoSaveConfig } = require("./autosave-config");

console.log("Running auto-save integration tests...");

// Test data directory
const testDir = path.join(os.tmpdir(), 'autosave-test-' + Date.now());
fs.mkdirSync(testDir, { recursive: true });

function cleanup() {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
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

try {
  // Test 1: AutoSaveConfig functionality
  runTest("AutoSaveConfig basic functionality", () => {
    const config = new AutoSaveConfig();

    // Test default values
    assert(config.isEnabled() === true, "Should be enabled by default");
    assert(config.shouldShowProgress() === true, "Should show progress by default");
    assert(config.shouldTrackPerformance() === true, "Should track performance by default");

    // Test environment loading
    process.env.TODO_AUTOSAVE_ENABLED = 'false';
    const envConfig = AutoSaveConfig.fromEnvironment();
    assert(envConfig.isEnabled() === false, "Should load enabled=false from environment");

    // Clean up
    delete process.env.TODO_AUTOSAVE_ENABLED;
  });

  // Test 2: Performance level calculation
  runTest("Performance level calculation", () => {
    const config = new AutoSaveConfig({
      performanceThresholds: {
        warning: 100,
        slow: 500,
        critical: 1000
      }
    });

    assert(config.getPerformanceLevel(50) === 'normal', "50ms should be normal");
    assert(config.getPerformanceLevel(150) === 'warning', "150ms should be warning");
    assert(config.getPerformanceLevel(750) === 'slow', "750ms should be slow");
    assert(config.getPerformanceLevel(1500) === 'critical', "1500ms should be critical");
  });

  // Test 3: Auto-save integration with default config
  runTest("AutoSave integration basic functionality", () => {
    const testFile = path.join(testDir, 'integration-test.json');
    const todoCore = new TodoCore(testFile);
    const autoSave = new AutoSaveIntegration(todoCore, new AutoSaveConfig());

    // Test add todo with auto-save
    const result = autoSave.addTodo("Test auto-save todo");
    assert(result.success === true, "Should successfully add todo");
    assert(Array.isArray(result.autoSaveMessages), "Should include auto-save messages");
    assert(result.performanceLevel !== undefined, "Should include performance level");

    // Verify file was created
    assert(fs.existsSync(testFile), "Todo file should be created");

    // Test complete todo with auto-save
    const completeResult = autoSave.completeTodo(1);
    assert(completeResult.success === true, "Should successfully complete todo");
    assert(Array.isArray(completeResult.autoSaveMessages), "Should include auto-save messages");
  });

  // Test 4: Performance statistics tracking
  runTest("Performance statistics tracking", () => {
    const testFile = path.join(testDir, 'perf-test.json');
    const todoCore = new TodoCore(testFile);
    const config = new AutoSaveConfig({ trackPerformance: true });
    const autoSave = new AutoSaveIntegration(todoCore, config);

    // Perform several operations
    autoSave.addTodo("Todo 1");
    autoSave.addTodo("Todo 2");
    autoSave.completeTodo(1);
    autoSave.deleteTodo(2);

    const stats = autoSave.getPerformanceSummary();
    assert(stats !== null, "Should have performance statistics");
    assert(stats.totalOperations >= 3, "Should track multiple operations");
    assert(stats.successfulSaves >= 3, "Should have successful saves");
    assert(typeof stats.averageDuration === 'number', "Should calculate average duration");
    assert(typeof stats.successRate === 'string', "Should calculate success rate");
  });

  // Test 5: Health check functionality
  runTest("Health check functionality", () => {
    const testFile = path.join(testDir, 'health-test.json');
    const todoCore = new TodoCore(testFile);
    const config = new AutoSaveConfig({ monitorHealth: true });
    const autoSave = new AutoSaveIntegration(todoCore, config);

    // Add some data
    autoSave.addTodo("Health check todo");

    const healthCheck = autoSave.performHealthCheck();
    assert(healthCheck !== null, "Should perform health check");
    assert(typeof healthCheck.timestamp === 'string', "Should include timestamp");
    assert(typeof healthCheck.storage === 'object', "Should include storage health");
    assert(typeof healthCheck.autoSave === 'object', "Should include auto-save status");
    assert(healthCheck.storage.todoCount === 1, "Should report correct todo count");
    assert(healthCheck.storage.healthy === true, "Storage should be healthy");
  });

  // Test 6: Disabled auto-save mode
  runTest("Disabled auto-save mode", () => {
    const testFile = path.join(testDir, 'disabled-test.json');
    const todoCore = new TodoCore(testFile);
    const config = new AutoSaveConfig({ enabled: false });
    const autoSave = new AutoSaveIntegration(todoCore, config);

    const result = autoSave.addTodo("Disabled auto-save todo");
    assert(result.success === true, "Should still add todo successfully");
    assert(result.autoSaveMessages === undefined, "Should not include auto-save messages");
    assert(result.performanceLevel === undefined, "Should not include performance level");

    const healthCheck = autoSave.performHealthCheck();
    assert(healthCheck === null, "Should not perform health check when disabled");
  });

  // Test 7: Configuration presets
  runTest("Configuration presets", () => {
    // Development config
    const devConfig = AutoSaveConfig.development();
    assert(devConfig.shouldShowVerbose() === true, "Development should be verbose");
    assert(devConfig.shouldShowTiming() === true, "Development should show timing");
    assert(devConfig.getPerformanceThreshold('slow') < 1000, "Development should have lower thresholds");

    // Production config
    const prodConfig = AutoSaveConfig.production();
    assert(prodConfig.shouldShowVerbose() === false, "Production should not be verbose");
    assert(prodConfig.getPerformanceThreshold('slow') > devConfig.getPerformanceThreshold('slow'), "Production should have higher thresholds");

    // Minimal config
    const minimalConfig = AutoSaveConfig.minimal();
    assert(minimalConfig.shouldShowProgress() === false, "Minimal should not show progress");
    assert(minimalConfig.shouldTrackPerformance() === false, "Minimal should not track performance");
  });

  // Test 8: Auto-save message formatting
  runTest("Auto-save message formatting", () => {
    const testFile = path.join(testDir, 'message-test.json');
    const todoCore = new TodoCore(testFile);
    const config = new AutoSaveConfig({
      showProgress: true,
      showTiming: true,
      showSuccessDetails: true,
      showBackupInfo: true,
      verboseLogging: true
    });
    const autoSave = new AutoSaveIntegration(todoCore, config);

    const result = autoSave.addTodo("Message format todo");
    assert(result.autoSaveMessages.length > 0, "Should generate auto-save messages");

    // Check that messages contain expected content
    const messages = result.autoSaveMessages.join(' ');
    assert(messages.includes('Saved'), "Should mention save operation");
  });

  // Test 9: Error handling with auto-save
  runTest("Error handling with auto-save", () => {
    const invalidPath = "/root/nonexistent/autosave-error-test.json";
    const todoCore = new TodoCore(invalidPath);
    const autoSave = new AutoSaveIntegration(todoCore, new AutoSaveConfig());

    const result = autoSave.addTodo("Error test todo");
    assert(result.success === false, "Should fail with invalid path");
    assert(Array.isArray(result.autoSaveMessages), "Should still include auto-save messages for errors");

    // Performance stats should track failed saves
    const stats = autoSave.getPerformanceSummary();
    if (stats) {
      assert(stats.failedSaves > 0, "Should track failed saves");
    }
  });

  // Test 10: Configuration updates
  runTest("Configuration updates", () => {
    const testFile = path.join(testDir, 'config-update-test.json');
    const todoCore = new TodoCore(testFile);
    const autoSave = new AutoSaveIntegration(todoCore, new AutoSaveConfig());

    // Initial config
    assert(autoSave.getConfig().shouldShowProgress() === true, "Should initially show progress");

    // Update config
    autoSave.updateConfig({ showProgress: false });
    assert(autoSave.getConfig().shouldShowProgress() === false, "Should update to not show progress");

    // Test with updated config
    const result = autoSave.addTodo("Config update todo");
    assert(result.success === true, "Should still work with updated config");
  });

  console.log("\n🎉 All auto-save integration tests passed!");

} catch (error) {
  console.error("❌ Auto-save integration test failed:", error.message);
  process.exit(1);
} finally {
  cleanup();
}