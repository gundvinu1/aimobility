'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { DISPATCH_EVENTS, TRACKING_NAMESPACE } from '@ai-mos/constants';

export type DispatchConnectionStatus = 'LIVE' | 'CONNECTING' | 'DISCONNECTED' | 'RECONNECTING';

interface UseDispatchSocketOptions {
  companyId?: string;
  accessToken?: string | null;
  enabled?: boolean;
  onTripAssigned?: (_data: any) => void;
  onTripUnassigned?: (_data: any) => void;
  onTripDispatched?: (_data: any) => void;
  onTripStatusUpdated?: (_data: any) => void;
  onStopUpdated?: (_data: any) => void;
  onEtaUpdated?: (_data: any) => void;
  onAnyDispatchEvent?: () => void;
}

export function useDispatchSocket({
  companyId,
  accessToken,
  enabled = true,
  onTripAssigned,
  onTripUnassigned,
  onTripDispatched,
  onTripStatusUpdated,
  onStopUpdated,
  onEtaUpdated,
  onAnyDispatchEvent,
}: UseDispatchSocketOptions) {
  const [connectionStatus, setConnectionStatus] = useState<DispatchConnectionStatus>('DISCONNECTED');
  const [lastEventTime, setLastEventTime] = useState<Date | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const onTripAssignedRef = useRef(onTripAssigned);
  const onTripUnassignedRef = useRef(onTripUnassigned);
  const onTripDispatchedRef = useRef(onTripDispatched);
  const onTripStatusUpdatedRef = useRef(onTripStatusUpdated);
  const onStopUpdatedRef = useRef(onStopUpdated);
  const onEtaUpdatedRef = useRef(onEtaUpdated);
  const onAnyDispatchEventRef = useRef(onAnyDispatchEvent);

  useEffect(() => {
    onTripAssignedRef.current = onTripAssigned;
    onTripUnassignedRef.current = onTripUnassigned;
    onTripDispatchedRef.current = onTripDispatched;
    onTripStatusUpdatedRef.current = onTripStatusUpdated;
    onStopUpdatedRef.current = onStopUpdated;
    onEtaUpdatedRef.current = onEtaUpdated;
    onAnyDispatchEventRef.current = onAnyDispatchEvent;
  });

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setConnectionStatus('DISCONNECTED');
    }
  }, []);

  useEffect(() => {
    if (!enabled || !companyId || !accessToken) {
      disconnect();
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    setConnectionStatus('CONNECTING');

    const socket = io(`${apiUrl}${TRACKING_NAMESPACE}`, {
      auth: {
        token: accessToken,
        companyId,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnectionStatus('LIVE');
      socket.emit('subscribe:fleet', { companyId });
    });

    socket.on('reconnect_attempt', () => {
      setConnectionStatus('RECONNECTING');
    });

    socket.on('disconnect', (reason) => {
      if (reason === 'io client disconnect') {
        setConnectionStatus('DISCONNECTED');
      } else {
        setConnectionStatus('RECONNECTING');
      }
    });

    socket.on('connect_error', () => {
      setConnectionStatus('RECONNECTING');
    });

    socket.on(DISPATCH_EVENTS.TRIP_ASSIGNED, (data) => {
      setLastEventTime(new Date());
      onTripAssignedRef.current?.(data);
      onAnyDispatchEventRef.current?.();
    });

    socket.on(DISPATCH_EVENTS.TRIP_UNASSIGNED, (data) => {
      setLastEventTime(new Date());
      onTripUnassignedRef.current?.(data);
      onAnyDispatchEventRef.current?.();
    });

    socket.on(DISPATCH_EVENTS.TRIP_DISPATCHED, (data) => {
      setLastEventTime(new Date());
      onTripDispatchedRef.current?.(data);
      onAnyDispatchEventRef.current?.();
    });

    socket.on(DISPATCH_EVENTS.TRIP_STATUS_UPDATED, (data) => {
      setLastEventTime(new Date());
      onTripStatusUpdatedRef.current?.(data);
      onAnyDispatchEventRef.current?.();
    });

    socket.on(DISPATCH_EVENTS.STOP_UPDATED, (data) => {
      setLastEventTime(new Date());
      onStopUpdatedRef.current?.(data);
      onAnyDispatchEventRef.current?.();
    });

    socket.on(DISPATCH_EVENTS.ETA_UPDATED, (data) => {
      setLastEventTime(new Date());
      onEtaUpdatedRef.current?.(data);
      onAnyDispatchEventRef.current?.();
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnectionStatus('DISCONNECTED');
    };
  }, [enabled, companyId, accessToken, disconnect]);

  return {
    connectionStatus,
    lastEventTime,
    isConnected: connectionStatus === 'LIVE',
  };
}
