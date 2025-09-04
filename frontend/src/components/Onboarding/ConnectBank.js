import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const POPULAR_BANKS = [
  {
    id: 'chase',
    name: 'Chase Bank',
    logo: '🏦',
    type: 'Major Bank',
    accounts: ['Checking', 'Savings', 'Credit Card']
  },
  {
    id: 'bofa',
    name: 'Bank of America',
    logo: '🏛️',
    type: 'Major Bank',
    accounts: ['Checking', 'Savings', 'Investment']
  },
  {
    id: 'wells_fargo',
    name: 'Wells Fargo',
    logo: '🏪',
    type: 'Major Bank',
    accounts: ['Checking', 'Savings', 'Mortgage']
  },
  {
    id: 'citi',
    name: 'Citibank',
    logo: '🏢',
    type: 'Major Bank',
    accounts: ['Checking', 'Credit Card', 'Investment']
  },
  {
    id: 'capital_one',
    name: 'Capital One',
    logo: '💳',
    type: 'Digital Bank',
    accounts: ['360 Checking', 'Savings', 'Credit Card']
  },
  {
    id: 'ally',
    name: 'Ally Bank',
    logo: '💰',
    type: 'Online Bank',
    accounts: ['Online Savings', 'Checking', 'Investment']
  }
];

const ConnectBank = ({ onNext, onBack }) => {
  const { updateProfile, createSampleData } = useAuth();
  const [selectedBank, setSelectedBank] = useState(null);
  const [selectedAccounts, setSelectedAccounts] = useState([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStep, setConnectionStep] = useState('select'); // select, login, accounts, success
  const [credentials, setCredentials] = useState({ username: '', password: '' });

  const handleBankSelect = (bank) => {
    setSelectedBank(bank);
    setConnectionStep('login');
  };

  const handleLogin = (e) => {
    e.preventDefault();
    setIsConnecting(true);
    
    // Simulate connection process
    setTimeout(() => {
      setConnectionStep('accounts');
      setIsConnecting(false);
    }, 2000);
  };

  const handleAccountToggle = (account) => {
    setSelectedAccounts(prev => {
      if (prev.includes(account)) {
        return prev.filter(a => a !== account);
      } else {
        return [...prev, account];
      }
    });
  };

  const handleFinishConnection = async () => {
    setIsConnecting(true);
    
    try {
      // Update profile to mark onboarding as completed
      await updateProfile({
        onboarding_completed: true
      });

      // Create sample financial data
      await createSampleData();

      setConnectionStep('success');
      setIsConnecting(false);
      
      // Auto-redirect to dashboard after success
      setTimeout(() => {
        onNext('connectBank');
      }, 2000);
    } catch (error) {
      console.error('Error completing onboarding:', error);
      setIsConnecting(false);
    }
  };

  const handleSkip = async () => {
    try {
      // Update profile to mark onboarding as completed
      await updateProfile({
        onboarding_completed: true
      });

      // Create sample data even when skipping bank connection
      await createSampleData();

      onNext('connectBank');
    } catch (error) {
      console.error('Error skipping bank connection:', error);
    }
  };

  if (connectionStep === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 bg-gradient-to-r from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl animate-pulse">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">🎉 All Set!</h2>
          <p className="text-lg text-gray-600 mb-6">
            Successfully connected to {selectedBank?.name}. Your financial journey starts now!
          </p>
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center justify-center text-sm text-gray-600">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></div>
              Redirecting to your dashboard...
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          {connectionStep === 'select' && (
            <button
              onClick={onBack}
              className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back
            </button>
          )}

          <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-green-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>

          <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-blue-600 to-green-600 bg-clip-text text-transparent mb-4">
            Connect Your Bank
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            {connectionStep === 'select' && "Securely connect your bank account to get personalized insights"}
            {connectionStep === 'login' && `Sign in to your ${selectedBank?.name} account`}
            {connectionStep === 'accounts' && "Choose which accounts to connect"}
          </p>
        </div>

        {/* Bank Selection */}
        {connectionStep === 'select' && (
          <>
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-8">
              <div className="flex items-center mb-4">
                <svg className="w-8 h-8 text-blue-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <h3 className="text-xl font-bold text-blue-900">Bank-Level Security</h3>
              </div>
              <ul className="text-blue-800 space-y-2">
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  256-bit SSL encryption (same as your bank uses)
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  We never store your login credentials
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Read-only access to transaction data
                </li>
              </ul>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {POPULAR_BANKS.map((bank) => (
                <div
                  key={bank.id}
                  onClick={() => handleBankSelect(bank)}
                  className="bg-white rounded-3xl p-6 border border-gray-100 hover:border-blue-300 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group"
                >
                  <div className="text-4xl mb-4">{bank.logo}</div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{bank.name}</h3>
                  <p className="text-sm text-blue-600 font-medium mb-3">{bank.type}</p>
                  <div className="space-y-1">
                    {bank.accounts.map((account, index) => (
                      <div key={index} className="text-sm text-gray-600 flex items-center">
                        <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                        {account}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center text-blue-600 group-hover:text-blue-700">
                    <span className="text-sm font-medium">Connect</span>
                    <svg className="w-4 h-4 ml-2 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center">
              <button
                onClick={handleSkip}
                className="px-8 py-4 bg-gray-200 text-gray-700 rounded-2xl font-semibold hover:bg-gray-300 transition-all duration-200"
              >
                Skip for Now
              </button>
            </div>
          </>
        )}

        {/* Bank Login Simulation */}
        {connectionStep === 'login' && (
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
              <div className="text-center mb-6">
                <div className="text-4xl mb-4">{selectedBank?.logo}</div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{selectedBank?.name}</h3>
                <p className="text-gray-600">Sign in with your online banking credentials</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-6">
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">Username</label>
                  <input
                    type="text"
                    value={credentials.username}
                    onChange={(e) => setCredentials({...credentials, username: e.target.value})}
                    required
                    className="w-full px-4 py-3 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                    placeholder="Enter your username"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-2">Password</label>
                  <input
                    type="password"
                    value={credentials.password}
                    onChange={(e) => setCredentials({...credentials, password: e.target.value})}
                    required
                    className="w-full px-4 py-3 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                    placeholder="Enter your password"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isConnecting}
                  className="w-full bg-gradient-to-r from-blue-500 to-green-500 text-white px-8 py-4 rounded-2xl font-semibold text-lg hover:shadow-lg hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {isConnecting ? (
                    <div className="flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Connecting Securely...
                    </div>
                  ) : (
                    'Connect Account'
                  )}
                </button>
              </form>

              <div className="mt-6 text-center">
                <button
                  onClick={() => setConnectionStep('select')}
                  className="text-gray-600 hover:text-gray-900 font-medium"
                >
                  ← Choose Different Bank
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Account Selection */}
        {connectionStep === 'accounts' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Select Accounts</h3>
                <p className="text-gray-600">Choose which accounts you'd like to connect for insights</p>
              </div>

              <div className="space-y-4 mb-8">
                {selectedBank?.accounts.map((account, index) => {
                  const isSelected = selectedAccounts.includes(account);
                  return (
                    <div
                      key={index}
                      onClick={() => handleAccountToggle(account)}
                      className={`p-6 rounded-2xl border-2 cursor-pointer transition-all duration-200 ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className={`w-6 h-6 rounded-full border-2 mr-4 flex items-center justify-center ${
                            isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                          }`}>
                            {isSelected && (
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <div>
                            <h4 className="font-bold text-gray-900">{account}</h4>
                            <p className="text-sm text-gray-600">Track spending and income</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900">
                            ****{Math.floor(Math.random() * 9000) + 1000}
                          </p>
                          <p className="text-xs text-gray-500">
                            ${(Math.random() * 10000).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={handleFinishConnection}
                disabled={isConnecting || selectedAccounts.length === 0}
                className="w-full bg-gradient-to-r from-blue-500 to-green-500 text-white px-8 py-4 rounded-2xl font-semibold text-lg hover:shadow-lg hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isConnecting ? (
                  <div className="flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Finalizing Connection...
                  </div>
                ) : (
                  `Connect ${selectedAccounts.length} Account${selectedAccounts.length !== 1 ? 's' : ''}`
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConnectBank;