import * as path from 'path';
import * as fs from 'fs';
import * as XLSX from 'xlsx';

const projectDir = 'c:/Users/sreev/kaeo';
const files = ['statement_hdfc.xlsx', 'statement_messy.xlsx', 'kaeo_stress_test_v2.xlsx'];

files.forEach(filename => {
  const filePath = path.join(projectDir, 'test-data/regression', filename);
  if (!fs.existsSync(filePath)) return;
  
  const xlsxObj = (XLSX as any).default || XLSX;
  const workbook = xlsxObj.readFile(filePath, { cellDates: true });
  
  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const data = xlsxObj.utils.sheet_to_json<any>(sheet);
    data.forEach((row, rIdx) => {
      Object.keys(row).forEach(key => {
        if (String(row[key]).includes('2999')) {
          console.log(`Found 2999 in ${filename} -> ${sheetName} row ${rIdx}:`, row);
        }
      });
    });
  });
});
