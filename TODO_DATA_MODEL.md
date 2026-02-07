# Todo Data Model Documentation

This document describes the formal Todo data model implemented for the command-line todo application.

## Overview

The Todo data model provides a robust, validated structure for todo items with comprehensive validation, type checking, and utility methods. It supports both basic and advanced features while maintaining backward compatibility with existing data.

## Todo Class

The `Todo` class (in `todo-model.js`) provides the formal data structure and validation for todo items.

### Core Properties

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `id` | `number` | No | `null` | Unique identifier (set by TodoCore) |
| `description` | `string` | Yes | - | Todo description (1-1000 chars) |
| `completed` | `boolean` | No | `false` | Completion status |
| `priority` | `string` | No | `'medium'` | Priority level (`'low'`, `'medium'`, `'high'`) |
| `tags` | `string[]` | No | `[]` | Array of tags (max 10, each max 50 chars) |
| `dueDate` | `string` | No | `undefined` | Due date in ISO format |
| `createdAt` | `string` | No | auto-generated | Creation timestamp |
| `completedAt` | `string` | No | `undefined` | Completion timestamp |

### Validation Rules

#### Description
- **Required**: Must be provided and non-empty
- **Type**: Must be a string
- **Length**: 1-1000 characters (after trimming)
- **Processing**: Automatically trimmed

#### Priority
- **Values**: `'low'`, `'medium'`, `'high'` (case insensitive)
- **Default**: `'medium'`
- **Processing**: Converted to lowercase

#### Tags
- **Type**: Array of strings
- **Limits**: Max 10 tags, each max 50 characters
- **Processing**:
  - Trimmed and filtered (empty tags removed)
  - Duplicates removed
  - Order preserved
- **Validation**: Checks count before deduplication

#### Due Date
- **Format**: ISO 8601 date string
- **Validation**: Must be parseable by JavaScript `Date`
- **Optional**: Can be `undefined`

#### Completion Consistency
- **Auto-correction**:
  - If `completed: true` but no `completedAt`, sets current timestamp
  - If `completed: false` but has `completedAt`, clears the timestamp

### Methods

#### Basic Operations
```javascript
// Create todo
const todo = new Todo({
  description: 'Buy groceries',
  priority: 'high',
  tags: ['shopping', 'food'],
  dueDate: '2024-12-31T23:59:59Z'
});

// Mark completed/incomplete
todo.markCompleted();
todo.markIncomplete();

// Update properties
todo.updateDescription('Buy organic groceries');
todo.updatePriority('medium');
todo.updateTags(['shopping', 'organic']);
todo.updateDueDate('2024-12-25T18:00:00Z');
```

#### Tag Management
```javascript
// Add/remove tags
todo.addTag('urgent');
todo.removeTag('shopping');
todo.clearDueDate();

// Check for tags
if (todo.hasTag('work')) {
  // Handle work todo
}
```

#### Date Utilities
```javascript
// Check due status
if (todo.isOverdue()) {
  console.log('Todo is overdue!');
}

if (todo.isDueToday()) {
  console.log('Todo is due today');
}

if (todo.isDueThisWeek()) {
  console.log('Todo is due this week');
}

// Get days until due
const days = todo.getDaysUntilDue(); // null if no due date
```

#### Search and Filtering
```javascript
// Search in description and tags
if (todo.matchesQuery('grocery')) {
  console.log('Todo matches search');
}
```

#### Serialization
```javascript
// Convert to/from objects
const obj = todo.toObject();
const json = todo.toJSON();

const todoFromObj = Todo.fromObject(obj);
const todoFromJson = Todo.fromJSON(json);

// Clone
const clone = todo.clone();
```

#### Validation
```javascript
// Check if data is valid
if (Todo.isValidTodoData(someData)) {
  const todo = new Todo(someData);
}

// Get schema
const schema = Todo.getSchema();
```

## Integration with TodoCore

The `TodoCore` class has been updated to optionally use the `Todo` model for enhanced validation while maintaining backward compatibility.

### Backward Compatibility

- If `todo-model.js` is not available, TodoCore falls back to legacy validation
- Existing data files are fully compatible
- All existing APIs continue to work

### Enhanced Validation

When the Todo model is available:
- Stricter input validation
- Better error messages
- Automatic data cleaning and normalization
- Enhanced type checking

### Usage in TodoCore

```javascript
// TodoCore automatically uses Todo model if available
const todoCore = new TodoCore();

// Enhanced validation with detailed error messages
const result = todoCore.addTodo('', { priority: 'invalid' });
// Returns: { success: false, error: 'Todo description cannot be empty' }

// Automatic data normalization
const result2 = todoCore.addTodo('  Task  ', {
  tags: ['  work  ', '', 'urgent'],
  priority: 'HIGH'
});
// Creates todo with trimmed description, filtered tags, lowercase priority
```

## Error Handling

The Todo model provides detailed, user-friendly error messages:

| Error Type | Example Message |
|------------|-----------------|
| Missing description | "Todo description is required" |
| Empty description | "Todo description cannot be empty" |
| Long description | "Todo description cannot exceed 1000 characters" |
| Invalid priority | "Priority must be one of: low, medium, high" |
| Invalid tags | "Tags must be an array of strings" |
| Long tag | "Tags cannot exceed 50 characters" |
| Too many tags | "Cannot have more than 10 tags per todo" |
| Invalid due date | "Due date must be a valid ISO date string" |

## Examples

### Basic Todo Creation

```javascript
// Simple todo
const todo1 = new Todo({ description: 'Call mom' });

// Todo with all properties
const todo2 = new Todo({
  description: 'Finish project presentation',
  priority: 'high',
  tags: ['work', 'presentation'],
  dueDate: '2024-12-15T17:00:00Z'
});
```

### Advanced Usage

```javascript
// Create and manipulate todo
const todo = new Todo({ description: 'Team meeting' })
  .addTag('work')
  .addTag('meeting')
  .updatePriority('high')
  .updateDueDate('2024-12-10T14:00:00Z');

// Check status
if (todo.isDueThisWeek() && !todo.completed) {
  console.log('Upcoming meeting:', todo.description);
}

// Convert for storage
const data = todo.toObject();
```

### Validation Examples

```javascript
// This will throw an error
try {
  new Todo({
    description: '',  // Empty description
    priority: 'urgent',  // Invalid priority
    tags: 'not-array'  // Invalid tags type
  });
} catch (error) {
  console.error(error.message); // "Todo description cannot be empty"
}

// This will succeed with normalization
const todo = new Todo({
  description: '  Buy milk  ',  // Will be trimmed
  priority: 'HIGH',  // Will become 'high'
  tags: ['  shopping  ', '', 'food']  // Will become ['shopping', 'food']
});
```

## Testing

The Todo model includes comprehensive unit tests covering:

- Basic creation and property validation
- All validation rules and edge cases
- Method chaining and fluent interface
- Date utilities and due date logic
- Search functionality
- Serialization and deserialization
- Cloning and copying
- Error handling
- Schema definition

Run tests with:
```bash
npm test  # Runs all tests including todo-model tests
# or
node test-todo-model.js  # Run only Todo model tests
```

## Schema Definition

The Todo model provides a formal schema accessible via `Todo.getSchema()`:

```javascript
{
  id: { type: 'number', required: false, description: '...' },
  description: { type: 'string', required: true, maxLength: 1000, description: '...' },
  completed: { type: 'boolean', required: false, default: false, description: '...' },
  priority: { type: 'string', enum: ['low', 'medium', 'high'], default: 'medium', description: '...' },
  tags: { type: 'array', items: { type: 'string', maxLength: 50 }, maxItems: 10, description: '...' },
  dueDate: { type: 'string', format: 'date-time', required: false, description: '...' },
  createdAt: { type: 'string', format: 'date-time', required: false, description: '...' },
  completedAt: { type: 'string', format: 'date-time', required: false, description: '...' }
}
```

This schema can be used for documentation generation, API validation, or integration with other systems.