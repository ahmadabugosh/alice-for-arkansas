import { describe, expect, it } from 'bun:test';
import { searchDemographicsAction } from '../plugins/csv-analysis/actions/searchDemographics';
import { CsvDataService } from '../plugins/csv-analysis/services/csvDataService';

const svc = new CsvDataService();
svc.initialize();

const runtime: any = { csvDataService: svc };

async function ask(text: string) {
  delete (global as any).processedMessages;
  return searchDemographicsAction.handler(
    runtime,
    { id: text, content: { text } } as any,
    {} as any,
    {},
    undefined
  ) as Promise<{ text: string; success: boolean }>;
}

describe('searchDemographicsAction county-level breakdowns', () => {
  it('answers race questions for a named county', async () => {
    const result = await ask('How many Hispanic individuals are ALICE in Benton County?');

    expect(result.text).toContain('Hispanic households in Benton County (latest available data, 2024)');
    expect(result.text).toContain('Total households: 14,639');
    expect(result.text).toContain('ALICE households: 32% (4,708 households)');
    expect(result.text).toContain('Households in poverty: 4% (614 households)');
    expect(result.text).toContain('Total below ALICE threshold: 36%');
    // Must not leak the statewide Hispanic figure
    expect(result.text).not.toContain('27,851');
  });

  it('gives gender queries the statewide-style treatment at the county level', async () => {
    const result = await ask('Give me a gender breakdown of ALICE households in Pulaski County');

    expect(result.text).toContain(
      'The only gender-related ALICE data I have for Pulaski County is the Married, Single-Female-Headed, and Single-Male-Headed household breakdown for families with children.'
    );
    expect(result.text).toContain('latest available data (2024)');
    expect(result.text).toContain('Married With Children:');
    expect(result.text).toContain('Single-Female-Headed With Children:');
    expect(result.text).toContain('ALICE households: 25% (3,816 households)');
    expect(result.text).toContain('Total below ALICE threshold: 66%');
    expect(result.text).toContain('Single-Male-Headed With Children:');
    // The no-children category is not part of the gender framing
    expect(result.text).not.toContain('Single or Cohabiting');
    expect(result.text).toContain(
      'Note: These figures describe household structure among families with children in Pulaski County. Our dataset does not include a full gender breakdown for all ALICE households.'
    );
  });

  it('answers single-mother questions for a named county with just that type', async () => {
    const result = await ask('What can you tell me about single mothers in Pulaski County?');

    expect(result.text).toContain('Single-Female-Headed With Children households in Pulaski County (latest available data, 2024)');
    expect(result.text).toContain('Total households: 15,265');
    expect(result.text).toContain('ALICE households: 25% (3,816 households)');
    expect(result.text).toContain('Households in poverty: 41% (6,183 households)');
    expect(result.text).not.toContain('Married With Children:');
  });

  it('lists all four county household types for household-type questions', async () => {
    const result = await ask('ALICE rates by household type in Pulaski County');

    expect(result.text).toContain('Married With Children:');
    expect(result.text).toContain('Single-Female-Headed With Children:');
    expect(result.text).toContain('Single-Male-Headed With Children:');
    expect(result.text).toContain('Single or Cohabiting, Under 65, no Children:');
    expect(result.text).toContain('Total households: 91,273');
    expect(result.text).toContain("Households headed by someone 65 or over aren't broken out by household type");
  });

  it('resolves "White households in White County" to the race band in that county', async () => {
    const result = await ask('How many White households are ALICE in White County?');

    expect(result.text).toContain('White households in White County (latest available data, 2024)');
    expect(result.text).toContain('Total households: 28,226');
    expect(result.text).toContain('ALICE households: 31% (8,888 households)');
    expect(result.text).toContain('Total below ALICE threshold: 47%');
  });

  it('shows all races for a county when none is named — even in White County', async () => {
    const result = await ask('ALICE rates by race in White County');

    expect(result.text).toContain('Here are ALICE figures by race/ethnicity in White County (latest available data, 2024)');
    expect(result.text).toContain('Black:');
    expect(result.text).toContain('Hispanic:');
    expect(result.text).toContain('ALICE households: 31% (8,888)');
  });

  it('answers age questions for a named county', async () => {
    const result = await ask('ALICE households by age in Washington County');

    expect(result.text).toContain('Here are ALICE figures by age of head of household in Washington County (latest available data, 2024)');
    expect(result.text).toContain('Under 25 Years:');
    expect(result.text).toContain('Total households: 9,410');
    expect(result.text).toContain('Total below ALICE threshold: 70%');
  });

  it('answers senior questions for a named county with the 65+ band', async () => {
    const result = await ask('How many seniors are ALICE in Sebastian County?');

    expect(result.text).toContain('Households headed by someone 65 years and over in Sebastian County (latest available data, 2024)');
    expect(result.text).toContain('Total households: 14,781');
    expect(result.text).toContain('ALICE households: 37% (5,414 households)');
  });

  it('gives a compact all-dimension overview for generic county demographic questions', async () => {
    const result = await ask('What are the demographics of Washington County?');

    expect(result.text).toContain('Demographic breakdown for Washington County (latest available data, 2024)');
    expect(result.text).toContain('All households: 99,868 total — 25% ALICE (25,168), 13% in poverty (12,866), 38% below the ALICE threshold.');
    expect(result.text).toContain('By age of head of household (share below the ALICE threshold):');
    expect(result.text).toContain('- Under 25 Years: 70% (6,563 of 9,410 households)');
    expect(result.text).toContain('- Single-Female-Headed With Children: 71% (3,850 of 5,446 households)');
    expect(result.text).toContain('- Hispanic: 45% (5,838 of 13,163 households)');
    expect(result.text).toContain('Ask about any group by name');
  });

  it('explains that county demographic trends are 2024-only and serves the 2024 picture', async () => {
    const result = await ask('How have ALICE rates by race changed over time in Benton County?');

    expect(result.text).toContain('My county-level demographic breakdowns cover 2024 only');
    expect(result.text).toContain('Here are ALICE figures by race/ethnicity in Benton County (latest available data, 2024)');
  });

  it('flags groups resting on a tiny number of households', async () => {
    const result = await ask('How many Pacific Islander households are ALICE in Izard County?');

    expect(result.text).toContain('Native Hawaiian/Pacific Islander households in Izard County');
    expect(result.text).toContain('Total households: 1');
    // Pluralization must survive a count of one
    expect(result.text).toContain('ALICE households: 100% (1 household)');
    expect(result.text).not.toContain('(1 households)');
    expect(result.text).toContain('Note: This covers just 1 household in Izard County');
    expect(result.text).toContain('rough indicator rather than a reliable rate');
  });

  it('marks small-sample groups and omits empty ones from county listings', async () => {
    const result = await ask('ALICE rates by race in White County');

    // 76 households → flagged
    expect(result.text).toContain('American Indian/Alaska Native (small sample):');
    // 28,226 households → not flagged
    expect(result.text).toContain('White:\n');
    expect(result.text).not.toContain('White (small sample)');
    // Zero-household groups must not render as a misleading 0%
    expect(result.text).toContain('Not listed: my data set records no households in this county for Native Hawaiian/Pacific Islander.');
    expect(result.text).not.toContain('Native Hawaiian/Pacific Islander:\n  Total households: 0');
    expect(result.text).toContain('Note: Groups marked "(small sample)" cover fewer than 100 households');
  });

  it('says so plainly when a county has no households in the group asked about', async () => {
    const result = await ask('How many Pacific Islander households are ALICE in White County?');

    expect(result.text).toContain('My data set records no Native Hawaiian/Pacific Islander households in White County for 2024');
    expect(result.text).toContain('statewide');
    expect(result.text).not.toContain('0%');
  });

  it('carries the small-sample flag into the county overview', async () => {
    const result = await ask('What are the demographics of Sevier County?');

    expect(result.text).toContain('- Asian (small sample): 100% (1 of 1 household)');
    expect(result.text).toContain('- White: 54%');
    expect(result.text).toContain('Note: Groups marked "(small sample)" cover fewer than 100 households');
  });

  it('serves the statewide demographic overview from the 2024 datasets, not demographics.csv', async () => {
    const result = await ask('What are the demographics of Arkansas?');

    expect(result.text).toContain('Here is the statewide demographic picture for Arkansas (latest available data, 2024)');
    expect(result.text).toContain('All households: 1,232,610 total — 27% ALICE (335,094), 16% in poverty (196,766), 43% below the ALICE threshold.');
    expect(result.text).toContain('- Single-Female-Headed: 75% (62,132 of 82,668 households)');
    expect(result.text).toContain('- Black: 60% (109,995 of 183,646 households)');
    // The stale demographics.csv overview must never surface
    expect(result.text).not.toContain('537,094');
    expect(result.text).not.toContain('Couples Married With Children at 11%');
  });
});
