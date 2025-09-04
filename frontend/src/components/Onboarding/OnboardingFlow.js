import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Welcome from './Welcome';
import AuthForm from './AuthForm';
import FinancialGoals from './FinancialGoals';
import ConnectBank from './ConnectBank';

const OnboardingFlow = () => {
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();
  const [currentStep, setCurrentStep] = useState('welcome');
  const [onboardingData, setOnboardingData] = useState({});
  // Remove timeout fallbacks for professional behavior

  useEffect(() => {
    if (!loading) {
      if (user && profile?.onboarding_completed) {
        navigate('/dashboard');
      } else if (user && profile) {
        // User is logged in but hasn't completed onboarding
        setCurrentStep('goals');
      }
    }
  }, [user, profile, loading, navigate]);

  const handleStepComplete = (step, data = {}) => {
    console.log('Step completed:', step, 'Data:', data);
    setOnboardingData(prev => ({ ...prev, ...data }));
    
    switch (step) {
      case 'welcome':
        console.log('Moving from welcome to auth');
        setCurrentStep('auth');
        break;
      case 'signup':
      case 'login':
        console.log('Moving from auth to goals');
        setCurrentStep('goals');
        break;
      case 'goals':
        console.log('Moving from goals to connectBank');
        setCurrentStep('connectBank');
        break;
      case 'connectBank':
      case 'demo':
        console.log('Moving to dashboard');
        navigate('/dashboard');
        break;
      default:
        console.log('Unknown step:', step);
        break;
    }
  };

  const handleBack = () => {
    switch (currentStep) {
      case 'auth':
        setCurrentStep('welcome');
        break;
      case 'goals':
        setCurrentStep('auth');
        break;
      case 'connectBank':
        setCurrentStep('goals');
        break;
      default:
        break;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-8"></div>
          </div>
          <h2 className="text-xl font-medium text-gray-900 mb-2">Loading...</h2>
          <p className="text-gray-500">Preparing your experience...</p>
        </div>
      </div>
    );
  }

  const renderStep = () => {
    console.log('Rendering step:', currentStep);
    switch (currentStep) {
      case 'welcome':
        return <Welcome onNext={handleStepComplete} />;
      case 'auth':
        console.log('Rendering AuthForm with mode:', onboardingData.mode);
        return <AuthForm mode={onboardingData.mode || 'signup'} onNext={handleStepComplete} onBack={handleBack} />;
      case 'goals':
        return <FinancialGoals onNext={handleStepComplete} onBack={handleBack} />;
      case 'connectBank':
        return <ConnectBank onNext={handleStepComplete} onBack={handleBack} />;
      default:
        console.log('Defaulting to welcome for step:', currentStep);
        return <Welcome onNext={handleStepComplete} />;
    }
  };

  return (
    <div className="min-h-screen">
      {renderStep()}
    </div>
  );
};

export default OnboardingFlow;