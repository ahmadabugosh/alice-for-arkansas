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
    expect(r.message).toContain('46,080');
  });
});
