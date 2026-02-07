#!/usr/bin/env node

/**
 * Test file for the Delete Command Parser
 * Tests comprehensive parsing and validation functionality
 */

const { DeleteCommandParser } = require('./delete-command-parser');

/**
 * Test the delete command parser
 */
function runParserTests() {
  console.log('🧪 TESTING DELETE COMMAND PARSER');
  console.log('=================================\n');

  const parser = new DeleteCommandParser();
  let passCount = 0;
  let totalTests = 0;

  function test(description, testFn) {
    totalTests++;
    console.log(`Test ${totalTests}: ${description}`);

    try {
      const result = testFn();
      if (result) {
        console.log('✅ PASS');
        passCount++;
      } else {
        console.log('❌ FAIL');
      }
    } catch (error) {
      console.log(`❌ FAIL - Error: ${error.message}`);
    }
    console.log('');
  }

  // Test 1: Valid single delete commands
  test('Valid single delete by ID', () => {
    const result = parser.parseCommand('delete', ['5']);
    return result.success &&
           result.parsed.type === 'single' &&
           result.parsed.identifier === 5 &&
           !result.parsed.useIndex;
  });

  test('Valid single delete by position', () => {
    const result = parser.parseCommand('delete', ['2'], { useIndex: true });
    return result.success &&
           result.parsed.type === 'single' &&
           result.parsed.identifier === 2 &&
           result.parsed.useIndex;
  });

  // Test 2: Command aliases
  test('Delete alias "rm" works', () => {
    const result = parser.parseCommand('rm', ['3']);
    console.log('    rm result:', JSON.stringify(result, null, 2));
    return result.success && result.command === 'rm';
  });

  test('Delete alias "remove" works', () => {
    const result = parser.parseCommand('remove', ['1']);
    return result.success && result.command === 'remove';
  });

  // Test 3: Invalid single delete commands
  test('Single delete missing identifier', () => {
    const result = parser.parseCommand('delete', []);
    return !result.success && result.details.code === 'MISSING_IDENTIFIER';
  });

  test('Single delete too many arguments', () => {
    const result = parser.parseCommand('delete', ['1', '2']);
    return !result.success && result.details.code === 'TOO_MANY_ARGS';
  });

  test('Single delete invalid identifier format', () => {
    const result = parser.parseCommand('delete', ['abc']);
    return !result.success && result.details.code === 'INVALID_IDENTIFIER';
  });

  test('Single delete negative identifier', () => {
    const result = parser.parseCommand('delete', ['-1']);
    return !result.success && result.details.code === 'INVALID_IDENTIFIER';
  });

  test('Single delete zero identifier', () => {
    const result = parser.parseCommand('delete', ['0']);
    return !result.success && result.details.code === 'INVALID_IDENTIFIER';
  });

  // Test 4: Valid batch delete commands
  test('Valid batch delete by IDs', () => {
    const result = parser.parseCommand('batch-delete', ['1', '3', '5']);
    return result.success &&
           result.parsed.type === 'batch' &&
           result.parsed.identifiers.length === 3 &&
           result.parsed.identifiers.includes(1) &&
           result.parsed.identifiers.includes(3) &&
           result.parsed.identifiers.includes(5);
  });

  test('Batch delete removes duplicates', () => {
    const result = parser.parseCommand('batch-delete', ['1', '2', '1', '3', '2']);
    return result.success &&
           result.parsed.identifiers.length === 3 &&
           result.parsed.duplicatesRemoved === 2;
  });

  // Test 5: Invalid batch delete commands
  test('Batch delete missing identifiers', () => {
    const result = parser.parseCommand('batch-delete', []);
    return !result.success && result.details.code === 'MISSING_IDENTIFIERS';
  });

  test('Batch delete mixed valid/invalid', () => {
    const result = parser.parseCommand('batch-delete', ['1', 'abc', '3']);
    return !result.success && result.details.code === 'INVALID_IDENTIFIERS';
  });

  // Test 6: Bulk operations
  test('Valid clean command', () => {
    const result = parser.parseCommand('clean', []);
    return result.success &&
           result.parsed.type === 'bulk' &&
           result.parsed.operation === 'clean';
  });

  test('Valid clear command', () => {
    const result = parser.parseCommand('clear', []);
    return result.success &&
           result.parsed.type === 'bulk' &&
           result.parsed.operation === 'clear' &&
           result.parsed.destructive === true;
  });

  test('Clean with unexpected arguments', () => {
    const result = parser.parseCommand('clean', ['something']);
    return !result.success && result.details.code === 'UNEXPECTED_ARGS';
  });

  // Test 7: Unknown commands and suggestions
  test('Unknown command provides suggestions', () => {
    const result = parser.parseCommand('deleet', ['1']);
    console.log('    deleet result:', JSON.stringify(result, null, 2));
    return !result.success &&
           result.details.code === 'UNKNOWN_COMMAND' &&
           result.details.suggestions.length > 0;
  });

  test('Similar command suggestion for "del"', () => {
    const result = parser.parseCommand('delet', ['1']);
    const suggestions = result.details.suggestions || [];
    return !result.success && suggestions.some(s => s.command === 'delete');
  });

  // Test 8: Edge cases
  test('Very large identifier', () => {
    const result = parser.parseCommand('delete', ['9999999']);
    return !result.success && result.error.includes('too large');
  });

  test('Empty string identifier', () => {
    const result = parser.parseCommand('delete', ['']);
    return !result.success && result.error.includes('Empty');
  });

  test('Decimal number identifier', () => {
    const result = parser.parseCommand('delete', ['1.5']);
    return !result.success && result.details.code === 'INVALID_IDENTIFIER';
  });

  // Test 9: Utility functions
  test('Command type detection', () => {
    return parser.getCommandType('delete') === 'single' &&
           parser.getCommandType('batch-delete') === 'batch' &&
           parser.getCommandType('clean') === 'bulk';
  });

  test('Canonical command resolution', () => {
    return parser.getCanonicalCommand('rm') === 'delete' &&
           parser.getCanonicalCommand('batch-rm') === 'batch-delete' &&
           parser.getCanonicalCommand('cleanup') === 'clean';
  });

  test('Command validation', () => {
    return parser.isValidCommand('delete') === true &&
           parser.isValidCommand('rm') === true &&
           parser.isValidCommand('invalid-command') === false;
  });

  // Test 10: Complex scenarios
  test('Batch delete with positions', () => {
    const result = parser.parseCommand('batch-delete', ['1', '2', '3'], { useIndex: true });
    return result.success &&
           result.parsed.useIndex === true &&
           result.parsed.identifierType === 'position';
  });

  test('Force flag preservation', () => {
    const result = parser.parseCommand('clear', [], { force: true });
    return result.success && result.options.force === true;
  });

  // Summary
  console.log('=================================');
  console.log(`📊 Test Results: ${passCount}/${totalTests} passed`);

  if (passCount === totalTests) {
    console.log('🎉 All tests passed!');
    return true;
  } else {
    console.log('❌ Some tests failed');
    return false;
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const success = runParserTests();
  process.exit(success ? 0 : 1);
}

module.exports = { runParserTests };