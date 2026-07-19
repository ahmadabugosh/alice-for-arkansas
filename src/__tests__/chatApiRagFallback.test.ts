import { describe, expect, it } from 'bun:test';
import { ChatApiService } from '../services/chatApiService';
import { CsvDataService } from '../plugins/csv-analysis/services/csvDataService';

const svc = new CsvDataService();
svc.initialize();

const NARRATIVE_Q = 'Why do so many working families struggle financially?';

function makeRuntime(extra: any = {}) {
  return {
    agentId: '00000000-0000-4000-8000-000000000000',
    csvDataService: svc,
    actions: [],
    ...extra,
  } as any;
}

describe('WordPress /api/chat — RAG fallback guard rails', () => {
  it('falls back to the capability menu when no knowledge service exists', async () => {
    const chat = new ChatApiService(makeRuntime());
    const r = await chat.processChatMessage('rag-1', NARRATIVE_Q);
    expect(r.success).toBe(true);
    expect(r.message).toContain("I'm here to help with ALICE");
  });

  it('falls back to the menu when the knowledge service throws', async () => {
    const chat = new ChatApiService(
      makeRuntime({
        getService: () => ({ getKnowledge: async () => { throw new Error('no embeddings provider'); } }),
      })
    );
    const r = await chat.processChatMessage('rag-2', NARRATIVE_Q);
    expect(r.success).toBe(true);
    expect(r.message).toContain("I'm here to help with ALICE");
  });

  it('answers from knowledge fragments via the model when available', async () => {
    const chat = new ChatApiService(
      makeRuntime({
        getService: () => ({
          getKnowledge: async () => [
            { content: { text: 'Households below the ALICE Threshold are forced to make impossible choices, like deciding whether to pay for utilities or food.' } },
          ],
        }),
        useModel: async (_type: string, _opts: any) =>
          'ALICE households earn above the poverty level but below the cost of basics, forcing impossible choices between essentials like utilities and food.',
      })
    );
    const r = await chat.processChatMessage('rag-3', NARRATIVE_Q);
    expect(r.success).toBe(true);
    expect(r.message).toContain('impossible choices');
    expect(r.message).not.toContain("I'm here to help with ALICE");
  });

  it('never routes data questions to RAG (CSV actions answer first)', async () => {
    const chat = new ChatApiService(
      makeRuntime({
        getService: () => ({ getKnowledge: async () => { throw new Error('should not be called'); } }),
      })
    );
    const r = await chat.processChatMessage('rag-4', 'What percent of Pulaski County is ALICE?');
    expect(r.success).toBe(true);
    expect(r.message).toContain('46,080');
  });
});
