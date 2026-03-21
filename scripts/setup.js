#!/usr/bin/env node
/**
 * Prowl setup script
 * Handles native module installation for Electron on all platforms.
 * Run this instead of plain `npm install`.
 */
const { execSync } = require('child_process');
const path = require('path');

function run(cmd, opts = {}) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: path.join(__dirname, '..'), ...opts });
}

console.log('🎯 Prowl Setup\n');
console.log('Step 1: Installing packages (skipping native builds)...');
run('npm install --ignore-scripts');

console.log('\nStep 2: Installing Electron binary...');
try {
  run('node node_modules/electron/install.js');
} catch (e) {
  console.log('  (Electron may already be installed)');
}

console.log('\nStep 3: Building native modules for Electron...');
run('npx electron-builder install-app-deps');

console.log('\n✅ Setup complete! Run: npm run electron:dev\n');
