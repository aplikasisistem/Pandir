export type GameType = 'MLBB' | 'FREE_FIRE';

export type AccountStatus = 'READY' | 'SOLD_OUT' | 'BOOKED';

export interface MLItemSpecs {
  rank: string;
  totalHero: number;
  totalSkin: number;
  rareSkins: string[];
  emblem: string;
  bindStatus: string;
  winrate?: string;
}

export interface FFItemSpecs {
  level: number;
  elitePass: string;
  mainBundles: string[];
  evoGuns: string[];
  bindStatus: string;
  vaultCount?: number;
}

export interface GalleryItem {
  category: string;
  url: string;
  label: string;
}

export interface SaleRecord {
  id: string;
  accountId: string;
  accountTitle: string;
  game: GameType;
  sellingPrice: number;
  costPrice: number;
  profit: number;
  date: number;
  buyerNote?: string;
}

export interface GameAccount {
  id: string;
  idLapak?: string; // ID Akun / Kode Lapak (contoh: ML-305 atau 123456789)
  accountId?: string;
  game: GameType;
  title: string;
  price: number; // Harga Jual
  costPrice?: number; // Harga Beli / Modal (COGS) - Hidden from buyers!
  discountPrice?: number; // Diskon / Harga Coret jika ada
  stock: number;
  status: AccountStatus;
  isNego: boolean;
  is_negotiable?: boolean; // Status Bisa Nego (Boolean, default: false)
  bisa_nego?: boolean; // Alias status negosiasi
  whatsappNumber: string; // e.g. 085717046895
  rating: number; // e.g. 4.9
  soldCount: number; // e.g. 42
  thumbnail: string;
  gallery: GalleryItem[];
  mlSpecs?: MLItemSpecs;
  ffSpecs?: FFItemSpecs;
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export type FinancialPeriod = 'today' | 'week' | 'month' | 'year' | 'custom';

export type FilterGameOption = 'ALL' | 'MLBB' | 'FREE_FIRE';

export type SortOption = 'newest' | 'cheapest' | 'expensive' | 'popular';

export interface FilterState {
  game: FilterGameOption;
  searchQuery: string;
  priceRange: 'ALL' | 'UNDER_100K' | '100K_500K' | 'ABOVE_1M';
  onlyReady: boolean;
  sortBy: SortOption;
}

// Skema Tabel payment_settings (Pengaturan Pembayaran Dinamis)
export interface PaymentSettings {
  seabank_account_number: string;
  seabank_account_name: string;
  seabank_is_active: boolean;
  qris_image_url: string;
  qris_merchant_name: string;
  qris_max_amount: number;
  qris_is_active: boolean;
  updated_at: number;
  help_whatsapp?: string;
  webhook?: {
    telegramBotToken?: string;
    telegramChatId?: string;
    fonnteToken?: string;
    webhookUrl?: string;
  };
  // Properti camelCase untuk kompatibilitas penuh komponen terdahulu
  seabank: {
    isActive: boolean;
    accountNumber: string;
    accountName: string;
  };
  qris: {
    isActive: boolean;
    merchantName: string;
    maxNominal: number; // default: 500000
    imageUrl: string;
  };
  helpWhatsApp: string;
  updatedAt: number;
}

export type PaymentConfig = PaymentSettings;

// Status Pesanan Transaksi
export type OrderStatus =
  | 'PENDING'
  | 'PAID_APPROVED'
  | 'REJECTED_UNDERPAID'
  | 'CANCELLED'
  | 'MENUNGGU_VERIFIKASI' // alias
  | 'TERVERIFIKASI' // alias
  | 'DITOLAK'; // alias

// Skema Tabel transactions / orders (Pesanan & Konfirmasi Pembayaran)
export interface OrderTransaction {
  order_id: string; // ID Pesanan / UUID Primary Key
  product_id: string; // Foreign Key ID Akun / Lapak
  product_title: string;
  game: GameType;
  base_price: number; // Harga Produk Asli
  unique_code: number; // 3 Digit Kode Unik Acak 100-999
  total_amount: number; // base_price + unique_code
  claimed_amount: number; // Nominal yang Diinput / Diklaim Pembeli
  proof_of_payment_url?: string; // URL Bukti Transfer / Screenshot
  sender_name: string; // Nama Pengirim
  buyer_whatsapp?: string; // Nomor WhatsApp Pembeli untuk chat/retur
  payment_method: 'QRIS' | 'SEABANK';
  status: OrderStatus;
  notes?: string;
  created_at: number;
  updated_at: number;
  // Aliases for compatibility
  id: string;
  amount: number;
  accountId?: string;
  accountTitle?: string;
  proofImageUrl?: string;
  createdAt: number;
}

export type PaymentConfirmation = OrderTransaction;


