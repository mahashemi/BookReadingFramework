# BookReadingFramework tests

These tests protect the framework's canonical data architecture before deployment.

## Test layers

### 1. Schema
Validates the canonical `Book → units[] → chunks[]` contract, including required fields and unique IDs.

### 2. Integrity
Validates manifest paths, glossary references, question references, and removal of obsolete Book 02 data paths.

### 3. Pages
Performs static page checks for canonical data references and the Book 02 study guide/mind map migrations.

## Run locally

From the repository root:

```bash
npm test
```

The first suite intentionally uses Node's built-in test runner so structural checks require no third-party dependencies.

## Deployment rule

The structural and browser suites are required CI gates before Pages deployment and PR merge. Deployment configuration is deliberately not changed by this initial test-suite commit.
