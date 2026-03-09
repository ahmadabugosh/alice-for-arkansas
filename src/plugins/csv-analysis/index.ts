import { Plugin } from '@elizaos/core';
import { searchCountyAction } from './actions/searchCounty';
import { compareCountiesAction } from './actions/compareCounties';
import { rankCountiesAction } from './actions/rankCounties';
import { analyzeTrendsAction } from './actions/analyzeTrends';
import { searchEmploymentAction } from './actions/searchEmployment';
import { searchDemographicsAction } from './actions/searchDemographics';
import { searchStatewideAction } from './actions/searchStatewide';
// import { searchSubCountyAction } from './actions/searchSubCounty'; // Temporarily disabled - functionality moved to searchCounty

console.error('*** CSV PLUGIN LOADING ***');
console.error('*** Imported actions:', {
  searchStatewide: !!searchStatewideAction,
  searchDemographics: !!searchDemographicsAction,
  searchEmployment: !!searchEmploymentAction,
  analyzeTrends: !!analyzeTrendsAction,
  compareCounties: !!compareCountiesAction,
  rankCounties: !!rankCountiesAction,
  searchCounty: !!searchCountyAction
});

const actions = [
  searchStatewideAction, // Must be FIRST to prevent county action from matching "Arkansas"
  searchDemographicsAction,
  searchEmploymentAction,
  analyzeTrendsAction,
  compareCountiesAction, // Must be BEFORE searchCountyAction to catch comparison queries
  rankCountiesAction, // Must be BEFORE searchCountyAction to catch ranking queries
  searchCountyAction,
  // searchSubCountyAction // Temporarily disabled - functionality moved to searchCounty
];

console.error('*** Total actions in array:', actions.length);
console.error('*** Action names:', actions.map(a => a.name));

export const csvAnalysisPlugin: Plugin = {
  name: 'csv-analysis',
  description: 'Arkansas ALICE data analysis using CSV files for precise data retrieval',
  actions,
  evaluators: [],
  providers: [],
  services: []
};

export default csvAnalysisPlugin;
