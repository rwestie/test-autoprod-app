const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Import the new storage interface and implementations
const { StorageInterface, StorageResult, StorageFactory, StorageEventEmitter } = require('./storage-interface');
const { JsonFileStorage } = require('./json-file-storage');
const { StorageConfig } = require('./storage-config');
const { TodoCoreEnhanced } = require('./todo-core-enhanced');

// Import the registry to ensure storage types are registered
require('./storage-registry');

console.log('Running storage interface tests...');

// Test data directory
const testDir = path.join(os.tmpdir(), 'storage-interface-test-' + Date.now());
fs.mkdirSync(testDir, { recursive: true });

function cleanup() {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

// Helper function to run tests
function runTest(testName, testFn) {
  return new Promise(async (resolve, reject) => {
    try {
      await testFn();
      console.log(`✓ ${testName}`);
      resolve();
    } catch (error) {
      console.error(`✗ ${testName}: ${error.message}`);
      reject(error);
    }
  });
}

async function runAllTests() {
  try {
    // Test 1: Storage interface abstraction
    await runTest('Storage interface abstraction', async () => {
      // Test that abstract methods throw errors
      const storage = new StorageInterface();

      try {
        await storage.initialize();
        assert.fail('Should throw error for unimplemented initialize method');
      } catch (error) {
        assert(error.message.includes('initialize() method must be implemented'));
      }

      try {
        await storage.loadData();
        assert.fail('Should throw error for unimplemented loadData method');
      } catch (error) {
        assert(error.message.includes('loadData() method must be implemented'));
      }
    });

    // Test 2: Storage factory registration and creation
    await runTest('Storage factory registration and creation', async () => {
      // Test that json-file storage is registered
      const availableTypes = StorageFactory.getAvailableTypes();
      assert(availableTypes.includes('json-file'), 'json-file storage should be registered');

      // Test creating storage instance
      const config = new StorageConfig({
        dataDir: testDir,
        dataFile: 'factory-test.json'
      });

      const storage = StorageFactory.create('json-file', config);
      assert(storage instanceof JsonFileStorage, 'Should create JsonFileStorage instance');
      assert(storage instanceof StorageInterface, 'Should be instance of StorageInterface');

      // Test error for unknown storage type
      try {
        StorageFactory.create('unknown-type', config);
        assert.fail('Should throw error for unknown storage type');
      } catch (error) {
        assert(error.message.includes('Unknown storage type'));
      }
    });

    // Test 3: Storage result structure
    await runTest('Storage result structure', () => {
      const successResult = StorageResult.success(['todo1', 'todo2'], { count: 2 });
      assert(successResult.success === true);
      assert(Array.isArray(successResult.data));
      assert(successResult.data.length === 2);
      assert(successResult.error === null);
      assert(successResult.metadata.count === 2);
      assert(successResult.timestamp);

      const failureResult = StorageResult.failure('Test error', { attempt: 1 });
      assert(failureResult.success === false);
      assert(failureResult.data === null);
      assert(failureResult.error === 'Test error');
      assert(failureResult.metadata.attempt === 1);
      assert(failureResult.timestamp);
    });

    // Test 4: Storage event emitter
    await runTest('Storage event emitter', async () => {
      const emitter = new StorageEventEmitter();
      let eventReceived = false;
      let eventData = null;

      const callback = (data) => {
        eventReceived = true;
        eventData = data;
      };

      emitter.on('test', callback);
      emitter.emit('test', { message: 'test event' });

      assert(eventReceived, 'Event should be received');
      assert(eventData.message === 'test event', 'Event data should match');

      // Test removing listener
      emitter.off('test', callback);
      eventReceived = false;
      emitter.emit('test', { message: 'should not receive' });
      assert(!eventReceived, 'Event should not be received after removal');
    });

    // Test 5: JSON file storage implementation
    await runTest('JSON file storage implementation', async () => {
      const config = new StorageConfig({
        dataDir: testDir,
        dataFile: 'json-storage-test.json',
        enableLogging: false
      });

      const storage = new JsonFileStorage(config);

      // Test initialization
      const initResult = await storage.initialize();
      assert(initResult.success, 'Storage should initialize successfully');

      // Test saving data
      const testData = [
        {
          id: 1,
          description: 'Test todo',
          completed: false,
          priority: 'medium',
          tags: ['test'],
          createdAt: '2024-01-01T00:00:00Z'
        }
      ];

      const saveResult = await storage.saveData(testData);
      assert(saveResult.success, 'Should save data successfully');
      assert(saveResult.metadata.count === 1, 'Should report correct count');

      // Test loading data
      const loadResult = await storage.loadData();
      assert(loadResult.success, 'Should load data successfully');
      assert(Array.isArray(loadResult.data), 'Loaded data should be array');
      assert(loadResult.data.length === 1, 'Should load correct number of items');
      assert(loadResult.data[0].description === 'Test todo', 'Should load correct data');

      // Test health check
      const healthResult = await storage.healthCheck();
      assert(healthResult.healthy, 'Storage should be healthy');

      // Test cleanup
      await storage.cleanup();
      await storage.close();
    });

    // Test 6: JSON file storage with backup and recovery
    await runTest('JSON file storage backup and recovery', async () => {
      const config = new StorageConfig({
        dataDir: testDir,
        dataFile: 'backup-test.json',
        enableBackups: true,
        enableLogging: false
      });

      const storage = new JsonFileStorage(config);
      await storage.initialize();

      const testData = [
        {
          id: 1,
          description: 'Backup test todo',
          completed: false,
          priority: 'medium',
          tags: [],
          createdAt: '2024-01-01T00:00:00Z'
        }
      ];

      // Save initial data
      await storage.saveData(testData);

      // Create backup
      const backupResult = await storage.createBackup();
      assert(backupResult.success, 'Should create backup successfully');

      // Modify data and save again
      testData.push({
        id: 2,
        description: 'Second todo',
        completed: false,
        priority: 'high',
        tags: ['urgent'],
        createdAt: '2024-01-01T01:00:00Z'
      });
      await storage.saveData(testData);

      // Simulate data corruption by writing invalid JSON
      const dataFile = config.getDataFilePath();
      fs.writeFileSync(dataFile, 'invalid json {');

      // Create new storage instance and test restore from backup
      const storage2 = new JsonFileStorage(config);
      await storage2.initialize();

      const restoreResult = await storage2.restoreFromBackup();
      assert(restoreResult.success, 'Should restore from backup successfully');
      assert(restoreResult.data.length === 1, 'Should restore original data');
      assert(restoreResult.data[0].description === 'Backup test todo', 'Should restore correct data');

      await storage.cleanup();
      await storage2.cleanup();
      await storage.close();
      await storage2.close();
    });

    // Test 7: Enhanced TodoCore with new storage interface
    await runTest('Enhanced TodoCore with storage interface', async () => {
      const config = new StorageConfig({
        dataDir: testDir,
        dataFile: 'enhanced-todo-test.json',
        enableLogging: false
      });

      const todoCore = new TodoCoreEnhanced(config, null, 'json-file');

      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 100));

      // Test adding todo
      const addResult = await todoCore.addTodo('Enhanced todo test', {
        priority: 'high',
        tags: ['test', 'enhanced']
      });

      assert(addResult.success, 'Should add todo successfully');
      assert(addResult.todo.description === 'Enhanced todo test', 'Should set description correctly');
      assert(addResult.todo.priority === 'high', 'Should set priority correctly');
      assert(addResult.todo.tags.includes('test'), 'Should set tags correctly');

      // Test listing todos
      const todos = await todoCore.listTodos();
      assert(Array.isArray(todos), 'Should return array');
      assert(todos.length === 1, 'Should have one todo');

      // Test completing todo
      const completeResult = await todoCore.completeTodo(addResult.todo.id);
      assert(completeResult.success, 'Should complete todo successfully');
      assert(completeResult.todo.completed === true, 'Todo should be marked complete');

      // Test storage stats
      const stats = await todoCore.getStorageStats();
      assert(stats.type === 'json-file', 'Should report correct storage type');
      assert(stats.todoCount === 1, 'Should report correct todo count');

      // Test health check
      const health = await todoCore.performHealthCheck();
      assert(health.healthy, 'Storage should be healthy');

      await todoCore.close();
    });

    // Test 8: Storage events in JsonFileStorage
    await runTest('Storage events in JsonFileStorage', async () => {
      const config = new StorageConfig({
        dataDir: testDir,
        dataFile: 'events-test.json',
        enableLogging: false
      });

      const storage = new JsonFileStorage(config);

      let initEventReceived = false;
      let saveEventReceived = false;
      let loadEventReceived = false;

      storage.on('initialized', (data) => {
        initEventReceived = true;
        assert(data.storage === 'json-file');
      });

      storage.on('save', (data) => {
        saveEventReceived = true;
        assert(typeof data.count === 'number');
        assert(typeof data.duration === 'number');
      });

      storage.on('load', (data) => {
        loadEventReceived = true;
        assert(typeof data.count === 'number');
      });

      await storage.initialize();
      assert(initEventReceived, 'Should receive initialization event');

      const testData = [
        {
          id: 1,
          description: 'Event test todo',
          completed: false,
          priority: 'medium',
          tags: [],
          createdAt: '2024-01-01T00:00:00Z'
        }
      ];

      await storage.saveData(testData);
      assert(saveEventReceived, 'Should receive save event');

      await storage.loadData();
      assert(loadEventReceived, 'Should receive load event');

      await storage.close();
    });

    // Test 9: Data validation and migration
    await runTest('Data validation and migration', async () => {
      const config = new StorageConfig({
        dataDir: testDir,
        dataFile: 'validation-test.json',
        enableLogging: false
      });

      // Create file with mixed valid and invalid data
      const mixedData = [
        {
          id: 1,
          description: 'Valid todo',
          completed: false,
          priority: 'high',
          tags: ['valid'],
          createdAt: '2024-01-01T00:00:00Z'
        },
        {
          id: 'invalid',
          description: 'Invalid ID todo',
          completed: false,
          createdAt: '2024-01-01T00:00:00Z'
        },
        {
          id: 2,
          description: 'Old format todo',
          completed: true,
          createdAt: '2024-01-01T00:00:00Z'
          // Missing priority and tags
        },
        null, // Invalid todo
        {
          id: 3,
          completed: false,
          createdAt: '2024-01-01T00:00:00Z'
          // Missing description
        }
      ];

      fs.writeFileSync(config.getDataFilePath(), JSON.stringify(mixedData));

      const storage = new JsonFileStorage(config);
      await storage.initialize();

      const loadResult = await storage.loadData();
      assert(loadResult.success, 'Should load and validate data');
      assert(loadResult.data.length === 2, 'Should filter invalid and keep valid todos');

      const validTodo = loadResult.data.find(t => t.id === 1);
      assert(validTodo, 'Valid todo should be preserved');
      assert(validTodo.priority === 'high', 'Valid todo priority should be preserved');

      const migratedTodo = loadResult.data.find(t => t.id === 2);
      assert(migratedTodo, 'Old format todo should be migrated');
      assert(migratedTodo.priority === 'medium', 'Migrated todo should have default priority');
      assert(Array.isArray(migratedTodo.tags), 'Migrated todo should have tags array');

      await storage.close();
    });

    // Test 10: Error handling and resilience
    await runTest('Error handling and resilience', async () => {
      // Test with invalid directory permissions (simulated)
      const invalidConfig = new StorageConfig({
        dataDir: '/root/nonexistent/cannot-create',
        dataFile: 'error-test.json',
        enableLogging: false,
        maxRetries: 1,
        retryDelay: 10
      });

      const storage = new JsonFileStorage(invalidConfig);

      // Test save failure
      const testData = [
        {
          id: 1,
          description: 'Test todo',
          completed: false,
          priority: 'medium',
          tags: [],
          createdAt: '2024-01-01T00:00:00Z'
        }
      ];

      const saveResult = await storage.saveData(testData);
      assert(!saveResult.success, 'Should fail to save to invalid directory');
      assert(typeof saveResult.error === 'string', 'Should provide error message');

      // Test health check on problematic storage
      const healthResult = await storage.healthCheck();
      assert(!healthResult.healthy, 'Health check should report unhealthy state');
      assert(typeof healthResult.message === 'string', 'Should provide health check message');

      await storage.close();
    });

    console.log('\n🎉 All storage interface tests passed!');

  } catch (error) {
    console.error('❌ Storage interface test failed:', error.message);
    throw error;
  } finally {
    cleanup();
  }
}

// Run the tests
runAllTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});