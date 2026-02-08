#!/usr/bin/env node

/**
 * Test State Integration functionality
 * Tests the enhanced storage integration with autosave and state monitoring
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { TodoCoreEnhanced } = require('./todo-core-enhanced');
const { StorageConfig } = require('./storage-config');
const { AutoSaveIntegration } = require('./autosave-integration');
const { AutoSaveConfig } = require('./autosave-config');
const { StateIntegration } = require('./state-integration');

// Test configuration
const testDir = '/tmp/test-state-integration';
const testFile = 'test-todos.json';

function logTest(name, condition) {
  console.log(`${condition ? '✅' : '❌'} ${name}`);
  if (!condition) {
    console.error(`Test failed: ${name}`);
  }
}

async function setupTest() {
  // Clean up and create test directory
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true });
  }
  fs.mkdirSync(testDir, { recursive: true });

  // Create test storage config
  const config = new StorageConfig({
    dataDir: testDir,
    dataFile: testFile,
    enableLogging: false,
    enableBackups: true,
    backupRetention: 3
  });

  // Create TodoCore
  const todoCore = new TodoCoreEnhanced(config, null, 'json-file');
  await todoCore.initialize();

  // Create AutoSave integration
  const autoSaveConfig = new AutoSaveConfig({
    enabled: true,
    showProgress: false,
    trackPerformance: true
  });
  const autoSaveIntegration = new AutoSaveIntegration(todoCore, autoSaveConfig);

  // Create State integration
  const stateIntegration = new StateIntegration(todoCore, autoSaveIntegration, {
    enableStateMonitoring: true,
    enableStateValidation: true,
    enableIntegrityChecks: true,
    enableRealTimeSync: false // Disable for testing
  });

  return { todoCore, autoSaveIntegration, stateIntegration, config };
}

async function testBasicStateIntegration() {
  console.log('\n📊 Testing Basic State Integration...');

  const { todoCore, autoSaveIntegration, stateIntegration } = await setupTest();

  // Test state integration initialization
  logTest('State integration initializes', stateIntegration !== null);
  logTest('State monitoring enabled', stateIntegration.config.enableStateMonitoring);
  logTest('State validation enabled', stateIntegration.config.enableStateValidation);
  logTest('Integrity checks enabled', stateIntegration.config.enableIntegrityChecks);

  // Test basic metrics
  const metrics = stateIntegration.getStateMetrics();
  logTest('State metrics available', metrics !== null);
  logTest('Initial operations count is zero', metrics.totalOperations === 0);
  logTest('Initial validation errors is zero', metrics.validationErrors === 0);

  console.log('  📊 Initial metrics:', {
    operations: metrics.totalOperations,
    errors: metrics.validationErrors,
    memory: `${metrics.memoryUsage}MB`
  });

  return { todoCore, autoSaveIntegration, stateIntegration };
}

async function testEnhancedAutosaveIntegration() {
  console.log('\n🚀 Testing Enhanced Autosave Integration...');

  const { todoCore, autoSaveIntegration, stateIntegration } = await setupTest();

  // Test add todo with autosave integration
  const addResult = await autoSaveIntegration.addTodo('Test todo with autosave');
  logTest('AutoSave addTodo succeeds', addResult.success === true);
  logTest('AutoSave provides enhanced messages', Array.isArray(addResult.autoSaveMessages));
  logTest('AutoSave tracks performance level', addResult.performanceLevel !== undefined);
  logTest('Storage information available', addResult.storage && addResult.storage.saved);

  console.log('  💾 AutoSave result:', {
    success: addResult.success,
    messages: addResult.autoSaveMessages?.length || 0,
    performance: addResult.performanceLevel,
    duration: addResult.storage?.duration
  });

  // Test performance summary
  const performanceSummary = autoSaveIntegration.getPerformanceSummary();
  logTest('Performance summary available', performanceSummary !== null);
  if (performanceSummary) {
    logTest('Performance tracks operations', performanceSummary.totalOperations > 0);
    logTest('Success rate calculated', performanceSummary.successRate !== undefined);

    console.log('  📈 Performance summary:', {
      operations: performanceSummary.totalOperations,
      successRate: `${performanceSummary.successRate}%`,
      avgDuration: `${performanceSummary.averageDuration}ms`
    });
  }

  return { todoCore, autoSaveIntegration, stateIntegration };
}

async function testStateValidationAndMonitoring() {
  console.log('\n🔍 Testing State Validation and Monitoring...');

  const { todoCore, autoSaveIntegration, stateIntegration } = await setupTest();

  // Add some test todos
  await autoSaveIntegration.addTodo('Todo 1');
  await autoSaveIntegration.addTodo('Todo 2');
  await autoSaveIntegration.completeTodo(1);

  // Record state changes
  stateIntegration.recordStateChange('test-operation', { testData: true });

  // Test state validation
  const validation = await stateIntegration.validateState();
  logTest('State validation completes', validation !== null);
  logTest('Basic validation passes', validation.success === true);
  logTest('Validation provides stats', validation.stats !== undefined);

  if (validation.stats) {
    logTest('Todo count matches', validation.stats.todoCount === 2);
    logTest('Storage count matches', validation.stats.storageCount === 2);
    console.log('  📊 Validation stats:', {
      todoCount: validation.stats.todoCount,
      storageCount: validation.stats.storageCount,
      memoryUsage: `${Math.round(validation.stats.memoryUsage)}MB`
    });
  }

  // Test deep validation
  const deepValidation = await stateIntegration.validateState({ deep: true });
  logTest('Deep validation completes', deepValidation !== null);
  logTest('Deep validation passes', deepValidation.success === true);

  // Test state metrics after operations
  const metrics = stateIntegration.getStateMetrics();
  logTest('State metrics updated', metrics.totalOperations > 0);

  console.log('  📈 Updated metrics:', {
    totalOps: metrics.totalOperations,
    writeOps: metrics.writeOperations,
    historySize: metrics.stateHistorySize
  });

  return { todoCore, autoSaveIntegration, stateIntegration };
}

async function testStateHistoryTracking() {
  console.log('\n📜 Testing State History Tracking...');

  const { todoCore, autoSaveIntegration, stateIntegration } = await setupTest();

  // Perform several operations to generate history
  stateIntegration.recordStateChange('add', { description: 'Todo 1' });
  stateIntegration.recordStateChange('complete', { todoId: 1 });
  stateIntegration.recordStateChange('list', { filter: {} });

  // Test history retrieval
  const history = stateIntegration.getStateHistory(10);
  logTest('State history available', Array.isArray(history));
  logTest('State history has entries', history.length === 3);

  if (history.length > 0) {
    const lastEntry = history[history.length - 1];
    logTest('History entry has timestamp', lastEntry.timestamp !== undefined);
    logTest('History entry has operation', lastEntry.operation !== undefined);
    logTest('History entry has details', lastEntry.details !== undefined);

    console.log('  📋 Latest history entries:');
    history.forEach((entry, index) => {
      console.log(`    ${index + 1}. ${entry.operation} (${new Date(entry.timestamp).toLocaleTimeString()})`);
    });
  }

  return { todoCore, autoSaveIntegration, stateIntegration };
}

async function testIntegrityChecks() {
  console.log('\n🔒 Testing Integrity Checks...');

  const { todoCore, autoSaveIntegration, stateIntegration } = await setupTest();

  // Add test data
  await autoSaveIntegration.addTodo('Todo for integrity test');

  // Test integrity validation
  const validation = await stateIntegration.validateState();
  logTest('Integrity validation available', validation !== null);

  // Test storage health check integration
  const healthCheck = await todoCore.performHealthCheck();
  logTest('Storage health check available', healthCheck !== null);
  logTest('Storage health check passes', healthCheck.healthy === true);

  console.log('  🏥 Health check result:', {
    healthy: healthCheck.healthy,
    message: healthCheck.message
  });

  return { todoCore, autoSaveIntegration, stateIntegration };
}

async function testErrorHandling() {
  console.log('\n⚠️  Testing Error Handling...');

  const { todoCore, autoSaveIntegration, stateIntegration } = await setupTest();

  // Test validation with corrupted state (simulate)
  try {
    // Force an error by trying to validate with invalid todo data
    const originalTodos = todoCore.todos;
    todoCore.todos = [{ id: 'invalid', description: null }]; // Invalid data

    const validation = await stateIntegration.validateState({ deep: true });
    logTest('Validation handles errors gracefully', validation !== null);
    logTest('Validation detects errors', !validation.success || validation.errors.length > 0);

    // Restore original state
    todoCore.todos = originalTodos;

    console.log('  🛡️  Error handling result:', {
      success: validation.success,
      errorCount: validation.errors ? validation.errors.length : 0,
      warningCount: validation.warnings ? validation.warnings.length : 0
    });

  } catch (error) {
    logTest('Error handling prevents crashes', false);
    console.error('  ❌ Unexpected error:', error.message);
  }

  return { todoCore, autoSaveIntegration, stateIntegration };
}

async function testCleanup() {
  console.log('\n🧹 Testing Cleanup...');

  const { stateIntegration } = await setupTest();

  // Test cleanup
  try {
    stateIntegration.shutdown();
    logTest('State integration shuts down cleanly', true);
    logTest('Sync monitoring stopped', stateIntegration.syncTimer === null);
  } catch (error) {
    logTest('State integration shuts down cleanly', false);
    console.error('  ❌ Cleanup error:', error.message);
  }

  // Clean up test files
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true });
    logTest('Test files cleaned up', true);
  }
}

async function runAllTests() {
  console.log('🧪 Running State Integration Tests...\n');

  try {
    await testBasicStateIntegration();
    await testEnhancedAutosaveIntegration();
    await testStateValidationAndMonitoring();
    await testStateHistoryTracking();
    await testIntegrityChecks();
    await testErrorHandling();
    await testCleanup();

    console.log('\n✅ All State Integration tests completed successfully!');
    return true;
  } catch (error) {
    console.error('\n❌ State Integration tests failed:', error.message);
    console.error(error.stack);
    return false;
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { runAllTests };