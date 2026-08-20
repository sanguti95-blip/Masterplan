const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 [Verificador de Sintaxis]: Escaneando todos los archivos .js...');

function getJsFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git') {
        getJsFiles(fullPath, files);
      }
    } else if (entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  return files;
}

const rootDir = path.resolve(__dirname, '..');
const jsFiles = getJsFiles(rootDir);

let hasErrors = false;

for (const file of jsFiles) {
  try {
    execSync(`node --check "${file}"`, { stdio: 'pipe' });
    console.log(`  ✓ OK: ${path.relative(rootDir, file)}`);
  } catch (err) {
    console.error(`  ✗ ERROR en ${path.relative(rootDir, file)}:`);
    console.error(err.stderr ? err.stderr.toString() : err.message);
    hasErrors = true;
  }
}

if (hasErrors) {
  console.error('\n❌ Se encontraron errores de sintaxis en el proyecto.');
  process.exit(1);
} else {
  console.log(`\n✅ ¡Validación exitosa! ${jsFiles.length} archivos .js verificados sin errores.`);
}
