const { execSync } = require('child_process');

const root = 'D:\\ai-reader-zotero-plugin';

console.log('Checking git status...');
const status = execSync('git status --short', { cwd: root }).toString();
console.log(status);

console.log('Adding all changes...');
execSync('git add -A', { cwd: root });

console.log('Committing...');
execSync('git commit -m "refactor: reorganize project structure - plugin at root level"', { cwd: root });

console.log('Pushing...');
execSync('git push', { cwd: root, stdio: 'inherit' });

console.log('Creating tag v1.0.3...');
execSync('git tag v1.0.3', { cwd: root });
execSync('git push origin v1.0.3', { cwd: root, stdio: 'inherit' });

console.log('Done!');
