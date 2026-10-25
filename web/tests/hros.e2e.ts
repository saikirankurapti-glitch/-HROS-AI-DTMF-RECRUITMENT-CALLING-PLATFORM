import {test,expect} from '@playwright/test';
import ExcelJS from 'exceljs';

test('HR can import a fictional candidate and complete a mock DTMF campaign',async({page})=>{
 const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Candidates');
 sheet.addRow(['name','phone','email','location','role','consent','scenario']);
 sheet.addRow(['Playwright Candidate','+15550109999','playwright@example.invalid','Test','Data Engineer','yes','interested']);
 const content=Buffer.from(await book.xlsx.writeBuffer());
 await page.goto('/');
 await expect(page.getByText('Welcome back')).toBeVisible();
 await page.getByLabel('Password').fill('playwright-local-password');
 await page.getByRole('button',{name:/Sign in/i}).click();
 await expect(page.getByText('Recruitment overview')).toBeVisible();
 await page.getByRole('button',{name:'Candidates',exact:true}).click();
 await page.getByLabel('Candidate Excel workbook').setInputFiles({
  name:'fixture.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:content
 });
 await page.getByRole('button',{name:/Preview Excel/i}).click();
 await expect(page.getByText('Playwright Candidate',{exact:true}).first()).toBeVisible();
 await page.getByRole('button',{name:/Import 1 candidates/i}).click();
 await expect(page.getByText('1 candidates imported')).toBeVisible();
 await page.getByRole('button',{name:'Campaigns',exact:true}).click();
 await page.getByLabel('Campaign name').fill('Playwright screening');
 await page.getByLabel('Job role').fill('Data Engineer');
 await page.getByRole('button',{name:/Create campaign/i}).click();
 await expect(page.getByText('Playwright screening').first()).toBeVisible();
 await page.getByRole('button',{name:/Start mock calls/i}).click();
 await expect(page.getByRole('dialog')).toBeVisible();
 await page.getByRole('button',{name:'Confirm start'}).click();
 await expect(page.getByText('INTERESTED',{exact:true})).toBeVisible({timeout:20000});
 await expect(page.getByText('MOCK MODE',{exact:true})).toBeVisible();
});

test('mobile navigation remains usable in mock mode',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await page.getByLabel('Password').fill('playwright-local-password');
 await page.getByRole('button',{name:/Sign in/i}).click();
 await expect(page.getByText('Recruitment overview')).toBeVisible();
 await page.getByRole('button',{name:'Open navigation'}).click();
 await page.getByRole('button',{name:'Candidates',exact:true}).click();
 await expect(page.getByText('Candidate management')).toBeVisible();
 await expect(page.getByText('MOCK MODE',{exact:true})).toBeVisible();
});
