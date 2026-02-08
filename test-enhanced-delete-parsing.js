#!/usr/bin/env node

/**
 * Enhanced test file for the Delete Command Parser
 * Tests new features: help flags, comma-separated input, range syntax,
 * enhanced validation, and contextual error suggestions
 */

const { DeleteCommandParser } = require('./delete-command-parser');
const { DeleteCommandInterface } = require('./delete-command-interface');

/**
 * Test the enhanced delete command parser features
 */
function runEnhancedParserTests() {
  console.log('🧪 TESTING ENHANCED DELETE COMMAND PARSER');
  console.log('==========================================\n');

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

  // Test 1: Help flag support
  test('Help flag --help in delete command', () => {
    const result = parser.parseCommand('delete', ['--help']);
    return result.success && result.type === 'help';
  });

  test('Help flag -h in batch-delete command', () => {
    const result = parser.parseCommand('batch-delete', ['-h']);
    return result.success && result.type === 'help';
  });

  test('Help flag mixed with other args', () => {
    const result = parser.parseCommand('delete', ['1', '--help']);
    return result.success && result.type === 'help';
  });

  // Test 2: Comma-separated input parsing
  test('Comma-separated input in batch delete', () => {
    const result = parser.parseCommand('batch-delete', ['1,2,3']);
    return result.success &&
           result.parsed.type === 'batch' &&
           result.parsed.identifiers.includes(1) &&
           result.parsed.identifiers.includes(2) &&
           result.parsed.identifiers.includes(3);
  });

  test('Comma-separated with spaces', () => {
    const result = parser.parseCommand('batch-delete', ['1, 2 , 3']);
    return result.success &&
           result.parsed.identifiers.length === 3 &&
           result.parsed.identifiers.includes(1);
  });

  test('Mixed comma and space separated', () => {
    const result = parser.parseCommand('batch-delete', ['1,2', '3']);
    return result.success && result.parsed.identifiers.length === 3;
  });

  // Test 3: Range syntax support
  test('Simple range 1-5', () => {
    const result = parser.parseCommand('batch-delete', ['1-5']);
    console.log('    Range result:', JSON.stringify(result.parsed?.identifiers, null, 2));
    return result.success &&
           result.parsed.identifiers.length === 5 &&
           result.parsed.identifiers.includes(1) &&
           result.parsed.identifiers.includes(3) &&
           result.parsed.identifiers.includes(5);
  });

  test('Range with spaces 2 - 4', () => {
    const result = parser.parseCommand('batch-delete', ['2 - 4']);
    return result.success &&
           result.parsed.identifiers.length === 3 &&
           result.parsed.identifiers.includes(2) &&
           result.parsed.identifiers.includes(4);
  });

  test('Multiple ranges', () => {
    const result = parser.parseCommand('batch-delete', ['1-3', '5-7']);
    return result.success && result.parsed.identifiers.length === 6;
  });

  test('Invalid range (end before start)', () => {
    const result = parser.parseCommand('batch-delete', ['5-2']);
    // Should treat as regular invalid input, not expand range
    return !result.success;
  });

  // Test 4: Enhanced input normalization
  test('Leading zeros normalization', () => {
    const result = parser.parseCommand('delete', ['01']);
    return result.success && result.parsed.identifier === 1;
  });

  test('Decimal with .0 normalization', () => {
    const result = parser.parseCommand('delete', ['5.0']);
    return result.success && result.parsed.identifier === 5;
  });

  test('Input with whitespace trimming', () => {
    const result = parser.parseCommand('delete', ['  5  ']);
    return result.success && result.parsed.identifier === 5;
  });

  // Test 5: Enhanced contextual error suggestions
  test('Hash prefix error provides contextual suggestion', () => {
    const result = parser.parseCommand('delete', ['#5']);
    return !result.success &&
           result.details.contextualSuggestions &&
           result.details.contextualSuggestions.some(s => s.includes('Remove the #'));
  });

  test('Comma-separated in single delete provides batch suggestion', () => {
    const result = parser.parseCommand('delete', ['1,2,3']);
    return !result.success &&
           result.details.contextualSuggestions &&
           result.details.contextualSuggestions.some(s => s.includes('batch-delete'));
  });

  test('Range syntax in single delete provides batch suggestion', () => {
    const result = parser.parseCommand('delete', ['1-5']);
    return !result.success &&
           result.details.contextualSuggestions &&
           result.details.contextualSuggestions.some(s => s.includes('batch-delete 1-5'));
  });

  test('Word-based input provides helpful suggestion', () => {
    const result = parser.parseCommand('delete', ['first']);
    return !result.success &&
           result.details.contextualSuggestions &&
           result.details.contextualSuggestions.some(s => s.includes('position'));
  });

  // Test 6: Edge cases and complex scenarios
  test('Mixed valid preprocessing with duplicates', () => {
    const result = parser.parseCommand('batch-delete', ['1,2', '2-4', '3']);
    // Should handle duplicates and expand range
    return result.success && result.parsed.duplicatesRemoved > 0;
  });

  test('Empty comma-separated parts', () => {
    const result = parser.parseCommand('batch-delete', ['1,,3']);
    return result.success && result.parsed.identifiers.length === 2;
  });

  test('Range with single number (not actually a range)', () => {
    const result = parser.parseCommand('batch-delete', ['5-5']);
    return result.success &&
           result.parsed.identifiers.length === 1 &&
           result.parsed.identifiers.includes(5);
  });

  // Test 7: Help content validation
  test('Help content has required fields', () => {
    const result = parser.parseCommand('delete', ['--help']);
    const help = result.helpContent;
    return help && help.title && help.description && help.usage && help.examples;
  });

  test('Batch delete help includes new syntax examples', () => {
    const result = parser.parseCommand('batch-delete', ['--help']);
    const help = result.helpContent;
    return help.examples.some(ex => ex.includes(',')) &&
           help.examples.some(ex => ex.includes('-'));
  });

  // Test 8: Backward compatibility
  test('Original single delete still works', () => {
    const result = parser.parseCommand('delete', ['5']);
    return result.success &&
           result.parsed.type === 'single' &&
           result.parsed.identifier === 5;
  });

  test('Original batch delete still works', () => {
    const result = parser.parseCommand('batch-delete', ['1', '2', '3']);
    return result.success &&
           result.parsed.type === 'batch' &&
           result.parsed.identifiers.length === 3;
  });

  // Test 9: Advanced error handling
  test('Large number validation still works', () => {
    const result = parser.parseCommand('delete', ['9999999']);
    return !result.success && result.error.includes('too large');
  });

  test('Negative range handled gracefully', () => {
    const result = parser.parseCommand('batch-delete', ['-5-3']);
    return !result.success; // Should not crash, should provide error
  });

  // Summary
  console.log('==========================================');
  console.log(`📊 Enhanced Test Results: ${passCount}/${totalTests} passed`);

  if (passCount === totalTests) {
    console.log('🎉 All enhanced tests passed!');
    return true;
  } else {
    console.log('❌ Some enhanced tests failed');
    return false;
  }
}

/**
 * Test the delete command interface integration
 */
async function runInterfaceIntegrationTests() {
  console.log('\n🧪 TESTING DELETE INTERFACE INTEGRATION');
  console.log('========================================\n');

  // Create a mock todo core for testing
  const mockTodoCore = {
    listTodos: async () => [
      { id: 1, description: 'Test todo 1', completed: false },
      { id: 2, description: 'Test todo 2', completed: true },
      { id: 3, description: 'Test todo 3', completed: false }
    ]
  };

  const deleteInterface = new DeleteCommandInterface(mockTodoCore);
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

  // Test help integration
  test('Delete help command integration', async () => {
    const result = await deleteInterface.executeCommand('delete', ['--help']);
    return result.success && result.type === 'help';
  });

  // Since we can't run the full command easily in tests, we'll test the parser integration
  test('Enhanced parser integration', () => {
    const parser = deleteInterface.parser;
    const result = parser.parseCommand('batch-delete', ['1,2,3']);
    return result.success && result.parsed.identifiers.length === 3;
  });

  // Summary
  console.log('========================================');
  console.log(`📊 Integration Test Results: ${passCount}/${totalTests} passed`);

  if (passCount === totalTests) {
    console.log('🎉 All integration tests passed!');
    return true;
  } else {
    console.log('❌ Some integration tests failed');
    return false;
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  (async () => {
    const parserSuccess = runEnhancedParserTests();
    const interfaceSuccess = await runInterfaceIntegrationTests();

    const overallSuccess = parserSuccess && interfaceSuccess;

    console.log('\n🏁 OVERALL TEST SUMMARY');
    console.log('=======================');
    console.log(`Parser Tests: ${parserSuccess ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Interface Tests: ${interfaceSuccess ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Overall: ${overallSuccess ? '🎉 SUCCESS' : '❌ FAILURE'}`);

    process.exit(overallSuccess ? 0 : 1);
  })();
}

module.exports = { runEnhancedParserTests, runInterfaceIntegrationTests };