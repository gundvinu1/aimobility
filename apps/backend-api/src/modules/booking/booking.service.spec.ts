import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { BookingService } from './booking.service';
import { DatabaseService } from '../database/database.service';

const mockCompanyAId = '11111111-1111-1111-1111-111111111111';
const mockCompanyBId = '22222222-2222-2222-2222-222222222222';
const mockUserId = '99999999-9999-9999-9999-999999999999';
const mockBookingId = '33333333-3333-3333-3333-333333333333';

describe('BookingService (Tenant Isolation & Booking Lifecycle)', () => {
  let service: BookingService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      booking: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingService,
        {
          provide: DatabaseService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<BookingService>(BookingService);
  });

  describe('createBooking', () => {
    it('should create a booking scoped to company', async () => {
      mockPrisma.booking.count.mockResolvedValueOnce(0);
      mockPrisma.booking.findFirst.mockResolvedValueOnce(null);
      mockPrisma.booking.create.mockResolvedValueOnce({
        id: mockBookingId,
        companyId: mockCompanyAId,
        bookingNumber: 'BK-20261015-0001',
        bookingDate: new Date(),
        customerName: 'Alice Smith',
        customerPhone: '+1-555-0100',
        pickupAddress: '123 Main St',
        dropoffAddress: '456 Market St',
        pickupTime: new Date('2026-10-15T09:00:00Z'),
        passengerCount: 2,
        status: 'DRAFT',
        source: 'ADMIN',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createBooking(
        {
          customerName: 'Alice Smith',
          customerPhone: '+1-555-0100',
          pickupAddress: '123 Main St',
          dropoffAddress: '456 Market St',
          pickupTime: '2026-10-15T09:00:00Z',
          passengerCount: 2,
        },
        mockCompanyAId,
        mockUserId,
        {},
      );

      expect(result.id).toBe(mockBookingId);
      expect(result.companyId).toBe(mockCompanyAId);
      expect(result.status).toBe('DRAFT');
      expect(mockPrisma.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: mockCompanyAId,
            customerName: 'Alice Smith',
          }),
        }),
      );
    });
  });

  describe('getBooking & Tenant Isolation', () => {
    it('should return booking when companyId matches', async () => {
      mockPrisma.booking.findFirst.mockResolvedValueOnce({
        id: mockBookingId,
        companyId: mockCompanyAId,
        bookingNumber: 'BK-001',
        bookingDate: new Date(),
        customerName: 'Alice Smith',
        customerPhone: '+1-555-0100',
        pickupAddress: '123 Main St',
        dropoffAddress: '456 Market St',
        pickupTime: new Date(),
        passengerCount: 1,
        status: 'DRAFT',
        source: 'ADMIN',
        trips: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.getBooking(mockBookingId, mockCompanyAId);
      expect(result.id).toBe(mockBookingId);
      expect(mockPrisma.booking.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: mockBookingId,
            companyId: mockCompanyAId,
            deletedAt: null,
          }),
        }),
      );
    });

    it('should throw NotFoundException when accessed with wrong companyId', async () => {
      mockPrisma.booking.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.getBooking(mockBookingId, mockCompanyBId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('confirmBooking', () => {
    it('should confirm DRAFT booking', async () => {
      mockPrisma.booking.findFirst.mockResolvedValueOnce({
        id: mockBookingId,
        companyId: mockCompanyAId,
        bookingNumber: 'BK-001',
        bookingDate: new Date(),
        customerName: 'Alice',
        customerPhone: '123',
        pickupAddress: 'A',
        dropoffAddress: 'B',
        pickupTime: new Date(),
        passengerCount: 1,
        status: 'DRAFT',
        source: 'ADMIN',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockPrisma.booking.update.mockResolvedValueOnce({
        id: mockBookingId,
        companyId: mockCompanyAId,
        bookingNumber: 'BK-001',
        bookingDate: new Date(),
        customerName: 'Alice',
        customerPhone: '123',
        pickupAddress: 'A',
        dropoffAddress: 'B',
        pickupTime: new Date(),
        passengerCount: 1,
        status: 'CONFIRMED',
        source: 'ADMIN',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.confirmBooking(mockBookingId, mockCompanyAId, mockUserId, {});
      expect(result.status).toBe('CONFIRMED');
    });

    it('should reject confirming non-DRAFT booking', async () => {
      mockPrisma.booking.findFirst.mockResolvedValueOnce({
        id: mockBookingId,
        companyId: mockCompanyAId,
        status: 'CONFIRMED',
      });

      await expect(
        service.confirmBooking(mockBookingId, mockCompanyAId, mockUserId, {}),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancelBooking', () => {
    it('should cancel active booking', async () => {
      mockPrisma.booking.findFirst.mockResolvedValueOnce({
        id: mockBookingId,
        companyId: mockCompanyAId,
        bookingNumber: 'BK-001',
        bookingDate: new Date(),
        customerName: 'Alice',
        customerPhone: '123',
        pickupAddress: 'A',
        dropoffAddress: 'B',
        pickupTime: new Date(),
        passengerCount: 1,
        status: 'CONFIRMED',
        source: 'ADMIN',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockPrisma.booking.update.mockResolvedValueOnce({
        id: mockBookingId,
        companyId: mockCompanyAId,
        bookingNumber: 'BK-001',
        bookingDate: new Date(),
        customerName: 'Alice',
        customerPhone: '123',
        pickupAddress: 'A',
        dropoffAddress: 'B',
        pickupTime: new Date(),
        passengerCount: 1,
        status: 'CANCELLED',
        source: 'ADMIN',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.cancelBooking(
        mockBookingId,
        mockCompanyAId,
        { reason: 'Customer changed plans' },
        mockUserId,
        {},
      );

      expect(result.status).toBe('CANCELLED');
    });
  });
});
