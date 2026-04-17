const fs = require('fs');
const path = require('path');

const root = 'D:\\ai-reader-zotero-plugin';
const pluginDir = path.join(root, 'plugin');

// Files to move from plugin/ to root
const toMove = [
    'package.json',
    'tsconfig.json',
    'zotero-plugin.config.ts',
    'eslint.config.mjs',
    '.env.example',
    '.prettierignore',
    '.gitignore',
    '.vscode',
    'addon',
    'src',
    'typings',
    'gen',
    'node_modules'
];

const toKeep = ['.github', 'docs', 'LICENSE', 'service'];

console.log('Moving plugin files to root...');

toMove.forEach(item => {
    const src = path.join(pluginDir, item);
    const dest = path.join(root, item);
    if (fs.existsSync(src)) {
        if (fs.statSync(src).isDirectory()) {
            fs.cpSync(src, dest, { recursive: true, force: true });
            fs.rmSync(src, { recursive: true, force: true });
        } else {
            fs.copyFileSync(src, dest);
            fs.unlinkSync(src);
        }
        console.log(`Moved: ${item}`);
    } else {
        console.log(`Not found: ${item}`);
    }
});

// Clean up empty plugin directory
if (fs.existsSync(pluginDir) && fs.readdirSync(pluginDir).length === 0) {
    fs.rmdirSync(pluginDir);
}

console.log('Done!');
