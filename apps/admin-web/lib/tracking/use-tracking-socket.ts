'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { TRACKING_EVENTS, TRACKING_NAMESPACE, ALERT_EVENTS } from '@ai-mos/constants';
import type {
  FleetSnapshotDto,
  VehicleLocationUpdatedEvent,
  VehicleStatusUpdatedEvent,
  FleetAlertDto,
} from '@ai-mos/types';

export type TrackingConnectionStatus = 'LIVE' | 'CONNECTING' | 'DISCONNECTED' | 'RECONNECTING';

interface UseTrackingSocketOptions {
  companyId?: string;
  accessToken?: string | null;
  enabled?: boolean;
  onLocationUpdated?: (_data: VehicleLocationUpdatedEvent['data']) => void;
  onStatusUpdated?: (_data: VehicleStatusUpdatedEvent['data']) => void;
  onFleetSnapshot?: (_snapshot: FleetSnapshotDto) => void;
  onAlertCreated?: (_alert: FleetAlertDto) => void;
  onAlertUpdated?: (_alert: FleetAlertDto) => void;
  onAlertAcknowledged?: (_alert: FleetAlertDto) => void;
  onAlertResolved?: (_alert: FleetAlertDto) => void;
}

export function useTrackingSocket({
  companyId,
  accessToken,
  enabled = true,
  onLocationUpdated,
  onStatusUpdated,
  onFleetSnapshot,
  onAlertCreated,
  onAlertUpdated,
  onAlertAcknowledged,
  onAlertResolved,
}: UseTrackingSocketOptions) {
  const [connectionStatus, setConnectionStatus] = useState<TrackingConnectionStatus>('DISCONNECTED');
  const [lastEventTime, setLastEventTime] = useState<Date | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // Store callbacks in refs to avoid socket re-init on handler changes
  const onLocationUpdatedRef = useRef(onLocationUpdated);
  const onStatusUpdatedRef = useRef(onStatusUpdated);
  const onFleetSnapshotRef = useRef(onFleetSnapshot);
  const onAlertCreatedRef = useRef(onAlertCreated);
  const onAlertUpdatedRef = useRef(onAlertUpdated);
  const onAlertAcknowledgedRef = useRef(onAlertAcknowledged);
  const onAlertResolvedRef = useRef(onAlertResolved);

  useEffect(() => {
    onLocationUpdatedRef.current = onLocationUpdated;
  }, [onLocationUpdated]);

  useEffect(() => {
    onStatusUpdatedRef.current = onStatusUpdated;
  }, [onStatusUpdated]);

  useEffect(() => {
    onFleetSnapshotRef.current = onFleetSnapshot;
  }, [onFleetSnapshot]);

  useEffect(() => {
    onAlertCreatedRef.current = onAlertCreated;
  }, [onAlertCreated]);

  useEffect(() => {
    onAlertUpdatedRef.current = onAlertUpdated;
  }, [onAlertUpdated]);

  useEffect(() => {
    onAlertAcknowledgedRef.current = onAlertAcknowledged;
  }, [onAlertAcknowledged]);

  useEffect(() => {
    onAlertResolvedRef.current = onAlertResolved;
  }, [onAlertResolved]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setConnectionStatus('DISCONNECTED');
  }, []);

  const connect = useCallback(() => {
    if (!enabled || !companyId || !accessToken) {
      return;
    }

    if (socketRef.current) {
      socketRef.current.disconnect();
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
      reconnectionAttempts: 15,
      reconnectionDelay: 1500,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnectionStatus('LIVE');
      setLastEventTime(new Date());

      // Subscribe to active company's fleet channel
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

    // Real-time Event Handlers
    socket.on(TRACKING_EVENTS.VEHICLE_LOCATION_UPDATED, (data: VehicleLocationUpdatedEvent['data']) => {
      setLastEventTime(new Date());
      onLocationUpdatedRef.current?.(data);
    });

    socket.on(TRACKING_EVENTS.VEHICLE_STATUS_UPDATED, (data: VehicleStatusUpdatedEvent['data']) => {
      setLastEventTime(new Date());
      onStatusUpdatedRef.current?.(data);
    });

    socket.on(TRACKING_EVENTS.FLEET_SNAPSHOT, (snapshot: FleetSnapshotDto) => {
      setLastEventTime(new Date());
      onFleetSnapshotRef.current?.(snapshot);
    });

    // Module 10 — Fleet Alert Events
    socket.on(ALERT_EVENTS.FLEET_ALERT_CREATED, (alert: FleetAlertDto) => {
      setLastEventTime(new Date());
      onAlertCreatedRef.current?.(alert);
    });

    socket.on(ALERT_EVENTS.FLEET_ALERT_UPDATED, (alert: FleetAlertDto) => {
      setLastEventTime(new Date());
      onAlertUpdatedRef.current?.(alert);
    });

    socket.on(ALERT_EVENTS.FLEET_ALERT_ACKNOWLEDGED, (alert: FleetAlertDto) => {
      setLastEventTime(new Date());
      onAlertAcknowledgedRef.current?.(alert);
    });

    socket.on(ALERT_EVENTS.FLEET_ALERT_RESOLVED, (alert: FleetAlertDto) => {
      setLastEventTime(new Date());
      onAlertResolvedRef.current?.(alert);
    });

    socket.on('error', (err: { message: string }) => {
      // eslint-disable-next-line no-console
      console.warn('[TrackingSocket] Server error:', err.message);
    });
  }, [enabled, companyId, accessToken]);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    connectionStatus,
    lastEventTime,
    isConnected: connectionStatus === 'LIVE',
    reconnect: connect,
    disconnect,
  };
}
