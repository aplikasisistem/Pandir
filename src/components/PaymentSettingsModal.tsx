import React, { useState, useEffect } from 'react';
import {
  X,
  Building2,
  QrCode,
  Save,
  CheckCircle2,
  Upload,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  CreditCard,
  RefreshCw,
  Bell,
  Eye,
  Check,
  Trash2,
  AlertTriangle,
  MessageCircle,
  ThumbsUp,
  ThumbsDown,
  Info,
  Zap,
  Slash,
} from 'lucide-react';
import { PaymentConfig, OrderTransaction, OrderStatus } from '../types';
import { realtimeSync } from '../services/realtimeSync';
import { formatRupiah, formatNumber } from '../utils/formatter';
import { compressAndReadImage } from '../utils/imageUpload';
import { useToast } from '../context/ToastContext';

interface PaymentSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'config' | 'confirmations';
}

export const PaymentSettingsModal: React.FC<PaymentSettingsModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'config',
}) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'config' | 'confirmations'>(defaultTab);

  // Form State for Payment Settings
  const [seabankActive, setSeabankActive] = useState(true);
  const [seabankNumber, setSeabankNumber] = useState('901316745804');
  const [seabankName, setSeabankName] = useState('PandirStore');

  const [qrisActive, setQrisActive] = useState(true);
  const [qrisMerchantName, setQrisMerchantName] = useState('PandirStore');
  const [qrisMaxNominal, setQrisMaxNominal] = useState('500000');
  const [qrisImageUrl, setQrisImageUrl] = useState('');

  const [helpWhatsApp, setHelpWhatsApp] = useState('085717046895');
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [fonnteToken, setFonnteToken] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');

  const [confirmations, setConfirmations] = useState<OrderTransaction[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedProof, setSelectedProof] = useState<string | null>(null);

  // Load and subscribe to real-time payment config and orders
  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
      const current = realtimeSync.getPaymentConfig();
      setSeabankActive(current.seabank_is_active ?? current.seabank?.isActive ?? true);
      setSeabankNumber(current.seabank_account_number ?? current.seabank?.accountNumber ?? '901316745804');
      setSeabankName(current.seabank_account_name ?? current.seabank?.accountName ?? 'PandirStore');

      setQrisActive(current.qris_is_active ?? current.qris?.isActive ?? true);
      setQrisMerchantName(current.qris_merchant_name ?? current.qris?.merchantName ?? 'PandirStore');
      setQrisMaxNominal(String(current.qris_max_amount ?? current.qris?.maxNominal ?? 500000));
      setQrisImageUrl(current.qris_image_url ?? current.qris?.imageUrl ?? '');

      setHelpWhatsApp(current.help_whatsapp || current.helpWhatsApp || '085717046895');
      setTelegramBotToken(current.webhook?.telegramBotToken || '');
      setTelegramChatId(current.webhook?.telegramChatId || '');
      setFonnteToken(current.webhook?.fonnteToken || '');
      setWebhookUrl(current.webhook?.webhookUrl || '');

      setConfirmations(realtimeSync.getPaymentConfirmations());

      const unsubConfig = realtimeSync.subscribePaymentConfig((cfg) => {
        setSeabankActive(cfg.seabank_is_active ?? cfg.seabank?.isActive ?? true);
        setSeabankNumber(cfg.seabank_account_number ?? cfg.seabank?.accountNumber ?? '901316745804');
        setSeabankName(cfg.seabank_account_name ?? cfg.seabank?.accountName ?? 'PandirStore');

        setQrisActive(cfg.qris_is_active ?? cfg.qris?.isActive ?? true);
        setQrisMerchantName(cfg.qris_merchant_name ?? cfg.qris?.merchantName ?? 'PandirStore');
        setQrisMaxNominal(String(cfg.qris_max_amount ?? cfg.qris?.maxNominal ?? 500000));
        setQrisImageUrl(cfg.qris_image_url ?? cfg.qris?.imageUrl ?? '');

        setHelpWhatsApp(cfg.help_whatsapp || cfg.helpWhatsApp || '085717046895');
      });

      const unsubConf = realtimeSync.subscribePaymentConfirmations((confs) => {
        setConfirmations(confs);
      });

      return () => {
        unsubConfig();
        unsubConf();
      };
    }
  }, [isOpen, defaultTab]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const maxNom = parseInt(qrisMaxNominal.replace(/\D/g, '') || '500000', 10);
      await realtimeSync.updatePaymentConfig({
        seabank_account_number: seabankNumber.trim() || '901316745804',
        seabank_account_name: seabankName.trim() || 'PandirStore',
        seabank_is_active: seabankActive,
        qris_image_url: qrisImageUrl.trim() || realtimeSync.getPaymentConfig().qris.imageUrl,
        qris_merchant_name: qrisMerchantName.trim() || 'PandirStore',
        qris_max_amount: maxNom > 0 ? maxNom : 500000,
        qris_is_active: qrisActive,
        help_whatsapp: helpWhatsApp.trim() || '085717046895',
        helpWhatsApp: helpWhatsApp.trim() || '085717046895',
        webhook: {
          telegramBotToken: telegramBotToken.trim() || undefined,
          telegramChatId: telegramChatId.trim() || undefined,
          fonnteToken: fonnteToken.trim() || undefined,
          webhookUrl: webhookUrl.trim() || undefined,
        },
      });

      showToast({
        type: 'success',
        title: 'Pengaturan Pembayaran Tersimpan!',
        message: 'Pengaturan rekening dan QRIS langsung aktif real-time di checkout pembeli.',
      });
      onClose();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Gagal Menyimpan',
        message: err?.message || 'Gagal menyimpan konfigurasi ke Cloud Firestore.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUploadNewQrisImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressAndReadImage(file);
      setQrisImageUrl(compressed);
      showToast({
        type: 'success',
        title: 'Foto QRIS Baru Dimuat',
        message: 'Gambar QRIS berhasil dimuat, tekan "Simpan Pengaturan" untuk menerapkan.',
      });
    } catch {
      showToast({
        type: 'error',
        title: 'Gagal Membaca Gambar',
        message: 'Pastikan file berupa gambar PNG/JPG.',
      });
    }
  };

  // Section 4: Workflow Approval Penjual
  const handleAutoValidate = async (order: OrderTransaction) => {
    const orderKey = order.order_id || order.id;
    const official = order.total_amount || order.amount || 0;
    const claimed = order.claimed_amount || order.amount || 0;

    if (claimed < official) {
      const diff = official - claimed;
      try {
        await realtimeSync.updatePaymentConfirmationStatus(orderKey, 'REJECTED_UNDERPAID');
        showToast({
          type: 'error',
          title: 'Validasi Cepat: Ditolak Otomatis!',
          message: `Pesanan ${orderKey} ditolak (REJECTED_UNDERPAID). Nominal Kurang: ${formatRupiah(diff)}.`,
        });
      } catch (err: any) {
        showToast({
          type: 'error',
          title: 'Gagal Memvalidasi',
          message: err?.message || 'Kendala saat update status.',
        });
      }
    } else {
      try {
        await realtimeSync.updatePaymentConfirmationStatus(orderKey, 'PAID_APPROVED');
        showToast({
          type: 'success',
          title: 'Validasi Cepat: Disetujui Otomatis!',
          message: `Pesanan ${orderKey} disetujui (PAID_APPROVED)! Akun otomatis diset SOLD_OUT dan dicatat ke Buku Penjualan.`,
        });
      } catch (err: any) {
        showToast({
          type: 'error',
          title: 'Gagal Menyetujui',
          message: err?.message || 'Kendala saat update status ke Cloud Firestore.',
        });
      }
    }
  };

  const handleApproveOrder = async (order: OrderTransaction) => {
    const orderKey = order.order_id || order.id;
    try {
      await realtimeSync.updatePaymentConfirmationStatus(orderKey, 'PAID_APPROVED');
      showToast({
        type: 'success',
        title: 'Pesanan Disetujui (PAID_APPROVED)!',
        message: `Pembayaran pesanan ${orderKey} telah diverifikasi. Akun game diubah ke SOLD_OUT dan dicatat di Buku Penjualan.`,
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Gagal Menyetujui',
        message: err?.message || 'Kendala saat update status ke Cloud Firestore.',
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

  const handleCancelOrder = async (order: OrderTransaction) => {
    const orderKey = order.order_id || order.id;
    try {
      await realtimeSync.updatePaymentConfirmationStatus(orderKey, 'CANCELLED');
      showToast({
        type: 'info',
        title: 'Pesanan Dibatalkan',
        message: `Status pesanan ${orderKey} diubah ke CANCELLED (Bukti palsu / dibatalkan).`,
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Gagal Membatalkan',
        message: err?.message || 'Kendala saat update status.',
      });
    }
  };

  // Chat WhatsApp Pembeli for rejected underpaid or follow-up
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
        : `Status pesanan Anda telah kami periksa. Mohon tunggu proses pengiriman data akun.`);

    const waUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/${helpWhatsApp.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;

    window.open(waUrl, '_blank');
  };

  const pendingCount = confirmations.filter(
    (c) => c.status === 'PENDING' || c.status === 'MENUNGGU_VERIFIKASI'
  ).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto animate-fadeIn safe-top safe-bottom"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
      }}
    >
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[calc(100dvh-2rem)] flex flex-col">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-orange-500/20 text-orange-400">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>Pengaturan Pembayaran &amp; Approval Pesanan</span>
                <span className="px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 text-[10px] font-mono">
                  Cloud Firestore Real-Time
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Kelola SeaBank, QRIS dinamis, dan verifikasi bukti transaksi pembeli
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation: Konfigurasi Rekening vs Verifikasi Pembeli */}
        <div className="flex items-center border-b border-slate-800 bg-slate-950/60 px-4 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className={`py-2.5 px-3 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'config'
                ? 'border-orange-500 text-orange-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Pengaturan Rekening &amp; QRIS
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('confirmations')}
            className={`py-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'confirmations'
                ? 'border-orange-500 text-orange-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Verifikasi &amp; Approval Pesanan</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-red-500 text-white text-[10px] font-bold animate-pulse">
                {pendingCount} Menunggu
              </span>
            )}
          </button>
        </div>

        {/* Body Container */}
        <div className="p-3.5 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {activeTab === 'config' ? (
            /* TAB 1: FORM PENGATURAN PEMBAYARAN DINAMIS */
            <form onSubmit={handleSave} className="space-y-4">
              {/* Card 1: SeaBank Configuration */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-orange-400" />
                    <span className="font-bold text-white text-xs uppercase tracking-wider">
                      1. Metode Transfer Bank SeaBank
                    </span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-[11px] font-semibold text-slate-300">
                      {seabankActive ? 'Aktif' : 'Nonaktif'}
                    </span>
                    <input
                      type="checkbox"
                      checked={seabankActive}
                      onChange={(e) => setSeabankActive(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Nomor Rekening SeaBank (Default: 901316745804) <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={seabankNumber}
                      onChange={(e) => setSeabankNumber(e.target.value)}
                      placeholder="901316745804"
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Nama Pemilik Rekening <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={seabankName}
                      onChange={(e) => setSeabankName(e.target.value)}
                      placeholder="PandirStore"
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white uppercase placeholder-slate-500 focus:outline-none focus:border-orange-500"
                    />
                  </div>
                </div>
              </div>

              {/* Card 2: QRIS Configuration */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-blue-400" />
                    <span className="font-bold text-white text-xs uppercase tracking-wider">
                      2. Metode Barcode QRIS (DANA / E-Wallet)
                    </span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-[11px] font-semibold text-slate-300">
                      {qrisActive ? 'Aktif' : 'Nonaktif'}
                    </span>
                    <input
                      type="checkbox"
                      checked={qrisActive}
                      onChange={(e) => setQrisActive(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Nama Merchant QRIS (Default: PandirStore) <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={qrisMerchantName}
                      onChange={(e) => setQrisMerchantName(e.target.value)}
                      placeholder="PandirStore"
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Batas Maksimal Nominal QRIS (Rp) <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formatNumber(parseInt(qrisMaxNominal.replace(/\D/g, '') || '0', 10))}
                      onChange={(e) => setQrisMaxNominal(e.target.value.replace(/\D/g, ''))}
                      placeholder="500000"
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      Di atas nominal ini, opsi QRIS otomatis disembunyikan dan dialihkan ke SeaBank.
                    </span>
                  </div>
                </div>

                {/* QRIS Photo Upload / Replace */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1.5">
                    Foto Barcode QRIS Aktif (Ganti File QRIS Baru)
                  </label>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="w-20 h-20 bg-white p-1 rounded-lg shrink-0 flex items-center justify-center border border-slate-700 overflow-hidden">
                      {qrisImageUrl ? (
                        <img src={qrisImageUrl} alt="QRIS Preview" className="w-full h-full object-contain" />
                      ) : (
                        <QrCode className="w-8 h-8 text-slate-400" />
                      )}
                    </div>
                    <div className="space-y-1.5 flex-1">
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer border border-slate-700 transition-colors">
                        <Upload className="w-3.5 h-3.5 text-blue-400" />
                        <span>Upload Foto QRIS Baru</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleUploadNewQrisImage}
                          className="hidden"
                        />
                      </label>
                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        Foto baru akan langsung disimpan ke Cloud dan menggantikan barcode QRIS aktif pada checkout pembeli secara dinamis.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 3: Help WA & Webhook Notification */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                  <Bell className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-white text-xs uppercase tracking-wider">
                    3. Bantuan WhatsApp &amp; Notifikasi Instan Penjual
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Nomor WhatsApp Admin untuk Bantuan Pembayaran
                  </label>
                  <input
                    type="text"
                    value={helpWhatsApp}
                    onChange={(e) => setHelpWhatsApp(e.target.value)}
                    placeholder="085717046895"
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    Digunakan saat pembeli menekan tombol &quot;Bank Gangguan? Hubungi Admin&quot;.
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="font-semibold text-slate-300">Bot Telegram / WhatsApp Webhook Fonnte (Opsional)</span>
                    <span className="text-[10px] text-emerald-400">Notifikasi Push Otomatis</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={telegramBotToken}
                      onChange={(e) => setTelegramBotToken(e.target.value)}
                      placeholder="Telegram Bot Token"
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-600 font-mono"
                    />
                    <input
                      type="text"
                      value={telegramChatId}
                      onChange={(e) => setTelegramChatId(e.target.value)}
                      placeholder="Telegram Chat ID"
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-600 font-mono"
                    />
                    <input
                      type="text"
                      value={fonnteToken}
                      onChange={(e) => setFonnteToken(e.target.value)}
                      placeholder="Fonnte Token (WhatsApp Bot)"
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-600 font-mono sm:col-span-2"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 via-amber-600 to-orange-500 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg active:scale-95 disabled:opacity-60 transition-all"
                >
                  {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>Simpan Pengaturan Pembayaran</span>
                </button>
              </div>
            </form>
          ) : (
            /* TAB 2: WORKFLOW APPROVAL PENJUAL (DASHBOARD ADMIN) */
            <div className="space-y-3">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Daftar Transaksi Masuk / Pesanan Pembeli ({confirmations.length})</span>
                <span className="text-[11px] text-slate-500">Real-time sinkron dari checkout</span>
              </div>

              {confirmations.length === 0 ? (
                <div className="p-8 text-center bg-slate-950/60 rounded-xl border border-slate-800 text-slate-500">
                  Belum ada konfirmasi pembayaran baru dari pembeli.
                </div>
              ) : (
                <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                  {confirmations.map((conf) => {
                    const orderKey = conf.order_id || conf.id;
                    const officialTotal = conf.total_amount || conf.amount || 0;
                    const claimed = conf.claimed_amount || conf.amount || officialTotal;
                    const diff = officialTotal - claimed;
                    const hasDiscrepancy = claimed < officialTotal;
                    const proofUrl = conf.proof_of_payment_url || conf.proofImageUrl;
                    const isPending = conf.status === 'PENDING' || conf.status === 'MENUNGGU_VERIFIKASI';
                    const isApproved = conf.status === 'PAID_APPROVED' || conf.status === 'TERVERIFIKASI';
                    const isRejected = conf.status === 'REJECTED_UNDERPAID' || conf.status === 'DITOLAK';
                    const isCancelled = conf.status === 'CANCELLED';

                    return (
                      <div
                        key={orderKey}
                        className="p-3.5 sm:p-4 hover:bg-slate-900/60 transition-colors flex flex-col space-y-3"
                      >
                        {/* Order Header & Status Badge */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-orange-400 text-xs sm:text-sm">
                              {orderKey}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                isApproved
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : isRejected
                                  ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                  : isCancelled
                                  ? 'bg-slate-700/60 text-slate-300 border border-slate-600'
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-[11px]">
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
                          <div className="text-[11px] text-slate-400 italic bg-slate-900/40 p-2 rounded-lg border border-slate-800/60">
                            Catatan Pembeli: &quot;{conf.notes}&quot;
                          </div>
                        )}

                        {/* Action Buttons for Seller Approval */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                          {proofUrl ? (
                            <button
                              type="button"
                              onClick={() => setSelectedProof(proofUrl)}
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

                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                            {isPending && (
                              <>
                                {/* 1. Validasi Cepat Otomatis: Tolak jika kurang, Setujui + SOLD_OUT + Catatan Penjualan jika pas/lebih */}
                                <button
                                  type="button"
                                  onClick={() => handleAutoValidate(conf)}
                                  className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-bold flex items-center gap-1 shadow-md shadow-amber-950 transition-all active:scale-95"
                                  title="Validasi Otomatis: Tolak jika nominal transfer kurang, Setujui jika cukup"
                                >
                                  <Zap className="w-3.5 h-3.5 fill-white" />
                                  <span>Validasi Cepat Otomatis</span>
                                </button>

                                {/* 2. Setujui Manual */}
                                <button
                                  type="button"
                                  onClick={() => handleApproveOrder(conf)}
                                  className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white text-xs font-bold flex items-center gap-1 shadow-md shadow-emerald-950 transition-all active:scale-95"
                                  title="Setujui pembayaran manual, ubah status akun katalog jadi SOLD_OUT, dan catat ke buku laba rugi"
                                >
                                  <ThumbsUp className="w-3.5 h-3.5" />
                                  <span>Setujui Manual</span>
                                </button>

                                {/* 3. Tolak Manual: Kurang Transfer */}
                                <button
                                  type="button"
                                  onClick={() => handleRejectUnderpaid(conf)}
                                  className="px-2.5 py-1.5 rounded-lg bg-red-950 hover:bg-red-900 text-red-300 border border-red-500/40 text-xs font-bold flex items-center gap-1 transition-all active:scale-95"
                                  title="Tolak pesanan karena nominal transfer kurang"
                                >
                                  <ThumbsDown className="w-3.5 h-3.5" />
                                  <span>Tolak Kurang</span>
                                </button>

                                {/* 4. Tolak Manual: Batalkan / Palsu */}
                                <button
                                  type="button"
                                  onClick={() => handleCancelOrder(conf)}
                                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold flex items-center gap-1 transition-all active:scale-95"
                                  title="Batalkan pesanan (bukti tidak valid atau dibatalkan)"
                                >
                                  <Slash className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Batal</span>
                                </button>
                              </>
                            )}

                            {/* Tombol Cepat "Chat WhatsApp Pembeli" (Sangat berguna saat ditolak / retur) */}
                            <button
                              type="button"
                              onClick={() => handleChatBuyer(conf)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-1 transition-all active:scale-95"
                              title="Chat WhatsApp Pembeli untuk retur atau penyelesaian selisih"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>Chat WA Pembeli</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Proof Viewer Lightbox */}
      {selectedProof && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn">
          <div className="relative max-w-lg w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex justify-between items-center text-white">
              <span className="font-bold text-xs">Foto Bukti Transfer Pembeli</span>
              <button
                onClick={() => setSelectedProof(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="rounded-xl overflow-hidden max-h-[70vh] bg-black flex items-center justify-center">
              <img
                src={selectedProof}
                alt="Bukti Transfer"
                className="max-w-full max-h-[70vh] object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
