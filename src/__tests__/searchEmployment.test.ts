import { describe, expect, it } from 'bun:test';
import { searchEmploymentAction } from '../plugins/csv-analysis/actions/searchEmployment';
import { CsvDataService } from '../plugins/csv-analysis/services/csvDataService';

const svc = new CsvDataService();
svc.initialize();

const runtime: any = { csvDataService: svc };

async function ask(text: string) {
  return searchEmploymentAction.handler(
    runtime,
    { content: { text } } as any,
    {} as any,
    {},
    undefined
  ) as Promise<{ text: string; success: boolean }>;
}

describe('searchEmploymentAction', () => {
  it('answers sector questions from the labor force data (construction)', async () => {
    const result = await ask('How many ALICE households work in construction?');

    expect(result.text).toContain('Construction sector in 2024 (latest available)');
    expect(result.text).toContain('Total workers: 103,526');
    expect(result.text).toContain('Workers from ALICE households: 23,603 (23%)');
    expect(result.text).toContain('Workers from households in poverty: 10,748 (10%)');
    expect(result.text).toContain('Below the ALICE threshold combined: 34,351 (33%)');
  });

  it('answers occupation questions, preferring the more specific phrase', async () => {
    const result = await ask('What is the median wage for construction laborers?');

    expect(result.text).toContain('Construction Laborers in 2024 (latest available)');
    expect(result.text).toContain('Total employment: 21,152 workers');
    expect(result.text).toContain('47% of these workers');
    expect(result.text).toContain('$37,057 per year ($17.82 per hour)');
  });

  it('answers occupation questions from the jobs data (cashiers)', async () => {
    const result = await ask('How many cashiers are below the ALICE threshold in Arkansas?');

    expect(result.text).toContain('Cashiers in 2024 (latest available)');
    expect(result.text).toContain('Total employment: 22,654 workers');
    expect(result.text).toContain('50% of these workers');
  });

  it('ranks industry sectors by ALICE share', async () => {
    const result = await ask('Which industry sectors have the highest ALICE rates?');

    expect(result.text).toContain('highest share of workers from ALICE households in 2024');
    expect(result.text).toContain('1. Accommodation and Food Services: 27% (25,055 of 91,477 workers)');
  });

  it('explains when a requested category is genuinely not in the dataset', async () => {
    const result = await ask('How many ALICE Arkansans work in landscaping?');

    expect(result.text).toContain("I don't currently have occupation-level ALICE data for landscaping");
    expect(result.text).toContain('- Construction');
    expect(result.text).toContain('- Manufacturing');
    expect(result.text).not.toContain('Across 20 industry sectors');
  });

  it('gives a whole-labor-force overview for generic employment questions', async () => {
    const result = await ask('Tell me about ALICE and employment');

    expect(result.text).toContain('labor force picture for 2024 (latest available)');
    expect(result.text).toContain('1,404,006 workers total');
    expect(result.text).toContain('236,218 (17%) live in ALICE households');
  });

  it('blends related occupation data into sector answers (construction trades)', async () => {
    const result = await ask('How many ALICE Arkansans are employed in construction trades?');

    expect(result.text).toContain('Construction sector in 2024 (latest available)');
    expect(result.text).toContain('Workers from ALICE households: 23,603 (23%)');
    expect(result.text).toContain("Related occupations among Arkansas's 20 most common (2024):");
    expect(result.text).toContain('- Construction Laborers: 21,152 workers, 47% below the ALICE threshold (about 9,941 workers), median wage $17.82/hour');
  });

  it('lists all 20 most common occupations on request', async () => {
    const result = await ask("What are Arkansas's Top 20 most common occupations?");

    expect(result.text).toContain("Arkansas's 20 most common occupations in 2024 (latest available)");
    expect(result.text).toContain('1. Driver/Sales Workers And Truck Drivers: 39,991 workers');
    expect(result.text).toContain('8. Cashiers: 22,654 workers — 50% below the ALICE threshold, median wage $13.18/hour');
    expect(result.text).toContain('20. First-Line Supervisors Of Office And Administrative Support Workers: 12,020 workers');
  });

  it('lists all 20 industry sectors on request', async () => {
    const result = await ask('Can you list the 20 industry sectors?');

    expect(result.text).toContain('20 industry sectors in my Arkansas labor force data for 2024 (latest available)');
    expect(result.text).toContain('1. Health Care and Social Assistance: 213,420 workers — 22% below the ALICE threshold');
    expect(result.text).toContain('5. Construction: 103,526 workers — 33% below the ALICE threshold');
    expect(result.text).toContain('20. Management of Companies and Enterprises: 2,181 workers');
  });

  it('still ranks (not lists) when a ranking is asked for', async () => {
    const result = await ask('Which occupations have the highest ALICE rate?');

    expect(result.text).toContain('occupations with the highest share of workers below the ALICE threshold in 2024');
    expect(result.text).toContain('1. Waiters And Waitresses: 51%');
    expect(result.text).not.toContain('most common occupations in 2024');
  });
});
