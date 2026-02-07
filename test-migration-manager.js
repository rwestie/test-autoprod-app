const fs = require('fs');
const path = require('path');
const os = require('os');
const { StorageConfig } = require('./storage-config');
const { MigrationManager } = require('./migration-manager');

/**
 * Test suite for MigrationManager
 */
class MigrationManagerTest {
  constructor() {
    this.testDir = path.join(os.tmpdir(), `todo-migration-test-${Date.now()}`);
    this.config = new StorageConfig({
      dataDir: this.testDir,
      dataFile: 'test-todos.json',
      enableLogging: false
    });
    this.migrationManager = new MigrationManager(this.config);
    this.testResults = [];
  }

  async setup() {
    // Create test directory
    if (!fs.existsSync(this.testDir)) {
      fs.mkdirSync(this.testDir, { recursive: true });
    }
  }

  async cleanup() {
    // Remove test directory and files
    if (fs.existsSync(this.testDir)) {
      const files = fs.readdirSync(this.testDir);
      for (const file of files) {
        fs.unlinkSync(path.join(this.testDir, file));
      }
      fs.rmdirSync(this.testDir);
    }
  }

  async test(description, testFn) {
    try {
      const result = await testFn();
      if (result === true || result === undefined) {
        this.testResults.push({ description, status: 'PASS' });
        console.log(`✅ ${description}`);
      } else {
        this.testResults.push({ description, status: 'FAIL', error: result });
        console.log(`❌ ${description}: ${result}`);
      }
    } catch (error) {
      this.testResults.push({ description, status: 'ERROR', error: error.message });
      console.log(`❌ ${description}: ${error.message}`);
    }
  }

  async runAllTests() {
    console.log('🧪 Starting Migration Manager Tests');
    console.log('');

    await this.setup();

    try {
      await this.test('should detect version of empty array', () => {
        const version = this.migrationManager.detectVersion([]);
        return version === this.migrationManager.currentVersion || 'Expected current version for empty data';
      });

      await this.test('should detect v1.0.0 data format', () => {
        const v1Data = [
          { id: 1, description: 'Test todo', completed: false }
        ];
        const version = this.migrationManager.detectVersion(v1Data);
        return version === '1.0.0' || 'Expected v1.0.0';
      });

      await this.test('should detect v1.1.0 data format', () => {
        const v11Data = [
          { id: 1, description: 'Test todo', completed: false, priority: 'high', tags: ['work'] }
        ];
        const version = this.migrationManager.detectVersion(v11Data);
        return version === '1.1.0' || 'Expected v1.1.0';
      });

      await this.test('should detect v1.2.0 data format', () => {
        const v12Data = [
          {
            id: 1,
            description: 'Test todo',
            completed: false,
            createdAt: '2024-01-01T00:00:00.000Z'
            // Note: no priority or tags, so should be detected as v1.2.0
          }
        ];
        const version = this.migrationManager.detectVersion(v12Data);
        return version === '1.2.0' || 'Expected v1.2.0';
      });

      await this.test('should detect v1.3.0 data format', () => {
        const v13Data = {
          version: '1.3.0',
          migrationDate: '2024-01-01T00:00:00.000Z',
          todos: []
        };
        const version = this.migrationManager.detectVersion(v13Data);
        return version === '1.3.0' || 'Expected v1.3.0';
      });

      await this.test('should migrate from v1.0.0 to v1.1.0', async () => {
        const v1Data = [
          { id: 1, description: 'Test todo', completed: false }
        ];

        const result = await this.migrationManager.migrateData(v1Data, '1.1.0');

        if (!result.success) {
          return `Migration failed: ${result.error}`;
        }

        const migratedTodos = this.migrationManager.extractTodoData(result.data);
        const todo = migratedTodos[0];

        if (!todo.priority || !Array.isArray(todo.tags)) {
          return 'Migration did not add priority and tags';
        }

        return true;
      });

      await this.test('should migrate from v1.0.0 to v1.3.0 (full path)', async () => {
        const v1Data = [
          { id: 1, description: 'Test todo', completed: false },
          { id: 2, description: 'Another todo', completed: true }
        ];

        const result = await this.migrationManager.migrateData(v1Data);

        if (!result.success) {
          return `Migration failed: ${result.error}`;
        }

        if (result.migrations.length !== 3) {
          return `Expected 3 migrations, got ${result.migrations.length}`;
        }

        const migratedData = result.data;

        // After migration fix, v1.3.0 returns an array format, not structured format
        if (!Array.isArray(migratedData)) {
          return 'Final format should be an array';
        }

        const todos = migratedData;
        if (todos.length !== 2) {
          return `Expected 2 todos, got ${todos.length}`;
        }

        const firstTodo = todos[0];
        if (!firstTodo.priority || !Array.isArray(firstTodo.tags) || !firstTodo.createdAt) {
          return 'Todos should have priority, tags, and createdAt after full migration';
        }

        return true;
      });

      await this.test('should handle migration backup creation', async () => {
        const testData = [
          { id: 1, description: 'Test todo', completed: false }
        ];

        const migrationResult = await this.migrationManager.migrateData(testData);
        const backupResult = await this.migrationManager.createMigrationBackup(testData, migrationResult);

        if (!backupResult.success) {
          return `Backup creation failed: ${backupResult.error}`;
        }

        if (!fs.existsSync(backupResult.backupPath)) {
          return 'Backup file was not created';
        }

        // Verify backup content
        const backupContent = JSON.parse(fs.readFileSync(backupResult.backupPath, 'utf8'));
        if (!backupContent.data || !backupContent.timestamp) {
          return 'Backup file does not contain expected metadata';
        }

        return true;
      });

      await this.test('should restore from migration backup', async () => {
        const originalData = [
          { id: 1, description: 'Original todo', completed: false }
        ];

        // Create a backup first
        const migrationInfo = {
          originalVersion: '1.0.0',
          newVersion: '1.3.0',
          migrations: [{ from: '1.0.0', to: '1.3.0' }]
        };

        const backupResult = await this.migrationManager.createMigrationBackup(originalData, migrationInfo);
        if (!backupResult.success) {
          return `Failed to create backup: ${backupResult.error}`;
        }

        // Restore from backup
        const restoreResult = await this.migrationManager.restoreFromMigrationBackup(backupResult.backupPath);

        if (!restoreResult.success) {
          return `Restore failed: ${restoreResult.error}`;
        }

        const restoredData = restoreResult.data;
        if (!Array.isArray(restoredData) || restoredData.length !== 1) {
          return 'Restored data format incorrect';
        }

        if (restoredData[0].description !== 'Original todo') {
          return 'Restored data content incorrect';
        }

        return true;
      });

      await this.test('should list available migration backups', () => {
        const backups = this.migrationManager.getAvailableMigrationBackups();

        if (!Array.isArray(backups)) {
          return 'Should return array of backups';
        }

        // Should find the backup created in previous test
        if (backups.length === 0) {
          return 'Should find at least one backup from previous tests';
        }

        const backup = backups[0];
        if (!backup.filename || !backup.originalVersion || !backup.targetVersion) {
          return 'Backup metadata incomplete';
        }

        return true;
      });

      await this.test('should cleanup old migration backups', async () => {
        // Create multiple backups
        const testData = [{ id: 1, description: 'Test', completed: false }];
        const migrationInfo = {
          originalVersion: '1.0.0',
          newVersion: '1.3.0',
          migrations: []
        };

        for (let i = 0; i < 3; i++) {
          await this.migrationManager.createMigrationBackup(testData, migrationInfo);
          // Small delay to ensure different timestamps
          await new Promise(resolve => setTimeout(resolve, 10));
        }

        const initialBackups = this.migrationManager.getAvailableMigrationBackups();
        if (initialBackups.length < 3) {
          return 'Failed to create test backups';
        }

        // Cleanup keeping only 2
        const cleanupResult = await this.migrationManager.cleanupMigrationBackups(2);

        if (!cleanupResult.success) {
          return `Cleanup failed: ${cleanupResult.error}`;
        }

        const finalBackups = this.migrationManager.getAvailableMigrationBackups();
        if (finalBackups.length > 2) {
          return `Expected 2 or fewer backups after cleanup, got ${finalBackups.length}`;
        }

        return true;
      });

      await this.test('should get migration status', async () => {
        const v1Data = [{ id: 1, description: 'Test', completed: false }];
        const status = this.migrationManager.getMigrationStatus(v1Data);

        if (!status.currentVersion || !status.latestVersion) {
          return 'Status should include version information';
        }

        if (status.currentVersion === '1.0.0' && status.latestVersion === '1.3.0') {
          if (status.isLatest) {
            return 'v1.0.0 data should not be marked as latest';
          }
          if (status.availableMigrations === 0) {
            return 'Should show available migrations for v1.0.0 data';
          }
        }

        return true;
      });

      await this.test('should handle invalid data gracefully', async () => {
        const invalidData = "not valid json data";
        const result = await this.migrationManager.migrateData(invalidData);

        // Invalid data should either fail or return empty data with no migrations
        if (!result.success || (result.success && result.migrations.length === 0)) {
          return true;
        }

        return 'Invalid data should either fail or result in no migrations';
      });

    } finally {
      await this.cleanup();
    }

    // Print summary
    console.log('');
    const passed = this.testResults.filter(r => r.status === 'PASS').length;
    const failed = this.testResults.filter(r => r.status !== 'PASS').length;

    console.log(`📊 Migration Manager Test Summary:`);
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   📝 Total: ${this.testResults.length}`);

    if (failed > 0) {
      console.log('');
      console.log('❌ Failed tests:');
      this.testResults
        .filter(r => r.status !== 'PASS')
        .forEach(r => console.log(`   - ${r.description}: ${r.error}`));
    }

    return failed === 0;
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const test = new MigrationManagerTest();
  test.runAllTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { MigrationManagerTest };