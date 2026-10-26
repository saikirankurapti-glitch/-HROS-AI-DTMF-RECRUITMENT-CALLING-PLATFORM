import ExcelJS from 'exceljs';
const workbook=new ExcelJS.Workbook(),sheet=workbook.addWorksheet('Candidates');
sheet.addRow(['name','phone','email','location','role','consent','scenario']);
const scenarios=['interested','not_interested','no_input','invalid','no_answer','busy','failed'];
scenarios.forEach((s,i)=>sheet.addRow(['Example Candidate '+(i+1),'+1555010190'+(i+1),'person'+(i+1)+'@example.invalid','Fictional City','Data Engineer','yes',s]));
await workbook.xlsx.writeFile('hros-sample-candidates.xlsx');
console.log('Created hros-sample-candidates.xlsx with fictional numbers ONLY');
