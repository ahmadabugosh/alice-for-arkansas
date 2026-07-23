import { describe, expect, it } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse } from 'csv-parse/sync';

/**
 * Cross-file arithmetic consistency checks.
 *
 * Every dataset integration so far was verified by hand (sums, splits,
 * percentages). These tests make that verification automatic so any future
 * data drop that breaks internal consistency fails CI instead of silently
 * serving wrong numbers. They intentionally read the CSV files directly
 * (not through CsvDataService) so they validate the data itself.
 */

const dataDir = path.join(process.cwd(), 'data');
const load = (file: string): any[] =>
  parse(fs.readFileSync(path.join(dataDir, file), 'utf-8'), {
    columns: true,
    skip_empty_lines: true,
  });

const int = (v: any) => parseInt(String(v), 10);
const pct = (part: number, whole: number) => Math.round((part / whole) * 100);

describe('statewide trends (trends.csv)', () => {
  const trends = load('trends.csv');

  it('poverty + ALICE + above = total households for every year', () => {
    for (const r of trends) {
      expect(int(r['Poverty']) + int(r['ALICE']) + int(r['Above Alice'])).toBe(
        int(r['TotalHouseholds'])
      );
    }
  });
});

describe('county time series (county-timeseries.csv)', () => {
  const ts = load('county-timeseries.csv');
  const trends = load('trends.csv');

  it('covers all 75 counties for every year', () => {
    const byYear = new Map<number, number>();
    for (const r of ts) byYear.set(int(r['Year']), (byYear.get(int(r['Year'])) ?? 0) + 1);
    for (const [year, count] of byYear) {
      expect(count).toBe(75);
    }
  });

  it('poverty + ALICE + above = households for every county-year row', () => {
    for (const r of ts) {
      expect(int(r['Poverty']) + int(r['ALICE']) + int(r['Above'])).toBe(int(r['Households']));
    }
  });

  it('county sums equal the statewide trend row for every shared year', () => {
    const sums = new Map<number, { poverty: number; alice: number; households: number }>();
    for (const r of ts) {
      const y = int(r['Year']);
      const s = sums.get(y) ?? { poverty: 0, alice: 0, households: 0 };
      s.poverty += int(r['Poverty']);
      s.alice += int(r['ALICE']);
      s.households += int(r['Households']);
      sums.set(y, s);
    }
    for (const t of trends) {
      const s = sums.get(int(t['Year']));
      if (!s) continue;
      expect(s.poverty).toBe(int(t['Poverty']));
      expect(s.alice).toBe(int(t['ALICE']));
      expect(s.households).toBe(int(t['TotalHouseholds']));
    }
  });
});

describe('county trend file (county-trends.csv) vs time series', () => {
  const ts = load('county-timeseries.csv');
  const countyTrends = load('county-trends.csv');

  it('households and below-threshold % match the time series for all counties/years', () => {
    const tsByKey = new Map<string, any>();
    for (const r of ts) tsByKey.set(`${r['Year']}|${String(r['County']).toLowerCase()}`, r);
    expect(countyTrends.length).toBeGreaterThan(0);
    for (const r of countyTrends) {
      const t = tsByKey.get(`${r['Year']}|${String(r['County']).toLowerCase()}`);
      expect(t).toBeDefined();
      expect(int(r['Households'])).toBe(int(t['Households']));
      expect(int(r['BelowAliceThreshold'])).toBe(
        pct(int(t['Poverty']) + int(t['ALICE']), int(t['Households']))
      );
    }
  });
});

describe('legacy county file (counties.csv) vs 2023 time series', () => {
  const ts = load('county-timeseries.csv').filter((r) => int(r['Year']) === 2023);
  const counties = load('counties.csv');

  it('every numeric field reconciles with the exact 2023 counts', () => {
    const tsByName = new Map<string, any>();
    for (const r of ts) tsByName.set(String(r['County']).toLowerCase(), r);
    expect(counties.length).toBe(75);
    for (const c of counties) {
      const name = String(c['county']).toLowerCase().replace(/\s+county$/, '');
      const t = tsByName.get(name);
      expect(t).toBeDefined();
      const hh = int(t['Households']);
      expect(int(c['households'])).toBe(hh);
      expect(int(c['alice_housholds'])).toBe(int(t['ALICE']));
      expect(int(c['alice_percentage'])).toBe(pct(int(t['ALICE']), hh));
      expect(int(c['poverty'])).toBe(pct(int(t['Poverty']), hh));
      expect(int(c['below_alice_percentage'])).toBe(pct(int(t['ALICE']) + int(t['Poverty']), hh));
    }
  });
});

describe('statewide breakdown file (statewide.csv) vs trends.csv', () => {
  const statewide = load('statewide.csv');
  const trends = load('trends.csv');
  const byCategory = new Map(statewide.map((r) => [r['category'], r]));
  const value = (cat: string) => int(byCategory.get(cat)?.['value']);
  const year = int(byCategory.get('Total Households')?.['year']);
  const trendRow = trends.find((t) => int(t['Year']) === year);

  it('household counts match the trend row for its own year', () => {
    expect(trendRow).toBeDefined();
    expect(value('Total Households')).toBe(int(trendRow['TotalHouseholds']));
    expect(value('ALICE Households')).toBe(int(trendRow['ALICE']));
    expect(value('Poverty Households')).toBe(int(trendRow['Poverty']));
    expect(value('Above ALICE Threshold')).toBe(int(trendRow['Above Alice']));
  });

  it('derived counts and percentages are arithmetically consistent', () => {
    const total = value('Total Households');
    expect(value('Below ALICE Threshold')).toBe(
      value('ALICE Households') + value('Poverty Households')
    );
    expect(value('ALICE Percentage')).toBe(pct(value('ALICE Households'), total));
    expect(value('Poverty Percentage')).toBe(pct(value('Poverty Households'), total));
    expect(value('Rural Households') + value('Urban Households')).toBe(total);
  });
});

describe('demographic band files reconcile with their trend files', () => {
  const cases = [
    { band: 'household-types.csv', trend: 'household-type-trends.csv', key: 'Name' },
    { band: 'race-types.csv', trend: 'race-trends.csv', key: 'Race' },
    { band: 'age-types.csv', trend: 'age-trends.csv', key: 'AgeGroup' },
  ];

  for (const { band, trend, key } of cases) {
    it(`${band}: above + ALICE + poverty = households, and ALICE + poverty matches ${trend}`, () => {
      const bandRows = load(band);
      const trendRows = load(trend);
      const trendByKey = new Map(
        trendRows.map((r) => [`${r['Year']}|${String(r[key]).toLowerCase()}`, r])
      );
      expect(bandRows.length).toBeGreaterThan(0);
      for (const r of bandRows) {
        expect(int(r['Above']) + int(r['ALICE']) + int(r['Poverty'])).toBe(int(r['Households']));
        const t = trendByKey.get(`${r['Year']}|${String(r[key]).toLowerCase()}`);
        if (t) {
          expect(int(r['ALICE']) + int(r['Poverty'])).toBe(int(t['BelowAliceThreshold']));
        }
      }
    });
  }
});

describe('subcounty 2024 file (subcounty-2024.csv)', () => {
  const rows = load('subcounty-2024.csv');
  const countyNames = new Set(
    load('county-timeseries.csv')
      .filter((r) => int(r['Year']) === 2024)
      .map((r) => String(r['County']).toLowerCase())
  );

  it('poverty + ALICE + above = households for every place', () => {
    for (const r of rows) {
      expect(
        int(r['PovertyHouseholds']) + int(r['ALICEHouseholds']) + int(r['AboveALICEHouseholds'])
      ).toBe(int(r['Households']));
    }
  });

  it('every place maps to a real county', () => {
    for (const r of rows) {
      expect(countyNames.has(String(r['County']).toLowerCase())).toBe(true);
    }
  });
});

describe('county budgets (county-budgets.csv)', () => {
  const rows = load('county-budgets.csv');

  it('has all 75 counties x 8 household types', () => {
    expect(rows.length).toBe(600);
    const counties = new Set(rows.map((r) => String(r['County']).toLowerCase()));
    const types = new Set(rows.map((r) => r['HouseholdType']));
    expect(counties.size).toBe(75);
    expect(types.size).toBe(8);
  });

  it('line items sum to the monthly total and monthly x 12 = annual', () => {
    const items = [
      'Childcare', 'Food', 'Rent', 'Tech', 'Transportation',
      'Utilities', 'Healthcare', 'Taxes', 'TaxCredits', 'Misc',
    ];
    for (const r of rows) {
      const sum = items.reduce((acc, k) => acc + int(r[k]), 0);
      expect(sum).toBe(int(r['Monthly']));
      expect(int(r['Monthly']) * 12).toBe(int(r['Annual']));
    }
  });
});

describe('labor force sectors (labor-sectors.csv)', () => {
  const rows = load('labor-sectors.csv');

  it('has 20 uniquely named sectors, all for the same year', () => {
    expect(rows.length).toBe(20);
    expect(new Set(rows.map((r) => r['Sector'])).size).toBe(20);
    expect(new Set(rows.map((r) => int(r['Year']))).size).toBe(1);
  });

  it('above + ALICE + poverty = total workers for every sector', () => {
    for (const r of rows) {
      expect(int(r['Above']) + int(r['ALICE']) + int(r['Poverty'])).toBe(int(r['Total']));
    }
  });

  it('matches the source workbook spot values (Construction)', () => {
    const c = rows.find((r) => r['Sector'] === 'Construction')!;
    expect(int(c['ALICE'])).toBe(23603);
    expect(int(c['Poverty'])).toBe(10748);
    expect(int(c['Total'])).toBe(103526);
  });
});

describe('labor force jobs (labor-jobs.csv)', () => {
  const rows = load('labor-jobs.csv');

  it('has 20 uniquely named occupations, all for the same year', () => {
    expect(rows.length).toBe(20);
    expect(new Set(rows.map((r) => r['Occupation'])).size).toBe(20);
    expect(new Set(rows.map((r) => int(r['Year']))).size).toBe(1);
  });

  it('percentages are valid and wages are internally consistent', () => {
    for (const r of rows) {
      const p = int(r['PercentBelowALICE']);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(100);
      expect(int(r['TotalEmployment'])).toBeGreaterThan(0);
      // Median annual wage / 2080 working hours should equal the hourly wage
      const hourly = parseFloat(String(r['MedianHourlyWage']));
      expect(Math.abs(int(r['MedianAnnualWage']) / 2080 - hourly)).toBeLessThan(0.01);
    }
  });
});
