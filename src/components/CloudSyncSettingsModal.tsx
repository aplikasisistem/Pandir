import React, { useState } from 'react';
import { Database, X, CheckCircle, Wifi, RefreshCw, Key, ShieldCheck, CheckCircle2, CloudUpload } from 'lucide-react';
import { realtimeSync } from '../services/realtimeSync';
import { testConnection } from '../services/firebase';
import firebaseConfig from '../../firebase-applet-config.json';
import { useToast } from '../context/ToastContext';

interface CloudSyncSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CloudSyncSettingsModal: React.FC<CloudSyncSettingsModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const status = realtimeSync.getSyncStatus();
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      await testConnection();
      setTestResult('Koneksi Firestore Server Berhasil & Sinkronisasi Real-Time Aktif!');
      showToast({
        type: 'success',
        title: 'Koneksi Cloud Firestore Stabil',
        message: 'Database real-time terhubung tanpa hambatan ke server Firebase.',
      });
    } catch (err: any) {
      setTestResult('Koneksi mengalami kendala: ' + (err?.message || 'Offline'));
    } finally {
      setIsTesting(false);
    }
  };

  const handleUploadLocalToCloud = async () => {
    setIsSyncing(true);
    try {
      const res = await realtimeSync.syncLocalToCloudNow();
      showToast({
        type: 'success',
        title: 'Data Berhasil Diunggah ke Cloud!',
        message: `Berhasil mengunggah ${res.salesSynced} transaksi penjualan & ${res.accountsSynced} akun dari perangkat ini ke Cloud Firestore. Semua perangkat lain (PC/Laptop) kini otomatis terupdate!`,
      });
      setTestResult(`Berhasil sinkronkan ${res.salesSynced} penjualan & ${res.accountsSynced} akun ke cloud.`);
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Gagal Mengunggah',
        message: err?.message || 'Kendala saat mengunggah data ke Firestore.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">
                Status Sinkronisasi Real-Time Cloud
              </h3>
              <p className="text-xs text-slate-400">Firebase Firestore Multi-Device Auto-Sync</p>
            </div>
          </div>

          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current status pill */}
        <div className="p-3.5 rounded-xl bg-slate-950 border border-emerald-500/30 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <div>
              <div className="font-bold text-white">Status Database:</div>
              <div className="text-emerald-400 font-semibold">{status.label}</div>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[11px] font-bold">
            ONLINE
          </span>
        </div>

        {/* Real-time counters */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-slate-400 text-[11px]">Katalog Akun Tersinkron:</div>
            <div className="text-lg font-black text-white font-mono mt-0.5">{status.accountsCount} Item</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-slate-400 text-[11px]">Buku Penjualan Tersinkron:</div>
            <div className="text-lg font-black text-emerald-400 font-mono mt-0.5">{status.salesCount} Item</div>
          </div>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Setiap penambahan atau pengubahan transaksi di HP atau PC langsung tersimpan otomatis ke Cloud Firestore dan di-broadcast secara real-time ke semua perangkat tanpa perlu refresh.
        </p>

        {/* Action to upload HP local data to Cloud */}
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-950/60 to-slate-900 border border-blue-500/30 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
          <div>
            <div className="font-bold text-white flex items-center gap-1.5">
              <CloudUpload className="w-4 h-4 text-blue-400" />
              <span>Unggah Data Perangkat Ini ke Cloud:</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Klik jika data transaksi yang diinput di HP belum muncul di PC.
            </p>
          </div>
          <button
            type="button"
            onClick={handleUploadLocalToCloud}
            disabled={isSyncing}
            className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 disabled:opacity-60 whitespace-nowrap"
          >
            {isSyncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CloudUpload className="w-3.5 h-3.5" />}
            <span>{isSyncing ? 'Mengunggah...' : 'Upload ke Cloud'}</span>
          </button>
        </div>

        {/* Cloud Config Details */}
        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs">
          <div className="flex justify-between items-center text-slate-400 pb-1 border-b border-slate-800/80">
            <span>Project ID:</span>
            <span className="font-mono text-slate-200">{firebaseConfig.projectId}</span>
          </div>
          <div className="flex justify-between items-center text-slate-400 pb-1 border-b border-slate-800/80">
            <span>Database ID:</span>
            <span className="font-mono text-xs text-orange-300 truncate max-w-[200px]" title={firebaseConfig.firestoreDatabaseId}>
              {firebaseConfig.firestoreDatabaseId}
            </span>
          </div>
          <div className="flex justify-between items-center text-slate-400">
            <span>Auth Domain:</span>
            <span className="font-mono text-slate-300">{firebaseConfig.authDomain}</span>
          </div>
        </div>

        {testResult && (
          <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{testResult}</span>
          </div>
        )}

        <div className="pt-2 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5 text-emerald-400" />}
            <span>{isTesting ? 'Menguji...' : 'Uji Koneksi Real-Time'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
};
