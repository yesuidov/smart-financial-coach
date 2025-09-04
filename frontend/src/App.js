import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import AuthErrorBoundary from './components/AuthErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import OnboardingFlow from './components/Onboarding/OnboardingFlow';
import Dashboard from './components/Dashboard/Dashboard';
import Profile from './components/Profile/Profile';
import './App.css';

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <AuthErrorBoundary>
          <Router>
            <Routes>
              {/* Public Routes */}
              <Route path="/onboarding" element={<OnboardingFlow />} />
              
              {/* Protected Routes */}
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } />
              <Route path="/profile" element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } />
              
              {/* Default redirect */}
              <Route path="/" element={<Navigate to="/onboarding" replace />} />
              <Route path="*" element={<Navigate to="/onboarding" replace />} />
            </Routes>
          </Router>
        </AuthErrorBoundary>
      </AuthProvider>
    </div>
  );
}

export default App;