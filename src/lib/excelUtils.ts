/**
 * Excel/CSV parsing utilities for player import
 */

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
 * Parse XLSX file (basic implementation - for full support use xlsx library)
 */
export async function parseXLSX(file: File): Promise<ParsedData> {
  // This is a placeholder - in production, use 'xlsx' library
  // For now, we'll only support CSV
  throw new Error('XLSX parsing requires xlsx library. Please use CSV format.');
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
 * Generate sample CSV template
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
 * Download CSV file
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
}