/**
 * Excel/CSV parsing utilities for player import
 */
import * as XLSX from 'xlsx';

export interface ImportRow {
  [key: string]: string | number | null;
}

export interface ParsedData {
  headers: string[];
  rows: ImportRow[];
}

export interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export interface ImportResult {
  success: number;
  failed: number;
  errors: ValidationError[];
}

/**
 * Parse CSV file content
 */
export function parseCSV(content: string): ParsedData {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const rows: ImportRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
    const row: ImportRow = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || null;
    });
    rows.push(row);
  }

  return { headers, rows };
}

/**
 * Parse XLSX file using xlsx library
 */
export async function parseXLSX(file: File): Promise<ParsedData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          reject(new Error('Napaka pri branju datoteke'));
          return;
        }

        // Read the workbook
        const workbook = XLSX.read(data, { type: 'binary' });
        
        // Get first worksheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        if (jsonData.length === 0) {
          resolve({ headers: [], rows: [] });
          return;
        }

        // First row is headers
        const headers = jsonData[0].map(h => String(h || '').trim());
        
        // Remaining rows are data
        const rows: ImportRow[] = [];
        for (let i = 1; i < jsonData.length; i++) {
          const rowData = jsonData[i];
          const row: ImportRow = {};
          
          headers.forEach((header, index) => {
            const value = rowData[index];
            row[header] = value !== undefined && value !== null ? String(value).trim() : null;
          });
          
          rows.push(row);
        }

        resolve({ headers, rows });
      } catch (error: any) {
        reject(new Error(`Napaka pri branju XLSX datoteke: ${error.message}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Napaka pri branju datoteke'));
    };

    reader.readAsBinaryString(file);
  });
}

/**
 * Validate player row data
 */
export function validatePlayerRow(
  row: ImportRow,
  rowIndex: number,
  mapping: { [key: string]: string }
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check required fields
  const firstName = row[mapping['first_name'] || 'Ime'];
  const lastName = row[mapping['last_name'] || 'Priimek'];

  if (!firstName || firstName.toString().trim() === '') {
    errors.push({
      row: rowIndex + 1,
      field: 'Ime',
      message: 'Ime je obvezno',
    });
  }

  if (!lastName || lastName.toString().trim() === '') {
    errors.push({
      row: rowIndex + 1,
      field: 'Priimek',
      message: 'Priimek je obvezen',
    });
  }

  // Validate gender if provided
  const gender = row[mapping['gender'] || 'Spol'];
  if (gender && !['M', 'F', 'm', 'f'].includes(gender.toString())) {
    errors.push({
      row: rowIndex + 1,
      field: 'Spol',
      message: 'Spol mora biti M ali F',
    });
  }

  // Validate date of birth if provided
  const dob = row[mapping['date_of_birth'] || 'Datum rojstva'];
  if (dob) {
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(dob.toString())) {
      errors.push({
        row: rowIndex + 1,
        field: 'Datum rojstva',
        message: 'Datum mora biti v formatu YYYY-MM-DD (npr. 2010-01-15)',
      });
    }
  }

  return errors;
}

/**
 * Generate sample XLSX template
 */
export function generateSampleXLSX(): Blob {
  const headers = [
    'Ime',
    'Priimek',
    'Datum rojstva',
    'Spol',
    'Naslov',
    'Kraj',
    'Telefon',
  ];

  const sampleRows = [
    ['Janez', 'Novak', '2010-05-15', 'M', 'Cankarjeva 12', 'Ljubljana', '041234567'],
    ['Ana', 'Kovač', '2011-03-22', 'F', 'Prešernova 5', 'Maribor', '040987654'],
  ];

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
  
  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Igralci');

  // Generate XLSX file
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/**
 * Download XLSX file
 */
export function downloadXLSX(filename: string) {
  const blob = generateSampleXLSX();
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate sample CSV template (legacy support)
 */
export function generateSampleCSV(): string {
  const headers = [
    'Ime',
    'Priimek',
    'Datum rojstva',
    'Spol',
    'Naslov',
    'Kraj',
    'Telefon',
  ];

  const sampleRows = [
    ['Janez', 'Novak', '2010-05-15', 'M', 'Cankarjeva 12', 'Ljubljana', '041234567'],
    ['Ana', 'Kovač', '2011-03-22', 'F', 'Prešernova 5', 'Maribor', '040987654'],
  ];

  let csv = headers.join(',') + '\n';
  sampleRows.forEach(row => {
    csv += row.join(',') + '\n';
  });

  return csv;
}

/**
 * Download CSV file (legacy support)
 */
export function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}