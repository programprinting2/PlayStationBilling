export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  totalSpent: number;
  joinDate: string;
  status: "active" | "inactive";
}

// Equipment Types for different gaming equipment
export interface EquipmentType {
  id: string;
  name: string;
  description: string;
  icon: string; // Icon name from lucide-react
  category: "gaming" | "billiard" | "other";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Rate Profiles - Master tarif yang bisa digunakan untuk berbagai equipment
export interface RateProfile {
  id: string;
  name: string;
  description: string;
  capital: number;
  hourlyRate: number;
  dailyRate: number;
  weeklyRate: number;
  monthlyRate?: number;
  minimumMinutes: number;
  minimumMinutesMember: number;
  peakHourRate?: number; // Tarif jam sibuk
  peakHourStart?: string; // Jam mulai peak hour (HH:MM)
  peakHourEnd?: string; // Jam selesai peak hour (HH:MM)
  weekendMultiplier?: number; // Multiplier untuk weekend (1.2 = 20% lebih mahal)
  isActive: boolean;
  applicableEquipmentTypes: string[]; // Array of equipment type IDs
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface Console {
  id: string;
  name: string;
  equipmentTypeId: string; // Reference to EquipmentType
  rateProfileId: string; // Reference to RateProfile
  status: "available" | "rented" | "maintenance";
  location?: string; // e.g., "Lantai 1 - Pojok Kiri"
  serialNumber?: string;
  purchaseDate?: string;
  warrantyExpiry?: string;
  notes?: string;
  // Relay Control Fields
  ipAddress?: string; // e.g., "192.168.1.100"
  relayCommand?: string; // e.g., "/relay/0?turn="
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  installed_games?: string[];
}

export interface Game {
  id: string;
  title: string;
  platform: string[]; 
  genre: string[];
  developer?: string;
  publisher?: string;
  release_year?: number;
  description?: string;
  file_size_gb?: number;
  cover_image_url?: string;
  is_multiplayer: boolean;
  max_players?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Sparepart Management
export interface Sparepart {
  id: string;
  name: string;
  partNumber?: string; // Part number dari manufacturer
  category:
    | "controller"
    | "cable"
    | "power"
    | "cooling"
    | "storage"
    | "display"
    | "audio"
    | "other";
  compatibleConsoles: string[]; // Array of console IDs or equipment type IDs
  description: string;
  specifications?: string; // Technical specifications
  brand?: string;
  model?: string;
  condition: "new" | "used" | "refurbished";
  price: number; // Harga beli/estimasi
  stock: number;
  minStock: number;
  location?: string; // Lokasi penyimpanan
  supplier?: string;
  purchaseLink?: string; // Link untuk pembelian online
  alternativeLinks?: string[]; // Link alternatif pembelian
  photos: string[]; // Array of photo URLs
  installationNotes?: string; // Catatan instalasi
  warrantyPeriod?: number; // Warranty dalam bulan
  lastUsed?: string; // Tanggal terakhir digunakan
  usageHistory: SparepartUsage[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface SparepartUsage {
  id: string;
  sparepartId: string;
  consoleId: string;
  usageDate: string;
  reason: "replacement" | "repair" | "upgrade" | "maintenance";
  description: string;
  quantity: number;
  technician?: string;
  cost?: number; // Biaya jasa jika ada
  notes?: string;
  createdAt: string;
}

// Hardware Maintenance Transaction System
export interface MaintenanceTransaction {
  id: string;
  transactionNumber: string; // e.g., "MNT-2024-001"
  consoleId: string;
  consoleName: string;
  consoleModel: string; // PS4, PS5, etc.
  consoleSerialNumber?: string;
  serviceDate: string;
  completedDate?: string;
  technicianId: string;
  technicianName: string;
  issueDescription: string;
  serviceStatus:
    | "scheduled"
    | "in-progress"
    | "completed"
    | "cancelled"
    | "on-hold";
  priority: "low" | "medium" | "high" | "urgent";

  // Parts Replacement
  partsUsed: MaintenancePartUsage[];

  // Service Costs
  laborCost: number;
  additionalServiceFees: number;
  totalPartsCost: number; // Calculated from parts used
  totalRepairCost: number; // Labor + Additional + Parts

  // Payment & Warranty
  paymentStatus: "pending" | "paid" | "warranty" | "insurance";
  warrantyType?: "manufacturer" | "service" | "extended";
  warrantyExpiry?: string;

  // Service Details
  serviceNotes: string;
  beforePhotos?: string[]; // Photos before repair
  afterPhotos?: string[]; // Photos after repair
  testResults?: string; // Post-repair testing results

  // Audit Trail
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export interface MaintenancePartUsage {
  id: string;
  sparepartId: string;
  sparepartName: string;
  partNumber?: string;
  category: string;

  // Old Part Details
  oldPartCondition?: string;
  oldPartSerialNumber?: string;
  oldPartNotes?: string;

  // New Part Details
  newPartSerialNumber?: string;
  newPartCondition: "new" | "used" | "refurbished";

  // Usage Details
  quantityUsed: number;
  unitCost: number;
  totalCost: number;

  // Installation
  installationNotes?: string;
  installationTime?: number; // Minutes taken for installation

  // Warranty
  partWarrantyPeriod?: number; // Months
  partWarrantyExpiry?: string;
}

// Maintenance History & Analytics
export interface MaintenanceHistory {
  consoleId: string;
  totalMaintenanceCount: number;
  totalMaintenanceCost: number;
  lastMaintenanceDate?: string;
  averageRepairCost: number;
  commonIssues: MaintenanceIssueFrequency[];
  partsReplacementHistory: PartReplacementHistory[];
  warrantyStatus: "active" | "expired" | "void";
  nextScheduledMaintenance?: string;
}

export interface MaintenanceIssueFrequency {
  issue: string;
  frequency: number;
  averageCost: number;
  lastOccurrence: string;
}

export interface PartReplacementHistory {
  sparepartId: string;
  sparepartName: string;
  replacementCount: number;
  totalCost: number;
  lastReplacement: string;
  averageLifespan?: number; // Days between replacements
}

// Maintenance Reports
export interface MaintenanceReport {
  id: string;
  reportType: "monthly" | "quarterly" | "yearly" | "custom";
  periodStart: string;
  periodEnd: string;

  // Summary Statistics
  totalTransactions: number;
  totalCost: number;
  averageRepairCost: number;

  // Console Analysis
  consoleBreakdown: ConsoleMaintenanceBreakdown[];

  // Parts Analysis
  mostUsedParts: PartUsageAnalysis[];

  // Issue Analysis
  commonIssues: MaintenanceIssueFrequency[];

  // Cost Analysis
  costByCategory: CostCategoryBreakdown[];
  costTrend: MonthlyCostTrend[];

  // Performance Metrics
  averageRepairTime: number; // Hours
  firstTimeFixRate: number; // Percentage
  warrantyClaimRate: number; // Percentage

  generatedAt: string;
  generatedBy: string;
}

// RFID Cards
export interface RFIDCard {
  id: string;
  uid: string;
  alias?: string;
  status: "active" | "blocked" | "lost";
  balance_points: number;
  is_admin: boolean;
  is_helper_card: boolean;
  is_pay_as_you_go_card: boolean;
  avg_nilai_point: number;
  created_at: string;
}

export interface ConsoleMaintenanceBreakdown {
  consoleModel: string;
  transactionCount: number;
  totalCost: number;
  averageCost: number;
  mostCommonIssue: string;
  averageRepairTime: number;
}

export interface PartUsageAnalysis {
  sparepartId: string;
  sparepartName: string;
  category: string;
  usageCount: number;
  totalCost: number;
  averageCost: number;
  stockLevel: number;
  reorderRecommendation: boolean;
}

export interface CostCategoryBreakdown {
  category: "labor" | "parts" | "additional_fees";
  totalCost: number;
  percentage: number;
  transactionCount: number;
}

export interface MonthlyCostTrend {
  month: string;
  totalCost: number;
  transactionCount: number;
  averageCost: number;
}

// Technician Management
export interface Technician {
  id: string;
  name: string;
  email: string;
  phone: string;
  specializations: string[]; // e.g., ['PS5', 'PS4', 'Cooling Systems']
  certifications: TechnicianCertification[];
  hourlyRate: number;
  status: "active" | "inactive" | "on-leave";
  totalRepairs: number;
  averageRepairTime: number;
  customerRating: number;
  joinDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface TechnicianCertification {
  id: string;
  name: string;
  issuedBy: string;
  issuedDate: string;
  expiryDate?: string;
  certificateNumber?: string;
}

// Supplier Management
export interface Supplier {
  id: string;
  name: string;
  contact: string; // Contact person name
  phone: string;
  email: string;
  address: string;
  category: "beverage" | "food" | "snack" | "other";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Purchase Order Management
export interface PurchaseOrder {
  id: string;
  poNumber: string; // e.g., "PO-2024-001"
  supplierId: string;
  orderDate: string;
  expectedDate: string;
  receivedDate?: string;
  status: "pending" | "ordered" | "received" | "cancelled";
  items: PurchaseOrderItem[];
  subtotal: number;
  tax: number;
  totalAmount: number;
  notes?: string;
  receivedBy?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  total: number;
}

// Simplified Voucher System
export interface Voucher {
  id: string;
  voucherCode: string; // Unique code like "VCH001", "VCH002"
  name: string; // e.g., "Voucher 5 Jam Gaming"
  description: string;
  totalPoints: number; // Total hours in voucher
  remainingHours: number; // Hours left to use
  usedHours: number; // Hours already used
  originalPrice: number; // Normal price without discount
  voucherPrice: number; // Discounted voucher price
  discountAmount: number; // Amount saved
  discountPercentage: number; // Percentage saved
  validityDays: number; // How many days valid after creation
  createdDate: string;
  expiryDate: string;
  status: "active" | "expired" | "used-up";
  customerId?: string; // If sold to specific customer
  customerName?: string; // Customer name for easy reference
  customerPhone?: string; // Customer phone
  soldDate?: string; // When voucher was sold
  soldBy?: string; // Staff who sold the voucher
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface VoucherUsage {
  id: string;
  voucherId: string;
  voucherCode: string;
  rentalSessionId?: string;
  hoursUsed: number;
  usageDate: string;
  remainingHoursAfter: number;
  usedBy?: string; // Staff who processed the usage
  notes?: string;
  createdAt: string;
}

export interface RentalSession {
  id: string;
  customerId?: string; // Optional - for tracking purposes only
  consoleId: string;
  card_uid?: string;
  startTime: string;
  endTime?: string;
  duration: number; // in minutes
  rateType: "hourly" | "daily" | "weekly" | "monthly";
  baseAmount: number;
  peakHourAmount?: number; // Additional charge for peak hours
  weekendAmount?: number; // Additional charge for weekends
  lateFee: number;
  totalAmount: number;
  status: "active" | "completed" | "overdue";
  paymentStatus: "pending" | "partial" | "paid";
  paidAmount: number;
  appliedRateProfile: {
    id: string;
    name: string;
    hourlyRate: number;
    peakHourRate?: number;
    weekendMultiplier?: number;
  };
  // Member card billing fields
  is_voucher_used?: boolean; // Renamed from isVoucherUsed for consistency
  hourly_rate_snapshot?: number;
  per_minute_rate_snapshot?: number;
  last_billed_minutes?: number;
  total_points_deducted?: number;
  // Legacy voucher fields (deprecated)
  voucherId?: string;
  voucherCode?: string;
  voucherHoursUsed?: number;
  voucherRemainingBefore?: number;
  voucherRemainingAfter?: number;
}

export interface Invoice {
  id: string;
  rentalSessionId: string;
  customerId: string;
  issueDate: string;
  dueDate: string;
  items: InvoiceItem[];
  subtotal: number;
  lateFee: number;
  total: number;
  status: "draft" | "sent" | "paid" | "overdue";
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface Payment {
  id: string;
  invoiceId: string;
  customerId: string;
  amount: number;
  paymentDate: string;
  method: "cash" | "card" | "transfer";
  reference?: string;
}

// Scheduled Booking Types
export interface ScheduledBooking {
  id: string;
  customerId: string;
  consoleId: string;
  bookingDate: string; // Date when booking was made
  scheduledDate: string; // Date when rental will start
  scheduledTime: string; // Time when rental will start (HH:MM)
  duration: number; // Duration in hours
  endTime: string; // Calculated end time
  totalAmount: number;
  depositAmount: number;
  remainingAmount: number;
  status: "confirmed" | "cancelled" | "completed" | "no-show" | "in-progress";
  paymentStatus: "unpaid" | "deposit-paid" | "fully-paid";
  notes?: string;
  reminderSent: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface BookingConflict {
  consoleId: string;
  conflictStart: string;
  conflictEnd: string;
  existingBookingId: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  type: "booking" | "rental" | "maintenance";
  status: string;
  consoleId: string;
  customerId?: string;
  color: string;
}

// POS System Types
export interface Product {
  id: string;
  name: string;
  category: "snack" | "beverage" | "food" | "other";
  price: number;
  cost: number;
  stock: number;
  minStock: number;
  barcode?: string;
  image?: string;
  image_url?: string;
  description?: string;
  isActive: boolean;
  unit?:string;
  product_type?:string;
}

export interface Sale {
  id: string;
  customerId?: string;
  items: SaleItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: "cash" | "card" | "transfer";
  paymentAmount: number;
  changeAmount: number;
  saleDate: string;
  cashierId: string;
  notes?: string;
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  total: number;
}

// Enhanced Cashier Session Management
export interface CashierSession {
  id: string;
  cashierId: string;
  cashierName: string;
  startTime: string;
  endTime?: string;
  openingCash: number; // Saldo awal dari bos
  closingCash?: number; // Uang yang disetor ke bos
  expectedCash?: number; // Perhitungan sistem (opening + cash sales - change)
  variance?: number; // Selisih antara expected dan actual
  totalRevenue: number;
  totalCash: number; // Total penjualan tunai
  totalCard: number; // Total penjualan kartu
  totalTransfer: number; // Total penjualan transfer
  totalTransactions: number; // Jumlah transaksi
  status: "active" | "closed";
  notes?: string; // Catatan kasir
  createdAt: string;
  updatedAt: string;
}

// Transaction record for each sale during cashier session
export interface CashierTransaction {
  id: string;
  sessionId: string;
  type: "sale" | "rental" | "voucher" | "refund";
  amount: number;
  paymentMethod: "cash" | "card" | "transfer";
  referenceId: string; // Sale ID, Rental ID, etc.
  description: string;
  timestamp: string;
  cashierId: string;
}

// Cash flow tracking
export interface CashFlow {
  id: string;
  sessionId: string;
  type: "in" | "out";
  amount: number;
  description: string;
  category: "sale" | "change" | "opening" | "closing" | "adjustment";
  timestamp: string;
  cashierId: string;
}

export interface BookkeepingEntry {
  id: string;
  entry_date: string;
  type: "income" | "expense";
  category:
    | "rental"
    | "cafe"
    | "inventory"
    | "operational"
    | "voucher"
    | "other";
  description: string;
  amount: number;
  reference?: string;
  notes?: string;
}

// User Management Types
export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  phone?: string;
  avatar?: string;
  roleId: string;
  status: "active" | "inactive" | "suspended";
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  nav_items: Permission[];
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Permission {
  id: string;
  // module: string;
  // action: string;
  // resource: string;
  // description: string;
  label: string;
}

export interface UserSession {
  id: string;
  userId: string;
  loginTime: string;
  logoutTime?: string;
  ipAddress: string;
  userAgent: string;
  status: "active" | "expired" | "terminated";
}

export interface ActivityLog {
  id: string;
  userId: string;
  action: string;
  module: string;
  description: string;
  metadata?: Record<string, any>;
  timestamp: string;
  ipAddress: string;
}

export interface CardUsageLog {
  id: string;
  card_uid: string;
  session_id?: string;
  used_by_name?: string; 
  used_by_phone?: string; 
  action_type:
    | "rental_start"
    | "rental_end"
    | "balance_deduct"
    | "balance_add"
    | "card_unassigned"
    | "customer_unlinked"
    | "schema_migration"
    | "balance_change"
    | "session_end_manual"
    | "session_end_auto";
  points_amount: number;
  balance_before: number;
  balance_after: number;
  timestamp: string;
  notes?: string;
}

export interface CardBalanceSummary {
  uid: string;
  alias?: string;
  balance_points: number;
  status: string;
  issued_at: string;
  last_seen_at?: string;
  total_sessions: number;
  total_points_used: number;
  last_rental_end?: string;
  sessions_last_7_days: number;
  sessions_last_30_days: number;
}
