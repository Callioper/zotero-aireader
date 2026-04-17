const { execSync } = require('child_process');

console.log('Pushing to GitHub...');
execSync('git push -u origin main', { stdio: 'inherit' });

console.log('Creating tag v1.0.0...');
execSync('git tag v1.0.0');

console.log('Pushing tag...');
execSync('git push origin v1.0.0', { stdio: 'inherit' });

console.log('Done! Check GitHub Actions for build progress.');
