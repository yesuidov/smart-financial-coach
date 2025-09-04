import React from 'react';
import { useAuth } from '../../contexts/AuthContext';

const Profile = () => {
  const { user, profile, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <header className="bg-white/80 backdrop-blur-xl border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 lg:px-8 py-6">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">Profile</h1>
          <p className="text-sm text-gray-500">Manage your account, security, and connected banks</p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 lg:px-8 py-8 space-y-8">
        <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Account</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-500">Display Name</p>
              <p className="text-gray-900 font-medium">{profile?.display_name || `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="text-gray-900 font-medium">{user?.email || '—'}</p>
            </div>
          </div>
          <div className="mt-6">
            <button
              onClick={signOut}
              className="inline-flex items-center px-5 py-3 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </section>

        <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Security</h2>
          <div className="space-y-3 text-sm text-gray-600">
            <p>• Update email and password coming soon</p>
            <p>• Enable multi-factor authentication coming soon</p>
          </div>
        </section>

        <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Connected Bank Accounts</h2>
          <p className="text-sm text-gray-600">Manage your linked accounts from the Dashboard → Profile → Accounts section. Dedicated management here coming soon.</p>
        </section>
      </main>
    </div>
  );
};

export default Profile;


