import * as path from 'path';
import * as fs from 'fs';
import * as XLSX from 'xlsx';

const projectDir = 'c:/Users/sreev/kaeo';
const testDataDir = path.join(projectDir, 'test-data');

function searchFile(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  const relPath = path.relative(testDataDir, filePath);
  
  if (ext === '.csv') {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      if (line.includes('2999') || line.includes('2,999')) {
        console.log(`[CSV] Found in ${relPath}:${idx + 1}: ${line}`);
      }
    });
  } else if (ext === '.xlsx') {
    const xlsxObj = ((XLSX as any).default || XLSX) as typeof XLSX;
    try {
      const workbook = xlsxObj.readFile(filePath);
      workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        const rows = xlsxObj.utils.sheet_to_json<any>(sheet);
        rows.forEach((row: any, rIdx: number) => {
          Object.keys(row).forEach(key => {
            const valStr = String(row[key]);
            if (valStr.includes('2999') || valStr.includes('2,999')) {
              console.log(`[XLSX] Found in ${relPath} -> ${sheetName} row ${rIdx + 2}:`, row);
            }
          });
        });
      });
    } catch (e) {
      // ignore
    }
  }
}

function traverse(dir: string) {
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      traverse(fullPath);
    } else {
      searchFile(fullPath);
    }
  });
}

traverse(testDataDir);
console.log('Search finished.');
