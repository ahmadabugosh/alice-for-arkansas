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
    // Concept + real dollar figures, pulled live from budgets.csv
    const stability = await ask('What is the ALICE stability budget?');
    expect(stability.action).toBe('Explaining ALICE concept...');
    expect(stability.text).toContain('Stability Budget');
    expect(stability.text).toContain('Single Adult: $3,954/month — $47,448/year');

    // County ALICE Threshold dollar amounts are now available (from the
    // county time series).
    const threshold = await ask('What is the ALICE threshold for Benton County?');
    expect(threshold.action).toBe('SEARCH_COUNTY_DATA');
    expect(threshold.text).toContain('ALICE Threshold for Benton County (2024)');
    expect(threshold.text).toContain('Households under 65: $58,857/year');
    expect(threshold.text).toContain('Households 65 and over: $51,708/year');

    // County-level *budget* dollars are still not in this action's dataset.
    const budget = await ask('What is the ALICE survival Budget for Benton County?');
    expect(budget.action).toBe('SEARCH_COUNTY_DATA');
    expect(budget.text).toContain("I don't have county-level ALICE Threshold");
    expect(budget.text).toContain('Total below ALICE threshold: 29%');
  });

  it('answers Benton vs Washington threshold comparisons directly', async () => {
    for (const question of [
      'Is the ALICE threshold higher in Benton County than Washington County?',
      'Is the ALICE threshold higher in Benton County than in Washington County?'
    ]) {
      const result = await ask(question);
      expect(result.action).toBe('Comparing counties...');
      expect(result.text).toContain('No.');
      // Uses the latest-year (2024) below-ALICE-threshold rate
      expect(result.text).toContain('Benton County: 29% below the ALICE threshold');
      expect(result.text).toContain('Washington County: 38% below the ALICE threshold');
      expect(result.text).toContain('Difference: 9 percentage points');
    }
  });

  it('ranks counties, cities, zip codes, demographics, and employment from CSV data', async () => {
    const lowestCounty = await ask('What county in AR has the lowest ALICE rate?');
    expect(lowestCounty.action).toBe('Ranking locations...');
    expect(lowestCounty.text).toContain('1. Benton County: 21% (25,261 households)');

    const highestCounty = await ask('What county in AR has the highest ALICE rate?');
    expect(highestCounty.action).toBe('Ranking locations...');
    expect(highestCounty.text).toContain('1. Izard County: 39% (2,040 households)');

    // "most members" means absolute count, not rate -> rank by ALICE households
    const mostMembers = await ask('What county in Arkansas has the most members of the ALICE community?');
    expect(mostMembers.action).toBe('Ranking locations...');
    expect(mostMembers.text).toContain('highest ALICE households');
    expect(mostMembers.text).toContain('1. Pulaski County: 42,754 households');

    for (const question of [
      'What city has the lowest ALICE rate?',
      'What city in AR has the lowest ALICE rate?'
    ]) {
      const city = await ask(question);
      expect(city.action).toBe('Ranking locations...');
      expect(city.text).toContain('here are the cities with lowest ALICE rate');
      expect(city.text).toContain('(2024 data, latest available)');
      expect(city.text).toContain('1. Elm Springs city: 10% (106 households)');
      expect(city.text).not.toContain('Avilla CDP');
      expect(city.text).not.toContain('Goshen town');
    }

    const lowestZip = await ask('What zip code in AR has the lowest ALICE rate?');
    expect(lowestZip.action).toBe('Ranking locations...');
    expect(lowestZip.text).toContain('1. 72201: 7% (37 households)');

    const highestZip = await ask('What zip code in AR has the highest ALICE rate?');
    expect(highestZip.action).toBe('Ranking locations...');
    expect(highestZip.text).toContain('1. 72773: 70% (367 households)');

    const hispanicStatewide = await ask('How many Hispanic individuals are ALICE in AR?');
    expect(hispanicStatewide.action).toBe('Searching demographic data...');
    expect(hispanicStatewide.text).toContain('Hispanic/Latino households in Arkansas');
    // Defaults to the latest year (2024) race band breakdown
    expect(hispanicStatewide.text).toContain('latest available data, 2024');
    expect(hispanicStatewide.text).toContain('ALICE households: 38% (27,851 households)');

    const hispanicCounty = await ask('How many Hispanic individuals are ALICE in Benton County?');
    expect(hispanicCounty.action).toBe('Searching demographic data...');
    expect(hispanicCounty.text).toContain("I don't have demographic figures specific to Benton County");
    expect(hispanicCounty.text).not.toContain('27,735');

    const employment = await ask('What employment sector has the highest ALICE rate in the state?');
    expect(employment.action).toBe('Searching employment data...');
    expect(employment.text).toContain('1. Accommodation and Food Services: 27% (25,055 of 91,477 workers)');
  });

  it('declines pure town-size questions and redirects to ALICE questions', async () => {
    const result = await ask("What's the biggest town in Scott county?");

    expect(result.action).toBe('Ranking locations...');
    expect(result.text).toContain("ranking cities or towns by size isn't something my data set covers");
    expect(result.text).toContain("What's the ALICE rate in Scott County?");
    expect(result.text).not.toContain('Waldron');
    expect(result.text).not.toContain('Total households');

    // Bare "Arkansas" means the state — the redirect must not suggest
    // Arkansas County questions.
    const statewide = await ask('What is the largest city in Arkansas?');
    expect(statewide.action).toBe('Ranking locations...');
    expect(statewide.text).toContain("isn't something my data set covers");
    expect(statewide.text).toContain('Which county has the highest ALICE rate?');
    expect(statewide.text).not.toContain('Arkansas County');

    // Size questions that ARE about ALICE still get ranked answers
    const aliceSize = await ask('Which city has the biggest number of ALICE households?');
    expect(aliceSize.action).toBe('Ranking locations...');
    expect(aliceSize.text).toContain('highest ALICE households');
  });
});
