# Data Migration and Recovery

## Overview

The todo application now includes comprehensive data migration and recovery capabilities to ensure data safety, format compatibility, and seamless upgrades.

## Features

### 🔄 Data Migration

Automatic data format upgrades with backward compatibility:

- **Version Detection**: Automatically detects data format version
- **Safe Migrations**: Creates backups before applying migrations
- **Linear Migration Path**: Upgrades data through sequential version steps
- **Rollback Support**: Migration backups enable rollback if needed

#### Supported Versions

1. **v1.0.0** - Basic format (id, description, completed)
2. **v1.1.0** - Added priority and tags
3. **v1.2.0** - Added createdAt timestamp
4. **v1.3.0** - Structured format with metadata

#### Migration Commands

```bash
# Show migration status
node index.js migrate

# Apply available migrations
node index.js migrate apply

# Create backup before migration
node index.js backup create "pre-migration"
```

### 💾 Backup Management

Enhanced backup system with multiple backup types:

#### Backup Types

1. **Automatic Backups**: Created during save operations
2. **Manual Backups**: User-created with custom reasons
3. **Migration Backups**: Created before data migrations

#### Backup Commands

```bash
# Create manual backup
node index.js backup create [reason]

# List all available backups
node index.js backup list

# Restore from specific backup
node index.js backup restore <filename>
```

#### Example Usage

```bash
# Create backup with reason
node index.js backup create "before-cleanup"

# List backups to see available files
node index.js backup list

# Restore from backup
node index.js backup restore manual-backup-2024-01-15T10-30-00-000Z.json
```

### 📤 Data Export

Export todos to various formats for sharing and archiving:

#### Supported Export Formats

1. **JSON**: Full structured format with metadata
2. **CSV**: Spreadsheet-compatible format
3. **TXT**: Human-readable plain text

#### Export Commands

```bash
# Export to JSON (default)
node index.js export json

# Export to CSV
node index.js export csv

# Export to plain text
node index.js export txt
```

#### Export Features

- Automatic timestamped filenames
- Complete metadata preservation
- Export statistics and verification
- Custom filename support

### 📥 Data Import

Import todos from external files:

#### Supported Import Formats

1. **JSON**: Structured todo data
2. **CSV**: Spreadsheet data with headers

#### Import Commands

```bash
# Import and add to existing todos
node index.js import todos.json

# Import CSV file
node index.js import todos.csv

# Replace all existing todos
node index.js import todos.json --replace
```

#### CSV Format

Expected CSV columns:
- Description (required)
- Completed (Yes/No, True/False, 1/0)
- Priority (low/medium/high)
- Tags (comma-separated)
- Due Date (ISO date string)

Example CSV:
```csv
Description,Completed,Priority,Tags,Due Date
"Buy groceries",No,high,"shopping,urgent",2024-01-20T00:00:00.000Z
"Call dentist",Yes,medium,"health",
"Finish report",No,high,"work,deadline",2024-01-15T17:00:00.000Z
```

## Migration Process

### Automatic Migration

When the application loads data, it automatically:

1. **Detects** the current data format version
2. **Checks** if migration is needed
3. **Creates** migration backup
4. **Applies** sequential migrations
5. **Saves** migrated data
6. **Logs** migration details

### Manual Migration

Use the migrate command for explicit control:

```bash
# Check migration status
node index.js migrate

# Sample output:
🔄 MIGRATION STATUS

📊 DATA VERSION:
  Current version: 1.0.0
  Latest version: 1.3.0
  Status: ⚠️  Migration available

🔄 AVAILABLE MIGRATIONS:
  Migrations needed: 3
  Migration path:
    1.0.0 -> 1.1.0
    1.1.0 -> 1.2.0
    1.2.0 -> 1.3.0

💡 TO MIGRATE:
  node index.js migrate apply
```

## Recovery Scenarios

### Backup Restoration

```bash
# List available backups
node index.js backup list

# Restore from specific backup
node index.js backup restore manual-backup-2024-01-15T10-30-00-000Z.json
```

### Migration Rollback

```bash
# List migration backups
node index.js backup list

# Restore from migration backup
node index.js backup restore migration-backup-2024-01-15T10-35-00-000Z.json
```

### Data Recovery

```bash
# Export current data as backup
node index.js export json

# Import from external source
node index.js import recovered-todos.json --replace
```

## File Structure

After implementing migration and recovery, your data directory may contain:

```
~/.todos/
├── todos.json                           # Main data file
├── todos.json.backup                    # Automatic backup
├── manual-backup-2024-01-15T10-30.json  # Manual backups
├── migration-backup-2024-01-15T10-35.json # Migration backups
└── todo-export-2024-01-15T11-00.json    # Export files
```

## Safety Features

### Automatic Safeguards

- **Pre-operation backups**: Created before destructive operations
- **Data validation**: All imported/migrated data is validated
- **Atomic operations**: File operations use temporary files
- **Error recovery**: Failed operations don't corrupt existing data

### Best Practices

1. **Regular Backups**: Create manual backups before major operations
2. **Export Archives**: Export data periodically for external storage
3. **Test Imports**: Test import files with small datasets first
4. **Verify Migrations**: Check data after automatic migrations

## Troubleshooting

### Migration Issues

```bash
# Check migration status
node index.js migrate

# View available migration backups
node index.js backup list | grep migration

# Restore from migration backup if needed
node index.js backup restore migration-backup-[timestamp].json
```

### Import Problems

- **Invalid JSON**: Check file syntax with a JSON validator
- **CSV Format**: Ensure header row matches expected columns
- **Large Files**: Test with smaller datasets first
- **Encoding**: Ensure files are UTF-8 encoded

### Backup Restoration

```bash
# List all backups with details
node index.js backup list

# Check backup contents before restoration
# (manually examine backup files if needed)

# Restore with pre-restore backup creation
node index.js backup restore [filename]
```

## Configuration

### Environment Variables

Related to migration and recovery:

```bash
# Enable/disable automatic backups
TODO_ENABLE_BACKUPS=true

# Number of automatic backups to retain
TODO_BACKUP_RETENTION=5

# Logging level for detailed migration info
TODO_LOG_LEVEL=info
```

### Storage Options

Migration and recovery respect all storage configuration:

- Data directory location
- Backup settings
- Validation options
- Retry policies

## API Reference

### Migration Manager

```javascript
const migrationManager = new MigrationManager(config);

// Check migration status
const status = migrationManager.getMigrationStatus(data);

// Apply migrations
const result = await migrationManager.migrateData(data, targetVersion);

// Create migration backup
const backup = await migrationManager.createMigrationBackup(data, migrationInfo);
```

### Recovery Manager

```javascript
const recoveryManager = new RecoveryManager(config, storage);

// Create manual backup
const backup = await recoveryManager.createManualBackup(todos, reason);

// Export data
const exported = await recoveryManager.exportTodos(todos, format, options);

// Import data
const imported = await recoveryManager.importTodos(filePath, options);

// Restore from backup
const restored = await recoveryManager.restoreFromBackup(backupPath);
```

## Performance Considerations

- **Large Datasets**: Migration time scales with data size
- **Backup Storage**: Monitor disk space for backup accumulation
- **Import Speed**: CSV parsing is slower than JSON for large files
- **Memory Usage**: Large imports load entirely into memory

## Future Enhancements

Potential improvements for migration and recovery:

1. **Incremental Backups**: Only backup changed data
2. **Compression**: Compress backup files to save space
3. **Cloud Backup**: Integration with cloud storage services
4. **Scheduled Backups**: Automatic backup scheduling
5. **Differential Migration**: Optimize migrations for large datasets
6. **Backup Encryption**: Encrypt sensitive backup data