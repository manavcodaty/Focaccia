import fs from 'node:fs';
const reference=JSON.parse(fs.readFileSync(new URL('./reference-content.json',import.meta.url),'utf8'));
export const slides=reference.slides;
export const qa='';
export const N={};
