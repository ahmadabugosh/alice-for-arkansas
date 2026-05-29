import { beforeAll, describe, expect, it } from 'bun:test';
import { analyzeTrendsAction } from '../plugins/csv-analysis/actions/analyzeTrends';
import { compareCountiesAction } from '../plugins/csv-analysis/actions/compareCounties';
import { explainAliceAction } from '../plugins/csv-analysis/actions/explainAlice';
import { rankCountiesAction } from '../plugins/csv-analysis/actions/rankCounties';
import { searchCountyAction } from '../plugins/csv-analysis/actions/searchCounty';
import { searchDemographicsAction } from '../plugins/csv-analysis/actions/searchDemographics';
import { searchEmploymentAction } from '../plugins/csv-analysis/actions/searchEmployment';
import { searchStatewideAction } from '../plugins/csv-analysis/actions/searchStatewide';
import { CsvDataService } from '../plugins/csv-analysis/services/csvDataService';

const actions = [
  explainAliceAction,
  searchStatewideAction,
  searchDemographicsAction,
  searchEmploymentAction,
  analyzeTrendsAction,
  rankCountiesAction,
  compareCountiesAction,
  searchCountyAction
];

let csvDataService: CsvDataService;

beforeAll(() => {
  csvDataService = new CsvDataService();
  csvDataService.initialize();
});

async function ask(text: string) {
  delete (global as any).processedMessages;
  const runtime = { csvDataService };
  const message = { id: text, content: { text } };

  for (const action of actions) {
    if (!(await action.validate(runtime as any, message as any))) {
      continue;
    }

    let callbackText = '';
    const result = await action.handler(
      runtime as any,
      message as any,
      {} as any,
      {},
      (response: any) => {
        callbackText = typeof response === 'string' ? response : response?.text || '';
      }
    );

    const responseText = callbackText || (typeof result === 'string' ? result : result?.text || '');
    return { action: action.name, text: responseText };
  }

  throw new Error(`No action handled query: ${text}`);
}

describe('reviewed ALICE query regression matrix', () => {
  it('answers budget and county-threshold questions using only data we have', async () => {
    const stability = await ask('What is the ALICE stability budget?');
    expect(stability.action).toBe('Explaining ALICE concept...');
    expect(stability.text).toContain('ALICE Stability Budget');
    expect(stability.text).toContain("don't currently have Arkansas Stability Budget dollar amounts");

    for (const question of [
      'What is the ALICE threshold for Benton County?',
      'What is the ALICE survival Budget for Benton County?'
    ]) {
      const result = await ask(question);
      expect(result.action).toBe('SEARCH_COUNTY_DATA');
      expect(result.text).toContain("I don't have county-level ALICE Threshold");
      expect(result.text).toContain('Total below ALICE threshold: 29%');
      expect(result.text).toContain('ALICE households: 21% (23,721 households)');
      expect(result.text).toContain('Households in poverty: 8%');
    }
  });

  it('answers Benton vs Washington threshold comparisons directly', async () => {
    for (const question of [
      'Is the ALICE threshold higher in Benton County than Washington County?',
      'Is the ALICE threshold higher in Benton County than in Washington County?'
    ]) {
      const result = await ask(question);
      expect(result.action).toBe('Comparing counties...');
      expect(result.text).toContain('No.');
      expect(result.text).toContain('Benton County: 29% below the ALICE threshold');
      expect(result.text).toContain('Washington County: 41% below the ALICE threshold');
      expect(result.text).toContain('Difference: 12 percentage points');
    }
  });

  it('ranks counties, cities, zip codes, demographics, and employment from CSV data', async () => {
    const lowestCounty = await ask('What county in AR has the lowest ALICE rate?');
    expect(lowestCounty.action).toBe('Ranking locations...');
    expect(lowestCounty.text).toContain('1. Saline County: 9% (2,906 households)');

    const highestCounty = await ask('What county in AR has the highest ALICE rate?');
    expect(highestCounty.action).toBe('Ranking locations...');
    expect(highestCounty.text).toContain('1. Scott County: 45% (13,244 households)');

    for (const question of [
      'What city has the lowest ALICE rate?',
      'What city in AR has the lowest ALICE rate?'
    ]) {
      const city = await ask(question);
      expect(city.action).toBe('Ranking locations...');
      expect(city.text).toContain('here are the cities with lowest ALICE rate');
      expect(city.text).toContain('1. Lavaca city: 9% (78 households)');
      expect(city.text).not.toContain('Avilla CDP');
      expect(city.text).not.toContain('Goshen town');
    }

    const lowestZip = await ask('What zip code in AR has the lowest ALICE rate?');
    expect(lowestZip.action).toBe('Ranking locations...');
    expect(lowestZip.text).toContain('1. 72718: 12% (202 households)');

    const highestZip = await ask('What zip code in AR has the highest ALICE rate?');
    expect(highestZip.action).toBe('Ranking locations...');
    expect(highestZip.text).toContain('1. 71945: 59% (410 households)');

    const hispanicStatewide = await ask('How many Hispanic individuals are ALICE in AR?');
    expect(hispanicStatewide.action).toBe('Searching demographic data...');
    expect(hispanicStatewide.text).toContain('Hispanic/Latino households in Arkansas');
    expect(hispanicStatewide.text).toContain('ALICE households: 39% (27,735 households)');

    const hispanicCounty = await ask('How many Hispanic individuals are ALICE in Benton County?');
    expect(hispanicCounty.action).toBe('Searching demographic data...');
    expect(hispanicCounty.text).toContain("I don't have demographic figures specific to Benton County");
    expect(hispanicCounty.text).not.toContain('27,735');

    const employment = await ask('What employment sector has the highest ALICE rate in the state?');
    expect(employment.action).toBe('Searching employment data...');
    expect(employment.text).toContain('1. Orderlies and Psychiatric Aides: 67% (12,596 of 18,800 workers)');
  });
});
