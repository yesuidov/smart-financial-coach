#!/usr/bin/env python3
"""
Smart Financial Coach Backend API Test Suite
Tests all backend endpoints comprehensively including AI integration
"""

import requests
import json
import time
from datetime import datetime, timezone
import uuid
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

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

print(f"Testing Smart Financial Coach API at: {API_BASE}")
print("=" * 60)

class FinancialCoachTester:
    def __init__(self):
        self.test_results = []
        self.created_user_id = None
        
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
    
    def test_user_creation(self):
        """Test POST /api/users - should create user and generate sample transactions"""
        try:
            user_data = {
                "email": f"testuser_{uuid.uuid4().hex[:8]}@example.com",
                "name": "Financial Test User"
            }
            
            response = requests.post(f"{API_BASE}/users", json=user_data, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["id", "email", "name", "created_at"]
                
                if all(field in data for field in required_fields):
                    self.created_user_id = data["id"]
                    self.log_test("User Creation", True, 
                                f"Created user: {data['name']} ({data['email']})", data)
                    
                    # Wait a moment for sample transactions to be generated
                    time.sleep(2)
                    return True
                else:
                    missing = [f for f in required_fields if f not in data]
                    self.log_test("User Creation", False, f"Missing fields: {missing}")
                    return False
            else:
                self.log_test("User Creation", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("User Creation", False, f"Error: {str(e)}")
            return False
    
    def test_get_transactions(self):
        """Test GET /api/users/{user_id}/transactions"""
        if not self.created_user_id:
            self.log_test("Get Transactions", False, "No user ID available")
            return False
            
        try:
            response = requests.get(f"{API_BASE}/users/{self.created_user_id}/transactions", timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                
                if isinstance(data, list) and len(data) > 0:
                    # Check first transaction structure
                    transaction = data[0]
                    required_fields = ["id", "user_id", "amount", "description", "date"]
                    
                    if all(field in transaction for field in required_fields):
                        ai_fields = ["ai_category", "ai_insights"]
                        has_ai = any(field in transaction and transaction[field] for field in ai_fields)
                        
                        self.log_test("Get Transactions", True, 
                                    f"Retrieved {len(data)} transactions, AI analysis: {has_ai}", 
                                    {"count": len(data), "sample": transaction})
                        return True
                    else:
                        missing = [f for f in required_fields if f not in transaction]
                        self.log_test("Get Transactions", False, f"Missing transaction fields: {missing}")
                        return False
                else:
                    self.log_test("Get Transactions", False, "No transactions found or invalid format")
                    return False
            else:
                self.log_test("Get Transactions", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Get Transactions", False, f"Error: {str(e)}")
            return False
    
    def test_dashboard_data(self):
        """Test GET /api/users/{user_id}/dashboard"""
        if not self.created_user_id:
            self.log_test("Dashboard Data", False, "No user ID available")
            return False
            
        try:
            response = requests.get(f"{API_BASE}/users/{self.created_user_id}/dashboard", timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                required_sections = ["user_id", "summary", "category_spending", "recent_transactions"]
                
                if all(section in data for section in required_sections):
                    summary = data["summary"]
                    required_summary_fields = ["total_spent", "total_income", "net_cashflow", "transaction_count"]
                    
                    if all(field in summary for field in required_summary_fields):
                        self.log_test("Dashboard Data", True, 
                                    f"Summary: ${summary['total_spent']:.2f} spent, {summary['transaction_count']} transactions", 
                                    data)
                        return True
                    else:
                        missing = [f for f in required_summary_fields if f not in summary]
                        self.log_test("Dashboard Data", False, f"Missing summary fields: {missing}")
                        return False
                else:
                    missing = [s for s in required_sections if s not in data]
                    self.log_test("Dashboard Data", False, f"Missing sections: {missing}")
                    return False
            else:
                self.log_test("Dashboard Data", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Dashboard Data", False, f"Error: {str(e)}")
            return False
    
    def test_ai_insights(self):
        """Test GET /api/users/{user_id}/insights - AI-powered spending insights"""
        if not self.created_user_id:
            self.log_test("AI Insights", False, "No user ID available")
            return False
            
        try:
            response = requests.get(f"{API_BASE}/users/{self.created_user_id}/insights", timeout=20)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["insights", "total_transactions", "analysis_period"]
                
                if all(field in data for field in required_fields):
                    insights = data["insights"]
                    
                    if isinstance(insights, list) and len(insights) > 0:
                        # Check insight structure
                        insight = insights[0]
                        required_insight_fields = ["category", "total_amount", "transaction_count", "ai_recommendation"]
                        
                        if all(field in insight for field in required_insight_fields):
                            ai_working = bool(insight.get("ai_recommendation", "").strip())
                            self.log_test("AI Insights", True, 
                                        f"Generated {len(insights)} insights, AI recommendations: {ai_working}", 
                                        data)
                            return True
                        else:
                            missing = [f for f in required_insight_fields if f not in insight]
                            self.log_test("AI Insights", False, f"Missing insight fields: {missing}")
                            return False
                    else:
                        self.log_test("AI Insights", False, "No insights generated or invalid format")
                        return False
                else:
                    missing = [f for f in required_fields if f not in data]
                    self.log_test("AI Insights", False, f"Missing response fields: {missing}")
                    return False
            else:
                self.log_test("AI Insights", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("AI Insights", False, f"Error: {str(e)}")
            return False
    
    def test_add_transaction(self):
        """Test POST /api/users/{user_id}/transactions - Add new transaction with AI analysis"""
        if not self.created_user_id:
            self.log_test("Add Transaction", False, "No user ID available")
            return False
            
        try:
            transaction_data = {
                "amount": 45.67,
                "description": "Coffee and pastry at local cafe",
                "merchant": "Corner Coffee Shop",
                "account_type": "checking",
                "transaction_type": "debit"
            }
            
            response = requests.post(f"{API_BASE}/users/{self.created_user_id}/transactions", 
                                   json=transaction_data, timeout=20)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["id", "user_id", "amount", "description", "date"]
                
                if all(field in data for field in required_fields):
                    # Check AI analysis
                    ai_category = data.get("ai_category")
                    ai_insights = data.get("ai_insights")
                    
                    ai_working = bool(ai_category) and bool(ai_insights)
                    
                    self.log_test("Add Transaction", True, 
                                f"Added transaction: ${data['amount']}, AI category: {ai_category}, AI working: {ai_working}", 
                                data)
                    return True
                else:
                    missing = [f for f in required_fields if f not in data]
                    self.log_test("Add Transaction", False, f"Missing fields: {missing}")
                    return False
            else:
                self.log_test("Add Transaction", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Add Transaction", False, f"Error: {str(e)}")
            return False
    
    def test_supabase_connection(self):
        """Test Supabase connection verification"""
        try:
            # Test health endpoint first to ensure backend is running
            health_response = requests.get(f"{API_BASE}/health", timeout=10)
            if health_response.status_code != 200:
                self.log_test("Supabase Connection", False, "Backend not responding")
                return False
            
            # Create a test user to verify Supabase integration
            test_user_data = {
                "email": f"supabase_test_{uuid.uuid4().hex[:8]}@example.com",
                "name": "Supabase Test User"
            }
            
            response = requests.post(f"{API_BASE}/users", json=test_user_data, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                if "id" in data and "email" in data:
                    self.log_test("Supabase Connection", True, 
                                "Backend successfully using Supabase for user creation and data storage")
                    return True
                else:
                    self.log_test("Supabase Connection", False, "Invalid user creation response format")
                    return False
            else:
                self.log_test("Supabase Connection", False, 
                            f"User creation failed - HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Supabase Connection", False, f"Connection error: {str(e)}")
            return False
    
    def test_supabase_operations(self):
        """Test Supabase connectivity by checking data persistence"""
        if not self.created_user_id:
            self.log_test("Supabase Operations", False, "No user ID available")
            return False
            
        try:
            # Get transactions twice to verify persistence
            response1 = requests.get(f"{API_BASE}/users/{self.created_user_id}/transactions", timeout=10)
            time.sleep(1)
            response2 = requests.get(f"{API_BASE}/users/{self.created_user_id}/transactions", timeout=10)
            
            if response1.status_code == 200 and response2.status_code == 200:
                data1 = response1.json()
                data2 = response2.json()
                
                if len(data1) == len(data2) and len(data1) > 0:
                    self.log_test("Supabase Operations", True, 
                                f"Data persistence verified: {len(data1)} transactions consistent")
                    return True
                else:
                    self.log_test("Supabase Operations", False, 
                                f"Data inconsistency: {len(data1)} vs {len(data2)} transactions")
                    return False
            else:
                self.log_test("Supabase Operations", False, "Failed to retrieve data for persistence check")
                return False
                
        except Exception as e:
            self.log_test("Supabase Operations", False, f"Error: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run comprehensive test suite"""
        print("Starting Smart Financial Coach Backend API Tests")
        print("=" * 60)
        
        tests = [
            ("Health Check", self.test_health_check),
            ("Supabase Connection Verification", self.test_supabase_connection),
            ("User Creation & Sample Data Generation", self.test_user_creation),
            ("Get Transactions", self.test_get_transactions),
            ("Dashboard Data", self.test_dashboard_data),
            ("AI Insights Generation", self.test_ai_insights),
            ("Add Transaction with AI Analysis", self.test_add_transaction),
            ("Supabase Operations", self.test_supabase_operations)
        ]
        
        passed = 0
        total = len(tests)
        
        for test_name, test_func in tests:
            print(f"Running: {test_name}")
            if test_func():
                passed += 1
            time.sleep(1)  # Brief pause between tests
        
        print("=" * 60)
        print(f"TEST SUMMARY: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 ALL TESTS PASSED! Smart Financial Coach API is working correctly.")
        else:
            print(f"⚠️  {total - passed} tests failed. Check details above.")
        
        return passed, total, self.test_results

if __name__ == "__main__":
    tester = FinancialCoachTester()
    passed, total, results = tester.run_all_tests()
    
    # Save detailed results
    with open('/app/test_results_detailed.json', 'w') as f:
        json.dump({
            "summary": {"passed": passed, "total": total, "success_rate": passed/total},
            "backend_url": API_BASE,
            "test_timestamp": datetime.now().isoformat(),
            "detailed_results": results
        }, f, indent=2)
    
    print(f"\nDetailed results saved to: /app/test_results_detailed.json")