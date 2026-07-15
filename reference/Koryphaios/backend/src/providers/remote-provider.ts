/**
 * RemoteProvider — a provider whose inference runs on a REMOTE host.
 *
 * It implements the exact same `Provider` interface as every local provider,
 * so the manager treats it identically: it still owns the agent/tool loop and
 * runs tools on THIS machine's filesystem. Only `streamResponse` is remote —
 * it serializes the request, ships it to the host over the relay, and re-yields
 * the ProviderEvents the host streams back.
 *
 * This is the mechanism behind "use my friend's models on my own PC".
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, isAbsolute } from 'node:path';
import type { ModelDef, ProviderConfig, ProviderName } from '@koryphaios/shared';
import type { Provider, ProviderEvent, StreamRequest } from './types';
import { relayGuestClient } from '../collaboration/relay-guest-client';
import { scanProject, buildSync, newSyncState, type SyncState } from '../collaboration/project-sync';
import { serverLog } from '../logger';

const log = serverLog.child({ module: 'remote-provider' });

export interface RemoteProviderInit {
  /** Namespaced id, e.g. "remote-google". Unique in the client's registry. */
  id: string;
  /** Human label including the host, e.g. "Micah's PC · Google". */
  label: string;
  /** The provider name ON THE HOST (what the host must be asked to run). */
  hostProvider: string;
  /** CLI-harness provider: runs tools in the host sandbox; project is synced
   *  up and file edits are written back to the client's disk. */
  agentic: boolean;
  models: ModelDef[];
}

export class RemoteProvider implements Provider {
  readonly name: ProviderName;
  readonly config: ProviderConfig;
  readonly agentic: boolean;
  private readonly hostProvider: string;
  private readonly models: ModelDef[];
  // Per-project sync state so agentic turns ship only deltas after the first.
  private readonly syncStates = new Map<string, SyncState>();

  constructor(init: RemoteProviderInit) {
    this.name = init.id as ProviderName;
    this.hostProvider = init.hostProvider;
    this.agentic = init.agentic;
    this.models = init.models;
    this.config = {
      name: init.id as ProviderName,
      custom: true,
      label: init.label,
      models: init.models.map((m) => m.id),
      selectedModels: init.models.map((m) => m.id),
      hideModelSelector: false,
      disabled: false,
      // A remote provider needs no local credential — the host holds it.
      deployment: 'cloud',
    } as ProviderConfig;
  }

  isAvailable(): boolean {
    // Available exactly while we hold a live connection to the host.
    return relayGuestClient.isConnected;
  }

  listModels(): ModelDef[] {
    return this.models;
  }

  async *streamResponse(request: StreamRequest): AsyncGenerator<ProviderEvent> {
    if (!relayGuestClient.isConnected) {
      yield { type: 'error', error: 'Not connected to the host that serves this model.' };
      return;
    }

    // Pure-inference (API) providers: the host never sees the client's files.
    if (!this.agentic) {
      const payload = {
        provider: this.hostProvider,
        model: request.model,
        messages: request.messages,
        systemPrompt: request.systemPrompt,
        tools: request.tools,
        maxTokens: request.maxTokens,
        temperature: request.temperature,
        reasoningLevel: request.reasoningLevel,
        agentic: false,
      };
      yield* relayGuestClient.requestInference(payload, request.signal);
      return;
    }

    // Agentic (CLI-harness) providers: the CLI runs in a host-side sandbox, so
    // the client's project is synced up and file edits are written back here.
    const projectRoot = request.workingDirectory?.trim();
    if (!projectRoot) {
      yield { type: 'error', error: 'Remote CLI models need an open project to run against.' };
      return;
    }

    let projectSync;
    try {
      const scanned = await scanProject(projectRoot);
      const state = this.syncStates.get(projectRoot) ?? newSyncState();
      projectSync = buildSync(scanned, state);
      this.syncStates.set(projectRoot, state);
      log.info(
        { provider: this.name, mode: projectSync.mode, files: projectSync.files.length, deletes: projectSync.deletes.length },
        'Synced project to host sandbox',
      );
    } catch (err) {
      yield { type: 'error', error: `Could not package your project to send to the host: ${err instanceof Error ? err.message : String(err)}` };
      return;
    }

    const payload = {
      provider: this.hostProvider,
      model: request.model,
      messages: request.messages,
      systemPrompt: request.systemPrompt,
      tools: request.tools,
      maxTokens: request.maxTokens,
      temperature: request.temperature,
      reasoningLevel: request.reasoningLevel,
      agentic: true,
      projectSync,
    };

    for await (const event of relayGuestClient.requestInference(payload, request.signal)) {
      // A file the host's CLI just edited: write it to the CLIENT's real
      // project (the host sent a path relative to its sandbox root).
      if (event.type === 'file_edit' && event.filePath && typeof event.fileContent === 'string') {
        try {
          const rel = event.filePath;
          if (!isAbsolute(rel) && !rel.includes('..')) {
            const dest = join(projectRoot, rel);
            await mkdir(dirname(dest), { recursive: true });
            await writeFile(dest, event.fileContent, 'utf-8');
            // Reflect the applied edit in our sync state so it isn't re-sent.
            this.syncStates.get(projectRoot)?.sent.set(rel, Date.now());
          }
        } catch (err) {
          log.warn({ err, path: event.filePath }, 'Failed to apply remote edit locally');
        }
      }
      yield event;
    }
  }
}
