import { useCallback } from 'react';
import type { AIMessage } from '@shared/types';
import type { ProactiveEvent } from '../store/proactiveEventStore';
import {
  buildBrowserScanHint,
  buildContainerRunningHint,
  buildPortDiscoveryHint,
  buildServiceDiscoveryHint,
  buildTargetSetHint,
  buildVPNConnectedHint,
  buildWorkspaceLootHint,
} from '../lib/proactiveHints';

type AppendProactiveMessage = (
  content: string,
  variant?: Exclude<AIMessage['variant'], 'chat'>,
  options?: {
    eventKey?: string;
    cooldownMs?: number;
    actions?: import('@shared/types').AIMessageAction[];
  }
) => void;

interface UseProactiveAIOptions {
  appendProactiveMessage: AppendProactiveMessage;
  onOpenPanel?: () => void;
}

export function useProactiveAI({
  appendProactiveMessage,
  onOpenPanel,
}: UseProactiveAIOptions) {
  const publishEvent = useCallback((event: ProactiveEvent) => {
    switch (event.type) {
      case 'target_set': {
        appendProactiveMessage(
          buildTargetSetHint(event.target),
          'suggestion',
          { eventKey: `target:${event.target}`, cooldownMs: 300000, actions: event.actions }
        );
        onOpenPanel?.();
        return;
      }

      case 'ports_discovered': {
        const signature = `${event.context.primaryTarget}|${event.context.discoveredPorts.join(',')}`;
        const hint = buildPortDiscoveryHint(event.context);
        if (!hint) return;
        appendProactiveMessage(
          hint,
          'proactive',
          { eventKey: `ports:${signature}`, cooldownMs: 180000, actions: event.actions }
        );
        onOpenPanel?.();
        return;
      }

      case 'services_discovered': {
        const signature = `${event.context.primaryTarget}|${event.context.scannedServices.join('|')}`;
        const hint = buildServiceDiscoveryHint(event.context);
        if (!hint) return;
        appendProactiveMessage(
          hint,
          'proactive',
          { eventKey: `services:${signature}`, cooldownMs: 180000, actions: event.actions }
        );
        onOpenPanel?.();
        return;
      }

      case 'browser_scanned': {
        appendProactiveMessage(
          buildBrowserScanHint(event.url, event.content),
          'proactive',
          { eventKey: `browser-scan:${event.url}`, cooldownMs: 90000 }
        );
        onOpenPanel?.();
        return;
      }

      case 'vpn_connected': {
        appendProactiveMessage(
          buildVPNConnectedHint(event.ip),
          'suggestion',
          { eventKey: `vpn:connected:${event.ip ?? 'unknown'}`, cooldownMs: 300000, actions: event.actions }
        );
        onOpenPanel?.();
        return;
      }

      case 'container_running': {
        appendProactiveMessage(
          buildContainerRunningHint(),
          'suggestion',
          { eventKey: 'container:running', cooldownMs: 300000, actions: event.actions }
        );
        onOpenPanel?.();
        return;
      }

      case 'workspace_loot_added': {
        appendProactiveMessage(
          buildWorkspaceLootHint(event.fileName),
          'proactive',
          { eventKey: `workspace:file:${event.fileName}`, cooldownMs: 180000, actions: event.actions }
        );
        onOpenPanel?.();
        return;
      }
    }
  }, [appendProactiveMessage, onOpenPanel]);

  return {
    publishEvent,
  };
}
