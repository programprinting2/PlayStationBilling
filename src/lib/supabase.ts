import { createClient } from '@supabase/supabase-js';
import { UserSession } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceRole = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseServiceRole, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// export const supabase2 = createClient(supabaseUrl, supabaseServiceRole, {
//   auth: {
//     autoRefreshToken: true,
//     persistSession: true,
//     detectSessionInUrl: true
//   }
// });


// Helper function to get current user with proper error handling
async function getCurrentUserSafe() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      // Handle the specific case where no session exists - this is normal
      if (error.message === 'Auth session missing!') {
        return null;
      }
      throw new Error(`Failed to retrieve user session: ${error.message}`);
    }
    
    if (!user) {
      return null;
    }
    
    return user;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Authentication error: Unable to verify user session');
  }
}

// Database helper functions
export const db = {
  // Generic query functions
  async select(table: string, columns = '*', filters?: Record<string, any>) {
    let query = supabase.from(table).select(columns);
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async insert(table: string, data: any) {
    const { data: result, error } = await supabase
      .from(table)
      .insert(data)
      .select()
      .single();
    
    if (error) throw error;
    return result;
  },

  async update(table: string, id: string, data: any) {
    const { data: result, error } = await supabase
      .from(table)
      .update(data)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return result;
  },

  async delete(table: string, id: string) {
    const { data: result, error } = await supabase
      .from(table)
      .delete()
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return result;
  },

  // Specific business logic functions
  customers: {
    async getAll() {
      return db.select('customers', '*', { status: 'active' });
    },

    async create(customer: any) {
      const user = await getCurrentUserSafe();
      if (!user) {
        throw new Error('No authenticated user found. Please log in to continue.');
      }
      return db.insert('customers', {
        ...customer,
        created_by: user.id
      });
    },

    async update(id: string, customer: any) {
      return db.update('customers', id, customer);
    }
  },

  consoles: {
    async getAll() {
      const { data, error } = await supabase
        .from('consoles')
        .select(`
          *,
          equipment_types(name, category),
          rate_profiles(name, hourly_rate)
        `)
        .eq('is_active', true);
      
      if (error) throw error;
      return data;
    },

    async getById(id: string) {
      const { data, error } = await supabase
        .from('consoles')
        .select(`
          *
        `)
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },

    async updateStatus(id: string, status: string) {
      return db.update('consoles', id, { status });
    },
    
    async addInstalledGame(consoleId: string, gameId: string) {
      // Get current console
      const console = await this.getById(consoleId);
      if (!console) throw new Error('Console not found');

      const currentInstalled = console.installed_games || [];
      if (!currentInstalled.includes(gameId)) {
        currentInstalled.push(gameId);
        await db.update("consoles", consoleId, { installed_games: currentInstalled });
      }
    },

    async removeInstalledGame(consoleId: string, gameId: string) {
      const console = await this.getById(consoleId);
      if (!console) throw new Error('Console not found');

      const currentInstalled = console.installed_games || [];
      const updatedInstalled = currentInstalled.filter(id => id !== gameId);
      await db.update("consoles", consoleId, { installed_games: updatedInstalled });
    },

    async getConsoleGames(consoleId: string) {
      const console = await this.getById(consoleId);
      if (!console) return { installed: [], available: [] };

      return {
        installed: console.installed_games || []
      };
    },

    async getAvailableGames(consoleId: string) {
      try {
        const console = await this.getById(consoleId);
        if (!console) return [];

        // Get all active games and filter by platform compatibility
        const allGames = await db.games.getAll();
        
        if (!Array.isArray(allGames)) {
          console.warn('Failed to fetch games:', allGames);
          return [];
        }

        return allGames.filter((game: any) => 
          game.is_active && 
          game.platform?.some((platform: string) => {
            const platformMapping = {
              'ps3': 'PS3',
              'ps4': 'PS4', 
              'ps5': 'PS5',
              'billiard': 'Billiard'
            };
            return platformMapping[platform as keyof typeof platformMapping] === console.equipment_type_id;
          })
        );
      } catch (error) {
        console.error('Error fetching available games:', error);
        return [];
      }
    }
  },

  games: {
    async getAll() {
      return await db.select('games');
    },

    async getById(id: string) {
      const data = await db.select('games', '*', { id });
      return data[0] || null;
    },

    async getByPlatform(platformId: string) {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .contains('platform', [platformId]);
      if (error) throw error;
      return data;
    },

    async create(gameData: any) {
      const user = await getCurrentUserSafe();
      const game = {
        ...gameData,
        // createdBy: user?.id || 'system',
        // createdAt: new Date().toISOString(),
        // updatedAt: new Date().toISOString()
      };
      return await db.insert('games', game);
    },

    async update(id: string, gameData: any) {
      const updateData = {
        ...gameData,
        updated_at: new Date().toISOString()
      };
      return await db.update('games', id, updateData);
    },

    async delete(id: string) {
      return await db.delete('games', id);
    }
  },

  equipmentTypes: {
    async getAll() {
      return await db.select('equipment_types');
    },

    async getById(id: string) {
      const data = await db.select('equipment_types', '*', { id });
      return data[0] || null;
    },

    async getActive() {
      return await db.select('equipment_types', '*', { is_active: true });
    },
  },
  products: {
    async getAll() {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          suppliers(name)
        `)
      
      if (error) throw error;
      return data;
    },
    async getRawMaterials() {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          suppliers(name)
        `)
        .eq("product_type","raw_material")
      
      if (error) throw error;
      return data;
    },
    async getFinishedGoods() {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          suppliers(name)
        `)
        .eq("product_type","finished_good")
      
      if (error) throw error;
      return data;
    },
    async getActiveProducts() {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          suppliers(name)
        `)
        .eq('is_active', true)
        .eq("product_type", "finished_good");
      
      if (error) throw error;
      return data;
    },

    async create(product: any) {
      const user = await getCurrentUserSafe();
      if (!user) {
        throw new Error('Authentication error');
      }
      return db.insert('products', {
        ...product,
        created_by: user.id
      });
    },

    async updateStock(id: string, quantity: number) {
      const { data: product } = await supabase
        .from('products')
        .select('stock')
        .eq('id', id)
        .single();
      
      if (product) {
        return db.update('products', id, { 
          stock: product.stock - quantity 
        });
      }
    },

    async increaseStock(id: string, quantity: number) {
      const { data: product, error } = await supabase
        .from('products')
        .select('stock')
        .eq('id', id)
        .single();
      if (error) throw error;
      if (!product) throw new Error('Produk tidak ditemukan');
      return db.update('products', id, { stock: (Number(product.stock) || 0) + Number(quantity) });
    },

    async decreaseStock(id: string, quantity: number) {
      const { data: product, error } = await supabase
        .from('products')
        .select('stock')
        .eq('id', id)
        .single();
      if (error) throw error;
      if (!product) throw new Error('Produk tidak ditemukan');
      return db.update('products', id, { stock: (Number(product.stock) || 0) - Number(quantity) });
    },

    async update(id: string, product: any) {
      return db.update('products', id, product);
    }
  },

  sales: {
    async create(sale: any, items: any[]) {
      const user = await getCurrentUserSafe();
      if (!user) {
        throw new Error('No authenticated user found. Please log in to continue.');
      }
      
      // Create sale
      const saleData = await db.insert('sales', {
        ...sale,
        cashier_id: user.id,
        sale_date: new Date().toISOString()
      });

      // Create sale items
      const itemsData = await Promise.all(
        items.map(item => 
          db.insert('sale_items', {
            ...item,
            sale_id: saleData.id
          })
        )
      );

      // Update product stock
      await Promise.all(
        items.map(item => 
          db.products.updateStock(item.product_id, item.quantity)
        )
      );

      return { sale: saleData, items: itemsData };
    }
  },

  rentals: {
    async create(rental: any) {
      const user = await getCurrentUserSafe();
      if (!user) {
        throw new Error('No authenticated user found. Please log in to continue.');
      }
      
      return db.insert('rental_sessions', {
        ...rental,
        created_by: user.id,
        start_time: new Date().toISOString()
      });
    },

    async getActive() {
      return db.select('rental_sessions', `
        *,
        consoles(name, location)
      `, { status: 'active' });
    },

    async endSession(id: string, endData: any) {
      return db.update('rental_sessions', id, {
        ...endData,
        end_time: new Date().toISOString(),
        status: 'completed'
      });
    }
  },

  vouchers: {
    async create(voucher: any) {
      const user = await getCurrentUserSafe();
      if (!user) {
        throw new Error('No authenticated user found. Please log in to continue.');
      }
      
      // Generate voucher code
      const { data } = await supabase.rpc('generate_voucher_code');
      
      return db.insert('vouchers', {
        ...voucher,
        voucher_code: data,
        // created_by: user.id,
        // expiry_date: new Date(Date.now() + voucher.validity_days * 24 * 60 * 60 * 1000).toISOString()
      });
    },

    async use(voucherId: string, hoursUsed: number) {
      const { data: voucher } = await supabase
        .from('vouchers')
        .select('*')
        .eq('id', voucherId)
        .single();

      if (voucher && voucher.remaining_hours >= hoursUsed) {
        const newRemainingHours = voucher.remaining_hours - hoursUsed;
        const newUsedHours = voucher.used_hours + hoursUsed;
        
        // Update voucher
        await db.update('vouchers', voucherId, {
          remaining_hours: newRemainingHours,
          used_hours: newUsedHours,
          status: newRemainingHours <= 0 ? 'used-up' : 'active'
        });

        // Record usage
        const user = await getCurrentUserSafe();
        if (!user) {
          throw new Error('No authenticated user found. Please log in to continue.');
        }
        await db.insert('voucher_usages', {
          voucher_id: voucherId,
          voucher_code: voucher.voucher_code,
          hours_used: hoursUsed,
          remaining_hours_after: newRemainingHours,
          used_by: user.id
        });

        return true;
      }
      
      return false;
    }
  },

  cashierSessions: {
    async getCurrent(cashierId: string) {
      const { data, error } = await supabase
        .from('cashier_sessions')
        .select('*')
        .eq('cashier_id', cashierId)
        .eq('status', 'active')
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },

    async create(sessionData: any) {
      const user = await getCurrentUserSafe();
      if (!user) {
        throw new Error('No authenticated user found. Please log in to continue.');
      }
      
      return db.insert('cashier_sessions', {
        ...sessionData,
        cashier_id: user.id,
      });
    },

    async close(sessionId: string, closeData: any) {
      return db.update('cashier_sessions', sessionId, {
        ...closeData,
        end_time: new Date().toISOString(),
        status: 'closed'
      });
    }
  },

  suppliers: {
    async getAll() {
      return db.select('suppliers', '*');
    },
    async create(supplier: any) {
      // Hilangkan autentikasi user
      return db.insert('suppliers', supplier);
    },
    async update(id: string, supplier: any) {
      return db.update('suppliers', id, supplier);
    },
    async delete(id: string) {
      return db.delete('suppliers', id);
    }
  },

  purchases: {
    async getAll() {
      return db.select('purchase_orders', '*');
    },
    // async create(purchase: any) {
    //   // Generate PO number (simple: PO-YYYYMMDD-<random4>)
    //   const today = new Date();
    //   const dateStr = today.toISOString().slice(0,10).replace(/-/g, '');
    //   const rand = Math.floor(1000 + Math.random() * 9000);
    //   const po_number = `PO-${dateStr}-${rand}`;
    //   // Insert PO
    //   const po = await db.insert('purchase_orders', {
    //     po_number,
    //     supplier_id: purchase.supplier_id,
    //     notes: purchase.notes,
    //     expected_date: purchase.expected_date,
    //     subtotal: purchase.subtotal,
    //     // tax: purchase.tax,
    //     total_amount: purchase.total_amount || purchase.total, // fallback for old code
    //     // status: 'pending',
    //     // created_by: null // tidak perlu jika tidak ada user
    //   });
    //   // Insert PO items
    //   if (purchase.items && Array.isArray(purchase.items)) {
    //     for (const item of purchase.items) {
    //       await db.insert('purchase_order_items', {
    //         po_id: po.id,
    //         product_id: item.productId,
    //         product_name: item.productName,
    //         quantity: item.quantity,
    //         unit_cost: item.unitCost,
    //         total: item.total
    //       });

    //       if (item.productId && item.quantity > 0) {
    //         await db.products.increaseStock(item.productId, item.quantity);
    //       }
    //     }
    //   }
    //   return po;
    // },
    async create(purchase: any) {
      // Generate PO number (simple: PO-YYYYMMDD-<random4>)
      const today = new Date();
      const dateStr = today.toISOString().slice(0,10).replace(/-/g, '');
      const rand = Math.floor(1000 + Math.random() * 9000);
      const po_number = `PO-${dateStr}-${rand}`;
      
      // Validasi semua produk ada sebelum melakukan operasi
      if (purchase.items && Array.isArray(purchase.items)) {
        for (const item of purchase.items) {
          if (item.productId && item.quantity > 0) {
            const { data: product, error } = await supabase
              .from('products')
              .select('id, stock')
              .eq('id', item.productId)
              .single();
            
            if (error || !product) {
              throw new Error(`Produk dengan ID ${item.productId} tidak ditemukan`);
            }
          }
        }
      }
      
      const po = await db.insert('purchase_orders', {
        po_number,
        supplier_id: purchase.supplier_id,
        // status: 'received', // Set status ke received
        // received_date: new Date().toISOString().split('T')[0], // Set tanggal diterima
        notes: purchase.notes,
        expected_date: purchase.expected_date,
        order_date: purchase.order_date || new Date().toISOString(),
        subtotal: purchase.subtotal,
        // tax: purchase.tax,
        total_amount: purchase.total_amount || purchase.total, 
      });

      const successfulStockIncreases: Array<{productId: string, quantity: number}> = [];
      
      try {
        if (purchase.items && Array.isArray(purchase.items)) {
          for (const item of purchase.items) {
            await db.insert('purchase_order_items', {
              po_id: po.id,
              product_id: item.productId,
              product_name: item.productName,
              quantity: item.quantity,
              unit_cost: item.unitCost,
              total: item.total
            });

            if (item.productId && item.quantity > 0) {
              await db.products.increaseStock(item.productId, item.quantity);
              successfulStockIncreases.push({productId: item.productId, quantity: item.quantity});
            }
          }
        }
        return po;
      } catch (error) {
        // Rollback stock increases yang sudah berhasil
        for (const increase of successfulStockIncreases) {
          try {
            await db.products.decreaseStock(increase.productId, increase.quantity);
          } catch (rollbackError) {
            console.error(`Gagal rollback stok untuk produk ${increase.productId}:`, rollbackError);
          }
        }
        throw error; 
      }
    },
    async delete(poId: string) {
      const { data: items, error: itemsErr } = await supabase
        .from('purchase_order_items')
        .select('product_id, quantity')
        .eq('po_id', poId);
      if (itemsErr) throw itemsErr;

      if (Array.isArray(items)) {
        for (const it of items) {
          if (it?.product_id && it?.quantity) {
            await db.products.decreaseStock(it.product_id, it.quantity);
          }
        }
      }

      return db.delete('purchase_orders', poId);
    }
    ,
    async update(poId: string, purchase: any) {
      // Fetch existing items
      const { data: oldItems, error: oldErr } = await supabase
        .from('purchase_order_items')
        .select('id, product_id, quantity')
        .eq('po_id', poId);
      if (oldErr) throw oldErr;

      const oldItemsArray = Array.isArray(oldItems) ? oldItems : [];

      // Compute stock deltas per product
      const deltaByProduct: Record<string, number> = {};
      for (const it of oldItemsArray) {
        const pid = String(it.product_id);
        deltaByProduct[pid] = (deltaByProduct[pid] || 0) - Number(it.quantity || 0);
      }

      const newItems = Array.isArray(purchase.items) ? purchase.items : [];
      for (const it of newItems) {
        if (!it.productId) continue;
        const pid = String(it.productId);
        deltaByProduct[pid] = (deltaByProduct[pid] || 0) + Number(it.quantity || 0);
      }

      // Update PO header
      await db.update('purchase_orders', poId, {
        supplier_id: purchase.supplier_id ?? undefined,
        notes: purchase.notes ?? undefined,
        expected_date: purchase.expected_date ?? undefined,
        subtotal: purchase.subtotal ?? undefined,
        total_amount: purchase.total_amount ?? purchase.total ?? undefined
      });

      // Upsert items
      const existingIds = new Set<string>();
      for (const it of newItems) {
        if (it.id) {
          existingIds.add(String(it.id));
          await db.update('purchase_order_items', String(it.id), {
            po_id: poId,
            product_id: it.productId,
            product_name: it.productName,
            quantity: it.quantity,
            unit_cost: it.unitCost,
            total: it.total
          });
        } else {
          const inserted = await db.insert('purchase_order_items', {
            po_id: poId,
            product_id: it.productId,
            product_name: it.productName,
            quantity: it.quantity,
            unit_cost: it.unitCost,
            total: it.total
          });
          if (inserted?.id) existingIds.add(String(inserted.id));
        }
      }

      // Delete removed items
      for (const oi of oldItemsArray) {
        const idStr = String(oi.id);
        if (!existingIds.has(idStr)) {
          await db.delete('purchase_order_items', idStr);
        }
      }

      // Apply stock adjustments
      for (const [productId, delta] of Object.entries(deltaByProduct)) {
        if (!productId || !Number.isFinite(delta as unknown as number)) continue;
        if ((delta as number) > 0) {
          await db.products.increaseStock(productId, delta as number);
        } else if ((delta as number) < 0) {
          await db.products.decreaseStock(productId, Math.abs(delta as number));
        }
      }

      // Return updated PO
      const { data: updated, error: getErr } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('id', poId)
        .single();
      if (getErr) throw getErr;
      return updated;
    }
  },

  // Stock Opname
  stockOpname: {
    async createSession(payload: {
      nomor?: string;
      name?: string;
      opname_date?: string; // ISO date
      notes?: string;
      totals_diff: number;
      totals_nominal: number;
    }) {
      const user = await getCurrentUserSafe();
      const data = await db.insert('stock_opname_sessions', {
        nomor: payload.nomor ?? null,
        name: payload.name ?? null,
        opname_date: payload.opname_date ? payload.opname_date.slice(0,10) : new Date().toISOString().slice(0,10),
        notes: payload.notes ?? null,
        totals_diff: Math.trunc(payload.totals_diff || 0),
        totals_nominal: Number(payload.totals_nominal || 0),
        created_by: user?.id ?? null
      });
      return data;
    },

    async addItems(sessionId: string, rows: Array<{ productId?: string | null; productName?: string; barcode?: string; systemStock?: number; physicalStock?: number; unitCost?: number; }>) {
      for (const r of rows) {
        const diff = Math.trunc((Number(r.physicalStock||0)) - (Number(r.systemStock||0)));
        const nominal = Number(diff * Number(r.unitCost||0));
        await db.insert('stock_opname_items', {
          session_id: sessionId,
          product_id: r.productId ?? null,
          product_name: r.productName ?? null,
          barcode: r.barcode ?? null,
          system_stock: Math.trunc(Number(r.systemStock||0)),
          physical_stock: Math.trunc(Number(r.physicalStock||0)),
          unit_cost: Number(r.unitCost||0),
          diff: diff,
          nominal_diff: nominal
        });
      }
    },

    async replaceItems(sessionId: string, rows: Array<{ productId?: string | null; productName?: string; barcode?: string; systemStock?: number; physicalStock?: number; unitCost?: number; }>) {
      // delete existing items then add new ones
      await supabase.from('stock_opname_items').delete().eq('session_id', sessionId);
      await (db as any).stockOpname.addItems(sessionId, rows);
    },

    async syncProductStocks(rows: Array<{ productId?: string | null; physicalStock?: number }>) {
      for (const r of rows) {
        if (!r.productId) continue;
        const target = Math.max(0, Math.trunc(Number(r.physicalStock || 0)));
        await db.products.update(String(r.productId), { stock: target });
      }
    },

    async applyStockAdjustments(rows: Array<{ productId?: string | null; systemStock?: number; physicalStock?: number }>) {
      for (const r of rows) {
        if (!r.productId) continue;
        const sys = Math.trunc(Number(r.systemStock||0));
        const phy = Math.trunc(Number(r.physicalStock||0));
        const delta = phy - sys;
        if (delta === 0) continue;
        if (delta > 0) {
          await db.products.increaseStock(String(r.productId), delta);
        } else {
          await db.products.decreaseStock(String(r.productId), Math.abs(delta));
        }
      }
    },

    async getAllSessions() {
      const { data, error } = await supabase
        .from('stock_opname_sessions')
        .select(`
          *,
          users(full_name)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },

    async getSessionWithItems(sessionId: string) {
      const { data: session, error: sessionError } = await supabase
        .from('stock_opname_sessions')
        .select(`
          *,
          users(full_name)
        `)
        .eq('id', sessionId)
        .single();
      
      if (sessionError) throw sessionError;

      const { data: items, error: itemsError } = await supabase
        .from('stock_opname_items')
        .select(`
          *,
          products(unit)
        `)
        .eq('session_id', sessionId);
        // .order('created_at', { ascending: true });
      
      if (itemsError) throw itemsError;

      return {
        ...session,
        rows: (items || []).map((item: any) => ({
          id: item.id,
          productId: item.product_id,
          productName: item.product_name,
          barcode: item.barcode,
          systemStock: item.system_stock,
          physicalStock: item.physical_stock,
          unitCost: item.unit_cost,
          unit: item.products?.unit,
          note: '', // items table doesn't have note field, but we can add it later if needed
          code: item.barcode || item.product_name || '',
        }))
      };
    },

    async getNextSequenceNumber(date: Date) {
      const mm = date.getMonth();
      const yy = date.getFullYear();
      
      // Get all sessions from database
      const { data, error } = await supabase
        .from('stock_opname_sessions')
        .select('nomor, opname_date, created_at')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Filter sessions for the exact month/year
      const sameMonthSessions = (data || []).filter((s: any) => {
        try {
          const sessionDate = new Date(s.opname_date || s.created_at);
          return sessionDate.getMonth() === mm && sessionDate.getFullYear() === yy;
        } catch (e) {
          return false;
        }
      });
      
      return sameMonthSessions.length + 1;
    },

    async updateSession(id: string, payload: {
      nomor?: string | null;
      name?: string | null;
      opname_date?: string | null; 
      notes?: string | null;
      totals_diff?: number;
      totals_nominal?: number;
    }) {
      const updateDoc: any = {};
      if (payload.nomor !== undefined) updateDoc.nomor = payload.nomor;
      if (payload.name !== undefined) updateDoc.name = payload.name;
      if (payload.opname_date !== undefined) updateDoc.opname_date = payload.opname_date ? payload.opname_date.slice(0,10) : null;
      if (payload.notes !== undefined) updateDoc.notes = payload.notes;
      if (payload.totals_diff !== undefined) updateDoc.totals_diff = Math.trunc(payload.totals_diff || 0);
      if (payload.totals_nominal !== undefined) updateDoc.totals_nominal = Number(payload.totals_nominal || 0);

      const { data, error } = await supabase
        .from('stock_opname_sessions')
        .update(updateDoc)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },

    async deleteSession(id: string) {
      const { error } = await supabase
        .from('stock_opname_sessions')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return true;
    }
  },

  // System settings (single row: id = 'default')
  settings: {
    async get() {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('id', 'default')
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    },

    async upsert(payload: any) {
      const { data, error } = await supabase
        .from('system_settings')
        .upsert(
          {
            id: 'default',
            general: payload.general,
            printer: payload.printer,
            api: payload.api,
            whatsapp_crm: payload.whatsapp_crm,
            notifications: payload.notifications,
            security: payload.security,
            backup: payload.backup,
            system: payload.system,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'id' }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  },
  sessions: {
    async getActiveSessions() {
      const { data, error } = await supabase
      .from('user_sessions')
      .select('*')
      .eq("status", "active")
      .order('created_at', { ascending: false })
    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
    },
    async createSession(userId: string, sessionData: {
      ip_address?: string;
      user_agent?: string;}): Promise<UserSession | null> {
      const { data, error } = await supabase
        .from('user_sessions')
        .insert({
          user_id: userId,
          ip_address: sessionData.ip_address || null,
          user_agent: sessionData.user_agent || null,
          status: 'active'
        })
        .select()
        .single();
      if (error) throw error;
      return data || null;
    },

    async logoutSession(sessionId: string): Promise<boolean> {
      try {
        const { error } = await supabase
          .from('user_sessions')
          .update({
            status: 'offline',
            logout_time: new Date().toISOString(),
          })
          .eq('id', sessionId);
  
        return !error;
      } catch (error) {
        console.error('Error terminating session:', error);
        return false;
      }
    }
  },
  logs: { 
    async logActivity(logData: {
      user_id: string;
      action: string;
      module: string;
      description: string;
      ip_address?: string;
      metadata?: any;
    }): Promise<boolean> {
      try {
        const { error } = await supabase
          .from('activity_logs')
          .insert({
            user_id: logData.user_id,
            action: logData.action,
            module: logData.module,
            description: logData.description,
            ip_address: logData.ip_address || await getClientIP(),
            metadata: logData.metadata || null,
            timestamp: new Date().toISOString()
          });
  
        return !error;
      } catch (error) {
        console.error('Error logging activity:', error);
        return false;
      }
    },
    async getLogs() {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(20)
      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    }
  }
};
 
// Expose the raw Supabase client on the db object for compatibility.
(db as any).supabase = supabase;

// Auth helper functions
export const auth = {
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getCurrentUser() {
    try {
      const user = await getCurrentUserSafe();
      
      if (!user) {
        return null;
      }
      
      const { data: userData, error } = await supabase
        .from('users')
        .select(`
          *,
          roles(id, name, nav_items)
        `)
        .eq('id', user.id)
        .single();
      
      if (error) {
        throw new Error(`Failed to retrieve user data: ${error.message}`);
      }
      
      return userData;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to get current user information');
    }
  }
};

export const storage = {
  async uploadGameCover(file: File, gameId?: string, oldImageUrl?: string): Promise<string> {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = gameId
        ? `${gameId}_cover.${fileExt}`
        : `temp_cover_${Date.now()}.${fileExt}`;

      const filePath = `game-covers/${fileName}`;

      if (oldImageUrl && oldImageUrl !== filePath) {
        await this.deleteGameCover(oldImageUrl);
      }

      const { data, error } = await supabase.storage
        .from('game-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('game-images')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading game cover:', error);
      throw new Error('Failed to upload image');
    }
  },

  async deleteGameCover(imageUrl: string): Promise<void> {
    try {
      if (!imageUrl || imageUrl.startsWith('data:')) return; 

      const urlParts = imageUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];
      const filePath = `game-covers/${fileName}`;

      const { error } = await supabase.storage
        .from('game-images')
        .remove([filePath]);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting game cover:', error);
    }
  },

  async uploadProductImage(file: File, productId?: string, oldImageUrl?: string): Promise<string> {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = productId
        ? `${productId}_thumb.${fileExt}`
        : `temp_product_${Date.now()}.${fileExt}`;

      const filePath = `product-images/${fileName}`;

      if (oldImageUrl) {
        await this.deleteProductImage(oldImageUrl);
      }

      const { error } = await supabase.storage
        .from('game-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('game-images')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading product image:', error);
      throw new Error('Failed to upload product image');
    }
  },

  async deleteProductImage(imageUrl: string): Promise<void> {
    try {
      if (!imageUrl || imageUrl.startsWith('data:')) return;

      const urlParts = imageUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];
      const filePath = `product-images/${fileName}`;

      const { error } = await supabase.storage
        .from('game-images')
        .remove([filePath]);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting product image:', error);
    }
  }
}

const getClientIP = async (): Promise<string> => {
  try {
    const response = await fetch("https://api.ipify.org?format=json");
    const data = await response.json();
    return data.ip;
  } catch {
    return "Unknown";
  }
};