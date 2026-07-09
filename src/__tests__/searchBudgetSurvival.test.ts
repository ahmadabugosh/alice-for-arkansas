import { describe, expect, it } from 'bun:test';
import { CsvDataService } from '../plugins/csv-analysis/services/csvDataService';
import { searchBudgetAction } from '../plugins/csv-analysis/actions/searchBudget';

const svc = new CsvDataService();
svc.initialize();
const runtime: any = { csvDataService: svc };

async function ask(text: string) {
  return searchBudgetAction.handler(runtime, { id: text, content: { text } } as any, {} as any, {}, undefined);
}

describe('searchBudget — Survival vs Stability', () => {
  it('loads both budget types', () => {
    expect(svc.getBudgetTypes().sort()).toEqual(['Stability', 'Survival']);
  });

  it('defaults to the Survival budget and offers the Stability one', async () => {
    const r: any = await ask('How much does a single adult need to live in Arkansas?');
    expect(r.text).toContain('ALICE Household Survival Budget for a Single Adult');
    expect(r.text).toContain('Monthly total: $2,273');
    expect(r.text).toContain('Annual total: $27,276');
    expect(r.text).toContain('Hourly wage needed (full-time): $13.64');
    expect(r.text).not.toContain('Savings:'); // Survival has no savings line
    expect(r.text).toContain('ALICE Household Stability Budget');
  });

  it('honors an explicit stability request and shows its savings line', async () => {
    const r: any = await ask('What is the stability budget for a single adult?');
    expect(r.text).toContain('ALICE Household Stability Budget for a Single Adult');
    expect(r.text).toContain('Monthly total: $3,954');
    expect(r.text).toContain('Savings: $285');
  });

  it('supports the new household types (Single Senior, Two Seniors)', async () => {
    const senior: any = await ask('survival budget for a single senior');
    expect(senior.text).toContain('Survival Budget for a Single Senior');
    expect(senior.text).toContain('Monthly total: $2,561');

    const twoSeniors: any = await ask('budget for two seniors');
    expect(twoSeniors.text).toContain('for a Two Seniors');
    expect(twoSeniors.text).toContain('Monthly total: $3,946');
  });
});
