import { test, expect, describe } from 'bun:test';
import { ProviderRegistry } from '../registry';
import { RemoteProvider } from '../remote-provider';
import type { ProviderEvent, StreamRequest } from '../types';

// A RemoteProvider whose transport is stubbed — proves the registry resolves a
// remote model to the remote provider and streams its events, without a relay.
class StubRemoteProvider extends RemoteProvider {
  override isAvailable(): boolean {
    return true;
  }
  override async *streamResponse(_request: StreamRequest): AsyncGenerator<ProviderEvent> {
    yield { type: 'content_delta', content: 'hello ' };
    yield { type: 'content_delta', content: 'from host' };
    yield { type: 'complete', finishReason: 'end_turn' };
  }
}

describe('RemoteProvider registry integration', () => {
  test('a remote model resolves to the remote provider and streams', async () => {
    const registry = new ProviderRegistry();
    const remote = new StubRemoteProvider({
      id: 'remote-google',
      label: "Friend's PC · Google",
      hostProvider: 'google',
      models: [
        {
          id: 'gemini-3.1-pro',
          name: 'Gemini 3.1 Pro',
          provider: 'remote-google' as never,
          contextWindow: 1_000_000,
          maxOutputTokens: 64_000,
        },
      ],
    });
    registry.registerRemoteProvider(remote);

    // The client has NO local google — picking the model with the remote
    // provider preferred must resolve to the remote provider.
    const resolved = registry.resolveProvider('gemini-3.1-pro', 'remote-google' as never);
    expect(resolved?.name).toBe('remote-google');

    const events: ProviderEvent[] = [];
    for await (const ev of registry.executeWithRetry(
      {
        model: 'gemini-3.1-pro',
        messages: [{ role: 'user', content: 'hi' }],
        systemPrompt: '',
      },
      'remote-google' as never,
    )) {
      events.push(ev);
    }
    const text = events
      .filter((e) => e.type === 'content_delta')
      .map((e) => e.content)
      .join('');
    expect(text).toBe('hello from host');
    expect(events.some((e) => e.type === 'complete')).toBe(true);
  });

  test('clearRemoteProviders removes only remote-* providers', () => {
    const registry = new ProviderRegistry();
    registry.registerRemoteProvider(
      new StubRemoteProvider({
        id: 'remote-codex',
        label: 'Host · Codex',
        hostProvider: 'codex',
        models: [
          { id: 'gpt-5.6-sol', name: 'GPT 5.6 Sol', provider: 'remote-codex' as never, contextWindow: 400_000, maxOutputTokens: 128_000 },
        ],
      }),
    );
    expect(registry.get('remote-codex' as never)).toBeDefined();
    registry.clearRemoteProviders();
    expect(registry.get('remote-codex' as never)).toBeUndefined();
  });
});
