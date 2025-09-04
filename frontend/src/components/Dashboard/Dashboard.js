import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { dataService } from '../../services/DataService';

const API_BASE = process.env.REACT_APP_API_URL || process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

const Dashboard = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [insights, setInsights] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [lastFetchTime, setLastFetchTime] = useState(null);
  const [creatingSampleData, setCreatingSampleData] = useState(false);

  const fetchDashboardData = useCallback(async (forceRefresh = false) => {
    if (!user) return;
    
    // Don't refetch if data was fetched recently (within 30 seconds) unless forced
    const now = Date.now();
    if (!forceRefresh && lastFetchTime && (now - lastFetchTime) < 30000) {
      return;
    }
    
    try {
      setLoading(true);
      setError(null);

      // Set a timeout for the entire operation
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 8000)
      );

      const fetchData = async () => {
        // Use the new data service for better abstraction and future Plaid integration
        const [accounts, transactions, goals] = await Promise.allSettled([
          dataService.getAccounts(user.id),
          dataService.getTransactions(user.id, { limit: 10 }),
          dataService.getGoals(user.id)
        ]);

        return {
          accounts: accounts.status === 'fulfilled' ? accounts.value : [],
          transactions: transactions.status === 'fulfilled' ? transactions.value : [],
          goals: goals.status === 'fulfilled' ? goals.value : []
        };
      };

      const { accounts, transactions, goals } = await Promise.race([fetchData(), timeoutPromise]);

      // Calculate summary
      const totalBalance = accounts?.reduce((sum, account) => sum + parseFloat(account.balance || 0), 0) || 0;
      const totalSpent = transactions?.reduce((sum, txn) => sum + parseFloat(txn.amount || 0), 0) || 0;

      // Category spending
      const categorySpending = {};
      transactions?.forEach(txn => {
        const category = txn.ai_category || txn.category || 'other';
        categorySpending[category] = (categorySpending[category] || 0) + parseFloat(txn.amount || 0);
      });

      setDashboardData({
        accounts: accounts || [],
        transactions: transactions || [],
        goals: goals || [],
        summary: {
          total_balance: totalBalance,
          total_spent: totalSpent,
          net_cashflow: totalBalance - totalSpent,
          transaction_count: transactions?.length || 0
        },
        category_spending: categorySpending
      });

      // Fetch AI insights and goal forecast (non-blocking)
      Promise.all([
        fetch(`${API_BASE}/api/users/${user.id}/insights`, { 
          signal: AbortSignal.timeout(5000) 
        }).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`${API_BASE}/api/users/${user.id}/goal-forecast`, { 
          signal: AbortSignal.timeout(5000) 
        }).then(r => r.ok ? r.json() : null).catch(() => null)
      ]).then(([insightsRes, forecastRes]) => {
        if (insightsRes) setInsights(insightsRes);
        if (forecastRes) setForecast(forecastRes);
      }).catch(() => {
        // Non-fatal - AI features will show fallback data
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      
      // If it's a timeout or network error, show fallback data
      if (error.message === 'Request timeout' || error.name === 'NetworkError') {
        setDashboardData({
          accounts: [],
          transactions: [],
          goals: [],
          summary: {
            total_balance: 0,
            total_spent: 0,
            net_cashflow: 0,
            transaction_count: 0
          },
          category_spending: {}
        });
        setError('Connection timeout - showing cached data');
      } else {
      setError(error.message);
      }
    } finally {
      setLoading(false);
      setLastFetchTime(Date.now());
    }
  }, [user, lastFetchTime]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Prevent unnecessary re-fetches when switching browser tabs
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user) {
        // Only refetch if it's been more than 5 minutes since last fetch
        const now = Date.now();
        if (!lastFetchTime || (now - lastFetchTime) > 300000) {
          fetchDashboardData(true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user, lastFetchTime, fetchDashboardData]);

  const createSampleData = async () => {
    if (!user) return;
    
    setCreatingSampleData(true);
    try {
      const response = await fetch(`${API_BASE}/api/users/${user.id}/sample-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        // Refresh dashboard data after creating sample data
        await fetchDashboardData(true);
      } else {
        throw new Error('Failed to create sample data');
      }
    } catch (error) {
      console.error('Error creating sample data:', error);
      setError('Failed to create sample data. Please try again.');
    } finally {
      setCreatingSampleData(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const getCategoryIcon = (category) => {
    const icons = {
      food: '🍽️',
      transportation: '🚗',
      entertainment: '🎬',
      utilities: '⚡',
      shopping: '🛍️',
      healthcare: '🏥',
      housing: '🏠',
      home: '🏡',
      other: '📋'
    };
    return icons[category] || icons.other;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-8"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-blue-300 rounded-full animate-ping mx-auto"></div>
          </div>
          <h2 className="text-xl font-medium text-gray-900 mb-2">Loading your dashboard</h2>
          <p className="text-gray-500">Analyzing your financial data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Something went wrong</h2>
          <p className="text-gray-600 mb-8">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 hover:shadow-lg hover:scale-105"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  Financial Coach
                </h1>
                <p className="text-sm text-gray-500 font-medium">AI-powered insights</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-gray-500 font-medium">Welcome back</p>
                <p className="text-base font-semibold text-gray-900">{profile?.display_name || profile?.first_name || 'User'}</p>
              </div>
              <button
                onClick={() => fetchDashboardData(true)}
                className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-xl flex items-center justify-center text-gray-600 hover:text-gray-800 transition-all duration-200"
                title="Refresh data"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <div className="relative">
                <button
                  onClick={() => navigate('/profile')}
                  className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-200"
                  title="Profile"
                >
                  {(profile?.display_name || profile?.first_name || 'U').charAt(0).toUpperCase()}
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <div className="bg-white/60 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <nav className="flex space-x-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-6 py-4 font-medium text-sm transition-all duration-200 border-b-2 ${
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50/50'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('goals')}
              className={`px-6 py-4 font-medium text-sm transition-all duration-200 border-b-2 ${
                activeTab === 'goals'
                  ? 'border-blue-500 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50/50'
              }`}
            >
              Goals
            </button>
            <button
              onClick={() => setActiveTab('insights')}
              className={`px-6 py-4 font-medium text-sm transition-all duration-200 border-b-2 ${
                activeTab === 'insights'
                  ? 'border-blue-500 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50/50'
              }`}
            >
              Insights
            </button>
            <button
              onClick={() => setActiveTab('forecast')}
              className={`px-6 py-4 font-medium text-sm transition-all duration-200 border-b-2 ${
                activeTab === 'forecast'
                  ? 'border-blue-500 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50/50'
              }`}
            >
              Forecast
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        {activeTab === 'overview' && dashboardData && (
          <div className="space-y-8">
            {/* Show sample data creation for new users */}
            {dashboardData.accounts.length === 0 && dashboardData.transactions.length === 0 && (
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-3xl border border-blue-100 p-8">
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Welcome to Smart Financial Coach!</h3>
                  <p className="text-gray-600 mb-6">Get started by creating sample data to explore all the AI-powered features and insights.</p>
                  <button
                    onClick={createSampleData}
                    disabled={creatingSampleData}
                    className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-8 py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {creatingSampleData ? (
                      <div className="flex items-center">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Creating Sample Data...
                      </div>
                    ) : (
                      'Create Sample Data'
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Total Balance */}
              <div className="group relative overflow-hidden bg-white rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl hover:shadow-gray-200/50 transition-all duration-300 hover:-translate-y-1">
                <div className="p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-400 to-blue-500 rounded-2xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Total Balance</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {formatCurrency(dashboardData.summary.total_balance)}
                  </p>
                  <p className="text-sm text-gray-500 mt-2">Across all accounts</p>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 to-blue-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
              </div>

              {/* Total Spent */}
              <div className="group relative overflow-hidden bg-white rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl hover:shadow-gray-200/50 transition-all duration-300 hover:-translate-y-1">
                <div className="p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-12 h-12 bg-gradient-to-r from-red-400 to-red-500 rounded-2xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Recent Spending</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {formatCurrency(dashboardData.summary.total_spent)}
                  </p>
                  <p className="text-sm text-gray-500 mt-2">Last 10 transactions</p>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-red-400 to-red-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
              </div>

              {/* Accounts */}
              <div className="group relative overflow-hidden bg-white rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl hover:shadow-gray-200/50 transition-all duration-300 hover:-translate-y-1">
                <div className="p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-12 h-12 bg-gradient-to-r from-green-400 to-green-500 rounded-2xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Connected Accounts</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {dashboardData.accounts.length}
                  </p>
                  <p className="text-sm text-gray-500 mt-2">Active accounts</p>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-green-400 to-green-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              {/* Accounts List */}
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-bold text-gray-900">Your Accounts</h3>
                  <div className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center">
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                </div>
                <div className="space-y-4">
                  {dashboardData.accounts.map(account => (
                    <div key={account.id} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
                      <div className="flex items-center">
                        <div className="w-12 h-12 bg-gradient-to-r from-blue-100 to-purple-100 rounded-xl flex items-center justify-center mr-4">
                          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">{account.account_name}</h4>
                          <p className="text-sm text-gray-500 capitalize">{account.account_type}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">{formatCurrency(account.balance)}</p>
                        <p className="text-xs text-gray-500">*{account.account_number?.slice(-4)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Transactions */}
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-bold text-gray-900">Recent Activity</h3>
                  <div className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center">
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="space-y-4">
                  {dashboardData.transactions.map(transaction => (
                    <div key={transaction.id} className="flex items-start justify-between p-4 hover:bg-gray-50 rounded-xl transition-colors">
                      <div className="flex items-start">
                        <div className="w-10 h-10 bg-gradient-to-r from-gray-100 to-gray-200 rounded-xl flex items-center justify-center text-lg mr-4 mt-1">
                          {getCategoryIcon(transaction.ai_category || transaction.category)}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{transaction.description}</p>
                          <p className="text-sm text-gray-500">{formatDate(transaction.created_at)}</p>
                          {transaction.ai_insights?.insight && (
                            <p className="text-sm text-blue-700 mt-1">💡 {transaction.ai_insights.insight}</p>
                          )}
                          {transaction.ai_insights?.tip && transaction.ai_insights.tip.trim() !== '' && (
                            <p className="text-xs text-gray-600 mt-1">Tip: {transaction.ai_insights.tip}</p>
                          )}
                        </div>
                      </div>
                      <p className="font-bold text-red-600">
                        -{formatCurrency(transaction.amount)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Insights Summary */}
            {insights && insights.insights && insights.insights.length > 0 && (
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-900">Quick Insights</h3>
                  <button 
                    onClick={() => setActiveTab('insights')}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    View All →
                  </button>
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                  {insights.insights.slice(0, 3).map((i) => (
                    <div key={i.category} className="border border-gray-100 rounded-2xl p-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold capitalize text-sm">{i.category}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          i.trend === 'increasing' ? 'bg-red-100 text-red-700' : 
                          i.trend === 'decreasing' ? 'bg-green-100 text-green-700' : 
                          'bg-gray-100 text-gray-700'
                        }`}>{i.trend}</span>
                      </div>
                      <p className="text-sm text-gray-600">{formatCurrency(i.total_amount)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Goals Summary */}
            {forecast && forecast.forecasts && forecast.forecasts.length > 0 && (
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-900">Goals Progress</h3>
                  <button 
                    onClick={() => setActiveTab('forecast')}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    View Details →
                  </button>
                </div>
                <div className="space-y-4">
                  {forecast.forecasts.slice(0, 2).map((f) => (
                    <div key={f.goal_id} className="border border-gray-100 rounded-2xl p-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold">{f.title}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          f.status === 'on_track' ? 'bg-green-100 text-green-800' : 
                          f.status === 'moderate_track' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>{f.status.replace('_',' ')}</span>
                      </div>
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Progress: {formatCurrency(f.current_amount || 0)} / {formatCurrency(f.target_amount || 0)}</span>
                        <span>{f.months_needed ? `${f.months_needed.toFixed(1)} months` : '—'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'goals' && dashboardData && (
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">🎯 Your Financial Goals</h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Track your progress and stay motivated to achieve your financial dreams
              </p>
            </div>

            {dashboardData.goals.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {dashboardData.goals.map(goal => {
                  const progress = (parseFloat(goal.current_amount) / parseFloat(goal.target_amount)) * 100;
                  const remaining = parseFloat(goal.target_amount) - parseFloat(goal.current_amount);
                  
                  return (
                    <div key={goal.id} className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 hover:shadow-xl transition-all duration-300">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold text-gray-900">{goal.goal_name}</h3>
                        <div className="text-2xl">
                          {goal.goal_type === 'emergency_fund' && '🛡️'}
                          {goal.goal_type === 'vacation' && '🏖️'}
                          {goal.goal_type === 'house' && '🏠'}
                          {goal.goal_type === 'retirement' && '🌅'}
                          {goal.goal_type === 'education' && '🎓'}
                          {goal.goal_type === 'debt_payoff' && '💳'}
                          {!['emergency_fund', 'vacation', 'house', 'retirement', 'education', 'debt_payoff'].includes(goal.goal_type) && '🎯'}
                        </div>
                      </div>
                      
                      <div className="mb-6">
                        <div className="flex justify-between text-sm text-gray-600 mb-2">
                          <span>{formatCurrency(goal.current_amount)}</span>
                          <span>{formatCurrency(goal.target_amount)}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div
                            className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-sm mt-2">
                          <span className="text-blue-600 font-semibold">{progress.toFixed(1)}% complete</span>
                          <span className="text-gray-600">{formatCurrency(remaining)} remaining</span>
                        </div>
                      </div>
                      
                      {goal.target_date && (
                        <p className="text-sm text-gray-500">
                          Target date: {new Date(goal.target_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">No Goals Set Yet</h3>
                <p className="text-gray-600 mb-8">Set your first financial goal to start tracking your progress</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'insights' && (
          <div className="space-y-8">
            {insights ? (
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-900">Intelligent Spending Insights</h3>
                  {insights.anomalies_present && (
                    <span className="text-sm px-3 py-1 rounded-full bg-yellow-100 text-yellow-800">Potential anomalies detected</span>
                  )}
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  {insights.insights.map((i) => (
                    <div key={i.category} className="border border-gray-100 rounded-2xl p-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold capitalize">{i.category}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">{i.trend}</span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">Spent: {formatCurrency(i.total_amount)} across {i.transaction_count} txns</p>
                      <p className="text-sm text-blue-700">{i.ai_recommendation}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-600">Loading insights or none available.</p>
            )}
          </div>
        )}

        {activeTab === 'forecast' && (
          <div className="space-y-8">
            {forecast ? (
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-900">Goal Forecast & Analysis</h3>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Monthly savings estimate</p>
                    <p className="text-lg font-semibold text-gray-900">{formatCurrency(forecast.monthly_savings_estimate || 0)}</p>
                  </div>
                </div>
                
                {forecast.forecasts && forecast.forecasts.length > 0 ? (
                  <div className="space-y-6">
                    {forecast.forecasts.map((f) => (
                      <div key={f.goal_id} className="border border-gray-100 rounded-2xl p-6 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h4 className="text-lg font-semibold text-gray-900">{f.title}</h4>
                            <p className="text-sm text-gray-600">Target: {formatCurrency(f.target_amount || 0)}</p>
                          </div>
                          <span className={`text-sm px-3 py-1 rounded-full font-medium ${
                            f.status === 'on_track' ? 'bg-green-100 text-green-800' : 
                            f.status === 'moderate_track' ? 'bg-yellow-100 text-yellow-800' :
                            f.status === 'no_savings' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {f.status.replace('_', ' ')}
                          </span>
                        </div>
                        
                        <div className="grid md:grid-cols-3 gap-4 mb-4">
                          <div className="text-center">
                            <p className="text-2xl font-bold text-blue-600">{formatCurrency(f.current_amount || 0)}</p>
                            <p className="text-sm text-gray-600">Current</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-gray-900">{formatCurrency(f.remaining || 0)}</p>
                            <p className="text-sm text-gray-600">Remaining</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-purple-600">
                              {f.months_needed ? `${f.months_needed.toFixed(1)}` : '—'}
                            </p>
                            <p className="text-sm text-gray-600">Months</p>
                          </div>
                        </div>
                        
                        <div className="bg-blue-50 rounded-xl p-4">
                          <h5 className="font-semibold text-blue-900 mb-2">AI Guidance</h5>
                          <p className="text-sm text-blue-800 whitespace-pre-line">{f.ai_guidance}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">No Financial Goals Set</h4>
                    <p className="text-gray-600 mb-6">Set your first financial goal to get personalized forecasts and AI guidance.</p>
                    <button 
                      onClick={() => setActiveTab('goals')}
                      className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-200"
                    >
                      Create Your First Goal
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
                <div className="text-center py-12">
                  <div className="w-16 h-16 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">Analyzing Your Goals</h4>
                  <p className="text-gray-600">Generating personalized forecasts and recommendations...</p>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white/80 backdrop-blur-xl border-t border-gray-100 mt-16">
        <div className="max-w-7xl mx-auto py-8 px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <p className="text-sm font-medium text-gray-600">Powered by Supabase + AI</p>
            </div>
            <p className="text-xs text-gray-500">
              Your financial data is encrypted and secure • Smart Financial Coach v2.0
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;