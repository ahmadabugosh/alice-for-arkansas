import { describe, expect, it } from 'bun:test';
import { explainAliceAction } from '../plugins/csv-analysis/actions/explainAlice';
import { CsvDataService } from '../plugins/csv-analysis/services/csvDataService';

const svc = new CsvDataService();
svc.initialize();
const runtime: any = { csvDataService: svc };

async function ask(text: string) {
  const valid = await explainAliceAction.validate(runtime, { content: { text } } as any);
  if (!valid) return { valid, text: '' };
  const r: any = await explainAliceAction.handler(runtime, { id: text, content: { text } } as any, {} as any, {}, undefined);
  return { valid, text: r.text as string };
}

describe('explainAlice — dynamic, never-stale figures', () => {
  it('answers "what is the ALICE threshold?" with real Survival Budget figures', async () => {
    const r = await ask('What is the ALICE threshold?');
    expect(r.valid).toBe(true);
    expect(r.text).toContain('Single Adult: $2,273/month — $27,276/year');
    expect(r.text).toContain('county-specific ALICE Threshold dollar amounts');
  });

  it('answers the stability budget concept with real dollar figures', async () => {
    const r = await ask('What is the ALICE stability budget?');
    expect(r.valid).toBe(true);
    expect(r.text).toContain('Single Adult: $3,954/month — $47,448/year');
    expect(r.text).not.toContain("don't currently have");
  });

  it('answers poverty-line vs ALICE with year-labeled FPL and real budget data', async () => {
    const r = await ask('What is the federal poverty level vs ALICE?');
    expect(r.valid).toBe(true);
    expect(r.text).toContain('For 2024, the FPL was $15,060');
    expect(r.text).toContain('$27,276');
  });

  it('answers "how is ALICE calculated?"', async () => {
    const r = await ask('How is ALICE calculated?');
    expect(r.valid).toBe(true);
    expect(r.text).toContain('above the Federal Poverty Level but below the ALICE Threshold');
  });

  it('does NOT intercept budget queries naming a household type (searchBudget owns those)', async () => {
    const r = await ask('What is the ALICE survival budget for a single adult?');
    expect(r.valid).toBe(false);
  });

  it('does NOT intercept county-specific threshold questions', async () => {
    const r = await ask('What is the ALICE threshold for Benton County?');
    expect(r.valid).toBe(false);
  });
});
