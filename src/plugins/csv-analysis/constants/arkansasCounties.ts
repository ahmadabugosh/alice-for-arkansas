// Single source of truth for the 75 Arkansas county names (lowercase, no
// "County" suffix). This list used to be pasted into five files; copies
// drifting apart caused real routing bugs, so import it instead of copying.
export const AR_COUNTY_NAMES: readonly string[] = [
  'arkansas', 'ashley', 'baxter', 'benton', 'boone', 'bradley', 'calhoun', 'carroll', 'chicot', 'clark',
  'clay', 'cleburne', 'cleveland', 'columbia', 'conway', 'craighead', 'crawford', 'crittenden', 'cross',
  'dallas', 'desha', 'drew', 'faulkner', 'franklin', 'fulton', 'garland', 'grant', 'greene', 'hempstead',
  'hot spring', 'howard', 'independence', 'izard', 'jackson', 'jefferson', 'johnson', 'lafayette',
  'lawrence', 'lee', 'lincoln', 'little river', 'logan', 'lonoke', 'madison', 'marion', 'miller',
  'mississippi', 'monroe', 'montgomery', 'nevada', 'newton', 'ouachita', 'perry', 'phillips', 'pike',
  'poinsett', 'polk', 'pope', 'prairie', 'pulaski', 'randolph', 'saline', 'scott', 'searcy', 'sebastian',
  'sevier', 'sharp', 'st. francis', 'stone', 'union', 'van buren', 'washington', 'white', 'woodruff', 'yell',
];

// Regex matching one county name in free text. "arkansas" only counts when
// written "Arkansas County/Counties" - bare "arkansas" is the state.
export const countyNameRegex = (county: string): RegExp =>
  county === 'arkansas'
    ? /\barkansas\s+count(?:y|ies)\b/i
    : new RegExp(`\\b${county.replace(/\./g, '\\.')}\\b`, 'i');

export const countyNameInText = (county: string, text: string): boolean =>
  countyNameRegex(county).test(text);
