import { Action, IAgentRuntime, Memory, State } from '@elizaos/core';
import { CsvDataService, CountyDemographicData, DemographicData, HouseholdTypeData, HouseholdTypeTrendData, RaceTrendData, RaceBreakdownData, AgeTrendData, AgeBreakdownData } from '../services/csvDataService';
import { AR_COUNTY_NAMES } from '../constants/arkansasCounties';

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[-–—]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isGenderRelatedQuery(text: string): boolean {
  return /\b(?:gender|female|male|woman|women|man|men)\b/.test(normalizeText(text));
}

function normalizeCategory(category: string): string {
  return category.replace(/\s+/g, ' ').trim();
}

function getGenderRelatedHouseholdData(demographicData: DemographicData[]): DemographicData[] {
  const categories = [
    'Couples Married With Children',
    'Single-Female-Headed With Children',
    'Single-Male-Headed With Children'
  ];

  return categories
    .map((category) => demographicData.find((demo) => normalizeCategory(demo.category) === category))
    .filter((demo): demo is DemographicData => Boolean(demo));
}

// Pull a specific year out of the query. Returns a concrete year (e.g. 2023),
// the sentinel 'previous' for relative phrasing ("last/previous/earlier year"),
// or undefined when the user didn't ask for any particular year.
function detectRequestedYear(text: string): number | 'previous' | undefined {
  const lower = text.toLowerCase();
  const explicit = lower.match(/\b(20\d{2})\b/);
  if (explicit) return parseInt(explicit[1], 10);
  if (/\b(previous|prior|earlier|older|last year|year before)\b/.test(lower)) return 'previous';
  return undefined;
}

// Detect "how has this changed over time" style questions.
function isTrendQuery(text: string): boolean {
  return /\b(trend|trends|over time|over the years|throughout the years|history|historical|change|changed|changing|year over year|year-over-year|each year|growth|grown|grew|decline|declined|increase|increased|decrease|decreased|since \d{4})\b/i.test(text);
}

// Identify which household type, if any, the user named.
function detectHouseholdType(text: string): string | undefined {
  const lower = text.toLowerCase();
  if (/\b(single[\s-]*female|female[\s-]*head|single mother|single mom)/.test(lower)) return 'Single-Female-Headed';
  if (/\b(single[\s-]*male|male[\s-]*head|single father|single dad)/.test(lower)) return 'Single-Male-Headed';
  if (/\b(married|couples?|two[\s-]*parent)/.test(lower)) return 'Married';
  return undefined;
}

const RACE_TREND_NOTE =
  'Note: "below the ALICE threshold" combines ALICE households (above poverty but below the cost of basic needs) and households in poverty.';

// Identify which race/ethnicity, if any, the user named. Names match the
// canonical labels stored in race-trends.csv.
export function detectRace(text: string): string | undefined {
  const lower = text.toLowerCase();
  if (/\b(hispanic|latino|latina|latinx)\b/.test(lower)) return 'Hispanic/Latino';
  if (/\b(black|african[\s-]*american)\b/.test(lower)) return 'Black';
  if (/\bwhite\b/.test(lower)) return 'White';
  if (/\basian\b/.test(lower)) return 'Asian';
  if (/\b(american indian|native american|alaska native|ai\/an)\b/.test(lower)) return 'American Indian/Alaska Native';
  if (/\b(hawaiian|pacific islander)\b/.test(lower)) return 'Native Hawaiian/Pacific Islander';
  if (/\b(two or more races|2\+ races|multiracial|biracial|mixed race)\b/.test(lower)) return 'Two or More Races';
  return undefined;
}

const ALL_RACES = [
  'White', 'Black', 'Hispanic/Latino', 'Asian',
  'American Indian/Alaska Native', 'Native Hawaiian/Pacific Islander', 'Two or More Races'
];

// Historical series of households below the ALICE threshold, per race.
function formatRaceTrend(csvService: CsvDataService, names: string[]): string {
  const selected = names.length ? names : ALL_RACES;
  let response =
    'Here is how the number of households below the ALICE threshold (ALICE + poverty combined) has changed over time by race/ethnicity:\n\n';
  selected.forEach((race) => {
    const series = csvService.getRaceTrend(race);
    if (!series.length) return;
    response += `${race} (below ALICE threshold):\n`;
    series.forEach((point) => {
      response += `  ${point.year}: ${point.below_alice_threshold.toLocaleString()} households\n`;
    });
    const first = series[0];
    const last = series[series.length - 1];
    const delta = last.below_alice_threshold - first.below_alice_threshold;
    const direction = delta > 0 ? 'increase' : delta < 0 ? 'decrease' : 'no change';
    response += `  Net change ${first.year}–${last.year}: ${delta >= 0 ? '+' : ''}${delta.toLocaleString()} (${direction})\n\n`;
  });
  response += RACE_TREND_NOTE;
  return response;
}

// Below-threshold totals by race for a single year.
function formatRaceThresholdYear(rows: RaceTrendData[], year: number): string {
  let response = `For ${year}, here are the households below the ALICE threshold (ALICE + poverty combined) in Arkansas by race/ethnicity:\n\n`;
  rows.forEach((row) => {
    response += `${row.race}: ${row.below_alice_threshold.toLocaleString()} households below the ALICE threshold\n`;
  });
  response += `\n${RACE_TREND_NOTE}`;
  return response;
}

function raceOtherYearsNote(shownYear: number, availableYears: number[]): string {
  const others = availableYears.filter((y) => y !== shownYear).sort((a, b) => b - a);
  if (others.length === 0) return '';
  return `\nI also have race/ethnicity ALICE data for ${others.join(', ')} — ask for a specific year for those figures.`;
}

const racePct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

// Full band breakdown (Above/ALICE/Poverty/total) for one race.
function formatRaceBandSingle(
  rows: RaceBreakdownData[],
  race: string,
  year: number,
  isLatest: boolean,
  availableYears: number[]
): string {
  const row = rows.find((r) => r.race === race);
  if (!row) return `I don't have ${race} ALICE data for ${year} in my data set.`;

  const head = isLatest ? `latest available data, ${year}` : `${year}`;
  let response = `${race} households in Arkansas (${head}):\n\n`;
  response += `Total households: ${row.households.toLocaleString()}\n`;
  response += `Above ALICE threshold: ${racePct(row.above, row.households)}% (${row.above.toLocaleString()} households)\n`;
  response += `ALICE households: ${racePct(row.alice, row.households)}% (${row.alice.toLocaleString()} households)\n`;
  response += `Households in poverty: ${racePct(row.poverty, row.households)}% (${row.poverty.toLocaleString()} households)\n`;
  response += `Total below ALICE threshold: ${racePct(row.alice, row.households) + racePct(row.poverty, row.households)}%\n`;
  response += raceOtherYearsNote(year, availableYears);
  return response;
}

// Full band breakdown across all races.
function formatRaceBandAll(rows: RaceBreakdownData[], year: number, isLatest: boolean, availableYears: number[]): string {
  const head = isLatest ? `latest available data, ${year}` : `${year}`;
  let response = `Here are ALICE figures by race/ethnicity in Arkansas (${head}):\n\n`;
  rows.forEach((row) => {
    response += `${row.race}:\n`;
    response += `  Total households: ${row.households.toLocaleString()}\n`;
    response += `  ALICE households: ${racePct(row.alice, row.households)}% (${row.alice.toLocaleString()})\n`;
    response += `  Households in poverty: ${racePct(row.poverty, row.households)}% (${row.poverty.toLocaleString()})\n`;
    response += `  Total below ALICE threshold: ${racePct(row.alice, row.households) + racePct(row.poverty, row.households)}%\n\n`;
  });
  response += 'Note: ALICE households are above poverty but below the cost of basic needs; the ALICE threshold includes both ALICE and poverty households.';
  response += raceOtherYearsNote(year, availableYears);
  return response;
}

// Legacy race breakdown from demographics.csv (2023 percentages). Used as a
// fallback when no newer race data (band/trend) is available.
function formatRaceFromDemographics(demographicData: DemographicData[], lowerText: string): string {
  const raceData = demographicData.filter((d) =>
    ['White', 'Black', 'Hispanic/Latino', 'Asian', 'Native American', 'Two or More Races'].includes(d.category.trim())
  );

  const specificRace: Record<string, string> = {
    white: 'White', black: 'Black', hispanic: 'Hispanic/Latino', latino: 'Hispanic/Latino',
    asian: 'Asian', 'native american': 'Native American'
  };
  let matchedRace: string | null = null;
  for (const [keyword, category] of Object.entries(specificRace)) {
    if (lowerText.includes(keyword)) { matchedRace = category; break; }
  }

  if (matchedRace) {
    const specificData = demographicData.find((d) => d.category.trim() === matchedRace);
    if (!specificData) return `I don't have specific ALICE data for ${matchedRace} households in my dataset.`;
    const combinedThreshold = specificData.alice_percentage + specificData.poverty_percent;
    let response = `According to my data set, ${specificData.category} households in Arkansas:\n\n`;
    response += `ALICE households: ${specificData.alice_percentage}% (${specificData.alice_households.toLocaleString()} households)\n`;
    response += `Households in poverty: ${specificData.poverty_percent}%\n`;
    response += `Total below ALICE threshold: ${combinedThreshold}% (ALICE + poverty combined)\n\n`;
    response += `This means ${specificData.alice_households.toLocaleString()} ${specificData.category} households are specifically ALICE (above poverty but below the cost of basic needs).`;
    return response;
  }

  let response = 'According to my data set, here are ALICE rates by race/ethnicity in Arkansas:\n\n';
  raceData.forEach((demo) => {
    const combinedThreshold = demo.alice_percentage + demo.poverty_percent;
    response += `${demo.category}:\n`;
    response += `  ALICE households: ${demo.alice_percentage}% (${demo.alice_households.toLocaleString()})\n`;
    response += `  Households in poverty: ${demo.poverty_percent}%\n`;
    response += `  Total below ALICE threshold: ${combinedThreshold}%\n\n`;
  });
  response += 'Note: ALICE households are above poverty but below the cost of basic needs. The ALICE threshold includes both ALICE households and households in poverty.';
  return response;
}

const AGE_TREND_NOTE =
  'Note: "below the ALICE threshold" combines ALICE households (above poverty but below the cost of basic needs) and households in poverty.';

const ALL_AGE_GROUPS = ['Under 25', 'Age 25 to 44', 'Age 45 to 64', 'Age 65 and Over'];

// Identify which age group, if any, the user named.
function detectAgeGroup(text: string): string | undefined {
  const lower = text.toLowerCase();
  if (/\b(under 25|younger than 25|18 to 24|18-24|under age 25)\b/.test(lower)) return 'Under 25';
  if (/\b(25 to 44|25-44|25 44)\b/.test(lower)) return 'Age 25 to 44';
  if (/\b(45 to 64|45-64|45 64)\b/.test(lower)) return 'Age 45 to 64';
  if (/\b(65|over 65|65 and over|65\+|seniors?|elderly|retirement age)\b/.test(lower)) return 'Age 65 and Over';
  return undefined;
}

// Historical series of households below the ALICE threshold, per age group.
function formatAgeTrend(csvService: CsvDataService, names: string[]): string {
  const selected = names.length ? names : ALL_AGE_GROUPS;
  let response =
    'Here is how the number of households below the ALICE threshold (ALICE + poverty combined) has changed over time by age of head of household:\n\n';
  selected.forEach((group) => {
    const series = csvService.getAgeTrend(group);
    if (!series.length) return;
    response += `${group} (below ALICE threshold):\n`;
    series.forEach((point) => {
      response += `  ${point.year}: ${point.below_alice_threshold.toLocaleString()} households\n`;
    });
    const first = series[0];
    const last = series[series.length - 1];
    const delta = last.below_alice_threshold - first.below_alice_threshold;
    const direction = delta > 0 ? 'increase' : delta < 0 ? 'decrease' : 'no change';
    response += `  Net change ${first.year}–${last.year}: ${delta >= 0 ? '+' : ''}${delta.toLocaleString()} (${direction})\n\n`;
  });
  response += AGE_TREND_NOTE;
  return response;
}

// Below-threshold totals by age group for a single year.
function formatAgeThresholdYear(rows: AgeTrendData[], year: number): string {
  let response = `For ${year}, here are the households below the ALICE threshold (ALICE + poverty combined) in Arkansas by age of head of household:\n\n`;
  rows.forEach((row) => {
    response += `${row.age_group}: ${row.below_alice_threshold.toLocaleString()} households below the ALICE threshold\n`;
  });
  response += `\n${AGE_TREND_NOTE}`;
  return response;
}

function ageOtherYearsNote(shownYear: number, availableYears: number[]): string {
  const others = availableYears.filter((y) => y !== shownYear).sort((a, b) => b - a);
  if (others.length === 0) return '';
  return `\nI also have age-group ALICE data for ${others.join(', ')} — ask for a specific year for those figures.`;
}

const agePct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

// Full band breakdown (Above/ALICE/Poverty/total) for one age group.
function formatAgeBandSingle(
  rows: AgeBreakdownData[],
  ageGroup: string,
  year: number,
  isLatest: boolean,
  availableYears: number[]
): string {
  const row = rows.find((r) => r.age_group === ageGroup);
  if (!row) return `I don't have ${ageGroup} ALICE data for ${year} in my data set.`;

  const head = isLatest ? `latest available data, ${year}` : `${year}`;
  let response = `${ageGroup} households in Arkansas (${head}):\n\n`;
  response += `Total households: ${row.households.toLocaleString()}\n`;
  response += `Above ALICE threshold: ${agePct(row.above, row.households)}% (${row.above.toLocaleString()} households)\n`;
  response += `ALICE households: ${agePct(row.alice, row.households)}% (${row.alice.toLocaleString()} households)\n`;
  response += `Households in poverty: ${agePct(row.poverty, row.households)}% (${row.poverty.toLocaleString()} households)\n`;
  response += `Total below ALICE threshold: ${agePct(row.alice, row.households) + agePct(row.poverty, row.households)}%\n`;
  response += ageOtherYearsNote(year, availableYears);
  return response;
}

// Full band breakdown across all age groups.
function formatAgeBandAll(rows: AgeBreakdownData[], year: number, isLatest: boolean, availableYears: number[]): string {
  const head = isLatest ? `latest available data, ${year}` : `${year}`;
  let response = `Here are ALICE figures by age of head of household in Arkansas (${head}):\n\n`;
  rows.forEach((row) => {
    response += `${row.age_group}:\n`;
    response += `  Total households: ${row.households.toLocaleString()}\n`;
    response += `  ALICE households: ${agePct(row.alice, row.households)}% (${row.alice.toLocaleString()})\n`;
    response += `  Households in poverty: ${agePct(row.poverty, row.households)}% (${row.poverty.toLocaleString()})\n`;
    response += `  Total below ALICE threshold: ${agePct(row.alice, row.households) + agePct(row.poverty, row.households)}%\n\n`;
  });
  response += 'Note: ALICE households are above poverty but below the cost of basic needs; the ALICE threshold includes both ALICE and poverty households.';
  response += ageOtherYearsNote(year, availableYears);
  return response;
}

// Legacy age breakdown from demographics.csv (2023 percentages). Fallback when
// no newer age data (band/trend) is available.
function formatAgeFromDemographics(demographicData: DemographicData[]): string {
  const ageData = demographicData.filter((d) => d.category.startsWith('Age'));
  let response = 'According to my data set, here are ALICE rates by age group in Arkansas:\n\n';
  ageData.forEach((demo) => {
    const combinedThreshold = demo.alice_percentage + demo.poverty_percent;
    response += `${demo.category}:\n`;
    response += `  ALICE households: ${demo.alice_percentage}% (${demo.alice_households.toLocaleString()})\n`;
    response += `  Households in poverty: ${demo.poverty_percent}%\n`;
    response += `  Total below ALICE threshold: ${combinedThreshold}%\n\n`;
  });
  response += 'Note: ALICE households are above poverty but below the cost of basic needs.';
  return response;
}

// Year-/trend-aware age response. Defaults to the latest year's full band
// breakdown (age-types.csv); serves trends and prior years on request, and
// falls back to the legacy demographics breakdown when no newer data exists.
function buildAgeResponse(csvService: CsvDataService, text: string): string {
  const demographicData = typeof csvService.getAllDemographics === 'function' ? csvService.getAllDemographics() : [];

  const hasBand =
    typeof csvService.getAllAgeBreakdown === 'function' &&
    typeof csvService.getAgeBreakdown === 'function' &&
    typeof csvService.getAgeBreakdownYears === 'function';
  const hasTrends =
    typeof csvService.getAllAgeTrends === 'function' &&
    typeof csvService.getAgeTrend === 'function' &&
    typeof csvService.getAgeTrendYears === 'function';

  const named = detectAgeGroup(text);

  // "Over time" → historical below-threshold series.
  if (hasTrends && isTrendQuery(text)) {
    return formatAgeTrend(csvService, named ? [named] : []);
  }

  const bandYears = hasBand ? csvService.getAgeBreakdownYears() : [];
  const trendYears = hasTrends ? csvService.getAgeTrendYears() : [];
  const availableYears = [...new Set([...bandYears, ...trendYears])].sort((a, b) => a - b);

  // No newer age data → legacy demographics breakdown.
  if (availableYears.length === 0) {
    return formatAgeFromDemographics(demographicData);
  }

  const latestOverall = availableYears[availableYears.length - 1];
  const requested = detectRequestedYear(text);

  // Default (no specific year): prefer the latest full band, else legacy.
  if (requested === undefined) {
    if (hasBand && csvService.getAgeBreakdown(latestOverall).length > 0) {
      const rows = csvService.getAgeBreakdown(latestOverall);
      return named
        ? formatAgeBandSingle(rows, named, latestOverall, true, availableYears)
        : formatAgeBandAll(rows, latestOverall, true, availableYears);
    }
    return formatAgeFromDemographics(demographicData);
  }

  // Specific / previous year requested.
  let targetYear = latestOverall;
  if (typeof requested === 'number') {
    targetYear = requested;
  } else if (requested === 'previous') {
    const earlier = availableYears.filter((y) => y < latestOverall);
    targetYear = earlier.length ? earlier[earlier.length - 1] : latestOverall;
  }
  const isLatest = targetYear === latestOverall;

  if (hasBand && csvService.getAgeBreakdown(targetYear).length > 0) {
    const rows = csvService.getAgeBreakdown(targetYear);
    return named
      ? formatAgeBandSingle(rows, named, targetYear, isLatest, availableYears)
      : formatAgeBandAll(rows, targetYear, isLatest, availableYears);
  }
  if (trendYears.includes(targetYear)) {
    const rows = csvService.getAllAgeTrends().filter((r) => r.year === targetYear);
    if (named) {
      const row = rows.find((r) => r.age_group === named);
      if (row) {
        return `For ${targetYear}, there were ${row.below_alice_threshold.toLocaleString()} ${row.age_group} households below the ALICE threshold (ALICE + poverty combined) in Arkansas.\n\n${AGE_TREND_NOTE}`;
      }
    }
    return formatAgeThresholdYear(rows, targetYear);
  }
  return `I don't have age-group ALICE data for ${targetYear}. I have data for ${availableYears.join(', ')}.`;
}

// A cross-dimension ranking question ("which groups are most below the ALICE
// threshold?"). Fires only for generic group phrasing — if the user named a
// specific dimension (race/age/gender/county/etc.), that dimension handles it.
function isGroupRankingQuery(text: string): boolean {
  const t = text.toLowerCase();
  const rankWord = /\b(rank|ranked|ranking|most|highest|greatest|worst|hardest hit|most affected|which groups?|which demographic|compare)\b/.test(t);
  const groupWord = /\b(groups?|demographics?)\b/.test(t);
  if (!(rankWord && groupWord)) return false;
  const namedDimension = /\b(race|racial|ethnic|white|black|hispanic|latino|asian|native american|age|senior|elderly|under 25|gender|female|male|married|single parent|single-female|single-male|county|counties|occupation|employ|job|wage)\b/.test(t);
  return !namedDimension;
}

const GROUP_RANK_AGE_LABEL: Record<string, string> = {
  'Under 25': 'Under 25 Years',
  'Age 25 to 44': '25 to 44 Years',
  'Age 45 to 64': '45 to 64 Years',
  'Age 65 and Over': '65 Years and Over'
};

// Assemble the ranking rows from the latest household + age band data (computed,
// not stored) plus the no-children category from demographics.
function groupRankingRows(csvService: CsvDataService, demographicData: DemographicData[]): { label: string; pct: number; year: number }[] {
  const rows: { label: string; pct: number; year: number }[] = [];
  const belowPct = (r: { alice: number; poverty: number; households: number }) =>
    r.households > 0 ? Math.round(((r.alice + r.poverty) / r.households) * 100) : 0;

  if (typeof csvService.getLatestHouseholdTypeYear === 'function' && typeof csvService.getHouseholdTypes === 'function') {
    const y = csvService.getLatestHouseholdTypeYear();
    if (y !== undefined) {
      csvService.getHouseholdTypes(y).forEach((r) => rows.push({ label: `${r.name} (with children)`, pct: belowPct(r), year: y }));
    }
  }
  if (typeof csvService.getLatestAgeBreakdownYear === 'function' && typeof csvService.getAgeBreakdown === 'function') {
    const y = csvService.getLatestAgeBreakdownYear();
    if (y !== undefined) {
      csvService.getAgeBreakdown(y).forEach((r) => rows.push({ label: GROUP_RANK_AGE_LABEL[r.age_group] ?? r.age_group, pct: belowPct(r), year: y }));
    }
  }
  const noKids = demographicData.find((d) => /no Children/i.test(d.category));
  if (noKids) {
    rows.push({ label: 'Single or Cohabiting (no children)', pct: noKids.alice_percentage + noKids.poverty_percent, year: noKids.year });
  }
  return rows;
}

function buildGroupRanking(csvService: CsvDataService, demographicData: DemographicData[]): string {
  const rows = groupRankingRows(csvService, demographicData);
  if (rows.length === 0) {
    return "I don't have the group breakdown needed to rank below-threshold rates right now.";
  }
  rows.sort((a, b) => b.pct - a.pct);

  let response =
    'Here are Arkansas household groups ranked by the share of households below the ALICE threshold (ALICE + poverty combined), highest first:\n\n';
  rows.forEach((r, i) => {
    response += `${i + 1}. ${r.label}: ${r.pct}%\n`;
  });
  response +=
    '\nNote: "below the ALICE threshold" combines ALICE and poverty households, using each group\'s latest available year (2024 for household-type and age groups; 2023 for the no-children category).';
  return response;
}

// Year-/trend-aware race response. Defaults to the latest year's full band
// breakdown (race-types.csv); serves trends and prior years on request, and
// falls back to the legacy demographics breakdown when no newer data exists.
function buildRaceResponse(csvService: CsvDataService, text: string): string {
  const lowerText = text.toLowerCase();
  const demographicData = typeof csvService.getAllDemographics === 'function' ? csvService.getAllDemographics() : [];

  const hasBand =
    typeof csvService.getAllRaceBreakdown === 'function' &&
    typeof csvService.getRaceBreakdown === 'function' &&
    typeof csvService.getRaceBreakdownYears === 'function';
  const hasTrends =
    typeof csvService.getAllRaceTrends === 'function' &&
    typeof csvService.getRaceTrend === 'function' &&
    typeof csvService.getRaceTrendYears === 'function';

  const named = detectRace(text);

  // "Over time" → historical below-threshold series.
  if (hasTrends && isTrendQuery(text)) {
    return formatRaceTrend(csvService, named ? [named] : []);
  }

  const bandYears = hasBand ? csvService.getRaceBreakdownYears() : [];
  const trendYears = hasTrends ? csvService.getRaceTrendYears() : [];
  const availableYears = [...new Set([...bandYears, ...trendYears])].sort((a, b) => a - b);

  // No newer race data → legacy demographics breakdown.
  if (availableYears.length === 0) {
    return formatRaceFromDemographics(demographicData, lowerText);
  }

  const latestOverall = availableYears[availableYears.length - 1];
  const requested = detectRequestedYear(text);

  // Default (no specific year): prefer the latest full band, else legacy.
  if (requested === undefined) {
    if (hasBand && csvService.getRaceBreakdown(latestOverall).length > 0) {
      const rows = csvService.getRaceBreakdown(latestOverall);
      return named
        ? formatRaceBandSingle(rows, named, latestOverall, true, availableYears)
        : formatRaceBandAll(rows, latestOverall, true, availableYears);
    }
    return formatRaceFromDemographics(demographicData, lowerText);
  }

  // Specific / previous year requested.
  let targetYear = latestOverall;
  if (typeof requested === 'number') {
    targetYear = requested;
  } else if (requested === 'previous') {
    const earlier = availableYears.filter((y) => y < latestOverall);
    targetYear = earlier.length ? earlier[earlier.length - 1] : latestOverall;
  }
  const isLatest = targetYear === latestOverall;

  if (hasBand && csvService.getRaceBreakdown(targetYear).length > 0) {
    const rows = csvService.getRaceBreakdown(targetYear);
    return named
      ? formatRaceBandSingle(rows, named, targetYear, isLatest, availableYears)
      : formatRaceBandAll(rows, targetYear, isLatest, availableYears);
  }
  if (trendYears.includes(targetYear)) {
    const rows = csvService.getAllRaceTrends().filter((r) => r.year === targetYear);
    if (named) {
      const row = rows.find((r) => r.race === named);
      if (row) {
        return `For ${targetYear}, there were ${row.below_alice_threshold.toLocaleString()} ${row.race} households below the ALICE threshold (ALICE + poverty combined) in Arkansas.\n\n${RACE_TREND_NOTE}`;
      }
    }
    return formatRaceThresholdYear(rows, targetYear);
  }
  return `I don't have race/ethnicity ALICE data for ${targetYear}. I have data for ${availableYears.join(', ')}.`;
}

const GENDER_HOUSEHOLD_INTRO =
  'The only gender-related ALICE data I have for Arkansas is the Married, Single-Female-Headed, and Single-Male-Headed household breakdown for families with children.';
// Same data, framed for household/parent/family questions instead of gender ones.
const FAMILY_HOUSEHOLD_INTRO =
  'My ALICE data for Arkansas families with children covers three household types: Married, Single-Female-Headed, and Single-Male-Headed.';
const GENDER_HOUSEHOLD_FOOTER =
  'Note: These figures describe household structure among families with children. Our dataset does not include a full statewide gender breakdown for all ALICE households.';

function formatOtherYearsNote(shownYear: number, availableYears: number[]): string {
  const others = availableYears.filter((y) => y !== shownYear).sort((a, b) => b - a);
  if (others.length === 0) return '';
  return `I also have this breakdown for ${others.join(', ')} — just ask for a specific year if you'd like those figures.\n\n`;
}

// Latest-year breakdown, sourced from household-types.csv (absolute counts).
function formatHouseholdTypeYear(
  rows: HouseholdTypeData[],
  year: number,
  isLatest: boolean,
  availableYears: number[],
  intro: string = GENDER_HOUSEHOLD_INTRO
): string {
  const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

  let response = `${intro}\n\n`;
  response += isLatest
    ? `Here is that breakdown using my latest available data (${year}):\n\n`
    : `Here is that breakdown for ${year}:\n\n`;

  rows.forEach((row) => {
    const alicePct = pct(row.alice, row.households);
    const povertyPct = pct(row.poverty, row.households);
    const abovePct = pct(row.above, row.households);
    response += `${row.name}:\n`;
    response += `  Total households: ${row.households.toLocaleString()}\n`;
    response += `  Above ALICE threshold: ${abovePct}% (${row.above.toLocaleString()} households)\n`;
    response += `  ALICE households: ${alicePct}% (${row.alice.toLocaleString()} households)\n`;
    response += `  Households in poverty: ${povertyPct}% (${row.poverty.toLocaleString()} households)\n`;
    response += `  Total below ALICE threshold: ${alicePct + povertyPct}%\n\n`;
  });

  response += formatOtherYearsNote(year, availableYears);
  response += GENDER_HOUSEHOLD_FOOTER;
  return response;
}

// Prior-year breakdown, sourced from demographics.csv (percentages + ALICE count).
function formatHouseholdDemographicYear(
  rows: DemographicData[],
  year: number,
  isLatest: boolean,
  availableYears: number[],
  intro: string = GENDER_HOUSEHOLD_INTRO
): string {
  let response = `${intro}\n\n`;
  response += isLatest
    ? `Here is that breakdown using my latest available data (${year}):\n\n`
    : `Here is that breakdown for ${year}:\n\n`;

  rows.forEach((demo) => {
    const combinedThreshold = demo.alice_percentage + demo.poverty_percent;
    response += `${normalizeCategory(demo.category)}:\n`;
    response += `  Total households: ${demo.total_households.toLocaleString()}\n`;
    response += `  ALICE households: ${demo.alice_percentage}% (${demo.alice_households.toLocaleString()} households)\n`;
    response += `  Households in poverty: ${demo.poverty_percent}%\n`;
    response += `  Total below ALICE threshold: ${combinedThreshold}%\n\n`;
  });

  response += formatOtherYearsNote(year, availableYears);
  response += GENDER_HOUSEHOLD_FOOTER;
  return response;
}

// Historical series of households below the ALICE threshold, per household type.
function formatHouseholdTrend(csvService: CsvDataService, names: string[], intro: string = GENDER_HOUSEHOLD_INTRO): string {
  const allTypes = ['Married', 'Single-Female-Headed', 'Single-Male-Headed'];
  const selected = names.length ? names : allTypes;

  let response = `${intro}\n\n`;
  response +=
    'Here is how the number of households below the ALICE threshold (ALICE + poverty combined) has changed over time:\n\n';

  selected.forEach((name) => {
    const series = csvService.getHouseholdTypeTrend(name);
    if (!series.length) return;
    response += `${name} (below ALICE threshold):\n`;
    series.forEach((point) => {
      response += `  ${point.year}: ${point.below_alice_threshold.toLocaleString()} households\n`;
    });
    const first = series[0];
    const last = series[series.length - 1];
    const delta = last.below_alice_threshold - first.below_alice_threshold;
    const direction = delta > 0 ? 'increase' : delta < 0 ? 'decrease' : 'no change';
    response += `  Net change ${first.year}–${last.year}: ${delta >= 0 ? '+' : ''}${delta.toLocaleString()} (${direction})\n\n`;
  });

  response += GENDER_HOUSEHOLD_FOOTER;
  return response;
}

// Below-threshold totals for a single historical year (when we lack the full
// Above/ALICE/Poverty split for that year).
function formatHouseholdThresholdYear(
  rows: HouseholdTypeTrendData[],
  year: number,
  bandYears: number[],
  intro: string = GENDER_HOUSEHOLD_INTRO
): string {
  let response = `${intro}\n\n`;
  response += `For ${year}, here are the households below the ALICE threshold (ALICE + poverty combined) by household type:\n\n`;
  rows.forEach((row) => {
    response += `${row.name}: ${row.below_alice_threshold.toLocaleString()} households below the ALICE threshold\n`;
  });
  if (bandYears.length) {
    response += `\nNote: For ${year} I only have the combined below-threshold total, not the full Above/ALICE/Poverty split. I have that detailed split for ${bandYears.join(', ')}.\n\n`;
  } else {
    response += '\n';
  }
  response += GENDER_HOUSEHOLD_FOOTER;
  return response;
}

// Year-aware gender/household-breakdown response. Defaults to the latest year
// available, names the year, and only serves an earlier year when the user
// explicitly asks for one.
function buildGenderHouseholdResponse(csvService: CsvDataService, text: string): string {
  const intro = isGenderRelatedQuery(text) ? GENDER_HOUSEHOLD_INTRO : FAMILY_HOUSEHOLD_INTRO;
  const demographicData = csvService.getAllDemographics();
  const hasHouseholdTypes =
    typeof csvService.getAllHouseholdTypes === 'function' &&
    typeof csvService.getLatestHouseholdTypeYear === 'function' &&
    typeof csvService.getHouseholdTypes === 'function' &&
    typeof csvService.getHouseholdTypeYears === 'function';
  const hasTrends =
    typeof csvService.getAllHouseholdTypeTrends === 'function' &&
    typeof csvService.getHouseholdTypeTrend === 'function' &&
    typeof csvService.getHouseholdTypeTrendYears === 'function';

  // "How has this changed over time" → historical below-threshold series.
  if (hasTrends && isTrendQuery(text) && csvService.getAllHouseholdTypeTrends().length > 0) {
    const named = detectHouseholdType(text);
    return formatHouseholdTrend(csvService, named ? [named] : [], intro);
  }

  const householdTypeRows = hasHouseholdTypes ? csvService.getAllHouseholdTypes() : [];

  // Prior-year (2023-style) breakdown still lives in demographics.csv.
  const demoRows = getGenderRelatedHouseholdData(demographicData);
  const demoYear = demoRows.length ? demoRows[0].year : undefined;

  // Years for which we have the FULL Above/ALICE/Poverty split.
  const bandYears = [...new Set([
    ...(hasHouseholdTypes ? csvService.getHouseholdTypeYears() : []),
    ...(demoYear !== undefined ? [demoYear] : []),
  ])].sort((a, b) => a - b);

  // Years for which we have at least the below-threshold total.
  const trendYears = hasTrends ? csvService.getHouseholdTypeTrendYears() : [];
  const allYears = [...new Set([...bandYears, ...trendYears])].sort((a, b) => a - b);

  if (allYears.length === 0) {
    return `${intro}\n\nI don't have that breakdown available right now.`;
  }

  const latestOverall = allYears[allYears.length - 1];

  const requested = detectRequestedYear(text);
  let targetYear = latestOverall;
  if (typeof requested === 'number') {
    targetYear = requested;
  } else if (requested === 'previous') {
    const earlier = allYears.filter((y) => y < latestOverall);
    targetYear = earlier.length ? earlier[earlier.length - 1] : latestOverall;
  }

  const isLatest = targetYear === latestOverall;

  // Prefer the full band breakdown when we have it for the target year.
  if (hasHouseholdTypes) {
    const bandRows = csvService.getHouseholdTypes(targetYear);
    if (bandRows.length > 0) {
      return formatHouseholdTypeYear(bandRows, targetYear, isLatest, bandYears, intro);
    }
  }
  if (demoYear === targetYear && demoRows.length > 0) {
    return formatHouseholdDemographicYear(demoRows, targetYear, isLatest, bandYears, intro);
  }

  // No full split for that year, but we may have the below-threshold total.
  if (trendYears.includes(targetYear)) {
    const rows = csvService.getAllHouseholdTypeTrends().filter((r) => r.year === targetYear);
    return formatHouseholdThresholdYear(rows, targetYear, bandYears, intro);
  }

  // A year we simply don't have — default back to the latest and say so.
  let response = `I don't have the gender/household breakdown for ${targetYear}. `;
  response += `I have data for ${allYears.join(', ')}. Here is my latest (${latestOverall}):\n\n`;
  if (hasHouseholdTypes && csvService.getHouseholdTypes(latestOverall).length > 0) {
    response += formatHouseholdTypeYear(csvService.getHouseholdTypes(latestOverall), latestOverall, true, bandYears, intro);
  } else if (trendYears.includes(latestOverall)) {
    response += formatHouseholdThresholdYear(
      csvService.getAllHouseholdTypeTrends().filter((r) => r.year === latestOverall),
      latestOverall,
      bandYears,
      intro
    );
  } else if (demoYear !== undefined) {
    response += formatHouseholdDemographicYear(demoRows, demoYear, demoYear === latestOverall, bandYears, intro);
  }
  return response;
}

// ---- County-level demographic breakdowns (county-demographics.csv) ----

// Counties that can be named in a demographic question. Bare "arkansas" is the
// state, and this matcher requires a location cue anyway.
const DEMO_COUNTY_LIST = AR_COUNTY_NAMES.filter((c) => c !== 'arkansas');

// Matches a county *mention*: "in/for/within <county>" or "<county> County".
// The negative lookahead keeps "for White households" (the race) from reading
// as White County, while "White County" itself still matches.
function countyMentionRegex(county: string): RegExp {
  const escaped = county.replace(/\./g, '\\.');
  const demoNoun = '(?:households?|individuals?|people|persons?|families|family|residents?)';
  return new RegExp(
    `\\b(?:in|for|within)\\s+${escaped}\\b(?!\\s+${demoNoun})|\\b${escaped}\\s+count(?:y|ies)\\b`,
    'gi'
  );
}

// Remove county mentions so a county name can't be mistaken for a demographic
// term. "The ALICE rate in White County" carries no demographic intent once
// the place name is gone, and belongs to the county action instead.
function stripCountyMentions(text: string): string {
  return DEMO_COUNTY_LIST.reduce(
    (stripped, county) => stripped.replace(countyMentionRegex(county), ' '),
    text
  );
}

// Statewide race labels → county-data category labels (identical otherwise).
const COUNTY_RACE_LABEL: Record<string, string> = {
  'Hispanic/Latino': 'Hispanic',
};

// detectHouseholdType() names → county-data category labels.
const COUNTY_HOUSEHOLD_LABEL: Record<string, string> = {
  'Married': 'Married With Children',
  'Single-Female-Headed': 'Single-Female-Headed With Children',
  'Single-Male-Headed': 'Single-Male-Headed With Children',
};

const COUNTY_HH_WITH_CHILDREN = [
  'Married With Children',
  'Single-Female-Headed With Children',
  'Single-Male-Headed With Children',
];
const COUNTY_HH_NO_CHILDREN = 'Single or Cohabiting, Under 65, no Children';

const cPct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

// Some county cells rest on a handful of households — a 1-household group would
// otherwise render as a confident "100% ALICE". Flag those rather than dressing
// them up as reliable rates.
const SMALL_BASE = 100;
const isSmallBase = (row: CountyDemographicData) => row.households > 0 && row.households < SMALL_BASE;
const smallTag = (row: CountyDemographicData) => (isSmallBase(row) ? ' (small sample)' : '');
const SMALL_BASE_NOTE =
  'Note: Groups marked "(small sample)" cover fewer than 100 households in this county, so those percentages rest on a very small base — read them as rough indicators, not reliable rates.';

function smallBaseCaveat(row: CountyDemographicData, county: string): string {
  if (!isSmallBase(row)) return '';
  const plural = row.households === 1 ? 'household' : 'households';
  return `\nNote: This covers just ${row.households.toLocaleString()} ${plural} in ${county}, so the percentages rest on a very small base — treat them as a rough indicator rather than a reliable rate.\n`;
}

// A group with no households recorded in this county has no rate to report.
function noHouseholdsResponse(label: string, county: string, year: number): string {
  return (
    `My data set records no ${label} households in ${county} for ${year}, so there's no ALICE breakdown for that group there.\n\n` +
    `I can give you the statewide ${label} figures instead — just ask about Arkansas as a whole.`
  );
}

// Small county cells make counts of 1 common, so pluralize.
const hh = (n: number) => `${n.toLocaleString()} household${n === 1 ? '' : 's'}`;

function formatCountyBandRow(row: CountyDemographicData, indent = ''): string {
  const alicePct = cPct(row.alice, row.households);
  const povertyPct = cPct(row.poverty, row.households);
  let out = '';
  out += `${indent}Total households: ${row.households.toLocaleString()}\n`;
  out += `${indent}Above ALICE threshold: ${cPct(row.above, row.households)}% (${hh(row.above)})\n`;
  out += `${indent}ALICE households: ${alicePct}% (${hh(row.alice)})\n`;
  out += `${indent}Households in poverty: ${povertyPct}% (${hh(row.poverty)})\n`;
  out += `${indent}Total below ALICE threshold: ${alicePct + povertyPct}%\n`;
  return out;
}

function countyGenderFooter(county: string): string {
  return `Note: These figures describe household structure among families with children in ${county}. Our dataset does not include a full gender breakdown for all ALICE households.`;
}

// Household-type breakdown for one county. Gender questions get the same
// treatment as the statewide gender queries: the with-children types plus the
// standard intro/footer, adapted to the county.
function formatCountyHousehold(
  rows: CountyDemographicData[],
  county: string,
  year: number,
  isGenderQuery: boolean,
  namedType: string | undefined
): string {
  const hh = rows.filter((r) => r.group === 'HouseholdType');
  const byCategory = (cat: string) => hh.find((r) => r.category === cat);

  if (namedType) {
    const row = byCategory(COUNTY_HOUSEHOLD_LABEL[namedType] ?? namedType);
    if (row) {
      if (row.households === 0) return noHouseholdsResponse(row.category, county, year);
      let response = '';
      if (isGenderQuery) {
        response += `The only gender-related ALICE data I have for ${county} is the household breakdown for families with children.\n\n`;
      }
      response += `${row.category} households in ${county} (latest available data, ${year}):\n\n`;
      response += formatCountyBandRow(row);
      response += smallBaseCaveat(row, county);
      response += `\n${countyGenderFooter(county)}`;
      return response;
    }
  }

  const selected = (isGenderQuery
    ? COUNTY_HH_WITH_CHILDREN
    : [...COUNTY_HH_WITH_CHILDREN, COUNTY_HH_NO_CHILDREN]
  )
    .map(byCategory)
    .filter((r): r is CountyDemographicData => Boolean(r));

  const intro = isGenderQuery
    ? `The only gender-related ALICE data I have for ${county} is the Married, Single-Female-Headed, and Single-Male-Headed household breakdown for families with children.`
    : `My ALICE household-type data for ${county} covers families with children (Married, Single-Female-Headed, and Single-Male-Headed) plus single or cohabiting households under 65 without children.`;

  let response = `${intro}\n\n`;
  response += `Here is that breakdown using my latest available data (${year}):\n\n`;
  selected.forEach((row) => {
    response += `${row.category}${smallTag(row)}:\n${formatCountyBandRow(row, '  ')}\n`;
  });
  if (selected.some(isSmallBase)) {
    response += `${SMALL_BASE_NOTE}\n\n`;
  }
  response += isGenderQuery
    ? countyGenderFooter(county)
    : `Note: Households headed by someone 65 or over aren't broken out by household type in this dataset — ask about "households age 65 and over in ${county}" for that age band.`;
  return response;
}

// Shared list body for the race and age county breakdowns: skips groups with no
// households recorded (a 0-household group has no rate to report) and flags the
// ones resting on a tiny base.
function formatCountyGroupList(rows: CountyDemographicData[], noun: string): string {
  const listed = rows.filter((row) => row.households > 0);
  const empty = rows.filter((row) => row.households === 0);

  let response = '';
  listed.forEach((row) => {
    const alicePct = cPct(row.alice, row.households);
    const povertyPct = cPct(row.poverty, row.households);
    response += `${row.category}${smallTag(row)}:\n`;
    response += `  Total households: ${row.households.toLocaleString()}\n`;
    response += `  ALICE households: ${alicePct}% (${row.alice.toLocaleString()})\n`;
    response += `  Households in poverty: ${povertyPct}% (${row.poverty.toLocaleString()})\n`;
    response += `  Total below ALICE threshold: ${alicePct + povertyPct}%\n\n`;
  });
  if (empty.length) {
    response += `Not listed: my data set records no households in this county for ${empty.map((r) => r.category).join(', ')}.\n\n`;
  }
  if (listed.some(isSmallBase)) {
    response += `${SMALL_BASE_NOTE}\n\n`;
  }
  response += `Note: ALICE ${noun} are above poverty but below the cost of basic needs; the ALICE threshold includes both ALICE and poverty households.`;
  return response;
}

// Race/ethnicity breakdown for one county (single race or all).
function formatCountyRace(
  rows: CountyDemographicData[],
  county: string,
  year: number,
  namedRace: string | undefined
): string {
  const races = rows.filter((r) => r.group === 'Race');
  if (namedRace) {
    const row = races.find((r) => r.category === (COUNTY_RACE_LABEL[namedRace] ?? namedRace));
    if (row) {
      if (row.households === 0) return noHouseholdsResponse(row.category, county, year);
      let response = `${row.category} households in ${county} (latest available data, ${year}):\n\n`;
      response += formatCountyBandRow(row);
      response += smallBaseCaveat(row, county);
      response += `\nI also have statewide race/ethnicity breakdowns and trends — ask about Arkansas as a whole for those.`;
      return response;
    }
  }
  let response = `Here are ALICE figures by race/ethnicity in ${county} (latest available data, ${year}):\n\n`;
  response += formatCountyGroupList(races, 'households');
  return response;
}

// Age breakdown for one county (single band or all).
function formatCountyAge(
  rows: CountyDemographicData[],
  county: string,
  year: number,
  namedAge: string | undefined
): string {
  const ages = rows.filter((r) => r.group === 'Age');
  if (namedAge) {
    const row = ages.find((r) => r.category === (GROUP_RANK_AGE_LABEL[namedAge] ?? namedAge));
    if (row) {
      if (row.households === 0) return noHouseholdsResponse(`${row.category.toLowerCase()}`, county, year);
      let response = `Households headed by someone ${row.category.toLowerCase()} in ${county} (latest available data, ${year}):\n\n`;
      response += formatCountyBandRow(row);
      response += smallBaseCaveat(row, county);
      return response;
    }
  }
  let response = `Here are ALICE figures by age of head of household in ${county} (latest available data, ${year}):\n\n`;
  response += formatCountyGroupList(ages, 'households');
  return response;
}

// Compact all-dimension overview for "demographics in X County" questions.
function formatCountyDemographicOverview(rows: CountyDemographicData[], county: string, year: number): string {
  let response = `Demographic breakdown for ${county} (latest available data, ${year}):\n\n`;
  const total = rows.find((r) => r.group === 'Total');
  if (total) {
    const alicePct = cPct(total.alice, total.households);
    const povertyPct = cPct(total.poverty, total.households);
    response += `All households: ${total.households.toLocaleString()} total — ${alicePct}% ALICE (${total.alice.toLocaleString()}), ${povertyPct}% in poverty (${total.poverty.toLocaleString()}), ${alicePct + povertyPct}% below the ALICE threshold.\n\n`;
  }

  let anySmall = false;
  const section = (title: string, group: CountyDemographicData['group']) => {
    const groupRows = rows.filter((r) => r.group === group && r.households > 0);
    if (!groupRows.length) return;
    response += `${title} (share below the ALICE threshold):\n`;
    groupRows.forEach((row) => {
      const belowPct = cPct(row.alice, row.households) + cPct(row.poverty, row.households);
      anySmall = anySmall || isSmallBase(row);
      response += `- ${row.category}${smallTag(row)}: ${belowPct}% (${(row.alice + row.poverty).toLocaleString()} of ${hh(row.households)})\n`;
    });
    response += '\n';
  };
  section('By age of head of household', 'Age');
  section('By household type', 'HouseholdType');
  section('By race/ethnicity', 'Race');

  if (anySmall) {
    response += `${SMALL_BASE_NOTE}\n\n`;
  }
  response += `Ask about any group by name (e.g. "Hispanic households in ${county}" or "single mothers in ${county}") for the full breakdown.`;
  return response;
}

// County-aware demographic router. `text` arrives with the county mention
// already stripped so a county name (e.g. White County) can't be misread as a
// demographic term (the White race band).
function buildCountyDemographicResponse(
  csvService: CsvDataService,
  prettyCounty: string,
  text: string
): string {
  const rows = csvService.getCountyDemographics(prettyCounty);
  const year = rows[0].year;
  const lower = text.toLowerCase();

  // County demographics exist for a single year; trends and other years stay
  // statewide-only.
  let prefix = '';
  const requested = detectRequestedYear(text);
  if (isTrendQuery(text)) {
    prefix = `My county-level demographic breakdowns cover ${year} only, so I can't show a trend for ${prettyCounty} — statewide demographic trends are available if you ask about Arkansas as a whole. Here is the ${year} picture:\n\n`;
  } else if (typeof requested === 'number' && requested !== year) {
    prefix = `I only have county-level demographic breakdowns for ${year}, not ${requested}. Here is ${year}:\n\n`;
  } else if (requested === 'previous') {
    prefix = `I only have county-level demographic breakdowns for ${year}. Here it is:\n\n`;
  }

  const isGenderQuery = isGenderRelatedQuery(text);
  const namedHousehold = detectHouseholdType(text);
  const isHouseholdTopic =
    isGenderQuery || namedHousehold !== undefined || /\b(household|parents?|family|families)\b/.test(lower);
  const namedRace = detectRace(text);
  const isRaceQuery = namedRace !== undefined || /\b(race|racial|ethnicity|ethnic)\b/.test(lower);
  const namedAge = detectAgeGroup(text);
  const isAgeQuery = namedAge !== undefined || /\bage\b/.test(lower);

  if (isGenderQuery || (isHouseholdTopic && !isRaceQuery && !isAgeQuery)) {
    return prefix + formatCountyHousehold(rows, prettyCounty, year, isGenderQuery, namedHousehold);
  }
  if (isRaceQuery && !isAgeQuery) {
    return prefix + formatCountyRace(rows, prettyCounty, year, namedRace);
  }
  if (isAgeQuery && !isRaceQuery) {
    return prefix + formatCountyAge(rows, prettyCounty, year, namedAge);
  }
  return prefix + formatCountyDemographicOverview(rows, prettyCounty, year);
}

export const searchDemographicsAction: Action = {
  name: 'Searching demographic data...',
  similes: [
    'demographics',
    'demographic breakdown',
    'by race',
    'by ethnicity',
    'by age',
    'white',
    'black',
    'hispanic',
    'latino',
    'asian',
    'native american',
    'age groups',
    'single parent',
    'two parent',
    'household type',
    'gender',
    'female',
    'male',
    'women',
    'men'
  ],
  description: 'Search Arkansas demographic data by race, ethnicity, age, and household type',
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    // Normalize hyphens so "single-parent"/"two-parent" match "single parent"/"two parent".
    const text = (message.content.text?.toLowerCase() || '').replace(/[-–—]/g, ' ');
    console.error('\n*** DEMOGRAPHICS ACTION VALIDATION ***');
    console.error('*** Input text:', text);
    
    // EXCLUDE county ranking queries (e.g., "What county has the highest percentage of ALICE households?")
    const isCountyRanking = text.includes('county') && (
      text.includes('highest') || text.includes('lowest') || 
      text.includes('most') || text.includes('fewest') || text.includes('least') ||
      text.includes('rank') || text.includes('top') || text.includes('bottom')
    );
    
    if (isCountyRanking) {
      console.error('*** EXCLUDED - county ranking query, not demographics');
      console.error('*** END DEMOGRAPHICS VALIDATION ***\n');
      return false;
    }
    
    // Judge demographic intent on the text with county mentions removed: the
    // "White" in "White County" is a place, and "the ALICE rate in White
    // County" is a plain county question that belongs to the county action.
    const demoText = stripCountyMentions(text);

    // Check for demographic keywords
    // Word-boundary matching: plain substring checks misfire badly here
    // ("wAGE"/"averAGE" contain "age", "gRACE" contains "race").
    const demographicKeywords = [
      'demographics?', 'race', 'ethnicity', 'ethnic', 'age', 'household types?'
    ];

    const hasDemographicKeyword = demographicKeywords.some(keyword =>
      new RegExp(`\\b${keyword}\\b`).test(demoText)
    );

    // Check for specific demographic categories. detectRace covers the full
    // canonical list (Pacific Islander, American Indian, ...) so the two can't
    // drift apart.
    const categoryKeywords = [
      'biracial', 'multiracial', 'two or more races', 'mixed race',
      'single parent', 'two parent', 'single adult', 'age 18', 'age 25',
      'age 35', 'age 45', 'age 55', 'age 65',
      'single mother', 'single mom', 'single father', 'single dad',
      'senior', 'elderly'
    ];

    const hasCategoryKeyword =
      categoryKeywords.some(keyword => demoText.includes(keyword)) ||
      detectRace(demoText) !== undefined;

    const hasGenderKeyword = isGenderRelatedQuery(demoText);

    // Check for ALICE rate queries about demographics
    const hasAliceDemographicQuery = demoText.includes('alice') &&
      (demoText.includes('rate') || demoText.includes('percentage') || demoText.includes('breakdown')) &&
      (hasDemographicKeyword || hasCategoryKeyword || hasGenderKeyword);

    const result = hasDemographicKeyword || hasCategoryKeyword || hasGenderKeyword || hasAliceDemographicQuery || isGroupRankingQuery(demoText);
    console.error('*** Demographic keyword:', hasDemographicKeyword);
    console.error('*** Category keyword:', hasCategoryKeyword);
    console.error('*** Gender keyword:', hasGenderKeyword);
    console.error('*** ALICE demographic query:', hasAliceDemographicQuery);
    console.error('*** VALIDATION RESULT:', result ? 'WILL TRIGGER' : 'WILL NOT TRIGGER');
    console.error('*** END DEMOGRAPHICS VALIDATION ***\n');
    return result;
  },
  
  handler: async (runtime: IAgentRuntime, message: Memory, state: State, options: any, callback?: any): Promise<any> => {
    try {
      console.error('*** DEMOGRAPHICS ACTION HANDLER TRIGGERED ***');
      
      // Response deduplication - prevent processing the same message twice
      const messageId = message.id || message.content?.messageId || message.content?.text;
      console.error('*** Checking message ID for deduplication:', messageId);
      
      if ((global as any).processedMessages?.has(messageId)) {
        console.error('*** Message already processed, skipping to prevent duplicate response ***');
        return true;
      }
      
      // Initialize processed messages set if it doesn't exist
      if (!(global as any).processedMessages) {
        (global as any).processedMessages = new Set();
        console.error('*** Initialized processedMessages set ***');
      }
      
      // Mark this message as being processed
      (global as any).processedMessages.add(messageId);
      console.error('*** Marked message as processed:', messageId);
      
      const csvService = (runtime as any).csvDataService as CsvDataService;
      const text = message.content.text || '';
      
      if (!csvService) {
        const errorResult = "I cannot access my demographic data systems right now. Please try again later.";
        if (callback) callback(errorResult);
        return errorResult;
      }
      
      // Get all demographic data
      const demographicData = csvService.getAllDemographics();
      
      if (!demographicData || demographicData.length === 0) {
        const errorResult = "I don't have demographic data available right now.";
        if (callback) callback(errorResult);
        return errorResult;
      }

      // If the user named a specific county, serve the county-level
      // demographic breakdown (county-demographics.csv).
      const lowerForCounty = text.toLowerCase().replace(/[-–—]/g, ' ');
      const prettify = (c: string) => c.replace(/\b\w/g, ch => ch.toUpperCase()) + ' County';
      const namedCounties = DEMO_COUNTY_LIST.filter(c => countyMentionRegex(c).test(lowerForCounty));
      const namedCounty = namedCounties[0];
      if (namedCounty) {
        const prettyCounty = prettify(namedCounty);
        const countyRows = typeof csvService.getCountyDemographics === 'function'
          ? csvService.getCountyDemographics(prettyCounty)
          : [];
        let note: string;
        if (countyRows.length > 0) {
          // Strip the county mention so the county name can't be misread as a
          // demographic term (e.g. White County vs the White race band).
          const strippedText = lowerForCounty.replace(countyMentionRegex(namedCounty), ' ');
          note = buildCountyDemographicResponse(csvService, prettyCounty, strippedText);
          if (namedCounties.length > 1) {
            note += `\n\nI can only show one county's demographics at a time — ask again with ${namedCounties.slice(1).map(prettify).join(', ')} for the same breakdown there.`;
          }
        } else {
          note =
            `I don't have demographic figures specific to ${prettyCounty}.\n\n` +
            `I can help two ways:\n` +
            `- The statewide demographic breakdown (e.g. "ALICE rates by race in Arkansas")\n` +
            `- Overall ALICE figures for ${prettyCounty} (e.g. "ALICE data for ${prettyCounty}")`;
        }
        const noteResult = { text: note, success: true, action: 'DEMOGRAPHICS_DATA_RETRIEVED' };
        if (callback) { callback(noteResult); return true; }
        return noteResult;
      }

      let response = "";
      
      // Check if asking for specific demographic breakdown
      const lowerText = text.toLowerCase();
      const isGenderQuery = isGenderRelatedQuery(text);
      
      // Check if asking about specific race/ethnicity. detectRace carries the
      // full canonical list, so "Pacific Islander households" reads as a race
      // question rather than a household-type one.
      const raceKeywords = ['race', 'ethnic'];
      const isRaceQuery =
        raceKeywords.some(keyword => lowerText.includes(keyword)) || detectRace(text) !== undefined;

      // Household-type topic (married / single-headed families). The year- and
      // trend-aware path handles these; a household-type *trend* question routes
      // here even without explicit gender wording.
      const isHouseholdTopic =
        isGenderQuery ||
        lowerText.includes('household') ||
        lowerText.includes('parent') ||
        lowerText.includes('family') ||
        lowerText.includes('families') ||
        detectHouseholdType(text) !== undefined;
      // The year/trend-aware path owns the three core household types. Route a
      // household-topic question there whenever it asks about a trend or a
      // specific/previous year so it can pull from the newer multi-year data.
      const wantsHouseholdYearAware =
        isHouseholdTopic && !isRaceQuery && (isTrendQuery(text) || detectRequestedYear(text) !== undefined);

      if (isGroupRankingQuery(text)) {
        response = buildGroupRanking(csvService, demographicData);
      } else if (
        isGenderQuery ||
        wantsHouseholdYearAware ||
        // Household/parent/family questions go to the year-aware path backed
        // by household-types.csv — never the stale demographics.csv table.
        // Age-flavored questions ("households by age") still belong to the
        // age breakdown below.
        (isHouseholdTopic && !isRaceQuery && !/\bage\b/.test(lowerText))
      ) {
        response = buildGenderHouseholdResponse(csvService, text);
      } else if (isRaceQuery) {
        response = buildRaceResponse(csvService, text);
      } else if (text.includes('age') || detectAgeGroup(text) !== undefined) {
        response = buildAgeResponse(csvService, text);

      } else if (
        typeof csvService.getLatestAgeBreakdownYear === 'function' &&
        typeof csvService.getLatestHouseholdTypeYear === 'function' &&
        typeof csvService.getLatestRaceBreakdownYear === 'function' &&
        (csvService.getLatestAgeBreakdownYear() !== undefined ||
          csvService.getLatestHouseholdTypeYear() !== undefined ||
          csvService.getLatestRaceBreakdownYear() !== undefined)
      ) {
        // General demographic overview — built from the latest-year datasets
        // (age, household type, race), never the stale demographics.csv table.
        const snapshot = typeof csvService.getLatestStatewideSnapshot === 'function'
          ? csvService.getLatestStatewideSnapshot()
          : undefined;
        const ageYear = csvService.getLatestAgeBreakdownYear();
        const hhYear = csvService.getLatestHouseholdTypeYear();
        const raceYear = csvService.getLatestRaceBreakdownYear();
        const yearLabel = [...new Set(
          [snapshot?.year, ageYear, hhYear, raceYear].filter((y): y is number => y !== undefined)
        )].sort((a, b) => a - b).join('/');
        const belowPct = (r: { alice: number; poverty: number; households: number }) =>
          cPct(r.alice, r.households) + cPct(r.poverty, r.households);

        response = `Here is the statewide demographic picture for Arkansas (latest available data, ${yearLabel}):\n\n`;
        if (snapshot) {
          response += `All households: ${snapshot.households.toLocaleString()} total — ${snapshot.alicePct}% ALICE (${snapshot.alice.toLocaleString()}), ${snapshot.povertyPct}% in poverty (${snapshot.poverty.toLocaleString()}), ${snapshot.belowPct}% below the ALICE threshold.\n\n`;
        }
        if (ageYear !== undefined) {
          response += 'By age of head of household (share below the ALICE threshold):\n';
          csvService.getAgeBreakdown(ageYear).forEach((r) => {
            response += `- ${r.age_group}: ${belowPct(r)}% (${(r.alice + r.poverty).toLocaleString()} of ${r.households.toLocaleString()} households)\n`;
          });
          response += '\n';
        }
        if (hhYear !== undefined) {
          response += 'By household type (families with children, share below the ALICE threshold):\n';
          csvService.getHouseholdTypes(hhYear).forEach((r) => {
            response += `- ${r.name}: ${belowPct(r)}% (${(r.alice + r.poverty).toLocaleString()} of ${r.households.toLocaleString()} households)\n`;
          });
          response += '\n';
        }
        if (raceYear !== undefined) {
          response += 'By race/ethnicity (share below the ALICE threshold):\n';
          csvService.getRaceBreakdown(raceYear).forEach((r) => {
            response += `- ${r.race}: ${belowPct(r)}% (${(r.alice + r.poverty).toLocaleString()} of ${r.households.toLocaleString()} households)\n`;
          });
          response += '\n';
        }
        response += 'Ask about any group by name (e.g. "Hispanic households in Arkansas" or "single mothers in Arkansas") for the full breakdown — I have county-level versions too (e.g. "demographics of Pulaski County").';
      } else {
        // General demographic overview
        const totalData = demographicData.find(d => d.category === 'Total Arkansas');

        response = `According to my data set, here's Arkansas demographic data:\n\n`;

        if (totalData) {
          const combinedThreshold = totalData.alice_percentage + totalData.poverty_percent;
          response += `Overall Arkansas households:\n`;
          response += `ALICE households: ${totalData.alice_percentage}% (${totalData.alice_households.toLocaleString()} households)\n`;
          response += `Households in poverty: ${totalData.poverty_percent}%\n`;
          response += `Total below ALICE threshold: ${combinedThreshold}% (ALICE + poverty combined)\n\n`;
          response += `This means ${totalData.alice_households.toLocaleString()} Arkansas households are specifically ALICE (above poverty but below the cost of basic needs).\n\n`;
        }
        
        // Show highest and lowest rates
        const nonTotalData = demographicData.filter(d => d.category !== 'Total Arkansas');
        const highest = nonTotalData.reduce((max, demo) => 
          demo.alice_percentage > max.alice_percentage ? demo : max
        );
        const lowest = nonTotalData.reduce((min, demo) => 
          demo.alice_percentage < min.alice_percentage ? demo : min
        );
        
        response += `Highest ALICE rate: ${highest.category} at ${highest.alice_percentage}%\n`;
        response += `Lowest ALICE rate: ${lowest.category} at ${lowest.alice_percentage}%\n\n`;
        response += `This shows significant variation across demographic groups in Arkansas.`;
      }
      
      const result = {
        text: response,
        success: true,
        action: 'DEMOGRAPHICS_DATA_RETRIEVED'
      };
      
      // Clean up old processed messages (keep only last 5 seconds worth)
      setTimeout(() => {
        if ((global as any).processedMessages?.has(messageId)) {
          (global as any).processedMessages.delete(messageId);
          console.error('*** Cleaned up processed message:', messageId);
        }
      }, 5000);
      
      // Signal completion to ElizaOS via callback
      if (callback) {
        console.error('*** DEMOGRAPHICS: Calling callback with result ***');
        callback(result);
        console.error('*** DEMOGRAPHICS: Action completed, should not process again ***');
        // Return early after callback to prevent double response
        return true;
      }
      
      console.error('*** DEMOGRAPHICS: Returning result (no callback) ***');
      return result;
    } catch (error: any) {
      const errorMessage = "I cannot access my demographic data systems right now. Please try again later.";
      if (callback) callback(errorMessage);
      return errorMessage;
    }
  },
  examples: [
    [
      {
        name: "{{user1}}",
        content: { text: "What are the ALICE rates by race?" }
      },
      {
        name: "Alice",
        content: { text: "According to my data set, here are ALICE rates by race/ethnicity in Arkansas:\n\nWhite: 25% (246,914 of 987,654 households)\nBlack: 41% (75,806 of 185,432 households)\nHispanic/Latino: 35% (31,193 of 89,123 households)" }
      }
    ]
  ]
};
