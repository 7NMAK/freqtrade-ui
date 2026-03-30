const fs = require('fs');

const path = './src/app/redesign/dashboard/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// Dashboard Page Replacements
content = content.replace(/bg-bg-0/g, 'bg-background');
content = content.replace(/bg-bg-1/g, 'bg-card');
content = content.replace(/bg-bg-2/g, 'bg-muted/50');
content = content.replace(/bg-background flex/g, 'bg-background flex min-h-screen text-foreground');

content = content.replace(/text-text-0/g, 'text-foreground');
content = content.replace(/text-text-1/g, 'text-muted-foreground');
content = content.replace(/text-text-2/g, 'text-muted-foreground');
content = content.replace(/text-text-3/g, 'text-muted-foreground');

content = content.replace(/text-accent/g, 'text-primary');
content = content.replace(/bg-accent\/10/g, 'bg-primary/10');
content = content.replace(/bg-accent/g, 'bg-primary');
content = content.replace(/border-accent\/30/g, 'border-primary/30');
content = content.replace(/border-accent/g, 'border-primary');
content = content.replace(/hover:text-accent/g, 'hover:text-primary');
content = content.replace(/hover:border-accent/g, 'hover:border-primary');
content = content.replace(/ring-accent/g, 'ring-primary');

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

content = content.replace(/border-\[#1e1e30\]/g, 'border-border');
content = content.replace(/border-hover/g, 'border-border hover:border-ring');
content = content.replace(/hover:bg-hover/g, 'hover:bg-accent');

content = content.replace(/ft-card-interactive/g, 'cursor-pointer hover:border-primary/50 transition-colors hover:-translate-y-[1px] shadow-sm');
content = content.replace(/ft-label/g, 'text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1 block');
content = content.replace(/ft-value/g, 'text-base font-extrabold text-foreground tracking-tight');

fs.writeFileSync(path, content, 'utf8');

// Kill Switch Modal Replacements
const modalPath = './src/app/redesign/dashboard/kill-switch-modal.tsx';
if (fs.existsSync(modalPath)) {
  let modalContent = fs.readFileSync(modalPath, 'utf8');
  modalContent = modalContent.replace(/bg-bg-0/g, 'bg-background');
  modalContent = modalContent.replace(/bg-bg-1/g, 'bg-card');
  modalContent = modalContent.replace(/bg-bg-2/g, 'bg-muted/50');
  modalContent = modalContent.replace(/text-text-0/g, 'text-foreground');
  modalContent = modalContent.replace(/text-text-1/g, 'text-muted-foreground');
  modalContent = modalContent.replace(/text-text-2/g, 'text-muted-foreground');
  modalContent = modalContent.replace(/border-\[#1e1e30\]/g, 'border-border');
  modalContent = modalContent.replace(/bg-red-bg/g, 'bg-destructive/10');
  modalContent = modalContent.replace(/text-red/g, 'text-destructive');
  modalContent = modalContent.replace(/hover:bg-red\/20/g, 'hover:bg-destructive/20');
  modalContent = modalContent.replace(/border-red\/30/g, 'border-destructive/30');
  fs.writeFileSync(modalPath, modalContent, 'utf8');
}

console.log("Transformation completed.");
