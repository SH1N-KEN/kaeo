import * as fs from 'fs';
import * as path from 'path';

const projectDir = 'c:/Users/sreev/kaeo';
const reconDir = path.join(projectDir, 'test-data/reconciliation');

// Read baseline files
const bankContent = fs.readFileSync(path.join(reconDir, 'recon_bank_statement.csv'), 'utf8');
const razorpayContent = fs.readFileSync(path.join(reconDir, 'recon_razorpay_export.csv'), 'utf8');

// Modify the 89,000 transaction to represent a 100,000 processor settlement and 99,850 bank deposit (150 processor fee)
const modifiedBankContent = bankContent.replace(',89000,', ',99850,');
const modifiedRazorpayContent = razorpayContent.replace(',89000,', ',100000,');

fs.writeFileSync(path.join(reconDir, 'recon2_bank_statement.csv'), modifiedBankContent, 'utf8');
fs.writeFileSync(path.join(reconDir, 'recon2_razorpay_export.csv'), modifiedRazorpayContent, 'utf8');

console.log('✅ Created recon2_bank_statement.csv and recon2_razorpay_export.csv successfully!');
