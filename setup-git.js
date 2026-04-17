const { execSync } = require('child_process');

execSync('git config --global user.email "407811164@qq.com"');
execSync('git config --global user.name "Callioper"');
execSync('git config --global http.proxy "http://127.0.0.1:6244"');
execSync('git config --global https.proxy "http://127.0.0.1:6244"');

console.log('Git configured successfully');
