import { describe, expect, it } from 'bun:test';
import { aliceActions, aliceActionNames } from '../plugins/csv-analysis/actions/index';
import plugin from '../plugin';
import { ChatApiService } from '../services/chatApiService';
import { CsvDataService } from '../plugins/csv-analysis/services/csvDataService';

const svc = new CsvDataService();
svc.initialize();

describe('shared action registry', () => {
  it('registers the exact same actions (and order) in the ElizaOS plugin', () => {
    const pluginNames = (plugin.actions || []).map((a) => a.name);
    expect(pluginNames).toEqual(aliceActionNames);
  });

  it('includes the budget and explain actions', () => {
    expect(aliceActionNames).toContain('Searching ALICE budget data...');
    expect(aliceActionNames).toContain('Explaining ALICE concept...');
    expect(aliceActionNames[0]).toBe('Explaining ALICE concept...');
  });
});

describe('WordPress /api/chat path (ChatApiService)', () => {
  const runtime: any = { agentId: '00000000-0000-4000-8000-000000000000', csvDataService: svc, actions: [] };
  const chat = new ChatApiService(runtime);

  it('answers budget questions with real CSV data (previously unreachable)', async () => {
    const r = await chat.processChatMessage('sess-budget-1', 'How much does a single adult need to live?');
    expect(r.success).toBe(true);
    expect(r.message).toContain('Survival Budget');
    expect(r.message).toContain('$2,273');
  });

  it('answers county data questions from CSV', async () => {
    const r = await chat.processChatMessage('sess-county-1', 'What percent of Pulaski County is ALICE?');
    expect(r.success).toBe(true);
    expect(r.message).toContain('Pulaski County');
    expect(r.message).toContain('42,754');
    expect(r.message).toContain('Year: 2024 (latest available)');
  });

  it('gives the full latest-year breakdown for a county, no earlier-year detail', async () => {
    const r = await chat.processChatMessage('sess-county-2', 'Tell me about ALICE in Washington County.');
    expect(r.success).toBe(true);
    expect(r.message).toContain('Washington County');
    expect(r.message).toContain('ALICE households: 25% (25,168 households)');
    expect(r.message).toContain('Households in poverty: 13% (12,866 households)');
    expect(r.message).toContain('Year: 2024 (latest available)');
    expect(r.message).not.toContain('2023');
  });

  it('routes "ALICE in Arkansas" to statewide (never Arkansas County) with latest-year data', async () => {
    const r = await chat.processChatMessage('sess-state-1', 'Tell me about ALICE in Arkansas');
    expect(r.success).toBe(true);
    expect(r.message).toContain('Arkansas statewide ALICE overview for 2024 (latest available)');
    expect(r.message).toContain('1,232,610');
    expect(r.message).not.toContain('Arkansas County');
  });

  it('routes bare "Tell me about Arkansas" to statewide too', async () => {
    const r = await chat.processChatMessage('sess-state-2', 'Tell me about Arkansas');
    expect(r.success).toBe(true);
    expect(r.message).toContain('Arkansas statewide ALICE overview for 2024 (latest available)');
    expect(r.message).not.toContain('Arkansas County');
  });

  it('answers "how many" statewide questions (word-boundary keyword fix)', async () => {
    const r = await chat.processChatMessage('sess-state-3', 'How many households are in poverty in Arkansas?');
    expect(r.success).toBe(true);
    expect(r.message).toContain('Households in Poverty: 196,766');
    expect(r.message).toContain('2024 (latest available)');
  });
});
