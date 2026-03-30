const fs = require('fs');
const path = require('path');

const TARGET_DIRS = [
  path.join(__dirname, 'src/app/dashboard'),
  path.join(__dirname, 'src/app/(auth)'),
  path.join(__dirname, 'src/app')
];

function walkDir(dir, callback) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? 
      walkDir(dirPath, callback) : callback(dirPath);
  });
}

function processFile(filePath) {
  if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;

  let content = fs.readFileSync(filePath, 'utf8');
  const initialContent = content;

  // 1. Typography
  content = content.replace(/text-\[10px\]/g, 'text-xs');
  content = content.replace(/text-\[11px\]/g, 'text-xs');
  content = content.replace(/text-\[12px\]/g, 'text-xs');
  content = content.replace(/text-\[13px\]/g, 'text-sm');
  content = content.replace(/text-\[14px\]/g, 'text-sm');
  content = content.replace(/font-mono-data/g, 'font-mono');

  // 2. Base Colors
  content = content.replace(/bg-bg-0/g, 'bg-background');
  content = content.replace(/bg-bg-1/g, 'bg-card');
  content = content.replace(/bg-bg-2/g, 'bg-muted/50');
  content = content.replace(/bg-bg-3/g, 'bg-muted');
  
  content = content.replace(/text-text-0/g, 'text-foreground');
  content = content.replace(/text-text-1/g, 'text-muted-foreground');
  content = content.replace(/text-text-2/g, 'text-muted-foreground');
  content = content.replace(/text-text-3/g, 'text-muted-foreground');
  
  content = content.replace(/border-\[#1e1e30\]/g, 'border-border');
  content = content.replace(/border-hover/g, 'border-border hover:border-ring');
  content = content.replace(/hover:bg-hover/g, 'hover:bg-accent');

  // 3. Primary/Accent Colors
  content = content.replace(/text-accent/g, 'text-primary');
  content = content.replace(/bg-accent\/10/g, 'bg-primary/10');
  content = content.replace(/bg-accent/g, 'bg-primary');
  content = content.replace(/border-accent\/30/g, 'border-primary/30');
  content = content.replace(/border-accent/g, 'border-primary');
  content = content.replace(/hover:text-accent/g, 'hover:text-primary');
  content = content.replace(/hover:border-accent/g, 'hover:border-primary');
  content = content.replace(/ring-accent/g, 'ring-primary');

  // 4. Signal Colors
  content = content.replace(/text-green/g, 'text-emerald-500');
  content = content.replace(/bg-green-bg/g, 'bg-emerald-500/10');
  content = content.replace(/border-green\/20/g, 'border-emerald-500/20');
  content = content.replace(/border-green/g, 'border-emerald-500');
  
  content = content.replace(/text-red/g, 'text-rose-500');
  content = content.replace(/bg-red-bg/g, 'bg-rose-500/10');
  content = content.replace(/border-red\/20/g, 'border-rose-500/20');
  content = content.replace(/border-red/g, 'border-rose-500');
  
  content = content.replace(/text-amber/g, 'text-amber-500');
  content = content.replace(/bg-amber-bg/g, 'bg-amber-500/10');
  content = content.replace(/border-amber\/20/g, 'border-amber-500/20');
  content = content.replace(/border-amber/g, 'border-amber-500');

  // 5. Leftovers & Custom Legacy Tags
  content = content.replace(/ft-card-interactive/g, 'cursor-pointer hover:border-primary/50 transition-colors hover:-translate-y-[1px] shadow-sm');
  content = content.replace(/ft-label/g, 'text-xs uppercase font-bold tracking-wider text-muted-foreground mb-1 block');
  content = content.replace(/ft-value/g, 'text-base font-extrabold text-foreground tracking-tight');

  if (content !== initialContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
}

TARGET_DIRS.forEach(dir => {
  console.log(`Scanning: ${dir}`);
  walkDir(dir, processFile);
});

console.log("Global Transformation completed.");
