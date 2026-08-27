import * as path from 'path';
import * as fs from 'fs';
import * as XLSX from 'xlsx';

const projectDir = 'c:/Users/sreev/kaeo';
const files = [
  'ingestion/statement.xlsx',
  'ingestion/kaeo_full_year_complex_stress_test.xlsx',
  'ingestion/multi_sheet_statement.xlsx'
];

files.forEach(filename => {
  const filePath = path.join(projectDir, 'test-data', filename);
  if (!fs.existsSync(filePath)) return;
  
  const xlsxObj = (XLSX as any).default || XLSX;
  const workbook = xlsxObj.readFile(filePath, { cellDates: true });
  
  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const data = xlsxObj.utils.sheet_to_json<any>(sheet);
    
    const seen = new Map<string, any[]>();
    data.forEach((row, idx) => {
      // Find all rows, log any containing 2999 in any cell
      let has2999 = false;
      Object.keys(row).forEach(key => {
        const valStr = String(row[key]);
        if (valStr.includes('2999') || valStr.includes('2,999')) {
          has2999 = true;
        }
      });
      if (has2999) {
        console.log(`[FOUND 2999] in ${filename} -> ${sheetName} row ${idx + 2}:`, row);
      }
      
      const amt = row['Withdrawal (₹)'] || row['Deposit (₹)'] || row['Debit Amt.'] || row['Deposit Amt.'] || row['Amount'] || row['__EMPTY_1'] || row['__EMPTY_2'] || '';
      const desc = row['Description'] || row['Narration'] || row['Transaction Description'] || row['__EMPTY'] || '';
      const date = row['Date'] || row['Txn Date'] || row['Kaeo Test Bank'] || '';
      const key = `${date}|${amt}|${desc}`;
      if (!seen.has(key)) {
        seen.set(key, []);
      }
      seen.get(key)!.push({ idx: idx + 2, row });
    });
    
    seen.forEach((list, key) => {
      if (list.length > 1) {
        // Only print duplicate lists that might contain amounts close to 2999
        const isTarget = list.some(item => {
          const rowStr = JSON.stringify(item.row);
          return rowStr.includes('2999') || rowStr.includes('2,999');
        });
        if (isTarget) {
          console.log(`[DUP LIST] Duplicate found in ${filename} -> ${sheetName} (count: ${list.length}):`);
          list.forEach(item => {
            console.log(`  Row ${item.idx}:`, item.row);
          });
        }
      }
    });
  });
});
