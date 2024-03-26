import { Injectable } from '@angular/core';
import * as ExcelJS from 'exceljs';

@Injectable({
  providedIn: 'root'
})
export class ExcelService {

  constructor() { }

  generateExcelWorkbook(data: any[], fileName: string): ExcelJS.Workbook {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sheet 1');
    // Add headers
    const headers = Object.keys(data[0]);
    worksheet.addRow(headers);
    // Add data
    data.forEach((item) => {
      const row: any[] = [];
      headers.forEach((header) => {
        row.push(item[header]);
      });
      worksheet.addRow(row);
    });
    // Save the workbook to a blob
    // workbook.xlsx.writeBuffer().then((buffer) => {
    //   const blob = new Blob([buffer]);
    //
    // });
    return workbook;
  }
}
