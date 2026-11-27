import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Client } from '@stomp/stompjs';
import { useAuth } from '@/lib/auth';
import { PERMISSIONS } from '@/lib/permissions';
import { tokenStore } from '@/lib/tokenStore';

const RECONNECT_DELAY_MS = 5_000;

type AddEventListener = typeof EventTarget.prototype.addEventListener;
type RemoveEventListener = typeof EventTarget.prototype.removeEventListener;

/**
 * Chrome reports an `unload` permissions-policy violation when sockjs-client is
 * imported. SockJS only uses that listener to flush pending transports, so load
 * it with `unload` translated to the page-lifecycle-safe `pagehide` event and
 * restore the native methods immediately afterwards.
 */
async function importSockJs() {
  const nativeAdd: AddEventListener = EventTarget.prototype.addEventListener;
  const nativeRemove: RemoveEventListener = EventTarget.prototype.removeEventListener;
  const remap = (type: string) => (type === 'unload' ? 'pagehide' : type);

  EventTarget.prototype.addEventListener = function (this: EventTarget, type, listener, options) {
    return nativeAdd.call(this, remap(type), listener, options);
  };
  EventTarget.prototype.removeEventListener = function (this: EventTarget, type, listener, options) {
    return nativeRemove.call(this, remap(type), listener, options);
  };

  try {
    return await import('sockjs-client');
  } finally {
    EventTarget.prototype.addEventListener = nativeAdd;
    EventTarget.prototype.removeEventListener = nativeRemove;
  }
}

/**
 * Browser-side STOMP subscription for notification invalidation.
 *
 * The authenticated REST inbox remains the source of truth and the fallback:
 * polling continues even if this socket cannot connect. The socket only pushes
 * an invalidation so the badge and open inbox refresh immediately.
 */
export function RealtimeNotificationsBridge() {
  const queryClient = useQueryClient();
  const { status, hasPermission } = useAuth();
  const enabled = status === 'authenticated' && hasPermission(PERMISSIONS.NOTIFICATION_READ);

  useEffect(() => {
    if (!enabled) return;

    let stopped = false;
    let connecting = false;
    let client: Client | null = null;
    let reconnectTimer: number | undefined;

    const scheduleReconnect = () => {
      if (stopped || reconnectTimer !== undefined) return;
      reconnectTimer = window.setTimeout(async () => {
        reconnectTimer = undefined;
        if (stopped) return;
        if (!tokenStore.getAccessToken()) await tokenStore.refresh();
        void connect();
      }, RECONNECT_DELAY_MS);
    };

    const connect = async () => {
      if (connecting || stopped) return;
      connecting = true;
      try {
        const token = tokenStore.getAccessToken();
        if (!token) {
          scheduleReconnect();
          return;
        }
        // Loaded only for authenticated users with NOTIFICATION_READ so the
        // public landing bundle does not pay for the STOMP/SockJS client.
        // sockjs-client is a UMD bundle that references `global` in browsers.
        (globalThis as { global?: typeof globalThis }).global ??= globalThis;
        const [{ Client: StompClient }, sockJsModule] = await Promise.all([
          import('@stomp/stompjs'),
          importSockJs(),
        ]);
        const SockJS = sockJsModule.default;
        if (stopped) return;

        client = new StompClient({
          webSocketFactory: () => new SockJS(`${window.location.origin}/ws`),
          connectHeaders: { Authorization: `Bearer ${token}` },
          // Reconnect is handled explicitly so a refreshed token is used on retry.
          reconnectDelay: 0,
          heartbeatIncoming: 10_000,
          heartbeatOutgoing: 10_000,
          onConnect: () => {
            client?.subscribe('/user/queue/notifications', () => {
              void queryClient.invalidateQueries({ queryKey: ['notifications'] });
            });
          },
          onStompError: () => scheduleReconnect(),
          onWebSocketClose: () => scheduleReconnect(),
        });
        client.activate();
      } catch (error) {
        if (import.meta.env.DEV) console.error('[realtime] STOMP connect failed', error);
        scheduleReconnect();
      } finally {
        connecting = false;
      }
    };

    void connect();

    return () => {
      stopped = true;
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
      void client?.deactivate();
    };
  }, [enabled, queryClient]);

  return null;
}
