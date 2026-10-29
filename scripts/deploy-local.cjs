const fs = require('fs');
const path = require('path');

const distClient = path.resolve(__dirname, '..', 'dist', 'client');
const rootDir = path.resolve(__dirname, '..');

// 1. Copy assets
const distAssets = path.join(distClient, 'assets');
const rootAssets = path.join(rootDir, 'assets');
if (fs.existsSync(distAssets)) {
  fs.mkdirSync(rootAssets, { recursive: true });
  for (const file of fs.readdirSync(distAssets)) {
    fs.copyFileSync(path.join(distAssets, file), path.join(rootAssets, file));
  }
  console.log('Copied assets to root/assets');
}

// 2. Read dist/client/index.html
const distIndex = path.join(distClient, 'index.html');
if (fs.existsSync(distIndex)) {
  let content = fs.readFileSync(distIndex, 'utf8');
  // Ensure relative ./assets paths
  content = content.replace(/href="\/assets\//g, 'href="./assets/');
  content = content.replace(/src="\/assets\//g, 'src="./assets/');

  // Also include 404 redirect handler if not present
  if (!content.includes('URLSearchParams(window.location.search)')) {
    const redirectScript = `  <script>
    (function () {
      var params = new URLSearchParams(window.location.search);
      var redirect = params.get('p');
      if (redirect) {
        params.delete('p');
        var search = params.toString() ? ('?' + params.toString()) : '';
        var base = window.location.pathname.replace(/\\/$/, '');
        var normSub = redirect.startsWith('/') ? redirect : '/' + redirect;
        window.location.replace(base + '/#' + normSub + search + window.location.hash);
      }
    })();
  </script>\n</head>`;
    content = content.replace('</head>', redirectScript);
  }

  // Write to root index.html and 404.html
  fs.writeFileSync(path.join(rootDir, 'index.html'), content, 'utf8');
  fs.writeFileSync(path.join(rootDir, '404.html'), content, 'utf8');
  console.log('Updated root index.html and 404.html for GitHub Pages');
}

