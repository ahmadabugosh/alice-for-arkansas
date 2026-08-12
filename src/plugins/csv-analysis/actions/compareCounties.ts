import { Action, IAgentRuntime, Memory, State } from '@elizaos/core';
import { CsvDataService, LocationEntry, SubCountyData } from '../services/csvDataService';
import { AR_COUNTY_NAMES, countyNameRegex } from '../constants/arkansasCounties';

interface LocationMention {
  index: number;
  entry: LocationEntry;
}

// Scan free text for known location names (cities, towns, counties as
// "x county", plus 5-digit zip codes). Longest names are matched first and
// matched spans are claimed, so "North Little Rock" doesn't also yield
// "Little Rock". Bare "arkansas" is the state, never a location.
function findLocationMentions(lowerText: string, csvService: CsvDataService): LocationMention[] {
  if (typeof csvService.getLocationNames !== 'function') return [];

  const claimed: Array<[number, number]> = [];
  const overlaps = (s: number, e: number) => claimed.some(([cs, ce]) => s < ce && e > cs);
  const mentions: LocationMention[] = [];

  const names = csvService.getLocationNames()
    .filter((n) => n !== 'arkansas')
    .sort((a, b) => b.length - a.length);
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\b${escaped}\\b`, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(lowerText))) {
      const start = m.index;
      const end = m.index + m[0].length;
      if (overlaps(start, end)) continue;
      const entries = csvService.lookupLocation(name);
      if (!entries.length) break;
      claimed.push([start, end]);
      mentions.push({ index: start, entry: entries[0] });
      break;
    }
  }

  // Zip codes aren't in the name index; resolve them directly.
  const zipRe = /\b\d{5}\b/g;
  let zm: RegExpExecArray | null;
  while ((zm = zipRe.exec(lowerText))) {
    if (overlaps(zm.index, zm.index + 5)) continue;
    const zip = csvService.findSubCounty(zm[0]);
    if (!zip) continue;
    claimed.push([zm.index, zm.index + 5]);
    mentions.push({
      index: zm.index,
      entry: { name: zm[0], type: 'Subcounty', priority: 4, dataRef: zip }
    });
  }

  return mentions.sort((a, b) => a.index - b.index);
}

export const compareCountiesAction: Action = {
  name: 'Comparing counties...',
  similes: ['compare counties', 'compare cities', 'compare towns', 'county comparison', 'versus', 'vs', 'difference between'],
  description: 'Compare ALICE data between Arkansas counties, cities, towns, or zip codes',
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = (message.content.text?.toLowerCase() || '').replace(/[-–—]/g, ' ');

    // Explicit comparison verbs
    const hasCompareVerb =
      text.includes('compare') ||
      text.includes('comparison') ||
      text.includes('versus') ||
      text.includes(' vs ') || text.includes(' vs.') ||
      text.includes('difference between');

    // County names, used both for explicit phrasing ("Compare X and Y", with or
    // without the word "county") and implicit comparisons ("Is X higher than Y?").
    const arkansasCounties = AR_COUNTY_NAMES;
    const namesFound = arkansasCounties.filter(c => countyNameRegex(c).test(text));
    const hasComparative =
      text.includes('than') || text.includes('compared to') ||
      text.includes('higher') || text.includes('lower') ||
      text.includes('more') || text.includes('less') ||
      text.includes('better') || text.includes('worse');

    // Explicit comparison: a compare verb paired with either the word "count(y)"
    // or two recognised county names ("Compare Washington and Union").
    if (hasCompareVerb && (text.includes('count') || namesFound.length >= 2)) {
      return true;
    }

    // Implicit comparison: two county names plus a comparative word,
    // e.g. "Is the ALICE threshold higher in Benton County than Washington County?"
    if (namesFound.length >= 2 && hasComparative) {
      return true;
    }

    // City/town/zip comparison: two known locations plus comparison wording,
    // e.g. "Compare Springdale and Rogers".
    if (hasCompareVerb || hasComparative) {
      const csvService = (runtime as any).csvDataService as CsvDataService | undefined;
      if (csvService) {
        return findLocationMentions(text, csvService).length >= 2;
      }
    }
    return false;
  },
  handler: async (runtime: IAgentRuntime, message: Memory, state: State, options: any, callback?: Function) => {
    const csvService = (runtime as any).csvDataService as CsvDataService;
    const text = message.content.text || '';
    
    // Extract county names by matching the message against the known county
    // list, so natural phrasing works ("Compare Washington and Union counties",
    // "X vs Y", "difference between X and Y", with or without the word "county").
    const arkansasCounties = AR_COUNTY_NAMES;

    const lowerText = text.toLowerCase().replace(/[-–—]/g, ' ');

    // Find each county that appears, in order of appearance. Longer names are
    // checked first so "little river" / "hot spring" win over a short substring.
    const foundCounties: { name: string; index: number }[] = [];
    for (const county of [...arkansasCounties].sort((a, b) => b.length - a.length)) {
      const match = countyNameRegex(county).exec(lowerText);
      if (match && !foundCounties.some(f => f.name === county)) {
        foundCounties.push({ name: county, index: match.index });
      }
    }

    let countyNames: string[] = foundCounties
      .sort((a, b) => a.index - b.index)
      .map(f => f.name);

    // Fallback: original "X county / Y counties" suffix pattern
    if (countyNames.length < 2) {
      const suffixMatches = text.match(/([a-z\s]+?)\s+count(?:y|ies)/gi);
      if (suffixMatches && suffixMatches.length >= 2) {
        countyNames = suffixMatches.map(m => m.replace(/\s+count(?:y|ies)/i, '').trim());
      }
    }
    
    // County-vs-county comparison needs two resolved counties; otherwise we
    // fall through to the location (city/town/zip) comparison below.
    const counties = countyNames.length >= 2
      ? countyNames.map(name => csvService.findCounty(name)).filter(Boolean)
      : [];

    // Full latest-year stats per county from the county time series (which
    // carries the complete ALICE/poverty split), falling back to the legacy
    // county file only if the series is missing. Priority is the designation
    // from the county file.
    const statsOf = (c: any) => {
      const ts = typeof csvService.findCountyTimeSeries === 'function'
        ? csvService.findCountyTimeSeries(c.county)
        : undefined;
      if (ts && ts.households > 0) {
        return {
          county: c.county as string,
          households: ts.households,
          aliceCount: ts.alice,
          alicePct: Math.round((ts.alice / ts.households) * 100),
          povertyCount: ts.poverty,
          povertyPct: Math.round((ts.poverty / ts.households) * 100),
          belowThreshold: Math.round(((ts.alice + ts.poverty) / ts.households) * 100),
          year: ts.year,
          priority: Boolean(c.priority),
        };
      }
      return {
        county: c.county as string,
        households: c.households as number,
        aliceCount: c.alice_housholds as number,
        alicePct: c.alice_percentage as number,
        povertyCount: Math.round(c.households * c.poverty / 100),
        povertyPct: c.poverty as number,
        belowThreshold: c.below_alice_percentage as number,
        year: c.year as number,
        priority: Boolean(c.priority),
      };
    };
    // City/town/zip (or mixed place-and-county) comparison.
    if (counties.length < 2) {
      const mentions = findLocationMentions(lowerText, csvService);

      if (mentions.length < 2) {
        const result = {
          text: countyNames.length >= 2
            ? `I couldn't find data for some of the counties you mentioned (${countyNames.join(', ')}). Please check the spelling.`
            : "I need two locations to compare — counties, cities, towns, or zip codes. For example: 'Compare Benton County and Pulaski County' or 'Compare Springdale and Rogers'.",
          success: false
        };
        if (callback) callback(result);
        return result;
      }

      const rows = mentions.slice(0, 4).map(({ entry }) => {
        if (entry.type === 'County') {
          const s = statsOf(entry.dataRef);
          return {
            label: s.county,
            households: s.households,
            aliceCount: s.aliceCount,
            alicePct: s.alicePct,
            povertyCount: s.povertyCount,
            povertyPct: s.povertyPct,
            belowThreshold: s.belowThreshold,
            year: s.year
          };
        }
        const s = entry.dataRef as SubCountyData;
        const pct = (part: number) => (s.households > 0 ? Math.round((part / s.households) * 100) : 0);
        return {
          label: entry.name,
          households: s.households,
          aliceCount: s.alice_households,
          alicePct: pct(s.alice_households),
          povertyCount: s.poverty_households,
          povertyPct: pct(s.poverty_households),
          belowThreshold: pct(s.alice_households + s.poverty_households),
          year: s.year
        };
      });

      const sameYear = rows.every(r => r.year === rows[0].year);
      const isYesNo = /^\s*(?:is|are|does|do|did)\b/i.test(text);
      const wantsThresholdMetric = lowerText.includes('threshold') || lowerText.includes('below alice');

      let response: string;
      if (isYesNo && rows.length >= 2 && (wantsThresholdMetric || lowerText.includes('rate'))) {
        const [first, second] = rows;
        const metric = wantsThresholdMetric
          ? { name: 'below-ALICE-threshold rate', a: first.belowThreshold, b: second.belowThreshold }
          : { name: 'ALICE rate', a: first.alicePct, b: second.alicePct };
        const answer = metric.a > metric.b ? 'Yes' : 'No';
        const relationship = metric.a > metric.b ? 'higher' : metric.a < metric.b ? 'lower' : 'the same';
        const diff = Math.abs(metric.a - metric.b);
        const yearNote = sameYear ? ` (${first.year})` : '';
        response = `${answer}. Using the ${metric.name} in my dataset${yearNote}, ${first.label} is ${relationship} than ${second.label}.\n\n`;
        response += `${first.label}: ${metric.a}%${sameYear ? '' : ` (${first.year})`}\n`;
        response += `${second.label}: ${metric.b}%${sameYear ? '' : ` (${second.year})`}`;
        if (diff > 0) {
          response += `\nDifference: ${diff} percentage points`;
        }
      } else {
        response = sameYear
          ? `Location Comparison (${rows[0].year}, latest available)\n\n`
          : `Location Comparison (each location's latest available year)\n\n`;
        rows.forEach(row => {
          response += `${row.label}:\n`;
          response += `Total households: ${row.households.toLocaleString()}\n`;
          response += `ALICE households: ${row.alicePct}% (${row.aliceCount.toLocaleString()} households)\n`;
          response += `Households in poverty: ${row.povertyPct}% (${row.povertyCount.toLocaleString()} households)\n`;
          response += `Below ALICE threshold: ${row.belowThreshold}% (ALICE + poverty combined)\n`;
          if (!sameYear) {
            response += `Year: ${row.year}\n`;
          }
          response += `\n`;
        });

        response += `Analysis:\n`;
        const hiAlice = rows.reduce((max, r) => (r.alicePct > max.alicePct ? r : max));
        const loAlice = rows.reduce((min, r) => (r.alicePct < min.alicePct ? r : min));
        if (hiAlice !== loAlice) {
          response += `ALICE Rate: ${loAlice.label} has the lower rate at ${loAlice.alicePct}%, compared to ${hiAlice.label} at ${hiAlice.alicePct}% (${hiAlice.alicePct - loAlice.alicePct} percentage point difference).\n`;
        }
        const hiBelow = rows.reduce((max, r) => (r.belowThreshold > max.belowThreshold ? r : max));
        const loBelow = rows.reduce((min, r) => (r.belowThreshold < min.belowThreshold ? r : min));
        if (hiBelow !== loBelow) {
          response += `Total Below Threshold: ${loBelow.label} has ${loBelow.belowThreshold}% below the ALICE threshold, while ${hiBelow.label} has ${hiBelow.belowThreshold}%.\n`;
        }
        const biggest = rows.reduce((max, r) => (r.households > max.households ? r : max));
        const smallest = rows.reduce((min, r) => (r.households < min.households ? r : min));
        if (biggest !== smallest && smallest.households > 0) {
          const ratio = (biggest.households / smallest.households).toFixed(1);
          response += `Size: ${biggest.label} is ${ratio}x larger with ${biggest.households.toLocaleString()} households vs ${smallest.households.toLocaleString()}.\n`;
        }
      }

      const result = { text: response, success: true };
      if (callback) callback(result);
      return result;
    }

    const latestRows = counties.map(c => statsOf(c));
    const comparisonYear = latestRows[0].year;
    const latestOf = (c: any) => statsOf(c);

    const isYesNoComparison = /^\s*(?:is|are|does|do|did)\b/i.test(text);
    const isThresholdComparison = lowerText.includes('threshold') || lowerText.includes('below alice');

    if (isYesNoComparison && isThresholdComparison && counties.length >= 2) {
      const [firstCounty, secondCounty] = counties;
      const first = latestOf(firstCounty);
      const second = latestOf(secondCounty);
      const firstRate = first.belowThreshold;
      const secondRate = second.belowThreshold;
      const answer = firstRate > secondRate ? 'Yes' : 'No';
      const relationship = firstRate > secondRate ? 'higher' : firstRate < secondRate ? 'lower' : 'the same';
      const diff = Math.abs(firstRate - secondRate);
      const yearNote = first.year === second.year ? ` (${first.year})` : '';

      let response =
        `${answer}. Using the county below-ALICE-threshold rate in my dataset${yearNote}, ${firstCounty!.county} is ${relationship} than ${secondCounty!.county}.\n\n`;
      response += `${firstCounty!.county}: ${firstRate}% below the ALICE threshold\n`;
      response += `${secondCounty!.county}: ${secondRate}% below the ALICE threshold`;
      if (diff > 0) {
        response += `\nDifference: ${diff} percentage points`;
      }

      const result = { text: response, success: true };
      if (callback) callback(result);
      return result;
    }
    
    // Build detailed comparison response — every figure from the same
    // (latest) year, labeled once up front.
    let response = `County Comparison Analysis (${comparisonYear}, latest available)\n\n`;

    // Show individual county stats
    latestRows.forEach(row => {
      response += `${row.county}:\n`;
      response += `Total households: ${row.households.toLocaleString()}\n`;
      response += `ALICE households: ${row.alicePct}% (${row.aliceCount.toLocaleString()} households)\n`;
      response += `Households in poverty: ${row.povertyPct}% (${row.povertyCount.toLocaleString()} households)\n`;
      response += `Below ALICE threshold: ${row.belowThreshold}% (ALICE + poverty combined)\n`;
      response += `\n`;
    });

    // Comparative analysis
    response += `Analysis:\n`;

    // Compare ALICE rates
    const highest = latestRows.reduce((max, r) => (r.alicePct > max.alicePct ? r : max));
    const lowest = latestRows.reduce((min, r) => (r.alicePct < min.alicePct ? r : min));

    if (highest !== lowest) {
      const aliceDiff = highest.alicePct - lowest.alicePct;
      response += `ALICE Rate: ${lowest.county} has a better (lower) rate at ${lowest.alicePct}%, compared to ${highest.county} at ${highest.alicePct}% (${aliceDiff} percentage point difference).\n`;
    }

    // Compare total below ALICE threshold
    const highestTotal = latestRows.reduce((max, r) => (r.belowThreshold > max.belowThreshold ? r : max));
    const lowestTotal = latestRows.reduce((min, r) => (r.belowThreshold < min.belowThreshold ? r : min));

    if (highestTotal !== lowestTotal) {
      response += `Total Below Threshold: ${lowestTotal.county} has ${lowestTotal.belowThreshold}% below the ALICE threshold, while ${highestTotal.county} has ${highestTotal.belowThreshold}%.\n`;
    }

    // Compare poverty rates
    const highestPoverty = latestRows.reduce((max, r) => (r.povertyPct > max.povertyPct ? r : max));
    const lowestPoverty = latestRows.reduce((min, r) => (r.povertyPct < min.povertyPct ? r : min));

    if (highestPoverty !== lowestPoverty) {
      const povertyDiff = highestPoverty.povertyPct - lowestPoverty.povertyPct;
      response += `Poverty Rate: ${lowestPoverty.county} has a lower poverty rate at ${lowestPoverty.povertyPct}%, compared to ${highestPoverty.county} at ${highestPoverty.povertyPct}% (${povertyDiff} percentage point difference).\n`;
    }

    // Compare population sizes
    const largestPop = latestRows.reduce((max, r) => (r.households > max.households ? r : max));
    const smallestPop = latestRows.reduce((min, r) => (r.households < min.households ? r : min));

    if (largestPop !== smallestPop) {
      const popRatio = (largestPop.households / smallestPop.households).toFixed(1);
      response += `Population Size: ${largestPop.county} is ${popRatio}x larger with ${largestPop.households.toLocaleString()} households vs ${smallestPop.households.toLocaleString()}.\n`;
    }

    // Priority county status
    const priorityCounties = latestRows.filter(r => r.priority);
    if (priorityCounties.length > 0 && priorityCounties.length < latestRows.length) {
      response += `Priority Status: ${priorityCounties.map(r => r.county).join(', ')} ${priorityCounties.length === 1 ? 'is' : 'are'} designated as priority for state assistance.\n`;
    }
    
    const result = {
      text: response,
      success: true
    };
    
    if (callback) callback(result);
    return result;
  },
  examples: [
    [
      {
        name: "{{user1}}",
        content: { text: "Compare Johnson County vs Lee County" }
      },
      {
        // Placeholders only - real figures must always come from the CSV data
        // at answer time, never from a memorized example.
        name: "Alice",
        content: { text: "According to my data set, here's the comparison:\n\n[County A]: [households from CSV] households, [percent from CSV]% below ALICE threshold\n[County B]: [households from CSV] households, [percent from CSV]% below ALICE threshold\n\n[County B] has the higher rate at [percent from CSV]%, a [difference] percentage point difference ([year from CSV])." }
      }
    ]
  ]
};
