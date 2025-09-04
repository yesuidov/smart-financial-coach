// Data Service Layer - Abstracts data sources for easy Plaid integration later
import { supabase } from '../lib/supabase';

class DataService {
  constructor() {
    this.dataSource = 'supabase'; // Can be changed to 'plaid' later
  }

  // Transaction Management
  async getTransactions(userId, options = {}) {
    if (this.dataSource === 'supabase') {
      return this.getSupabaseTransactions(userId, options);
    }
    // Future: return this.getPlaidTransactions(userId, options);
  }

  async getSupabaseTransactions(userId, options = {}) {
    const { limit = 50, offset = 0, startDate, endDate, category } = options;
    
    let query = supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('processed_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (startDate) {
      query = query.gte('processed_at', startDate);
    }
    if (endDate) {
      query = query.lte('processed_at', endDate);
    }
    if (category) {
      query = query.eq('ai_category', category);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  // Account Management
  async getAccounts(userId) {
    if (this.dataSource === 'supabase') {
      return this.getSupabaseAccounts(userId);
    }
    // Future: return this.getPlaidAccounts(userId);
  }

  async getSupabaseAccounts(userId) {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Goals Management
  async getGoals(userId) {
    if (this.dataSource === 'supabase') {
      return this.getSupabaseGoals(userId);
    }
    // Future: return this.getPlaidGoals(userId);
  }

  async getSupabaseGoals(userId) {
    const { data, error } = await supabase
      .from('financial_goals')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Analytics and Insights
  async getSpendingAnalytics(userId, period = '30d') {
    const transactions = await this.getTransactions(userId, { 
      limit: 1000,
      startDate: this.getDateRange(period).start,
      endDate: this.getDateRange(period).end
    });

    return this.analyzeSpending(transactions);
  }

  analyzeSpending(transactions) {
    const categorySpending = {};
    const merchantSpending = {};
    const dailySpending = {};
    let totalSpent = 0;
    let totalIncome = 0;

    transactions.forEach(txn => {
      const amount = parseFloat(txn.amount || 0);
      const category = txn.ai_category || txn.category || 'other';
      const merchant = txn.merchant || txn.description || 'Unknown';
      const date = new Date(txn.processed_at || txn.created_at).toISOString().split('T')[0];

      if (txn.transaction_type === 'debit' || txn.transaction_type === 'payment') {
        totalSpent += amount;
        categorySpending[category] = (categorySpending[category] || 0) + amount;
        merchantSpending[merchant] = (merchantSpending[merchant] || 0) + amount;
        dailySpending[date] = (dailySpending[date] || 0) + amount;
      } else if (txn.transaction_type === 'credit' || txn.transaction_type === 'deposit') {
        totalIncome += amount;
      }
    });

    return {
      totalSpent,
      totalIncome,
      netCashflow: totalIncome - totalSpent,
      categorySpending,
      merchantSpending,
      dailySpending,
      transactionCount: transactions.length
    };
  }

  // Trend Analysis
  async getSpendingTrends(userId, period = '90d') {
    const transactions = await this.getTransactions(userId, { 
      limit: 2000,
      startDate: this.getDateRange(period).start,
      endDate: this.getDateRange(period).end
    });

    return this.analyzeTrends(transactions);
  }

  analyzeTrends(transactions) {
    const categoryTrends = {};
    const monthlyData = {};

    transactions.forEach(txn => {
      const amount = parseFloat(txn.amount || 0);
      const category = txn.ai_category || txn.category || 'other';
      const date = new Date(txn.processed_at || txn.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (txn.transaction_type === 'debit' || txn.transaction_type === 'payment') {
        if (!categoryTrends[category]) {
          categoryTrends[category] = [];
        }
        categoryTrends[category].push({ amount, date });

        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { total: 0, categories: {} };
        }
        monthlyData[monthKey].total += amount;
        monthlyData[monthKey].categories[category] = (monthlyData[monthKey].categories[category] || 0) + amount;
      }
    });

    // Calculate trends
    const trends = {};
    Object.keys(categoryTrends).forEach(category => {
      const amounts = categoryTrends[category].map(t => t.amount);
      if (amounts.length >= 3) {
        const recent = amounts.slice(-3);
        const older = amounts.slice(-6, -3);
        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const olderAvg = older.length > 0 ? older.reduce((a, b) => a + b, 0) / older.length : recentAvg;
        
        const change = ((recentAvg - olderAvg) / olderAvg) * 100;
        trends[category] = {
          change: Math.round(change),
          trend: change > 10 ? 'increasing' : change < -10 ? 'decreasing' : 'stable',
          recentAverage: recentAvg
        };
      }
    });

    return { trends, monthlyData };
  }

  // Utility Methods
  getDateRange(period) {
    const now = new Date();
    const start = new Date();

    switch (period) {
      case '7d':
        start.setDate(now.getDate() - 7);
        break;
      case '30d':
        start.setDate(now.getDate() - 30);
        break;
      case '90d':
        start.setDate(now.getDate() - 90);
        break;
      case '1y':
        start.setFullYear(now.getFullYear() - 1);
        break;
      default:
        start.setDate(now.getDate() - 30);
    }

    return {
      start: start.toISOString(),
      end: now.toISOString()
    };
  }

  // Future Plaid Integration Methods (commented out for now)
  /*
  async getPlaidTransactions(userId, options = {}) {
    // This will be implemented when integrating with Plaid
    // Will call your backend API which will use Plaid SDK
    const response = await fetch(`/api/users/${userId}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options)
    });
    return response.json();
  }

  async getPlaidAccounts(userId) {
    // This will be implemented when integrating with Plaid
    const response = await fetch(`/api/users/${userId}/accounts`);
    return response.json();
  }
  */

  // Switch data source (for future use)
  setDataSource(source) {
    if (['supabase', 'plaid'].includes(source)) {
      this.dataSource = source;
    } else {
      throw new Error('Invalid data source. Must be "supabase" or "plaid"');
    }
  }
}

// Export singleton instance
export const dataService = new DataService();
export default dataService;
