import * as path from 'path';
import * as XLSX from 'xlsx';

const projectDir = 'c:/Users/sreev/kaeo';
const filePath = path.join(projectDir, 'test-data/regression/kaeo_stress_test_v2.xlsx');

const xlsxObj = ((XLSX as any).default || XLSX) as typeof XLSX;
const workbook = xlsxObj.readFile(filePath, { cellDates: true });
const sheet = workbook.Sheets['Statement Export'];
const rows = xlsxObj.utils.sheet_to_json<any>(sheet);

rows.forEach((row: any, idx: number) => {
  console.log(`Row ${idx + 2}:`, row);
});
