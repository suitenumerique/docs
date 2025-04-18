#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

// Check if AUTO_INSTALL_EXTRA_DEPS is explicitly set to false
if (process.env.AUTO_INSTALL_EXTRA_DEPS === 'false') {
  console.log('AUTO_INSTALL_EXTRA_DEPS is set to false, skipping script execution');
  process.exit(0);
}

// Get the workspace root directory
const workspaceRoot = process.cwd();

// Check if AUTO_INSTALL_EXTRA_DEPS environment variable is set to bypass prompts
const autoMode = process.env.AUTO_INSTALL_EXTRA_DEPS === 'true';

// Create readline interface for user prompts
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to prompt user for confirmation
function promptUser(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.toLowerCase().startsWith('y'));
    });
  });
}

// Function to find all package.json files in the apps directory
function findPackageJsonFiles(directory) {
  const appsDir = path.join(workspaceRoot, directory);
  
  // Check if the directory exists
  if (!fs.existsSync(appsDir)) {
    console.log(`Directory ${directory} does not exist, skipping...`);
    return [];
  }
  
  const packageJsonFiles = [];
  
  // Read all items in the directory
  const items = fs.readdirSync(appsDir);
  
  for (const item of items) {
    const itemPath = path.join(appsDir, item);
    const stat = fs.statSync(itemPath);
    
    if (stat.isDirectory()) {
      // Check if this directory has a package.json
      const packageJsonPath = path.join(itemPath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        packageJsonFiles.push(packageJsonPath);
        // Skip searching in subdirectories once a package.json is found
        continue;
      }
      
      // Only search subdirectories if no package.json was found in this directory
      packageJsonFiles.push(...findPackageJsonFiles(path.join(directory, item)));
    }
  }
  
  return packageJsonFiles;
}

// Find all package.json files in the apps directory
const packageJsonFiles = findPackageJsonFiles('apps');

if (packageJsonFiles.length === 0) {
  console.log('No package.json files found in the apps directory');
  process.exit(0);
}

console.log(`Found ${packageJsonFiles.length} package.json files in the apps directory`);

// Process each package.json file
async function processPackageJsonFiles() {
  for (const packageJsonPath of packageJsonFiles) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      // Check if extraDependencies exists
      if (packageJson.extraDependencies && Object.keys(packageJson.extraDependencies).length > 0) {
        console.log(`Found extraDependencies in ${packageJsonPath}, installing...`);
        
        // Process each dependency individually
        for (const [pkg, version] of Object.entries(packageJson.extraDependencies)) {
          const dependencyToInstall = `${pkg}@${version}`;
          
          // Prompt user if not in auto mode
          let shouldInstall = autoMode;
          if (!autoMode) {
            shouldInstall = await promptUser(`
Do you want to install ${dependencyToInstall}? (y/n): 
Note that these packages are dual-licensed by Blocknotejs 
under AGPL-3.0 or a proprietary license. If you choose 
to install them, please ensure you fulfill your licensing 
obligations with respect to BlockNoteJS
`);
          }
          
          if (shouldInstall) {
            // Install the dependency using npm install
            try {
              console.log(`Installing: ${dependencyToInstall}`);
              execSync(`npm install --no-save --ignore-scripts --no-audit ${dependencyToInstall}`, { stdio: 'inherit' });
              console.log(`Extra dependency ${dependencyToInstall} installed successfully`);
            } catch (error) {
              console.error(`Failed to install extra dependency ${dependencyToInstall}:`, error.message);
              // Continue with other dependencies even if one fails
            }
          } else {
            console.log(`Skipping installation of ${dependencyToInstall}`);
          }
        }
      } else {
        console.log(`No extraDependencies found in ${packageJsonPath}, skipping installation`);
      }
    } catch (error) {
      console.error(`Error reading or parsing ${packageJsonPath}:`, error.message);
      // Continue with other package.json files even if one fails
    }
  }
  
  console.log('Finished processing all package.json files');
  rl.close();
}

// Run the async function
processPackageJsonFiles().catch(error => {
  console.error('An error occurred:', error);
  rl.close();
  process.exit(1);
});
