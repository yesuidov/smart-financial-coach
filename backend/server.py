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

def dccx(item):
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

    async def forecast_goal_progress(self, monthly_savings: float, target_amount: float, current_amount: float) -> Dict[str, Any]:
        """Enhanced forecast and AI guidance for goal progress."""
        try:
            remaining = max(target_amount - current_amount, 0)
            months_needed = float('inf') if monthly_savings <= 0 else remaining / monthly_savings
            
            # More nuanced status determination
            if monthly_savings <= 0:
                status = "no_savings"
            elif months_needed <= 6:
                status = "on_track"
            elif months_needed <= 12:
                status = "moderate_track"
            else:
                status = "off_track"
            
            prompt = f"""
            You are a supportive financial coach helping someone reach their financial goal.

            GOAL PROGRESS:
            Current amount saved: ${current_amount:.2f}
            Target amount: ${target_amount:.2f}
            Amount remaining: ${remaining:.2f}
            Current monthly savings rate: ${monthly_savings:.2f}
            Estimated months to reach goal: {"infinite (no savings)" if months_needed == float('inf') else f"{months_needed:.1f} months"}
            Status: {status.replace('_', ' ')}

            TASK: Provide specific, actionable guidance based on their situation:
            - If on track: 2 tips to maintain momentum
            - If off track: 2 specific ways to increase savings rate
            - If no savings: 2 concrete steps to start saving

            Be encouraging, concise, specific, and focus on actionable steps. Include specific dollar amounts or percentages where possible.
            Keep it conversational and motivating.
            """
            response = self.model.generate_content(prompt, generation_config=self.generation_config)
            return {
                "remaining": remaining,
                "months_needed": None if months_needed == float('inf') else months_needed,
                "status": status,
                "ai_guidance": response.text.strip()
            }
        except Exception as e:
            print(f"Goal forecast error: {e}")
            return {
                "remaining": max(target_amount - current_amount, 0),
                "months_needed": None,
                "status": "unknown",
                "ai_guidance": "Track your spending for a month to estimate savings, then identify 2 categories where you can cut back to free up cash toward your goal."
            }
    
    async def generate_spending_insights(self, user_id: str, transactions: List[Transaction]) -> List[SpendingInsight]:
        """Generate AI-powered spending insights for a user"""
        try:
            # Aggregate spending by category
            category_spending = {}
            total_spending = 0
            
            for transaction in transactions:
                if transaction.transaction_type in ["debit", "payment", "withdrawal"]:
                    category = transaction.ai_category or transaction.category or "other"
                    category_spending[category] = category_spending.get(category, [])
                    category_spending[category].append(transaction.amount)
                    total_spending += transaction.amount
            
            insights = []
            for category, amounts in category_spending.items():
                total_amount = sum(amounts)
                avg_transaction = total_amount / len(amounts)
                
                # Enhanced trend analysis
                trend = "stable"
                if len(amounts) >= 3:
                    recent_avg = sum(amounts[-3:]) / 3
                    if recent_avg > avg_transaction * 1.2:
                        trend = "increasing"
                    elif recent_avg < avg_transaction * 0.8:
                        trend = "decreasing"
                
                # Generate more specific, actionable insights
                insight_prompt = f"""
                You are a smart financial coach. Analyze this spending category and provide specific, concise, actionable insights.

                SPENDING DATA:
                Category: {category}
                Total spent: ${total_amount:.2f}
                Number of transactions: {len(amounts)}
                Average per transaction: ${avg_transaction:.2f}
                Percentage of total spending: {(total_amount/total_spending)*100:.1f}%
                Trend: {trend}

                TASK:
                Provide a specific, encouraging insight with actionable advice. Include:
                1. A friendly observation about the spending
                2. A specific tip to save money in this category
                3. An estimated annual savings potential

                Examples:
                - "You've spent $120 on coffee this month. Brewing at home could save you over $1,000 a year!"
                - "Your entertainment spending is up 15% this month. Consider setting a monthly limit of $200 to save $600 annually."

                Keep it conversational, specific, and motivating. Focus on one clear action.
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
                    trend=trend,
                    ai_recommendation=ai_recommendation
                )
                insights.append(insight)
            
            return insights
            
        except Exception as e:
            print(f"Gemini insights generation error: {e}")
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

# Helper function to parse Supabase data
def parse_from_supabase(data):
    """Parse Supabase data to match our Pydantic models"""
    if not data:
        return {}
    
    # Convert datetime strings to datetime objects
    parsed = dict(data)
    for key in ['date', 'created_at', 'processed_at']:
        if key in parsed and parsed[key]:
            if isinstance(parsed[key], str):
                try:
                    parsed[key] = datetime.fromisoformat(parsed[key].replace('Z', '+00:00'))
                except:
                    parsed[key] = datetime.now(timezone.utc)
    
    return parsed

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
        
        if not result.data:
            # Return sample insights if no transactions
            return {
                "insights": [
                    {
                        "user_id": user_id,
                        "category": "food",
                        "total_amount": 0,
                        "transaction_count": 0,
                        "avg_transaction": 0,
                        "trend": "stable",
                        "ai_recommendation": "Start tracking your food expenses to get personalized insights! Most people can save $200-500 monthly by cooking at home more often."
                    },
                    {
                        "user_id": user_id,
                        "category": "entertainment",
                        "total_amount": 0,
                        "transaction_count": 0,
                        "avg_transaction": 0,
                        "trend": "stable",
                        "ai_recommendation": "Track your entertainment spending to identify opportunities to save. Consider setting a monthly budget of $150-200 for movies, dining out, and subscriptions."
                    }
                ],
                "total_transactions": 0,
                "analysis_period": "no_data_yet",
                "anomalies_present": False
            }
        
        transactions = [Transaction(**parse_from_supabase(t)) for t in result.data]
        
        # Generate AI insights
        insights = await financial_ai.generate_spending_insights(user_id, transactions)
        
        # If no insights generated, provide fallback
        if not insights:
            insights = [
                SpendingInsight(
                    user_id=user_id,
                    category="general",
                    total_amount=0,
                    transaction_count=len(transactions),
                    avg_transaction=0,
                    trend="stable",
                    ai_recommendation="Great job tracking your expenses! Keep monitoring your spending patterns to identify areas for improvement."
                )
            ]
        
        return {
            "insights": [insight.dict() for insight in insights],
            "total_transactions": len(transactions),
            "analysis_period": "last_30_days",
            "anomalies_present": any(i.trend == "increasing" for i in insights)
        }
        
    except Exception as e:
        print(f"Insights generation error: {e}")
        # Return fallback insights
        return {
            "insights": [
                {
                    "user_id": user_id,
                    "category": "tracking",
                    "total_amount": 0,
                    "transaction_count": 0,
                    "avg_transaction": 0,
                    "trend": "stable",
                    "ai_recommendation": "Welcome to Smart Financial Coach! Start adding transactions to get personalized insights and recommendations."
                }
            ],
            "total_transactions": 0,
            "analysis_period": "getting_started",
            "anomalies_present": False
        }

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

# goal forecast
@app.get("/api/users/{user_id}/goal-forecast")
async def get_goal_forecast(user_id: str):
    try:
        # Try different possible goal table names
        goals_result = None
        for table_name in ['financial_goals', 'goals', 'user_goals']:
            try:
                goals_result = supabase_admin.table(table_name).select('*').eq('user_id', user_id).execute()
                if goals_result.data:
                    break
            except:
                continue
        
        # If no goals found, create a sample goal for demonstration
        if not goals_result or not goals_result.data:
            # Create a sample emergency fund goal
            sample_goal = {
                'id': 'sample_emergency_fund',
                'title': 'Emergency Fund',
                'target_amount': 5000.0,
                'current_amount': 0.0,
                'goal_name': 'Emergency Fund'
            }
            goals_data = [sample_goal]
        else:
            goals_data = goals_result.data

        # Get transactions to estimate monthly savings
        txns_result = supabase_admin.table('transactions').select('*').eq('user_id', user_id).execute()

        # Estimate monthly savings: income - expenses (last 30 days)
        now = datetime.now(timezone.utc)
        last_30 = []
        for t in txns_result.data or []:
            date_field = t.get('processed_at') or t.get('created_at') or t.get('date')
            if date_field:
                try:
                    if isinstance(date_field, str):
                        if 'T' in date_field:
                            t_date = datetime.fromisoformat(date_field.replace('Z', '+00:00'))
                        else:
                            t_date = datetime.fromisoformat(date_field)
                    else:
                        t_date = date_field
                    if t_date >= now - timedelta(days=30):
                        last_30.append(t)
                except:
                    continue

        income = sum(float(t.get('amount', 0)) for t in last_30 if t.get('transaction_type') in ['credit', 'deposit'])
        expenses = sum(float(t.get('amount', 0)) for t in last_30 if t.get('transaction_type') in ['debit', 'payment', 'withdrawal'])
        monthly_savings = max(income - expenses, 0)

        forecasts = []
        for g in goals_data:
            target_amount = float(g.get('target_amount') or g.get('target', 0))
            current_amount = float(g.get('current_amount') or g.get('current', 0))
            forecast = await financial_ai.forecast_goal_progress(monthly_savings, target_amount, current_amount)
            forecast.update({
                'goal_id': g.get('id'),
                'title': g.get('title') or g.get('goal_name') or 'Financial Goal',
                'target_amount': target_amount,
                'current_amount': current_amount,
            })
            forecasts.append(forecast)
        
        return {
            'user_id': user_id,
            'monthly_savings_estimate': monthly_savings,
            'forecasts': forecasts,
            'total_goals': len(forecasts)
        }
    except Exception as e:
        print(f"Goal forecast error: {e}")
        # Return a fallback response
        return {
            'user_id': user_id,
            'monthly_savings_estimate': 0,
            'forecasts': [{
                'goal_id': 'fallback',
                'title': 'Set Your First Goal',
                'target_amount': 1000,
                'current_amount': 0,
                'remaining': 1000,
                'months_needed': None,
                'status': 'no_savings',
                'ai_guidance': 'Start by setting a financial goal in the Goals tab. Track your spending for a month to understand your savings potential, then create a realistic timeline.'
            }],
            'total_goals': 1
        }

# subscriptions detector
@app.get("/api/users/{user_id}/subscriptions")
async def get_subscriptions(user_id: str):
    try:
        txns_result = supabase_admin.table('transactions').select('*').eq('user_id', user_id).execute()
        # Heuristic recurring detection by merchant + amount cadence
        by_merchant = {}
        for t in txns_result.data or []:
            key = (t.get('merchant') or t.get('description') or '').strip().lower()
            if not key:
                continue
            by_merchant.setdefault(key, []).append(t)

        subscriptions = []
        for merchant, items in by_merchant.items():
            if len(items) < 2:
                continue
            amounts = [round(float(i.get('amount') or 0), 2) for i in items]
            dates = [i.get('processed_at') or i.get('created_at') for i in items if i.get('processed_at') or i.get('created_at')]
            dates = [datetime.fromisoformat(d.replace('Z', '+00:00')) if isinstance(d, str) else d for d in dates]
            dates.sort()
            if len(dates) >= 2:
                intervals = [(dates[i] - dates[i-1]).days for i in range(1, len(dates))]
                avg_interval = sum(intervals)/len(intervals)
            else:
                avg_interval = None

            stable_amount = (max(amounts) - min(amounts)) <= (0.1 * (sum(amounts)/len(amounts) or 1))
            monthly_like = avg_interval is not None and 20 <= avg_interval <= 40
            if stable_amount and monthly_like:
                last_date = dates[-1] if dates else None
                monthly_total = sum(a for a in amounts) / max(len(amounts)/1.0, 1.0)
                subscriptions.append({
                    'merchant': merchant,
                    'average_amount': round(sum(amounts)/len(amounts), 2),
                    'avg_interval_days': avg_interval,
                    'last_charge': last_date,
                    'estimated_monthly_total': round(monthly_total, 2)
                })

        subscriptions.sort(key=lambda s: s['estimated_monthly_total'], reverse=True)
        return {
            'user_id': user_id,
            'subscriptions': subscriptions,
            'estimated_monthly_total': round(sum(s['estimated_monthly_total'] for s in subscriptions), 2)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error detecting subscriptions: {str(e)}")

# Create comprehensive sample data for new users
@app.post("/api/users/{user_id}/sample-data")
async def create_sample_data(user_id: str):
    try:
        # Create realistic sample accounts
        sample_accounts = [
            {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "account_name": "Chase Total Checking",
                "account_type": "checking",
                "balance": 3247.83,
                "bank_name": "Chase Bank",
                "account_number": "****1234",
                "created_at": (datetime.now(timezone.utc) - timedelta(days=365)).isoformat()
            },
            {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "account_name": "Chase Premier Savings",
                "account_type": "savings",
                "balance": 12450.00,
                "bank_name": "Chase Bank",
                "account_number": "****5678",
                "created_at": (datetime.now(timezone.utc) - timedelta(days=365)).isoformat()
            }
        ]
        
        # Create realistic sample goals
        sample_goals = [
            {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "title": "Emergency Fund",
                "target_amount": 15000.00,
                "current_amount": 12450.00,
                "target_date": (datetime.now(timezone.utc) + timedelta(days=120)).isoformat(),
                "is_active": True,
                "created_at": (datetime.now(timezone.utc) - timedelta(days=60)).isoformat()
            },
            {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "title": "Vacation Fund",
                "target_amount": 5000.00,
                "current_amount": 1200.00,
                "target_date": (datetime.now(timezone.utc) + timedelta(days=180)).isoformat(),
                "is_active": True,
                "created_at": (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
            }
        ]
        
        # Generate sample transactions using existing system
        sample_transactions = synthetic_data.generate_sample_transactions(user_id, 30)
        
        # Insert sample data
        for account in sample_accounts:
            supabase_admin.table('accounts').insert(account).execute()
            
        for transaction in sample_transactions:
            transaction_dict = transaction.dict()
            transaction_dict['processed_at'] = transaction_dict['date'].isoformat()
            supabase_admin.table('transactions').insert(transaction_dict).execute()
            
        for goal in sample_goals:
            supabase_admin.table('financial_goals').insert(goal).execute()
        
        return {
            "message": "Comprehensive sample data created successfully", 
            "accounts": len(sample_accounts), 
            "transactions": len(sample_transactions), 
            "goals": len(sample_goals),
            "data_period": "Last 30 days"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating sample data: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)