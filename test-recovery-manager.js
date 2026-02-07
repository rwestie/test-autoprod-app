const fs = require('fs');
const path = require('path');
const os = require('os');
const { StorageConfig } = require('./storage-config');
const { JsonFileStorage } = require('./json-file-storage');
const { RecoveryManager } = require('./recovery-manager');

/**
 * Test suite for RecoveryManager
 */
class RecoveryManagerTest {
  constructor() {
    this.testDir = path.join(os.tmpdir(), `todo-recovery-test-${Date.now()}`);
    this.config = new StorageConfig({
      dataDir: this.testDir,
      dataFile: 'test-todos.json',
      enableLogging: false
    });
    this.storage = new JsonFileStorage(this.config);
    this.recoveryManager = new RecoveryManager(this.config, this.storage);
    this.testResults = [];
  }

  async setup() {
    // Create test directory
    if (!fs.existsSync(this.testDir)) {
      fs.mkdirSync(this.testDir, { recursive: true });
    }

    // Initialize storage
    await this.storage.initialize();
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

  async createSampleData() {
    const todos = [
      {
        id: 1,
        description: 'Test todo 1',
        completed: false,
        priority: 'high',
        tags: ['work'],
        createdAt: '2024-01-01T00:00:00.000Z'
      },
      {
        id: 2,
        description: 'Test todo 2',
        completed: true,
        priority: 'medium',
        tags: ['personal'],
        createdAt: '2024-01-02T00:00:00.000Z',
        completedAt: '2024-01-02T12:00:00.000Z'
      }
    ];

    await this.storage.saveData(todos);
    return todos;
  }

  async runAllTests() {
    console.log('🧪 Starting Recovery Manager Tests');
    console.log('');

    await this.setup();

    try {
      await this.test('should create manual backup', async () => {
        const todos = await this.createSampleData();
        const backupResult = await this.recoveryManager.createManualBackup(todos, 'test-backup');

        if (!backupResult.success) {
          return `Backup creation failed: ${backupResult.error}`;
        }

        if (!fs.existsSync(backupResult.backupPath)) {
          return 'Backup file was not created';
        }

        if (backupResult.todoCount !== 2) {
          return `Expected 2 todos in backup, got ${backupResult.todoCount}`;
        }

        // Verify backup content
        const backupContent = JSON.parse(fs.readFileSync(backupResult.backupPath, 'utf8'));
        if (!backupContent.data || !backupContent.timestamp || !backupContent.reason) {
          return 'Backup file missing required metadata';
        }

        if (backupContent.reason !== 'test-backup') {
          return 'Backup reason not preserved';
        }

        return true;
      });

      await this.test('should list available backups', () => {
        const backupsResult = this.recoveryManager.getAvailableBackups();

        if (!backupsResult.success) {
          return `Failed to list backups: ${backupsResult.error}`;
        }

        if (backupsResult.backups.length === 0) {
          return 'Should find at least one backup from previous test';
        }

        const backup = backupsResult.backups[0];
        if (!backup.type || !backup.filename || !backup.timestamp) {
          return 'Backup metadata incomplete';
        }

        if (backup.type !== 'manual' && backup.type !== 'automatic') {
          return 'Backup type should be manual or automatic';
        }

        return true;
      });

      await this.test('should restore from backup', async () => {
        // Create original data
        const originalTodos = await this.createSampleData();

        // Create backup
        const backupResult = await this.recoveryManager.createManualBackup(originalTodos, 'test-restore');
        if (!backupResult.success) {
          return `Failed to create backup: ${backupResult.error}`;
        }

        // Modify original data
        const modifiedTodos = [
          { id: 3, description: 'New todo', completed: false, priority: 'low', tags: [], createdAt: new Date().toISOString() }
        ];
        await this.storage.saveData(modifiedTodos);

        // Restore from backup
        const restoreResult = await this.recoveryManager.restoreFromBackup(backupResult.backupPath);

        if (!restoreResult.success) {
          return `Restore failed: ${restoreResult.error}`;
        }

        if (restoreResult.restoredCount !== 2) {
          return `Expected 2 todos restored, got ${restoreResult.restoredCount}`;
        }

        const restoredTodos = restoreResult.todos;
        if (restoredTodos[0].description !== 'Test todo 1') {
          return 'Restored data content incorrect';
        }

        return true;
      });

      await this.test('should export to JSON format', async () => {
        const todos = await this.createSampleData();
        const exportResult = await this.recoveryManager.exportTodos(todos, 'json');

        if (!exportResult.success) {
          return `Export failed: ${exportResult.error}`;
        }

        if (!fs.existsSync(exportResult.exportPath)) {
          return 'Export file was not created';
        }

        if (exportResult.todoCount !== 2) {
          return `Expected 2 todos in export, got ${exportResult.todoCount}`;
        }

        // Verify export content
        const exportContent = JSON.parse(fs.readFileSync(exportResult.exportPath, 'utf8'));
        if (!exportContent.export || !exportContent.todos) {
          return 'Export file missing required structure';
        }

        if (exportContent.todos.length !== 2) {
          return 'Export todos count mismatch';
        }

        return true;
      });

      await this.test('should export to CSV format', async () => {
        const todos = await this.createSampleData();
        const exportResult = await this.recoveryManager.exportTodos(todos, 'csv');

        if (!exportResult.success) {
          return `CSV export failed: ${exportResult.error}`;
        }

        if (!fs.existsSync(exportResult.exportPath)) {
          return 'CSV export file was not created';
        }

        // Verify CSV content
        const csvContent = fs.readFileSync(exportResult.exportPath, 'utf8');
        const lines = csvContent.split('\n').filter(line => line.trim());

        if (lines.length < 3) { // header + 2 data rows
          return 'CSV should have header and data rows';
        }

        const header = lines[0];
        if (!header.includes('ID') || !header.includes('Description')) {
          return 'CSV header missing expected columns';
        }

        return true;
      });

      await this.test('should export to TXT format', async () => {
        const todos = await this.createSampleData();
        const exportResult = await this.recoveryManager.exportTodos(todos, 'txt');

        if (!exportResult.success) {
          return `TXT export failed: ${exportResult.error}`;
        }

        if (!fs.existsSync(exportResult.exportPath)) {
          return 'TXT export file was not created';
        }

        // Verify TXT content
        const txtContent = fs.readFileSync(exportResult.exportPath, 'utf8');
        if (!txtContent.includes('Test todo 1') || !txtContent.includes('Test todo 2')) {
          return 'TXT content missing expected todos';
        }

        if (!txtContent.includes('✓') && !txtContent.includes('[ ]')) {
          return 'TXT format missing completion indicators';
        }

        return true;
      });

      await this.test('should import from JSON format', async () => {
        // Create test import file
        const importData = {
          export: {
            timestamp: new Date().toISOString(),
            todoCount: 2,
            version: '1.3.0',
            format: 'json'
          },
          todos: [
            {
              id: 10,
              description: 'Imported todo 1',
              completed: false,
              priority: 'high',
              tags: ['imported'],
              createdAt: '2024-01-10T00:00:00.000Z'
            },
            {
              id: 11,
              description: 'Imported todo 2',
              completed: true,
              priority: 'low',
              tags: ['imported', 'completed'],
              createdAt: '2024-01-11T00:00:00.000Z'
            }
          ]
        };

        const importPath = path.join(this.testDir, 'import-test.json');
        fs.writeFileSync(importPath, JSON.stringify(importData, null, 2));

        const importResult = await this.recoveryManager.importTodos(importPath);

        if (!importResult.success) {
          return `Import failed: ${importResult.error}`;
        }

        if (importResult.importedCount !== 2) {
          return `Expected 2 imported todos, got ${importResult.importedCount}`;
        }

        const importedTodos = importResult.todos;
        if (importedTodos[0].description !== 'Imported todo 1') {
          return 'Imported todo content incorrect';
        }

        // Verify ID reassignment
        if (importedTodos[0].id === 10) {
          return 'IDs should be reassigned to avoid conflicts';
        }

        return true;
      });

      await this.test('should import from CSV format', async () => {
        // Create test CSV file
        const csvContent = [
          'ID,Description,Completed,Priority,Tags,Created At,Due Date,Completed At',
          '1,"CSV Todo 1",No,high,"work,urgent",2024-01-01T00:00:00.000Z,,',
          '2,"CSV Todo 2",Yes,medium,personal,2024-01-02T00:00:00.000Z,,2024-01-02T12:00:00.000Z'
        ].join('\n');

        const csvPath = path.join(this.testDir, 'import-test.csv');
        fs.writeFileSync(csvPath, csvContent);

        const importResult = await this.recoveryManager.importTodos(csvPath);

        if (!importResult.success) {
          return `CSV import failed: ${importResult.error}`;
        }

        if (importResult.importedCount !== 2) {
          return `Expected 2 imported todos from CSV, got ${importResult.importedCount}`;
        }

        const importedTodos = importResult.todos;
        const firstTodo = importedTodos[0];

        if (firstTodo.description !== 'CSV Todo 1') {
          return 'CSV imported description incorrect';
        }

        if (firstTodo.completed !== false) {
          return 'CSV completed status not parsed correctly';
        }

        if (firstTodo.priority !== 'high') {
          return 'CSV priority not parsed correctly';
        }

        if (!Array.isArray(firstTodo.tags) || !firstTodo.tags.includes('work')) {
          return 'CSV tags not parsed correctly';
        }

        return true;
      });

      await this.test('should handle invalid import files', async () => {
        // Test invalid JSON
        const invalidJsonPath = path.join(this.testDir, 'invalid.json');
        fs.writeFileSync(invalidJsonPath, 'invalid json content');

        const jsonResult = await this.recoveryManager.importTodos(invalidJsonPath);
        if (jsonResult.success) {
          return 'Should have failed for invalid JSON';
        }

        // Test missing file
        const missingResult = await this.recoveryManager.importTodos('/nonexistent/file.json');
        if (missingResult.success) {
          return 'Should have failed for missing file';
        }

        return true;
      });

      await this.test('should cleanup old backups', async () => {
        // Create multiple manual backups
        const todos = await this.createSampleData();

        for (let i = 0; i < 5; i++) {
          await this.recoveryManager.createManualBackup(todos, `test-cleanup-${i}`);
          // Small delay to ensure different timestamps
          await new Promise(resolve => setTimeout(resolve, 10));
        }

        const initialBackups = this.recoveryManager.getAvailableBackups();
        const initialManual = initialBackups.backups.filter(b => b.type === 'manual').length;

        if (initialManual < 5) {
          return 'Failed to create sufficient test backups';
        }

        // Cleanup keeping only 3 manual backups
        const cleanupResult = await this.recoveryManager.cleanupBackups({ keepManual: 3 });

        if (!cleanupResult.success) {
          return `Cleanup failed: ${cleanupResult.error}`;
        }

        const finalBackups = this.recoveryManager.getAvailableBackups();
        const finalManual = finalBackups.backups.filter(b => b.type === 'manual').length;

        if (finalManual > 3) {
          return `Expected 3 or fewer manual backups after cleanup, got ${finalManual}`;
        }

        return true;
      });

      await this.test('should get recovery statistics', () => {
        const statsResult = this.recoveryManager.getRecoveryStats();

        if (!statsResult.success) {
          return `Failed to get stats: ${statsResult.error}`;
        }

        const stats = statsResult.stats;

        if (typeof stats.totalBackups !== 'number' ||
            typeof stats.manualBackups !== 'number' ||
            typeof stats.automaticBackups !== 'number') {
          return 'Stats should include numeric backup counts';
        }

        if (stats.totalBackups !== stats.manualBackups + stats.automaticBackups + stats.migrationBackups) {
          return 'Total backup count should equal sum of individual types';
        }

        return true;
      });

      await this.test('should parse CSV lines with quotes correctly', () => {
        const testLines = [
          'simple,test,line',
          '"quoted field","another field","third"',
          'mixed,"quoted with, comma","normal',
          '"quoted with ""escaped"" quotes",normal'
        ];

        const testLine = '"Test description with, comma","Yes","high","work,urgent"';
        const parsed = this.recoveryManager.parseCSVLine(testLine);

        if (parsed.length !== 4) {
          return `Expected 4 fields, got ${parsed.length}`;
        }

        if (parsed[0] !== 'Test description with, comma') {
          return 'Quoted field with comma not parsed correctly';
        }

        if (parsed[3] !== 'work,urgent') {
          return 'Final field not parsed correctly';
        }

        return true;
      });

    } finally {
      await this.cleanup();
    }

    // Print summary
    console.log('');
    const passed = this.testResults.filter(r => r.status === 'PASS').length;
    const failed = this.testResults.filter(r => r.status !== 'PASS').length;

    console.log(`📊 Recovery Manager Test Summary:`);
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
  const test = new RecoveryManagerTest();
  test.runAllTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { RecoveryManagerTest };