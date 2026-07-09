import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

// Type definitions for our CSV data structures
export interface CountyData {
  county: string;
  households: number;
  below_alice_percentage: number;
  poverty: number;
  alice_percentage: number;
  alice_housholds: number;
  year: number;
  priority: boolean;
  notes?: string;
}

export interface DemographicData {
  category: string;
  total_households: number;
  alice_households: number;
  alice_percentage: number;
  poverty_percent: number;
  year: number;
}

export interface EmploymentData {
  occupation: string;
  total_workers: number;
  alice_workers: number;
  alice_percentage: number;
  median_wage: number;
  year: number;
}

export interface TrendData {
  metric: string;
  year: number;
  value: number;
  unit: string;
  change_from_previous?: number;
  notes?: string;
}

export interface SubCountyData {
  year: number;
  type: string;
  geo_id2: string;
  geo_display_label: string;
  households: number;
  poverty_households: number;
  alice_households: number;
  above_alice_households: number;
  county: string;
}

export interface StatewideData {
  category: string;
  value: number;
  unit: string;
  year: number;
  notes?: string;
}

// Household-type breakdown stored as absolute counts per ALICE band.
// Multi-year: each year is a set of rows distinguished by `year`.
export interface HouseholdTypeData {
  year: number;
  name: string;
  above: number;     // households above the ALICE threshold
  alice: number;     // ALICE households (above poverty, below cost of living)
  poverty: number;   // households below the federal poverty line
  households: number; // total households of this type
}

// Time series (2010-present) of households BELOW the ALICE threshold
// (ALICE + poverty combined), broken down by household type.
export interface HouseholdTypeTrendData {
  year: number;
  name: string;
  below_alice_threshold: number;
}

// Time series (2021-present) of households BELOW the ALICE threshold
// (ALICE + poverty combined), broken down by race/ethnicity.
export interface RaceTrendData {
  year: number;
  race: string;
  below_alice_threshold: number;
}

// Time series (2010-present) of households BELOW the ALICE threshold
// (ALICE + poverty combined), broken down by age of head of household.
export interface AgeTrendData {
  year: number;
  age_group: string;
  below_alice_threshold: number;
}

// County-level total households and % below the ALICE threshold, by year.
// A lighter-weight companion to CountyData (which has the full 2023 breakdown).
export interface CountyTrendData {
  year: number;
  county: string;                // bare name, e.g. "Arkansas" (no "County" suffix)
  households: number;
  below_alice_threshold: number; // percent
}

// Race/ethnicity breakdown as absolute counts per ALICE band, by year.
export interface RaceBreakdownData {
  year: number;
  race: string;
  above: number;     // households above the ALICE threshold
  alice: number;     // ALICE households (above poverty, below cost of living)
  poverty: number;   // households below the federal poverty line
  households: number; // total households of this race/ethnicity
}

// ALICE budget (Survival or Stability) — monthly cost of each line item plus
// totals, for a given household composition. All figures are dollars.
export interface BudgetData {
  year: number;
  budget_type: string;      // "Survival" | "Stability"
  household_type: string;   // e.g. "Single Adult", "Two Adults Two Children"
  housing: number;
  child_care: number;
  food: number;
  transportation: number;
  health_care: number;
  technology: number;
  miscellaneous: number;
  savings: number;
  taxes: number;
  monthly_total: number;
  annual_total: number;
  hourly_wage: number;
}

export interface LocationEntry {
  name: string;           // Base name (e.g., "Benton")
  type: 'City' | 'Town' | 'County' | 'Subcounty';
  priority: number;       // 1=City, 2=Town, 3=County, 4=Subcounty
  dataRef: CountyData | SubCountyData;  // Reference to actual data
}

export class CsvDataService {
  private counties: CountyData[] = [];
  private demographics: DemographicData[] = [];
  private employment: EmploymentData[] = [];
  private trends: TrendData[] = [];
  private subcounty: SubCountyData[] = [];
  private statewide: StatewideData[] = [];
  private householdTypes: HouseholdTypeData[] = [];
  private householdTypeTrends: HouseholdTypeTrendData[] = [];
  private raceTrends: RaceTrendData[] = [];
  private raceBreakdown: RaceBreakdownData[] = [];
  private countyTrends: CountyTrendData[] = [];
  private ageTrends: AgeTrendData[] = [];
  private budgets: BudgetData[] = [];
  private locationNameIndex: Map<string, LocationEntry[]> = new Map();  // Lookup table for prioritized search
  private initialized = false;

  initialize(): void {
    if (this.initialized) return;

    const maxRetries = parseInt(process.env.CSV_INIT_RETRIES || '3');
    const retryDelay = parseInt(process.env.CSV_RETRY_DELAY || '200');
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`*** CSV Data Service initialization attempt ${attempt}/${maxRetries} ***`);
        
        // Load all CSV data files synchronously at startup
        this.loadCsvData();
        
        this.initialized = true;
        console.log('*** CSV Data Service initialized successfully with', 
          this.counties.length, 'counties,', 
          this.demographics.length, 'demographic records,',
          this.employment.length, 'employment records,',
          this.trends.length, 'trend records,',
          this.statewide.length, 'statewide records ***');
        return; // Success, exit retry loop
        
      } catch (error) {
        console.error(`*** Failed to initialize CSV Data Service (attempt ${attempt}/${maxRetries}): ***`, error);
        
        if (attempt === maxRetries) {
          // Final attempt failed, throw error
          throw new Error(`CSV Data Service initialization failed after ${maxRetries} attempts: ${error.message}`);
        }
        
        // Wait before retry with exponential backoff
        const delay = retryDelay * Math.pow(2, attempt - 1);
        console.log(`*** Retrying CSV initialization in ${delay}ms... ***`);
        
        // Synchronous delay for initialization
        const start = Date.now();
        while (Date.now() - start < delay) {
          // Busy wait for synchronous delay
        }
      }
    }
  }

  private loadCsvData() {
    console.log('*** Loading CSV data from /data folder ONLY ***');
    
    // Load counties data - ONLY from /data folder
    const countiesPath = path.join(process.cwd(), 'data', 'counties.csv');
    console.log('*** Loading counties from:', countiesPath);
    
    if (!fs.existsSync(countiesPath)) {
      throw new Error(`Counties CSV file not found at: ${countiesPath}`);
    }
    
    const countiesContent = fs.readFileSync(countiesPath, 'utf-8');
    console.log('*** CSV file size:', countiesContent.length, 'characters');
    
    this.counties = parse(countiesContent, {
      columns: true,
      skip_empty_lines: true,
      cast: (value, { column }) => {
        if (column === 'households' || column === 'below_alice_percentage' || column === 'poverty' || column === 'alice_percentage' || column === 'alice_housholds' || column === 'year') {
          return parseInt(value);
        }
        if (column === 'priority') {
          return value === 'TRUE' || value === 'true';
        }
        return value;
      }
    });
    
    console.log(`*** Loaded ${this.counties.length} counties from CSV ***`);
    
    // Log Johnson County specifically for debugging
    const johnson = this.counties.find(c => c.county.toLowerCase().includes('johnson'));
    if (johnson) {
      console.log('*** JOHNSON COUNTY LOADED FROM CSV:', JSON.stringify(johnson));
    } else {
      console.log('*** ERROR: Johnson County not found in loaded data!');
    }
    
    console.log('*** First 3 counties:', this.counties.slice(0, 3).map(c => `${c.county}: ${c.households} households, ${c.alice_percentage}%`));

    // Load other CSV files from /data folder only
    const demographicsPath = path.join(process.cwd(), 'data', 'demographics.csv');
    const employmentPath = path.join(process.cwd(), 'data', 'employment.csv');
    const trendsPath = path.join(process.cwd(), 'data', 'trends.csv');

    if (fs.existsSync(demographicsPath)) {
      const demographicsContent = fs.readFileSync(demographicsPath, 'utf-8');
      this.demographics = parse(demographicsContent, {
        columns: true,
        skip_empty_lines: true,
        cast: (value, { column }) => {
          if (column === 'total_households' || column === 'alice_households' || column === 'alice_percentage' || column === 'poverty_percent' || column === 'year') {
            return parseInt(value);
          }
          return value;
        }
      });
    }

    if (fs.existsSync(employmentPath)) {
      const employmentContent = fs.readFileSync(employmentPath, 'utf-8');
      this.employment = parse(employmentContent, {
        columns: true,
        skip_empty_lines: true,
        cast: (value, { column }) => {
          if (column === 'total_workers' || column === 'alice_workers' || column === 'alice_percentage' || column === 'year') {
            return parseInt(value);
          }
          if (column === 'median_wage') {
            return parseFloat(value);
          }
          return value;
        }
      });
    }

    if (fs.existsSync(trendsPath)) {
      const trendsContent = fs.readFileSync(trendsPath, 'utf-8');
      // Parse raw rows as-is; we'll transform to TrendData[] based on detected headers
      const rawRows: any[] = parse(trendsContent, {
        columns: true,
        skip_empty_lines: true
      });

      // Detect if file matches the new statewide schema
      // Expected headers: Year, Poverty, ALICE, Above Alice, TotalHouseholds
      const hasNewSchema = rawRows.length > 0 &&
        ('Year' in rawRows[0]) &&
        ('ALICE' in rawRows[0]) &&
        ('Poverty' in rawRows[0]) &&
        (('Above Alice' in rawRows[0]) || ('AboveAlice' in rawRows[0])) &&
        (('TotalHouseholds' in rawRows[0]) || ('Total Households' in rawRows[0]));

      if (hasNewSchema) {
        // Transform into TrendData entries for each year
        // Create metrics: Poverty Households, ALICE Households, Above ALICE Households, Total Households, Statewide ALICE Rate
        const trends: TrendData[] = [];

        // Sort by Year numeric ascending
        const rows = [...rawRows].sort((a, b) => parseInt(a['Year']) - parseInt(b['Year']));

        // Helper to get safe numeric field accommodating slight header variations
        const num = (row: any, key: string) => {
          const val = row[key] ?? row[key.replace(/\s+/g, '')] ?? row[key.replace(' ', '')];
          return typeof val === 'number' ? val : parseInt(String(val || '0'));
        };

        const metrics = [
          { key: 'Poverty', label: 'Poverty Households', unit: ' households' },
          { key: 'ALICE', label: 'ALICE Households', unit: ' households' },
          { key: 'Above Alice', label: 'Above ALICE Households', unit: ' households' },
          { key: 'TotalHouseholds', label: 'Total Households', unit: ' households' }
        ];

        // Build count metrics
        for (const row of rows) {
          const year = parseInt(String(row['Year']));
          for (const m of metrics) {
            const value = num(row, m.key);
            trends.push({
              metric: m.label,
              year,
              value,
              unit: m.unit
            });
          }
          // Computed statewide ALICE rate as percentage of TotalHouseholds
          const total = num(row, 'TotalHouseholds');
          const alice = num(row, 'ALICE');
          if (total > 0) {
            const rate = Math.round((alice / total) * 100);
            trends.push({
              metric: 'Statewide ALICE Rate',
              year,
              value: rate,
              unit: '%'
            });
          }
        }

        // Compute change_from_previous per metric
        const byMetric: Record<string, TrendData[]> = trends.reduce((acc, t) => {
          acc[t.metric] = acc[t.metric] || [];
          acc[t.metric].push(t);
          return acc;
        }, {} as Record<string, TrendData[]>);

        for (const list of Object.values(byMetric)) {
          list.sort((a, b) => a.year - b.year);
          for (let i = 1; i < list.length; i++) {
            const prev = list[i - 1];
            const cur = list[i];
            cur.change_from_previous = cur.value - prev.value;
          }
        }

        // Flatten back
        this.trends = Object.values(byMetric).flat();
      } else {
        // Fallback: assume existing TrendData-shaped CSV
        this.trends = parse(trendsContent, {
          columns: true,
          skip_empty_lines: true,
          cast: (value, { column }) => {
            if (column === 'year' || column === 'value') {
              return parseInt(value);
            }
            if (column === 'change_from_previous') {
              return value ? parseInt(value) : null;
            }
            return value;
          }
        });
      }
    }

    // Load subcounty data
    const subcountyPath = path.join(process.cwd(), 'data', 'subcounty.csv');
    if (fs.existsSync(subcountyPath)) {
      const subcountyContent = fs.readFileSync(subcountyPath, 'utf-8');
      const rawData = parse(subcountyContent, {
        columns: true,
        skip_empty_lines: true,
        bom: true,  // Strip UTF-8 BOM from column names
        cast: (value, { column }) => {
          if (column === 'Year' || column === 'Households' || column === 'Poverty Households' || 
              column === 'ALICE Households' || column === 'Above ALICE Households') {
            return parseInt(value);
          }
          return value;
        }
      });
      
      console.log('*** First raw CSV row:', JSON.stringify(rawData[0]));
      console.log('*** Raw row keys:', Object.keys(rawData[0]));
      
      // Map CSV columns to interface properties
      this.subcounty = rawData.map((row: any) => ({
        year: row.Year,
        type: row.Type,
        geo_id2: row['GEO id2'],
        geo_display_label: row['GEO display_label'],
        households: row.Households,
        poverty_households: row['Poverty Households'],
        alice_households: row['ALICE Households'],
        above_alice_households: row['Above ALICE Households'],
        county: row.County
      }));
      
      console.log(`*** Loaded ${this.subcounty.length} subcounty records from CSV ***`);
      console.log('*** Sample subcounty record:', JSON.stringify(this.subcounty[0]));
    }

    // Load statewide data
    const statewidePath = path.join(process.cwd(), 'data', 'statewide.csv');
    if (fs.existsSync(statewidePath)) {
      const statewideContent = fs.readFileSync(statewidePath, 'utf-8');
      this.statewide = parse(statewideContent, {
        columns: true,
        skip_empty_lines: true,
        cast: (value, { column }) => {
          if (column === 'value' || column === 'year') {
            return parseInt(value);
          }
          return value;
        }
      });
      console.log(`*** Loaded ${this.statewide.length} statewide records from CSV ***`);
    }

    // Load household-type breakdown data (multi-year, stored as counts)
    const householdTypesPath = path.join(process.cwd(), 'data', 'household-types.csv');
    if (fs.existsSync(householdTypesPath)) {
      const householdTypesContent = fs.readFileSync(householdTypesPath, 'utf-8');
      this.householdTypes = parse(householdTypesContent, {
        columns: true,
        skip_empty_lines: true,
        cast: (value, { column }) => {
          if (column === 'Year' || column === 'Above' || column === 'ALICE' || column === 'Poverty' || column === 'Households') {
            return parseInt(value);
          }
          return value;
        }
      }).map((row: any) => ({
        year: row.Year,
        name: row.Name,
        above: row.Above,
        alice: row.ALICE,
        poverty: row.Poverty,
        households: row.Households,
      }));
      console.log(`*** Loaded ${this.householdTypes.length} household-type records from CSV ***`);
    }

    // Load household-type trend data (below-ALICE-threshold counts over time)
    const householdTypeTrendsPath = path.join(process.cwd(), 'data', 'household-type-trends.csv');
    if (fs.existsSync(householdTypeTrendsPath)) {
      const householdTypeTrendsContent = fs.readFileSync(householdTypeTrendsPath, 'utf-8');
      this.householdTypeTrends = parse(householdTypeTrendsContent, {
        columns: true,
        skip_empty_lines: true,
        cast: (value, { column }) => {
          if (column === 'Year' || column === 'BelowAliceThreshold') {
            return parseInt(value);
          }
          return value;
        }
      }).map((row: any) => ({
        year: row.Year,
        name: row.Name,
        below_alice_threshold: row.BelowAliceThreshold,
      }));
      console.log(`*** Loaded ${this.householdTypeTrends.length} household-type trend records from CSV ***`);
    }

    // Load race/ethnicity trend data (below-ALICE-threshold counts over time)
    const raceTrendsPath = path.join(process.cwd(), 'data', 'race-trends.csv');
    if (fs.existsSync(raceTrendsPath)) {
      const raceTrendsContent = fs.readFileSync(raceTrendsPath, 'utf-8');
      this.raceTrends = parse(raceTrendsContent, {
        columns: true,
        skip_empty_lines: true,
        cast: (value, { column }) => {
          if (column === 'Year' || column === 'BelowAliceThreshold') {
            return parseInt(value);
          }
          return value;
        }
      }).map((row: any) => ({
        year: row.Year,
        race: row.Race,
        below_alice_threshold: row.BelowAliceThreshold,
      }));
      console.log(`*** Loaded ${this.raceTrends.length} race trend records from CSV ***`);
    }

    // Load race/ethnicity band breakdown (Above/ALICE/Poverty counts by year)
    const raceTypesPath = path.join(process.cwd(), 'data', 'race-types.csv');
    if (fs.existsSync(raceTypesPath)) {
      const raceTypesContent = fs.readFileSync(raceTypesPath, 'utf-8');
      this.raceBreakdown = parse(raceTypesContent, {
        columns: true,
        skip_empty_lines: true,
        cast: (value, { column }) => {
          if (column === 'Year' || column === 'Above' || column === 'ALICE' || column === 'Poverty' || column === 'Households') {
            return parseInt(value);
          }
          return value;
        }
      }).map((row: any) => ({
        year: row.Year,
        race: row.Race,
        above: row.Above,
        alice: row.ALICE,
        poverty: row.Poverty,
        households: row.Households,
      }));
      console.log(`*** Loaded ${this.raceBreakdown.length} race breakdown records from CSV ***`);
    }

    // Load county-level trend data (households + % below ALICE threshold by year)
    const countyTrendsPath = path.join(process.cwd(), 'data', 'county-trends.csv');
    if (fs.existsSync(countyTrendsPath)) {
      const countyTrendsContent = fs.readFileSync(countyTrendsPath, 'utf-8');
      this.countyTrends = parse(countyTrendsContent, {
        columns: true,
        skip_empty_lines: true,
        cast: (value, { column }) => {
          if (column === 'Year' || column === 'Households' || column === 'BelowAliceThreshold') {
            return parseInt(value);
          }
          return value;
        }
      }).map((row: any) => ({
        year: row.Year,
        county: row.County,
        households: row.Households,
        below_alice_threshold: row.BelowAliceThreshold,
      }));
      console.log(`*** Loaded ${this.countyTrends.length} county trend records from CSV ***`);
    }

    // Load age-group trend data (below-ALICE-threshold counts over time)
    const ageTrendsPath = path.join(process.cwd(), 'data', 'age-trends.csv');
    if (fs.existsSync(ageTrendsPath)) {
      const ageTrendsContent = fs.readFileSync(ageTrendsPath, 'utf-8');
      this.ageTrends = parse(ageTrendsContent, {
        columns: true,
        skip_empty_lines: true,
        cast: (value, { column }) => {
          if (column === 'Year' || column === 'BelowAliceThreshold') {
            return parseInt(value);
          }
          return value;
        }
      }).map((row: any) => ({
        year: row.Year,
        age_group: row.AgeGroup,
        below_alice_threshold: row.BelowAliceThreshold,
      }));
      console.log(`*** Loaded ${this.ageTrends.length} age trend records from CSV ***`);
    }

    // Load ALICE budget data (Survival / Stability budgets by household type)
    const budgetsPath = path.join(process.cwd(), 'data', 'budgets.csv');
    if (fs.existsSync(budgetsPath)) {
      const budgetsContent = fs.readFileSync(budgetsPath, 'utf-8');
      const numericColumns = new Set([
        'Year', 'Housing', 'ChildCare', 'Food', 'Transportation', 'HealthCare',
        'Technology', 'Miscellaneous', 'Savings', 'Taxes', 'MonthlyTotal', 'AnnualTotal'
      ]);
      this.budgets = parse(budgetsContent, {
        columns: true,
        skip_empty_lines: true,
        cast: (value, { column }) => {
          if (numericColumns.has(column as string)) return parseInt(value);
          if (column === 'HourlyWage') return parseFloat(value);
          return value;
        }
      }).map((row: any) => ({
        year: row.Year,
        budget_type: row.BudgetType,
        household_type: row.HouseholdType,
        housing: row.Housing,
        child_care: row.ChildCare,
        food: row.Food,
        transportation: row.Transportation,
        health_care: row.HealthCare,
        technology: row.Technology,
        miscellaneous: row.Miscellaneous,
        savings: row.Savings,
        taxes: row.Taxes,
        monthly_total: row.MonthlyTotal,
        annual_total: row.AnnualTotal,
        hourly_wage: row.HourlyWage,
      }));
      console.log(`*** Loaded ${this.budgets.length} budget records from CSV ***`);
    }

    // Build location name index for prioritized search
    this.buildLocationIndex();
  }
  
  private buildLocationIndex(): void {
    console.log('*** Building location name index for prioritized search ***');
    this.locationNameIndex.clear();
    
    // Add counties (Priority 3)
    for (const county of this.counties) {
      const baseName = county.county.toLowerCase().trim();
      const entry: LocationEntry = {
        name: county.county,
        type: 'County',
        priority: 3,
        dataRef: county
      };
      
      if (!this.locationNameIndex.has(baseName)) {
        this.locationNameIndex.set(baseName, []);
      }
      this.locationNameIndex.get(baseName)!.push(entry);
    }
    
    // Add subcounties/cities/towns from subcounty data
    for (const subcounty of this.subcounty) {
      // Extract base name from geo_display_label
      // Examples:
      // "Fayetteville city, Arkansas" -> "fayetteville"
      // "Alpena town, Arkansas" -> "alpena" 
      // "Washington County, Arkansas" -> "washington"
      
      const label = subcounty.geo_display_label.toLowerCase();
      let baseName = '';
      let type: 'City' | 'Town' | 'Subcounty' = 'Subcounty';
      let priority = 4;
      
      // Check for city
      if (label.includes(' city,')) {
        const match = label.match(/^\s*([^,]+?)\s+city,/);
        if (match) {
          baseName = match[1].trim();
          type = 'City';
          priority = 1;
        }
      }
      // Check for town
      else if (label.includes(' town,')) {
        const match = label.match(/^\s*([^,]+?)\s+town,/);
        if (match) {
          baseName = match[1].trim();
          type = 'Town';
          priority = 2;
        }
      }
      // Subcounty (township) - extract first part before comma
      else if (subcounty.type === 'Sub_County') {
        const match = label.match(/^\s*([^,]+?)\s*,/);
        if (match) {
          baseName = match[1].trim();
          type = 'Subcounty';
          priority = 4;
        }
      }
      
      if (baseName) {
        const entry: LocationEntry = {
          name: subcounty.geo_display_label.split(',')[0].trim(), // Preserve original case
          type: type,
          priority: priority,
          dataRef: subcounty
        };
        
        if (!this.locationNameIndex.has(baseName)) {
          this.locationNameIndex.set(baseName, []);
        }
        this.locationNameIndex.get(baseName)!.push(entry);
      }
    }
    
    // Sort entries by priority (lower number = higher priority)
    for (const entries of this.locationNameIndex.values()) {
      entries.sort((a, b) => a.priority - b.priority);
    }
    
    console.log(`*** Location index built with ${this.locationNameIndex.size} unique location names ***`);
    
    // Log some examples
    const examples = Array.from(this.locationNameIndex.entries()).slice(0, 5);
    for (const [name, entries] of examples) {
      console.log(`*** Example: "${name}" -> ${entries.map(e => `${e.type}(${e.priority})`).join(', ')} ***`);
    }
  }

  private loadDemographics(): void {
    const csvPath = path.join(process.cwd(), 'data', 'demographics.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      cast: (value, context) => {
        if (['total_households', 'alice_households', 'alice_percentage', 'poverty_percent', 'year'].includes(context.column as string)) {
          return parseInt(value);
        }
        return value;
      }
    });

    this.demographics = records;
  }

  private loadEmployment(): void {
    const csvPath = path.join(process.cwd(), 'data', 'employment.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      cast: (value, context) => {
        if (['total_workers', 'alice_workers', 'alice_percentage', 'year'].includes(context.column as string)) {
          return parseInt(value);
        }
        if (context.column === 'median_wage') {
          return parseFloat(value);
        }
        return value;
      }
    });

    this.employment = records;
  }

  private loadTrends(): void {
    const csvPath = path.join(process.cwd(), 'data', 'trends.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      cast: (value, context) => {
        if (['year', 'value'].includes(context.column as string)) {
          return parseInt(value);
        }
        if (context.column === 'change_from_previous') {
          return value ? parseInt(value) : undefined;
        }
        return value;
      }
    });

    this.trends = records;
  }

  // County data methods
  findCounty(countyName: string): CountyData | undefined {
    const searchName = countyName.toLowerCase().trim();
    console.log('*** CSV findCounty searching for:', searchName);
    console.log('*** Available counties:', this.counties.map(c => c.county).slice(0, 10));
    
    // Try exact match first (with and without "county" suffix)
    let county = this.counties.find(c => {
      const countyLower = c.county.toLowerCase();
      const countyWithoutSuffix = countyLower.replace(' county', '');
      
      return countyLower === searchName ||
             countyLower === `${searchName} county` ||
             countyWithoutSuffix === searchName ||
             searchName === `${countyWithoutSuffix} county`;
    });
    
    if (county) {
      console.log('*** Exact match found:', county.county);
      return county;
    }
    
    // Try fuzzy matching - check if search name is contained in county name or vice versa
    county = this.counties.find(c => {
      const countyLower = c.county.toLowerCase();
      const countyWithoutSuffix = countyLower.replace(' county', '');
      
      return countyLower.includes(searchName) ||
             searchName.includes(countyWithoutSuffix) ||
             countyWithoutSuffix.includes(searchName);
    });
    
    if (county) {
      console.log('*** Fuzzy match found:', county.county);
    } else {
      console.log('*** No match found for:', searchName);
      console.log('*** First 10 counties for debugging:', this.counties.slice(0, 10).map(c => c.county));
    }
    
    return county;
  }

  getAllCounties(): CountyData[] {
    return [...this.counties];
  }

  getCountiesByRate(minRate?: number, maxRate?: number): CountyData[] {
    return this.counties.filter(county => {
      if (minRate !== undefined && county.alice_percentage < minRate) return false;
      if (maxRate !== undefined && county.alice_percentage > maxRate) return false;
      return true;
    });
  }

  // County trend methods (households + % below ALICE threshold by year)
  getAllCountyTrends(): CountyTrendData[] {
    return [...this.countyTrends];
  }

  getCountyTrendYears(): number[] {
    return [...new Set(this.countyTrends.map(c => c.year))].sort((a, b) => a - b);
  }

  getLatestCountyTrendYear(): number | undefined {
    const years = this.getCountyTrendYears();
    return years.length ? years[years.length - 1] : undefined;
  }

  getCountyTrendsByYear(year: number): CountyTrendData[] {
    return this.countyTrends.filter(c => c.year === year);
  }

  // Find a county's trend row, defaulting to the latest year. Matches names
  // with or without a " County" suffix ("Arkansas County" <-> "Arkansas").
  findCountyTrend(county: string, year?: number): CountyTrendData | undefined {
    const norm = (s: string) => s.toLowerCase().replace(/\s+county$/, '').trim();
    const target = norm(county);
    const targetYear = year ?? this.getLatestCountyTrendYear();
    return this.countyTrends.find(c =>
      norm(c.county) === target && (targetYear === undefined || c.year === targetYear)
    );
  }

  // Demographics methods
  getAllDemographics(): DemographicData[] {
    return [...this.demographics];
  }

  getDemographicByCategory(category: string): DemographicData | undefined {
    return this.demographics.find(d =>
      d.category.toLowerCase().trim().includes(category.toLowerCase().trim())
    );
  }

  // Household-type breakdown methods
  getAllHouseholdTypes(): HouseholdTypeData[] {
    return [...this.householdTypes];
  }

  getHouseholdTypes(year: number): HouseholdTypeData[] {
    return this.householdTypes.filter(h => h.year === year);
  }

  getHouseholdTypeYears(): number[] {
    return [...new Set(this.householdTypes.map(h => h.year))].sort((a, b) => a - b);
  }

  getLatestHouseholdTypeYear(): number | undefined {
    const years = this.getHouseholdTypeYears();
    return years.length ? years[years.length - 1] : undefined;
  }

  // Household-type trend methods (below-ALICE-threshold counts over time)
  getAllHouseholdTypeTrends(): HouseholdTypeTrendData[] {
    return [...this.householdTypeTrends];
  }

  // Series for one household type, sorted oldest-to-newest.
  getHouseholdTypeTrend(name: string): HouseholdTypeTrendData[] {
    const target = name.toLowerCase().trim();
    return this.householdTypeTrends
      .filter(h => h.name.toLowerCase().trim() === target)
      .sort((a, b) => a.year - b.year);
  }

  getHouseholdTypeTrendYears(): number[] {
    return [...new Set(this.householdTypeTrends.map(h => h.year))].sort((a, b) => a - b);
  }

  getLatestHouseholdTypeTrendYear(): number | undefined {
    const years = this.getHouseholdTypeTrendYears();
    return years.length ? years[years.length - 1] : undefined;
  }

  // Race/ethnicity trend methods (below-ALICE-threshold counts over time)
  getAllRaceTrends(): RaceTrendData[] {
    return [...this.raceTrends];
  }

  // Series for one race/ethnicity, sorted oldest-to-newest.
  getRaceTrend(race: string): RaceTrendData[] {
    const target = race.toLowerCase().trim();
    return this.raceTrends
      .filter(r => r.race.toLowerCase().trim() === target)
      .sort((a, b) => a.year - b.year);
  }

  getRaceTrendYears(): number[] {
    return [...new Set(this.raceTrends.map(r => r.year))].sort((a, b) => a - b);
  }

  getLatestRaceTrendYear(): number | undefined {
    const years = this.getRaceTrendYears();
    return years.length ? years[years.length - 1] : undefined;
  }

  // Race/ethnicity band-breakdown methods (Above/ALICE/Poverty counts)
  getAllRaceBreakdown(): RaceBreakdownData[] {
    return [...this.raceBreakdown];
  }

  getRaceBreakdown(year: number): RaceBreakdownData[] {
    return this.raceBreakdown.filter(r => r.year === year);
  }

  getRaceBreakdownYears(): number[] {
    return [...new Set(this.raceBreakdown.map(r => r.year))].sort((a, b) => a - b);
  }

  getLatestRaceBreakdownYear(): number | undefined {
    const years = this.getRaceBreakdownYears();
    return years.length ? years[years.length - 1] : undefined;
  }

  // Age-group trend methods (below-ALICE-threshold counts over time)
  getAllAgeTrends(): AgeTrendData[] {
    return [...this.ageTrends];
  }

  getAgeTrend(ageGroup: string): AgeTrendData[] {
    const target = ageGroup.toLowerCase().trim();
    return this.ageTrends
      .filter(a => a.age_group.toLowerCase().trim() === target)
      .sort((a, b) => a.year - b.year);
  }

  getAgeTrendYears(): number[] {
    return [...new Set(this.ageTrends.map(a => a.year))].sort((a, b) => a - b);
  }

  getLatestAgeTrendYear(): number | undefined {
    const years = this.getAgeTrendYears();
    return years.length ? years[years.length - 1] : undefined;
  }

  // Budget methods (ALICE Survival / Stability budgets)
  getAllBudgets(): BudgetData[] {
    return [...this.budgets];
  }

  getBudgetYears(): number[] {
    return [...new Set(this.budgets.map(b => b.year))].sort((a, b) => a - b);
  }

  getLatestBudgetYear(): number | undefined {
    const years = this.getBudgetYears();
    return years.length ? years[years.length - 1] : undefined;
  }

  getBudgetTypes(): string[] {
    return [...new Set(this.budgets.map(b => b.budget_type))];
  }

  getHouseholdTypesForBudget(): string[] {
    return [...new Set(this.budgets.map(b => b.household_type))];
  }

  // Look up one budget row by household type (and optionally budget type / year).
  // Defaults to the latest year available.
  findBudget(householdType: string, budgetType?: string, year?: number): BudgetData | undefined {
    const targetHousehold = householdType.toLowerCase().trim();
    const targetYear = year ?? this.getLatestBudgetYear();
    return this.budgets.find(b =>
      b.household_type.toLowerCase().trim() === targetHousehold &&
      (budgetType === undefined || b.budget_type.toLowerCase() === budgetType.toLowerCase()) &&
      (targetYear === undefined || b.year === targetYear)
    );
  }

  // Employment methods
  getAllEmployment(): EmploymentData[] {
    return [...this.employment];
  }

  getEmploymentByOccupation(occupation: string): EmploymentData | undefined {
    return this.employment.find(e => 
      e.occupation.toLowerCase().includes(occupation.toLowerCase())
    );
  }

  // Trends methods
  getAllTrends(): TrendData[] {
    return [...this.trends];
  }

  getTrendsByMetric(metric: string): TrendData[] {
    return this.trends.filter(t => 
      t.metric.toLowerCase().includes(metric.toLowerCase())
    );
  }

  getTrendsByYear(year: number): TrendData[] {
    return this.trends.filter(t => t.year === year);
  }

  // Utility methods
  isInitialized(): boolean {
    return this.initialized;
  }

  getStats() {
    return {
      counties: this.counties.length,
      demographics: this.demographics.length,
      employment: this.employment.length,
      trends: this.trends.length,
      subcounty: this.subcounty.length,
      statewide: this.statewide.length,
      householdTypes: this.householdTypes.length,
      householdTypeTrends: this.householdTypeTrends.length,
      raceTrends: this.raceTrends.length,
      raceBreakdown: this.raceBreakdown.length,
      countyTrends: this.countyTrends.length,
      ageTrends: this.ageTrends.length,
      budgets: this.budgets.length,
      initialized: this.initialized
    };
  }

  // Location lookup methods
  lookupLocation(name: string): LocationEntry[] {
    const normalizedName = name.toLowerCase().trim();
    return this.locationNameIndex.get(normalizedName) || [];
  }
  
  hasAmbiguousName(name: string): boolean {
    const entries = this.lookupLocation(name);
    return entries.length > 1;
  }
  
  // SubCounty methods
  getAllSubCounty(): SubCountyData[] {
    return [...this.subcounty];
  }

  // Search by GEO display label or GEO id2
  // Enhanced to match place names like "Fayetteville" to "Fayetteville city"
  findSubCounty(searchTerm: string): SubCountyData | undefined {
    const normalizedSearch = searchTerm.toLowerCase().trim();
    
    // First, try exact match on display label or GEO id
    let match = this.subcounty.find(s => 
      s.geo_display_label.toLowerCase().includes(normalizedSearch) ||
      s.geo_id2.toLowerCase().includes(normalizedSearch)
    );
    
    if (match) return match;
    
    // Try with "city" suffix
    const withCity = `${normalizedSearch} city`;
    match = this.subcounty.find(s => 
      s.geo_display_label.toLowerCase().includes(withCity)
    );
    
    if (match) return match;
    
    // Try with "town" suffix
    const withTown = `${normalizedSearch} town`;
    match = this.subcounty.find(s => 
      s.geo_display_label.toLowerCase().includes(withTown)
    );
    
    if (match) return match;
    
    // If no match, try matching just the base name (without city/town/township suffix)
    // This allows partial matches for subcounty/township data
    match = this.subcounty.find(s => {
      const displayLabel = s.geo_display_label.toLowerCase();
      
      // Extract the base name part before city/town/township/cdp
      // Handles: "Fayetteville city, Arkansas" -> "fayetteville"
      //          "White township, Ashley County, Arkansas" -> "white"
      const nameMatch = displayLabel.match(/^\s*([^,]+?)(?:\s+(?:township|city|town|cdp))?(?:,|$)/);
      if (nameMatch) {
        const baseName = nameMatch[1].trim();
        
        // Check if search term matches the base name exactly
        if (baseName === normalizedSearch) {
          return true;
        }
        
        // Also check if the base name starts with the search term
        // This helps with partial matches
        if (baseName.startsWith(normalizedSearch) && normalizedSearch.length >= 3) {
          return true;
        }
      }
      return false;
    });
    
    return match;
  }

  // Search by type (Sub_County, Place, Zip_Code)
  getSubCountyByType(type: string): SubCountyData[] {
    const normalizedType = type.toLowerCase().replace(/[_\s]/g, '');
    return this.subcounty.filter(s => 
      s.type.toLowerCase().replace(/[_\s]/g, '').includes(normalizedType)
    );
  }

  // Search within a specific county
  getSubCountyByCounty(countyName: string): SubCountyData[] {
    return this.subcounty.filter(s => 
      s.county.toLowerCase().includes(countyName.toLowerCase())
    );
  }

  // Statewide methods
  getAllStatewide(): StatewideData[] {
    return [...this.statewide];
  }

  getStatewideByCategory(category: string): StatewideData | undefined {
    const normalizedSearch = category.toLowerCase().trim();
    return this.statewide.find(s => 
      s.category.toLowerCase().includes(normalizedSearch)
    );
  }

  getStatewideByYear(year: number): StatewideData[] {
    return this.statewide.filter(s => s.year === year);
  }
}
