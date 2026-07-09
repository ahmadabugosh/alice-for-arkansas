import { describe, expect, it } from 'bun:test';
import { CsvDataService } from '../plugins/csv-analysis/services/csvDataService';
import { searchBudgetAction } from '../plugins/csv-analysis/actions/searchBudget';

const svc = new CsvDataService();
svc.initialize();
const runtime: any = { csvDataService: svc };

async function ask(text: string) {
  return searchBudgetAction.handler(runtime, { id: text, content: { text } } as any, {} as any, {}, undefined);
}

describe('searchBudget — county-level budgets', () => {
  it('loads the curated county budget subset (75 counties x 8 types)', () => {
    expect(svc.getAllCountyBudgets().length).toBe(600);
    expect(svc.getCountyBudgetHouseholdTypes().length).toBe(8);
  });

  it('answers a full county budget for a named county + household', async () => {
    const r: any = await ask('survival budget for a family of four in Benton County');
    expect(r.text).toContain('for a Two Adults Two Children in Benton County, Arkansas (2024)');
    expect(r.text).toContain('Monthly total: $5,770');
    expect(r.text).toContain('Annual total: $69,240');
    expect(r.text).toContain('county-specific');
  });

  it('answers a single-adult county budget (matches source total)', async () => {
    const r: any = await ask('how much does a single adult need to live in Pulaski County?');
    expect(r.text).toContain('Single Adult in Pulaski County');
    expect(r.text).toContain('Monthly total: $2,747');
  });

  it('answers a single line item for a county', async () => {
    const r: any = await ask('what is the child care cost for a family of four in Washington County?');
    expect(r.text).toContain('child care cost for a Two Adults Two Children in Washington County, Arkansas is $469');
  });

  it('shows a county budget overview when a county is named without a household type', async () => {
    const r: any = await ask('What is the ALICE survival Budget for Benton County?');
    expect(r.text).toContain('Survival Budget for Benton County, Arkansas (2024)');
    expect(r.text).toContain('Single Adult: $2,601/month');
    expect(r.text).toContain('Two Adults Two Children: $5,770/month');
    expect(r.text).not.toContain('the bottom line by household type'); // not the statewide overview
  });

  it('still returns the statewide budget when no county is named', async () => {
    const r: any = await ask('survival budget for a single adult');
    expect(r.text).toContain('ALICE Household Survival Budget for a Single Adult in Arkansas');
    expect(r.text).toContain('Monthly total: $2,273');
    expect(r.text).not.toContain('County');
  });
});
