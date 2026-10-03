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
import { GameAccount, SaleRecord } from '../types';
import { INITIAL_ACCOUNTS, INITIAL_SALES_RECORDS } from '../data/initialAccounts';

const STORAGE_KEY = 'gamestore_accounts_data_v3';
const STORAGE_SALES_KEY = 'pandirstore_sales_records_v2';
const ACCOUNTS_COLLECTION = 'akun_toko_game';
const SALES_COLLECTION = 'catatan_penjualan';

export type SyncMode = 'firebase' | 'broadcast' | 'offline';

type AccountsListener = (accounts: GameAccount[]) => void;
type SalesListener = (sales: SaleRecord[]) => void;

class RealtimeSyncService {
  private listeners: Set<AccountsListener> = new Set();
  private salesListeners: Set<SalesListener> = new Set();
  private broadcastChannel: BroadcastChannel | null = null;
  private unsubscribeFirestoreAccounts: Unsubscribe | null = null;
  private unsubscribeFirestoreSales: Unsubscribe | null = null;
  private currentMode: SyncMode = 'firebase';
  private currentAccounts: GameAccount[] = [];
  private currentSales: SaleRecord[] = [];
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
    } catch (err) {
      console.warn('Error reading from localStorage cache:', err);
      this.currentAccounts = INITIAL_ACCOUNTS;
      this.currentSales = INITIAL_SALES_RECORDS;
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

  /**
   * Initialize bidirectional real-time Firestore listeners.
   * Any change made on HP or PC triggers onSnapshot on all other devices in milliseconds.
   */
  private initFirestoreSync() {
    try {
      const accountsCol = collection(db, ACCOUNTS_COLLECTION);
      const salesCol = collection(db, SALES_COLLECTION);

      if (this.unsubscribeFirestoreAccounts) {
        this.unsubscribeFirestoreAccounts();
        this.unsubscribeFirestoreAccounts = null;
      }
      if (this.unsubscribeFirestoreSales) {
        this.unsubscribeFirestoreSales();
        this.unsubscribeFirestoreSales = null;
      }

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

            // Combine remote accounts and any unsynced local accounts
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
            // Remote Firestore collection is empty:
            // If local storage has accounts, automatically upload them to Cloud Firestore!
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

            // Combine remote sales and any unsynced local sales
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
            // Remote collection is empty:
            // CRITICAL FIX: If this device (HP) already has sales in localStorage, AUTO-UPLOAD to Cloud!
            // NEVER wipe out to empty array if localStorage has records!
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
    } catch (err) {
      console.warn('Failed to attach Firestore listeners, running offline cache:', err);
      this.currentMode = 'broadcast';
      this.isConnected = false;
    }
  }

  /**
   * Automatically pushes local accounts that are missing from Cloud Firestore.
   */
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

  /**
   * Automatically pushes local sales records (e.g. from HP) to Cloud Firestore.
   */
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

  /**
   * One-time check for legacy collections to prevent data loss.
   */
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

  public getAccounts(): GameAccount[] {
    return [...this.currentAccounts];
  }

  public getSalesRecords(): SaleRecord[] {
    return [...this.currentSales];
  }

  /**
   * Adds a new game account to Firestore.
   * Immediately propagates to all devices in real-time.
   */
  public async addAccount(newAccount: Omit<GameAccount, 'createdAt' | 'updatedAt'>): Promise<GameAccount> {
    const now = Date.now();
    const created: GameAccount = {
      ...newAccount,
      createdAt: now,
      updatedAt: now,
    };

    // Optimistic local update (newest at top)
    const updatedList = [created, ...this.currentAccounts.filter((a) => a.id !== created.id)];
    this.currentAccounts = updatedList;
    this.saveToLocalStorage(updatedList, false);
    this.notifyListeners(updatedList);

    // Save directly to Firestore collection 'akun_toko_game'
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
   * Propagates to all buyer & seller devices in real-time.
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
   * If transitioning to SOLD_OUT, creates a sales ledger record in Firestore.
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
   * Immediately removes it from all active users' catalog in real-time.
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
   * Real-time listeners on PC & HP will update automatically.
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
   * Ensures any data on HP is completely uploaded to Cloud Firestore so PC sees it.
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
