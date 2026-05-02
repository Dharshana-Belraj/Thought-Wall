const fs = require('fs');
const path = require('path');

const outPath = path.join(__dirname, 'site', 'config.js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY || '';

const content = `window.__ENV = { SUPABASE_URL: "${SUPABASE_URL}", SUPABASE_KEY: "${SUPABASE_KEY}" };`;

fs.writeFileSync(outPath, content, 'utf8');
console.log('Wrote', outPath);
