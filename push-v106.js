const { execSync } = require('child_process');

const root = 'D:\\ai-reader-zotero-plugin';

console.log('Committing and pushing...');
execSync('git add package.json', { cwd: root });
execSync('git commit -m "fix: use npx for zotero-plugin commands"', { cwd: root });
execSync('git push', { cwd: root, stdio: 'inherit' });

console.log('Creating tag v1.0.6...');
execSync('git tag v1.0.6', { cwd: root });
execSync('git push origin v1.0.6', { cwd: root, stdio: 'inherit' });

console.log('Done!');
