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
    expect(r.text).toContain('for a Two Adults Two Children household (two school-age children) in Benton County, Arkansas (2024)');
    expect(r.text).toContain('Monthly total: $5,770');
    expect(r.text).toContain('Annual total: $69,240');
    expect(r.text).toContain('county-specific');
  });

  it('collapses Rent + Utilities into Housing and deducts tax credits from Taxes', async () => {
    const r: any = await ask('survival budget for a family of four in Benton County');
    // Rent 885 + Utilities 348, shown as one Housing line (dashboard style)
    expect(r.text).toContain('Housing: $1,233');
    // Taxes 910 - 453 in credits
    expect(r.text).toContain('Taxes (after tax credits): $457');
    expect(r.text).not.toContain('Rent:');
    expect(r.text).not.toContain('Utilities:');
    expect(r.text).not.toContain('Tax Credits:');
  });

  it('notes the infant/preschooler alternative on generic family-of-four answers', async () => {
    const r: any = await ask('survival budget for a family of four in Benton County');
    expect(r.text).toContain('this assumes two school-age children');
    expect(r.text).toContain('$7,028/month ($84,336/year)');
  });

  it('routes family-of-four questions mentioning young kids to the childcare variant', async () => {
    const r: any = await ask('survival budget for two adults with an infant and a preschooler in Benton County');
    expect(r.text).toContain('Two Adults Two Childcare household (an infant and a preschooler in child care)');
    expect(r.text).toContain('Monthly total: $7,028');
    expect(r.text).not.toContain('this assumes two school-age children');
  });

  it('gives the full budget (not the child-care line) for "young children in child care" phrasing', async () => {
    const r: any = await ask('survival budget for a family of four with young children in child care in Washington County');
    expect(r.text).toContain('Two Adults Two Childcare household (an infant and a preschooler in child care)');
    expect(r.text).toContain('Monthly total: $6,658');
    // Explicit child-care line-item asks still work
    const item: any = await ask('what is the child care cost for a family of four with an infant and a preschooler in Washington County?');
    expect(item.text).toContain('child care cost for a Two Adults Two Childcare household');
    expect(item.text).toContain('is $1,396');
  });

  it('answers housing as the combined rent + utilities figure', async () => {
    const r: any = await ask('what is the housing cost for a family of four in Washington County?');
    // Rent 885 + Utilities 348
    expect(r.text).toContain('housing (rent + utilities) cost');
    expect(r.text).toContain('is $1,233');
  });

  it('explains tax credits as already deducted when asked directly', async () => {
    const r: any = await ask('what are the tax credits for a family of four in Washington County?');
    expect(r.text).toContain('receives $446/month in tax credits');
    expect(r.text).toContain('already deducted from the Taxes line');
    expect(r.text).toContain('$439/month after credits');
  });

  it('answers a single-adult county budget (matches source total)', async () => {
    const r: any = await ask('how much does a single adult need to live in Pulaski County?');
    expect(r.text).toContain('Single Adult in Pulaski County');
    expect(r.text).toContain('Monthly total: $2,747');
  });

  it('answers a single line item for a county', async () => {
    const r: any = await ask('what is the child care cost for a family of four in Washington County?');
    expect(r.text).toContain('child care cost for a Two Adults Two Children household (two school-age children) in Washington County, Arkansas is $469');
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
