import { Action } from '@elizaos/core';
import { explainAliceAction } from './explainAlice';
import { searchBudgetAction } from './searchBudget';
import { searchStatewideAction } from './searchStatewide';
import { searchDemographicsAction } from './searchDemographics';
import { searchEmploymentAction } from './searchEmployment';
import { analyzeTrendsAction } from './analyzeTrends';
import { rankCountiesAction } from './rankCounties';
import { compareCountiesAction } from './compareCounties';
import { searchCountyAction } from './searchCounty';

/**
 * The single, ordered registry of Alice's CSV data actions.
 *
 * Every surface that answers ALICE questions (the ElizaOS plugin, the
 * WordPress /api/chat endpoint, tests) MUST use this array so they can never
 * drift apart. Order matters: validation is attempted top to bottom.
 */
export const aliceActions: Action[] = [
  explainAliceAction, // MUST BE FIRST to handle "tell me about ALICE" concept queries
  searchBudgetAction, // BEFORE demographics/statewide so "how much to live"/"single adult" budget queries aren't intercepted
  searchStatewideAction, // BEFORE county action so it doesn't match bare "Arkansas"
  searchDemographicsAction,
  searchEmploymentAction,
  analyzeTrendsAction,
  rankCountiesAction, // BEFORE searchCounty to prevent county action from intercepting ranking queries
  compareCountiesAction,
  searchCountyAction,
];

/** Names of the registered actions, in priority order. */
export const aliceActionNames: string[] = aliceActions.map((a) => a.name);
