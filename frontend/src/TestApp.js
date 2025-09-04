import React from 'react';

function TestApp() {
  console.log('TestApp rendering...');
  console.log('REACT_APP_SUPABASE_URL:', process.env.REACT_APP_SUPABASE_URL);
  console.log('REACT_APP_SUPABASE_ANON_KEY:', process.env.REACT_APP_SUPABASE_ANON_KEY);
  
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Test App - Debug Mode</h1>
      <p>Environment Variables:</p>
      <ul>
        <li>REACT_APP_SUPABASE_URL: {process.env.REACT_APP_SUPABASE_URL || 'undefined'}</li>
        <li>REACT_APP_SUPABASE_ANON_KEY: {process.env.REACT_APP_SUPABASE_ANON_KEY ? 'defined' : 'undefined'}</li>
        <li>REACT_APP_BACKEND_URL: {process.env.REACT_APP_BACKEND_URL || 'undefined'}</li>
      </ul>
      <p>If you can see this, React is working!</p>
    </div>
  );
}

export default TestApp;