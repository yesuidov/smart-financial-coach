from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, date, timedelta, timezone
import os
from supabase import create_client, Client
import uuid
import json
from dotenv import load_dotenv
import asyncio
import random
import google.generativeai as genai
import json
import os
from typing import Dict, Any, List

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(title="Smart Financial Coach API", version="2.0.0")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure based on your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Supabase connection
SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_ANON_KEY = os.environ.get('SUPABASE_ANON_KEY')
SUPABASE_SERVICE_ROLE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    raise ValueError("Missing Supabase environment variables")

# Create Supabase clients
supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
supabase_admin: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# LLM Integration setup
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable is required")

# Configure Gemini
genai.configure(api_key=GEMINI_API_KEY)

# Pydantic models
class Transaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    amount: float
    description: str
    category: Optional[str] = None
    ai_category: Optional[str] = None
    date: datetime
    merchant: Optional[str] = None
    account_type: str = "checking"  # checking, savings, credit_card
    transaction_type: str = "debit"  # debit, credit
    ai_insights: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
class SpendingInsight(BaseModel):
    user_id: str
    category: str
    total_amount: float
    transaction_count: int
    avg_transaction: float
    trend: str  # increasing, decreasing, stable
    ai_recommendation: str
    period: str = "monthly"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class FinancialGoal(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    title: str
    target_amount: float
    current_amount: float = 0.0
    target_date: date
    category: str
    ai_coaching: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Helper functions for Supabase
def prepare_for_supabase(data):
    """Convert datetime objects to ISO strings for Supabase storage"""
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, datetime):
                data[key] = value.isoformat()
            elif isinstance(value, date):
                data[key] = value.isoformat()
    return data

def parse_from_supabase(item):
    """Parse datetime strings from Supabase back to Python objects and map field names"""
    if isinstance(item, dict):
        # Map Supabase field names back to our model
        if 'processed_at' in item and 'date' not in item:
            item['date'] = item['processed_at']
        
        for key, value in item.items():
            if key in ['date', 'created_at', 'target_date', 'processed_at'] and isinstance(value, str):
                try:
                    if 'T' in value:  # datetime
                        item[key] = datetime.fromisoformat(value.replace('Z', '+00:00'))
                    else:  # date
                        item[key] = datetime.fromisoformat(value).date()
                except:
                    pass
    return item

# AI Integration functions
class FinancialAI:
    def __init__(self):
        # Use Gemini 1.5 Flash (fast and cost-effective)
        self.model = genai.GenerativeModel('gemini-1.5-flash')
        
        # Configure generation settings for financial analysis
        self.generation_config = genai.types.GenerationConfig(
            temperature=0.3,
            top_p=0.8,
            top_k=40,
            max_output_tokens=500,
        )
    
    async def analyze_transaction(self, transaction: Transaction) -> Dict[str, Any]:
        """Analyze a single transaction and provide AI insights"""
        try:
            analysis_prompt = f"""
            You are a smart financial coach. Analyze this financial transaction and provide helpful insights.

            TRANSACTION DETAILS:
            Amount: ${transaction.amount}
            Description: {transaction.description}
            Merchant: {transaction.merchant}
            Date: {transaction.date}
            Account Type: {transaction.account_type}

            TASK:
            1. Categorize into one of: food, transportation, entertainment, utilities, shopping, healthcare, housing, other
            2. Provide a brief, encouraging insight (1-2 sentences, be supportive not judgmental)
            3. Give a helpful tip if applicable (or empty string if none)

            RESPONSE FORMAT (valid JSON only):
            {{
                "category": "category_name",
                "insight": "encouraging insight about the purchase",
                "tip": "helpful suggestion or empty string"
            }}
            """
            
            # Generate response using Gemini
            response = self.model.generate_content(
                analysis_prompt,
                generation_config=self.generation_config
            )
            
            # Parse the JSON response
            try:
                # Clean the response text (remove potential markdown formatting)
                response_text = response.text.strip()
                if response_text.startswith('```json'):
                    response_text = response_text.replace('```json', '').replace('```', '').strip()
                
                ai_analysis = json.loads(response_text)
                
                # Validate required fields
                required_fields = ['category', 'insight', 'tip']
                if not all(field in ai_analysis for field in required_fields):
                    raise ValueError("Missing required fields in AI response")
                    
            except (json.JSONDecodeError, ValueError) as e:
                print(f"JSON parsing error: {e}, Response: {response.text}")
                # Fallback if JSON parsing fails
                ai_analysis = {
                    "category": self._guess_category(transaction.description),
                    "insight": "Transaction recorded successfully",
                    "tip": ""
                }
            
            return ai_analysis
            
        except Exception as e:
            print(f"Gemini analysis error: {e}")
            return {
                "category": self._guess_category(transaction.description),
                "insight": "Transaction recorded successfully",
                "tip": ""
            }
    
    async def generate_spending_insights(self, user_id: str, transactions: List[Transaction]) -> List[SpendingInsight]:
        """Generate AI-powered spending insights for a user"""
        try:
            # Aggregate spending by category
            category_spending = {}
            total_spending = 0
            
            for transaction in transactions:
                if transaction.transaction_type == "debit":
                    category = transaction.ai_category or transaction.category or "other"
                    category_spending[category] = category_spending.get(category, [])
                    category_spending[category].append(transaction.amount)
                    total_spending += transaction.amount
            
            insights = []
            for category, amounts in category_spending.items():
                total_amount = sum(amounts)
                avg_transaction = total_amount / len(amounts)
                
                insight_prompt = f"""
                You are a smart financial coach analyzing spending patterns. Be encouraging and supportive.

                SPENDING ANALYSIS:
                Category: {category}
                Total spent: ${total_amount:.2f}
                Number of transactions: {len(amounts)}
                Average per transaction: ${avg_transaction:.2f}
                Percentage of total spending: {(total_amount/total_spending)*100:.1f}%

                TASK:
                Provide a helpful, encouraging recommendation (2-3 sentences) about this spending category.
                Focus on actionable advice, not judgment. Be supportive and motivating.
                Suggest specific ways to optimize spending in this category if appropriate.

                RESPONSE:
                Provide only the recommendation text (no JSON, no formatting).
                """
                
                response = self.model.generate_content(
                    insight_prompt,
                    generation_config=self.generation_config
                )
                
                ai_recommendation = response.text.strip()
                
                insight = SpendingInsight(
                    user_id=user_id,
                    category=category,
                    total_amount=total_amount,
                    transaction_count=len(amounts),
                    avg_transaction=avg_transaction,
                    trend="stable",  # TODO: Calculate actual trend
                    ai_recommendation=ai_recommendation
                )
                insights.append(insight)
            
            return insights
            
        except Exception as e:
            print(f"Gemini insights generation error: {e}")
            return []
    
    async def generate_personalized_budget_advice(self, user_id: str, total_income: float, spending_by_category: dict) -> str:
        """Generate personalized budget recommendations"""
        try:
            budget_prompt = f"""
            You are a personal financial advisor. Create personalized budget advice.

            USER FINANCIAL PROFILE:
            Monthly Income: ${total_income:.2f}
            Current Spending Breakdown:
            {json.dumps(spending_by_category, indent=2)}

            TASK:
            Provide specific, actionable budget recommendations:
            1. Identify spending categories that are too high
            2. Suggest realistic percentage allocations
            3. Recommend specific saving strategies
            4. Give 3 concrete next steps

            Keep advice encouraging and achievable. Focus on small improvements.
            """
            
            response = self.model.generate_content(
                budget_prompt,
                generation_config=self.generation_config
            )
            
            return response.text.strip()
            
        except Exception as e:
            print(f"Budget advice generation error: {e}")
            return "Focus on tracking your spending and identifying areas where you can save a little each month."
    
    async def generate_financial_goals_suggestions(self, user_profile: dict, current_savings: float) -> List[dict]:
        """Suggest personalized financial goals"""
        try:
            goals_prompt = f"""
            You are a financial coach suggesting realistic financial goals.

            USER PROFILE:
            Current Savings: ${current_savings:.2f}
            Profile: {json.dumps(user_profile, indent=2)}

            TASK:
            Suggest 3-5 realistic financial goals with specific amounts and timeframes.
            Consider user's current financial situation.

            RESPONSE FORMAT (valid JSON array):
            [
                {{
                    "goal_name": "Emergency Fund",
                    "suggested_amount": 5000,
                    "timeframe_months": 12,
                    "reasoning": "Build 3-6 months of expenses as safety net"
                }}
            ]
            """
            
            response = self.model.generate_content(
                goals_prompt,
                generation_config=self.generation_config
            )
            
            # Parse JSON response
            response_text = response.text.strip()
            if response_text.startswith('```json'):
                response_text = response_text.replace('```json', '').replace('```', '').strip()
            
            goals = json.loads(response_text)
            return goals
            
        except Exception as e:
            print(f"Goals suggestion error: {e}")
            return []
    
    # Keep the existing _guess_category method as fallback
    def _guess_category(self, description: str) -> str:
        """Simple category guessing fallback"""
        description_lower = description.lower()
        
        if any(word in description_lower for word in ['grocery', 'market', 'food', 'restaurant', 'cafe', 'coffee']):
            return 'food'
        elif any(word in description_lower for word in ['gas', 'fuel', 'uber', 'lyft', 'taxi', 'transport']):
            return 'transportation'
        elif any(word in description_lower for word in ['movie', 'entertainment', 'netflix', 'spotify', 'game']):
            return 'entertainment'
        elif any(word in description_lower for word in ['electric', 'water', 'internet', 'phone', 'utility']):
            return 'utilities'
        elif any(word in description_lower for word in ['amazon', 'store', 'mall', 'shop']):
            return 'shopping'
        else:
            return 'other'

# Initialize AI service
financial_ai = FinancialAI()

# Synthetic data generator
class SyntheticDataGenerator:
    @staticmethod
    def generate_sample_transactions(user_id: str, num_transactions: int = 50) -> List[Transaction]:
        """Generate realistic sample financial transactions"""
        merchants = [
            "Whole Foods", "Starbucks", "Shell Gas Station", "Amazon", "Netflix", 
            "Uber", "Target", "McDonald's", "Best Buy", "CVS Pharmacy",
            "AT&T", "Electric Company", "Water Department", "Rent Payment",
            "Chipotle", "Home Depot", "Walmart", "Costco", "Apple Store"
        ]
        
        categories = {
            "Whole Foods": "food", "Starbucks": "food", "McDonald's": "food", "Chipotle": "food",
            "Shell Gas Station": "transportation", "Uber": "transportation",
            "Amazon": "shopping", "Target": "shopping", "Best Buy": "shopping", "Apple Store": "shopping",
            "Netflix": "entertainment", "Costco": "shopping", "Walmart": "shopping",
            "AT&T": "utilities", "Electric Company": "utilities", "Water Department": "utilities",
            "CVS Pharmacy": "healthcare", "Home Depot": "home", "Rent Payment": "housing"
        }
        
        transactions = []
        start_date = datetime.now(timezone.utc) - timedelta(days=30)
        
        for _ in range(num_transactions):
            merchant = random.choice(merchants)
            amount = round(random.uniform(5.99, 299.99), 2)
            
            # Make rent payment larger
            if merchant == "Rent Payment":
                amount = round(random.uniform(800, 2000), 2)
            
            transaction_date = start_date + timedelta(days=random.randint(0, 30))
            
            transaction = Transaction(
                user_id=user_id,
                amount=amount,
                description=f"Purchase at {merchant}",
                category=categories.get(merchant, "other"),
                ai_category=categories.get(merchant, "other"),
                date=transaction_date,
                merchant=merchant,
                account_type="checking",
                transaction_type="debit"
            )
            transactions.append(transaction)
        
        return transactions

synthetic_data = SyntheticDataGenerator()

# API Routes
@app.get("/")
async def root():
    return {"message": "Smart Financial Coach API is running!"}

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc)}

@app.post("/api/users", response_model=User)
async def create_user(user_data: dict):
    """Create a new user"""
    try:
        user = User(
            email=user_data.get("email"),
            name=user_data.get("name", "User")
        )
        
        # Create user in Supabase auth system
        try:
            auth_response = supabase_admin.auth.admin.create_user({
                "email": user.email,
                "password": "temp_password_123",  # Temporary password for testing
                "user_metadata": {"name": user.name}
            })
            
            # Use the auth user ID
            auth_user_id = auth_response.user.id
            user.id = auth_user_id
            
        except Exception as auth_error:
            print(f"Auth user creation failed: {auth_error}")
            # Fallback: try to create without foreign key constraints
            # This might fail, but we'll handle it
            pass
        
        # Generate sample transactions for the user
        sample_transactions = synthetic_data.generate_sample_transactions(user.id)
        
        # Analyze each transaction with AI and store
        for transaction in sample_transactions:
            ai_analysis = await financial_ai.analyze_transaction(transaction)
            transaction.ai_category = ai_analysis.get("category")
            transaction.ai_insights = ai_analysis
            
            # Map transaction fields to match Supabase schema
            transaction_dict = prepare_for_supabase(transaction.dict())
            supabase_transaction = {
                "id": transaction_dict["id"],
                "user_id": transaction_dict["user_id"],
                "amount": transaction_dict["amount"],
                "description": transaction_dict["description"],
                "category": transaction_dict.get("category"),
                "ai_category": transaction_dict.get("ai_category"),
                "ai_insights": transaction_dict.get("ai_insights"),
                "merchant": transaction_dict.get("merchant"),
                "transaction_type": "payment",  # Map to Supabase enum
                "processed_at": transaction_dict["date"],
                "created_at": transaction_dict["created_at"]
            }
            supabase_admin.table('transactions').insert(supabase_transaction).execute()
        
        return user
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating user: {str(e)}")

@app.get("/api/users/{user_id}/transactions", response_model=List[Transaction])
async def get_user_transactions(user_id: str):
    """Get all transactions for a user"""
    try:
        result = supabase_admin.table('transactions').select("*").eq('user_id', user_id).execute()
        transactions = [Transaction(**parse_from_supabase(t)) for t in result.data]
        return transactions
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching transactions: {str(e)}")

@app.post("/api/users/{user_id}/transactions", response_model=Transaction)
async def add_transaction(user_id: str, transaction_data: dict):
    """Add a new transaction with AI analysis"""
    try:
        transaction = Transaction(
            user_id=user_id,
            amount=transaction_data.get("amount"),
            description=transaction_data.get("description"),
            merchant=transaction_data.get("merchant"),
            date=datetime.now(timezone.utc),
            account_type=transaction_data.get("account_type", "checking"),
            transaction_type=transaction_data.get("transaction_type", "debit")
        )
        
        # Analyze with AI
        ai_analysis = await financial_ai.analyze_transaction(transaction)
        transaction.ai_category = ai_analysis.get("category")
        transaction.ai_insights = ai_analysis
        
        # Map transaction fields to match Supabase schema
        transaction_dict = prepare_for_supabase(transaction.dict())
        supabase_transaction = {
            "id": transaction_dict["id"],
            "user_id": transaction_dict["user_id"],
            "amount": transaction_dict["amount"],
            "description": transaction_dict["description"],
            "category": transaction_dict.get("category"),
            "ai_category": transaction_dict.get("ai_category"),
            "ai_insights": transaction_dict.get("ai_insights"),
            "merchant": transaction_dict.get("merchant"),
            "transaction_type": "payment",  # Map to Supabase enum
            "processed_at": transaction_dict["date"],
            "created_at": transaction_dict["created_at"]
        }
        result = supabase_admin.table('transactions').insert(supabase_transaction).execute()
        
        return transaction
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error adding transaction: {str(e)}")

@app.get("/api/users/{user_id}/insights")
async def get_spending_insights(user_id: str):
    """Get AI-powered spending insights for a user"""
    try:
        # Get recent transactions
        result = supabase_admin.table('transactions').select("*").eq('user_id', user_id).execute()
        transactions = [Transaction(**parse_from_supabase(t)) for t in result.data]
        
        # Generate AI insights
        insights = await financial_ai.generate_spending_insights(user_id, transactions)
        
        return {
            "insights": [insight.dict() for insight in insights],
            "total_transactions": len(transactions),
            "analysis_period": "last_30_days"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating insights: {str(e)}")

@app.get("/api/users/{user_id}/dashboard")
async def get_dashboard_data(user_id: str):
    """Get comprehensive dashboard data for a user"""
    try:
        # Get transactions
        result = supabase_admin.table('transactions').select("*").eq('user_id', user_id).execute()
        transactions = [Transaction(**parse_from_supabase(t)) for t in result.data]
        
        # Calculate summary statistics
        total_spent = sum(t.amount for t in transactions if t.transaction_type in ["debit", "payment", "withdrawal"])
        total_income = sum(t.amount for t in transactions if t.transaction_type in ["credit", "deposit"])
        
        # Category breakdown
        category_spending = {}
        for transaction in transactions:
            if transaction.transaction_type in ["debit", "payment", "withdrawal"]:
                category = transaction.ai_category or transaction.category or "other"
                category_spending[category] = category_spending.get(category, 0) + transaction.amount
        
        # Recent transactions (last 10)
        recent_transactions = sorted(transactions, key=lambda x: x.date, reverse=True)[:10]
        
        return {
            "user_id": user_id,
            "summary": {
                "total_spent": total_spent,
                "total_income": total_income,
                "net_cashflow": total_income - total_spent,
                "transaction_count": len(transactions)
            },
            "category_spending": category_spending,
            "recent_transactions": [t.dict() for t in recent_transactions]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching dashboard data: {str(e)}")

@app.get("/api/users/{user_id}/budget-advice")
async def get_budget_advice(user_id: str):
    """Get personalized budget recommendations"""
    try:
        # Get user's financial data
        accounts_data = await supabase.table('accounts').select('*').eq('user_id', user_id).execute()
        transactions_data = await supabase.table('transactions').select('*').eq('user_id', user_id).execute()
        
        # Calculate income and spending
        total_income = sum(acc['balance'] for acc in accounts_data.data if acc['account_type'] == 'checking')
        
        spending_by_category = {}
        for txn in transactions_data.data:
            if txn['transaction_type'] == 'debit':
                category = txn.get('ai_category', 'other')
                spending_by_category[category] = spending_by_category.get(category, 0) + float(txn['amount'])
        
        # Generate AI advice
        advice = await financial_ai.generate_personalized_budget_advice(user_id, total_income, spending_by_category)
        
        return {
            "user_id": user_id,
            "budget_advice": advice,
            "current_income": total_income,
            "spending_breakdown": spending_by_category
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating budget advice: {str(e)}")

@app.get("/api/users/{user_id}/goal-suggestions")
async def get_goal_suggestions(user_id: str):
    """Get AI-powered financial goal suggestions"""
    try:
        # Get user profile and financial data
        profile_data = await supabase.table('user_profiles').select('*').eq('id', user_id).single().execute()
        accounts_data = await supabase.table('accounts').select('*').eq('user_id', user_id).execute()
        
        current_savings = sum(acc['balance'] for acc in accounts_data.data if acc['account_type'] == 'savings')
        user_profile = profile_data.data if profile_data.data else {}
        
        # Generate goal suggestions
        suggested_goals = await financial_ai.generate_financial_goals_suggestions(user_profile, current_savings)
        
        return {
            "user_id": user_id,
            "suggested_goals": suggested_goals,
            "current_savings": current_savings
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating goal suggestions: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)