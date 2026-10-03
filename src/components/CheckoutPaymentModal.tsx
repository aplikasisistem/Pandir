import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  QrCode,
  Building2,
  Copy,
  Check,
  Download,
  AlertTriangle,
  ShieldCheck,
  MessageCircle,
  Upload,
  CheckCircle2,
  Clock,
  ExternalLink,
  ChevronRight,
  Info,
  AlertOctagon,
  Sparkles,
} from 'lucide-react';
import { GameAccount, PaymentConfig, OrderTransaction } from '../types';
import { formatRupiah, formatNumber } from '../utils/formatter';
import { realtimeSync } from '../services/realtimeSync';
import { MLBBLogo, FreeFireLogo } from './GameBadges';
import { compressAndReadImage } from '../utils/imageUpload';
import { useToast } from '../context/ToastContext';

interface CheckoutPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: GameAccount | null;
  onProceedWhatsApp?: (waUrl: string) => void;
}

export const CheckoutPaymentModal: React.FC<CheckoutPaymentModalProps> = ({
  isOpen,
  onClose,
  account,
  onProceedWhatsApp,
}) => {
  const { showToast } = useToast();
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig>(realtimeSync.getPaymentConfig());
  const [selectedMethod, setSelectedMethod] = useState<'QRIS' | 'SEABANK'>('QRIS');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // 1. Sistem Kode Unik (3 Digit Acak 100-999) & Total Tagihan
  const [uniqueCode, setUniqueCode] = useState<number>(() => Math.floor(100 + Math.random() * 900));
  const [orderId, setOrderId] = useState<string>(() => `ORD-${Date.now().toString().slice(-6)}`);

  // Confirmation form state
  const [isConfirming, setIsConfirming] = useState(false);
  const [claimedAmountInput, setClaimedAmountInput] = useState<string>('');
  const [senderName, setSenderName] = useState('');
  const [buyerWhatsapp, setBuyerWhatsapp] = useState('');
  const [proofImage, setProofImage] = useState<string>('');
  const [buyerNotes, setBuyerNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<OrderTransaction | null>(null);

  // Reset order details & generate fresh unique code on open
  useEffect(() => {
    if (isOpen && account) {
      const code = Math.floor(100 + Math.random() * 900);
      setUniqueCode(code);
      const newOrdId = `ORD-${Date.now().toString().slice(-6)}`;
      setOrderId(newOrdId);
      setIsConfirming(false);
      setConfirmedOrder(null);
      setSenderName('');
      setProofImage('');
      setBuyerNotes('');
      // Pre-fill claimed amount with exact total amount for convenience
      const total = account.price + code;
      setClaimedAmountInput(String(total));
    }
  }, [isOpen, account?.id]);

  // Subscribe to real-time payment configuration from database
  useEffect(() => {
    const unsubscribe = realtimeSync.subscribePaymentConfig((newConfig) => {
      setPaymentConfig(newConfig);
    });
    return () => unsubscribe();
  }, []);

  // Total Tagihan = Harga Produk + Kode Unik
  const basePrice = account?.price || 0;
  const totalAmount = useMemo(() => basePrice + uniqueCode, [basePrice, uniqueCode]);

  // Read config flags
  const seabankIsActive = paymentConfig.seabank_is_active ?? paymentConfig.seabank?.isActive ?? true;
  const qrisIsActive = paymentConfig.qris_is_active ?? paymentConfig.qris?.isActive ?? true;
  const qrisMaxAmount = paymentConfig.qris_max_amount ?? paymentConfig.qris?.maxNominal ?? 500000;
  const qrisMerchant = paymentConfig.qris_merchant_name ?? paymentConfig.qris?.merchantName ?? 'PandirStore';
  const qrisImage = paymentConfig.qris_image_url ?? paymentConfig.qris?.imageUrl;

  const seabankNumber = paymentConfig.seabank_account_number ?? paymentConfig.seabank?.accountNumber ?? '901316745804';
  const seabankName = paymentConfig.seabank_account_name ?? paymentConfig.seabank?.accountName ?? 'PandirStore';

  // 2. Logika Seleksi Metode Pembayaran Dinamis (Aturan Batas Nominal 500k)
  // Jika harga_produk <= qris_max_amount DAN qris_is_active == true -> Tampilkan QRIS
  // Jika harga_produk > qris_max_amount ATAU qris_is_active == false -> Sembunyikan opsi QRIS otomatis
  const isQrisAllowed = Boolean(account && qrisIsActive && basePrice <= qrisMaxAmount);

  // Auto-switch to SeaBank if QRIS is hidden/ineligible
  useEffect(() => {
    if (!isQrisAllowed && selectedMethod === 'QRIS') {
      setSelectedMethod('SEABANK');
    }
  }, [isQrisAllowed, selectedMethod]);

  if (!isOpen || !account) return null;

  const cleanAdminWa = (
    paymentConfig.help_whatsapp ||
    paymentConfig.helpWhatsApp ||
    account.whatsappNumber ||
    '085717046895'
  ).replace(/\D/g, '');

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    showToast({
      type: 'success',
      title: 'Tersalin ke Clipboard!',
      message: `${fieldName} "${text}" berhasil disalin.`,
    });
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleDownloadQRIS = () => {
    const link = document.createElement('a');
    link.href = qrisImage;
    link.download = `QRIS-PandirStore-${orderId}.png`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast({
      type: 'info',
      title: 'Mengunduh Barcode QRIS',
      message: 'Silakan buka aplikasi M-Banking atau E-Wallet lalu scan dari galeri foto.',
    });
  };

  // 4. Pelaporan Gangguan (WhatsApp Admin Direct Link)
  const handleBankHelp = () => {
    const text = `Halo Admin PandirStore, saya ingin membayar pesanan ${orderId} (${account.title}) senilai ${formatRupiah(
      totalAmount
    )}, tapi metode pembayaran ${
      selectedMethod === 'QRIS' ? 'QRIS' : 'SeaBank'
    } sedang gangguan. Mohon bantuan nomor rekening alternatif.`;
    const waUrl = `https://wa.me/${cleanAdminWa}?text=${encodeURIComponent(text)}`;
    if (onProceedWhatsApp) {
      onProceedWhatsApp(waUrl);
    } else {
      window.open(waUrl, '_blank');
    }
  };

  // 5. Validasi JavaScript Ketat Sisi Pembeli:
  // Jika Jumlah yang Ditransfer < Total_Tagihan, tombol [Saya Sudah Bayar] wajib DISABLED!
  const parsedClaimedAmount = parseInt(claimedAmountInput.replace(/\D/g, '') || '0', 10);
  const isAmountValid = parsedClaimedAmount >= totalAmount;
  const isUnderpaid = claimedAmountInput.trim() !== '' && parsedClaimedAmount < totalAmount;
  const underpaidDifference = totalAmount - parsedClaimedAmount;

  // Handle buyer submitting "Saya Sudah Bayar"
  const handleSubmitConfirmation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senderName.trim()) {
      showToast({
        type: 'info',
        title: 'Nama Pengirim Diperlukan',
        message: 'Mohon masukkan nama pengirim atau nama akun rekening/e-wallet Anda.',
      });
      return;
    }

    if (!isAmountValid) {
      showToast({
        type: 'error',
        title: 'Nominal Kurang!',
        message: 'Nominal transfer kurang dari total tagihan resmi. Mohon transfer sesuai total tagihan.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const confirmation = await realtimeSync.addPaymentConfirmation({
        order_id: orderId,
        product_id: account.idLapak || account.id,
        product_title: account.title,
        game: account.game,
        base_price: basePrice,
        unique_code: uniqueCode,
        total_amount: totalAmount,
        claimed_amount: parsedClaimedAmount,
        payment_method: selectedMethod,
        sender_name: senderName.trim(),
        buyer_whatsapp: buyerWhatsapp.trim() || undefined,
        proof_of_payment_url: proofImage || undefined,
        notes: buyerNotes.trim() || undefined,
        status: 'PENDING',
      });

      setConfirmedOrder(confirmation);
      showToast({
        type: 'success',
        title: 'Konfirmasi Pembayaran Terkirim!',
        message: `Pesanan ${orderId} berhasil dicatat. Penjual telah menerima notifikasi pembayaran.`,
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Gagal Mengirim Konfirmasi',
        message: err?.message || 'Terjadi kendala saat mengirim konfirmasi pembayaran.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Buyer WhatsApp notification direct link
  const handleSendWaConfirmation = () => {
    const text =
      `Halo Admin PandirStore, saya sudah melakukan pembayaran untuk pesanan ${orderId} ` +
      `(${account.title}) senilai ${formatRupiah(totalAmount)} via ${
        selectedMethod === 'QRIS' ? 'QRIS (DANA/E-Wallet)' : 'Transfer Bank SeaBank'
      } atas nama pengirim "${senderName || 'Pembeli'}". ` +
      `Nominal ditransfer: ${formatRupiah(parsedClaimedAmount)} (Kode Unik: ${uniqueCode}). ` +
      `Mohon dicek mutasi di aplikasi ${
        selectedMethod === 'QRIS' ? 'DANA/E-Wallet' : 'SeaBank'
      } Anda dan diproses pengiriman akunnya. Terima kasih!`;
    const waUrl = `https://wa.me/${cleanAdminWa}?text=${encodeURIComponent(text)}`;
    if (onProceedWhatsApp) {
      onProceedWhatsApp(waUrl);
    } else {
      window.open(waUrl, '_blank');
    }
  };

  const handleUploadProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressAndReadImage(file);
      setProofImage(compressed);
      showToast({
        type: 'success',
        title: 'Bukti Transfer Terlampir',
        message: 'Foto bukti pembayaran berhasil dimuat.',
      });
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Gagal Membaca File',
        message: 'Format foto tidak didukung atau ukuran terlalu besar.',
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto animate-fadeIn safe-top safe-bottom"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
      }}
    >
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[calc(100dvh-2rem)] flex flex-col">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-3.5 sm:px-4 py-2.5 sm:py-3 border-b border-slate-800 bg-slate-950/90 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                <span>Checkout Pembayaran Aman</span>
                <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono">
                  SISTEM KODE UNIK
                </span>
              </h2>
              <p className="text-[10px] sm:text-[11px] text-slate-400">PANDIRSTORE.ID Gateway Pembayaran</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-3.5 sm:p-5 overflow-y-auto space-y-3.5 text-xs">
          {/* Product Summary Card with Unique Code Breakdown */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-11 h-11 rounded-lg bg-slate-900 overflow-hidden border border-slate-800 shrink-0">
                  <img
                    src={account.thumbnail}
                    alt={account.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                    {account.game === 'MLBB' ? (
                      <MLBBLogo className="w-3 h-3" />
                    ) : (
                      <FreeFireLogo className="w-3 h-3" />
                    )}
                    <span>ID: {account.idLapak || account.id}</span>
                  </div>
                  <h4 className="text-xs font-bold text-white truncate max-w-[200px] sm:max-w-xs mt-0.5">
                    {account.title}
                  </h4>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[10px] text-slate-400 block font-mono">ID Pesanan:</span>
                <span className="text-xs font-bold text-slate-200 font-mono">{orderId}</span>
              </div>
            </div>

            {/* Total Tagihan & Kode Unik Highlight Box */}
            <div className="p-2.5 rounded-lg bg-slate-900 border border-orange-500/30 flex items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                  <span>Harga: {formatRupiah(basePrice)}</span>
                  <span>+</span>
                  <span className="text-amber-300 font-bold font-mono">Kode Unik: {uniqueCode}</span>
                </div>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-[11px] text-slate-300 font-bold">Total Tagihan:</span>
                  <span className="text-base sm:text-lg font-black text-orange-400 font-mono tracking-tight">
                    {formatRupiah(totalAmount)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => copyToClipboard(String(totalAmount), 'Total Nominal Tagihan')}
                className="px-2.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs flex items-center gap-1 transition-all shadow-sm active:scale-95 shrink-0"
                title="Salin nominal total persis dengan kode unik"
              >
                {copiedField === 'Total Nominal Tagihan' ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>Salin Total Nominal</span>
              </button>
            </div>
          </div>

          {/* 3. Peringatan Pembayaran Ketat (Warna Merah / Alert Box) */}
          <div className="p-3 rounded-xl bg-red-950/70 border border-red-500/60 flex items-start gap-2.5 text-red-200 text-[11px] leading-relaxed shadow-md">
            <AlertOctagon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-black text-red-300 uppercase tracking-wide block mb-0.5">
                PERHATIAN PEMBAYARAN KETAT:
              </span>
              Wajib transfer tepat <strong>{formatRupiah(totalAmount)}</strong> (termasuk 3 digit kode unik <strong>{uniqueCode}</strong>). Pembayaran yang kurang atau berlebih tidak akan diproses otomatis dan akun game tidak akan dikirimkan.
            </div>
          </div>

          {/* SCREEN: Confirmed Waiting State */}
          {confirmedOrder ? (
            <div className="p-5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-center space-y-4 animate-fadeIn">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">Pembayaran Sedang Diverifikasi!</h3>
                <p className="text-xs text-slate-300 mt-1 max-w-md mx-auto">
                  Terima kasih, <strong>{senderName}</strong>. Data konfirmasi pembayaran pesanan{' '}
                  <span className="font-mono text-emerald-400 font-bold">{orderId}</span> senilai{' '}
                  <span className="font-mono font-bold text-orange-400">{formatRupiah(totalAmount)}</span> telah tersimpan di sistem Cloud kami.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-left space-y-1.5 text-[11px] max-w-sm mx-auto">
                <div className="flex justify-between text-slate-400">
                  <span>Metode Pembayaran:</span>
                  <span className="font-bold text-white">{selectedMethod}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Nama Pengirim:</span>
                  <span className="font-bold text-white">{senderName}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Nominal Ditransfer:</span>
                  <span className="font-mono font-bold text-emerald-400">{formatRupiah(parsedClaimedAmount)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Status Approval:</span>
                  <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold">
                    MENUNGGU APPROVAL PENJUAL
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={handleSendWaConfirmation}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950 active:scale-95 transition-all"
                >
                  <MessageCircle className="w-4 h-4 fill-white" />
                  <span>Kirim Notifikasi Langsung ke WhatsApp Penjual</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
                >
                  Kembali ke Katalog
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Payment Method Selector Tabs */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Pilih Metode Pembayaran
                </label>
                <div className={`grid ${isQrisAllowed && seabankIsActive ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
                  {/* QRIS Tab Option (Only shown if isQrisAllowed == true) */}
                  {isQrisAllowed && (
                    <button
                      type="button"
                      onClick={() => setSelectedMethod('QRIS')}
                      className={`p-2.5 sm:p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all text-center relative ${
                        selectedMethod === 'QRIS'
                          ? 'bg-blue-950/80 border-blue-500 text-white shadow-md ring-2 ring-blue-500/20'
                          : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900'
                      }`}
                    >
                      <QrCode className="w-5 h-5 text-blue-400" />
                      <div>
                        <div className="font-bold text-xs text-white">QRIS (Semua E-Wallet)</div>
                        <div className="text-[10px] text-slate-400">DANA / GoPay / OVO / M-Banking</div>
                      </div>
                      <span className="px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 text-[9px] font-bold">
                        Maks Rp 500k
                      </span>
                    </button>
                  )}

                  {/* SeaBank Tab Option */}
                  {seabankIsActive && (
                    <button
                      type="button"
                      onClick={() => setSelectedMethod('SEABANK')}
                      className={`p-2.5 sm:p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all text-center relative ${
                        selectedMethod === 'SEABANK'
                          ? 'bg-orange-950/80 border-orange-500 text-white shadow-md ring-2 ring-orange-500/20'
                          : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900'
                      }`}
                    >
                      <Building2 className="w-5 h-5 text-orange-400" />
                      <div>
                        <div className="font-bold text-xs text-white">Transfer Bank SeaBank</div>
                        <div className="text-[10px] text-slate-400">SeaBank / BCA / Mandiri / BI-FAST</div>
                      </div>
                      {!isQrisAllowed && (
                        <span className="px-1.5 py-0.2 rounded bg-orange-500/20 text-orange-300 text-[9px] font-bold">
                          Metode Utama
                        </span>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Notice when QRIS is automatically hidden because price > 500k */}
              {!isQrisAllowed && (
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-2 text-slate-400 text-[11px] leading-relaxed">
                  <Info className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-white font-semibold">Aturan Nominal (Rule 500k): </span>
                    Untuk transaksi dengan nominal di atas {formatRupiah(qrisMaxAmount)}, pembayaran wajib dialihkan ke <strong>Transfer Bank SeaBank</strong> demi keamanan limit transaksi.
                  </div>
                </div>
              )}

              {/* Dynamic Payment Body */}
              {selectedMethod === 'QRIS' && isQrisAllowed ? (
                /* QRIS View */
                <div className="p-3.5 sm:p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-slate-400 text-[11px] pb-2 border-b border-slate-800">
                    <span className="flex items-center gap-1 font-bold text-white">
                      <QrCode className="w-4 h-4 text-blue-400" />
                      <span>Scan Barcode QRIS</span>
                    </span>
                    <span className="font-mono text-emerald-400 font-semibold">
                      Merchant: {qrisMerchant}
                    </span>
                  </div>

                  {/* QRIS Image Container */}
                  <div className="bg-white p-3 rounded-xl flex flex-col items-center justify-center max-w-[240px] mx-auto shadow-xl">
                    <img
                      src={qrisImage}
                      alt={`QRIS ${qrisMerchant}`}
                      className="w-48 h-48 object-contain"
                    />
                    <div className="mt-1.5 text-center text-slate-900">
                      <span className="text-xs font-black tracking-wide block uppercase">
                        {qrisMerchant}
                      </span>
                      <span className="text-[10px] text-slate-600 block">
                        NMID / QRIS Standar Pembayaran Nasional
                      </span>
                    </div>
                  </div>

                  {/* Unduh QRIS Button */}
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadQRIS}
                      className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors active:scale-95 shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5 text-blue-400" />
                      <span>Unduh QRIS</span>
                    </button>
                  </div>

                  {/* QRIS Instructions */}
                  <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                    <span className="font-bold text-slate-200 block text-xs">Instruksi Scan QRIS:</span>
                    <ol className="list-decimal list-inside space-y-0.5 leading-relaxed">
                      <li>Buka aplikasi DANA, BCA, GoPay, OVO, ShopeePay, atau Mobile Banking lainnya.</li>
                      <li>Pilih menu <strong>Scan / Bayar QRIS</strong>.</li>
                      <li>Arahkan kamera ke QR di atas atau pilih gambar QR dari galeri.</li>
                      <li>Pastikan merchant adalah <strong>{qrisMerchant}</strong>.</li>
                      <li>
                        Masukkan nominal persis <strong>{formatRupiah(totalAmount)}</strong>.
                      </li>
                    </ol>
                  </div>
                </div>
              ) : (
                /* SeaBank Transfer View */
                <div className="p-3.5 sm:p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-slate-400 text-[11px] pb-2 border-b border-slate-800">
                    <span className="flex items-center gap-1 font-bold text-white">
                      <Building2 className="w-4 h-4 text-orange-400" />
                      <span>Rekening SeaBank Resmi</span>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 font-bold font-mono">
                      PT Bank Seabank Indonesia
                    </span>
                  </div>

                  {/* SeaBank Account Box */}
                  <div className="p-3.5 sm:p-4 rounded-xl bg-gradient-to-br from-slate-900 via-slate-900 to-orange-950/30 border border-orange-500/30 space-y-2.5 shadow-lg">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase tracking-wider">
                          Nomor Rekening SeaBank
                        </span>
                        <span className="text-base sm:text-xl font-black text-white font-mono tracking-wider">
                          {seabankNumber}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(seabankNumber, 'Nomor Rekening SeaBank')}
                        className="px-3 py-1.5 sm:py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 shrink-0"
                      >
                        {copiedField === 'Nomor Rekening SeaBank' ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>Salin Rekening</span>
                      </button>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Atas Nama Rekening:</span>
                        <span className="font-bold text-orange-300 uppercase">{seabankName}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Kode Bank:</span>
                        <span className="font-mono font-bold text-white">535</span>
                      </div>
                    </div>
                  </div>

                  {/* SeaBank Instructions */}
                  <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                    <span className="font-bold text-slate-200 block text-xs">Instruksi Transfer:</span>
                    <p className="leading-relaxed">
                      • Dari sesama SeaBank: Bebas biaya admin, transfer instan 24 jam.<br />
                      • Dari bank lain: Gunakan fitur <strong>BI-FAST</strong> agar bebas biaya transfer. Masukkan nominal tepat <strong>{formatRupiah(totalAmount)}</strong>.
                    </p>
                  </div>
                </div>
              )}

              {/* 4. Fitur Pelaporan Gangguan / Bantuan Penjual */}
              <div className="p-2.5 sm:p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Metode pembayaran sedang gangguan atau butuh bantuan?</span>
                </div>
                <button
                  type="button"
                  onClick={handleBankHelp}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors border border-amber-500/20 active:scale-95 shrink-0"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Bank Gangguan? Hubungi Admin</span>
                </button>
              </div>

              {/* 5. Form Verifikasi & Validasi Pembayaran Sisi Pembeli */}
              <div className="pt-2 border-t border-slate-800">
                {!isConfirming ? (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsConfirming(true)}
                      className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-green-600 to-emerald-500 hover:from-emerald-500 hover:to-green-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950 transition-all active:scale-95"
                    >
                      <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                      <span>Konfirmasi Pembayaran (Saya Sudah Bayar)</span>
                    </button>

                    <button
                      type="button"
                      onClick={onClose}
                      className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
                    >
                      Batal
                    </button>
                  </div>
                ) : (
                  <form
                    onSubmit={handleSubmitConfirmation}
                    className="p-3.5 sm:p-4 rounded-xl bg-slate-950 border border-emerald-500/40 space-y-3 animate-fadeIn"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <span className="font-bold text-white flex items-center gap-1.5 text-xs">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Form Konfirmasi Pembayaran Pembeli</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsConfirming(false)}
                        className="text-[11px] text-slate-400 hover:text-white"
                      >
                        Tutup Form
                      </button>
                    </div>

                    {/* Input 1: Jumlah yang Ditransfer dengan Validasi Ketat */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-bold text-slate-300">
                          Jumlah yang Ditransfer (Rp) <span className="text-red-400">*</span>
                        </label>
                        <span className="text-[10px] text-slate-400">
                          Tagihan: <strong className="text-orange-400 font-mono">{formatRupiah(totalAmount)}</strong>
                        </span>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                          Rp
                        </span>
                        <input
                          type="text"
                          required
                          value={claimedAmountInput}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            setClaimedAmountInput(val ? formatNumber(parseInt(val, 10)) : '');
                          }}
                          placeholder={`Wajib tepat ${formatNumber(totalAmount)}`}
                          className={`w-full pl-9 pr-3 py-2 rounded-lg bg-slate-900 border text-xs font-mono font-bold text-white placeholder-slate-500 focus:outline-none ${
                            isUnderpaid
                              ? 'border-red-500 focus:border-red-500'
                              : 'border-slate-700 focus:border-emerald-500'
                          }`}
                        />
                      </div>

                      {/* Error Indicator Pesan jika nominal kurang */}
                      {isUnderpaid && (
                        <div className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-red-400 bg-red-950/60 p-1.5 rounded-md border border-red-500/40">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            Nominal transfer kurang dari total tagihan! (Kurang {formatRupiah(underpaidDifference)})
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Input 2: Nama Pengirim */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Nama Pemilik Rekening / Pengirim <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={senderName}
                        onChange={(e) => setSenderName(e.target.value)}
                        placeholder="Contoh: Budi Santoso (Rekening BCA / DANA)"
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    {/* Input 3: WhatsApp Pembeli */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Nomor WhatsApp Pembeli (Opsional)
                      </label>
                      <input
                        type="text"
                        value={buyerWhatsapp}
                        onChange={(e) => setBuyerWhatsapp(e.target.value)}
                        placeholder="Contoh: 081234567890 (Untuk pengiriman data akun)"
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    {/* Input 4: Upload Bukti Transfer */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Upload Bukti Transfer / Screenshot (Opsional)
                      </label>
                      <div className="flex items-center gap-2">
                        <label className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-600 text-xs text-slate-400 hover:text-white flex items-center justify-center gap-1.5 cursor-pointer transition-colors">
                          <Upload className="w-3.5 h-3.5" />
                          <span>{proofImage ? 'Ganti Foto Bukti' : 'Pilih Foto Struk / Tangkapan Layar'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleUploadProof}
                            className="hidden"
                          />
                        </label>
                        {proofImage && (
                          <div className="w-9 h-9 rounded-lg border border-emerald-500 overflow-hidden shrink-0">
                            <img src={proofImage} alt="Bukti" className="w-full h-full object-cover" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Input 5: Catatan Pembeli */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Catatan Tambahan (Opsional)
                      </label>
                      <input
                        type="text"
                        value={buyerNotes}
                        onChange={(e) => setBuyerNotes(e.target.value)}
                        placeholder="Contoh: Tolong kirim akun via WhatsApp"
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    {/* Submit Actions with STRICT VALIDATION */}
                    <div className="pt-1 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsConfirming(false)}
                        className="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold"
                      >
                        Batal
                      </button>

                      {/* Tombol [Saya Sudah Bayar] Wajib DISABLED jika nominal kurang atau nama kosong */}
                      <button
                        type="submit"
                        disabled={isSubmitting || !isAmountValid || !senderName.trim()}
                        className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                        title={
                          !isAmountValid
                            ? 'Nominal transfer kurang dari total tagihan!'
                            : !senderName.trim()
                            ? 'Masukkan nama pengirim'
                            : 'Kirim konfirmasi pembayaran'
                        }
                      >
                        {isSubmitting ? 'Mengirim...' : 'Saya Sudah Bayar'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
