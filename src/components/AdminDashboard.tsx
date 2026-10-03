import React, { useState, useEffect, useMemo } from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  Download,
  Printer,
  FileSpreadsheet,
  FileText,
  Filter,
  ArrowUpRight,
  ShieldCheck,
  Search,
  CheckCircle2,
  PieChart,
  Layers,
  ArrowLeft,
  Sparkles,
  ShoppingBag,
  RefreshCw,
  Clock,
  ChevronDown,
  Plus,
  Trash2,
  CloudUpload,
  X,
  CreditCard,
  ThumbsUp,
  ThumbsDown,
  MessageCircle,
  Eye,
  AlertTriangle,
} from 'lucide-react';
import { GameAccount, SaleRecord, GameType, OrderTransaction } from '../types';
import { realtimeSync } from '../services/realtimeSync';
import { formatRupiah, formatNumber } from '../utils/formatter';
import { MLBBLogo, FreeFireLogo } from './GameBadges';
import { PandirStoreEmblem } from './PandirStoreLogo';
import { PaymentSettingsModal } from './PaymentSettingsModal';
import { useToast } from '../context/ToastContext';

export type AdminDateRange = 'daily' | 'weekly' | 'monthly' | 'all' | 'custom';

export interface AdminDashboardProps {
  initialAccounts?: GameAccount[];
  initialSalesRecords?: SaleRecord[];
  onBackToKatalog?: () => void;
  onOpenPaymentSettings?: () => void;
  onOpenOrderApproval?: () => void;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  initialAccounts,
  initialSalesRecords,
  onBackToKatalog,
  onOpenPaymentSettings,
  onOpenOrderApproval,
}) => {
  const { showToast } = useToast();

  // Real-time state fetched directly from the database service with proper fallback
  const [accounts, setAccounts] = useState<GameAccount[]>(() => {
    if (initialAccounts && initialAccounts.length > 0) return initialAccounts;
    return realtimeSync.getAccounts();
  });
  const [salesRecords, setSalesRecords] = useState<SaleRecord[]>(() => {
    if (initialSalesRecords && initialSalesRecords.length > 0) return initialSalesRecords;
    return realtimeSync.getSalesRecords();
  });

  const [confirmations, setConfirmations] = useState<OrderTransaction[]>(() =>
    realtimeSync.getPaymentConfirmations()
  );

  const [isLoading, setIsLoading] = useState(false);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Default dateRange to 'all' so no transactions are hidden by arbitrary 30-day window
  const [dateRange, setDateRange] = useState<AdminDateRange>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [selectedGame, setSelectedGame] = useState<'ALL' | 'MLBB' | 'FREE_FIRE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Tab: 'all_accounts' | 'sales_ledger' | 'orders_approval'
  const [activeTab, setActiveTab] = useState<'all_accounts' | 'sales_ledger' | 'orders_approval'>('sales_ledger');

  // Internal Payment Settings Modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentModalTab, setPaymentModalTab] = useState<'config' | 'confirmations'>('config');
  const [selectedProofLightbox, setSelectedProofLightbox] = useState<string | null>(null);

  // Modal manual input transaksi penjualan baru
  const [isAddSaleModalOpen, setIsAddSaleModalOpen] = useState(false);
  const [newSaleGame, setNewSaleGame] = useState<GameType>('MLBB');
  const [newSaleTitle, setNewSaleTitle] = useState('');
  const [newSaleId, setNewSaleId] = useState('');
  const [newSaleSellingPrice, setNewSaleSellingPrice] = useState('');
  const [newSaleCostPrice, setNewSaleCostPrice] = useState('');
  const [newSaleBuyerNote, setNewSaleBuyerNote] = useState('');

  // Sync prop changes
  useEffect(() => {
    if (initialAccounts && initialAccounts.length > 0) {
      setAccounts(initialAccounts);
    }
  }, [initialAccounts]);

  useEffect(() => {
    if (initialSalesRecords && initialSalesRecords.length > 0) {
      setSalesRecords(initialSalesRecords);
    }
  }, [initialSalesRecords]);

  // Subscribe directly to real-time database updates
  useEffect(() => {
    setIsLoading(true);

    const unsubscribeAccounts = realtimeSync.subscribe((latestAccounts) => {
      setAccounts(latestAccounts);
      setLastUpdated(new Date());
      setIsLoading(false);
    });

    const unsubscribeSales = realtimeSync.subscribeSales((latestSales) => {
      setSalesRecords(latestSales);
      setLastUpdated(new Date());
    });

    const unsubscribeConfirmations = realtimeSync.subscribePaymentConfirmations((latestConfs) => {
      setConfirmations(latestConfs);
    });

    return () => {
      unsubscribeAccounts();
      unsubscribeSales();
      unsubscribeConfirmations();
    };
  }, []);

  const pendingOrdersCount = confirmations.filter(
    (c) => c.status === 'PENDING' || c.status === 'MENUNGGU_VERIFIKASI'
  ).length;

  // Handlers for Order Approval Workflow
  const handleApproveOrder = async (order: OrderTransaction) => {
    const orderKey = order.order_id || order.id;
    try {
      await realtimeSync.updatePaymentConfirmationStatus(orderKey, 'PAID_APPROVED');
      showToast({
        type: 'success',
        title: 'Pesanan Disetujui (PAID_APPROVED)!',
        message: `Pembayaran pesanan ${orderKey} telah diverifikasi. Silakan kirimkan akun ke pembeli.`,
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Gagal Menyetujui',
        message: err?.message || 'Kendala saat update status.',
      });
    }
  };

  const handleRejectUnderpaid = async (order: OrderTransaction) => {
    const orderKey = order.order_id || order.id;
    try {
      await realtimeSync.updatePaymentConfirmationStatus(orderKey, 'REJECTED_UNDERPAID');
      showToast({
        type: 'info',
        title: 'Pesanan Ditolak (Nominal Kurang)',
        message: `Status pesanan ${orderKey} diubah ke REJECTED_UNDERPAID. Gunakan tombol Chat WhatsApp untuk hubungi pembeli.`,
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Gagal Menolak',
        message: err?.message || 'Kendala saat update status.',
      });
    }
  };

  const handleChatBuyer = (order: OrderTransaction) => {
    const buyerPhone = (order.buyer_whatsapp || '').replace(/\D/g, '');
    const cleanPhone = buyerPhone.startsWith('0') ? '62' + buyerPhone.slice(1) : buyerPhone;
    const diff = (order.total_amount || 0) - (order.claimed_amount || 0);

    const message =
      `Halo Kak ${order.sender_name}, kami dari Admin PandirStore mengenai pesanan *${order.order_id || order.id}* ` +
      `untuk akun *${order.product_title || order.accountTitle}*.\n\n` +
      `Total tagihan resmi: *${formatRupiah(order.total_amount || order.amount)}* (Kode Unik: ${order.unique_code || '-'})\n` +
      `Nominal yang masuk: *${formatRupiah(order.claimed_amount || order.amount)}*\n` +
      (diff > 0
        ? `⚠️ Terdapat selisih nominal kurang sebesar *${formatRupiah(diff)}*.\n` +
          `Mohon transfer sisa kekurangannya ke rekening SeaBank kami atau konfirmasikan rekening Anda jika ingin retur dana.`
        : `Status pesanan Anda telah kami periksa. Mohon tunggu proses pengiriman data akun game.`);

    const helpWa = realtimeSync.getPaymentConfig().helpWhatsApp || '085717046895';
    const waUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/${helpWa.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;

    window.open(waUrl, '_blank');
  };

  // Filter accounts based on date range, game, and search query
  const filteredAccounts = useMemo(() => {
    const now = Date.now();
    return accounts.filter((acc) => {
      // 1. Date Range Filter (based on account createdAt or updatedAt)
      const timestamp = acc.updatedAt || acc.createdAt || now;

      if (dateRange === 'daily') {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        if (timestamp < startOfToday.getTime()) return false;
      } else if (dateRange === 'weekly') {
        if (timestamp < now - ONE_DAY_MS * 7) return false;
      } else if (dateRange === 'monthly') {
        if (timestamp < now - ONE_DAY_MS * 30) return false;
      } else if (dateRange === 'custom') {
        if (customStartDate) {
          const startMs = new Date(customStartDate).getTime();
          if (timestamp < startMs) return false;
        }
        if (customEndDate) {
          const endMs = new Date(customEndDate).getTime() + ONE_DAY_MS - 1;
          if (timestamp > endMs) return false;
        }
      }

      // 2. Game Filter
      if (selectedGame !== 'ALL' && acc.game !== selectedGame) {
        return false;
      }

      // 3. Search Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = acc.title.toLowerCase().includes(q);
        const matchId = acc.id.toLowerCase().includes(q);
        if (!matchTitle && !matchId) return false;
      }

      return true;
    });
  }, [accounts, dateRange, customStartDate, customEndDate, selectedGame, searchQuery]);

  // Filter Sales Records for ledger
  const filteredSales = useMemo(() => {
    const now = Date.now();
    return salesRecords.filter((record) => {
      if (dateRange === 'daily') {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        if (record.date < startOfToday.getTime()) return false;
      } else if (dateRange === 'weekly') {
        if (record.date < now - ONE_DAY_MS * 7) return false;
      } else if (dateRange === 'monthly') {
        if (record.date < now - ONE_DAY_MS * 30) return false;
      } else if (dateRange === 'custom') {
        if (customStartDate) {
          const startMs = new Date(customStartDate).getTime();
          if (record.date < startMs) return false;
        }
        if (customEndDate) {
          const endMs = new Date(customEndDate).getTime() + ONE_DAY_MS - 1;
          if (record.date > endMs) return false;
        }
      }

      if (selectedGame !== 'ALL' && record.game !== selectedGame) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = record.accountTitle.toLowerCase().includes(q);
        const matchId = record.id.toLowerCase().includes(q) || record.accountId.toLowerCase().includes(q);
        if (!matchTitle && !matchId) return false;
      }

      return true;
    });
  }, [salesRecords, dateRange, customStartDate, customEndDate, selectedGame, searchQuery]);

  // Real-Time Financial Calculations:
  // 1. Total Revenue = Sum(Harga Jual * Jumlah Terjual)
  const totalRevenue = useMemo(() => {
    const fromAccounts = filteredAccounts.reduce((sum, acc) => {
      const units = acc.soldCount || (acc.status === 'SOLD_OUT' ? 1 : 0);
      return sum + acc.price * units;
    }, 0);

    const fromSalesLedger = filteredSales.reduce((sum, s) => sum + s.sellingPrice, 0);

    if (activeTab === 'sales_ledger') {
      return fromSalesLedger;
    }
    if (activeTab === 'all_accounts') {
      return fromAccounts > 0 ? fromAccounts : fromSalesLedger;
    }
    return Math.max(fromAccounts, fromSalesLedger);
  }, [filteredAccounts, filteredSales, activeTab]);

  // 2. Total Costs (COGS / Harga Beli Modal) = Sum(Harga Modal * Jumlah Terjual)
  const totalCOGS = useMemo(() => {
    const fromAccounts = filteredAccounts.reduce((sum, acc) => {
      const cost = acc.costPrice ?? Math.round(acc.price * 0.7);
      const units = acc.soldCount || (acc.status === 'SOLD_OUT' ? 1 : 0);
      return sum + cost * units;
    }, 0);

    const fromSalesLedger = filteredSales.reduce((sum, s) => sum + s.costPrice, 0);

    if (activeTab === 'sales_ledger') {
      return fromSalesLedger;
    }
    if (activeTab === 'all_accounts') {
      return fromAccounts > 0 ? fromAccounts : fromSalesLedger;
    }
    return Math.max(fromAccounts, fromSalesLedger);
  }, [filteredAccounts, filteredSales, activeTab]);

  // 3. Net Profit = Total Revenue - Total COGS
  const netProfit = totalRevenue - totalCOGS;

  // 4. Net Profit Margin (%) = (Net Profit / Total Revenue) * 100
  const profitMarginPercent = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0.0';

  // Handler simpan transaksi penjualan baru
  const handleSaveManualSale = async (e: React.FormEvent) => {
    e.preventDefault();
    const sellingPrice = parseInt(newSaleSellingPrice.replace(/\D/g, '') || '0', 10);
    const costPrice = parseInt(newSaleCostPrice.replace(/\D/g, '') || '0', 10);

    if (!newSaleTitle.trim()) {
      showToast({
        type: 'info',
        title: 'Form Belum Lengkap',
        message: 'Mohon isi judul atau deskripsi akun yang terjual.',
      });
      return;
    }
    if (sellingPrice <= 0) {
      showToast({
        type: 'info',
        title: 'Harga Jual Tidak Valid',
        message: 'Mohon masukkan nominal harga jual yang benar.',
      });
      return;
    }

    try {
      const created = await realtimeSync.addSaleRecord({
        accountId: newSaleId.trim() || `ACC-${Date.now().toString().slice(-4)}`,
        accountTitle: newSaleTitle.trim(),
        game: newSaleGame,
        sellingPrice,
        costPrice,
        profit: sellingPrice - costPrice,
        date: Date.now(),
        buyerNote: newSaleBuyerNote.trim() || 'Transaksi kasir manual direct WA',
      });

      showToast({
        type: 'success',
        title: 'Transaksi Berhasil Disimpan',
        message: `Penjualan "${created.accountTitle}" tersimpan dan otomatis tersinkron ke semua perangkat.`,
      });

      setIsAddSaleModalOpen(false);
      setNewSaleTitle('');
      setNewSaleId('');
      setNewSaleSellingPrice('');
      setNewSaleCostPrice('');
      setNewSaleBuyerNote('');
      setActiveTab('sales_ledger');
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Gagal Menyimpan',
        message: err?.message || 'Gagal menyimpan transaksi ke Cloud Firestore.',
      });
    }
  };

  // Handler hapus transaksi penjualan
  const handleDeleteSale = async (sale: SaleRecord) => {
    if (window.confirm(`Hapus catatan transaksi ${sale.id} (${sale.accountTitle})?`)) {
      try {
        await realtimeSync.deleteSaleRecord(sale.id);
        showToast({
          type: 'info',
          title: 'Transaksi Dihapus',
          message: `Catatan transaksi ${sale.id} berhasil dihapus dari cloud.`,
        });
      } catch (err: any) {
        showToast({
          type: 'error',
          title: 'Gagal Menghapus',
          message: err?.message || 'Gagal menghapus transaksi.',
        });
      }
    }
  };

  // Handler sync cloud instan (unggah data HP ke Cloud)
  const handleSyncCloudNow = async () => {
    setIsSyncingCloud(true);
    try {
      const res = await realtimeSync.syncLocalToCloudNow();
      showToast({
        type: 'success',
        title: 'Sinkronisasi Multi-Device Berhasil!',
        message: `Berhasil mengunggah ${res.salesSynced} transaksi penjualan & ${res.accountsSynced} data akun ke Google Cloud Firestore. Semua perangkat kini tersinkron!`,
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Kendala Sinkronisasi',
        message: err?.message || 'Gagal menghubungkan ke Cloud Firestore.',
      });
    } finally {
      setIsSyncingCloud(false);
    }
  };

  // 5. Active Inventory Assets Valuation
  const inventoryStats = useMemo(() => {
    const readyAccounts = filteredAccounts.filter((a) => a.status === 'READY');
    const totalReadyValue = readyAccounts.reduce((sum, a) => sum + a.price, 0);
    const totalReadyCost = readyAccounts.reduce(
      (sum, a) => sum + (a.costPrice ?? Math.round(a.price * 0.7)),
      0
    );
    return {
      readyCount: readyAccounts.length,
      totalReadyValue,
      totalReadyCost,
      potentialProfit: totalReadyValue - totalReadyCost,
    };
  }, [filteredAccounts]);

  // Export to Excel / CSV
  const handleExportExcelCSV = () => {
    const headers = [
      'ID Akun',
      'Game',
      'Judul Lapak Akun',
      'Status Stok',
      'Unit Terjual',
      'Harga Beli Modal (COGS)',
      'Harga Jual (Revenue)',
      'Total Penjualan',
      'Total Modal',
      'Laba Bersih (Net Profit)',
      'Margin (%)',
      'Tanggal Diperbarui',
    ];

    const rows = filteredAccounts.map((acc) => {
      const cost = acc.costPrice ?? Math.round(acc.price * 0.7);
      const units = acc.soldCount || (acc.status === 'SOLD_OUT' ? 1 : 0);
      const accRevenue = acc.price * units;
      const accCost = cost * units;
      const accProfit = accRevenue - accCost;
      const margin = accRevenue > 0 ? Math.round((accProfit / accRevenue) * 100) : 0;

      return [
        acc.id,
        acc.game === 'MLBB' ? 'Mobile Legends' : 'Free Fire',
        `"${acc.title.replace(/"/g, '""')}"`,
        acc.status,
        units,
        cost,
        acc.price,
        accRevenue,
        accCost,
        accProfit,
        `${margin}%`,
        `"${new Date(acc.updatedAt || acc.createdAt).toLocaleString('id-ID')}"`,
      ];
    });

    // Summary totals row
    const totalsRow = [
      'TOTAL REKAPITULASI',
      '-',
      `"Periode: ${dateRange.toUpperCase()}"`,
      '-',
      filteredAccounts.reduce((sum, a) => sum + (a.soldCount || (a.status === 'SOLD_OUT' ? 1 : 0)), 0),
      '-',
      '-',
      totalRevenue,
      totalCOGS,
      netProfit,
      `${profitMarginPercent}%`,
      `"${new Date().toLocaleString('id-ID')}"`,
    ];

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.join(',')), totalsRow.join(',')].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Laporan_Keuangan_PANDIRSTORE_${dateRange}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to PDF / Print Report
  const handleExportPDF = () => {
    window.print();
  };

  return (
    <div className="space-y-3.5 sm:space-y-4">
      {/* Top Header Bar with Export & Live DB Sync Badge - Compact */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl py-2.5 px-3.5 sm:px-4 flex flex-col md:flex-row md:items-center justify-between gap-2.5 shadow-md backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          {onBackToKatalog && (
            <button
              onClick={onBackToKatalog}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Kembali"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 p-[1.5px] flex items-center justify-center shrink-0">
            <div className="w-full h-full bg-slate-950 rounded-[6px] flex items-center justify-center">
              <PandirStoreEmblem className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Admin Dashboard Keuangan &amp; Laba Rugi
              </h1>
              <span className="px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 text-[9px] font-bold border border-orange-500/30 uppercase tracking-wider">
                Real-Time DB
              </span>
            </div>
            <p className="text-[11px] text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
              <span>Rekapitulasi otomatis Penjualan, Modal (COGS), dan Laba Bersih.</span>
              <span className="text-slate-600 hidden sm:inline">•</span>
              <span className="text-emerald-400 font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                Updated: {lastUpdated.toLocaleTimeString('id-ID')}
              </span>
            </p>
          </div>
        </div>

        {/* Action Export, Cloud Sync, Payment Settings, & Order Approval Buttons */}
        <div className="flex flex-wrap items-center gap-2 print:hidden shrink-0">
          {/* Pengaturan Pembayaran Dinamis */}
          <button
            type="button"
            onClick={() => {
              if (onOpenPaymentSettings) onOpenPaymentSettings();
              else {
                setPaymentModalTab('config');
                setIsPaymentModalOpen(true);
              }
            }}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-950/80 hover:bg-orange-900 border border-orange-500/40 text-orange-300 text-xs font-semibold shadow-sm active:scale-95 h-8 transition-all"
            title="Pengaturan Rekening SeaBank & QRIS Dinamis"
          >
            <CreditCard className="w-3.5 h-3.5 text-orange-400" />
            <span>Pengaturan Rekening &amp; QRIS</span>
          </button>

          {/* Quick Button: Approval Pesanan Masuk */}
          <button
            type="button"
            onClick={() => {
              if (onOpenOrderApproval) onOpenOrderApproval();
              else {
                setActiveTab('orders_approval');
              }
            }}
            className="relative flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-xs font-semibold shadow-sm active:scale-95 h-8 transition-all"
            title="Verifikasi Pembayaran & Approval Pesanan Masuk"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Approval Pesanan</span>
            {pendingOrdersCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-red-500 text-white text-[10px] font-bold animate-pulse">
                {pendingOrdersCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setIsAddSaleModalOpen(true)}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-xs font-bold shadow-md shadow-orange-950/40 active:scale-95 h-8 transition-all"
            title="Catat transaksi penjualan kasir baru"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>+ Catat Penjualan</span>
          </button>

          <button
            onClick={handleSyncCloudNow}
            disabled={isSyncingCloud}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-950 hover:bg-blue-900 border border-blue-500/40 text-blue-300 text-xs font-semibold shadow-sm active:scale-95 h-8 transition-all disabled:opacity-60"
            title="Unggah data transaksi dari HP ini ke Cloud Firestore agar langsung muncul di PC"
          >
            {isSyncingCloud ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
            ) : (
              <CloudUpload className="w-3.5 h-3.5 text-blue-400" />
            )}
            <span>{isSyncingCloud ? 'Menyinkronkan...' : 'Sync Cloud'}</span>
          </button>

          <button
            onClick={handleExportExcelCSV}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-xs font-semibold transition-all shadow-sm active:scale-95 h-8"
            title="Download Laporan Format Excel / CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Export</span> CSV
          </button>

          <button
            onClick={handleExportPDF}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold transition-all shadow-sm shadow-orange-950/40 active:scale-95 h-8"
            title="Cetak atau Simpan sebagai PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Cetak</span> PDF
          </button>
        </div>
      </div>

      {/* Date Range, Game Filter & Search Bar - Responsive Inline 1 Row */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2 sm:px-3 print:hidden space-y-2">
        <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2">
          {/* Filter Periode (Harian, Mingguan, Bulanan, Semua, Kustom) */}
          <div className="flex items-center gap-1 flex-wrap sm:flex-nowrap">
            <span className="text-[11px] text-slate-400 font-bold mr-1 flex items-center gap-1 shrink-0">
              <Calendar className="w-3.5 h-3.5 text-orange-400" />
              <span className="hidden sm:inline">Periode:</span>
            </span>

            <button
              type="button"
              onClick={() => setDateRange('daily')}
              className={`h-8 px-2.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                dateRange === 'daily'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              Harian
            </button>

            <button
              type="button"
              onClick={() => setDateRange('weekly')}
              className={`h-8 px-2.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                dateRange === 'weekly'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              Mingguan
            </button>

            <button
              type="button"
              onClick={() => setDateRange('monthly')}
              className={`h-8 px-2.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                dateRange === 'monthly'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              Bulanan
            </button>

            <button
              type="button"
              onClick={() => setDateRange('all')}
              className={`h-8 px-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                dateRange === 'all'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              Semua
            </button>

            <button
              type="button"
              onClick={() => setDateRange('custom')}
              className={`h-8 px-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                dateRange === 'custom'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
              title="Pilih rentang tanggal khusus"
            >
              Kustom
            </button>
          </div>

          {/* Game Selection & Search Aligned in Same Row */}
          <div className="flex items-center gap-2 w-full lg:w-auto justify-between lg:justify-end">
            {/* Game Selection */}
            <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 h-8">
              <button
                type="button"
                onClick={() => setSelectedGame('ALL')}
                className={`h-7 px-2 rounded-md text-xs font-semibold transition-colors ${
                  selectedGame === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setSelectedGame('MLBB')}
                className={`h-7 px-2 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors ${
                  selectedGame === 'MLBB' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <MLBBLogo className="w-3.5 h-3.5" />
                <span>MLBB</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedGame('FREE_FIRE')}
                className={`h-7 px-2 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors ${
                  selectedGame === 'FREE_FIRE' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <FreeFireLogo className="w-3.5 h-3.5" />
                <span>FF</span>
              </button>
            </div>

            {/* Search Input with equal height h-8 */}
            <div className="relative flex-1 sm:w-44 lg:w-52">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Cari ID/Judul..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 w-full"
              />
            </div>
          </div>
        </div>

        {/* Custom Date Pickers when 'custom' is active */}
        {dateRange === 'custom' && (
          <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400 font-semibold text-[11px]">Rentang:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="h-7 bg-slate-950 border border-slate-800 rounded-md px-2 text-xs text-white focus:outline-none focus:border-orange-500"
            />
            <span className="text-slate-500 text-[11px]">s/d</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="h-7 bg-slate-950 border border-slate-800 rounded-md px-2 text-xs text-white focus:outline-none focus:border-orange-500"
            />
          </div>
        )}
      </div>

      {/* Primary KPI Statistics Cards (Revenue, Total COGS, Net Profit, Asset) - Compact */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Total Penjualan (Revenue) */}
        <div className="bg-slate-900/90 border border-blue-500/30 rounded-xl p-3 sm:p-3.5 relative overflow-hidden shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider">
              Total Penjualan
            </span>
            <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1.5">
            <h3 className="text-base sm:text-lg lg:text-xl font-black text-white font-mono truncate">
              {formatRupiah(totalRevenue)}
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5 flex items-center justify-between">
              <span>Σ (Harga Jual × Terjual)</span>
            </p>
          </div>
        </div>

        {/* Total Modal (COGS) */}
        <div className="bg-slate-900/90 border border-amber-500/30 rounded-xl p-3 sm:p-3.5 relative overflow-hidden shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
              Total Modal (COGS)
            </span>
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1.5">
            <h3 className="text-base sm:text-lg lg:text-xl font-black text-white font-mono truncate">
              {formatRupiah(totalCOGS)}
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5 flex items-center justify-between">
              <span>Σ (Harga Modal × Terjual)</span>
            </p>
          </div>
        </div>

        {/* Laba / Rugi Bersih (Net Profit) */}
        <div
          className={`border rounded-xl p-3 sm:p-3.5 relative overflow-hidden shadow-md ${
            netProfit >= 0
              ? 'bg-gradient-to-br from-emerald-950/60 to-slate-900 border-emerald-500/40'
              : 'bg-gradient-to-br from-red-950/60 to-slate-900 border-red-500/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-[11px] font-bold uppercase tracking-wider ${
                netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              Laba Bersih
            </span>
            <div
              className={`p-1.5 rounded-lg ${
                netProfit >= 0
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-red-500/20 text-red-400'
              }`}
            >
              {netProfit >= 0 ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
            </div>
          </div>
          <div className="mt-1.5">
            <h3
              className={`text-base sm:text-lg lg:text-xl font-black font-mono truncate ${
                netProfit >= 0 ? 'text-emerald-300' : 'text-red-300'
              }`}
            >
              {netProfit < 0 ? '-' : ''}
              {formatRupiah(Math.abs(netProfit))}
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5 flex items-center justify-between">
              <span>Revenue − COGS</span>
              <span className="font-bold text-white ml-1">
                ({profitMarginPercent}% Margin)
              </span>
            </p>
          </div>
        </div>

        {/* Nilai Stok Siap Jual (Inventory Asset) */}
        <div className="bg-slate-900/90 border border-purple-500/30 rounded-xl p-3 sm:p-3.5 relative overflow-hidden shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider">
              Nilai Aset Stok Ready
            </span>
            <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1.5">
            <h3 className="text-base sm:text-lg lg:text-xl font-black text-white font-mono truncate">
              {formatRupiah(inventoryStats.totalReadyValue)}
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5 flex items-center justify-between">
              <span>{inventoryStats.readyCount} Akun Tersedia</span>
              <span className="text-purple-300 font-semibold">
                Modal: {formatRupiah(inventoryStats.totalReadyCost)}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Main Ledger & Audit Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/60">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <span>Rincian Akun &amp; Rekapitulasi Harga</span>
              <span className="text-xs font-normal text-slate-400">
                ({filteredAccounts.length} item ditemukan)
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Transparansi penuh: Membandingkan Harga Modal (COGS), Harga Jual (Revenue), dan Laba Per Akun.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-semibold hidden sm:inline">Tampilan:</span>
            <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 flex-wrap gap-1">
              <button
                onClick={() => setActiveTab('all_accounts')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  activeTab === 'all_accounts'
                    ? 'bg-orange-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Katalog Akun ({filteredAccounts.length})
              </button>
              <button
                onClick={() => setActiveTab('sales_ledger')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  activeTab === 'sales_ledger'
                    ? 'bg-orange-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Buku Penjualan ({filteredSales.length})
              </button>
              <button
                onClick={() => setActiveTab('orders_approval')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                  activeTab === 'orders_approval'
                    ? 'bg-orange-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>Approval Pesanan ({confirmations.length})</span>
                {pendingOrdersCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-red-500 text-white text-[9px] font-bold animate-pulse">
                    {pendingOrdersCount} Baru
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          {activeTab === 'orders_approval' ? (
            /* SECTION 4: WORKFLOW APPROVAL PESANAN TABLE */
            <div className="divide-y divide-slate-800">
              {confirmations.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <p className="mb-2">Belum ada konfirmasi pembayaran baru dari pembeli.</p>
                </div>
              ) : (
                confirmations.map((conf) => {
                  const orderKey = conf.order_id || conf.id;
                  const officialTotal = conf.total_amount || conf.amount || 0;
                  const claimed = conf.claimed_amount || conf.amount || officialTotal;
                  const diff = officialTotal - claimed;
                  const hasDiscrepancy = claimed < officialTotal;
                  const proofUrl = conf.proof_of_payment_url || conf.proofImageUrl;
                  const isPending = conf.status === 'PENDING' || conf.status === 'MENUNGGU_VERIFIKASI';
                  const isApproved = conf.status === 'PAID_APPROVED' || conf.status === 'TERVERIFIKASI';
                  const isRejected = conf.status === 'REJECTED_UNDERPAID' || conf.status === 'DITOLAK';

                  return (
                    <div
                      key={orderKey}
                      className="p-4 hover:bg-slate-800/40 transition-colors flex flex-col space-y-3"
                    >
                      {/* Order Header & Status Badge */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-orange-400 text-sm">
                            {orderKey}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isApproved
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : isRejected
                                ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                            }`}
                          >
                            {conf.status}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono">
                            {conf.payment_method}
                          </span>
                        </div>

                        <span className="text-[11px] text-slate-400">
                          {new Date(conf.created_at || conf.createdAt).toLocaleString('id-ID')}
                        </span>
                      </div>

                      {/* Order Details Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-[11px]">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Produk Akun:</span>
                          <span className="font-bold text-white truncate block">
                            {conf.product_title || conf.accountTitle}
                          </span>
                        </div>

                        <div>
                          <span className="text-slate-400 block text-[10px]">Total Tagihan Resmi:</span>
                          <span className="font-bold text-orange-400 font-mono">
                            {formatRupiah(officialTotal)}
                          </span>
                          {conf.unique_code && (
                            <span className="text-[10px] text-slate-500 block">
                              Kode Unik: {conf.unique_code}
                            </span>
                          )}
                        </div>

                        <div>
                          <span className="text-slate-400 block text-[10px]">Nominal Ditransfer:</span>
                          <span
                            className={`font-bold font-mono ${
                              hasDiscrepancy ? 'text-red-400' : 'text-emerald-400'
                            }`}
                          >
                            {formatRupiah(claimed)}
                          </span>
                          {hasDiscrepancy && (
                            <span className="text-[10px] text-red-400 font-semibold block">
                              Kurang {formatRupiah(diff)}
                            </span>
                          )}
                        </div>

                        <div>
                          <span className="text-slate-400 block text-[10px]">Nama Pengirim:</span>
                          <span className="font-bold text-white">{conf.sender_name}</span>
                          {conf.buyer_whatsapp && (
                            <span className="text-[10px] text-emerald-400 font-mono block">
                              WA: {conf.buyer_whatsapp}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Notes if any */}
                      {conf.notes && (
                        <div className="text-[11px] text-slate-400 italic bg-slate-950/40 p-2 rounded-lg border border-slate-800/60">
                          Catatan: &quot;{conf.notes}&quot;
                        </div>
                      )}

                      {/* Action Buttons for Seller Approval */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                        {proofUrl ? (
                          <button
                            type="button"
                            onClick={() => setSelectedProofLightbox(proofUrl)}
                            className="px-2.5 py-1.5 rounded-lg bg-blue-950 text-blue-300 hover:bg-blue-900 text-xs font-semibold flex items-center gap-1 border border-blue-500/30 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Lihat Bukti Transfer</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-500 italic">
                            Tidak melampirkan screenshot bukti
                          </span>
                        )}

                        <div className="flex items-center gap-2">
                          {isPending && (
                            <>
                              {/* Tombol Aksi [Tolak - Nominal Kurang] */}
                              <button
                                type="button"
                                onClick={() => handleRejectUnderpaid(conf)}
                                className="px-3 py-1.5 rounded-lg bg-red-950 hover:bg-red-900 text-red-300 border border-red-500/40 text-xs font-bold flex items-center gap-1 transition-all active:scale-95"
                                title="Tolak pesanan karena nominal transfer kurang dari tagihan"
                              >
                                <ThumbsDown className="w-3.5 h-3.5" />
                                <span>Tolak (Nominal Kurang)</span>
                              </button>

                              {/* Tombol Aksi [Setujui / Kirim Akun] */}
                              <button
                                type="button"
                                onClick={() => handleApproveOrder(conf)}
                                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white text-xs font-bold flex items-center gap-1 shadow-md shadow-emerald-950 transition-all active:scale-95"
                                title="Setujui pembayaran dan lanjutkan ke pengiriman akun"
                              >
                                <ThumbsUp className="w-3.5 h-3.5" />
                                <span>Setujui / Kirim Akun</span>
                              </button>
                            </>
                          )}

                          {/* Tombol Cepat "Chat WhatsApp Pembeli" */}
                          <button
                            type="button"
                            onClick={() => handleChatBuyer(conf)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-1 transition-all active:scale-95"
                            title="Chat WhatsApp Pembeli untuk retur atau penyelesaian selisih"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>Chat WhatsApp Pembeli</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-bold border-b border-slate-800">
              <tr>
                <th className="py-3 px-3 sm:px-4">ID &amp; Game</th>
                <th className="py-3 px-3 sm:px-4">Judul Lapak Akun</th>
                <th className="py-3 px-3 sm:px-4">Status / Stok</th>
                <th className="py-3 px-3 sm:px-4 text-right">Harga Modal (COGS)</th>
                <th className="py-3 px-3 sm:px-4 text-right">Harga Jual (Revenue)</th>
                <th className="py-3 px-3 sm:px-4 text-right">Laba Bersih</th>
                <th className="py-3 px-3 sm:px-4 text-center">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {activeTab === 'all_accounts' ? (
                filteredAccounts.length > 0 ? (
                  filteredAccounts.map((account) => {
                    const cost = account.costPrice ?? Math.round(account.price * 0.7);
                    const units = account.soldCount || (account.status === 'SOLD_OUT' ? 1 : 0);
                    const accProfit = account.price - cost;
                    const margin =
                      account.price > 0
                        ? Math.round((accProfit / account.price) * 100)
                        : 0;

                    return (
                      <tr key={account.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {account.game === 'MLBB' ? (
                              <MLBBLogo className="w-4 h-4" />
                            ) : (
                              <FreeFireLogo className="w-4 h-4" />
                            )}
                            <span className="font-mono font-bold text-white">
                              {account.id}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-3 sm:px-4 max-w-xs truncate font-medium text-slate-200">
                          {account.title}
                        </td>

                        <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                          {account.status === 'READY' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                              Ready ({account.stock})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/15 text-red-400 font-bold border border-red-500/30">
                              Terjual ({units}x)
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3 sm:px-4 text-right font-mono text-amber-400">
                          {formatRupiah(cost)}
                        </td>

                        <td className="py-3 px-3 sm:px-4 text-right font-mono font-bold text-blue-300">
                          {formatRupiah(account.price)}
                        </td>

                        <td className="py-3 px-3 sm:px-4 text-right font-mono font-bold text-emerald-400">
                          +{formatRupiah(accProfit)}
                        </td>

                        <td className="py-3 px-3 sm:px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded font-bold ${
                              margin >= 30
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-amber-500/20 text-amber-300'
                            }`}
                          >
                            {margin}%
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      Tidak ada data akun yang sesuai filter.
                    </td>
                  </tr>
                )
              ) : filteredSales.length > 0 ? (
                filteredSales.map((sale) => {
                  const margin =
                    sale.sellingPrice > 0
                      ? Math.round((sale.profit / sale.sellingPrice) * 100)
                      : 0;

                  return (
                    <tr key={sale.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-orange-400">
                            {sale.id}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {new Date(sale.date).toLocaleDateString('id-ID')}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-3 sm:px-4 max-w-xs truncate font-medium text-slate-200">
                        <div className="flex items-center gap-1.5">
                          {sale.game === 'MLBB' ? (
                            <MLBBLogo className="w-3.5 h-3.5 shrink-0" />
                          ) : (
                            <FreeFireLogo className="w-3.5 h-3.5 shrink-0" />
                          )}
                          <span className="truncate">{sale.accountTitle}</span>
                        </div>
                      </td>

                      <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                          Selesai
                        </span>
                      </td>

                      <td className="py-3 px-3 sm:px-4 text-right font-mono text-amber-400">
                        {formatRupiah(sale.costPrice)}
                      </td>

                      <td className="py-3 px-3 sm:px-4 text-right font-mono font-bold text-blue-300">
                        {formatRupiah(sale.sellingPrice)}
                      </td>

                      <td className="py-3 px-3 sm:px-4 text-right font-mono font-bold text-emerald-400">
                        +{formatRupiah(sale.profit)}
                      </td>

                      <td className="py-3 px-3 sm:px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="px-2 py-0.5 rounded font-bold bg-emerald-500/20 text-emerald-300">
                            {margin}%
                          </span>
                          <button
                            onClick={() => handleDeleteSale(sale)}
                            className="p-1 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors"
                            title="Hapus transaksi ini"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <p className="mb-2">Belum ada riwayat transaksi penjualan dalam rentang waktu ini.</p>
                    <button
                      type="button"
                      onClick={() => setIsAddSaleModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600 text-white text-xs font-bold shadow-md hover:bg-orange-500 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Catat Transaksi Penjualan Baru</span>
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
            {/* Table Footer Totals */}
            <tfoot className="bg-slate-950 font-bold border-t-2 border-slate-800">
              <tr>
                <td colSpan={3} className="py-3 px-4 text-white uppercase tracking-wider text-xs">
                  Total Rekapitulasi ({dateRange.toUpperCase()})
                </td>
                <td className="py-3 px-4 text-right font-mono text-amber-400">
                  {formatRupiah(totalCOGS)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-blue-300">
                  {formatRupiah(totalRevenue)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-emerald-400">
                  +{formatRupiah(netProfit)}
                </td>
                <td className="py-3 px-4 text-center font-bold text-emerald-300">
                  {profitMarginPercent}%
                </td>
              </tr>
            </tfoot>
          </table>
          )}
        </div>
      </div>

      {/* Lightbox Bukti Transfer */}
      {selectedProofLightbox && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn">
          <div className="relative max-w-lg w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex justify-between items-center text-white">
              <span className="font-bold text-xs">Foto Bukti Transfer Pembeli</span>
              <button
                onClick={() => setSelectedProofLightbox(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="rounded-xl overflow-hidden max-h-[70vh] bg-black flex items-center justify-center">
              <img
                src={selectedProofLightbox}
                alt="Bukti Transfer"
                className="max-w-full max-h-[70vh] object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* Payment Settings & Order Approval Modal */}
      <PaymentSettingsModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        defaultTab={paymentModalTab}
      />

      {/* Modal Input Transaksi Penjualan Baru */}
      {isAddSaleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-orange-500/20 text-orange-400">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Catat Transaksi Penjualan Baru</h3>
                  <p className="text-[11px] text-slate-400">Otomatis tersimpan &amp; real-time ke HP dan PC</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddSaleModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveManualSale} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Game</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewSaleGame('MLBB')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      newSaleGame === 'MLBB'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-slate-950 text-slate-400 border border-slate-800'
                    }`}
                  >
                    <MLBBLogo className="w-4 h-4" />
                    <span>Mobile Legends</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewSaleGame('FREE_FIRE')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      newSaleGame === 'FREE_FIRE'
                        ? 'bg-orange-600 text-white shadow-md'
                        : 'bg-slate-950 text-slate-400 border border-slate-800'
                    }`}
                  >
                    <FreeFireLogo className="w-4 h-4" />
                    <span>Free Fire</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Judul Akun / Rincian Lapak <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: MLBB Mythic Glory 180 Skin Collector"
                  value={newSaleTitle}
                  onChange={(e) => setNewSaleTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  ID Akun / Kode Lapak (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: ML-201 atau ID Akun"
                  value={newSaleId}
                  onChange={(e) => setNewSaleId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Harga Jual (Revenue) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="Contoh: 500000"
                    value={newSaleSellingPrice}
                    onChange={(e) => setNewSaleSellingPrice(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-orange-400 font-bold font-mono placeholder-slate-500 focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Harga Modal / Beli (COGS)
                  </label>
                  <input
                    type="number"
                    placeholder="Contoh: 350000"
                    value={newSaleCostPrice}
                    onChange={(e) => setNewSaleCostPrice(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-amber-400 font-mono placeholder-slate-500 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Catatan Pembeli / Transaksi (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Direct WA Pembeli Depok"
                  value={newSaleBuyerNote}
                  onChange={(e) => setNewSaleBuyerNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddSaleModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-xs font-bold transition-all shadow-md active:scale-95"
                >
                  Simpan Transaksi (Auto-Sync)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
