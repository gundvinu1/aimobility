'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { RouteGuard } from '@/components/auth/route-guard';
import { usePermissions } from '@/lib/auth/use-permissions';
import {
  fetchVendors,
  createVendor,
  deleteVendor,
  fetchVendorInvoices,
  createVendorInvoice,
} from '@/lib/fleet-management/fleet-management-api';
import type {
  VendorDto,
  CreateVendorDto,
  VendorInvoiceDto,
  CreateVendorInvoiceDto,
} from '@ai-mos/types';
import {
  Store,
  Receipt,
  Plus,
  RefreshCw,
  Phone,
  Mail,
  MapPin,
  Trash2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function VendorsPage() {
  const params = useParams();
  const companyId = (params?.['companyId'] as string) || '';
  const { hasPermission } = usePermissions();

  const canCreateVendor = hasPermission('vendor.create');
  const canDeleteVendor = hasPermission('vendor.delete');
  const canCreateInvoice = hasPermission('invoice.create');

  const [activeTab, setActiveTab] = useState<'vendors' | 'invoices'>('vendors');
  const [vendors, setVendors] = useState<VendorDto[]>([]);
  const [invoices, setInvoices] = useState<VendorInvoiceDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [vendorForm, setVendorForm] = useState<Partial<CreateVendorDto>>({
    name: '',
    type: 'SERVICE_CENTER',
  });
  const [invoiceForm, setInvoiceForm] = useState<Partial<CreateVendorInvoiceDto>>({
    subtotal: 0,
    tax: 0,
  });

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setIsLoading(true);
    try {
      if (activeTab === 'vendors') {
        const res = await fetchVendors(companyId);
        setVendors(res.data || []);
      } else {
        const res = await fetchVendorInvoices(companyId);
        setInvoices(res.data || []);
      }
    } catch (err: any) {
      console.error('Error fetching vendors/invoices:', err);
    } finally {
      setIsLoading(false);
    }
  }, [companyId, activeTab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorForm.name) {
      alert('Vendor Name is required.');
      return;
    }
    try {
      await createVendor(companyId, vendorForm as CreateVendorDto);
      setIsVendorModalOpen(false);
      setVendorForm({ name: '', type: 'SERVICE_CENTER' });
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create vendor');
    }
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceForm.vendorId || !invoiceForm.invoiceNumber || !invoiceForm.subtotal) {
      alert('Vendor ID, Invoice Number, and Subtotal are required.');
      return;
    }
    try {
      await createVendorInvoice(companyId, invoiceForm as CreateVendorInvoiceDto);
      setIsInvoiceModalOpen(false);
      setInvoiceForm({ subtotal: 0, tax: 0 });
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to record invoice');
    }
  };

  const handleDeleteVendor = async (id: string) => {
    if (!confirm('Are you sure you want to delete this vendor?')) return;
    try {
      await deleteVendor(companyId, id);
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete vendor');
    }
  };

  return (
    <RouteGuard requiredPermission="vendor.read">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Store className="h-7 w-7 text-sky-400" />
              Vendors & Invoices
            </h1>
            <p className="text-sm text-slate-400">
              Manage third-party service centers, parts suppliers, mechanics, and maintenance billing invoices.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => loadData()}
              className="px-3 py-2 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg flex items-center gap-2 border border-slate-700"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            {canCreateVendor && (
              <button
                onClick={() => setIsVendorModalOpen(true)}
                className="px-4 py-2 text-sm bg-sky-600 hover:bg-sky-700 text-white font-medium rounded-lg flex items-center gap-2 transition-colors shadow-sm"
              >
                <Plus className="h-4 w-4" />
                Add Vendor
              </button>
            )}
            {canCreateInvoice && (
              <button
                onClick={() => setIsInvoiceModalOpen(true)}
                className="px-4 py-2 text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium rounded-lg flex items-center gap-2 transition-colors shadow-sm"
              >
                <Receipt className="h-4 w-4" />
                Record Invoice
              </button>
            )}
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex space-x-2 border-b border-slate-800 pb-3">
          <button
            onClick={() => setActiveTab('vendors')}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              activeTab === 'vendors'
                ? 'bg-sky-600/20 text-sky-300 border border-sky-500/30'
                : 'text-slate-400 hover:text-white',
            )}
          >
            Vendors Directory
          </button>
          <button
            onClick={() => setActiveTab('invoices')}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              activeTab === 'invoices'
                ? 'bg-sky-600/20 text-sky-300 border border-sky-500/30'
                : 'text-slate-400 hover:text-white',
            )}
          >
            Vendor Invoices
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 flex items-center justify-center gap-3">
            <RefreshCw className="h-5 w-5 animate-spin text-sky-400" />
            Loading records...
          </div>
        ) : activeTab === 'vendors' ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            {vendors.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Store className="h-10 w-10 mx-auto text-slate-600 mb-3" />
                <p className="text-base font-medium text-slate-300">No vendors registered</p>
                <p className="text-sm text-slate-500 mt-1">Register external service centers or fuel stations.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                {vendors.map((v) => (
                  <div
                    key={v.id}
                    className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5 space-y-3 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs px-2 py-0.5 rounded font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                          {v.type}
                        </span>
                        {canDeleteVendor && (
                          <button
                            onClick={() => handleDeleteVendor(v.id)}
                            className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-white mt-2">{v.name}</h3>
                      {v.contactPerson && (
                        <p className="text-xs text-slate-400 mt-0.5">Contact: {v.contactPerson}</p>
                      )}
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-300 pt-2 border-t border-slate-800">
                      {v.phone && (
                        <p className="flex items-center gap-2 text-slate-400">
                          <Phone className="h-3.5 w-3.5 text-slate-500" /> {v.phone}
                        </p>
                      )}
                      {v.email && (
                        <p className="flex items-center gap-2 text-slate-400">
                          <Mail className="h-3.5 w-3.5 text-slate-500" /> {v.email}
                        </p>
                      )}
                      {v.address && (
                        <p className="flex items-center gap-2 text-slate-400 line-clamp-1">
                          <MapPin className="h-3.5 w-3.5 text-slate-500" /> {v.address}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            {invoices.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Receipt className="h-10 w-10 mx-auto text-slate-600 mb-3" />
                <p className="text-base font-medium text-slate-300">No invoices recorded</p>
                <p className="text-sm text-slate-500 mt-1">Record supplier and repair invoices here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-800/50 text-xs uppercase text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Invoice #</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Vendor</th>
                      <th className="px-4 py-3">Vehicle</th>
                      <th className="px-4 py-3">Subtotal</th>
                      <th className="px-4 py-3">Tax</th>
                      <th className="px-4 py-3">Total Amount</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 font-mono font-semibold text-sky-400">
                          {inv.invoiceNumber}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">
                          {new Date(inv.invoiceDate).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 font-medium text-white">{inv.vendorName || '—'}</td>
                        <td className="px-4 py-3 text-slate-300">{inv.vehicleNumber || '—'}</td>
                        <td className="px-4 py-3 text-slate-400">${inv.subtotal.toLocaleString()}</td>
                        <td className="px-4 py-3 text-slate-400">${inv.tax.toLocaleString()}</td>
                        <td className="px-4 py-3 font-semibold text-emerald-400">
                          ${inv.total.toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Modal: Add Vendor */}
        {isVendorModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Store className="h-5 w-5 text-sky-400" />
                  Add Vendor
                </h3>
                <button onClick={() => setIsVendorModalOpen(false)} className="p-1 text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateVendor} className="space-y-4 text-sm">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Vendor Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex Auto Repairs"
                    value={vendorForm.name || ''}
                    onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Vendor Type</label>
                    <select
                      value={vendorForm.type || 'SERVICE_CENTER'}
                      onChange={(e) => setVendorForm({ ...vendorForm, type: e.target.value as any })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none"
                    >
                      <option value="SERVICE_CENTER">Service Center</option>
                      <option value="MECHANIC">Mechanic</option>
                      <option value="FUEL_STATION">Fuel Station</option>
                      <option value="PARTS_SUPPLIER">Parts Supplier</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Contact Person</label>
                    <input
                      type="text"
                      placeholder="e.g. Dave Miller"
                      value={vendorForm.contactPerson || ''}
                      onChange={(e) => setVendorForm({ ...vendorForm, contactPerson: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Phone</label>
                    <input
                      type="text"
                      placeholder="+1 555-0199"
                      value={vendorForm.phone || ''}
                      onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Email</label>
                    <input
                      type="email"
                      placeholder="service@apex.com"
                      value={vendorForm.email || ''}
                      onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsVendorModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-medium rounded-lg"
                  >
                    Save Vendor
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Record Invoice */}
        {isInvoiceModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-sky-400" />
                  Record Vendor Invoice
                </h3>
                <button onClick={() => setIsInvoiceModalOpen(false)} className="p-1 text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateInvoice} className="space-y-4 text-sm">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Vendor ID *</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter vendor UUID"
                    value={invoiceForm.vendorId || ''}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, vendorId: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Invoice Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. INV-2026-902"
                    value={invoiceForm.invoiceNumber || ''}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceNumber: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Subtotal ($) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="e.g. 1200"
                      value={invoiceForm.subtotal || ''}
                      onChange={(e) =>
                        setInvoiceForm({ ...invoiceForm, subtotal: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Tax ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 120"
                      value={invoiceForm.tax || ''}
                      onChange={(e) =>
                        setInvoiceForm({ ...invoiceForm, tax: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Vehicle ID (Optional)</label>
                  <input
                    type="text"
                    placeholder="Vehicle UUID if specific to a vehicle"
                    value={invoiceForm.vehicleId || ''}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, vehicleId: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsInvoiceModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-medium rounded-lg"
                  >
                    Save Invoice
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </RouteGuard>
  );
}
