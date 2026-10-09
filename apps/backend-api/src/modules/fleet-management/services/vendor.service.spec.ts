import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { VendorService } from './vendor.service';
import { DatabaseService } from '../../database/database.service';

describe('VendorService', () => {
  let service: VendorService;
  let db: any;

  const companyA = '11111111-1111-1111-1111-111111111111';
  const companyB = '22222222-2222-2222-2222-222222222222';
  const userId = 'user-123';

  beforeEach(async () => {
    db = {
      vendor: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      vendorInvoice: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      vehicle: {
        findFirst: jest.fn(),
      },
      workOrder: {
        findFirst: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VendorService,
        { provide: DatabaseService, useValue: db },
      ],
    }).compile();

    service = module.get<VendorService>(VendorService);
  });

  describe('createVendor', () => {
    it('creates a vendor successfully scoped to tenant', async () => {
      const mockVendor = {
        id: 'ven-1',
        companyId: companyA,
        name: 'AutoCraft Care',
        type: 'SERVICE_CENTER',
        contactPerson: 'John Doe',
        phone: '+919876543210',
        email: 'john@autocraft.com',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      db.vendor.create.mockResolvedValue(mockVendor);

      const res = await service.createVendor(
        companyA,
        {
          name: 'AutoCraft Care',
          type: 'SERVICE_CENTER',
          contactPerson: 'John Doe',
          phone: '+919876543210',
          email: 'john@autocraft.com',
        },
        userId,
      );

      expect(db.vendor.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyId: companyA,
          name: 'AutoCraft Care',
          type: 'SERVICE_CENTER',
        }),
      });
      expect(res.id).toBe('ven-1');
      expect(res.name).toBe('AutoCraft Care');
    });
  });

  describe('createInvoice', () => {
    it('creates vendor invoice and computes total from subtotal and tax', async () => {
      db.vendor.findFirst.mockResolvedValue({ id: 'ven-1', companyId: companyA, name: 'AutoCraft' });

      const mockInvoice = {
        id: 'inv-1',
        companyId: companyA,
        vendorId: 'ven-1',
        invoiceNumber: 'INV-2026-001',
        subtotal: 10000,
        tax: 1800,
        total: 11800,
        status: 'RECEIVED',
        invoiceDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        vendor: { name: 'AutoCraft' },
      };
      db.vendorInvoice.create.mockResolvedValue(mockInvoice);

      const res = await service.createInvoice(
        companyA,
        {
          vendorId: 'ven-1',
          invoiceNumber: 'INV-2026-001',
          subtotal: 10000,
          tax: 1800,
        },
        userId,
      );

      expect(db.vendorInvoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: companyA,
            vendorId: 'ven-1',
            subtotal: 10000,
            tax: 1800,
            total: 11800,
          }),
        }),
      );
      expect(res.id).toBe('inv-1');
      expect(res.total).toBe(11800);
    });

    it('rejects invoice when vendor does not belong to company (tenant isolation)', async () => {
      db.vendor.findFirst.mockResolvedValue(null);

      await expect(
        service.createInvoice(
          companyB,
          {
            vendorId: 'ven-1',
            invoiceNumber: 'INV-999',
            subtotal: 5000,
          },
          userId,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(db.vendorInvoice.create).not.toHaveBeenCalled();
    });
  });

  describe('Tenant Isolation for Vendors and Invoices', () => {
    it('throws NotFoundException when Company B user accesses Company A vendor', async () => {
      db.vendor.findFirst.mockResolvedValue(null);
      await expect(service.getVendor(companyB, 'ven-1')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when Company B user accesses Company A invoice', async () => {
      db.vendorInvoice.findFirst.mockResolvedValue(null);
      await expect(service.getInvoice(companyB, 'inv-1')).rejects.toThrow(NotFoundException);
    });
  });
});
