import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const AuthErrorBoundary = ({ children }) => {
  const { authError, retryAuth, clearAuthError, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-8"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-blue-300 rounded-full animate-ping mx-auto"></div>
          </div>
          <h2 className="text-xl font-medium text-gray-900 mb-2">Verifying your session</h2>
          <p className="text-gray-500">Please wait while we securely authenticate you...</p>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">Authentication Error</h1>
            <p className="text-gray-600 mb-6">{authError.message}</p>
          </div>

          <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
            <div className="space-y-4">
              {authError.retryable && (
                <button
                  onClick={retryAuth}
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white px-8 py-4 rounded-2xl font-semibold text-lg hover:shadow-lg hover:scale-105 transition-all duration-200"
                >
                  Try Again
                </button>
              )}
              
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-gray-100 text-gray-700 px-8 py-4 rounded-2xl font-semibold hover:bg-gray-200 transition-all duration-200"
              >
                Refresh Page
              </button>

              <button
                onClick={clearAuthError}
                className="w-full text-gray-500 hover:text-gray-700 transition-colors"
              >
                Continue Anyway
              </button>
            </div>
          </div>

          <div className="text-center mt-6">
            <p className="text-xs text-gray-500">
              If this problem persists, please contact support. Your data is secure and encrypted.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return children;
};

export default AuthErrorBoundary;
