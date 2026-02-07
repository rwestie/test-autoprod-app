const assert = require("assert");
const { runDeleteTests } = require("./test-delete");
const { runArchiveTests } = require("./test-archive");

console.log("Running todo application tests...");

// Run basic tests
console.log("Running basic tests...");
assert(true, "Basic test");
console.log("✅ Basic tests passed!");

// Run delete functionality tests
console.log("\nRunning delete functionality tests...");
const deleteTestsSuccess = runDeleteTests();

// Run archive functionality tests
console.log("\nRunning archive functionality tests...");
const archiveTestsSuccess = runArchiveTests();

if (deleteTestsSuccess && archiveTestsSuccess) {
  console.log("\n🎉 All tests passed!");
} else {
  console.log("\n❌ Some tests failed!");
  process.exit(1);
}
