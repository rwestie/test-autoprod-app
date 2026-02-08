const fs = require('fs');
const path = require('path');
const os = require('os');
const { EnhancedJsonStorage } = require('./enhanced-json-storage');
const { StorageConfig } = require('./storage-config');

/**
 * Comprehensive test suite for Enhanced JSON Storage
 */
class EnhancedStorageTestSuite {
  constructor() {
    this.testDir = path.join(os.tmpdir(), 'todo-enhanced-storage-test');
    this.passed = 0;
    this.failed = 0;
    this.errors = [];
  }

  async setup() {
    // Clean up previous test directory
    if (fs.existsSync(this.testDir)) {
      fs.rmSync(this.testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(this.testDir, { recursive: true });

    // Create test configuration
    this.config = new StorageConfig({
      dataDir: this.testDir,
      dataFile: 'test-todos.json',
      enableCompression: true,
      compressionThreshold: 100,
      enableIncrementalBackups: true,
      enableIntegrityChecks: true,
      enablePerformanceMonitoring: true,
      enableLogging: false,
      maxRetries: 2,
      retryDelay: 10
    });

    this.storage = new EnhancedJsonStorage(this.config);
    await this.storage.initialize();
  }

  async teardown() {
    if (this.storage) {
      await this.storage.cleanup();
    }
    if (fs.existsSync(this.testDir)) {
      fs.rmSync(this.testDir, { recursive: true, force: true });
    }
  }

  assert(condition, message) {
    if (condition) {
      this.passed++;
      console.log(`✅ ${message}`);
    } else {
      this.failed++;
      this.errors.push(message);
      console.log(`❌ ${message}`);
    }
  }

  // Test sample data
  getSampleTodos() {
    return [
      {
        id: 1,
        description: 'Buy groceries',
        completed: false,
        createdAt: new Date('2024-01-01T10:00:00Z').toISOString(),
        priority: 'medium',
        tags: ['shopping', 'personal']
      },
      {
        id: 2,
        description: 'Complete project',
        completed: true,
        createdAt: new Date('2024-01-02T14:30:00Z').toISOString(),
        completedAt: new Date('2024-01-03T09:15:00Z').toISOString(),
        priority: 'high',
        tags: ['work']
      }
    ];
  }

  async testBasicInitialization() {
    console.log('\n🔧 Testing Basic Initialization');

    this.assert(this.storage.isInitialized, 'Storage should be initialized');
    this.assert(fs.existsSync(this.testDir), 'Test directory should exist');

    const healthCheck = await this.storage.healthCheck();
    this.assert(healthCheck.healthy, 'Storage should be healthy after initialization');
  }

  async testBasicSaveAndLoad() {
    console.log('\n💾 Testing Basic Save and Load');

    const todos = this.getSampleTodos();

    // Test save
    const saveResult = await this.storage.saveData(todos);
    this.assert(saveResult.success, 'Save operation should succeed');
    this.assert(saveResult.metadata.count === 2, 'Should save 2 todos');
    this.assert(fs.existsSync(this.config.getDataFilePath()), 'Data file should exist');

    // Test load
    const loadResult = await this.storage.loadData();
    this.assert(loadResult.success, 'Load operation should succeed');
    this.assert(loadResult.data.length === 2, 'Should load 2 todos');
    this.assert(loadResult.data[0].description === 'Buy groceries', 'First todo description should match');
    this.assert(loadResult.metadata.integrityVerified, 'Integrity should be verified');
  }

  async testCompression() {
    console.log('\n🗜️ Testing Compression');

    // Create larger dataset to trigger compression
    const largeTodos = [];
    for (let i = 1; i <= 10; i++) {
      largeTodos.push({
        id: i,
        description: `Todo item number ${i} with a longer description to ensure we exceed the compression threshold`,
        completed: i % 2 === 0,
        createdAt: new Date().toISOString(),
        priority: ['low', 'medium', 'high'][i % 3],
        tags: [`tag${i}`, `category${Math.floor(i/3)}`]
      });
    }

    const saveResult = await this.storage.saveData(largeTodos);
    this.assert(saveResult.success, 'Large dataset save should succeed');
    this.assert(saveResult.metadata.compressed, 'Data should be compressed');
    this.assert(saveResult.metadata.finalSize < saveResult.metadata.originalSize, 'Compressed size should be smaller');

    // Verify we can load compressed data
    const loadResult = await this.storage.loadData();
    this.assert(loadResult.success, 'Loading compressed data should succeed');
    this.assert(loadResult.data.length === 10, 'Should load all 10 todos');
  }

  async testIntegrityChecks() {
    console.log('\n🛡️ Testing Data Integrity');

    const todos = this.getSampleTodos();
    await this.storage.saveData(todos);

    // Wait a moment for file operations to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify integrity check passes
    const integrityResult = await this.storage.performIntegrityCheck();

    this.assert(integrityResult.valid === true, 'Integrity check should pass for valid data');
    this.assert(integrityResult.checks.checksumMatch === true, 'Checksum should match');

    // Verify checksum file exists
    const checksumFile = this.config.getDataFilePath() + '.checksum';
    this.assert(fs.existsSync(checksumFile), 'Checksum file should exist');
  }

  async testPerformanceMonitoring() {
    console.log('\n📊 Testing Performance Monitoring');

    const todos = this.getSampleTodos();

    // Perform operations to generate metrics
    await this.storage.saveData(todos);
    await this.storage.loadData();

    const stats = this.storage.getPerformanceStats();

    this.assert(stats.operations.save.count >= 1, 'Should track save operations');
    this.assert(stats.operations.load.count >= 1, 'Should track load operations');
    this.assert(stats.averageOperationTimes.save > 0, 'Should calculate average save time');
    this.assert(stats.fileSize.current > 0, 'Should track current file size');
  }

  async testHealthChecks() {
    console.log('\n🏥 Testing Health Checks');

    const todos = this.getSampleTodos();
    await this.storage.saveData(todos);

    // Wait a moment for file operations to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    const healthResult = await this.storage.healthCheck();

    this.assert(healthResult.healthy === true, 'Overall health should be good');
    this.assert(healthResult.integrity && healthResult.integrity.valid === true, 'Data integrity should be valid');
    this.assert(healthResult.performance && healthResult.performance.healthy !== false, 'Performance should be healthy');
    this.assert(healthResult.advanced && healthResult.advanced.compressionEnabled === true, 'Compression should be enabled');
  }

  async runAllTests() {
    console.log('🚀 Starting Enhanced JSON Storage Test Suite\n');

    try {
      await this.setup();

      await this.testBasicInitialization();
      await this.testBasicSaveAndLoad();
      await this.testCompression();
      await this.testIntegrityChecks();
      await this.testPerformanceMonitoring();
      await this.testHealthChecks();

    } catch (error) {
      console.error('❌ Test suite error:', error);
      this.failed++;
      this.errors.push(`Test suite error: ${error.message}`);
    } finally {
      await this.teardown();
    }

    // Print results
    console.log('\n📊 Test Results:');
    console.log(`✅ Passed: ${this.passed}`);
    console.log(`❌ Failed: ${this.failed}`);

    if (this.errors.length > 0) {
      console.log('\n❌ Errors:');
      this.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }

    const success = this.failed === 0;
    console.log(`\n${success ? '🎉' : '💥'} Test suite ${success ? 'PASSED' : 'FAILED'}`);

    return success;
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const testSuite = new EnhancedStorageTestSuite();
  testSuite.runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal test error:', error);
      process.exit(1);
    });
}

module.exports = { EnhancedStorageTestSuite };