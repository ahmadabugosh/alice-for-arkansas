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

    // County-level demographics come from the county breakdown data, not the
    // statewide figures.
    const hispanicCounty = await ask('How many Hispanic individuals are ALICE in Benton County?');
    expect(hispanicCounty.action).toBe('Searching demographic data...');
    expect(hispanicCounty.text).toContain('Hispanic households in Benton County (latest available data, 2024)');
    expect(hispanicCounty.text).toContain('ALICE households: 32% (4,708 households)');
    expect(hispanicCounty.text).not.toContain('27,851');

    const employment = await ask('What employment sector has the highest ALICE rate in the state?');
    expect(employment.action).toBe('Searching employment data...');
    expect(employment.text).toContain('1. Accommodation and Food Services: 27% (25,055 of 91,477 workers)');
  });

  it('compares cities, towns, zip codes, and mixed place-vs-county', async () => {
    const cities = await ask('Compare Springdale and Rogers');
    expect(cities.action).toBe('Comparing counties...');
    expect(cities.text).toContain('Location Comparison (2024, latest available)');
    expect(cities.text).toContain('Springdale city:');
    expect(cities.text).toContain('ALICE households: 29% (8,728 households)');
    expect(cities.text).toContain('Rogers city:');
    expect(cities.text).toContain('ALICE households: 21% (5,615 households)');
    expect(cities.text).toContain('Rogers city has the lower rate at 21%');

    const yesNo = await ask('Is the ALICE rate higher in Waldron than in Greenwood?');
    expect(yesNo.action).toBe('Comparing counties...');
    expect(yesNo.text).toContain('Yes.');
    expect(yesNo.text).toContain('Waldron city: 31%');
    expect(yesNo.text).toContain('Greenwood city: 26%');
    expect(yesNo.text).toContain('Difference: 5 percentage points');

    const mixed = await ask('Compare Springdale to Washington County');
    expect(mixed.action).toBe('Comparing counties...');
    expect(mixed.text).toContain('Springdale city:');
    expect(mixed.text).toContain('Washington County:');
    expect(mixed.text).toContain('Below ALICE threshold: 38% (ALICE + poverty combined)');

    const zips = await ask('Compare zip code 72201 and 72773');
    expect(zips.action).toBe('Comparing counties...');
    expect(zips.text).toContain('72201:');
    expect(zips.text).toContain('ALICE households: 7% (37 households)');
    expect(zips.text).toContain('72773:');
    expect(zips.text).toContain('ALICE households: 70% (367 households)');

    // Overlapping names resolve to the right places
    const overlap = await ask('Compare North Little Rock and Little Rock');
    expect(overlap.text).toContain('North Little Rock city:');
    expect(overlap.text).toContain('ALICE households: 28% (8,916 households)');
    expect(overlap.text).toContain('Little Rock city:');
    expect(overlap.text).toContain('ALICE households: 23% (20,201 households)');
  });

  it('compares townships, disambiguating repeated names by county', async () => {
    // County-qualified townships resolve to those exact townships — the
    // qualifier counties must not become comparison subjects themselves.
    const qualified = await ask('Compare Union township in Saline County and Prairie township in Washington County');
    expect(qualified.action).toBe('Comparing counties...');
    expect(qualified.text).toContain('Union township (Saline County):');
    expect(qualified.text).toContain('Total households: 259');
    expect(qualified.text).toContain('Prairie township (Washington County):');
    expect(qualified.text).toContain('Total households: 1,777');
    expect(qualified.text).not.toContain('Saline County:');
    expect(qualified.text).not.toContain('several counties have a township named');

    // Without a county, repeated township names get a transparent note
    const ambiguous = await ask('Compare Union township and Prairie township');
    expect(ambiguous.text).toContain('Union township (');
    expect(ambiguous.text).toContain('several counties have a township named');

    // "X township" must never be read as X County
    expect(ambiguous.text).not.toContain('Union County');
    expect(ambiguous.text).not.toContain('Priority Status');

    // Plain county comparison is untouched by the township logic
    const counties = await ask('Compare Union County and Prairie County');
    expect(counties.text).toContain('County Comparison Analysis (2024, latest available)');
    expect(counties.text).toContain('Union County:');
    expect(counties.text).toContain('Prairie County:');
  });

  it('serves household-type questions from the 2024 families-with-children data', async () => {
    for (const question of [
      'What can you tell me about single parents in Arkansas?',
      'ALICE rates by household type'
    ]) {
      const result = await ask(question);
      expect(result.action).toBe('Searching demographic data...');
      expect(result.text).toContain('latest available data (2024)');
      expect(result.text).toContain('Single-Female-Headed:');
      expect(result.text).toContain('ALICE households: 30% (24,748 households)');
      expect(result.text).toContain('Households in poverty: 45% (37,384 households)');
      // The stale demographics.csv table must never surface
      expect(result.text).not.toContain('Couples Age');
      expect(result.text).not.toContain('64,120');
      expect(result.text).not.toContain('Single or Cohabiting');
    }

    // Age-flavored household questions still get the households-by-age data
    const byAge = await ask('How many households by age are ALICE in Arkansas?');
    expect(byAge.text).toContain('by age of head of household in Arkansas (latest available data, 2024)');
    expect(byAge.text).toContain('Age 65 and Over');
    expect(byAge.text).toContain('ALICE households: 37% (128,862)');
  });

  it('routes county-named demographic questions without mistaking county names for races', async () => {
    // A plain county question stays with the county action even though the
    // county is named "White".
    for (const question of [
      'What is the ALICE rate in White County?',
      'ALICE data for White County',
      'How many households are in White County?'
    ]) {
      const plain = await ask(question);
      expect(plain.action).toBe('SEARCH_COUNTY_DATA');
      expect(plain.text).toContain('White County');
      expect(plain.text).toContain('ALICE households: 27% (8,703 households)');
      expect(plain.text).not.toContain('Demographic breakdown');
    }

    // But an actual race question about that same county reaches the race band.
    const race = await ask('How many White households are ALICE in White County?');
    expect(race.action).toBe('Searching demographic data...');
    expect(race.text).toContain('White households in White County (latest available data, 2024)');
    expect(race.text).toContain('Total households: 28,226');

    // Races outside the short keyword list still route correctly, county-level
    // and statewide.
    const county = await ask('How many Pacific Islander households are ALICE in Izard County?');
    expect(county.action).toBe('Searching demographic data...');
    expect(county.text).toContain('Native Hawaiian/Pacific Islander households in Izard County');
    expect(county.text).toContain('Note: This covers just 1 household in Izard County');

    const statewide = await ask('How many Pacific Islander households are ALICE in Arkansas?');
    expect(statewide.action).toBe('Searching demographic data...');
    expect(statewide.text).toContain('Native Hawaiian/Pacific Islander households in Arkansas');
    expect(statewide.text).toContain('Total households: 2,528');
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
