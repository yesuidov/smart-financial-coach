import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

const GOAL_TEMPLATES = [
  {
    id: 'emergency_fund',
    icon: '🛡️',
    title: 'Emergency Fund',
    description: 'Build a safety net for unexpected expenses',
    suggestedAmount: 5000,
    category: 'Security'
  },
  {
    id: 'vacation',
    icon: '🏖️',
    title: 'Dream Vacation',
    description: 'Save for that perfect getaway',
    suggestedAmount: 3000,
    category: 'Lifestyle'
  },
  {
    id: 'house',
    icon: '🏠',
    title: 'House Down Payment',
    description: 'Save for your first home or next property',
    suggestedAmount: 20000,
    category: 'Investment'
  },
  {
    id: 'retirement',
    icon: '🌅',
    title: 'Retirement Savings',
    description: 'Secure your financial future',
    suggestedAmount: 10000,
    category: 'Long-term'
  },
  {
    id: 'education',
    icon: '🎓',
    title: 'Education Fund',
    description: 'Invest in learning and development',
    suggestedAmount: 7500,
    category: 'Growth'
  },
  {
    id: 'debt_payoff',
    icon: '💳',
    title: 'Pay Off Debt',
    description: 'Become debt-free faster',
    suggestedAmount: 5000,
    category: 'Freedom'
  }
];

const FinancialGoals = ({ onNext, onBack }) => {
  const { user, updateProfile } = useAuth();
  const [selectedGoals, setSelectedGoals] = useState([]);
  const [customGoals, setCustomGoals] = useState([]);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [loading, setLoading] = useState(false);

  // Custom goal form state
  const [customTitle, setCustomTitle] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [customTimeframe, setCustomTimeframe] = useState('12');

  const handleGoalToggle = (goalTemplate) => {
    setSelectedGoals(prev => {
      const exists = prev.find(g => g.id === goalTemplate.id);
      if (exists) {
        return prev.filter(g => g.id !== goalTemplate.id);
      } else {
        return [...prev, {
          ...goalTemplate,
          target_amount: goalTemplate.suggestedAmount,
          timeframe: 12, // months
          current_amount: 0
        }];
      }
    });
  };

  const handleCustomGoalAdd = () => {
    if (customTitle && customAmount) {
      const customGoal = {
        id: `custom_${Date.now()}`,
        icon: '🎯',
        title: customTitle,
        description: 'Custom financial goal',
        target_amount: parseFloat(customAmount),
        timeframe: parseInt(customTimeframe),
        current_amount: 0,
        category: 'Custom'
      };
      setCustomGoals(prev => [...prev, customGoal]);
      setCustomTitle('');
      setCustomAmount('');
      setCustomTimeframe('12');
      setShowCustomForm(false);
    }
  };

  const handleContinue = async () => {
    setLoading(true);
    try {
      const allGoals = [...selectedGoals, ...customGoals];
      
      // Save goals to database
      if (allGoals.length > 0) {
        const goalsToInsert = allGoals.map(goal => ({
          user_id: user.id,
          goal_name: goal.title,
          goal_type: goal.id,
          target_amount: goal.target_amount,
          current_amount: 0,
          target_date: new Date(Date.now() + (goal.timeframe || 12) * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        }));

        const { error } = await supabase
          .from('financial_goals')
          .insert(goalsToInsert);

        if (error) {
          console.error('Error saving goals:', error);
        }
      }

      onNext('goals');
    } catch (error) {
      console.error('Error saving goals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    setLoading(true);
    try {
      onNext('goals');
    } catch (error) {
      console.error('Error skipping goals:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalGoals = selectedGoals.length + customGoals.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <button
            onClick={onBack}
            className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back
          </button>

          <div className="w-20 h-20 bg-gradient-to-r from-green-500 to-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
          </div>

          <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
            Set Your Financial Goals
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Choose goals that matter to you. Our AI will create personalized plans to help you achieve them.
          </p>
        </div>

        {/* Goal Templates Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {GOAL_TEMPLATES.map((goal) => {
            const isSelected = selectedGoals.find(g => g.id === goal.id);
            return (
              <div
                key={goal.id}
                onClick={() => handleGoalToggle(goal)}
                className={`relative cursor-pointer bg-white rounded-3xl p-6 border-2 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
                  isSelected 
                    ? 'border-blue-500 shadow-lg shadow-blue-500/20' 
                    : 'border-gray-100 hover:border-blue-200'
                }`}
              >
                {isSelected && (
                  <div className="absolute top-4 right-4 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}

                <div className="text-4xl mb-4">{goal.icon}</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{goal.title}</h3>
                <p className="text-gray-600 mb-4">{goal.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                    {goal.category}
                  </span>
                  <span className="text-lg font-bold text-gray-900">
                    ${goal.suggestedAmount.toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Custom Goals Section */}
        <div className="bg-white rounded-3xl shadow-lg p-8 border border-gray-100 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Custom Goals</h3>
              <p className="text-gray-600">Have something specific in mind? Create your own goal.</p>
            </div>
            <button
              onClick={() => setShowCustomForm(true)}
              className="bg-gradient-to-r from-purple-500 to-blue-600 text-white px-6 py-3 rounded-2xl font-semibold hover:shadow-lg transition-all duration-200"
            >
              + Add Custom Goal
            </button>
          </div>

          {/* Custom Goals List */}
          {customGoals.length > 0 && (
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              {customGoals.map((goal) => (
                <div key={goal.id} className="bg-purple-50 rounded-2xl p-4 border border-purple-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-gray-900">{goal.title}</h4>
                      <p className="text-sm text-gray-600">{goal.timeframe} months</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">${goal.target_amount.toLocaleString()}</p>
                      <button
                        onClick={() => setCustomGoals(prev => prev.filter(g => g.id !== goal.id))}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Custom Goal Form */}
          {showCustomForm && (
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
              <h4 className="text-lg font-bold text-gray-900 mb-4">Create Custom Goal</h4>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Goal Name</label>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="e.g., New Car"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Target Amount</label>
                  <input
                    type="number"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder="5000"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Timeframe</label>
                  <select
                    value={customTimeframe}
                    onChange={(e) => setCustomTimeframe(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="6">6 months</option>
                    <option value="12">1 year</option>
                    <option value="24">2 years</option>
                    <option value="36">3 years</option>
                    <option value="60">5 years</option>
                  </select>
                </div>
              </div>
              <div className="flex space-x-4 mt-4">
                <button
                  onClick={handleCustomGoalAdd}
                  className="bg-blue-500 text-white px-6 py-2 rounded-xl font-medium hover:bg-blue-600 transition-colors"
                >
                  Add Goal
                </button>
                <button
                  onClick={() => setShowCustomForm(false)}
                  className="bg-gray-200 text-gray-700 px-6 py-2 rounded-xl font-medium hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Continue/Skip Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={handleSkip}
            disabled={loading}
            className="px-8 py-4 bg-gray-200 text-gray-700 rounded-2xl font-semibold hover:bg-gray-300 transition-all duration-200 disabled:opacity-50"
          >
            Skip for Now
          </button>
          <button
            onClick={handleContinue}
            disabled={loading}
            className="px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-2xl font-semibold hover:shadow-lg hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {loading ? (
              <div className="flex items-center">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Saving Goals...
              </div>
            ) : (
              totalGoals > 0 ? `Continue with ${totalGoals} Goal${totalGoals !== 1 ? 's' : ''}` : 'Continue'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FinancialGoals;