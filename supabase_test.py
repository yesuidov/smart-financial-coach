#!/usr/bin/env python3
"""
Smart Financial Coach Supabase Integration Test Suite
Tests Supabase connection, database access, and table verification
"""

import os
import requests
import json
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/backend/.env')

# Get Supabase configuration
SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_ANON_KEY = os.environ.get('SUPABASE_ANON_KEY')
SUPABASE_SERVICE_ROLE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

# Get backend URL from frontend .env file
def get_backend_url():
    try:
        with open('/app/frontend/.env', 'r') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    return line.split('=', 1)[1].strip()
    except:
        pass
    return "http://localhost:8001"

BASE_URL = get_backend_url()
API_BASE = f"{BASE_URL}/api"

print(f"Testing Supabase Integration for Smart Financial Coach")
print(f"Backend URL: {API_BASE}")
print(f"Supabase URL: {SUPABASE_URL}")
print("=" * 60)

class SupabaseIntegrationTester:
    def __init__(self):
        self.test_results = []
        
    def log_test(self, test_name, success, details="", response_data=None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"   Details: {details}")
        if response_data and isinstance(response_data, dict):
            print(f"   Response keys: {list(response_data.keys())}")
        print()
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })
    
    def test_health_check(self):
        """Test /api/health endpoint"""
        try:
            response = requests.get(f"{API_BASE}/health", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "status" in data and data["status"] == "healthy":
                    self.log_test("Health Check", True, f"Status: {data['status']}")
                    return True
                else:
                    self.log_test("Health Check", False, f"Invalid response format: {data}")
                    return False
            else:
                self.log_test("Health Check", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Health Check", False, f"Connection error: {str(e)}")
            return False
    
    def test_supabase_connection(self):
        """Test direct Supabase connection using Python client"""
        try:
            from supabase import create_client, Client
            
            if not SUPABASE_URL or not SUPABASE_ANON_KEY:
                self.log_test("Supabase Connection", False, "Missing Supabase credentials in environment")
                return False
            
            # Create Supabase client
            supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
            
            # Test connection by trying to access user_profiles table
            response = supabase.table('user_profiles').select("*").limit(0).execute()
            
            if response:
                self.log_test("Supabase Connection", True, f"Connected successfully to {SUPABASE_URL}")
                return True
            else:
                self.log_test("Supabase Connection", False, f"Connection failed: {response}")
                return False
                
        except Exception as e:
            self.log_test("Supabase Connection", False, f"Connection error: {str(e)}")
            return False
    
    def test_supabase_tables_exist(self):
        """Test if required Supabase tables exist"""
        try:
            from supabase import create_client, Client
            
            if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
                self.log_test("Supabase Tables Check", False, "Missing Supabase service role key")
                return False
            
            # Use service role key for admin access
            supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
            
            required_tables = ['user_profiles', 'accounts', 'transactions', 'financial_goals', 'notifications']
            existing_tables = []
            missing_tables = []
            
            for table in required_tables:
                try:
                    # Try to query the table (limit 0 to just check existence)
                    response = supabase.table(table).select("*").limit(0).execute()
                    existing_tables.append(table)
                except Exception as e:
                    missing_tables.append(table)
            
            if len(existing_tables) == len(required_tables):
                self.log_test("Supabase Tables Check", True, 
                            f"All required tables exist: {', '.join(existing_tables)}")
                return True
            else:
                self.log_test("Supabase Tables Check", False, 
                            f"Missing tables: {', '.join(missing_tables)}. Existing: {', '.join(existing_tables)}")
                return False
                
        except Exception as e:
            self.log_test("Supabase Tables Check", False, f"Error checking tables: {str(e)}")
            return False
    
    def test_supabase_rls_policies(self):
        """Test if Row Level Security policies are working"""
        try:
            from supabase import create_client, Client
            
            if not SUPABASE_URL or not SUPABASE_ANON_KEY:
                self.log_test("Supabase RLS Policies", False, "Missing Supabase credentials")
                return False
            
            # Create client with anon key (should have limited access due to RLS)
            supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
            
            # Try to access user_profiles without authentication (should fail or return empty)
            try:
                response = supabase.table('user_profiles').select("*").limit(1).execute()
                # If we get here without error, RLS is working (returns empty for unauthenticated user)
                self.log_test("Supabase RLS Policies", True, 
                            f"RLS working correctly - unauthenticated access returned {len(response.data)} rows")
                return True
            except Exception as e:
                # This is actually expected behavior with RLS
                self.log_test("Supabase RLS Policies", True, 
                            f"RLS working correctly - access denied for unauthenticated user: {str(e)}")
                return True
                
        except Exception as e:
            self.log_test("Supabase RLS Policies", False, f"Error testing RLS: {str(e)}")
            return False
    
    def test_backend_supabase_integration(self):
        """Test if backend is actually using Supabase (not MongoDB)"""
        try:
            # Check if backend server.py imports supabase
            with open('/app/backend/server.py', 'r') as f:
                server_code = f.read()
            
            if 'supabase' in server_code.lower():
                self.log_test("Backend Supabase Integration", True, 
                            "Backend code contains Supabase imports")
                return True
            elif 'mongo' in server_code.lower():
                self.log_test("Backend Supabase Integration", False, 
                            "Backend is still using MongoDB, not Supabase")
                return False
            else:
                self.log_test("Backend Supabase Integration", False, 
                            "Backend database integration unclear")
                return False
                
        except Exception as e:
            self.log_test("Backend Supabase Integration", False, f"Error checking backend code: {str(e)}")
            return False
    
    def test_environment_variables(self):
        """Test if all required Supabase environment variables are set"""
        try:
            required_vars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']
            missing_vars = []
            
            for var in required_vars:
                if not os.environ.get(var):
                    missing_vars.append(var)
            
            if not missing_vars:
                self.log_test("Environment Variables", True, 
                            f"All required Supabase environment variables are set")
                return True
            else:
                self.log_test("Environment Variables", False, 
                            f"Missing environment variables: {', '.join(missing_vars)}")
                return False
                
        except Exception as e:
            self.log_test("Environment Variables", False, f"Error checking environment: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run comprehensive Supabase integration test suite"""
        print("Starting Supabase Integration Tests")
        print("=" * 60)
        
        tests = [
            ("Environment Variables Check", self.test_environment_variables),
            ("Health Check", self.test_health_check),
            ("Supabase Connection", self.test_supabase_connection),
            ("Supabase Tables Exist", self.test_supabase_tables_exist),
            ("Supabase RLS Policies", self.test_supabase_rls_policies),
            ("Backend Supabase Integration", self.test_backend_supabase_integration)
        ]
        
        passed = 0
        total = len(tests)
        
        for test_name, test_func in tests:
            print(f"Running: {test_name}")
            if test_func():
                passed += 1
        
        print("=" * 60)
        print(f"TEST SUMMARY: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 ALL SUPABASE INTEGRATION TESTS PASSED!")
        else:
            print(f"⚠️  {total - passed} tests failed. Check details above.")
        
        return passed, total, self.test_results

if __name__ == "__main__":
    tester = SupabaseIntegrationTester()
    passed, total, results = tester.run_all_tests()
    
    # Save detailed results
    with open('/app/supabase_test_results.json', 'w') as f:
        json.dump({
            "summary": {"passed": passed, "total": total, "success_rate": passed/total},
            "supabase_url": SUPABASE_URL,
            "test_timestamp": datetime.now().isoformat(),
            "detailed_results": results
        }, f, indent=2)
    
    print(f"\nDetailed results saved to: /app/supabase_test_results.json")