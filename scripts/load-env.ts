import * as fs from 'fs';
import * as path from 'path';

const projectDir = 'c:/Users/sreev/kaeo';
try {
  const envPath = path.join(projectDir, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim();
        process.env[key] = value;
      }
    });
  }
} catch (err) {
  console.error('Failed to load .env file in load-env helper:', err);
}
