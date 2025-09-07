#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

/**
 * Synchronizes package.json version fields from all packages under ./packages/**
 * with the version in the root package.json
 */
async function syncVersions() {
  try {
    // Read root package.json
    const rootPackagePath = path.join(process.cwd(), 'package.json');
    
    if (!fs.existsSync(rootPackagePath)) {
      throw new Error('Root package.json not found');
    }

    const rootPackage = JSON.parse(fs.readFileSync(rootPackagePath, 'utf8'));
    const rootVersion = rootPackage.version;

    if (!rootVersion) {
      throw new Error('Root package.json does not have a version field');
    }

    console.log(`Root version: ${rootVersion}`);

    // Find all package.json files in packages subdirectories
    const packagePaths = glob.sync('./packages/**/package.json', {
      ignore: ['**/node_modules/**']
    });

    if (packagePaths.length === 0) {
      console.log('No packages found under ./packages/**');
      return;
    }

    console.log(`Found ${packagePaths.length} package(s) to sync:`);

    let updatedCount = 0;
    let errorCount = 0;

    for (const packagePath of packagePaths) {
      try {
        const absolutePackagePath = path.resolve(packagePath);
        
        if (!fs.existsSync(absolutePackagePath)) {
          console.log(`  ${packagePath}: ✗ File not found`);
          errorCount++;
          continue;
        }

        const packageJson = JSON.parse(fs.readFileSync(absolutePackagePath, 'utf8'));
        
        if (!packageJson.version) {
          console.log(`  ${packagePath}: ✗ No version field found`);
          errorCount++;
          continue;
        }

        const currentVersion = packageJson.version;
        console.log(`  ${packagePath}: ${currentVersion} -> ${rootVersion}`);

        if (currentVersion !== rootVersion) {
          packageJson.version = rootVersion;
          fs.writeFileSync(absolutePackagePath, JSON.stringify(packageJson, null, 2) + '\n');
          updatedCount++;
          console.log(`    ✓ Updated`);
        } else {
          console.log(`    ✓ Already in sync`);
        }
      } catch (error) {
        console.log(`  ${packagePath}: ✗ Error - ${error.message}`);
        errorCount++;
      }
    }

    console.log(`\nSynchronization complete!`);
    console.log(`  Updated: ${updatedCount} package(s)`);
    if (errorCount > 0) {
      console.log(`  Errors: ${errorCount} package(s)`);
    }

    if (errorCount > 0) {
      process.exit(1);
    }

  } catch (error) {
    console.error('Error synchronizing versions:', error.message);
    process.exit(1);
  }
}

// Check if glob is available, if not provide fallback
try {
  require('glob');
} catch (error) {
  console.error('Error: glob package is required but not found.');
  console.error('Please install it with: pnpm add -D glob');
  process.exit(1);
}

syncVersions();
