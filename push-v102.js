const { execSync } = require('child_process');

console.log('Pushing workflow fix...');
execSync('git add .github/workflows/release.yml', { cwd: 'D:\\ai-reader-zotero-plugin' });
execSync('git commit -m "fix: workflow to run in plugin directory"', { cwd: 'D:\\ai-reader-zotero-plugin' });
execSync('git push', { cwd: 'D:\\ai-reader-zotero-plugin', stdio: 'inherit' });

console.log('Creating new tag...');
execSync('git tag v1.0.2', { cwd: 'D:\\ai-reader-zotero-plugin' });
execSync('git push origin v1.0.2', { cwd: 'D:\\ai-reader-zotero-plugin', stdio: 'inherit' });

console.log('Done!');
