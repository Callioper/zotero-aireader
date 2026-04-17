const { execSync } = require('child_process');

const root = 'D:\\ai-reader-zotero-plugin';

console.log('Committing and pushing...');
execSync('git add .github/workflows/release.yml', { cwd: root });
execSync('git commit -m "fix: quote files pattern in workflow"', { cwd: root });
execSync('git push', { cwd: root, stdio: 'inherit' });

console.log('Creating tag v1.0.5...');
execSync('git tag v1.0.5', { cwd: root });
execSync('git push origin v1.0.5', { cwd: root, stdio: 'inherit' });

console.log('Done!');
