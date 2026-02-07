# File-Based Storage Architecture

## Overview

The todo application uses a robust file-based storage layer implemented in the `TodoCore` class. This document describes the architecture, features, and implementation details.

## Core Features

### 1. Persistent Storage
- **Default Location**: `~/.todos/todos.json`
- **Format**: JSON with structured todo objects
- **Automatic Directory Creation**: Creates storage directory if it doesn't exist

### 2. Data Integrity
- **Atomic Writes**: Uses temporary files and atomic rename operations
- **Backup System**: Creates `.backup` files before each save operation
- **Data Validation**: Validates todo structure on load/save
- **Migration Support**: Automatically migrates old data structures

### 3. Error Handling
- **Graceful Fallbacks**: Falls back to backup files on corruption
- **Comprehensive Logging**: Detailed error messages and operation feedback
- **Recovery Mechanisms**: Automatic cleanup of invalid data

### 4. Performance
- **Lazy Loading**: Loads data only when needed
- **Efficient Operations**: Minimal file I/O with batch operations
- **Memory Management**: Keeps todos in memory for fast access

## File Structure

```
~/.todos/
├── todos.json          # Primary storage file
├── todos.json.backup   # Backup of previous state
└── todos.json.tmp      # Temporary file for atomic writes
```

## Todo Data Model

```typescript
interface Todo {
  id: number;
  description: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  tags: string[];
  createdAt: string;      // ISO date string
  dueDate?: string;       // ISO date string (optional)
  completedAt?: string;   // ISO date string (optional)
}
```

## Storage Operations

### Save Operation Flow
1. **Backup Creation**: Copy current file to `.backup`
2. **Atomic Write**: Write data to temporary file
3. **Validation**: Verify JSON integrity
4. **Atomic Move**: Rename temp file to primary location
5. **Cleanup**: Remove temporary files on error

### Load Operation Flow
1. **File Check**: Verify primary file exists
2. **Data Loading**: Read and parse JSON
3. **Validation**: Validate data structure
4. **Migration**: Update old data formats
5. **Fallback**: Restore from backup if needed

## Configuration

The storage layer can be configured with:
- Custom data file location
- Backup retention policies
- Validation rules
- Error handling behavior

## API Methods

### Core Methods
- `addTodo(description, options)` - Add new todo with persistence
- `listTodos()` - Retrieve all todos from memory
- `completeTodo(id)` - Mark todo complete and save
- `deleteTodo(id)` - Remove todo and save
- `updateTodo(id, updates)` - Update todo fields and save

### Query Methods
- `getTodoById(id)` - Find specific todo
- `listTodosByPriority(priority)` - Filter by priority
- `listTodosByTag(tag)` - Filter by tag
- `getOverdueTodos()` - Find overdue items
- `getDueTodosToday()` - Find today's due items

## Error Handling

### Common Error Scenarios
1. **Permission Errors**: Graceful fallback to current directory
2. **Disk Full**: Clear error messages and cleanup
3. **Corruption**: Automatic backup restoration
4. **Network Drives**: Proper timeout handling
5. **Concurrent Access**: File locking considerations

### Recovery Mechanisms
- Backup file restoration
- Invalid data filtering
- Temporary file cleanup
- Directory creation fallbacks

## Testing

The storage layer includes comprehensive tests for:
- Basic CRUD operations
- Data validation and migration
- Error handling and recovery
- Atomic write operations
- Backup and restoration
- Performance edge cases

## Security Considerations

- File permissions set appropriately
- No sensitive data exposure in error messages
- Safe handling of user-provided file paths
- Protection against directory traversal

## Performance Characteristics

- **Memory Usage**: O(n) where n = number of todos
- **Disk Usage**: ~100 bytes per todo + overhead
- **Load Time**: O(n) for initial load, O(1) for subsequent operations
- **Save Time**: O(n) for full save operations

## Future Enhancements

Potential improvements to consider:
1. Incremental save operations
2. Compression for large datasets
3. Encryption for sensitive data
4. Multiple file format support
5. Cloud storage integration
6. Real-time sync capabilities