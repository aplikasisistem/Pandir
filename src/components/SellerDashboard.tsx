import React, { useState, useEffect } from 'react';
import {
  Plus,
  ArrowLeft,
  LogOut,
  Database,
  RefreshCw,
  Sparkles,
  ShoppingBag,
  TrendingUp,
  ShieldCheck,
  CheckCircle,
  Eye,
  CreditCard,
  PieChart,
  LayoutGrid,
  CheckCircle2,
  Bell,
} from 'lucide-react';
import { GameAccount, SaleRecord, OrderTransaction } from '../types';
import { formatRupiah, formatNumber } from '../utils/formatter';
import { AccountCard } from './AccountCard';
import { realtimeSync } from '../services/realtimeSync';
import { PandirStoreEmblem } from './PandirStoreLogo';
import { AdminDashboard } from './AdminDashboard';
import { PaymentSettingsModal } from './PaymentSettingsModal';

interface SellerDashboardProps {
  accounts: GameAccount[];
  salesRecords?: SaleRecord[];
  onBackToKatalog: () => void;
  onLogout: () => void;
  onAddNewAccount: () => void;
  onEditAccount: (account: GameAccount) => void;
  onDeleteAccount: (account: GameAccount) => void;
  onToggleStatus: (account: GameAccount) => void;
  onViewDetail: (account: GameAccount) => void;
  onOpenSyncSettings: () => void;
}

export const SellerDashboard: React.FC<SellerDashboardProps> = ({
  accounts,
  salesRecords = [],
  onBackToKatalog,
  onLogout,
  onAddNewAccount,
  onEditAccount,
  onDeleteAccount,
  onToggleStatus,
  onViewDetail,
  onOpenSyncSettings,
}) => {
  const [activeTab, setActiveTab] = useState<'catalog' | 'profit_loss'>('catalog');
  const [filterGame, setFilterGame] = useState<'ALL' | 'MLBB' | 'FREE_FIRE'>('ALL');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentModalTab, setPaymentModalTab] = useState<'config' | 'confirmations'>('config');

  const [confirmations, setConfirmations] = useState<OrderTransaction[]>(() =>
    realtimeSync.getPaymentConfirmations()
  );

  // Subscribe to real-time order confirmations to track pending count badge
  useEffect(() => {
    const unsub = realtimeSync.subscribePaymentConfirmations((confs) => {
      setConfirmations(confs);
    });
    return () => unsub();
  }, []);

  const pendingOrdersCount = confirmations.filter(
    (c) => c.status === 'PENDING' || c.status === 'MENUNGGU_VERIFIKASI'
  ).length;

  const filteredAccounts = accounts.filter((a) => {
    if (filterGame === 'ALL') return true;
    return a.game === filterGame;
  });

  const totalReady = accounts.filter((a) => a.status === 'READY').length;
  const totalSold = accounts.filter((a) => a.status === 'SOLD_OUT').length;
  const totalEstimatedValue = accounts.reduce(
    (acc, curr) => acc + (curr.status === 'READY' ? curr.price : 0),
    0
  );
  const syncStatus = realtimeSync.getSyncStatus();

  return (
    <div
      className="min-h-screen bg-slate-950 text-slate-100"
      style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}
    >
      {/* Top Seller Bar with Safe Area Top */}
      <div
        className="bg-slate-900 border-b border-slate-800 sticky top-0 left-0 right-0 z-40 backdrop-blur-md safe-top w-full shadow-md"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6px)',
        }}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={onBackToKatalog}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-semibold transition-colors min-h-[36px]"
              title="Kembali ke Katalog Publik"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden xs:inline">Ke Katalog</span>
            </button>

            <div className="h-5 w-px bg-slate-800 hidden sm:block"></div>

            <div className="flex items-center gap-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-cyan-400 via-blue-600 to-orange-500 p-[1.5px] flex items-center justify-center">
                <div className="w-full h-full bg-slate-950 rounded-[6px] sm:rounded-[7px] flex items-center justify-center">
                  <PandirStoreEmblem className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              </div>
              <span className="text-xs sm:text-base font-black text-white truncate max-w-[120px] sm:max-w-none">
                Admin <span className="text-orange-400 font-mono">(Pandir)</span>
              </span>
            </div>
          </div>

          {/* Action Buttons Top Right: Pengaturan Pembayaran, Sync Cloud, Logout */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Quick Button: Pengaturan Pembayaran Dinamis & Rekening */}
            <button
              onClick={() => {
                setPaymentModalTab('config');
                setIsPaymentModalOpen(true);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-orange-950/80 hover:bg-orange-900 border border-orange-500/40 text-orange-300 text-xs font-semibold flex items-center gap-1.5 transition-colors min-h-[36px]"
              title="Pengaturan Rekening SeaBank & QRIS Dinamis"
            >
              <CreditCard className="w-3.5 h-3.5 text-orange-400" />
              <span className="hidden md:inline">Pengaturan Pembayaran</span>
            </button>

            {/* Quick Button: Pesanan Masuk / Verifikasi */}
            <button
              onClick={() => {
                setPaymentModalTab('confirmations');
                setIsPaymentModalOpen(true);
              }}
              className="relative px-2.5 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-colors min-h-[36px]"
              title="Verifikasi Pembayaran & Approval Pesanan Masuk"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden md:inline">Pesanan Masuk</span>
              {pendingOrdersCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-red-500 text-white text-[10px] font-bold animate-pulse">
                  {pendingOrdersCount}
                </span>
              )}
            </button>

            <button
              onClick={onOpenSyncSettings}
              className="px-2.5 py-1.5 rounded-lg bg-blue-950/80 hover:bg-blue-900 border border-blue-500/40 text-blue-300 text-xs font-semibold flex items-center gap-1.5 transition-colors min-h-[36px]"
              title="Pengaturan Sinkronisasi Real-Time"
            >
              <Database className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Sync Cloud</span>
            </button>

            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/80 border border-red-500/40 text-red-300 text-xs sm:text-sm font-semibold transition-colors min-h-[36px]"
              title="Keluar dari sesi seller"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </div>

        {/* Top Navigation Tabs: Manajemen Lapak vs Rekap Keuangan */}
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 flex items-center gap-1 sm:gap-2 border-t border-slate-800/80 bg-slate-950/60">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`flex items-center gap-1.5 py-2 px-2.5 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition-all min-h-[40px] ${
              activeTab === 'catalog'
                ? 'border-orange-500 text-orange-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Kelola Lapak (Itemku 2-Kolom)</span>
          </button>

          <button
            onClick={() => setActiveTab('profit_loss')}
            className={`flex items-center gap-1.5 py-2 px-2.5 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition-all min-h-[40px] ${
              activeTab === 'profit_loss'
                ? 'border-orange-500 text-orange-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <PieChart className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
            <span>Rekap Keuangan &amp; Laba Rugi</span>
            <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[10px] hidden sm:inline">
              PROFIT &amp; LOSS
            </span>
          </button>
        </div>
      </div>

      {/* Main Container - Optimized Compact Layout for Mobile Above-The-Fold */}
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 pt-2 sm:pt-4 space-y-2 sm:space-y-4">
        {activeTab === 'profit_loss' ? (
          /* Admin Financial Real-Time Dashboard */
          <AdminDashboard
            initialAccounts={accounts}
            initialSalesRecords={salesRecords}
            onOpenPaymentSettings={() => {
              setPaymentModalTab('config');
              setIsPaymentModalOpen(true);
            }}
            onOpenOrderApproval={() => {
              setPaymentModalTab('confirmations');
              setIsPaymentModalOpen(true);
            }}
          />
        ) : (
          /* Section 6: Responsive Layout Mobile (Itemku 2-Kolom) */
          <>
            {/* Real-time sync alert badge - Compact on Mobile */}
            <div className="bg-gradient-to-r from-emerald-950/60 via-slate-900 to-blue-950/60 p-2 sm:p-3 rounded-xl border border-emerald-500/30 flex items-center justify-between gap-2 text-[11px] sm:text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0"></span>
                <div className="truncate">
                  <span className="font-bold text-white">Sinkronisasi: </span>
                  <span className="text-emerald-300">{syncStatus.label}</span>
                </div>
              </div>
              <span className="text-slate-400 text-[10px] sm:text-[11px] shrink-0 hidden sm:inline">
                Harga Modal (COGS) dan margin ditampilkan khusus untuk Penjual.
              </span>
            </div>

            {/* Seller Statistics Overview - Compact 4-Column Strip on Mobile to Save Above-the-fold Height */}
            <div className="grid grid-cols-4 gap-1.5 sm:gap-3 bg-slate-900/80 p-2 sm:p-3.5 rounded-xl border border-slate-800">
              <div className="text-center sm:text-left space-y-0.5">
                <span className="text-[10px] text-slate-400 block truncate">Total Lapak</span>
                <span className="text-sm sm:text-xl font-black text-white block">{accounts.length}</span>
              </div>

              <div className="text-center sm:text-left space-y-0.5 border-l border-slate-800/80 pl-1.5 sm:pl-3">
                <span className="text-[10px] text-emerald-400 block truncate">Stok Ready</span>
                <span className="text-sm sm:text-xl font-black text-emerald-400 block">{totalReady}</span>
              </div>

              <div className="text-center sm:text-left space-y-0.5 border-l border-slate-800/80 pl-1.5 sm:pl-3">
                <span className="text-[10px] text-blue-400 block truncate">Terjual</span>
                <span className="text-sm sm:text-xl font-black text-blue-400 block">{totalSold}</span>
              </div>

              <div className="text-center sm:text-left space-y-0.5 border-l border-slate-800/80 pl-1.5 sm:pl-3 min-w-0">
                <span className="text-[10px] text-amber-400 block truncate">Nilai Stok</span>
                <span className="text-xs sm:text-lg font-black text-orange-400 font-mono block truncate">
                  {formatRupiah(totalEstimatedValue)}
                </span>
              </div>
            </div>

            {/* Section Header & Create Action - Inline Responsive Bar */}
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <div>
                <h2 className="text-xs sm:text-base font-black text-white flex items-center gap-1.5">
                  <span>Kelola Lapak Akun</span>
                  <span className="px-1.5 py-0.2 rounded bg-orange-500/20 text-orange-400 text-[10px] font-mono hidden sm:inline">
                    ITEMKU STYLE
                  </span>
                </h2>
                <p className="text-[10px] text-slate-400 hidden sm:block">
                  Grid 2-Kolom menampilkan Harga Jual, Modal (COGS), dan Margin Laba Penjual.
                </p>
              </div>

              {/* Add Account CTA button - Compact on Mobile */}
              <button
                onClick={onAddNewAccount}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-gradient-to-r from-orange-600 via-amber-600 to-orange-500 hover:from-orange-500 hover:to-amber-500 active:scale-95 text-white font-bold text-xs sm:text-sm shadow-md shadow-orange-950 transition-all min-h-[36px] sm:min-h-[40px] shrink-0"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>+ Tambah Lapak</span>
              </button>
            </div>

            {/* Filter Tabs for Seller - Compact Spacing */}
            <div className="flex items-center gap-1 p-0.5 sm:p-1 bg-slate-900 rounded-lg border border-slate-800 max-w-xs sm:max-w-sm">
              <button
                onClick={() => setFilterGame('ALL')}
                className={`flex-1 py-1 px-2 rounded-md text-[11px] sm:text-xs font-bold transition-all ${
                  filterGame === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Semua ({accounts.length})
              </button>
              <button
                onClick={() => setFilterGame('MLBB')}
                className={`flex-1 py-1 px-2 rounded-md text-[11px] sm:text-xs font-bold transition-all ${
                  filterGame === 'MLBB' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                MLBB ({accounts.filter((a) => a.game === 'MLBB').length})
              </button>
              <button
                onClick={() => setFilterGame('FREE_FIRE')}
                className={`flex-1 py-1 px-2 rounded-md text-[11px] sm:text-xs font-bold transition-all ${
                  filterGame === 'FREE_FIRE' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Free Fire ({accounts.filter((a) => a.game === 'FREE_FIRE').length})
              </button>
            </div>

            {/* 2-Column Grid on Mobile - Immediate Above-The-Fold Visibility */}
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3.5">
              {filteredAccounts.map((account) => (
                <AccountCard
                  key={account.id}
                  account={account}
                  isSellerMode={true}
                  onViewDetail={onViewDetail}
                  onOpenNego={() => {}}
                  onEdit={onEditAccount}
                  onDelete={onDeleteAccount}
                  onToggleStatus={onToggleStatus}
                />
              ))}
            </div>

            {filteredAccounts.length === 0 && (
              <div className="p-8 sm:p-12 text-center bg-slate-900/60 rounded-2xl border border-slate-800">
                <ShoppingBag className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-300 font-bold text-xs sm:text-sm">Belum ada lapak akun untuk filter ini.</p>
                <button
                  onClick={onAddNewAccount}
                  className="mt-2.5 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-orange-600 text-white text-xs font-bold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Lapak Sekarang</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Payment Settings & Order Approval Modal */}
      <PaymentSettingsModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        defaultTab={paymentModalTab}
      />
    </div>
  );
};
