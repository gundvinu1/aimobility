import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { TokenService } from '../auth/services/token.service';
import { DatabaseService } from '../database/database.service';
import { TelemetryService } from './telemetry.service';
import {
  TRACKING_NAMESPACE,
  TRACKING_EVENTS,
  COMPANY_HEADER,
  ROLE_PERMISSIONS,
  TRACKING_PERMISSIONS,
  ALERT_EVENTS,
  DISPATCH_EVENTS,
} from '@ai-mos/constants';
import type {
  VehicleLocationUpdatedEvent,
  VehicleStatusUpdatedEvent,
  FleetSnapshotDto,
  FleetAlertDto,
} from '@ai-mos/types';

interface AuthenticatedClientData {
  userId: string;
  companyId: string;
  isSuperAdmin: boolean;
  tenantRole: string;
  permissions: string[];
}

@Injectable()
@WebSocketGateway({
  namespace: TRACKING_NAMESPACE,
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class TelemetryGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(TelemetryGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly tokenService: TokenService,
    private readonly db: DatabaseService,
    @Inject(forwardRef(() => TelemetryService))
    private readonly telemetryService: TelemetryService,
  ) {}

  // ─── Connection Lifecycle ──────────────────────────────────────────────────

  async handleConnection(client: Socket): Promise<void> {
    try {
      // 1. Extract Bearer token
      const authHeader =
        (client.handshake.auth?.token as string | undefined) ??
        (client.handshake.headers?.authorization as string | undefined) ??
        (client.handshake.query?.token as string | undefined);

      if (!authHeader) {
        this.logger.warn(`WS connection rejected: Missing auth token from ${client.id}`);
        client.emit('error', { message: 'Authentication token required' });
        client.disconnect(true);
        return;
      }

      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
      const payload = this.tokenService.verifyAccessToken(token);
      if (!payload || !payload.sub) {
        this.logger.warn(`WS connection rejected: Invalid access token from ${client.id}`);
        client.emit('error', { message: 'Invalid or expired access token' });
        client.disconnect(true);
        return;
      }

      const userId = payload.sub;

      // 2. Extract requested company ID
      const companyId =
        (client.handshake.auth?.companyId as string | undefined) ??
        (client.handshake.headers?.[COMPANY_HEADER.toLowerCase()] as string | undefined) ??
        (client.handshake.headers?.[COMPANY_HEADER] as string | undefined) ??
        (client.handshake.query?.companyId as string | undefined);

      if (!companyId) {
        this.logger.warn(`WS connection rejected: Missing company context from ${client.id}`);
        client.emit('error', { message: 'Company context required' });
        client.disconnect(true);
        return;
      }

      // 3. Verify user and company membership
      const user = await this.db.user.findUnique({
        where: { id: userId },
        include: {
          roles: {
            include: {
              role: {
                include: {
                  permissions: { include: { permission: true } },
                },
              },
            },
          },
        },
      });

      if (!user || user.deletedAt || user.status !== 'ACTIVE') {
        this.logger.warn(`WS connection rejected: User ${userId} is inactive or not found`);
        client.emit('error', { message: 'User inactive or not found' });
        client.disconnect(true);
        return;
      }

      const isSuperAdmin = user.roles.some((r) => r.role.name === 'SUPER_ADMIN');

      let tenantRole = 'MEMBER';
      if (!isSuperAdmin) {
        const membership = await this.db.userCompany.findFirst({
          where: { userId, companyId, status: 'ACTIVE' },
        });

        if (!membership) {
          this.logger.warn(`WS connection rejected: User ${userId} has no active membership in company ${companyId}`);
          client.emit('error', { message: 'Tenant access forbidden' });
          client.disconnect(true);
          return;
        }
        tenantRole = membership.role;
      } else {
        tenantRole = 'OWNER';
      }

      // 4. Resolve permissions
      const rolePerms = ROLE_PERMISSIONS[tenantRole] ?? [];
      const userCustomPerms = user.roles.flatMap((r) =>
        r.role.permissions.map((p) => p.permission.name),
      );
      const effectivePermissions = isSuperAdmin
        ? ['*']
        : Array.from(new Set([...rolePerms, ...userCustomPerms]));

      // Verify tracking live permission
      const hasLivePerm =
        effectivePermissions.includes('*') ||
        effectivePermissions.includes(TRACKING_PERMISSIONS.FLEET_TRACKING_LIVE) ||
        effectivePermissions.includes(TRACKING_PERMISSIONS.VEHICLE_LOCATION_LIVE);

      if (!hasLivePerm) {
        this.logger.warn(`WS connection rejected: User ${userId} lacks fleet.tracking.live in company ${companyId}`);
        client.emit('error', { message: 'Insufficient tracking permissions' });
        client.disconnect(true);
        return;
      }

      // 5. Attach authorized client data & join tenant room
      const clientData: AuthenticatedClientData = {
        userId,
        companyId,
        isSuperAdmin,
        tenantRole,
        permissions: effectivePermissions,
      };
      client.data = clientData;

      // Join tenant room
      await client.join(`company:${companyId}`);

      this.logger.log(`WS client connected: ${client.id} (user ${userId}, company ${companyId}, role ${tenantRole})`);
      client.emit('connected', {
        status: 'AUTHENTICATED',
        companyId,
        socketId: client.id,
      });
    } catch (err) {
      this.logger.error(`Error during WS handshake: ${err}`);
      client.emit('error', { message: 'Internal connection error' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const data = client.data as AuthenticatedClientData | undefined;
    this.logger.log(`WS client disconnected: ${client.id} (user ${data?.userId ?? 'unknown'})`);
  }

  // ─── Client Subscriptions ──────────────────────────────────────────────────

  @SubscribeMessage('subscribe:fleet')
  async handleSubscribeFleet(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { companyId?: string },
  ): Promise<{ success: boolean; message?: string }> {
    const clientData = client.data as AuthenticatedClientData | undefined;
    if (!clientData) {
      client.emit('error', { message: 'Unauthorized socket session' });
      return { success: false, message: 'Unauthorized' };
    }

    const targetCompanyId = data?.companyId ?? clientData.companyId;

    // Strict Tenant Isolation: cannot subscribe to another company's fleet unless SUPER_ADMIN
    if (targetCompanyId !== clientData.companyId && !clientData.isSuperAdmin) {
      this.logger.warn(
        `TENANT ISOLATION BREACH PREVENTED: Client ${client.id} (tenant ${clientData.companyId}) attempted to subscribe to tenant ${targetCompanyId}`,
      );
      client.emit('error', { message: 'Forbidden: Cannot subscribe to another company fleet' });
      return { success: false, message: 'Tenant isolation violation' };
    }

    await client.join(`company:${targetCompanyId}`);

    // Immediately push current fleet snapshot to the subscribing client
    try {
      const snapshot: FleetSnapshotDto = await this.telemetryService.getFleetSnapshot(targetCompanyId);
      client.emit(TRACKING_EVENTS.FLEET_SNAPSHOT, snapshot);
    } catch (err) {
      this.logger.error(`Failed to fetch fleet snapshot for tenant ${targetCompanyId}: ${err}`);
    }

    return { success: true };
  }

  @SubscribeMessage('unsubscribe:fleet')
  async handleUnsubscribeFleet(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { companyId?: string },
  ): Promise<{ success: boolean }> {
    const clientData = client.data as AuthenticatedClientData | undefined;
    const targetCompanyId = data?.companyId ?? clientData?.companyId;
    if (targetCompanyId) {
      await client.leave(`company:${targetCompanyId}`);
    }
    return { success: true };
  }

  @SubscribeMessage('subscribe:vehicle')
  async handleSubscribeVehicle(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { vehicleId: string; companyId?: string },
  ): Promise<{ success: boolean; message?: string }> {
    const clientData = client.data as AuthenticatedClientData | undefined;
    if (!clientData) {
      return { success: false, message: 'Unauthorized' };
    }

    const companyId = data?.companyId ?? clientData.companyId;
    if (companyId !== clientData.companyId && !clientData.isSuperAdmin) {
      client.emit('error', { message: 'Forbidden: Tenant isolation violation' });
      return { success: false, message: 'Forbidden' };
    }

    // Verify vehicle belongs to tenant
    const vehicle = await this.db.vehicle.findFirst({
      where: { id: data.vehicleId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!vehicle) {
      client.emit('error', { message: 'Vehicle not found in your company' });
      return { success: false, message: 'Vehicle not found' };
    }

    await client.join(`vehicle:${data.vehicleId}`);
    return { success: true };
  }

  // ─── Broadcasting Methods ──────────────────────────────────────────────────

  /**
   * Broadcast vehicle location update to tenant-scoped room and vehicle room.
   */
  broadcastLocationUpdated(companyId: string, event: VehicleLocationUpdatedEvent['data']): void {
    if (!this.server) return;
    this.server.to(`company:${companyId}`).emit(TRACKING_EVENTS.VEHICLE_LOCATION_UPDATED, event);
    this.server.to(`vehicle:${event.vehicleId}`).emit(TRACKING_EVENTS.VEHICLE_LOCATION_UPDATED, event);
    this.logger.debug(
      `Broadcast ${TRACKING_EVENTS.VEHICLE_LOCATION_UPDATED} for vehicle ${event.vehicleId} to company:${companyId}`,
    );
  }

  /**
   * Broadcast vehicle status update to tenant-scoped room.
   */
  broadcastStatusUpdated(companyId: string, event: VehicleStatusUpdatedEvent['data']): void {
    if (!this.server) return;
    this.server.to(`company:${companyId}`).emit(TRACKING_EVENTS.VEHICLE_STATUS_UPDATED, event);
  }

  /**
   * Broadcast driver location update to tenant-scoped room.
   */
  broadcastDriverLocationUpdated(companyId: string, event: Record<string, unknown>): void {
    if (!this.server) return;
    this.server.to(`company:${companyId}`).emit(TRACKING_EVENTS.DRIVER_LOCATION_UPDATED, event);
  }

  /**
   * Broadcast trip location update to tenant-scoped room.
   */
  broadcastTripLocationUpdated(companyId: string, event: Record<string, unknown>): void {
    if (!this.server) return;
    this.server.to(`company:${companyId}`).emit(TRACKING_EVENTS.TRIP_LOCATION_UPDATED, event);
  }

  /**
   * Broadcast new fleet alert to tenant-scoped room and vehicle room.
   */
  broadcastAlertCreated(companyId: string, alert: FleetAlertDto): void {
    if (!this.server) return;
    this.server.to(`company:${companyId}`).emit(ALERT_EVENTS.FLEET_ALERT_CREATED, alert);
    this.server.to(`vehicle:${alert.vehicleId}`).emit(ALERT_EVENTS.FLEET_ALERT_CREATED, alert);
    this.logger.debug(
      `Broadcast ${ALERT_EVENTS.FLEET_ALERT_CREATED} [${alert.type}:${alert.severity}] for vehicle ${alert.vehicleId} to company:${companyId}`,
    );
  }

  /**
   * Broadcast updated fleet alert to tenant-scoped room.
   */
  broadcastAlertUpdated(companyId: string, alert: FleetAlertDto): void {
    if (!this.server) return;
    this.server.to(`company:${companyId}`).emit(ALERT_EVENTS.FLEET_ALERT_UPDATED, alert);
  }

  /**
   * Broadcast acknowledged fleet alert to tenant-scoped room.
   */
  broadcastAlertAcknowledged(companyId: string, alert: FleetAlertDto): void {
    if (!this.server) return;
    this.server.to(`company:${companyId}`).emit(ALERT_EVENTS.FLEET_ALERT_ACKNOWLEDGED, alert);
  }

  /**
   * Broadcast resolved fleet alert to tenant-scoped room.
   */
  broadcastAlertResolved(companyId: string, alert: FleetAlertDto): void {
    if (!this.server) return;
    this.server.to(`company:${companyId}`).emit(ALERT_EVENTS.FLEET_ALERT_RESOLVED, alert);
  }

  // ─── Dispatch Broadcasting Methods (Phase 12C) ─────────────────────────────

  /**
   * Broadcast trip assignment to tenant-scoped room.
   */
  broadcastDispatchTripAssigned(companyId: string, event: Record<string, unknown>): void {
    if (!this.server) return;
    this.server.to(`company:${companyId}`).emit(DISPATCH_EVENTS.TRIP_ASSIGNED, event);
    this.logger.debug(
      `Broadcast ${DISPATCH_EVENTS.TRIP_ASSIGNED} for trip ${(event as any).tripId ?? (event as any).id} to company:${companyId}`,
    );
  }

  /**
   * Broadcast trip unassignment to tenant-scoped room.
   */
  broadcastDispatchTripUnassigned(companyId: string, event: Record<string, unknown>): void {
    if (!this.server) return;
    this.server.to(`company:${companyId}`).emit(DISPATCH_EVENTS.TRIP_UNASSIGNED, event);
    this.logger.debug(
      `Broadcast ${DISPATCH_EVENTS.TRIP_UNASSIGNED} for trip ${(event as any).tripId ?? (event as any).id} to company:${companyId}`,
    );
  }

  /**
   * Broadcast trip dispatched to tenant-scoped room.
   */
  broadcastDispatchTripDispatched(companyId: string, event: Record<string, unknown>): void {
    if (!this.server) return;
    this.server.to(`company:${companyId}`).emit(DISPATCH_EVENTS.TRIP_DISPATCHED, event);
    this.logger.debug(
      `Broadcast ${DISPATCH_EVENTS.TRIP_DISPATCHED} for trip ${(event as any).tripId ?? (event as any).id} to company:${companyId}`,
    );
  }

  /**
   * Broadcast trip execution status update to tenant-scoped room.
   */
  broadcastDispatchStatusUpdated(companyId: string, event: Record<string, unknown>): void {
    if (!this.server) return;
    this.server.to(`company:${companyId}`).emit(DISPATCH_EVENTS.TRIP_STATUS_UPDATED, event);
    this.logger.debug(
      `Broadcast ${DISPATCH_EVENTS.TRIP_STATUS_UPDATED} for trip ${(event as any).tripId ?? (event as any).id} to company:${companyId}`,
    );
  }

  /**
   * Broadcast trip stop update to tenant-scoped room.
   */
  broadcastDispatchStopUpdated(companyId: string, event: Record<string, unknown>): void {
    if (!this.server) return;
    this.server.to(`company:${companyId}`).emit(DISPATCH_EVENTS.STOP_UPDATED, event);
    this.logger.debug(
      `Broadcast ${DISPATCH_EVENTS.STOP_UPDATED} for trip ${(event as any).tripId} to company:${companyId}`,
    );
  }

  /**
   * Broadcast dynamic ETA update to tenant-scoped room.
   */
  broadcastDispatchEtaUpdated(companyId: string, event: Record<string, unknown>): void {
    if (!this.server) return;
    this.server.to(`company:${companyId}`).emit(DISPATCH_EVENTS.ETA_UPDATED, event);
    this.logger.debug(
      `Broadcast ${DISPATCH_EVENTS.ETA_UPDATED} for trip ${(event as any).tripId} to company:${companyId}`,
    );
  }
}
