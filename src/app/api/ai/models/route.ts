import { NextResponse } from 'next/server';

interface OpenRouterModel {
  id: string;
  name?: string;
  context_length?: number;
  created?: number;
  top_provider?: {
    max_completion_tokens?: number;
  };
  popularity?: number;
  performance?: number;
  pricing?: {
    prompt?: string;
    completion?: string;
  };
}

interface OpenRouterModelsResponse {
  data?: OpenRouterModel[];
}

function parsePrice(value: string | undefined): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

export async function GET() {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch models' }, { status: response.status });
    }

    const data = (await response.json()) as OpenRouterModelsResponse;
    const rawModels = data.data || [];

    const models = rawModels
      .filter((model) => typeof model.id === 'string' && model.id.length > 0)
      .map((model) => {
        const promptPrice = parsePrice(model.pricing?.prompt);
        const completionPrice = parsePrice(model.pricing?.completion);
        const idLower = model.id.toLowerCase();
        const nameLower = (model.name || '').toLowerCase();
        const taggedFree = idLower.includes(':free') || nameLower.includes('(free)');
        const zeroPrice = promptPrice === 0 && completionPrice === 0;
        const isFree = taggedFree || zeroPrice;

        return {
          id: model.id,
          name: model.name || model.id,
          isFree,
          promptPrice: Number.isFinite(promptPrice) ? promptPrice : null,
          completionPrice: Number.isFinite(completionPrice) ? completionPrice : null,
          totalCost:
            Number.isFinite(promptPrice) && Number.isFinite(completionPrice)
              ? promptPrice + completionPrice
              : null,
          contextLength:
            typeof model.context_length === 'number' && Number.isFinite(model.context_length)
              ? model.context_length
              : null,
          maxCompletionTokens:
            typeof model.top_provider?.max_completion_tokens === 'number' &&
            Number.isFinite(model.top_provider.max_completion_tokens)
              ? model.top_provider.max_completion_tokens
              : null,
          popularity:
            typeof model.popularity === 'number' && Number.isFinite(model.popularity)
              ? model.popularity
              : null,
          performance:
            typeof model.performance === 'number' && Number.isFinite(model.performance)
              ? model.performance
              : null,
          created:
            typeof model.created === 'number' && Number.isFinite(model.created)
              ? model.created
              : null,
        };
      })
      .sort((a, b) => a.id.localeCompare(b.id));

    return NextResponse.json({
      models,
      freeModels: models.filter((model) => model.isFree),
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to load OpenRouter models:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

