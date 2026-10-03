import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
  getDocs,
  Unsubscribe,
} from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from './firebase';
import { GameAccount, SaleRecord, PaymentConfig, PaymentConfirmation } from '../types';
import { INITIAL_ACCOUNTS, INITIAL_SALES_RECORDS } from '../data/initialAccounts';

const STORAGE_KEY = 'gamestore_accounts_data_v3';
const STORAGE_SALES_KEY = 'pandirstore_sales_records_v2';
const STORAGE_PAYMENT_KEY = 'pandirstore_payment_config_v2';
const STORAGE_CONFIRMATIONS_KEY = 'pandirstore_payment_confirmations_v2';

const ACCOUNTS_COLLECTION = 'akun_toko_game';
const SALES_COLLECTION = 'catatan_penjualan';
const PAYMENT_CONFIG_COLLECTION = 'pengaturan_pembayaran';
const PAYMENT_CONFIG_DOC = 'utama';
const PAYMENT_CONFIRMATIONS_COLLECTION = 'konfirmasi_pembayaran';

export type SyncMode = 'firebase' | 'broadcast' | 'offline';

type AccountsListener = (accounts: GameAccount[]) => void;
type SalesListener = (sales: SaleRecord[]) => void;
type PaymentConfigListener = (config: PaymentConfig) => void;
type PaymentConfirmationsListener = (confirmations: PaymentConfirmation[]) => void;

export const DEFAULT_PAYMENT_CONFIG: PaymentConfig = {
  seabank_account_number: '901316745804',
  seabank_account_name: 'PandirStore',
  seabank_is_active: true,
  qris_image_url:
    'https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=00020101021126590014ID.LINKAJA.WWW011893600914300000000002159013167458045204581253033605802ID5911PANDIRSTORE6007JAKARTA61051011062070703A016304C741',
  qris_merchant_name: 'PandirStore',
  qris_max_amount: 500000,
  qris_is_active: true,
  updated_at: Date.now(),
  help_whatsapp: '085717046895',
  seabank: {
    isActive: true,
    accountNumber: '901316745804',
    accountName: 'PandirStore',
  },
  qris: {
    isActive: true,
    merchantName: 'PandirStore',
    maxNominal: 500000,
    imageUrl:
      'https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=00020101021126590014ID.LINKAJA.WWW011893600914300000000002159013167458045204581253033605802ID5911PANDIRSTORE6007JAKARTA61051011062070703A016304C741',
  },
  helpWhatsApp: '085717046895',
  webhook: {
    telegramBotToken: '',
    telegramChatId: '',
    fonnteToken: '',
    webhookUrl: '',
  },
  updatedAt: Date.now(),
};

class RealtimeSyncService {
  private listeners: Set<AccountsListener> = new Set();
  private salesListeners: Set<SalesListener> = new Set();
  private paymentListeners: Set<PaymentConfigListener> = new Set();
  private confirmationListeners: Set<PaymentConfirmationsListener> = new Set();

  private broadcastChannel: BroadcastChannel | null = null;
  private unsubscribeFirestoreAccounts: Unsubscribe | null = null;
  private unsubscribeFirestoreSales: Unsubscribe | null = null;
  private unsubscribeFirestorePayment: Unsubscribe | null = null;
  private unsubscribeFirestoreConfirmations: Unsubscribe | null = null;

  private currentMode: SyncMode = 'firebase';
  private currentAccounts: GameAccount[] = [];
  private currentSales: SaleRecord[] = [];
  private currentPaymentConfig: PaymentConfig = DEFAULT_PAYMENT_CONFIG;
  private currentConfirmations: PaymentConfirmation[] = [];

  private isUploadingSales = false;
  private isUploadingAccounts = false;
  private hasInitialAccountsSync = false;
  private hasInitialSalesSync = false;
  public isConnected = false;

  constructor() {
    this.initBroadcastChannel();
    this.loadCachedData();
    this.initFirestoreSync();
  }

  /**
   * BroadcastChannel allows same-device multi-tab synchronization
   * when offline or during instant optimistic state updates.
   */
  private initBroadcastChannel() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('pandirstore_realtime_sync');
        this.broadcastChannel.onmessage = (event) => {
          if (!this.isConnected) {
            if (event.data?.type === 'ACCOUNTS_UPDATED' && Array.isArray(event.data.payload)) {
              this.currentAccounts = event.data.payload;
              this.notifyListeners(this.currentAccounts);
            } else if (event.data?.type === 'SALES_UPDATED' && Array.isArray(event.data.payload)) {
              this.currentSales = event.data.payload;
              this.notifySalesListeners(this.currentSales);
            } else if (event.data?.type === 'PAYMENT_CONFIG_UPDATED' && event.data.payload) {
              this.currentPaymentConfig = event.data.payload;
              this.notifyPaymentListeners(this.currentPaymentConfig);
            } else if (event.data?.type === 'CONFIRMATIONS_UPDATED' && Array.isArray(event.data.payload)) {
              this.currentConfirmations = event.data.payload;
              this.notifyConfirmationListeners(this.currentConfirmations);
            }
          }
        };
      } catch (err) {
        console.warn('BroadcastChannel initialization skipped:', err);
      }
    }
  }

  /**
   * Load initial cached state from localStorage so the application
   * renders immediately without a blank loading screen.
   */
  private loadCachedData() {
    if (typeof window === 'undefined') return;
    try {
      const storedAcc = localStorage.getItem(STORAGE_KEY);
      if (storedAcc) {
        const parsed = JSON.parse(storedAcc);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.currentAccounts = parsed;
        } else {
          this.currentAccounts = INITIAL_ACCOUNTS;
        }
      } else {
        this.currentAccounts = INITIAL_ACCOUNTS;
      }

      const storedSales = localStorage.getItem(STORAGE_SALES_KEY);
      if (storedSales) {
        const parsedSales = JSON.parse(storedSales);
        if (Array.isArray(parsedSales) && parsedSales.length > 0) {
          this.currentSales = parsedSales;
        } else {
          this.currentSales = INITIAL_SALES_RECORDS;
        }
      } else {
        this.currentSales = INITIAL_SALES_RECORDS;
      }

      const storedPayment = localStorage.getItem(STORAGE_PAYMENT_KEY);
      if (storedPayment) {
        const parsedPayment = JSON.parse(storedPayment);
        if (parsedPayment && parsedPayment.seabank && parsedPayment.qris) {
          this.currentPaymentConfig = {
            ...DEFAULT_PAYMENT_CONFIG,
            ...parsedPayment,
          };
        }
      }

      const storedConfirmations = localStorage.getItem(STORAGE_CONFIRMATIONS_KEY);
      if (storedConfirmations) {
        const parsedConfirmations = JSON.parse(storedConfirmations);
        if (Array.isArray(parsedConfirmations)) {
          this.currentConfirmations = parsedConfirmations;
        }
      }
    } catch (err) {
      console.warn('Error reading from localStorage cache:', err);
      this.currentAccounts = INITIAL_ACCOUNTS;
      this.currentSales = INITIAL_SALES_RECORDS;
      this.currentPaymentConfig = DEFAULT_PAYMENT_CONFIG;
    }
  }

  private saveToLocalStorage(accounts: GameAccount[], broadcast = false) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
      if (broadcast && this.broadcastChannel && !this.isConnected) {
        this.broadcastChannel.postMessage({
          type: 'ACCOUNTS_UPDATED',
          payload: accounts,
        });
      }
    } catch (err) {
      console.error('Error saving accounts to localStorage:', err);
    }
  }

  private saveSalesToLocalStorage(sales: SaleRecord[], broadcast = false) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_SALES_KEY, JSON.stringify(sales));
      if (broadcast && this.broadcastChannel && !this.isConnected) {
        this.broadcastChannel.postMessage({
          type: 'SALES_UPDATED',
          payload: sales,
        });
      }
    } catch (err) {
      console.error('Error saving sales to localStorage:', err);
    }
  }

  private savePaymentConfigToLocalStorage(config: PaymentConfig, broadcast = false) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_PAYMENT_KEY, JSON.stringify(config));
      if (broadcast && this.broadcastChannel && !this.isConnected) {
        this.broadcastChannel.postMessage({
          type: 'PAYMENT_CONFIG_UPDATED',
          payload: config,
        });
      }
    } catch (err) {
      console.error('Error saving payment config to localStorage:', err);
    }
  }

  private saveConfirmationsToLocalStorage(confirmations: PaymentConfirmation[], broadcast = false) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_CONFIRMATIONS_KEY, JSON.stringify(confirmations));
      if (broadcast && this.broadcastChannel && !this.isConnected) {
        this.broadcastChannel.postMessage({
          type: 'CONFIRMATIONS_UPDATED',
          payload: confirmations,
        });
      }
    } catch (err) {
      console.error('Error saving confirmations to localStorage:', err);
    }
  }

  /**
   * Initialize bidirectional real-time Firestore listeners.
   * Any change made on HP or PC triggers onSnapshot on all other devices in milliseconds.
   */
  private initFirestoreSync() {
    try {
      const accountsCol = collection(db, ACCOUNTS_COLLECTION);
      const salesCol = collection(db, SALES_COLLECTION);
      const paymentDocRef = doc(db, PAYMENT_CONFIG_COLLECTION, PAYMENT_CONFIG_DOC);
      const confirmationsCol = collection(db, PAYMENT_CONFIRMATIONS_COLLECTION);

      if (this.unsubscribeFirestoreAccounts) this.unsubscribeFirestoreAccounts();
      if (this.unsubscribeFirestoreSales) this.unsubscribeFirestoreSales();
      if (this.unsubscribeFirestorePayment) this.unsubscribeFirestorePayment();
      if (this.unsubscribeFirestoreConfirmations) this.unsubscribeFirestoreConfirmations();

      // 1. Real-Time Accounts Listener (akun_toko_game)
      this.unsubscribeFirestoreAccounts = onSnapshot(
        accountsCol,
        async (snapshot) => {
          this.isConnected = true;
          this.currentMode = 'firebase';

          if (!snapshot.empty) {
            const remoteAccounts: GameAccount[] = [];
            const remoteMap = new Map<string, GameAccount>();

            snapshot.forEach((docSnap) => {
              const data = docSnap.data() as GameAccount;
              if (data && data.id) {
                remoteAccounts.push(data);
                remoteMap.set(data.id, data);
              }
            });

            // Reconcile: If local device has unsaved accounts not in Firestore, auto-upload them
            const unsyncedLocal = this.currentAccounts.filter((a) => a.id && !remoteMap.has(a.id));
            if (unsyncedLocal.length > 0 && !this.isUploadingAccounts) {
              this.uploadUnsyncedAccounts(unsyncedLocal);
            }

            const merged = [...remoteAccounts];
            for (const localAcc of unsyncedLocal) {
              if (!remoteMap.has(localAcc.id)) {
                merged.push(localAcc);
              }
            }

            merged.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            this.currentAccounts = merged;
            this.saveToLocalStorage(merged, false);
            this.notifyListeners(merged);
          } else {
            if (this.currentAccounts.length > 0 && !this.hasInitialAccountsSync && !this.isUploadingAccounts) {
              this.hasInitialAccountsSync = true;
              this.uploadUnsyncedAccounts(this.currentAccounts);
            } else if (!this.hasInitialAccountsSync) {
              this.hasInitialAccountsSync = true;
              this.checkAndMigrateLegacyAccounts();
            }
          }
        },
        (error) => {
          console.warn('Firestore onSnapshot accounts error, using cache:', error.message);
          this.currentMode = 'broadcast';
          this.isConnected = false;
        }
      );

      // 2. Real-Time Sales Ledger Listener (catatan_penjualan)
      this.unsubscribeFirestoreSales = onSnapshot(
        salesCol,
        async (snapshot) => {
          this.isConnected = true;
          this.currentMode = 'firebase';

          if (!snapshot.empty) {
            const remoteSales: SaleRecord[] = [];
            const remoteMap = new Map<string, SaleRecord>();

            snapshot.forEach((docSnap) => {
              const data = docSnap.data() as SaleRecord;
              if (data && data.id) {
                remoteSales.push(data);
                remoteMap.set(data.id, data);
              }
            });

            // Reconcile: If local device has sales records (e.g. input on HP) not yet in cloud, auto-upload!
            const unsyncedSales = this.currentSales.filter((s) => s.id && !remoteMap.has(s.id));
            if (unsyncedSales.length > 0 && !this.isUploadingSales) {
              this.uploadUnsyncedSales(unsyncedSales);
            }

            const merged = [...remoteSales];
            for (const localSale of unsyncedSales) {
              if (!remoteMap.has(localSale.id)) {
                merged.push(localSale);
              }
            }

            merged.sort((a, b) => (b.date || 0) - (a.date || 0));
            this.currentSales = merged;
            this.saveSalesToLocalStorage(merged, false);
            this.notifySalesListeners(merged);
          } else {
            if (this.currentSales.length > 0 && !this.hasInitialSalesSync && !this.isUploadingSales) {
              this.hasInitialSalesSync = true;
              this.uploadUnsyncedSales(this.currentSales);
            } else {
              this.hasInitialSalesSync = true;
              if (this.currentSales.length === 0) {
                this.notifySalesListeners([]);
              }
            }
          }
        },
        (error) => {
          console.warn('Firestore onSnapshot sales error, using cache:', error.message);
        }
      );

      // 3. Real-Time Payment Config Listener (pengaturan_pembayaran/utama)
      this.unsubscribeFirestorePayment = onSnapshot(
        paymentDocRef,
        async (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as PaymentConfig;
            this.currentPaymentConfig = {
              ...DEFAULT_PAYMENT_CONFIG,
              ...data,
            };
            this.savePaymentConfigToLocalStorage(this.currentPaymentConfig, false);
            this.notifyPaymentListeners(this.currentPaymentConfig);
          } else {
            // First time bootstrap: save default config to Cloud Firestore
            try {
              await setDoc(paymentDocRef, DEFAULT_PAYMENT_CONFIG);
            } catch (err) {
              console.warn('Error saving initial payment config to cloud:', err);
            }
          }
        },
        (error) => {
          console.warn('Firestore onSnapshot payment config error:', error.message);
        }
      );

      // 4. Real-Time Payment Confirmations Listener (konfirmasi_pembayaran)
      this.unsubscribeFirestoreConfirmations = onSnapshot(
        confirmationsCol,
        (snapshot) => {
          if (!snapshot.empty) {
            const items: PaymentConfirmation[] = [];
            snapshot.forEach((d) => {
              const conf = d.data() as PaymentConfirmation;
              if (conf && conf.id) items.push(conf);
            });
            items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            this.currentConfirmations = items;
            this.saveConfirmationsToLocalStorage(items, false);
            this.notifyConfirmationListeners(items);
          } else {
            this.currentConfirmations = [];
            this.notifyConfirmationListeners([]);
          }
        },
        (error) => {
          console.warn('Firestore onSnapshot payment confirmations error:', error.message);
        }
      );
    } catch (err) {
      console.warn('Failed to attach Firestore listeners, running offline cache:', err);
      this.currentMode = 'broadcast';
      this.isConnected = false;
    }
  }

  private async uploadUnsyncedAccounts(accountsToUpload: GameAccount[]) {
    if (this.isUploadingAccounts || accountsToUpload.length === 0) return;
    this.isUploadingAccounts = true;

    try {
      const batch = writeBatch(db);
      for (const acc of accountsToUpload) {
        if (!acc.id) continue;
        const docRef = doc(db, ACCOUNTS_COLLECTION, acc.id);
        batch.set(docRef, acc, { merge: true });
      }
      await batch.commit();
      console.log(`Auto-synced ${accountsToUpload.length} accounts to Cloud Firestore.`);
    } catch (err) {
      console.warn('Auto-sync accounts to cloud warning:', err);
    } finally {
      this.isUploadingAccounts = false;
    }
  }

  private async uploadUnsyncedSales(salesToUpload: SaleRecord[]) {
    if (this.isUploadingSales || salesToUpload.length === 0) return;
    this.isUploadingSales = true;

    try {
      const batch = writeBatch(db);
      for (const sale of salesToUpload) {
        if (!sale.id) continue;
        const docRef = doc(db, SALES_COLLECTION, sale.id);
        batch.set(docRef, sale, { merge: true });
      }
      await batch.commit();
      console.log(`Auto-synced ${salesToUpload.length} sales records to Cloud Firestore.`);
    } catch (err) {
      console.warn('Auto-sync sales to cloud warning:', err);
    } finally {
      this.isUploadingSales = false;
    }
  }

  private async checkAndMigrateLegacyAccounts() {
    try {
      const legacySnap = await getDocs(collection(db, 'gamestore_accounts'));
      if (!legacySnap.empty) {
        const legacyAccounts: GameAccount[] = [];
        legacySnap.forEach((d) => {
          const item = d.data() as GameAccount;
          if (item && item.id) legacyAccounts.push(item);
        });
        if (legacyAccounts.length > 0) {
          const batch = writeBatch(db);
          for (const acc of legacyAccounts) {
            const docRef = doc(db, ACCOUNTS_COLLECTION, acc.id);
            batch.set(docRef, acc);
          }
          await batch.commit();
        }
      }
    } catch (e) {
      console.warn('Initial legacy check completed with notice:', e);
    }
  }

  public getSyncStatus(): {
    mode: SyncMode;
    label: string;
    active: boolean;
    accountsCount: number;
    salesCount: number;
  } {
    if (this.currentMode === 'firebase' || this.isConnected) {
      return {
        mode: 'firebase',
        label: 'Google Cloud Firestore Real-Time Active (Multi-Device Terhubung)',
        active: true,
        accountsCount: this.currentAccounts.length,
        salesCount: this.currentSales.length,
      };
    }
    return {
      mode: 'broadcast',
      label: 'Local & BroadcastChannel Real-Time (Fallback Offline)',
      active: true,
      accountsCount: this.currentAccounts.length,
      salesCount: this.currentSales.length,
    };
  }

  public subscribe(listener: AccountsListener): () => void {
    this.listeners.add(listener);
    listener([...this.currentAccounts]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public subscribeSales(listener: SalesListener): () => void {
    this.salesListeners.add(listener);
    listener([...this.currentSales]);
    return () => {
      this.salesListeners.delete(listener);
    };
  }

  public subscribePaymentConfig(listener: PaymentConfigListener): () => void {
    this.paymentListeners.add(listener);
    listener({ ...this.currentPaymentConfig });
    return () => {
      this.paymentListeners.delete(listener);
    };
  }

  public subscribePaymentConfirmations(listener: PaymentConfirmationsListener): () => void {
    this.confirmationListeners.add(listener);
    listener([...this.currentConfirmations]);
    return () => {
      this.confirmationListeners.delete(listener);
    };
  }

  private notifyListeners(accounts: GameAccount[]) {
    this.listeners.forEach((listener) => {
      try {
        listener([...accounts]);
      } catch (err) {
        console.error('Error in accounts listener:', err);
      }
    });
  }

  private notifySalesListeners(sales: SaleRecord[]) {
    this.salesListeners.forEach((listener) => {
      try {
        listener([...sales]);
      } catch (err) {
        console.error('Error in sales listener:', err);
      }
    });
  }

  private notifyPaymentListeners(config: PaymentConfig) {
    this.paymentListeners.forEach((listener) => {
      try {
        listener({ ...config });
      } catch (err) {
        console.error('Error in payment listener:', err);
      }
    });
  }

  private notifyConfirmationListeners(confirmations: PaymentConfirmation[]) {
    this.confirmationListeners.forEach((listener) => {
      try {
        listener([...confirmations]);
      } catch (err) {
        console.error('Error in confirmations listener:', err);
      }
    });
  }

  public getAccounts(): GameAccount[] {
    return [...this.currentAccounts];
  }

  public getSalesRecords(): SaleRecord[] {
    return [...this.currentSales];
  }

  public getPaymentConfig(): PaymentConfig {
    return { ...this.currentPaymentConfig };
  }

  public getPaymentConfirmations(): PaymentConfirmation[] {
    return [...this.currentConfirmations];
  }

  /**
   * Updates Payment configuration in Cloud Firestore and broadcasts to all clients.
   * Persists both to pengaturan_pembayaran and payment_settings collections.
   */
  public async updatePaymentConfig(partialConfig: Partial<PaymentConfig>): Promise<PaymentConfig> {
    const seabankActive =
      partialConfig.seabank_is_active ??
      partialConfig.seabank?.isActive ??
      this.currentPaymentConfig.seabank_is_active ??
      true;
    const seabankNumber =
      partialConfig.seabank_account_number ??
      partialConfig.seabank?.accountNumber ??
      this.currentPaymentConfig.seabank_account_number ??
      '901316745804';
    const seabankName =
      partialConfig.seabank_account_name ??
      partialConfig.seabank?.accountName ??
      this.currentPaymentConfig.seabank_account_name ??
      'PandirStore';

    const qrisActive =
      partialConfig.qris_is_active ??
      partialConfig.qris?.isActive ??
      this.currentPaymentConfig.qris_is_active ??
      true;
    const qrisName =
      partialConfig.qris_merchant_name ??
      partialConfig.qris?.merchantName ??
      this.currentPaymentConfig.qris_merchant_name ??
      'PandirStore';
    const qrisMax =
      partialConfig.qris_max_amount ??
      partialConfig.qris?.maxNominal ??
      this.currentPaymentConfig.qris_max_amount ??
      500000;
    const qrisImage =
      partialConfig.qris_image_url ??
      partialConfig.qris?.imageUrl ??
      this.currentPaymentConfig.qris_image_url ??
      this.currentPaymentConfig.qris.imageUrl;

    const now = Date.now();
    const updated: PaymentConfig = {
      ...this.currentPaymentConfig,
      ...partialConfig,
      seabank_account_number: seabankNumber,
      seabank_account_name: seabankName,
      seabank_is_active: seabankActive,
      qris_image_url: qrisImage,
      qris_merchant_name: qrisName,
      qris_max_amount: qrisMax,
      qris_is_active: qrisActive,
      updated_at: now,
      help_whatsapp: partialConfig.help_whatsapp || partialConfig.helpWhatsApp || this.currentPaymentConfig.helpWhatsApp,
      seabank: {
        isActive: seabankActive,
        accountNumber: seabankNumber,
        accountName: seabankName,
      },
      qris: {
        isActive: qrisActive,
        merchantName: qrisName,
        maxNominal: qrisMax,
        imageUrl: qrisImage,
      },
      helpWhatsApp: partialConfig.helpWhatsApp || partialConfig.help_whatsapp || this.currentPaymentConfig.helpWhatsApp,
      updatedAt: now,
    };

    this.currentPaymentConfig = updated;
    this.savePaymentConfigToLocalStorage(updated, true);
    this.notifyPaymentListeners(updated);

    try {
      const paymentDocRef = doc(db, PAYMENT_CONFIG_COLLECTION, PAYMENT_CONFIG_DOC);
      const paymentSettingsDocRef = doc(db, 'payment_settings', PAYMENT_CONFIG_DOC);
      await Promise.all([
        setDoc(paymentDocRef, updated, { merge: true }),
        setDoc(paymentSettingsDocRef, updated, { merge: true }),
      ]);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `${PAYMENT_CONFIG_COLLECTION}/${PAYMENT_CONFIG_DOC}`);
      throw e;
    }

    return updated;
  }

  /**
   * Records a payment confirmation / new transaction order from a buyer.
   * Enforces 3-digit unique code, base price, claimed amount, and order_id.
   */
  public async addPaymentConfirmation(
    data: Partial<PaymentConfirmation> & {
      sender_name?: string;
      senderName?: string;
    }
  ): Promise<PaymentConfirmation> {
    const now = Date.now();
    const orderId =
      data.order_id ||
      data.id ||
      `ORD-${now.toString().slice(-6)}`;

    const basePrice = data.base_price || data.amount || 0;
    const uniqueCode = data.unique_code ?? Math.floor(100 + Math.random() * 900);
    const totalAmount = data.total_amount || basePrice + uniqueCode;
    const claimedAmount = data.claimed_amount || data.amount || totalAmount;
    const sender = data.sender_name || data.senderName || 'Pembeli';
    const proofUrl = data.proof_of_payment_url || data.proofImageUrl || '';
    const productId = data.product_id || data.accountId || '';
    const productTitle = data.product_title || data.accountTitle || 'Akun Game';
    const game = data.game || 'MLBB';
    const paymentMethod = data.payment_method || 'QRIS';

    const newConfirmation: PaymentConfirmation = {
      order_id: orderId,
      product_id: productId,
      product_title: productTitle,
      game,
      base_price: basePrice,
      unique_code: uniqueCode,
      total_amount: totalAmount,
      claimed_amount: claimedAmount,
      proof_of_payment_url: proofUrl,
      sender_name: sender,
      buyer_whatsapp: data.buyer_whatsapp,
      payment_method: paymentMethod,
      status: (data.status as any) || 'PENDING',
      notes: data.notes || '',
      created_at: now,
      updated_at: now,
      // Compatibility aliases
      id: orderId,
      amount: claimedAmount,
      accountId: productId,
      accountTitle: productTitle,
      proofImageUrl: proofUrl,
      createdAt: now,
    };

    const updated = [newConfirmation, ...this.currentConfirmations.filter((c) => c.order_id !== orderId && c.id !== orderId)];
    this.currentConfirmations = updated;
    this.saveConfirmationsToLocalStorage(updated, true);
    this.notifyConfirmationListeners(updated);

    try {
      const confDocRef = doc(db, PAYMENT_CONFIRMATIONS_COLLECTION, orderId);
      const ordersDocRef = doc(db, 'orders', orderId);
      await Promise.all([
        setDoc(confDocRef, newConfirmation),
        setDoc(ordersDocRef, newConfirmation),
      ]);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, `${PAYMENT_CONFIRMATIONS_COLLECTION}/${orderId}`);
    }

    // Trigger instant webhook notification (Telegram bot or custom webhook) to seller
    this.triggerWebhookNotification(newConfirmation).catch(() => {});

    return newConfirmation;
  }

  /**
   * Updates payment confirmation / order status (e.g. PAID_APPROVED, REJECTED_UNDERPAID, CANCELLED)
   * When approved (PAID_APPROVED), automatically updates product in catalog to SOLD_OUT
   * and automatically records the sale to the sales ledger (buku penjualan/keuangan).
   */
  public async updatePaymentConfirmationStatus(
    idOrOrderId: string,
    status: PaymentConfirmation['status']
  ): Promise<void> {
    const target = this.currentConfirmations.find(
      (c) => c.id === idOrOrderId || c.order_id === idOrOrderId
    );
    if (!target) return;

    const key = target.order_id || target.id;
    const now = Date.now();
    const updated = this.currentConfirmations.map((c) => {
      if (c.order_id === key || c.id === key) {
        return {
          ...c,
          status,
          updated_at: now,
        };
      }
      return c;
    });

    this.currentConfirmations = updated;
    this.saveConfirmationsToLocalStorage(updated, true);
    this.notifyConfirmationListeners(updated);

    try {
      const confRef = doc(db, PAYMENT_CONFIRMATIONS_COLLECTION, key);
      const orderRef = doc(db, 'orders', key);
      await Promise.all([
        setDoc(confRef, { status, updated_at: now }, { merge: true }),
        setDoc(orderRef, { status, updated_at: now }, { merge: true }),
      ]);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `${PAYMENT_CONFIRMATIONS_COLLECTION}/${key}`);
      throw e;
    }

    // Auto-actions when order is approved (PAID_APPROVED):
    if (status === 'PAID_APPROVED') {
      try {
        const prodId = target.product_id || target.accountId;
        const matchingAccount = this.currentAccounts.find(
          (a) =>
            a.id === prodId ||
            a.idLapak === prodId ||
            a.accountId === prodId ||
            (target.product_title && a.title.toLowerCase() === target.product_title.toLowerCase())
        );

        // 1. Automatically change account status to SOLD_OUT
        if (matchingAccount && matchingAccount.status !== 'SOLD_OUT') {
          await this.updateAccountStatus(matchingAccount.id, 'SOLD_OUT');
        }

        // 2. Automatically record in Buku Penjualan (Catatan Penjualan / Laba-Rugi)
        const alreadyRecorded = this.currentSales.some(
          (s) =>
            (s.notes && s.notes.includes(key)) ||
            (matchingAccount && s.accountTitle === matchingAccount.title && s.salePrice === (target.total_amount || target.amount))
        );

        if (!alreadyRecorded) {
          const capital = matchingAccount?.costPrice || matchingAccount?.capitalPrice || Math.round((target.base_price || target.amount || 0) * 0.7);
          const saleVal = target.total_amount || target.amount || (matchingAccount ? matchingAccount.price : 0);
          await this.addSaleRecord({
            game: target.game || matchingAccount?.game || 'MLBB',
            accountTitle: target.product_title || matchingAccount?.title || target.accountTitle || 'Akun Game',
            capitalPrice: capital,
            salePrice: saleVal,
            saleDate: new Date().toISOString().split('T')[0],
            notes: `Auto-recorded dari Pesanan ${key} (${target.payment_method}) - Pengirim: ${target.sender_name}`,
          });
        }
      } catch (postErr) {
        console.warn('Auto-approval side effects completed with warning:', postErr);
      }
    }
  }

  /**
   * Sends instant push notification to Telegram / Fonnte / Webhook when buyer confirms payment.
   */
  private async triggerWebhookNotification(conf: PaymentConfirmation) {
    const webhook = this.currentPaymentConfig.webhook;
    if (!webhook) return;

    const totalFormatted = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(conf.total_amount || conf.amount);

    const claimedFormatted = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(conf.claimed_amount || conf.amount);

    const messageText =
      `🔔 *NOTIFIKASI PESANAN PEMBAYARAN PANDIRSTORE*\n\n` +
      `📦 *ID Pesanan:* \`${conf.order_id || conf.id}\`\n` +
      `🎮 *Produk:* ${conf.product_title || conf.accountTitle} (${conf.game})\n` +
      `🏷️ *Total Tagihan Resmi:* ${totalFormatted} (Kode Unik: ${conf.unique_code || '-'})\n` +
      `💵 *Nominal Ditransfer:* ${claimedFormatted}\n` +
      `💳 *Metode Pembayaran:* ${conf.payment_method}\n` +
      `👤 *Nama Pengirim:* ${conf.sender_name}\n` +
      (conf.buyer_whatsapp ? `📱 *WhatsApp Pembeli:* ${conf.buyer_whatsapp}\n` : '') +
      `⏰ *Waktu:* ${new Date(conf.created_at || conf.createdAt).toLocaleString('id-ID')}\n\n` +
      `⚠️ _Silakan periksa mutasi di aplikasi ${
        conf.payment_method === 'QRIS' ? 'DANA/E-Wallet' : 'SeaBank'
      } Anda sekarang!_`;

    // 1. Telegram Bot Notification
    if (webhook.telegramBotToken && webhook.telegramChatId) {
      try {
        await fetch(`https://api.telegram.org/bot${webhook.telegramBotToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: webhook.telegramChatId,
            text: messageText,
            parse_mode: 'Markdown',
          }),
        });
      } catch (err) {
        console.warn('Telegram webhook notification failed:', err);
      }
    }

    // 2. WhatsApp Fonnte Webhook API
    if (webhook.fonnteToken) {
      try {
        await fetch('https://api.fonnte.com/send', {
          method: 'POST',
          headers: {
            Authorization: webhook.fonnteToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            target: this.currentPaymentConfig.helpWhatsApp || '085717046895',
            message: messageText.replace(/\*/g, '').replace(/`/g, ''),
          }),
        });
      } catch (err) {
        console.warn('Fonnte WhatsApp webhook failed:', err);
      }
    }

    // 3. Custom Webhook
    if (webhook.webhookUrl) {
      try {
        await fetch(webhook.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(conf),
        });
      } catch (err) {
        console.warn('Custom webhook failed:', err);
      }
    }
  }

  /**
   * Adds a new game account to Firestore.
   */
  public async addAccount(newAccount: Omit<GameAccount, 'createdAt' | 'updatedAt'>): Promise<GameAccount> {
    const now = Date.now();
    const created: GameAccount = {
      ...newAccount,
      createdAt: now,
      updatedAt: now,
    };

    const updatedList = [created, ...this.currentAccounts.filter((a) => a.id !== created.id)];
    this.currentAccounts = updatedList;
    this.saveToLocalStorage(updatedList, false);
    this.notifyListeners(updatedList);

    try {
      await setDoc(doc(db, ACCOUNTS_COLLECTION, created.id), created);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, `${ACCOUNTS_COLLECTION}/${created.id}`);
      throw e;
    }

    return created;
  }

  /**
   * Updates an existing account in Firestore.
   */
  public async updateAccount(account: GameAccount): Promise<GameAccount> {
    const updated: GameAccount = {
      ...account,
      updatedAt: Date.now(),
    };

    const updatedList = this.currentAccounts.map((a) => (a.id === updated.id ? updated : a));
    this.currentAccounts = updatedList;
    this.saveToLocalStorage(updatedList, false);
    this.notifyListeners(updatedList);

    try {
      await setDoc(doc(db, ACCOUNTS_COLLECTION, updated.id), updated);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `${ACCOUNTS_COLLECTION}/${updated.id}`);
      throw e;
    }

    return updated;
  }

  /**
   * Updates stock or changes status between READY and SOLD_OUT.
   */
  public async updateAccountStock(
    id: string,
    stock: number,
    status: GameAccount['status']
  ): Promise<GameAccount | null> {
    const target = this.currentAccounts.find((a) => a.id === id);
    if (!target) return null;

    if (status === 'SOLD_OUT' && target.status !== 'SOLD_OUT') {
      const cost = target.costPrice || Math.round(target.price * 0.7);
      await this.addSaleRecord({
        accountId: target.idLapak || target.accountId || target.id,
        accountTitle: target.title,
        game: target.game,
        sellingPrice: target.price,
        costPrice: cost,
        profit: target.price - cost,
        date: Date.now(),
        buyerNote: 'Status diubah ke Sold Out oleh Penjual',
      });
    }

    const updated: GameAccount = {
      ...target,
      stock,
      status,
      updatedAt: Date.now(),
    };

    return this.updateAccount(updated);
  }

  /**
   * Deletes an account from Firestore.
   */
  public async deleteAccount(id: string): Promise<boolean> {
    const updatedList = this.currentAccounts.filter((a) => a.id !== id);
    this.currentAccounts = updatedList;
    this.saveToLocalStorage(updatedList, false);
    this.notifyListeners(updatedList);

    try {
      await deleteDoc(doc(db, ACCOUNTS_COLLECTION, id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `${ACCOUNTS_COLLECTION}/${id}`);
      throw e;
    }

    return true;
  }

  /**
   * Adds a transaction record to Firestore 'catatan_penjualan'.
   */
  public async addSaleRecord(record: Omit<SaleRecord, 'id'>): Promise<SaleRecord> {
    const newRecord: SaleRecord = {
      ...record,
      id: `TRX-${Date.now().toString().slice(-6)}`,
    };

    const updated = [newRecord, ...this.currentSales.filter((s) => s.id !== newRecord.id)];
    this.currentSales = updated;
    this.saveSalesToLocalStorage(updated, false);
    this.notifySalesListeners(updated);

    try {
      await setDoc(doc(db, SALES_COLLECTION, newRecord.id), newRecord);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, `${SALES_COLLECTION}/${newRecord.id}`);
      throw e;
    }

    return newRecord;
  }

  /**
   * Deletes a sale record from Firestore.
   */
  public async deleteSaleRecord(id: string): Promise<boolean> {
    const updated = this.currentSales.filter((s) => s.id !== id);
    this.currentSales = updated;
    this.saveSalesToLocalStorage(updated, false);
    this.notifySalesListeners(updated);

    try {
      await deleteDoc(doc(db, SALES_COLLECTION, id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `${SALES_COLLECTION}/${id}`);
      throw e;
    }

    return true;
  }

  /**
   * Manually or automatically trigger full sync from local storage to cloud.
   */
  public async syncLocalToCloudNow(): Promise<{ accountsSynced: number; salesSynced: number }> {
    let accountsSynced = 0;
    let salesSynced = 0;

    try {
      if (this.currentAccounts.length > 0) {
        const batch = writeBatch(db);
        for (const acc of this.currentAccounts) {
          if (acc.id) {
            batch.set(doc(db, ACCOUNTS_COLLECTION, acc.id), acc, { merge: true });
            accountsSynced++;
          }
        }
        await batch.commit();
      }

      if (this.currentSales.length > 0) {
        const batchSales = writeBatch(db);
        for (const sale of this.currentSales) {
          if (sale.id) {
            batchSales.set(doc(db, SALES_COLLECTION, sale.id), sale, { merge: true });
            salesSynced++;
          }
        }
        await batchSales.commit();
      }
    } catch (e) {
      console.error('Error during manual syncLocalToCloudNow:', e);
      throw e;
    }

    return { accountsSynced, salesSynced };
  }
}

export const realtimeSync = new RealtimeSyncService();
