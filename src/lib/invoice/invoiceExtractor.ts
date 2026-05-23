export interface InvoiceExtractedFields {
  vendorName: string;
  invoiceNumber: string;
  invoiceDate: string | null;
  dueDate: string | null;
  subtotal: number | null;
  taxAmount: number | null;
  totalAmount: number | null;
  gstin: string | null;
  currency: string;
  confidence: number;
  warnings: string[];
  rawTextSnippet: string;
}

/**
 * Extracts structured invoice metadata from a file.
 * In a real application, this would send the file to an OCR / document intelligence API.
 * For this MVP, we parse details from the filename using heuristics and fallback to manual inputs.
 */
export async function extractInvoiceFields(file: File): Promise<InvoiceExtractedFields> {
  const fileName = file.name;
  const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
  
  // Default values
  let vendorName = '';
  let invoiceNumber = '';
  let invoiceDate: string | null = null;
  let dueDate: string | null = null;
  let totalAmount: number | null = null;
  let subtotal: number | null = null;
  let taxAmount: number | null = null;
  let gstin: string | null = null;
  let confidence = 0.5; // Default medium confidence for filename guessing
  const warnings: string[] = [];

  // Heuristic 1: Extract Invoice Number (e.g. INV-12345, #9832)
  const invNumMatch = nameWithoutExt.match(/(?:inv|invoice|num|#)[\s_.-]*([a-z0-9-]+)/i);
  if (invNumMatch && invNumMatch[1]) {
    invoiceNumber = invNumMatch[1].toUpperCase();
  } else {
    // Generate a simulated invoice number if not found
    invoiceNumber = 'INV-' + Math.floor(100000 + Math.random() * 900000);
    warnings.push('Invoice number not clearly detected in filename. Generated placeholder.');
  }

  // Heuristic 2: Extract Vendor Name (e.g. AWS_Invoice.pdf, Google_Receipt.pdf)
  // Split by common delimiters and take the first part
  const parts = nameWithoutExt.split(/[\s_.-]+/);
  if (parts.length > 0 && !['inv', 'invoice', 'receipt', 'bill'].includes(parts[0].toLowerCase())) {
    vendorName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
  } else if (parts.length > 1) {
    vendorName = parts[1].charAt(0).toUpperCase() + parts[1].slice(1).toLowerCase();
  } else {
    vendorName = 'Unknown Vendor';
    warnings.push('Vendor name could not be parsed from filename.');
  }

  // Heuristic 3: Extract amounts if formatted (e.g. AWS_15000_INR.pdf)
  const amountMatch = nameWithoutExt.match(/(?:rs|inr|amt|₹)?[\s_.-]*(\d+[\d,]*)(?:\.\d{2})?/i);
  if (amountMatch && amountMatch[1]) {
    const rawAmt = amountMatch[1].replace(/,/g, '');
    const numAmt = parseFloat(rawAmt);
    if (!isNaN(numAmt) && numAmt > 10) {
      totalAmount = numAmt;
      taxAmount = Math.round(numAmt * 0.18 * 100) / 100; // Assume 18% GST estimate
      subtotal = Math.round((numAmt - taxAmount) * 100) / 100;
      confidence = 0.8;
    }
  }

  if (totalAmount === null) {
    // Generate a default range total for review
    totalAmount = 15000.00;
    taxAmount = 2700.00;
    subtotal = 12300.00;
    warnings.push('Total amount not detected. Defaulting to ₹15,000 for review.');
  }

  // Heuristic 4: Dates (e.g. 2026-05-20 or 20-05-2026)
  const dateMatch = nameWithoutExt.match(/(\d{4}[-./]\d{2}[-./]\d{2})|(\d{2}[-./]\d{2}[-./]\d{4})/);
  if (dateMatch) {
    const rawDateStr = dateMatch[0].replace(/\./g, '-').replace(/\//g, '-');
    invoiceDate = rawDateStr;
    // Set due date 30 days after
    const d = new Date(rawDateStr);
    if (!isNaN(d.getTime())) {
      d.setDate(d.getDate() + 30);
      dueDate = d.toISOString().split('T')[0];
    }
  } else {
    // Default to today
    const today = new Date();
    invoiceDate = today.toISOString().split('T')[0];
    today.setDate(today.getDate() + 15); // 15 day term
    dueDate = today.toISOString().split('T')[0];
  }

  // GSTIN extraction (simulated matching typical Indian GSTIN format)
  // e.g. 27AAAAA1111A1Z1
  const gstinMatch = nameWithoutExt.match(/\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}/i);
  if (gstinMatch) {
    gstin = gstinMatch[0].toUpperCase();
    confidence = 0.9;
  } else {
    // 27-prefix is common for Maharashtra
    gstin = '27' + Math.random().toString(36).substring(2, 7).toUpperCase() + '1234A1Z5';
    warnings.push('GSTIN not explicitly found. Generated placeholder.');
  }

  // Simulated OCR raw text snippet
  const rawTextSnippet = `
    INVOICE / TAX INVOICE
    ===========================
    Seller GSTIN: ${gstin}
    Invoice Number: ${invoiceNumber}
    Invoice Date: ${invoiceDate}
    Due Date: ${dueDate}
    
    Description                  Qty    Unit Price    Amount
    ---------------------------------------------------------
    Professional CFO Consulting  1.0    ${subtotal}   ${subtotal}
    
    Subtotal: INR ${subtotal}
    IGST (18%): INR ${taxAmount}
    Total Amount: INR ${totalAmount}
    
    Thank you for your business!
    Bank details: HDFC Bank - A/C 5020002131234
    IFSC HDFC0000124
  `.trim();

  return {
    vendorName,
    invoiceNumber,
    invoiceDate,
    dueDate,
    subtotal,
    taxAmount,
    totalAmount,
    gstin,
    currency: 'INR',
    confidence,
    warnings,
    rawTextSnippet
  };
}
