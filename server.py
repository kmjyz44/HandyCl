from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Header, Depends, Query, Body
from fastapi.responses import JSONResponse, StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any, Union, Tuple
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
from enum import Enum
import httpx
from telegram import Bot
from telegram.constants import ParseMode
import asyncio
import json
import re
from bson import ObjectId

# Web push (best-effort import — never block server boot if missing)
try:
    from pywebpush import webpush, WebPushException
    _PUSH_AVAILABLE = True
except ImportError:
    _PUSH_AVAILABLE = False
    webpush = None
    WebPushException = Exception

ROOT_DIR = Path(__file__).parent


def clean_bson(obj):
    """Recursively convert BSON types (ObjectId, datetime) to JSON-serializable Python types."""
    if isinstance(obj, ObjectId):
        return str(obj)
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, dict):
        return {k: clean_bson(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [clean_bson(i) for i in obj]
    return obj
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Enums
class UserRole(str, Enum):
    CLIENT = "client"
    PROVIDER = "provider"
    ADMIN = "admin"
    MODERATOR = "moderator"
    SUPPORT = "support"

class BookingStatus(str, Enum):
    DRAFT = "draft"
    POSTED = "posted"  # Task posted, waiting for tasker
    OFFERING = "offering"  # Taskers sending offers
    PENDING_ACCEPTANCE = "pending_acceptance"  # Assigned to a specific tasker awaiting their Accept/Decline
    DECLINED = "declined"  # Tasker declined; client must reassign
    ASSIGNED = "assigned"  # Tasker explicitly accepted
    HOLD_PLACED = "hold_placed"  # Payment hold successful
    ON_THE_WAY = "on_the_way"  # Tasker on the way
    STARTED = "started"  # Job started
    COMPLETED_PENDING_PAYMENT = "completed_pending_payment"
    PAID = "paid"
    CANCELLED_BY_CLIENT = "cancelled_by_client"
    CANCELLED_BY_TASKER = "cancelled_by_tasker"
    DISPUTE = "dispute"

class TaskStatus(str, Enum):
    DRAFT = "draft"
    POSTED = "posted"
    OFFERING = "offering"
    PENDING_ACCEPTANCE = "pending_acceptance"
    DECLINED = "declined"
    ASSIGNED = "assigned"
    HOLD_PLACED = "hold_placed"
    ON_THE_WAY = "on_the_way"
    STARTED = "started"
    COMPLETED_PENDING_PAYMENT = "completed_pending_payment"
    PAID = "paid"
    CANCELLED_BY_CLIENT = "cancelled_by_client"
    CANCELLED_BY_TASKER = "cancelled_by_tasker"
    DISPUTE = "dispute"

class OfferStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    WITHDRAWN = "withdrawn"

# ==================== NEW ENUMS AS PER SPECIFICATION ====================

class VerificationStatus(str, Enum):
    NOT_SUBMITTED = "not_submitted"
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"

class DocumentType(str, Enum):
    ID_CARD = "id_card"
    PASSPORT = "passport"
    DRIVERS_LICENSE = "drivers_license"
    INSURANCE = "insurance"
    CERTIFICATE = "certificate"
    BACKGROUND_CHECK = "background_check"
    W9_TAX = "w9_tax"

class BadgeType(str, Enum):
    VERIFIED = "verified"
    TOP_RATED = "top_rated"
    ELITE = "elite"
    NEW = "new"
    FAST_RESPONDER = "fast_responder"
    BACKGROUND_CHECKED = "background_checked"

class PayoutStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    ON_HOLD = "on_hold"

class RefundStatus(str, Enum):
    REQUESTED = "requested"
    APPROVED = "approved"
    PROCESSING = "processing"
    COMPLETED = "completed"
    REJECTED = "rejected"

class CommissionType(str, Enum):
    PERCENTAGE = "percentage"
    FIXED = "fixed"

class ServiceCategory(str, Enum):
    HANDYMAN_PLUMBING = "handyman_plumbing"
    HANDYMAN_ELECTRICAL = "handyman_electrical"
    HANDYMAN_CARPENTRY = "handyman_carpentry"
    HANDYMAN_PAINTING = "handyman_painting"
    HANDYMAN_ASSEMBLY = "handyman_assembly"
    HANDYMAN_MOUNTING = "handyman_mounting"
    CLEANING_REGULAR = "cleaning_regular"
    CLEANING_DEEP = "cleaning_deep"
    CLEANING_MOVE_OUT = "cleaning_move_out"
    CLEANING_OFFICE = "cleaning_office"
    MOVING_LOCAL = "moving_local"
    MOVING_LONG = "moving_long"
    DELIVERY = "delivery"
    GARDENING = "gardening"
    OTHER = "other"

# Models
class User(BaseModel):
    user_id: str
    email: EmailStr
    name: str
    role: UserRole
    phone: Optional[str] = None
    picture: Optional[str] = None
    google_id: Optional[str] = None
    password_hash: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    fcm_token: Optional[str] = None
    is_blocked: bool = False
    hidden_from_clients: bool = False  # Admin can hide executor from client listing
    blocked_until: Optional[datetime] = None
    blocked_reason: Optional[str] = None
    blocked_by: Optional[str] = None
    # Location
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    # Stripe
    stripe_customer_id: Optional[str] = None
    stripe_connect_account_id: Optional[str] = None  # For taskers
    # Client saved data
    payment_methods: Optional[List[dict]] = []
    saved_addresses: Optional[List[dict]] = []
    email_verified: bool = False
    phone_verified: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: UserRole
    phone: Optional[str] = None
    accepted_terms: Optional[bool] = False

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Service(BaseModel):
    service_id: str
    name: str
    category: ServiceCategory
    description: str
    price: float
    duration: int  # minutes
    image: Optional[str] = None  # base64
    available: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ServiceCreate(BaseModel):
    name: str
    category: ServiceCategory
    description: str
    price: float
    duration: int
    image: Optional[str] = None
    available: bool = True

class Booking(BaseModel):
    booking_id: str
    client_id: str
    service_id: Optional[str] = None
    # Accept any string — admin-defined categories use custom IDs.
    category: Optional[str] = None
    provider_id: Optional[str] = None
    title: str
    description: str
    date: Optional[str] = None
    time: Optional[str] = None
    address: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    notes: Optional[str] = None
    problem_description: Optional[str] = None
    problem_photos: Optional[List[str]] = None  # Array of base64 images
    status: BookingStatus = BookingStatus.DRAFT
    # Pricing
    estimated_price: Optional[float] = None
    hourly_rate: Optional[float] = None
    estimated_hours: Optional[float] = None
    final_price: Optional[float] = None
    tip_amount: Optional[float] = None
    materials_cost: Optional[float] = None
    platform_fee: Optional[float] = None
    total_price: float = 0
    # Payment
    payment_status: str = "pending"
    payment_intent_id: Optional[str] = None  # Stripe PaymentIntent
    payment_hold_placed: bool = False
    payment_captured: bool = False
    # Timing
    actual_start_time: Optional[datetime] = None
    actual_end_time: Optional[datetime] = None
    actual_hours: Optional[float] = None
    # Offers mode
    allow_offers: bool = False
    offers_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BookingCreate(BaseModel):
    service_id: Optional[str] = None
    # Accept any string — modern admin-created categories use custom IDs
    # like 'assembly', 'cleaning' (not the legacy ServiceCategory enum).
    category: Optional[str] = None
    title: str
    description: str
    date: Optional[str] = None
    time: Optional[str] = None
    address: str
    city: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    notes: Optional[str] = None
    problem_description: Optional[str] = None
    problem_photos: Optional[List[str]] = None
    estimated_hours: Optional[float] = None
    allow_offers: bool = False
    provider_id: Optional[str] = None
    provider_hourly_rate: Optional[float] = None
    urgency: Optional[str] = None
    problem_type: Optional[str] = None
    tools_needed: Optional[bool] = False
    flexible_date: Optional[bool] = False
    preferred_time_range: Optional[str] = None
    promo_code: Optional[str] = None
    total_price: Optional[float] = None

# Offer model - when taskers send offers for a task
class Offer(BaseModel):
    offer_id: str
    booking_id: str
    tasker_id: str
    proposed_price: float
    proposed_hours: Optional[float] = None
    message: Optional[str] = None
    status: OfferStatus = OfferStatus.PENDING
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OfferCreate(BaseModel):
    booking_id: str
    proposed_price: float
    proposed_hours: Optional[float] = None
    message: Optional[str] = None

class Task(BaseModel):
    task_id: str
    booking_id: Optional[str] = None
    client_id: str
    provider_id: Optional[str] = None
    title: str
    description: str
    category: Optional[ServiceCategory] = None
    status: TaskStatus = TaskStatus.DRAFT
    # Assignment
    assigned_by: Optional[str] = None  # admin user_id if admin assigned
    assigned_at: Optional[datetime] = None
    # Location
    address: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    # Timing
    scheduled_date: Optional[str] = None
    scheduled_time: Optional[str] = None
    actual_start_time: Optional[datetime] = None
    actual_end_time: Optional[datetime] = None
    actual_hours: Optional[float] = None
    # Pricing
    estimated_price: Optional[float] = None
    hourly_rate: Optional[float] = None
    final_price: Optional[float] = None
    materials_cost: Optional[float] = None
    tip_amount: Optional[float] = None
    platform_fee: Optional[float] = None
    # Payment
    payment_intent_id: Optional[str] = None
    payment_hold_placed: bool = False
    payment_captured: bool = False
    # Content
    photos: Optional[List[str]] = None
    notes: Optional[str] = None
    provider_notes: Optional[str] = None
    completion_photos: Optional[List[str]] = None
    # Offers
    allow_offers: bool = False
    selected_offer_id: Optional[str] = None
    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None

class TaskCreate(BaseModel):
    provider_id: str
    title: str
    description: str
    booking_id: Optional[str] = None
    client_id: Optional[str] = None
    due_date: Optional[str] = None
    due_time: Optional[str] = None
    address: Optional[str] = None
    custom_price: Optional[float] = None

class TaskUpdate(BaseModel):
    status: Optional[TaskStatus] = None
    due_date: Optional[str] = None
    due_time: Optional[str] = None
    custom_price: Optional[float] = None
    notes: Optional[str] = None
    provider_comments: Optional[str] = None
    actual_hours: Optional[float] = None
    expenses: Optional[float] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None

class TaskComplete(BaseModel):
    actual_hours: Optional[float] = None   # auto-calculated if omitted
    expenses: Optional[float] = None
    materials_cost: Optional[float] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    provider_comments: Optional[str] = None
    provider_notes: Optional[str] = None   # alias for provider_comments

class Message(BaseModel):
    message_id: str
    from_user_id: str
    to_user_id: str
    booking_id: Optional[str] = None
    text: str
    read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MessageCreate(BaseModel):
    to_user_id: Optional[str] = None
    text: str = ""
    booking_id: Optional[str] = None
    image_url: Optional[str] = None  # base64 data URI or URL

class Review(BaseModel):
    review_id: str
    booking_id: str
    client_id: str
    provider_id: str
    rating: int  # 1-5
    comment: Optional[str] = None
    tip_amount: Optional[float] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
class ReviewCreate(BaseModel):
    booking_id: str
    rating: int
    comment: Optional[str] = None
    tip_amount: Optional[float] = None

class ReviewUpdate(BaseModel):
    rating: Optional[int] = None
    comment: Optional[str] = None

class ExecutorProfile(BaseModel):
    profile_id: str
    user_id: str
    bio: Optional[str] = None
    skills: List[Union[str, Dict[str, Any]]] = []
    experience_years: Optional[int] = None
    hourly_rate: Optional[float] = None
    # Service pricing options
    fixed_price_packages: List[Dict[str, Any]] = []  # [{name, price, description}]
    minimum_order: Optional[float] = None
    travel_fee: Optional[float] = None
    emergency_fee_percent: Optional[float] = None
    # Portfolio & media
    portfolio_photos: List[str] = []  # base64 images
    certifications: List[str] = []
    languages: List[str] = []
    tools_equipment: List[str] = []  # Tools/equipment tasker has
    # Availability
    availability: Optional[str] = None
    buffer_time_minutes: int = 30  # Time between jobs
    # Coverage area
    service_zones: List[str] = []  # Areas/districts where provider works
    service_radius_km: Optional[float] = None  # Service radius in km
    service_cities: List[str] = []
    service_zip_codes: List[str] = []
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    # Verification status
    verification_status: str = "not_submitted"  # not_submitted, pending, approved, rejected
    is_verified: bool = False
    is_background_checked: bool = False
    # Stats
    acceptance_rate: float = 100.0
    response_time_minutes: Optional[int] = None
    total_jobs_completed: int = 0
    cancellation_count: int = 0
    # Badges
    badges: List[str] = []  # List of badge types
    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ExecutorProfileCreate(BaseModel):
    bio: Optional[str] = None
    skills: List[Union[str, Dict[str, Any]]] = []
    experience_years: Optional[int] = None
    hourly_rate: Optional[float] = None
    fixed_price_packages: List[Dict[str, Any]] = []
    minimum_order: Optional[float] = None
    travel_fee: Optional[float] = None
    emergency_fee_percent: Optional[float] = None
    portfolio_photos: List[str] = []
    certifications: List[str] = []
    languages: List[str] = []
    tools_equipment: List[str] = []
    availability: Optional[str] = None
    buffer_time_minutes: int = 30
    service_zones: List[str] = []
    service_radius_km: Optional[float] = None
    service_cities: List[str] = []
    service_zip_codes: List[str] = []
    latitude: Optional[float] = None
    longitude: Optional[float] = None
class ExecutorProfileUpdate(BaseModel):
    bio: Optional[str] = None
    # Skills can be plain strings (legacy) or rich objects {id, category_id, name, hourly_rate, status}
    skills: Optional[List[Union[str, Dict[str, Any]]]] = None
    experience_years: Optional[int] = None
    hourly_rate: Optional[float] = None
    fixed_price_packages: Optional[List[Dict[str, Any]]] = None
    minimum_order: Optional[float] = None
    travel_fee: Optional[float] = None
    emergency_fee_percent: Optional[float] = None
    portfolio_photos: Optional[List[str]] = None
    certifications: Optional[List[str]] = None
    languages: Optional[List[str]] = None
    tools_equipment: Optional[List[str]] = None
    availability: Optional[str] = None
    buffer_time_minutes: Optional[int] = None
    service_zones: Optional[List[str]] = None
    service_radius_km: Optional[float] = None
    service_cities: Optional[List[str]] = None
    service_zip_codes: Optional[List[str]] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
# ==================== VERIFICATION & DOCUMENTS ====================

class TaskerDocument(BaseModel):
    document_id: str
    user_id: str
    document_type: str  # id_card, passport, insurance, certificate, etc.
    file_url: Optional[str] = None  # URL or base64
    file_data: Optional[str] = None  # base64 data
    status: str = "pending"  # pending, approved, rejected, expired
    expiry_date: Optional[datetime] = None
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TaskerDocumentCreate(BaseModel):
    document_type: str
    file_data: str  # base64
    expiry_date: Optional[str] = None

class TaskerBadge(BaseModel):
    badge_id: str
    user_id: str
    badge_type: str  # verified, top_rated, elite, etc.
    awarded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    awarded_by: Optional[str] = None  # admin user_id
    expires_at: Optional[datetime] = None
    is_active: bool = True

class TaskerBadgeCreate(BaseModel):
    user_id: str
    badge_type: str
    expires_at: Optional[str] = None

# ==================== COMMISSION CONFIGURATION ====================

class CommissionRule(BaseModel):
    rule_id: str
    name: str
    commission_type: str = "percentage"  # percentage or fixed
    commission_value: float  # % or fixed amount
    # Scope - which rule applies
    is_global: bool = False
    category: Optional[str] = None
    subcategory: Optional[str] = None
    city: Optional[str] = None
    campaign_id: Optional[str] = None
    tasker_tier: Optional[str] = None  # new, standard, elite
    # Priority (higher = more specific)
    priority: int = 0
    is_active: bool = True
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CommissionRuleCreate(BaseModel):
    name: str
    commission_type: str = "percentage"
    commission_value: float
    is_global: bool = False
    category: Optional[str] = None
    subcategory: Optional[str] = None
    city: Optional[str] = None
    campaign_id: Optional[str] = None
    tasker_tier: Optional[str] = None
    priority: int = 0
    valid_from: Optional[str] = None
    valid_until: Optional[str] = None

# ==================== PAYOUT SYSTEM ====================

class PayoutAccount(BaseModel):
    account_id: str
    user_id: str
    account_type: str = "bank"  # bank, card, stripe_connect
    # Common
    account_holder_name: Optional[str] = None
    # Bank fields
    bank_name: Optional[str] = None
    account_number_last4: Optional[str] = None
    routing_number: Optional[str] = None
    # Debit card fields
    card_brand: Optional[str] = None  # visa, mastercard, amex, discover
    card_last4: Optional[str] = None
    card_exp_month: Optional[int] = None
    card_exp_year: Optional[int] = None
    stripe_account_id: Optional[str] = None
    stripe_external_account_id: Optional[str] = None
    is_default: bool = True
    is_verified: bool = False
    verification_status: str = "pending"  # pending, verified, failed
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PayoutAccountCreate(BaseModel):
    account_type: str = "bank"  # bank or card
    account_holder_name: Optional[str] = None
    # Bank
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    routing_number: Optional[str] = None
    # Card
    card_number: Optional[str] = None
    card_exp_month: Optional[int] = None
    card_exp_year: Optional[int] = None
    card_cvc: Optional[str] = None

class Payout(BaseModel):
    payout_id: str
    user_id: str
    payout_account_id: str
    amount: float
    currency: str = "USD"
    status: str = "pending"  # pending, processing, completed, failed, on_hold
    job_ids: List[str] = []  # Related job/task IDs
    commission_deducted: float = 0
    net_amount: float = 0
    scheduled_date: Optional[datetime] = None
    processed_at: Optional[datetime] = None
    failure_reason: Optional[str] = None
    stripe_payout_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PayoutCreate(BaseModel):
    user_id: str
    amount: float
    job_ids: List[str] = []

# ==================== REFUND SYSTEM ====================

class Refund(BaseModel):
    refund_id: str
    booking_id: str
    user_id: str  # Who requested
    amount: float
    reason: str
    status: str = "requested"  # requested, approved, processing, completed, rejected
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    processed_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    stripe_refund_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RefundCreate(BaseModel):
    booking_id: str
    amount: float
    reason: str

# ==================== JOB STATUS HISTORY ====================

class JobStatusHistory(BaseModel):
    history_id: str
    job_id: str  # task_id or booking_id
    job_type: str = "task"  # task or booking
    old_status: Optional[str] = None
    new_status: str
    changed_by: str  # user_id
    change_reason: Optional[str] = None
    metadata: Dict[str, Any] = {}
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ==================== INVOICE SYSTEM ====================

class Invoice(BaseModel):
    invoice_id: str
    booking_id: str
    client_id: str
    tasker_id: str
    # Breakdown
    base_price: float
    platform_commission: float
    service_fee: float
    tax_amount: float = 0
    tip_amount: float = 0
    discount_amount: float = 0
    total_amount: float
    # Payment info
    payment_status: str = "pending"
    payment_method: Optional[str] = None
    paid_at: Optional[datetime] = None
    # Invoice details
    invoice_number: str
    invoice_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    due_date: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AvailabilitySlot(BaseModel):
    slot_id: str
    user_id: str  # executor user_id
    day_of_week: int  # 0=Monday, 6=Sunday
    start_time: str  # HH:MM format
    end_time: str  # HH:MM format
    location: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AvailabilitySlotCreate(BaseModel):
    day_of_week: int
    start_time: str
    end_time: str
    location: Optional[str] = None

class AvailabilitySlotUpdate(BaseModel):
    day_of_week: Optional[int] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    location: Optional[str] = None
    is_active: Optional[bool] = None

class Settings(BaseModel):
    setting_id: str = "app_settings"
    # API Keys
    stripe_api_key: Optional[str] = None
    stripe_webhook_secret: Optional[str] = None
    telegram_bot_token: Optional[str] = None
    ai_enabled: bool = False


    # ===== CLIENT SETTINGS =====
    allow_client_executor_selection: bool = True  # Client can choose tasker
    show_executor_ratings_to_client: bool = True  # Show ratings
    allow_client_reviews: bool = True  # Can leave reviews
    show_executor_phone_to_client: bool = False  # Show tasker phone
    show_pricing_to_client: bool = True  # Show prices
    allow_offers_mode: bool = True  # Allow "Get Offers" option
    show_tasker_location: bool = True  # Show tasker location on map

    # ===== TASKER/EXECUTOR SETTINGS =====
    show_client_phone_to_executor: bool = True  # Show client phone
    allow_executor_price_change: bool = True  # Can propose different price
    show_task_address_to_executor: bool = True  # Show address before accept
    allow_tasker_decline: bool = True  # Can decline tasks
    show_client_name_before_accept: bool = True  # Show client name

    # ===== PAYMENT SETTINGS =====
    enable_stripe_payments: bool = False  # Enable Stripe
    use_payment_hold: bool = False  # Use hold/capture vs direct charge
    enable_tips: bool = True  # Allow tips
    min_tip_amount: float = 1.0
    max_tip_percent: float = 30.0
    enable_stripe_connect: bool = False  # Tasker payouts via Connect
    instant_payout_enabled: bool = False  # Instant payouts
    payout_delay_days: int = 3  # Days before payout

    # ===== COMMISSION & FEES =====
    apply_admin_commission: bool = True
    admin_commission_percentage: float = 15.0  # Platform fee %
    fixed_booking_fee: float = 0.0  # Fixed fee per booking
    minimum_task_price: float = 20.0
    cancellation_fee_percent: float = 10.0  # Cancellation penalty

    # ===== MATCHING SETTINGS =====
    default_search_radius_km: float = 25.0
    max_search_radius_km: float = 100.0
    enable_geo_matching: bool = True
    priority_verified_taskers: bool = True
    show_tasker_distance: bool = True

    # ===== DISPLAY SETTINGS =====
    default_language: str = "en"  # en, es, uk
    currency: str = "USD"
    currency_symbol: str = "$"
    date_format: str = "DD.MM.YYYY"
    time_format: str = "24h"  # 12h or 24h

    # ===== LANGUAGE SETTINGS =====
    available_languages: List[str] = ["en", "es", "uk"]
    enable_geolocation_language: bool = False

    # ===== PAYMENT METHODS =====
    payment_methods_enabled: Dict[str, bool] = {"stripe": False, "zelle": False, "venmo": False}
    stripe_public_key: Optional[str] = None
    stripe_secret_key: Optional[str] = None
    zelle_instructions: Optional[str] = None
    venmo_instructions: Optional[str] = None

    # ===== FIREBASE PUSH =====
    firebase_server_key: Optional[str] = None
    firebase_project_id: Optional[str] = None

    # ===== MODERATION =====
    require_profile_approval: bool = False
    require_id_verification: bool = False
    auto_approve_taskers: bool = True
    enable_dispute_system: bool = True

    # ===== NOTIFICATIONS =====
    send_email_notifications: bool = True
    send_push_notifications: bool = True
    send_sms_notifications: bool = False

    # ===== EXECUTOR LISTING SETTINGS (Admin controls) =====
    executor_listing_sort: str = "recommended"
    executor_min_rating: float = 0.0
    executor_min_tasks: int = 0
    executor_max_price: float = 0.0
    executor_verified_only: bool = False
    executor_show_new: bool = True

    # ===== PHOTO STORAGE SETTINGS =====
    photo_storage_path: str = "./task_photos"   # Local disk path for saved photos
    photo_auto_cleanup_enabled: bool = False    # Enable automatic cleanup
    photo_retention_days: int = 180             # Delete/archive after N days (30/90/180/365)
    photo_cleanup_action: str = "delete"        # "delete" | "archive" (move to zip on disk)
    photo_archive_path: str = "./task_photos_archive"  # Where to archive old photos
    photo_max_size_mb: float = 5.0             # Max size per photo (MB)
    photo_cleanup_last_run: Optional[datetime] = None

    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SettingsUpdate(BaseModel):
    # API Keys
    stripe_api_key: Optional[str] = None
    stripe_webhook_secret: Optional[str] = None
    telegram_bot_token: Optional[str] = None
    ai_enabled: Optional[bool] = None

    # Client settings
    allow_client_executor_selection: Optional[bool] = None
    show_executor_ratings_to_client: Optional[bool] = None
    allow_client_reviews: Optional[bool] = None
    show_executor_phone_to_client: Optional[bool] = None
    show_pricing_to_client: Optional[bool] = None
    allow_offers_mode: Optional[bool] = None
    show_tasker_location: Optional[bool] = None

    # Tasker settings
    show_client_phone_to_executor: Optional[bool] = None
    allow_executor_price_change: Optional[bool] = None
    show_task_address_to_executor: Optional[bool] = None
    allow_tasker_decline: Optional[bool] = None
    show_client_name_before_accept: Optional[bool] = None

    # Payment settings
    enable_stripe_payments: Optional[bool] = None
    use_payment_hold: Optional[bool] = None
    enable_tips: Optional[bool] = None
    min_tip_amount: Optional[float] = None
    max_tip_percent: Optional[float] = None
    enable_stripe_connect: Optional[bool] = None
    instant_payout_enabled: Optional[bool] = None
    payout_delay_days: Optional[int] = None

    # Commission & Fees
    apply_admin_commission: Optional[bool] = None
    admin_commission_percentage: Optional[float] = None
    fixed_booking_fee: Optional[float] = None
    minimum_task_price: Optional[float] = None
    cancellation_fee_percent: Optional[float] = None

    # Matching
    default_search_radius_km: Optional[float] = None
    max_search_radius_km: Optional[float] = None
    enable_geo_matching: Optional[bool] = None
    priority_verified_taskers: Optional[bool] = None
    show_tasker_distance: Optional[bool] = None

    # Display
    default_language: Optional[str] = None
    currency: Optional[str] = None
    currency_symbol: Optional[str] = None
    date_format: Optional[str] = None
    time_format: Optional[str] = None

    # Language Settings
    available_languages: Optional[List[str]] = None  # ['en', 'es', 'uk']
    enable_geolocation_language: Optional[bool] = None

    # Payment Methods
    payment_methods_enabled: Optional[Dict[str, bool]] = None  # {'stripe': true, 'zelle': true, 'venmo': true}
    stripe_public_key: Optional[str] = None
    stripe_secret_key: Optional[str] = None
    zelle_instructions: Optional[str] = None
    venmo_instructions: Optional[str] = None

    # Firebase Push Notifications
    firebase_server_key: Optional[str] = None
    firebase_project_id: Optional[str] = None

    # Moderation
    require_profile_approval: Optional[bool] = None
    require_id_verification: Optional[bool] = None
    auto_approve_taskers: Optional[bool] = None
    enable_dispute_system: Optional[bool] = None

    # Notifications
    send_email_notifications: Optional[bool] = None
    send_push_notifications: Optional[bool] = None
    send_sms_notifications: Optional[bool] = None
    # Executor listing controls
    executor_listing_sort: Optional[str] = None
    executor_min_rating: Optional[float] = None
    executor_min_tasks: Optional[int] = None
    executor_max_price: Optional[float] = None
    executor_verified_only: Optional[bool] = None
    executor_show_new: Optional[bool] = None
    # Photo storage controls
    photo_storage_path: Optional[str] = None
    photo_auto_cleanup_enabled: Optional[bool] = None
    photo_retention_days: Optional[int] = None
    photo_cleanup_action: Optional[str] = None
    photo_archive_path: Optional[str] = None
    photo_max_size_mb: Optional[float] = None

# Promo codes
class PromoCode(BaseModel):
    code_id: str
    code: str
    discount_type: str  # percent, fixed
    discount_value: float
    min_order_amount: Optional[float] = None
    max_uses: Optional[int] = None
    uses_count: int = 0
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PromoCodeCreate(BaseModel):
    code: str
    discount_type: str
    discount_value: float
    min_order_amount: Optional[float] = None
    max_uses: Optional[int] = None
    valid_from: Optional[str] = None
    valid_until: Optional[str] = None

# Dispute model
class Dispute(BaseModel):
    dispute_id: str
    booking_id: str
    raised_by: str  # user_id
    against: str  # user_id
    reason: str
    description: str
    status: str = "open"  # open, investigating, resolved, closed
    resolution: Optional[str] = None
    refund_amount: Optional[float] = None
    admin_notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    resolved_at: Optional[datetime] = None

class DisputeCreate(BaseModel):
    booking_id: str
    reason: str
    description: str

# ==================== CMS MODELS ====================

class CMSContentType(str, Enum):
    PAGE = "page"
    FAQ = "faq"
    BLOG_POST = "blog_post"
    ANNOUNCEMENT = "announcement"
    HELP_ARTICLE = "help_article"

class CMSContent(BaseModel):
    content_id: str
    content_type: str  # page, faq, blog_post, announcement
    slug: str  # URL-friendly identifier
    title: str
    title_uk: Optional[str] = None  # Ukrainian translation
    content: str  # HTML or Markdown
    content_uk: Optional[str] = None
    excerpt: Optional[str] = None
    featured_image: Optional[str] = None
    category: Optional[str] = None
    tags: List[str] = []
    author_id: Optional[str] = None
    is_published: bool = False
    is_featured: bool = False
    sort_order: int = 0
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    view_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    published_at: Optional[datetime] = None

class CMSContentCreate(BaseModel):
    content_type: str
    slug: str
    title: str
    title_uk: Optional[str] = None
    content: str
    content_uk: Optional[str] = None
    excerpt: Optional[str] = None
    featured_image: Optional[str] = None
    category: Optional[str] = None
    tags: List[str] = []
    is_published: bool = False
    is_featured: bool = False
    sort_order: int = 0
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None

class CMSContentUpdate(BaseModel):
    title: Optional[str] = None
    title_uk: Optional[str] = None
    content: Optional[str] = None
    content_uk: Optional[str] = None
    excerpt: Optional[str] = None
    featured_image: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    is_published: Optional[bool] = None
    is_featured: Optional[bool] = None
    sort_order: Optional[int] = None
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None

class FAQItem(BaseModel):
    faq_id: str
    question: str
    question_uk: Optional[str] = None
    answer: str
    answer_uk: Optional[str] = None
    category: Optional[str] = None  # general, payments, services, account
    sort_order: int = 0
    is_published: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class FAQCreate(BaseModel):
    question: str
    question_uk: Optional[str] = None
    answer: str
    answer_uk: Optional[str] = None
    category: Optional[str] = None
    sort_order: int = 0
    is_published: bool = True

class PaymentTransaction(BaseModel):
    transaction_id: str
    booking_id: str
    user_id: str
    amount: float
    currency: str
    session_id: str
    payment_status: str  # pending, paid, failed, expired
    metadata: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ==================== NOTIFICATIONS ====================

class NotificationType(str, Enum):
    BOOKING_CREATED = "booking_created"
    BOOKING_ASSIGNED = "booking_assigned"
    BOOKING_ACCEPTED = "booking_accepted"
    BOOKING_STARTED = "booking_started"
    BOOKING_COMPLETED = "booking_completed"
    BOOKING_CANCELLED = "booking_cancelled"
    TASK_ASSIGNED = "task_assigned"
    TASK_UPDATED = "task_updated"
    NEW_MESSAGE = "new_message"
    PAYMENT_RECEIVED = "payment_received"
    PAYOUT_COMPLETED = "payout_completed"
    DOCUMENT_APPROVED = "document_approved"
    DOCUMENT_REJECTED = "document_rejected"
    REVIEW_RECEIVED = "review_received"
    SYSTEM = "system"

class Notification(BaseModel):
    notification_id: str
    user_id: str
    notification_type: str
    title: str
    message: str
    related_id: Optional[str] = None  # booking_id, task_id, etc.
    related_type: Optional[str] = None  # booking, task, message
    is_read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ==================== BLOG / COMMUNITY FEED ====================

class BlogPost(BaseModel):
    post_id: str
    author_id: str
    author_role: str  # client / provider / admin
    author_name: Optional[str] = None
    author_avatar: Optional[str] = None
    title: str
    description: str
    images: List[str] = []  # base64 data URLs or remote URLs
    tags: List[str] = []
    category: Optional[str] = None  # e.g. cleaning, plumbing — for filtering
    booking_id: Optional[str] = None  # optional link to a completed booking
    likes_count: int = 0
    comments_count: int = 0
    is_published: bool = True
    is_pinned: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None


class BlogPostCreate(BaseModel):
    title: str
    description: str
    images: List[str] = []
    tags: List[str] = []
    category: Optional[str] = None
    booking_id: Optional[str] = None


class BlogComment(BaseModel):
    comment_id: str
    post_id: str
    author_id: str
    author_name: Optional[str] = None
    author_avatar: Optional[str] = None
    text: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class BlogCommentCreate(BaseModel):
    text: str


class NotificationCreate(BaseModel):
    user_id: str
    notification_type: str
    title: str
    message: str
    related_id: Optional[str] = None
    related_type: Optional[str] = None

# ==================== GEOFENCING / SERVICE ZONES ====================

class ServiceZone(BaseModel):
    zone_id: str
    name: str
    description: Optional[str] = None
    # Polygon coordinates (list of [lat, lng] pairs)
    coordinates: List[List[float]]  # [[lat1, lng1], [lat2, lng2], ...]
    # Center point for display
    center_lat: float
    center_lng: float
    # Zone settings
    is_active: bool = True
    service_fee_multiplier: float = 1.0  # 1.0 = normal, 1.5 = 50% higher
    min_order_amount: float = 0
    max_distance_km: float = 50  # Max distance tasker can travel
    # Stats
    active_taskers: int = 0
    color: str = "#22c55e"  # For map display
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ServiceZoneCreate(BaseModel):
    name: str
    description: Optional[str] = None
    coordinates: List[List[float]]
    center_lat: float
    center_lng: float
    service_fee_multiplier: float = 1.0
    min_order_amount: float = 0
    max_distance_km: float = 50
    color: str = "#22c55e"

class ServiceZoneUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    coordinates: Optional[List[List[float]]] = None
    center_lat: Optional[float] = None
    center_lng: Optional[float] = None
    is_active: Optional[bool] = None
    service_fee_multiplier: Optional[float] = None
    min_order_amount: Optional[float] = None
    max_distance_km: Optional[float] = None
    color: Optional[str] = None

# ==================== INVOICE ENHANCED ====================

class InvoiceCreate(BaseModel):
    booking_id: str
    notes: Optional[str] = None
    additional_charges: Optional[float] = 0
    additional_charges_description: Optional[str] = None
    # New fields
    hours_worked: Optional[float] = None        # e.g. 1.25 = 1h 15min
    materials_cost: Optional[float] = 0.0
    materials_description: Optional[str] = None
    closing_message: Optional[str] = None
    ongoing_job: Optional[bool] = False
    client_review_rating: Optional[float] = None   # provider rates client (1-5)
    client_review_comment: Optional[str] = None

class InvoiceLineItem(BaseModel):
    description: str
    quantity: float = 1
    unit_price: float
    total: float

# Helper functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))

async def get_current_user(authorization: Optional[str] = Header(None), request: Request = None) -> User:
    """Get current user from session token (cookie or header)"""
    session_token = None

    # Try to get from cookie first
    if request:
        session_token = request.cookies.get("session_token")

    # Fallback to Authorization header
    if not session_token and authorization:
        if authorization.startswith("Bearer "):
            session_token = authorization.replace("Bearer ", "")

    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Find session in database
    session_doc = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")

    # Check expiry
    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")

    # Get user
    user_doc = await db.users.find_one({"user_id": session_doc["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")

    user = User(**user_doc)

    # Check if user is blocked
    if user.is_blocked:
        # Check if temporary block expired
        if user.blocked_until:
            blocked_until = user.blocked_until
            if isinstance(blocked_until, str):
                blocked_until = datetime.fromisoformat(blocked_until)
            if blocked_until.tzinfo is None:
                blocked_until = blocked_until.replace(tzinfo=timezone.utc)

            if blocked_until < datetime.now(timezone.utc):
                # Unblock automatically
                await db.users.update_one(
                    {"user_id": user.user_id},
                    {"$set": {"is_blocked": False, "blocked_until": None, "blocked_reason": None}}
                )
                user.is_blocked = False
            else:
                raise HTTPException(
                    status_code=403,
                    detail=f"Account blocked until {blocked_until.isoformat()}. Reason: {user.blocked_reason or 'Not specified'}"
                )
        else:
            # Permanent block
            raise HTTPException(
                status_code=403,
                detail=f"Account permanently blocked. Reason: {user.blocked_reason or 'Not specified'}"
            )

    return user


async def get_current_user_optional(
    authorization: Optional[str] = Header(None),
    request: Request = None,
) -> Optional[User]:
    """Return the current user if a valid session is present, otherwise None.

    Use for public-but-personalized endpoints (e.g. landing-page executor list)
    that must work for guests without raising 401.
    """
    try:
        return await get_current_user(authorization=authorization, request=request)
    except HTTPException:
        return None


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

async def require_admin_or_support(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in (UserRole.ADMIN, UserRole.SUPPORT):
        raise HTTPException(status_code=403, detail="Admin or support access required")
    return current_user

async def get_settings() -> Settings:
    """Get app settings from database"""
    settings_doc = await db.settings.find_one({"setting_id": "app_settings"}, {"_id": 0})
    if not settings_doc:
        # Create default settings
        default_settings = Settings()
        await db.settings.insert_one(default_settings.dict())
        return default_settings
    return Settings(**settings_doc)

async def send_telegram_notification(chat_id: str, message: str):
    """Send Telegram notification if configured"""
    try:
        settings = await get_settings()
        if not settings.telegram_bot_token:
            logger.warning("Telegram bot token not configured")
            return

        bot = Bot(token=settings.telegram_bot_token)
        await bot.send_message(chat_id=int(chat_id), text=message, parse_mode=ParseMode.MARKDOWN)
        logger.info(f"Telegram notification sent to {chat_id}")
    except Exception as e:
        logger.error(f"Failed to send Telegram notification: {str(e)}")

async def create_notification(
    user_id: str,
    notification_type: str,
    title: str,
    message: str,
    related_id: Optional[str] = None,
    related_type: Optional[str] = None
):
    """Create an in-app notification for a user"""
    notification = Notification(
        notification_id=f"notif_{uuid.uuid4().hex[:12]}",
        user_id=user_id,
        notification_type=notification_type,
        title=title,
        message=message,
        related_id=related_id,
        related_type=related_type
    )
    await db.notifications.insert_one(notification.dict())
    return notification


# ==================== EMAIL / SMS DELIVERY ====================

async def _get_integration_keys() -> Dict[str, Any]:
    """Read admin-managed integration keys from DB. Returns {} if not configured."""
    try:
        doc = await db.integration_keys.find_one({"setting_id": "integration_keys"}, {"_id": 0})
        return doc or {}
    except Exception:
        return {}


async def _send_email_sendgrid(to_email: str, subject: str, body_text: str) -> bool:
    """Send an email via SendGrid. Returns True on success, False on any failure.
    Never raises — notifications must not break the main request flow."""
    if not to_email:
        return False
    keys = await _get_integration_keys()
    if not keys.get("enable_email_notifications", True):
        return False
    api_key = keys.get("sendgrid_api_key")
    from_email = keys.get("sendgrid_from_email")
    if not api_key or not from_email:
        logger.info("SendGrid not configured — skipping email to %s", to_email)
        return False
    try:
        async with httpx.AsyncClient(timeout=10.0) as http:
            r = await http.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "personalizations": [{"to": [{"email": to_email}], "subject": subject}],
                    "from": {"email": from_email, "name": "HandyHub"},
                    "content": [{"type": "text/plain", "value": body_text}],
                },
            )
        if r.status_code >= 400:
            logger.warning("SendGrid email failed %s: %s", r.status_code, r.text[:200])
            return False
        logger.info("SendGrid email sent to %s", to_email)
        return True
    except Exception as e:
        logger.warning("SendGrid email error: %s", e)
        return False


async def _send_email_resend(to_email: str, subject: str, body_text: str) -> bool:
    """Send an email via Resend (https://api.resend.com/emails). Returns True on success."""
    if not to_email:
        return False
    keys = await _get_integration_keys()
    api_key = keys.get("resend_api_key")
    from_email = keys.get("resend_from_email") or "onboarding@resend.dev"
    if not api_key:
        logger.info("Resend not configured — skipping email to %s", to_email)
        return False
    html = "<p>" + (body_text or "").replace("\n", "<br>") + "</p>"
    try:
        async with httpx.AsyncClient(timeout=10.0) as http:
            r = await http.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={"from": from_email, "to": [to_email], "subject": subject, "text": body_text, "html": html},
            )
        if r.status_code >= 400:
            logger.warning("Resend email failed %s: %s", r.status_code, r.text[:300])
            return False
        logger.info("Resend email sent to %s", to_email)
        return True
    except Exception as e:
        logger.warning("Resend email error: %s", e)
        return False


async def _send_email(to_email: str, subject: str, body_text: str) -> bool:
    """Unified email sender. Provider selectable in admin (email_provider), Resend is default.
    Falls back to the other provider if the preferred one isn't configured."""
    keys = await _get_integration_keys()
    if not keys.get("enable_email_notifications", True):
        return False
    provider = (keys.get("email_provider") or "resend").lower()
    order = ["resend", "sendgrid"] if provider != "sendgrid" else ["sendgrid", "resend"]
    for p in order:
        if p == "resend" and keys.get("resend_api_key"):
            if await _send_email_resend(to_email, subject, body_text):
                return True
        elif p == "sendgrid" and keys.get("sendgrid_api_key") and keys.get("sendgrid_from_email"):
            if await _send_email_sendgrid(to_email, subject, body_text):
                return True
    logger.info("No email provider sent message to %s (provider=%s)", to_email, provider)
    return False


async def _send_sms_twilio(to_phone: str, body: str) -> Tuple[bool, Optional[str]]:
    """Send an SMS via Twilio. Returns (success, error_message).
    error_message is a human-readable reason when success is False, else None."""
    if not to_phone:
        return False, "Phone number not provided"
    keys = await _get_integration_keys()
    if not keys.get("enable_sms_notifications", True):
        return False, "SMS notifications are disabled in admin settings"
    sid = keys.get("twilio_account_sid")
    token = keys.get("twilio_auth_token")
    from_phone = keys.get("twilio_from_phone")
    if not sid or not token or not from_phone:
        logger.info("Twilio not configured — skipping SMS to %s", to_phone)
        return False, "Twilio is not configured (set Account SID, Auth Token, and sender number in admin)"
    # Twilio requires E.164 format (e.g. +14155551234)
    if not to_phone.strip().startswith("+"):
        return False, "Number must be in E.164 format, e.g. +14155551234"
    try:
        async with httpx.AsyncClient(timeout=10.0, auth=(sid, token)) as http:
            r = await http.post(
                f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json",
                data={"From": from_phone, "To": to_phone, "Body": body[:1500]},
            )
        if r.status_code >= 400:
            logger.warning("Twilio SMS failed %s: %s", r.status_code, r.text[:400])
            # Surface the real Twilio reason to the caller
            err_msg = f"Twilio error {r.status_code}"
            try:
                data = r.json()
                tw_code = data.get("code")
                tw_message = data.get("message") or ""
                if tw_code == 21608:
                    err_msg = ("A Twilio trial account can only send SMS to numbers verified "
                               "in the Twilio Console (Verified Caller IDs). Add the number or upgrade the account.")
                elif tw_code == 21211:
                    err_msg = "Invalid number format. Use E.164, e.g. +14155551234"
                elif tw_code == 21408 or tw_code == 21610:
                    err_msg = "Twilio cannot send SMS to this number/region (check Geo Permissions)"
                elif tw_message:
                    err_msg = f"Twilio: {tw_message}"
            except Exception:
                pass
            return False, err_msg
        logger.info("Twilio SMS sent to %s", to_phone)
        return True, None
    except Exception as e:
        logger.warning("Twilio SMS error: %s", e)
        return False, f"Twilio connection error: {e}"


async def _send_web_push_one(subscription: Dict[str, Any], payload: Dict[str, Any], vapid_priv: str, vapid_subject: str) -> bool:
    """Send a single web push. Returns True on success."""
    if not _PUSH_AVAILABLE:
        return False
    try:
        # pywebpush is synchronous — run in a thread so we don't block the loop
        await asyncio.to_thread(
            webpush,
            subscription_info={
                "endpoint": subscription["endpoint"],
                "keys": {"p256dh": subscription["p256dh"], "auth": subscription["auth"]},
            },
            data=json.dumps(payload),
            vapid_private_key=vapid_priv,
            vapid_claims={"sub": vapid_subject if vapid_subject.startswith("mailto:") else f"mailto:{vapid_subject}"},
        )
        return True
    except WebPushException as e:
        # 404/410 = subscription expired/invalid → caller should delete it
        status = getattr(getattr(e, "response", None), "status_code", None)
        logger.info("WebPush failed (status=%s) for %s: %s", status, subscription.get("endpoint", "")[:50], e)
        if status in (404, 410):
            try:
                await db.push_subscriptions.delete_one({"endpoint": subscription["endpoint"]})
            except Exception:
                pass
        return False
    except Exception as e:
        logger.warning("WebPush unexpected error: %s", e)
        return False


async def _send_web_push(user_id: str, title: str, body: str, url: Optional[str] = None) -> int:
    """Send web push to all of a user's subscribed devices. Returns count sent."""
    if not _PUSH_AVAILABLE:
        return 0
    keys = await _get_integration_keys()
    if not keys.get("enable_push_notifications", True):
        return 0
    vapid_priv = keys.get("vapid_private_key")
    vapid_subject = keys.get("vapid_subject_email") or "admin@handyhub.com"
    if not vapid_priv:
        logger.info("VAPID private key not set — skipping push for %s", user_id)
        return 0
    subs = await db.push_subscriptions.find({"user_id": user_id}, {"_id": 0}).to_list(50)
    if not subs:
        return 0
    payload = {"title": title, "body": body, "url": url or "/", "ts": int(datetime.now(timezone.utc).timestamp() * 1000)}
    sent = 0
    for s in subs:
        ok = await _send_web_push_one(s, payload, vapid_priv, vapid_subject)
        if ok:
            sent += 1
    return sent


async def notify_user(
    user_id: str,
    notification_type: str,
    title: str,
    message: str,
    related_id: Optional[str] = None,
    related_type: Optional[str] = None,
    channels: Optional[List[str]] = None,
):
    """Multi-channel notification: in-app + email + SMS (best-effort).
    `channels` defaults to ['inapp', 'email', 'sms']. Fails silently per channel."""
    channels = channels or ["inapp", "email", "sms", "push"]
    # 1. In-app (always)
    if "inapp" in channels:
        try:
            await create_notification(user_id, notification_type, title, message, related_id, related_type)
        except Exception as e:
            logger.warning("In-app notification failed for %s: %s", user_id, e)
    # Lookup user contact info for email/SMS
    if "email" in channels or "sms" in channels:
        try:
            user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0, "email": 1, "phone": 1})
        except Exception:
            user_doc = None
        if user_doc:
            if "email" in channels and user_doc.get("email"):
                # don't await — fire-and-forget so the API request doesn't slow down
                asyncio.create_task(_send_email(user_doc["email"], title, message))
            if "sms" in channels and user_doc.get("phone"):
                asyncio.create_task(_send_sms_twilio(user_doc["phone"], f"{title}: {message}"))
    # Web push — fire-and-forget; routes notification to /notifications by default
    if "push" in channels:
        push_url = None
        if related_type == "booking" and related_id:
            push_url = f"/task-detail?id={related_id}"
        asyncio.create_task(_send_web_push(user_id, title, message, push_url))


# ==================== NOTIFICATION ROUTES ====================

@api_router.get("/notifications")
async def get_notifications(
    unread_only: bool = False,
    limit: int = 50,
    current_user: User = Depends(get_current_user)
):
    """Get user's notifications"""
    query = {"user_id": current_user.user_id}
    if unread_only:
        query["is_read"] = False

    notifications = await db.notifications.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return notifications

@api_router.get("/notifications/unread-count")
async def get_unread_notification_count(current_user: User = Depends(get_current_user)):
    """Get count of unread notifications"""
    count = await db.notifications.count_documents({
        "user_id": current_user.user_id,
        "is_read": False
    })
    return {"unread_count": count}

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user: User = Depends(get_current_user)):
    """Mark a notification as read"""
    result = await db.notifications.update_one(
        {"notification_id": notification_id, "user_id": current_user.user_id},
        {"$set": {"is_read": True}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"message": "Notification marked as read"}

@api_router.put("/notifications/read-all")
async def mark_all_notifications_read(current_user: User = Depends(get_current_user)):
    """Mark all notifications as read"""
    await db.notifications.update_many(
        {"user_id": current_user.user_id, "is_read": False},
        {"$set": {"is_read": True}}
    )
    return {"message": "All notifications marked as read"}

@api_router.delete("/notifications/{notification_id}")
async def delete_notification(notification_id: str, current_user: User = Depends(get_current_user)):
    """Delete a notification"""
    result = await db.notifications.delete_one({
        "notification_id": notification_id,
        "user_id": current_user.user_id
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"message": "Notification deleted"}

# ==================== CHAT CONVERSATION ROUTES ====================

@api_router.get("/conversations")
async def get_conversations(current_user: User = Depends(get_current_user)):
    """Get all conversations (grouped by other user)"""
    # Get all messages involving current user
    pipeline = [
        {"$match": {"$or": [
            {"from_user_id": current_user.user_id},
            {"to_user_id": current_user.user_id}
        ]}},
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": {
                "$cond": [
                    {"$eq": ["$from_user_id", current_user.user_id]},
                    "$to_user_id",
                    "$from_user_id"
                ]
            },
            "last_message": {"$first": "$$ROOT"},
            "unread_count": {
                "$sum": {
                    "$cond": [
                        {"$and": [
                            {"$eq": ["$to_user_id", current_user.user_id]},
                            {"$eq": ["$read", False]}
                        ]},
                        1,
                        0
                    ]
                }
            }
        }}
    ]

    conversations = await db.messages.aggregate(pipeline).to_list(50)

    # Enrich with user info
    result = []
    for conv in conversations:
        other_user_id = conv["_id"]
        other_user = await db.users.find_one(
            {"user_id": other_user_id},
            {"_id": 0, "password_hash": 0, "plain_password": 0}
        )
        if other_user:
            last_msg = conv["last_message"]
            del last_msg["_id"]
            result.append({
                "user": other_user,
                "last_message": last_msg,
                "unread_count": conv["unread_count"]
            })

    return JSONResponse(content=clean_bson(result))

@api_router.get("/conversations/{user_id}")
async def get_conversation_messages(
    user_id: str,
    limit: int = 100,
    current_user: User = Depends(get_current_user)
):
    """Get messages with a specific user"""
    messages = await db.messages.find(
        {"$or": [
            {"from_user_id": current_user.user_id, "to_user_id": user_id},
            {"from_user_id": user_id, "to_user_id": current_user.user_id}
        ]},
        {"_id": 0}
    ).sort("created_at", 1).to_list(limit)

    # Mark messages as read
    await db.messages.update_many(
        {"from_user_id": user_id, "to_user_id": current_user.user_id, "read": False},
        {"$set": {"read": True}}
    )

    return messages

# Authentication Routes
def _ci_email(email: str) -> Dict[str, Any]:
    """Case-insensitive exact-match query for an email (handles legacy mixed-case data)."""
    return {"email": {"$regex": f"^{re.escape((email or '').strip())}$", "$options": "i"}}

@api_router.post("/auth/register")
async def register(user_data: UserRegister):
    # Require accepted_terms
    if not user_data.accepted_terms:
        raise HTTPException(status_code=400, detail="You must accept the Terms of Use and Privacy Policy to register")
    # Normalize email (store lowercased for consistency)
    reg_email = (user_data.email or "").strip().lower()
    # Check if user exists (case-insensitive)
    existing_user = await db.users.find_one(_ci_email(reg_email))
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create user (unverified email)
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user = User(
        user_id=user_id,
        email=reg_email,
        name=user_data.name,
        role=user_data.role,
        phone=user_data.phone,
        password_hash=hash_password(user_data.password)
    )

    user_dict = user.dict()
    user_dict["plain_password"] = user_data.password
    user_dict["accepted_terms_at"] = datetime.now(timezone.utc)
    user_dict["accepted_terms_version"] = "2026-02-15"
    user_dict["email_verified"] = False

    await db.users.insert_one(user_dict)

    # Generate 6-digit verification code (valid 10 min)
    import random as _r
    code = f"{_r.randint(0, 999999):06d}"
    await db.email_verifications.delete_many(_ci_email(reg_email))
    await db.email_verifications.insert_one({
        "email": reg_email,
        "user_id": user_id,
        "code": code,
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10),
        "created_at": datetime.now(timezone.utc),
        "attempts": 0,
    })
    try:
        await _send_email(
            reg_email,
            "HandyHub — Email Verification",
            f"Welcome to HandyHub!\n\nYour verification code is: {code}\n\nThis code expires in 10 minutes.\n\nIf you did not sign up, ignore this email."
        )
    except Exception:
        pass

    # Create session
    session_token = f"session_{uuid.uuid4().hex}"
    session_data = {
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc)
    }
    await db.user_sessions.insert_one(session_data)

    # Prepare user response - convert to dict and handle datetime serialization
    user_response = {
        "user_id": user.user_id,
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "phone": user.phone,
        "picture": user.picture,
        "google_id": user.google_id,
        "telegram_chat_id": user.telegram_chat_id,
        "fcm_token": user.fcm_token,
        "is_blocked": user.is_blocked,
        "hidden_from_clients": user.hidden_from_clients,
        "blocked_until": user.blocked_until.isoformat() if user.blocked_until else None,
        "blocked_reason": user.blocked_reason,
        "blocked_by": user.blocked_by,
        "address": user.address,
        "latitude": user.latitude,
        "longitude": user.longitude,
        "stripe_customer_id": user.stripe_customer_id,
        "stripe_connect_account_id": user.stripe_connect_account_id,
        "payment_methods": user.payment_methods or [],
        "saved_addresses": user.saved_addresses or [],
        "email_verified": False,
        "phone_verified": False,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }

    return {
        "user": user_response,
        "session_token": session_token
    }

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    # Find user
    user_doc = await db.users.find_one(_ci_email(credentials.email), {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Verify password
    if not user_doc.get("password_hash") or not verify_password(credentials.password, user_doc["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user = User(**user_doc)

    # Create session
    session_token = f"session_{uuid.uuid4().hex}"
    session_data = {
        "user_id": user.user_id,
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc)
    }
    await db.user_sessions.insert_one(session_data)

    return {
        "user": user.dict(),
        "session_token": session_token
    }

@api_router.get("/auth/google")
async def google_auth_redirect(request: Request):
    """Redirect to Emergent Google OAuth"""
    # REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    redirect_url = f"{str(request.base_url)}auth-callback"

    return {"auth_url": auth_url}

@api_router.post("/auth/verify-email")
async def verify_email(payload: Dict[str, Any] = Body(...)):
    """Verify a user's email with the 6-digit code sent at registration.
    Body: {"email": "...", "code": "123456"}"""
    email = (payload.get("email") or "").strip().lower()
    code = (payload.get("code") or "").strip()
    if not email or not code:
        raise HTTPException(status_code=422, detail="email + code required")
    rec = await db.email_verifications.find_one(_ci_email(email))
    if not rec:
        raise HTTPException(status_code=400, detail="No verification pending")
    if rec.get("attempts", 0) >= 5:
        raise HTTPException(status_code=429, detail="Too many attempts. Request a new code.")
    exp = rec.get("expires_at")
    if exp:
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Code expired")
    if rec.get("code") != code:
        await db.email_verifications.update_one({"_id": rec["_id"]}, {"$inc": {"attempts": 1}})
        raise HTTPException(status_code=400, detail="Invalid code")
    if rec.get("user_id"):
        await db.users.update_one({"user_id": rec["user_id"]}, {"$set": {"email_verified": True, "email_verified_at": datetime.now(timezone.utc)}})
    else:
        await db.users.update_one(_ci_email(email), {"$set": {"email_verified": True, "email_verified_at": datetime.now(timezone.utc)}})
    await db.email_verifications.delete_many(_ci_email(email))
    return {"ok": True, "verified": True}


@api_router.post("/auth/resend-verification")
async def resend_verification(payload: Dict[str, Any] = Body(...)):
    """Resend the verification code (rate-limited via 60s cooldown).
    Body: {"email": "..."}"""
    email = (payload.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=422, detail="email required")
    user = await db.users.find_one(_ci_email(email), {"_id": 0, "user_id": 1, "email_verified": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("email_verified"):
        return {"ok": True, "already_verified": True}
    last = await db.email_verifications.find_one(_ci_email(email))
    if last and last.get("created_at"):
        created = last["created_at"]
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        if (datetime.now(timezone.utc) - created).total_seconds() < 60:
            raise HTTPException(status_code=429, detail="Please wait 60 seconds before requesting another code")
    import random as _r
    code = f"{_r.randint(0, 999999):06d}"
    await db.email_verifications.delete_many(_ci_email(email))
    await db.email_verifications.insert_one({
        "email": email, "user_id": user["user_id"], "code": code,
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10),
        "created_at": datetime.now(timezone.utc), "attempts": 0,
    })
    sent = False
    try:
        sent = await _send_email(email, "HandyHub — New Verification Code", f"Your new verification code is: {code}\n\nExpires in 10 minutes.")
    except Exception:
        pass
    return {"ok": True, "email_sent": sent}


@api_router.post("/auth/send-phone-code")
async def send_phone_code(payload: Dict[str, Any] = Body(default={}), current_user: User = Depends(get_current_user)):
    """Send a 6-digit SMS code to verify the current user's phone.
    Optional body: {"phone": "+1..."} to set/update the phone before sending. 60s cooldown."""
    phone = (payload.get("phone") or current_user.phone or "").strip()
    if not phone:
        raise HTTPException(status_code=422, detail="Phone number required")
    # If a new phone is provided, update the user record (and reset verified flag)
    if payload.get("phone") and payload["phone"].strip() != (current_user.phone or ""):
        await db.users.update_one({"user_id": current_user.user_id}, {"$set": {"phone": phone, "phone_verified": False}})
    # 60s cooldown
    last = await db.phone_verifications.find_one({"user_id": current_user.user_id})
    if last and last.get("created_at"):
        created = last["created_at"]
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        if (datetime.now(timezone.utc) - created).total_seconds() < 60:
            raise HTTPException(status_code=429, detail="Please wait 60 seconds before requesting another code")
    import random as _r
    code = f"{_r.randint(0, 999999):06d}"
    await db.phone_verifications.delete_many({"user_id": current_user.user_id})
    await db.phone_verifications.insert_one({
        "user_id": current_user.user_id, "phone": phone, "code": code,
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10),
        "created_at": datetime.now(timezone.utc), "attempts": 0,
    })
    sent, sms_error = await _send_sms_twilio(phone, f"HandyHub: your verification code is {code}. It expires in 10 minutes.")
    resp: Dict[str, Any] = {"ok": True, "sent": sent}
    if not sent and sms_error:
        resp["error"] = sms_error
    return resp


@api_router.post("/auth/verify-phone")
async def verify_phone(payload: Dict[str, Any] = Body(...), current_user: User = Depends(get_current_user)):
    """Verify the current user's phone with the 6-digit code. Body: {"code": "123456"}"""
    code = (payload.get("code") or "").strip()
    if not code:
        raise HTTPException(status_code=422, detail="code required")
    rec = await db.phone_verifications.find_one({"user_id": current_user.user_id})
    if not rec:
        raise HTTPException(status_code=400, detail="No verification pending")
    if rec.get("attempts", 0) >= 5:
        raise HTTPException(status_code=429, detail="Too many attempts. Request a new code.")
    exp = rec.get("expires_at")
    if exp:
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Code expired")
    if rec.get("code") != code:
        await db.phone_verifications.update_one({"_id": rec["_id"]}, {"$inc": {"attempts": 1}})
        raise HTTPException(status_code=400, detail="Invalid code")
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$set": {"phone_verified": True, "phone_verified_at": datetime.now(timezone.utc), "phone": rec.get("phone")}}
    )
    await db.phone_verifications.delete_many({"user_id": current_user.user_id})
    return {"ok": True, "verified": True}


@api_router.post("/auth/session")
async def create_session_from_oauth(session_id: str = Header(..., alias="X-Session-ID")):
    """Exchange OAuth session_id for user session.
    REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    """
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )

        if response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session ID")

        oauth_data = response.json()

    # Check if user exists
    user_doc = await db.users.find_one({"email": oauth_data["email"]}, {"_id": 0})

    if user_doc:
        # Update existing user (Google login)
        await db.users.update_one(
            {"user_id": user_doc["user_id"]},
            {"$set": {
                "name": oauth_data["name"],
                "picture": oauth_data["picture"],
                "google_id": oauth_data["id"]
            }}
        )
        user = User(**user_doc)
        is_new_user = False
    else:
        # New user — implicit acceptance of Terms on first Google sign-in (the
        # button on the frontend states the user agrees to Terms & Privacy)
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user = User(
            user_id=user_id,
            email=oauth_data["email"],
            name=oauth_data["name"],
            picture=oauth_data["picture"],
            google_id=oauth_data["id"],
            role=UserRole.CLIENT
        )
        user_dict = user.dict()
        user_dict["accepted_terms_at"] = datetime.now(timezone.utc)
        user_dict["accepted_terms_version"] = "2026-02-15"
        user_dict["accepted_terms_via"] = "google_oauth"
        await db.users.insert_one(user_dict)
        is_new_user = True

    # Create session
    session_token = oauth_data["session_token"]
    session_data = {
        "user_id": user.user_id,
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc)
    }
    await db.user_sessions.insert_one(session_data)

    return {
        "user": user.dict(),
        "session_token": session_token,
        "is_new_user": is_new_user
    }

@api_router.get("/auth/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user.dict()

@api_router.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(None), request: Request = None):
    session_token = None

    if request:
        session_token = request.cookies.get("session_token")

    if not session_token and authorization:
        if authorization.startswith("Bearer "):
            session_token = authorization.replace("Bearer ", "")

    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})

    return {"message": "Logged out successfully"}

# Service Routes
@api_router.get("/services")
async def get_services(category: Optional[ServiceCategory] = None, available: Optional[bool] = None):
    query = {}
    if category:
        query["category"] = category
    if available is not None:
        query["available"] = available

    services = await db.services.find(query, {"_id": 0}).to_list(100)
    return services

@api_router.get("/services/{service_id}")
async def get_service(service_id: str):
    service = await db.services.find_one({"service_id": service_id}, {"_id": 0})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    return service

@api_router.post("/services")
async def create_service(service_data: ServiceCreate, current_user: User = Depends(require_admin)):
    service_id = f"service_{uuid.uuid4().hex[:12]}"
    service = Service(
        service_id=service_id,
        **service_data.dict()
    )

    await db.services.insert_one(service.dict())
    return service.dict()

@api_router.put("/services/{service_id}")
async def update_service(service_id: str, service_data: ServiceCreate, current_user: User = Depends(require_admin)):
    result = await db.services.update_one(
        {"service_id": service_id},
        {"$set": service_data.dict(exclude_unset=True)}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Service not found")

    updated_service = await db.services.find_one({"service_id": service_id}, {"_id": 0})
    return updated_service

@api_router.delete("/services/{service_id}")
async def delete_service(service_id: str, current_user: User = Depends(require_admin)):
    result = await db.services.delete_one({"service_id": service_id})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Service not found")

    return {"message": "Service deleted successfully"}

# Booking Routes
@api_router.post("/bookings")
async def create_booking(booking_data: BookingCreate, current_user: User = Depends(get_current_user)):
    # Get service details
    service = None
    if booking_data.service_id:
        service = await db.services.find_one({"service_id": booking_data.service_id}, {"_id": 0})

    booking_id = f"booking_{uuid.uuid4().hex[:12]}"

    # Calculate price
    price = 0
    if service:
        price = service.get("base_price", 0) or service.get("price", 0)
    if booking_data.estimated_hours:
        price = price * booking_data.estimated_hours

    booking = Booking(
        booking_id=booking_id,
        client_id=current_user.user_id,
        service_id=booking_data.service_id,
        category=booking_data.category,
        title=booking_data.title,
        description=booking_data.description,
        date=booking_data.date,
        time=booking_data.time,
        address=booking_data.address,
        latitude=booking_data.latitude,
        longitude=booking_data.longitude,
        notes=booking_data.notes,
        problem_description=booking_data.problem_description,
        problem_photos=booking_data.problem_photos,
        estimated_hours=booking_data.estimated_hours,
        allow_offers=booking_data.allow_offers,
        total_price=price,
        # If client picked a specific provider, the booking starts in
        # pending_acceptance — provider must Accept before the client
        # sees it as "Accepted". Without a provider it remains POSTED.
        status=(BookingStatus.PENDING_ACCEPTANCE if booking_data.provider_id else BookingStatus.POSTED)
    )

    booking_dict = booking.dict()
    # Save extra fields not in Booking model
    booking_dict['city'] = booking_data.city
    booking_dict['provider_id'] = booking_data.provider_id
    booking_dict['provider_hourly_rate'] = booking_data.provider_hourly_rate
    booking_dict['urgency'] = booking_data.urgency
    booking_dict['problem_type'] = booking_data.problem_type
    booking_dict['tools_needed'] = booking_data.tools_needed
    booking_dict['flexible_date'] = booking_data.flexible_date
    booking_dict['preferred_time_range'] = booking_data.preferred_time_range
    booking_dict['promo_code'] = booking_data.promo_code
    if booking_data.total_price:
        booking_dict['total_price'] = booking_data.total_price

    await db.bookings.insert_one(booking_dict)

    # If client pre-selected a provider — apply commission, create task in
    # pending_acceptance, and notify
    if booking_data.provider_id:
        # Apply per-category commission so the booking's total_price equals
        # the marked-up client_total (executor_rate / (1 - commission/100))
        executor_rate = float(booking_data.provider_hourly_rate or price or 0)
        pricing = await compute_client_pricing(executor_rate, booking_data.category)
        client_total = pricing["client_total"]

        # Persist the snapshot on the booking
        await db.bookings.update_one(
            {"booking_id": booking_id},
            {"$set": {
                "total_price": client_total,
                "executor_rate": pricing["executor_rate"],
                "commission_rate_snapshot": pricing["commission_rate"],
                "commission_amount": pricing["commission_amount"],
                "platform_take": pricing["platform_take"],
                "executor_take": pricing["executor_take"],
            }}
        )
        booking_dict["total_price"] = client_total
        booking_dict["executor_take"] = pricing["executor_take"]
        booking_dict["platform_take"] = pricing["platform_take"]
        booking_dict["commission_rate_snapshot"] = pricing["commission_rate"]

        task_id = f"task_{uuid.uuid4().hex[:12]}"
        task_doc = {
            "task_id": task_id,
            "booking_id": booking_id,
            "client_id": current_user.user_id,
            "provider_id": booking_data.provider_id,
            "title": booking_data.title,
            "description": booking_data.description,
            "address": booking_data.address,
            "city": booking_data.city,
            "latitude": booking_data.latitude,
            "longitude": booking_data.longitude,
            "date": booking_data.date,
            "time": booking_data.time,
            # PENDING_ACCEPTANCE so the provider must explicitly Accept
            "status": "pending_acceptance",
            "provider_hourly_rate": booking_data.provider_hourly_rate,
            "total_price": client_total,
            "executor_take": pricing["executor_take"],
            "platform_take": pricing["platform_take"],
            "commission_rate_snapshot": pricing["commission_rate"],
            "photos": booking_data.problem_photos or [],
            "scheduled_date": booking_data.date,
            "scheduled_time": booking_data.time,
            "created_at": datetime.now(timezone.utc),
        }
        await db.tasks.insert_one(task_doc)

        # Notify the chosen provider that they have a pending task to accept
        await notify_user(
            booking_data.provider_id,
            "new_task_pending",
            "A new order is awaiting confirmation",
            f"You have a new order \"{booking_data.title}\" — please accept or decline it.",
            related_id=task_id,
            related_type="task",
        )

    booking_dict.pop("_id", None)
    return JSONResponse(content=clean_bson(booking_dict))

@api_router.get("/bookings")
async def get_bookings(current_user: User = Depends(get_current_user)):
    query = {}
    if current_user.role == UserRole.CLIENT:
        query["client_id"] = current_user.user_id
    elif current_user.role == UserRole.PROVIDER:
        query["provider_id"] = current_user.user_id
    # Admin sees all bookings

    # Exclude heavy base64 fields from list view to keep response small & fast
    # (problem_photos alone can be ~3.5 MB per booking)
    _booking_list_projection = {"_id": 0, "problem_photos": 0}
    bookings = await db.bookings.find(query, _booking_list_projection).sort("created_at", -1).to_list(100)

    if not bookings:
        return JSONResponse(content=[])

    # Batch-fetch related data to avoid N+1 queries
    # Collect all unique IDs
    service_ids = list({b["service_id"] for b in bookings if b.get("service_id")})
    user_ids = list({b["client_id"] for b in bookings} | {b["provider_id"] for b in bookings if b.get("provider_id")})
    booking_ids = [b["booking_id"] for b in bookings]

    # Batch queries (3 queries instead of N*4)
    _user_list_projection = {"_id": 0, "password_hash": 0, "picture": 0}
    services_list = await db.services.find({"service_id": {"$in": service_ids}}, {"_id": 0}).to_list(len(service_ids)) if service_ids else []
    users_list = await db.users.find({"user_id": {"$in": user_ids}}, _user_list_projection).to_list(len(user_ids))
    tasks_list = await db.tasks.find(
        {"booking_id": {"$in": booking_ids}},
        {"_id": 0, "task_id": 1, "status": 1, "title": 1, "provider_id": 1, "booking_id": 1}
    ).to_list(len(booking_ids))

    # Build lookup maps
    services_map = {s["service_id"]: s for s in services_list}
    users_map = {u["user_id"]: u for u in users_list}
    tasks_map = {t["booking_id"]: t for t in tasks_list}

    # Enrich bookings from maps (no more DB calls)
    for booking in bookings:
        booking["service"] = services_map.get(booking.get("service_id"))
        booking["client"] = users_map.get(booking.get("client_id"))
        booking["provider"] = users_map.get(booking.get("provider_id"))
        booking["task"] = tasks_map.get(booking["booking_id"])

    return JSONResponse(content=clean_bson(bookings))

@api_router.get("/bookings/{booking_id}")
async def get_booking(booking_id: str, current_user: User = Depends(get_current_user)):
    booking = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Check access
    if current_user.role != UserRole.ADMIN:
        if current_user.role == UserRole.CLIENT and booking["client_id"] != current_user.user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        if current_user.role == UserRole.PROVIDER and booking.get("provider_id") != current_user.user_id:
            raise HTTPException(status_code=403, detail="Access denied")

    # Enrich with all related data
    if booking.get("service_id"):
        service = await db.services.find_one({"service_id": booking["service_id"]}, {"_id": 0})
        booking["service"] = service
    else:
        booking["service"] = None
    client = await db.users.find_one({"user_id": booking["client_id"]}, {"_id": 0, "password_hash": 0})
    booking["client"] = client
    if booking.get("provider_id"):
        provider = await db.users.find_one({"user_id": booking["provider_id"]}, {"_id": 0, "password_hash": 0})
        booking["provider"] = provider
        # Get provider profile for ratings
        profile = await db.executor_profiles.find_one({"user_id": booking["provider_id"]}, {"_id": 0})
        booking["provider_profile"] = profile
    # Get reviews for this booking
    reviews = await db.reviews.find({"booking_id": booking_id}, {"_id": 0}).to_list(10)
    booking["reviews"] = reviews
    # Get linked task
    task = await db.tasks.find_one({"booking_id": booking_id}, {"_id": 0})
    booking["task"] = task

    return JSONResponse(content=clean_bson(booking))

@api_router.put("/bookings/{booking_id}")
async def update_booking(booking_id: str, status: BookingStatus, provider_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    booking = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    update_data = {"status": status}
    if provider_id and current_user.role == UserRole.ADMIN:
        update_data["provider_id"] = provider_id

    await db.bookings.update_one(
        {"booking_id": booking_id},
        {"$set": update_data}
    )

    # Send notification if provider assigned
    if provider_id:
        provider = await db.users.find_one({"user_id": provider_id}, {"_id": 0})
        if provider and provider.get("telegram_chat_id"):
            service = await db.services.find_one({"service_id": booking["service_id"]}, {"_id": 0})
            message = f"🔔 *New order!*\n\nService: {service['name']}\nDate: {booking['date']} at {booking['time']}\nAddress: {booking['address']}"
            await send_telegram_notification(provider["telegram_chat_id"], message)

    updated_booking = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    return updated_booking

class BookingAssign(BaseModel):
    provider_id: str
    due_date: Optional[str] = None
    due_time: Optional[str] = None
    custom_price: Optional[float] = None
    notes: Optional[str] = None

@api_router.post("/admin/bookings/{booking_id}/assign")
async def admin_assign_booking(
    booking_id: str,
    assign_data: BookingAssign,
    current_user: User = Depends(require_admin)
):
    """Admin assigns booking to executor and creates a task"""
    booking = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Get service info
    service = await db.services.find_one({"service_id": booking["service_id"]}, {"_id": 0})

    # Create task for executor
    task_id = f"task_{uuid.uuid4().hex[:12]}"
    task = Task(
        task_id=task_id,
        booking_id=booking_id,
        client_id=booking["client_id"],
        provider_id=assign_data.provider_id,
        title=f"Order: {service['name'] if service else 'Service'}",
        description=booking.get("problem_description") or booking.get("notes") or service.get("description", ""),
        status=TaskStatus.ASSIGNED,
        assigned_by=current_user.user_id,
        due_date=assign_data.due_date or booking["date"],
        due_time=assign_data.due_time or booking["time"],
        address=booking["address"],
        custom_price=assign_data.custom_price or booking["total_price"],
        notes=assign_data.notes
    )

    await db.tasks.insert_one(task.dict())

    # Update booking
    await db.bookings.update_one(
        {"booking_id": booking_id},
        {"$set": {
            "status": BookingStatus.ASSIGNED,
            "provider_id": assign_data.provider_id
        }}
    )

    # Send notification to executor
    provider = await db.users.find_one({"user_id": assign_data.provider_id}, {"_id": 0})
    if provider and provider.get("telegram_chat_id"):
        message = f"📋 *New task!*\n\nService: {service['name'] if service else 'Service'}\nDate: {booking['date']} at {booking['time']}\nAddress: {booking['address']}\nPrice: ${assign_data.custom_price or booking['total_price']}"
        await send_telegram_notification(provider["telegram_chat_id"], message)

    return {"message": "Booking assigned", "task_id": task_id, "booking_status": BookingStatus.ASSIGNED}

class BookingUpdate(BaseModel):
    date: Optional[str] = None
    time: Optional[str] = None
    total_price: Optional[float] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[BookingStatus] = None

@api_router.put("/admin/bookings/{booking_id}")
async def admin_update_booking(
    booking_id: str,
    update_data: BookingUpdate,
    current_user: User = Depends(require_admin)
):
    """Admin updates booking details"""
    booking = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    updates = update_data.dict(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    await db.bookings.update_one(
        {"booking_id": booking_id},
        {"$set": updates}
    )

    # Update linked task if exists
    if booking.get("provider_id"):
        task_updates = {}
        if update_data.date:
            task_updates["due_date"] = update_data.date
        if update_data.time:
            task_updates["due_time"] = update_data.time
        if update_data.total_price:
            task_updates["custom_price"] = update_data.total_price
        if update_data.address:
            task_updates["address"] = update_data.address

        if task_updates:
            await db.tasks.update_one(
                {"booking_id": booking_id},
                {"$set": task_updates}
            )

    updated_booking = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    return updated_booking

# Task Routes
@api_router.post("/tasks")
async def create_task(task_data: TaskCreate, current_user: User = Depends(require_admin)):
    task_id = f"task_{uuid.uuid4().hex[:12]}"
    task = Task(
        task_id=task_id,
        **task_data.dict(),
        status=TaskStatus.ASSIGNED,
        assigned_by=current_user.user_id
    )

    await db.tasks.insert_one(task.dict())

    # Update booking status if linked
    if task_data.booking_id:
        await db.bookings.update_one(
            {"booking_id": task_data.booking_id},
            {"$set": {"status": BookingStatus.ASSIGNED, "provider_id": task_data.provider_id}}
        )

    # Send Telegram notification
    provider = await db.users.find_one({"user_id": task_data.provider_id}, {"_id": 0})
    if provider and provider.get("telegram_chat_id"):
        message = f"📋 *New task!*\n\nTitle: {task_data.title}\nDescription: {task_data.description}\nDate: {task_data.due_date or 'Not specified'}"
        await send_telegram_notification(provider["telegram_chat_id"], message)

    return task.dict()

@api_router.get("/tasks")
async def get_tasks(current_user: User = Depends(get_current_user)):
    query = {}
    if current_user.role == UserRole.PROVIDER:
        query["provider_id"] = current_user.user_id
    elif current_user.role == UserRole.CLIENT:
        query["client_id"] = current_user.user_id
    # Admin sees all tasks

    tasks = await db.tasks.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)

    # Enrich with provider/client info
    for task in tasks:
        if task.get("provider_id"):
            provider = await db.users.find_one({"user_id": task["provider_id"]}, {"_id": 0, "password_hash": 0})
            task["provider"] = provider
        if task.get("client_id"):
            client = await db.users.find_one({"user_id": task["client_id"]}, {"_id": 0, "password_hash": 0})
            task["client"] = client

    return tasks

@api_router.get("/tasks/{task_id}")
async def get_task(task_id: str, current_user: User = Depends(get_current_user)):
    task = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})

    # Fallback 1: task was created from a booking — look up by booking_id in tasks
    if not task:
        task = await db.tasks.find_one({"booking_id": task_id}, {"_id": 0})

    # Fallback 2: look up in bookings collection (task_id may be a booking_id, not yet accepted)
    if not task:
        booking = await db.bookings.find_one({"booking_id": task_id}, {"_id": 0})
        if booking:
            task = dict(booking)
            task["task_id"] = booking["booking_id"]
            task["scheduled_date"] = booking.get("date", "")
            task["scheduled_time"] = booking.get("time", "")
            task["estimated_price"] = booking.get("total_price") or booking.get("estimated_price")
            task["photos"] = booking.get("problem_photos") or []
            task["allow_offers"] = booking.get("allow_offers", True)
            task["source"] = "booking"
        else:
            raise HTTPException(status_code=404, detail="Task not found")

    # Check access — for open bookings (no provider yet), any provider can view
    provider_id = task.get("provider_id")
    if current_user.role == UserRole.PROVIDER and provider_id and provider_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    if current_user.role == UserRole.CLIENT and task.get("client_id") != current_user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Enrich with related info
    if task.get("client_id"):
        client_doc = await db.users.find_one({"user_id": task["client_id"]}, {"_id": 0, "password_hash": 0})
        task["client"] = client_doc
    if task.get("provider_id"):
        provider = await db.users.find_one({"user_id": task["provider_id"]}, {"_id": 0, "password_hash": 0})
        task["provider"] = provider
    if task.get("booking_id") and task.get("source") != "booking":
        booking = await db.bookings.find_one({"booking_id": task["booking_id"]}, {"_id": 0})
        task["booking"] = booking
        # Enrich photos from booking if task doesn't have them
        if booking:
            booking_photos = booking.get("problem_photos") or booking.get("photos") or []
            task_photos = task.get("photos") or []
            # Merge photos, avoiding duplicates
            all_photos = list(dict.fromkeys(task_photos + booking_photos))
            task["photos"] = all_photos
            task["problem_photos"] = all_photos
            # Also enrich description if missing
            if not task.get("description") and booking.get("problem_description"):
                task["description"] = booking["problem_description"]
            if not task.get("address") and booking.get("address"):
                task["address"] = booking["address"]

    return task

@api_router.put("/tasks/{task_id}")
async def update_task(
    task_id: str,
    task_update: TaskUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update task - Provider can update status and comments, Admin can update everything"""
    task = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Check access
    if current_user.role == UserRole.PROVIDER and task["provider_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    update_data = task_update.dict(exclude_unset=True)

    # Track status changes for timestamps
    if task_update.status == TaskStatus.ACCEPTED and task["status"] == TaskStatus.ASSIGNED:
        update_data["started_at"] = None  # Will be set when IN_PROGRESS
        # Update booking status
        if task.get("booking_id"):
            await db.bookings.update_one(
                {"booking_id": task["booking_id"]},
                {"$set": {"status": BookingStatus.ACCEPTED}}
            )

    if task_update.status == TaskStatus.IN_PROGRESS:
        update_data["started_at"] = datetime.now(timezone.utc)
        if task.get("booking_id"):
            await db.bookings.update_one(
                {"booking_id": task["booking_id"]},
                {"$set": {"status": BookingStatus.IN_PROGRESS}}
            )

    if task_update.status == TaskStatus.COMPLETED:
        update_data["completed_at"] = datetime.now(timezone.utc)
        if task.get("booking_id"):
            await db.bookings.update_one(
                {"booking_id": task["booking_id"]},
                {"$set": {"status": BookingStatus.COMPLETED}}
            )

    if update_data:
        await db.tasks.update_one(
            {"task_id": task_id},
            {"$set": update_data}
        )

    updated_task = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
    return updated_task

@api_router.post("/tasks/{task_id}/accept")
async def accept_task(task_id: str, current_user: User = Depends(get_current_user)):
    """Executor accepts the task — works for both tasks collection and bookings collection"""
    if current_user.role != UserRole.PROVIDER:
        raise HTTPException(status_code=403, detail="Only providers can accept tasks")

    # Try tasks collection first
    task = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})

    if task:
        # Classic task flow
        if task.get("provider_id") and task["provider_id"] != current_user.user_id:
            raise HTTPException(status_code=403, detail="This task is not assigned to you")
        if task["status"] not in [TaskStatus.ASSIGNED, TaskStatus.POSTED, TaskStatus.OFFERING, TaskStatus.PENDING_ACCEPTANCE]:
            raise HTTPException(status_code=400, detail="Task cannot be accepted in current status")
        now = datetime.now(timezone.utc)
        await db.tasks.update_one(
            {"task_id": task_id},
            {"$set": {
                "status": TaskStatus.ASSIGNED,
                "provider_id": current_user.user_id,
                "accepted_at": now,
                "updated_at": now
            }}
        )
        if task.get("booking_id"):
            await db.bookings.update_one(
                {"booking_id": task["booking_id"]},
                {"$set": {"status": BookingStatus.ASSIGNED, "provider_id": current_user.user_id, "accepted_at": now}}
            )
        # Notify the client that the executor accepted
        client_id = task.get("client_id") or task.get("user_id")
        if client_id:
            await notify_user(
                client_id,
                "booking_accepted",
                "The pro accepted the order",
                f"The pro confirmed the task \"{task.get('title') or task.get('description') or 'Order'}\". Expect it to be done soon.",
                related_id=task.get("booking_id") or task_id,
                related_type="booking",
            )
        return {"message": "Task accepted", "status": TaskStatus.ASSIGNED}

    # Fallback: try bookings collection
    booking = await db.bookings.find_one({"booking_id": task_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Task not found")

    if booking.get("provider_id") and booking["provider_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="This booking is already taken")

    if booking["status"] not in ["posted", "offering"]:
        raise HTTPException(status_code=400, detail="Booking cannot be accepted in current status")

    # Assign provider to booking
    now = datetime.now(timezone.utc)
    await db.bookings.update_one(
        {"booking_id": task_id},
        {"$set": {
            "status": BookingStatus.ASSIGNED,
            "provider_id": current_user.user_id,
            "accepted_at": now,
            "updated_at": now
        }}
    )

    # Create a task entry so subsequent status changes work
    new_task_id = f"task_{task_id[8:]}" if task_id.startswith("booking_") else f"task_{task_id}"
    task_doc = {
        "task_id": new_task_id,
        "booking_id": task_id,
        "client_id": booking.get("client_id"),
        "provider_id": current_user.user_id,
        "title": booking.get("title", ""),
        "description": booking.get("description", ""),
        "address": booking.get("address", ""),
        "city": booking.get("city"),
        "latitude": booking.get("latitude"),
        "longitude": booking.get("longitude"),
        "category": booking.get("category"),
        "status": TaskStatus.ASSIGNED,
        "scheduled_date": booking.get("date", ""),
        "scheduled_time": booking.get("time", ""),
        "estimated_price": booking.get("total_price") or booking.get("estimated_price"),
        "total_price": booking.get("total_price", 0),
        "photos": booking.get("problem_photos") or [],
        "allow_offers": booking.get("allow_offers", True),
        "accepted_at": now,
        "created_at": now,
        "updated_at": now,
    }
    await db.tasks.insert_one(task_doc)

    # Notify client about acceptance (booking-collection fallback path)
    if booking.get("client_id"):
        await notify_user(
            booking["client_id"],
            "booking_accepted",
            "The pro accepted the order",
            f"The pro confirmed the task \"{booking.get('title') or 'Order'}\".",
            related_id=task_id,
            related_type="booking",
        )

    return {"message": "Booking accepted", "status": BookingStatus.ASSIGNED, "task_id": new_task_id, "new_task_id": new_task_id}


async def _resolve_task(task_id: str):
    """Find task in tasks collection, falling back to booking_id lookup."""
    task = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
    if task:
        return task
    # Maybe task_id is actually a booking_id — look up the task created from it
    task = await db.tasks.find_one({"booking_id": task_id}, {"_id": 0})
    if task:
        return task
    return None

@api_router.post("/tasks/{task_id}/on-the-way")
async def task_on_the_way(task_id: str, current_user: User = Depends(get_current_user)):
    """Executor marks they are on the way"""
    if current_user.role != UserRole.PROVIDER:
        raise HTTPException(status_code=403, detail="Only providers can update task status")

    task = await _resolve_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    real_task_id = task["task_id"]

    if task.get("provider_id") != current_user.user_id:
        raise HTTPException(status_code=403, detail="This task is not assigned to you")

    now = datetime.now(timezone.utc)
    await db.tasks.update_one(
        {"task_id": real_task_id},
        {"$set": {"status": TaskStatus.ON_THE_WAY, "on_the_way_at": now, "updated_at": now}}
    )
    if task.get("booking_id"):
        await db.bookings.update_one(
            {"booking_id": task["booking_id"]},
            {"$set": {"status": BookingStatus.ON_THE_WAY, "on_the_way_at": now}}
        )
    # Notify client
    client_id = task.get("client_id") or task.get("user_id")
    if client_id:
        await notify_user(
            client_id,
            "task_on_the_way",
            "The pro is on the way",
            f"The pro is heading to your order \"{task.get('title') or 'Task'}\".",
            related_id=task.get("booking_id") or real_task_id,
            related_type="booking",
        )
    return {"message": "Status updated: On the way", "status": TaskStatus.ON_THE_WAY, "task_id": real_task_id}

@api_router.post("/tasks/{task_id}/start")
async def start_task(task_id: str, current_user: User = Depends(get_current_user)):
    """Executor starts working on the task"""
    if current_user.role != UserRole.PROVIDER:
        raise HTTPException(status_code=403, detail="Only providers can start tasks")

    task = await _resolve_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    real_task_id = task["task_id"]

    if task.get("provider_id") != current_user.user_id:
        raise HTTPException(status_code=403, detail="This task is not assigned to you")

    if task["status"] not in [TaskStatus.ASSIGNED, TaskStatus.ON_THE_WAY]:
        raise HTTPException(status_code=400, detail="Task cannot be started in current status")

    now = datetime.now(timezone.utc)
    await db.tasks.update_one(
        {"task_id": real_task_id},
        {"$set": {
            "status": TaskStatus.STARTED,
            "started_at": now,
            "updated_at": now
        }}
    )

    if task.get("booking_id"):
        await db.bookings.update_one(
            {"booking_id": task["booking_id"]},
            {"$set": {"status": BookingStatus.STARTED, "started_at": now}}
        )

    # Notify client work has started
    client_id = task.get("client_id") or task.get("user_id")
    if client_id:
        await notify_user(
            client_id,
            "task_started",
            "Work has started",
            f"The pro has started working on \"{task.get('title') or 'Task'}\".",
            related_id=task.get("booking_id") or real_task_id,
            related_type="booking",
        )

    return {"message": "Task started", "status": TaskStatus.STARTED, "task_id": real_task_id}

@api_router.post("/tasks/{task_id}/complete")
async def complete_task(
    task_id: str,
    completion: TaskComplete,
    current_user: User = Depends(get_current_user)
):
    """Executor completes the task with details"""
    if current_user.role != UserRole.PROVIDER:
        raise HTTPException(status_code=403, detail="Only providers can complete tasks")

    task = await _resolve_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    real_task_id = task["task_id"]

    if task.get("provider_id") != current_user.user_id:
        raise HTTPException(status_code=403, detail="This task is not assigned to you")

    if task["status"] not in [TaskStatus.STARTED, TaskStatus.ON_THE_WAY, TaskStatus.ASSIGNED, TaskStatus.HOLD_PLACED, "on_the_way", "started", "assigned"]:
        raise HTTPException(status_code=400, detail=f"Task must be in progress to complete (current: {task['status']})")

    now = datetime.now(timezone.utc)
    # Auto-calculate actual hours from started_at if not provided
    actual_hours = completion.actual_hours
    if not actual_hours and task.get("started_at"):
        delta = now - task["started_at"].replace(tzinfo=timezone.utc) if task["started_at"].tzinfo is None else now - task["started_at"]
        actual_hours = round(delta.total_seconds() / 3600, 2)

    notes = completion.provider_notes or completion.provider_comments
    materials = completion.materials_cost or completion.expenses or 0.0

    # Calculate executor's gross earnings (labor + materials).
    # Platform commission is added ON TOP for the client (commission_paid_by=client by default),
    # OR deducted from executor's gross (commission_paid_by=executor) — controlled by admin.
    hourly_rate = task.get("hourly_rate") or task.get("provider_hourly_rate") or 0.0
    labor_cost = round((actual_hours or 0) * hourly_rate, 2)
    executor_total = round(labor_cost + materials, 2)

    # Resolve commission rate: prefer booking snapshot → category → settings → 15%
    commission_rate = float(task.get("commission_rate_snapshot") or 0)
    if not commission_rate and task.get("category_id"):
        cat = await db.categories.find_one({"category_id": task["category_id"]}, {"_id": 0, "commission_rate": 1})
        commission_rate = float((cat or {}).get("commission_rate") or 0)
    if not commission_rate:
        commission_rate = 15.0

    int_keys = await _get_integration_keys()
    commission_paid_by = (int_keys.get("commission_paid_by") or "client").lower()

    commission_amount = round(executor_total * (commission_rate / 100.0), 2)
    if commission_paid_by == "executor":
        final_price = executor_total
        provider_payout = round(executor_total - commission_amount, 2)
    else:
        # commission added on top — client pays more, executor gets full amount
        final_price = round(executor_total + commission_amount, 2)
        provider_payout = executor_total
    platform_fee = commission_amount

    await db.tasks.update_one(
        {"task_id": real_task_id},
        {"$set": {
            "status": TaskStatus.COMPLETED_PENDING_PAYMENT,
            "completed_at": now,
            "actual_hours": actual_hours,
            "materials_cost": materials,
            "expenses": materials,
            "provider_notes": notes,
            "provider_comments": notes,
            "final_price": final_price,
            "labor_cost": labor_cost,
            "platform_fee": platform_fee,
            "commission_rate_snapshot": commission_rate,
            "commission_paid_by": commission_paid_by,
            "provider_payout": provider_payout,
            "updated_at": now
        }}
    )

    if task.get("booking_id"):
        await db.bookings.update_one(
            {"booking_id": task["booking_id"]},
            {"$set": {
                "status": BookingStatus.COMPLETED_PENDING_PAYMENT,
                "completed_at": now,
                "actual_hours": actual_hours
            }}
        )

    # Send notification to client about payment required (in-app + email + SMS)
    client_id = task.get("client_id") or task.get("user_id")
    if client_id:
        await notify_user(
            client_id,
            "payment_required",
            "Payment for the task",
            f"The pro finished the work. Hours worked: {actual_hours} hr. Please pay the invoice.",
            related_id=task.get("booking_id") or real_task_id,
            related_type="booking",
        )

    return {"message": "Task completed", "status": TaskStatus.COMPLETED_PENDING_PAYMENT, "actual_hours": actual_hours}

@api_router.post("/tasks/{task_id}/decline")
async def decline_task(
    task_id: str,
    reason: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user)
):
    """Executor declines the task before or after accepting"""
    if current_user.role != UserRole.PROVIDER:
        raise HTTPException(status_code=403, detail="Only providers can decline tasks")

    task = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Allow decline if assigned to this provider OR if task is posted/offering (provider browsing)
    if task.get("provider_id") and task["provider_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="This task is not assigned to you")

    declinable = [TaskStatus.ASSIGNED, TaskStatus.POSTED, TaskStatus.OFFERING, "hold_placed"]
    if task["status"] not in declinable:
        raise HTTPException(status_code=400, detail="Task cannot be declined at this stage")

    if not reason or not reason.strip():
        raise HTTPException(status_code=422, detail="Reason for declining is required")

    await db.tasks.update_one(
        {"task_id": task_id},
        {"$set": {
            "status": TaskStatus.DECLINED,
            "provider_comments": reason.strip(),
            "declined_at": datetime.utcnow().isoformat() + "Z",
            "declined_by": current_user.user_id,
        }}
    )

    # Set booking to declined so client sees the status, but allow re-posting
    if task.get("booking_id"):
        await db.bookings.update_one(
            {"booking_id": task["booking_id"]},
            {"$set": {
                "status": "declined",
                "provider_id": None,
                "decline_reason": reason.strip(),
                "declined_at": datetime.utcnow().isoformat() + "Z",
            }}
        )

    # Notify client the executor declined
    client_id = task.get("client_id") or task.get("user_id")
    if client_id:
        await notify_user(
            client_id,
            "booking_declined",
            "The pro declined the order",
            f"Unfortunately, the pro declined the task. Reason: {reason.strip()}. You can choose another pro.",
            related_id=task.get("booking_id") or task_id,
            related_type="booking",
        )

    return {"message": "Task declined", "status": TaskStatus.DECLINED, "reason": reason.strip()}

@api_router.get("/admin/tasks")
async def admin_get_tasks(
    status: Optional[str] = None,
    provider_id: Optional[str] = None,
    client_id: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 100,
    skip: int = 0,
    current_user: User = Depends(require_admin)
):
    """Admin: get all tasks with optional filters"""
    query: dict = {}
    if status:
        query["status"] = status
    if provider_id:
        query["provider_id"] = provider_id
    if client_id:
        query["client_id"] = client_id
    if category:
        query["category"] = category
    tasks = await db.tasks.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    # Enrich with client and provider names
    for t in tasks:
        if t.get("client_id"):
            c = await db.users.find_one({"user_id": t["client_id"]}, {"_id": 0, "name": 1, "email": 1})
            t["client"] = c or {}
        if t.get("provider_id"):
            p = await db.users.find_one({"user_id": t["provider_id"]}, {"_id": 0, "name": 1, "email": 1})
            t["provider"] = p or {}
    total = await db.tasks.count_documents(query)
    return {"tasks": tasks, "total": total}

@api_router.delete("/admin/tasks/{task_id}")
async def admin_delete_task(
    task_id: str,
    current_user: User = Depends(require_admin)
):
    """Admin: delete a task"""
    result = await db.tasks.delete_one({"task_id": task_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task deleted"}

@api_router.patch("/admin/tasks/{task_id}/status")
async def admin_change_task_status(
    task_id: str,
    status: str,
    actual_hours: Optional[float] = None,
    final_price: Optional[float] = None,
    current_user: User = Depends(require_admin)
):
    """Admin: change task status, hours, and price"""
    task = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    upd: dict = {"status": status}
    if actual_hours is not None:
        upd["actual_hours"] = actual_hours
        rate = task.get("hourly_rate", 0)
        upd["labor_cost"] = round(actual_hours * rate, 2)
        if final_price is None:
            upd["final_price"] = round(actual_hours * rate + task.get("materials_cost", 0), 2)
    if final_price is not None:
        upd["final_price"] = final_price
    await db.tasks.update_one({"task_id": task_id}, {"$set": upd})
    return {"message": "Updated", "task_id": task_id, "status": status}

@api_router.put("/admin/tasks/{task_id}")
async def admin_update_task(
    task_id: str,
    due_date: Optional[str] = None,
    due_time: Optional[str] = None,
    custom_price: Optional[float] = None,
    provider_id: Optional[str] = None,
    address: Optional[str] = None,
    notes: Optional[str] = None,
    current_user: User = Depends(require_admin)
):
    """Admin can update task details including time, price, and reassign"""
    task = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    update_data = {}
    if due_date is not None:
        update_data["due_date"] = due_date
    if due_time is not None:
        update_data["due_time"] = due_time
    if custom_price is not None:
        update_data["custom_price"] = custom_price
    if provider_id is not None:
        update_data["provider_id"] = provider_id
        update_data["status"] = TaskStatus.ASSIGNED  # Reset status when reassigning
    if address is not None:
        update_data["address"] = address
    if notes is not None:
        update_data["notes"] = notes

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    await db.tasks.update_one(
        {"task_id": task_id},
        {"$set": update_data}
    )

    # Update booking if linked and provider changed
    if provider_id and task.get("booking_id"):
        await db.bookings.update_one(
            {"booking_id": task["booking_id"]},
            {"$set": {"provider_id": provider_id, "status": BookingStatus.ASSIGNED}}
        )

    updated_task = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
    return updated_task

# Message Routes
@api_router.post("/messages")
async def send_message(message_data: MessageCreate, current_user: User = Depends(get_current_user)):
    message_id = f"message_{uuid.uuid4().hex[:12]}"
    message = Message(
        message_id=message_id,
        from_user_id=current_user.user_id,
        **message_data.dict()
    )

    await db.messages.insert_one(message.dict())
    return message.dict()

@api_router.get("/messages")
async def get_messages(with_user_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    if with_user_id:
        # Get conversation with specific user
        query = {
            "$or": [
                {"from_user_id": current_user.user_id, "to_user_id": with_user_id},
                {"from_user_id": with_user_id, "to_user_id": current_user.user_id}
            ]
        }
    else:
        # Get all messages
        query = {
            "$or": [
                {"from_user_id": current_user.user_id},
                {"to_user_id": current_user.user_id}
            ]
        }

    messages = await db.messages.find(query, {"_id": 0}).sort("created_at", 1).to_list(100)
    return messages

@api_router.put("/messages/{message_id}/read")
async def mark_message_read(message_id: str, current_user: User = Depends(get_current_user)):
    await db.messages.update_one(
        {"message_id": message_id, "to_user_id": current_user.user_id},
        {"$set": {"read": True}}
    )
    return {"message": "Message marked as read"}


@api_router.get("/tasks/{task_id}/messages")
async def get_task_messages(task_id: str, current_user: User = Depends(get_current_user)):
    """Get all messages for a task (group chat)"""
    # Resolve task to check access
    task = await _resolve_task(task_id)
    if not task:
        # Try bookings
        booking = await db.bookings.find_one({"booking_id": task_id}, {"_id": 0})
        if not booking:
            raise HTTPException(status_code=404, detail="Task not found")
        task = booking

    # Access check: client, provider, admin, moderator
    is_admin = current_user.role in [UserRole.ADMIN, UserRole.MODERATOR]
    is_client = task.get("client_id") == current_user.user_id
    is_provider = task.get("provider_id") == current_user.user_id
    if not (is_admin or is_client or is_provider):
        raise HTTPException(status_code=403, detail="Access denied")

    messages = await db.messages.find(
        {"task_id": {"$in": [task_id, task.get("task_id", task_id)]}},
        {"_id": 0}
    ).sort("created_at", 1).to_list(500)

    # Enrich with sender info
    for msg in messages:
        sender = await db.users.find_one({"user_id": msg["from_user_id"]}, {"_id": 0, "password_hash": 0})
        if sender:
            msg["sender"] = {"name": sender.get("name",""), "role": sender.get("role",""), "picture": sender.get("picture")}

    return messages

@api_router.post("/tasks/{task_id}/messages")
async def send_task_message(task_id: str, body: MessageCreate, current_user: User = Depends(get_current_user)):
    """Send a message in task group chat"""
    task = await _resolve_task(task_id)
    if not task:
        booking = await db.bookings.find_one({"booking_id": task_id}, {"_id": 0})
        if not booking:
            raise HTTPException(status_code=404, detail="Task not found")
        task = booking

    real_task_id = task.get("task_id", task_id)
    is_admin = current_user.role in [UserRole.ADMIN, UserRole.MODERATOR]
    is_client = task.get("client_id") == current_user.user_id
    is_provider = task.get("provider_id") == current_user.user_id
    if not (is_admin or is_client or is_provider):
        raise HTTPException(status_code=403, detail="Access denied")

    msg_id = f"msg_{uuid.uuid4().hex[:12]}"
    msg = {
        "message_id": msg_id,
        "task_id": real_task_id,
        "from_user_id": current_user.user_id,
        "text": body.text,
        "image_url": body.image_url,
        "read": False,
        "created_at": datetime.now(timezone.utc),
    }
    await db.messages.insert_one(msg)
    msg.pop("_id", None)

    # Enrich with sender
    msg["sender"] = {"name": current_user.name, "role": current_user.role, "picture": getattr(current_user, "picture", None)}
    return msg

@api_router.get("/messages/unread-count")
async def get_unread_messages_count(current_user: User = Depends(get_current_user)):
    """Get total count of unread task messages for current user"""
    uid = current_user.user_id
    # Find all tasks where user is client or provider
    tasks_cursor = db.tasks.find(
        {"$or": [{"client_id": uid}, {"provider_id": uid}]},
        {"task_id": 1, "_id": 0}
    )
    task_ids = [t["task_id"] async for t in tasks_cursor]
    if not task_ids:
        return {"unread_count": 0}
    count = await db.messages.count_documents({
        "task_id": {"$in": task_ids},
        "from_user_id": {"$ne": uid},
        "read": False
    })
    return {"unread_count": count}

@api_router.post("/tasks/{task_id}/messages/read")
async def mark_task_messages_read(task_id: str, current_user: User = Depends(get_current_user)):
    """Mark all messages in a task as read for current user"""
    task = await _resolve_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    real_task_id = task.get("task_id", task_id)
    uid = current_user.user_id
    await db.messages.update_many(
        {"task_id": real_task_id, "from_user_id": {"$ne": uid}, "read": False},
        {"$set": {"read": True}}
    )
    return {"ok": True}

@api_router.post("/tasks/{task_id}/pay")
async def pay_task(task_id: str, payment_data: dict, current_user: User = Depends(get_current_user)):
    """Client pays for completed task"""
    task = await _resolve_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    real_task_id = task["task_id"]

    if task.get("client_id") != current_user.user_id:
        raise HTTPException(status_code=403, detail="Only the client can pay")

    if task["status"] != TaskStatus.COMPLETED_PENDING_PAYMENT:
        raise HTTPException(status_code=400, detail="Task is not awaiting payment")

    now = datetime.now(timezone.utc)
    payment_method = payment_data.get("payment_method", "unknown")

    await db.tasks.update_one(
        {"task_id": real_task_id},
        {"$set": {
            "status": TaskStatus.PAID,
            "paid_at": now,
            "payment_method": payment_method,
            "updated_at": now
        }}
    )
    if task.get("booking_id"):
        await db.bookings.update_one(
            {"booking_id": task["booking_id"]},
            {"$set": {"status": BookingStatus.PAID, "paid_at": now, "payment_method": payment_method}}
        )

    return {"message": "Payment confirmed", "status": "paid", "paid_at": now.isoformat()}


# ─── Moderator Management ──────────────────────────────────────────────────────
AVAILABLE_MODULES = [
    "tasks", "bookings", "users", "payments", "reviews",
    "messages", "services", "analytics", "settings"
]

@api_router.post("/admin/users/{user_id}/set-moderator")
async def set_moderator(user_id: str, current_user: User = Depends(get_current_user)):
    """Admin promotes a user to moderator role"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can manage moderators")

    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "role": UserRole.MODERATOR,
            "moderator_modules": AVAILABLE_MODULES,  # full access by default
            "promoted_to_moderator_at": datetime.now(timezone.utc),
            "promoted_by": current_user.user_id
        }}
    )
    return {"message": "User promoted to moderator", "modules": AVAILABLE_MODULES}

@api_router.post("/admin/users/{user_id}/remove-moderator")
async def remove_moderator(user_id: str, current_user: User = Depends(get_current_user)):
    """Admin removes moderator role"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can manage moderators")

    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"role": UserRole.CLIENT, "moderator_modules": []}}
    )
    return {"message": "Moderator role removed"}

@api_router.put("/admin/users/{user_id}/moderator-modules")
async def update_moderator_modules(
    user_id: str,
    modules: List[str],
    current_user: User = Depends(get_current_user)
):
    """Admin updates which modules a moderator can access"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can manage moderators")

    invalid = [m for m in modules if m not in AVAILABLE_MODULES]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Invalid modules: {invalid}")

    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"moderator_modules": modules, "updated_at": datetime.now(timezone.utc)}}
    )
    return {"message": "Modules updated", "modules": modules}

@api_router.put("/admin/users/{user_id}/role")
async def change_user_role(user_id: str, payload: Dict[str, Any] = Body(...), current_user: User = Depends(get_current_user)):
    """Admin changes a user's role to any of: client, provider, admin, moderator, support."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can change user roles")

    new_role = (payload.get("role") or "").strip().lower()
    valid_roles = [r.value for r in UserRole]
    if new_role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {valid_roles}")

    if user_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="You cannot change your own role")

    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update: Dict[str, Any] = {
        "role": new_role,
        "role_updated_at": datetime.now(timezone.utc),
        "role_updated_by": current_user.user_id,
    }
    # Role-specific side effects
    if new_role == UserRole.MODERATOR.value:
        # Grant full module access by default if none set yet
        if not user.get("moderator_modules"):
            update["moderator_modules"] = AVAILABLE_MODULES
    else:
        # Leaving moderator clears module grants
        update["moderator_modules"] = []

    await db.users.update_one({"user_id": user_id}, {"$set": update})
    return {"message": "Role updated", "role": new_role, "moderator_modules": update.get("moderator_modules", [])}


@api_router.get("/admin/moderators")
async def get_moderators(current_user: User = Depends(get_current_user)):
    """Get all moderators with their module access"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can view moderators")

    mods = await db.users.find(
        {"role": UserRole.MODERATOR},
        {"_id": 0, "password_hash": 0}
    ).to_list(100)
    return mods

@api_router.get("/admin/available-modules")
async def get_available_modules(current_user: User = Depends(get_current_user)):
    """Get list of all available modules"""
    if current_user.role not in [UserRole.ADMIN, UserRole.MODERATOR]:
        raise HTTPException(status_code=403, detail="Access denied")
    return {"modules": AVAILABLE_MODULES}

# Review Routes
@api_router.post("/reviews")
async def create_review(review_data: ReviewCreate, current_user: User = Depends(get_current_user)):
    # Get booking — try by booking_id first, then by task_id (task may have been created from booking)
    booking = await db.bookings.find_one({"booking_id": review_data.booking_id}, {"_id": 0})
    if not booking:
        # Maybe review_data.booking_id is actually a task_id — look up the task and get its booking_id
        task_doc = await db.tasks.find_one({"task_id": review_data.booking_id}, {"_id": 0})
        if task_doc and task_doc.get("booking_id"):
            booking = await db.bookings.find_one({"booking_id": task_doc["booking_id"]}, {"_id": 0})
        if not booking:
            # Last resort: treat task as a virtual booking
            if task_doc:
                booking = task_doc
                booking["booking_id"] = task_doc["task_id"]
            else:
                raise HTTPException(status_code=404, detail="Booking not found")

    if booking.get("client_id") != current_user.user_id:
        raise HTTPException(status_code=403, detail="Only the client can review")

    if not booking.get("provider_id"):
        raise HTTPException(status_code=400, detail="No provider assigned to this booking")

    # Check if already reviewed
    existing_review = await db.reviews.find_one({"booking_id": booking["booking_id"]})
    if existing_review:
        raise HTTPException(status_code=400, detail="Booking already reviewed")

    review_id = f"review_{uuid.uuid4().hex[:12]}"
    review = Review(
        review_id=review_id,
        booking_id=booking["booking_id"],
        client_id=current_user.user_id,
        provider_id=booking["provider_id"],
        rating=review_data.rating,
        comment=review_data.comment,
        tip_amount=review_data.tip_amount
    )

    await db.reviews.insert_one(review.dict())

    # If tip provided, update task and booking with tip_amount
    if review_data.tip_amount and review_data.tip_amount > 0:
        now = datetime.now(timezone.utc)
        await db.bookings.update_one(
            {"booking_id": booking["booking_id"]},
            {"$set": {"tip_amount": review_data.tip_amount, "updated_at": now}}
        )
        # Also update the linked task if any
        task_to_update = await db.tasks.find_one({"booking_id": booking["booking_id"]}, {"_id": 0})
        if task_to_update:
            await db.tasks.update_one(
                {"task_id": task_to_update["task_id"]},
                {"$set": {"tip_amount": review_data.tip_amount, "updated_at": now}}
            )

    return review.dict()

@api_router.get("/reviews/provider/{provider_id}")
async def get_provider_reviews(provider_id: str):
    reviews = await db.reviews.find({"provider_id": provider_id}, {"_id": 0}).to_list(100)

    # Calculate average rating
    if reviews:
        avg_rating = sum(r["rating"] for r in reviews) / len(reviews)
    else:
        avg_rating = 0

    return {
        "reviews": reviews,
        "average_rating": round(avg_rating, 2),
        "total_reviews": len(reviews)
    }

@api_router.put("/reviews/{review_id}")
async def update_review(review_id: str, review_data: ReviewUpdate, current_user: User = Depends(require_admin)):
    """Admin can edit any review"""
    update_dict = review_data.dict(exclude_unset=True)
    if not update_dict:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = await db.reviews.update_one(
        {"review_id": review_id},
        {"$set": update_dict}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Review not found")

    updated_review = await db.reviews.find_one({"review_id": review_id}, {"_id": 0})
    return updated_review

@api_router.delete("/reviews/{review_id}")
async def delete_review(review_id: str, current_user: User = Depends(require_admin)):
    """Admin can delete any review"""
    result = await db.reviews.delete_one({"review_id": review_id})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Review not found")

    return {"message": "Review deleted successfully"}

# Executor Profile Routes
@api_router.post("/profile/executor")
async def create_executor_profile(profile_data: ExecutorProfileCreate, current_user: User = Depends(get_current_user)):
    """Create or update executor profile"""
    if current_user.role not in [UserRole.PROVIDER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only providers can create profiles")

    # Check if profile already exists
    existing_profile = await db.executor_profiles.find_one({"user_id": current_user.user_id}, {"_id": 0})

    if existing_profile:
        # Update existing profile
        update_dict = profile_data.dict(exclude_unset=True)
        update_dict["updated_at"] = datetime.now(timezone.utc)

        await db.executor_profiles.update_one(
            {"user_id": current_user.user_id},
            {"$set": update_dict}
        )

        updated_profile = await db.executor_profiles.find_one({"user_id": current_user.user_id}, {"_id": 0})
        return updated_profile
    else:
        # Create new profile
        profile_id = f"profile_{uuid.uuid4().hex[:12]}"
        profile = ExecutorProfile(
            profile_id=profile_id,
            user_id=current_user.user_id,
            **profile_data.dict()
        )

        await db.executor_profiles.insert_one(profile.dict())
        return profile.dict()

@api_router.get("/profile/executor/{user_id}")
async def get_executor_profile(user_id: str):
    """Get executor profile by user_id"""
    profile = await db.executor_profiles.find_one({"user_id": user_id}, {"_id": 0})
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    # Get user details
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})

    # Get reviews
    reviews = await db.reviews.find({"provider_id": user_id}, {"_id": 0}).to_list(100)
    avg_rating = sum(r["rating"] for r in reviews) / len(reviews) if reviews else 0

    # Merge user lat/lng into profile if profile doesn't have them
    merged_lat = profile.get("latitude") or (user.get("latitude") if user else None)
    merged_lng = profile.get("longitude") or (user.get("longitude") if user else None)
    merged_radius = profile.get("service_radius_km")

    return {
        **profile,
        "latitude": merged_lat,
        "longitude": merged_lng,
        "service_radius_km": merged_radius,
        "user": user,
        "average_rating": round(avg_rating, 2),
        "total_reviews": len(reviews)
    }

@api_router.get("/profile/executor")
async def get_my_executor_profile(current_user: User = Depends(get_current_user)):
    """Get current user's executor profile"""
    profile = await db.executor_profiles.find_one({"user_id": current_user.user_id}, {"_id": 0})
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found. Create one first.")

    return profile

@api_router.put("/profile/executor")
async def update_executor_profile(profile_data: ExecutorProfileUpdate, current_user: User = Depends(get_current_user)):
    """Update executor profile"""
    if current_user.role not in [UserRole.PROVIDER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only providers can update profiles")

    update_dict = profile_data.dict(exclude_unset=True)
    if not update_dict:
        raise HTTPException(status_code=400, detail="No fields to update")

    update_dict["updated_at"] = datetime.now(timezone.utc)

    result = await db.executor_profiles.update_one(
        {"user_id": current_user.user_id},
        {"$set": update_dict}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Profile not found. Create one first.")

    updated_profile = await db.executor_profiles.find_one({"user_id": current_user.user_id}, {"_id": 0})
    return updated_profile

# ==================== PROVIDER PRICE WITH COMMISSION ====================

@api_router.get("/provider/tasks")
async def get_provider_tasks_with_prices(current_user: User = Depends(get_current_user)):
    """Get provider's tasks with commission-adjusted prices"""
    if current_user.role != UserRole.PROVIDER:
        raise HTTPException(status_code=403, detail="Only providers can access this endpoint")

    # Get admin settings for commission
    settings = await db.admin_settings.find_one({"settings_id": "global_settings"}, {"_id": 0})
    commission_percent = 0
    if settings and settings.get("apply_admin_commission"):
        commission_percent = settings.get("admin_commission_percentage", 0)

    # Get tasks for this provider
    tasks = await db.tasks.find(
        {"provider_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)

    # Add commission info to each task
    for task in tasks:
        original_price = task.get("estimated_price", 0) or task.get("final_price", 0) or 0
        commission_amount = original_price * (commission_percent / 100)
        provider_earnings = original_price - commission_amount

        task["original_price"] = original_price
        task["commission_percent"] = commission_percent
        task["commission_amount"] = round(commission_amount, 2)
        task["provider_earnings"] = round(provider_earnings, 2)

        # Get booking info (exclude heavy base64 fields like problem_photos)
        if task.get("booking_id"):
            booking = await db.bookings.find_one(
                {"booking_id": task["booking_id"]},
                {"_id": 0, "problem_photos": 0}
            )
            if booking:
                task["booking"] = booking

    return {
        "tasks": tasks,
        "commission_percent": commission_percent
    }

@api_router.get("/executors")
async def get_all_executors(current_user: User = Depends(get_current_user)):
    """Get list of all executors/providers with optimized queries"""
    # Use aggregation pipeline to avoid N+1 queries
    pipeline = [
        {"$match": {"role": "provider", "is_blocked": False}},
        {"$lookup": {
            "from": "executor_profiles",
            "localField": "user_id",
            "foreignField": "user_id",
            "as": "profile"
        }},
        {"$lookup": {
            "from": "reviews",
            "localField": "user_id",
            "foreignField": "provider_id",
            "as": "reviews"
        }},
        {"$addFields": {
            "profile": {"$arrayElemAt": ["$profile", 0]},
            "total_reviews": {"$size": "$reviews"},
            "average_rating": {
                "$cond": {
                    "if": {"$gt": [{"$size": "$reviews"}, 0]},
                    "then": {"$avg": "$reviews.rating"},
                    "else": 0
                }
            }
        }},
        {"$project": {
            "_id": 0,
            "password_hash": 0,
            "reviews": 0,
            "profile._id": 0
        }}
    ]

    result = await db.users.aggregate(pipeline).to_list(1000)

    # Round average ratings
    for executor in result:
        if executor.get("average_rating"):
            executor["average_rating"] = round(executor["average_rating"], 2)

    return JSONResponse(content=clean_bson(result))


# ── Skill ↔ Category map (mirrors front-end SKILL_CATEGORIES) ────────
# An executor matches a `category` when at least one of their skills
# belongs to that category. Lower-case lookup; supports both Ukrainian
# display names and English ids (`furniture_assembly`, etc.).
SKILL_TO_CATEGORIES = {
    # assembly
    "збірка меблів": "assembly", "furniture_assembly": "assembly",
    "збірка ikea": "assembly", "ikea_assembly": "assembly",
    "монтаж полиць": "assembly", "shelving": "assembly",
    "збірка шаф": "assembly", "wardrobe": "assembly",
    "офісні меблі": "assembly", "office_furniture": "assembly",
    "монтаж телевізора": "assembly", "tv_mount": "assembly",
    # cleaning
    "прибирання будинку": "cleaning", "home_cleaning": "cleaning",
    "прибирання офісу": "cleaning", "office_cleaning": "cleaning",
    "генеральне прибирання": "cleaning", "deep_cleaning": "cleaning",
    "прибирання при переїзді": "cleaning", "move_in_out": "cleaning",
    "миття вікон": "cleaning", "window_cleaning": "cleaning",
    "чищення килимів": "cleaning", "carpet_cleaning": "cleaning",
    # home_improvements
    "встановлення техніки": "home_improvements", "appliance_install": "home_improvements",
    "ремонт дверей та меблів": "home_improvements", "door_repair": "home_improvements",
    "фарбування": "home_improvements", "painting": "home_improvements",
    "укладання плитки": "home_improvements", "tiling": "home_improvements",
    "укладання підлоги": "home_improvements", "flooring": "home_improvements",
    "гіпсокартон": "home_improvements", "drywall": "home_improvements",
    "сантехніка": "home_improvements", "plumbing": "home_improvements",
    "електрика": "home_improvements", "electrical": "home_improvements",
    # moving
    "допомога з переїздом": "moving", "moving_help": "moving",
    "пакування речей": "moving", "packing": "moving",
    "перенесення меблів": "moving", "furniture_moving": "moving",
    "доставка": "moving", "delivery": "moving",
    "вивіз сміття": "moving", "junk_removal": "moving",
    # outdoor
    "догляд за газоном": "outdoor", "lawn_care": "outdoor",
    "прибирання снігу": "outdoor", "snow_removal": "outdoor",
    "садівництво": "outdoor", "garden_planting": "outdoor",
    "миття під тиском": "outdoor", "pressure_washing": "outdoor",
    "встановлення огорожі": "outdoor", "fence_install": "outdoor",
    # personal
    "доручення": "personal", "errand": "personal",
    "шопінг-асистент": "personal", "shopping": "personal",
    "догляд за тваринами": "personal", "pet_care": "personal",
    "допомога літнім людям": "personal", "elderly_help": "personal",
    # it_tech
    "налаштування комп'ютера": "it_tech", "computer_setup": "it_tech",
    "налаштування smart tv": "it_tech", "tv_setup": "it_tech",
    "ремонт телефонів": "it_tech", "phone_repair": "it_tech",
    "налаштування мережі": "it_tech", "network_setup": "it_tech",
    "відновлення даних": "it_tech", "data_recovery": "it_tech",
    # events
    "організація заходів": "events", "event_setup": "events",
    "фотографія": "events", "photography": "events",
    "допомога на кухні": "events", "catering_help": "events",
    "бармен": "events", "bartending": "events",
    # other
    "майстер на всі руки": "other", "handyman": "other",
    "репетиторство": "other", "tutoring": "other",
    "переклад": "other", "translation": "other",
    "водій": "other", "driving": "other",
}


def _skill_matches_category(skill_value: Any, target_category: Optional[str]) -> bool:
    """True if a skill belongs to the given category. Empty target → True."""
    if not target_category:
        return True
    target = str(target_category).lower().strip()
    if isinstance(skill_value, dict):
        cat_id = (skill_value.get("category_id") or "").lower().strip()
        if cat_id and cat_id == target:
            return True
        name = (skill_value.get("name") or skill_value.get("label") or "").lower().strip()
    else:
        name = str(skill_value).lower().strip()
    return SKILL_TO_CATEGORIES.get(name) == target


@api_router.get("/executors/by-service")
async def get_executors_by_service(
    service_name: Optional[str] = None,
    category: Optional[str] = None,
    city: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Get executors filtered by service/skill AND location.

    Public endpoint — guests (no auth) can also browse executors from the
    landing page booking flow.
    """
    settings_doc = await db.settings.find_one({"setting_id": "app_settings"}, {"_id": 0})
    settings = Settings(**settings_doc) if settings_doc else Settings()

    # Per-category commission_rate takes priority over the legacy global
    # admin_commission_percentage so admins can configure markup on a
    # category-by-category basis (e.g. assembly=50%, cleaning=15%).
    commission_percent = 0.0
    if category:
        cat_doc = await db.categories.find_one(
            {"category_id": category},
            {"_id": 0, "commission_rate": 1},
        )
        if cat_doc and cat_doc.get("commission_rate") is not None:
            commission_percent = float(cat_doc["commission_rate"])
    if commission_percent == 0.0 and settings.apply_admin_commission:
        commission_percent = settings.admin_commission_percentage or 0.0

    pipeline = [
        # Only active, not blocked, not hidden by admin
        {"$match": {"role": "provider", "is_blocked": False, "hidden_from_clients": {"$ne": True}}},
        {"$lookup": {
            "from": "executor_profiles",
            "localField": "user_id",
            "foreignField": "user_id",
            "as": "profile"
        }},
        {"$lookup": {
            "from": "reviews",
            "localField": "user_id",
            "foreignField": "provider_id",
            "as": "reviews"
        }},
        {"$lookup": {
            "from": "tasks",
            "let": {"uid": "$user_id"},
            "pipeline": [{"$match": {"$expr": {"$and": [
                {"$eq": ["$provider_id", "$$uid"]},
                {"$eq": ["$status", "completed"]}
            ]}}}],
            "as": "completed_tasks"
        }},
        {"$lookup": {
            "from": "availability_slots",
            "let": {"uid": "$user_id"},
            "pipeline": [{"$match": {"$expr": {"$and": [
                {"$eq": ["$user_id", "$$uid"]},
                {"$eq": ["$is_active", True]}
            ]}}}],
            "as": "availability_slots"
        }},
        {"$addFields": {
            "profile": {"$arrayElemAt": ["$profile", 0]},
            "total_reviews": {"$size": "$reviews"},
            "average_rating": {
                "$cond": {
                    "if": {"$gt": [{"$size": "$reviews"}, 0]},
                    "then": {"$avg": "$reviews.rating"},
                    "else": 0
                }
            },
            "completed_tasks_count": {"$size": "$completed_tasks"}
        }},
        {"$project": {"_id": 0, "password_hash": 0, "reviews": 0, "completed_tasks": 0, "profile._id": 0, "availability_slots._id": 0}}
    ]

    result = await db.users.aggregate(pipeline).to_list(1000)

    filtered = []
    for executor in result:
        profile = executor.get("profile") or {}

        # ── Category filter ───────────────────────────────────────────
        # The executor must have at least one skill belonging to the
        # requested category. This prevents an "assembly-only" provider
        # from showing up when the client searches for "home_improvements".
        if category:
            user_skills = profile.get("skills") or []
            if not user_skills:
                # No skills declared — exclude (cannot match any category)
                continue
            if not any(_skill_matches_category(s, category) for s in user_skills):
                continue

        # ── Skill filter ──────────────────────────────────────────────
        if service_name:
            skills = profile.get("skills") or []
            # skills can be list of strings or list of dicts {id, category_id, name, ...}
            skill_names = []
            for s in skills:
                if isinstance(s, dict):
                    # `name` is the human-readable skill (Ukrainian); fall back to label/id
                    skill_names.append((s.get("name") or s.get("label") or s.get("id") or "").lower())
                else:
                    skill_names.append(str(s).lower())
            svc_lower = service_name.lower()
            if not any(svc_lower in s or s in svc_lower for s in skill_names):
                continue

        # ── Location filter ───────────────────────────────────────────
        # Only filter if client provided a city or coordinates
        if city or (lat is not None and lng is not None):
            executor_cities = [c.lower() for c in (profile.get("service_cities") or [])]
            executor_zones  = [z.lower() for z in (profile.get("service_zones") or [])]
            # Also try user-level lat/lng as fallback (saved via map)
            exec_lat  = profile.get("latitude") or executor.get("latitude")
            exec_lng  = profile.get("longitude") or executor.get("longitude")
            exec_radius_km = profile.get("service_radius_km") or executor.get("service_radius_km") or 0

            location_ok = False

            # 1. Check if executor's city list matches client's city
            if city:
                city_lower = city.lower().strip()
                # Match full city or city is contained in executor's zones/cities
                for ec in executor_cities + executor_zones:
                    if city_lower in ec or ec in city_lower:
                        location_ok = True
                        break
                # Also check user-level city field
                if not location_ok:
                    user_city = (executor.get("city") or "").lower().strip()
                    if user_city and (city_lower in user_city or user_city in city_lower):
                        location_ok = True

            # 2. Check radius if executor has set coordinates and radius
            import math
            if not location_ok and exec_lat and exec_lng and exec_radius_km > 0:
                # If client provided coordinates, use them; otherwise geocode city
                client_lat, client_lng = lat, lng
                if client_lat is None and city:
                    # We can't geocode here, but we already checked city names above
                    pass
                if client_lat is not None and client_lng is not None:
                    dlat = math.radians(client_lat - exec_lat)
                    dlng = math.radians(client_lng - exec_lng)
                    a = math.sin(dlat/2)**2 + math.cos(math.radians(exec_lat)) * math.cos(math.radians(client_lat)) * math.sin(dlng/2)**2
                    distance_km = 6371 * 2 * math.asin(math.sqrt(a))
                    if distance_km <= exec_radius_km:
                        location_ok = True

            # 3. If executor has NO location set at all — include them (they haven't configured yet)
            if not location_ok and not executor_cities and not executor_zones and not exec_lat:
                location_ok = True

            if not location_ok:
                # Strict filter: do not show executors whose service area
                # does not cover the client's location.
                continue

        # ── Admin listing filters ──────────────────────────────────────
        rating = round(executor.get("average_rating") or 0, 2)
        tasks_done = executor.get("completed_tasks_count") or 0
        base_rate = profile.get("hourly_rate") or 0.0

        # Min rating filter
        if settings.executor_min_rating > 0 and rating < settings.executor_min_rating:
            continue
        # Min tasks filter
        if settings.executor_min_tasks > 0 and tasks_done < settings.executor_min_tasks:
            continue
        # Max price filter
        if settings.executor_max_price > 0 and base_rate > settings.executor_max_price:
            continue
        # Verified only
        if settings.executor_verified_only and not profile.get("is_verified", False):
            continue
        # Hide new taskers (0 tasks)
        if not settings.executor_show_new and tasks_done == 0:
            continue

        # ── Commission (Variant B: commission is % of client total) ──
        # client_rate = base_rate / (1 - commission/100); platform = client - base.
        if base_rate and 0 < commission_percent < 100:
            final_rate = round(base_rate / (1 - commission_percent / 100.0), 2)
        else:
            final_rate = base_rate

        executor["average_rating"] = rating
        executor["base_hourly_rate"] = base_rate
        executor["final_hourly_rate"] = final_rate
        executor["commission_percentage"] = commission_percent
        executor["work_photos_count"] = len(profile.get("portfolio_photos") or [])

        filtered.append(executor)

    # ── Admin-controlled sort ─────────────────────────────────────────
    sort = settings.executor_listing_sort
    if sort == "rating":
        filtered.sort(key=lambda x: -(x.get("average_rating") or 0))
    elif sort == "tasks":
        filtered.sort(key=lambda x: -(x.get("completed_tasks_count") or 0))
    elif sort == "price_asc":
        filtered.sort(key=lambda x: x.get("final_hourly_rate") or 0)
    elif sort == "price_desc":
        filtered.sort(key=lambda x: -(x.get("final_hourly_rate") or 0))
    elif sort == "newest":
        filtered.sort(key=lambda x: str(x.get("created_at") or ""), reverse=True)
    elif sort == "oldest":
        filtered.sort(key=lambda x: str(x.get("created_at") or ""))
    else:  # recommended
        filtered.sort(key=lambda x: (
            -(x.get("average_rating") or 0) * 0.6 +
            -(min(x.get("completed_tasks_count") or 0, 500) / 500) * 0.4
        ))

    return JSONResponse(content=clean_bson(filtered))


# Availability Calendar Routes
@api_router.post("/availability")
async def create_availability_slot(slot_data: AvailabilitySlotCreate, current_user: User = Depends(get_current_user)):
    """Executor creates availability slot"""
    if current_user.role not in [UserRole.PROVIDER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only providers can create availability slots")

    # Validate day_of_week
    if slot_data.day_of_week < 0 or slot_data.day_of_week > 6:
        raise HTTPException(status_code=400, detail="day_of_week must be 0-6 (0=Monday, 6=Sunday)")

    # Validate time format
    try:
        datetime.strptime(slot_data.start_time, "%H:%M")
        datetime.strptime(slot_data.end_time, "%H:%M")
    except ValueError:
        raise HTTPException(status_code=400, detail="Time must be in HH:MM format")

    slot_id = f"slot_{uuid.uuid4().hex[:12]}"
    slot = AvailabilitySlot(
        slot_id=slot_id,
        user_id=current_user.user_id,
        **slot_data.dict()
    )

    await db.availability_slots.insert_one(slot.dict())
    return slot.dict()

@api_router.get("/availability/{user_id}")
async def get_executor_availability(user_id: str):
    """Get executor's availability calendar"""
    slots = await db.availability_slots.find(
        {"user_id": user_id, "is_active": True},
        {"_id": 0}
    ).sort("day_of_week", 1).to_list(100)

    return {"user_id": user_id, "slots": slots}

@api_router.get("/availability")
async def get_my_availability(current_user: User = Depends(get_current_user)):
    """Get current user's availability slots"""
    slots = await db.availability_slots.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).sort("day_of_week", 1).to_list(100)

    return {"slots": slots}

@api_router.put("/availability/{slot_id}")
async def update_availability_slot(
    slot_id: str,
    slot_update: AvailabilitySlotUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update availability slot (executor or admin)"""
    slot = await db.availability_slots.find_one({"slot_id": slot_id}, {"_id": 0})
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")

    # Check access
    if current_user.role != UserRole.ADMIN and slot["user_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    update_dict = slot_update.dict(exclude_unset=True)
    if not update_dict:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Validate day_of_week if provided
    if "day_of_week" in update_dict:
        if update_dict["day_of_week"] < 0 or update_dict["day_of_week"] > 6:
            raise HTTPException(status_code=400, detail="day_of_week must be 0-6")

    # Validate time format if provided
    if "start_time" in update_dict:
        try:
            datetime.strptime(update_dict["start_time"], "%H:%M")
        except ValueError:
            raise HTTPException(status_code=400, detail="start_time must be in HH:MM format")

    if "end_time" in update_dict:
        try:
            datetime.strptime(update_dict["end_time"], "%H:%M")
        except ValueError:
            raise HTTPException(status_code=400, detail="end_time must be in HH:MM format")

    update_dict["updated_at"] = datetime.now(timezone.utc)

    await db.availability_slots.update_one(
        {"slot_id": slot_id},
        {"$set": update_dict}
    )

    updated_slot = await db.availability_slots.find_one({"slot_id": slot_id}, {"_id": 0})
    return updated_slot

@api_router.delete("/availability/{slot_id}")
async def delete_availability_slot(slot_id: str, current_user: User = Depends(get_current_user)):
    """Delete availability slot (executor or admin)"""
    slot = await db.availability_slots.find_one({"slot_id": slot_id}, {"_id": 0})
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")

    # Check access
    if current_user.role != UserRole.ADMIN and slot["user_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    await db.availability_slots.delete_one({"slot_id": slot_id})
    return {"message": "Slot deleted successfully"}

# Pricing Routes
@api_router.get("/pricing/{executor_id}")
async def get_executor_pricing(executor_id: str):
    """Get executor's final pricing with admin commission applied"""
    # Get executor profile
    profile = await db.executor_profiles.find_one({"user_id": executor_id}, {"_id": 0})
    if not profile or not profile.get("hourly_rate"):
        raise HTTPException(status_code=404, detail="Executor pricing not found")

    base_rate = profile["hourly_rate"]

    # Get settings
    settings_doc = await db.settings.find_one({"setting_id": "app_settings"}, {"_id": 0})
    if not settings_doc:
        # Return base rate if no settings
        return {
            "executor_id": executor_id,
            "base_rate": base_rate,
            "final_rate": base_rate,
            "commission_percentage": 0,
            "commission_applied": False
        }

    settings = Settings(**settings_doc)

    # Calculate final rate
    if settings.apply_admin_commission and settings.admin_commission_percentage > 0:
        commission_amount = base_rate * (settings.admin_commission_percentage / 100)
        final_rate = base_rate + commission_amount
    else:
        final_rate = base_rate

    return {
        "executor_id": executor_id,
        "base_rate": base_rate,
        "final_rate": round(final_rate, 2),
        "commission_percentage": settings.admin_commission_percentage,
        "commission_applied": settings.apply_admin_commission
    }

@api_router.get("/executors/available")
async def get_available_executors(
    day_of_week: Optional[int] = None,
    location: Optional[str] = None,
    min_rating: Optional[float] = None,
    current_user: User = Depends(get_current_user)
):
    """Get available executors with filters (for clients)"""
    # Check if feature is enabled
    settings_doc = await db.settings.find_one({"setting_id": "app_settings"}, {"_id": 0})
    if settings_doc:
        settings = Settings(**settings_doc)
        if not settings.allow_client_executor_selection:
            raise HTTPException(
                status_code=403,
                detail="Client executor selection is disabled by admin"
            )

    # Build aggregation pipeline
    match_conditions = {"role": "provider", "is_blocked": False}

    pipeline = [
        {"$match": match_conditions},
        {"$lookup": {
            "from": "executor_profiles",
            "localField": "user_id",
            "foreignField": "user_id",
            "as": "profile"
        }},
        {"$lookup": {
            "from": "reviews",
            "localField": "user_id",
            "foreignField": "provider_id",
            "as": "reviews"
        }},
        {"$lookup": {
            "from": "availability_slots",
            "localField": "user_id",
            "foreignField": "user_id",
            "as": "availability"
        }},
        {"$addFields": {
            "profile": {"$arrayElemAt": ["$profile", 0]},
            "total_reviews": {"$size": "$reviews"},
            "average_rating": {
                "$cond": {
                    "if": {"$gt": [{"$size": "$reviews"}, 0]},
                    "then": {"$avg": "$reviews.rating"},
                    "else": 0
                }
            }
        }},
        {"$project": {
            "_id": 0,
            "password_hash": 0,
            "reviews": 0,
            "profile._id": 0,
            "availability._id": 0
        }}
    ]

    executors = await db.users.aggregate(pipeline).to_list(1000)

    # Apply filters
    filtered = []
    for executor in executors:
        # Filter by rating
        if min_rating and executor.get("average_rating", 0) < min_rating:
            continue

        # Filter by availability
        if day_of_week is not None:
            available_slots = [
                slot for slot in executor.get("availability", [])
                if slot.get("day_of_week") == day_of_week and slot.get("is_active", False)
            ]
            if not available_slots:
                continue
            executor["available_slots"] = available_slots

        # Filter by location
        if location:
            available_slots = executor.get("availability", [])
            if location:
                location_match = any(
                    location.lower() in slot.get("location", "").lower()
                    for slot in available_slots
                )
                if not location_match:
                    continue

        # Add pricing info
        if executor.get("profile") and executor["profile"].get("hourly_rate"):
            base_rate = executor["profile"]["hourly_rate"]

            # Apply commission if enabled
            if settings_doc:
                settings = Settings(**settings_doc)
                if settings.apply_admin_commission and settings.admin_commission_percentage > 0:
                    commission = base_rate * (settings.admin_commission_percentage / 100)
                    final_rate = base_rate + commission
                else:
                    final_rate = base_rate
            else:
                final_rate = base_rate

            executor["pricing"] = {
                "hourly_rate": round(final_rate, 2),
                "original_rate": base_rate
            }

        # Round rating
        if executor.get("average_rating"):
            executor["average_rating"] = round(executor["average_rating"], 2)

        filtered.append(executor)

    # Sort by rating descending
    filtered.sort(key=lambda x: x.get("average_rating", 0), reverse=True)

    return JSONResponse(content=clean_bson({"executors": filtered, "total": len(filtered)}))

# ==================== TASKER MATCHING & SCORING ALGORITHM ====================

def calculate_tasker_score(
    tasker: Dict[str, Any],
    client_lat: Optional[float] = None,
    client_lng: Optional[float] = None,
    category: Optional[str] = None,
    settings: Optional[Settings] = None
) -> float:
    """
    Calculate tasker score based on specification:
    - Relevance: 30% (skills match)
    - Distance: 15%
    - Availability: 20%
    - Rating: 10%
    - Review count: 5%
    - Response speed: 5%
    - Acceptance rate: 5%
    - Cancellation penalty: -5%
    - Price competitiveness: 5%
    - Verified badge: 5%
    """
    score = 0
    profile = tasker.get("profile", {}) or {}

    # Relevance (30%) - skills match
    if category:
        skills = profile.get("skills", [])
        if category in skills or any(category.lower() in s.lower() for s in skills):
            score += 30
        else:
            score += 15  # Partial match
    else:
        score += 30  # No category filter, full points

    # Distance (15%)
    if client_lat and client_lng:
        tasker_lat = tasker.get("latitude") or profile.get("latitude")
        tasker_lng = tasker.get("longitude") or profile.get("longitude")
        if tasker_lat and tasker_lng:
            # Simple distance calculation (Haversine would be better)
            import math
            lat_diff = abs(client_lat - tasker_lat)
            lng_diff = abs(client_lng - tasker_lng)
            approx_distance_km = math.sqrt(lat_diff**2 + lng_diff**2) * 111  # Rough km

            max_radius = settings.max_search_radius_km if settings else 100
            if approx_distance_km <= 5:
                score += 15
            elif approx_distance_km <= 15:
                score += 12
            elif approx_distance_km <= max_radius:
                score += 8
            else:
                score += 0
        else:
            score += 10  # No location data, partial points
    else:
        score += 15  # No client location, full points

    # Availability (20%)
    availability = tasker.get("availability", [])
    if availability and len(availability) > 0:
        active_slots = [s for s in availability if s.get("is_active", True)]
        if len(active_slots) >= 5:
            score += 20
        elif len(active_slots) >= 3:
            score += 15
        else:
            score += 10
    else:
        score += 10  # No availability set

    # Rating (10%)
    avg_rating = tasker.get("average_rating", 0)
    if avg_rating >= 4.8:
        score += 10
    elif avg_rating >= 4.5:
        score += 8
    elif avg_rating >= 4.0:
        score += 6
    elif avg_rating >= 3.5:
        score += 4
    else:
        score += 2

    # Review count (5%)
    review_count = tasker.get("total_reviews", 0)
    if review_count >= 50:
        score += 5
    elif review_count >= 20:
        score += 4
    elif review_count >= 10:
        score += 3
    elif review_count >= 5:
        score += 2
    else:
        score += 1

    # Response speed (5%)
    response_time = profile.get("response_time_minutes")
    if response_time:
        if response_time <= 15:
            score += 5
        elif response_time <= 30:
            score += 4
        elif response_time <= 60:
            score += 3
        else:
            score += 1
    else:
        score += 3  # Default

    # Acceptance rate (5%)
    acceptance_rate = profile.get("acceptance_rate", 100)
    if acceptance_rate >= 95:
        score += 5
    elif acceptance_rate >= 85:
        score += 4
    elif acceptance_rate >= 75:
        score += 3
    else:
        score += 1

    # Cancellation penalty (-5%)
    cancellation_count = profile.get("cancellation_count", 0)
    if cancellation_count == 0:
        pass  # No penalty
    elif cancellation_count <= 2:
        score -= 2
    elif cancellation_count <= 5:
        score -= 3
    else:
        score -= 5

    # Price competitiveness (5%) - lower hourly rate = better
    hourly_rate = profile.get("hourly_rate", 0)
    if hourly_rate:
        if hourly_rate <= 25:
            score += 5
        elif hourly_rate <= 40:
            score += 4
        elif hourly_rate <= 60:
            score += 3
        else:
            score += 1
    else:
        score += 3  # Default

    # Verified badge (5%)
    if profile.get("is_verified"):
        score += 5
    badges = profile.get("badges", [])
    if "verified" in badges or "top_rated" in badges or "elite" in badges:
        score += 2  # Bonus

    return max(0, min(100, score))  # Clamp between 0-100

@api_router.get("/taskers/search")
async def search_taskers(
    category: Optional[str] = None,
    city: Optional[str] = None,
    zip_code: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    min_rating: Optional[float] = None,
    max_price: Optional[float] = None,
    verified_only: bool = False,
    available_day: Optional[int] = None,  # 0-6 for Monday-Sunday
    sort_by: str = "score",  # score, rating, price, distance
    limit: int = 20
):
    """Search for taskers with advanced matching algorithm"""
    settings = await get_settings()

    # Build base query
    match_conditions = {"role": "provider", "is_blocked": False}

    pipeline = [
        {"$match": match_conditions},
        {"$lookup": {
            "from": "executor_profiles",
            "localField": "user_id",
            "foreignField": "user_id",
            "as": "profile"
        }},
        {"$lookup": {
            "from": "reviews",
            "localField": "user_id",
            "foreignField": "provider_id",
            "as": "reviews"
        }},
        {"$lookup": {
            "from": "availability_slots",
            "localField": "user_id",
            "foreignField": "user_id",
            "as": "availability"
        }},
        {"$lookup": {
            "from": "tasker_badges",
            "localField": "user_id",
            "foreignField": "user_id",
            "as": "badges_data"
        }},
        {"$addFields": {
            "profile": {"$arrayElemAt": ["$profile", 0]},
            "total_reviews": {"$size": "$reviews"},
            "average_rating": {
                "$cond": {
                    "if": {"$gt": [{"$size": "$reviews"}, 0]},
                    "then": {"$avg": "$reviews.rating"},
                    "else": 0
                }
            }
        }},
        {"$project": {
            "_id": 0,
            "password_hash": 0,
            "plain_password": 0,
            "reviews": 0,
            "profile._id": 0,
            "availability._id": 0,
            "badges_data._id": 0
        }}
    ]

    taskers = await db.users.aggregate(pipeline).to_list(1000)

    # Filter and score
    results = []
    for tasker in taskers:
        profile = tasker.get("profile", {}) or {}

        # Filter by category — provider must have at least one skill in that category
        if category:
            user_skills = profile.get("skills") or []
            if not user_skills or not any(_skill_matches_category(s, category) for s in user_skills):
                continue

        # Filter by rating
        if min_rating and tasker.get("average_rating", 0) < min_rating:
            continue

        # Filter by price
        if max_price and profile.get("hourly_rate", 0) > max_price:
            continue

        # Filter by verification
        if verified_only and not profile.get("is_verified"):
            continue

        # Filter by city/zip
        if city:
            service_cities = profile.get("service_cities", [])
            service_zones = profile.get("service_zones", [])
            if city.lower() not in [c.lower() for c in service_cities + service_zones]:
                continue

        if zip_code:
            service_zips = profile.get("service_zip_codes", [])
            if zip_code not in service_zips:
                continue

        # Filter by availability
        if available_day is not None:
            availability = tasker.get("availability", [])
            has_slot = any(
                slot.get("day_of_week") == available_day and slot.get("is_active", True)
                for slot in availability
            )
            if not has_slot:
                continue

        # Calculate score
        tasker["match_score"] = calculate_tasker_score(
            tasker, lat, lng, category, settings
        )

        # Add badges
        badges = [b["badge_type"] for b in tasker.get("badges_data", []) if b.get("is_active")]
        tasker["badges"] = badges

        # Clean up
        tasker.pop("badges_data", None)

        # Round rating
        if tasker.get("average_rating"):
            tasker["average_rating"] = round(tasker["average_rating"], 2)

        results.append(tasker)

    # Sort
    if sort_by == "score":
        results.sort(key=lambda x: x.get("match_score", 0), reverse=True)
    elif sort_by == "rating":
        results.sort(key=lambda x: x.get("average_rating", 0), reverse=True)
    elif sort_by == "price":
        results.sort(key=lambda x: (x.get("profile") or {}).get("hourly_rate", 999))
    elif sort_by == "reviews":
        results.sort(key=lambda x: x.get("total_reviews", 0), reverse=True)

    # Prioritize verified if enabled
    if settings.priority_verified_taskers:
        verified = [t for t in results if (t.get("profile") or {}).get("is_verified")]
        not_verified = [t for t in results if not (t.get("profile") or {}).get("is_verified")]
        results = verified + not_verified

    # Limit
    results = results[:limit]

    return JSONResponse(content=clean_bson({
        "taskers": results,
        "total": len(results),
        "filters_applied": {
            "category": category,
            "city": city,
            "verified_only": verified_only,
            "min_rating": min_rating
        }
    }))

# Admin Routes
@api_router.get("/admin/dashboard")
async def get_dashboard(current_user: User = Depends(require_admin)):
    total_users = await db.users.count_documents({})
    total_bookings = await db.bookings.count_documents({})
    total_services = await db.services.count_documents({})
    # Count bookings that are in early stages (DRAFT, POSTED, OFFERING) as pending
    pending_bookings = await db.bookings.count_documents({
        "status": {"$in": [BookingStatus.DRAFT, BookingStatus.POSTED, BookingStatus.OFFERING]}
    })

    return {
        "total_users": total_users,
        "total_bookings": total_bookings,
        "total_services": total_services,
        "pending_bookings": pending_bookings
    }

@api_router.get("/admin/users")
async def get_all_users(role: Optional[UserRole] = None, current_user: User = Depends(require_admin)):
    query = {}
    if role:
        query["role"] = role

    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).to_list(1000)
    return users

@api_router.put("/admin/users/{user_id}")
async def update_user_role(user_id: str, role: UserRole, current_user: User = Depends(require_admin)):
    result = await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"role": role}}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

    updated_user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    return updated_user

@api_router.post("/admin/users/{user_id}/block")
async def block_user(
    user_id: str,
    reason: str,
    duration_hours: Optional[int] = None,
    current_user: User = Depends(require_admin)
):
    """Block a user temporarily (with duration) or permanently (without duration)"""
    if user_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="Cannot block yourself")

    # Check if user exists
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = {
        "is_blocked": True,
        "blocked_reason": reason,
        "blocked_by": current_user.user_id
    }

    if duration_hours:
        blocked_until = datetime.now(timezone.utc) + timedelta(hours=duration_hours)
        update_data["blocked_until"] = blocked_until
    else:
        update_data["blocked_until"] = None  # Permanent block

    await db.users.update_one(
        {"user_id": user_id},
        {"$set": update_data}
    )

    # Delete all user sessions to force logout
    await db.user_sessions.delete_many({"user_id": user_id})

    block_type = f"temporarily for {duration_hours} hours" if duration_hours else "permanently"
    return {
        "message": f"User blocked {block_type}",
        "user_id": user_id,
        "blocked_until": update_data.get("blocked_until")
    }

@api_router.post("/admin/users/{user_id}/unblock")
async def unblock_user(user_id: str, current_user: User = Depends(require_admin)):
    """Unblock a user"""
    result = await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "is_blocked": False,
            "blocked_until": None,
            "blocked_reason": None,
            "blocked_by": None
        }}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

    return {"message": "User unblocked successfully", "user_id": user_id}


@api_router.post("/admin/users/{user_id}/toggle-visibility")
async def toggle_executor_visibility(user_id: str, current_user: User = Depends(require_admin)):
    """Admin toggles executor visibility in client listing"""
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("role") != "provider":
        raise HTTPException(status_code=400, detail="Only providers can have visibility toggled")

    new_hidden = not user.get("hidden_from_clients", False)
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"hidden_from_clients": new_hidden}}
    )
    return {
        "user_id": user_id,
        "hidden_from_clients": new_hidden,
        "message": f"Executor {'hidden from' if new_hidden else 'visible to'} clients"
    }


@api_router.get("/admin/executors")
async def get_all_executors_admin(current_user: User = Depends(require_admin)):
    """Admin: get all providers with full details including hidden status"""
    pipeline = [
        {"$match": {"role": "provider"}},
        {"$lookup": {
            "from": "executor_profiles",
            "localField": "user_id",
            "foreignField": "user_id",
            "as": "profile"
        }},
        {"$lookup": {
            "from": "reviews",
            "localField": "user_id",
            "foreignField": "provider_id",
            "as": "reviews"
        }},
        {"$lookup": {
            "from": "tasks",
            "let": {"uid": "$user_id"},
            "pipeline": [{"$match": {"$expr": {"$and": [
                {"$eq": ["$provider_id", "$$uid"]},
                {"$eq": ["$status", "completed"]}
            ]}}}],
            "as": "completed_tasks"
        }},
        {"$addFields": {
            "profile": {"$arrayElemAt": ["$profile", 0]},
            "total_reviews": {"$size": "$reviews"},
            "average_rating": {
                "$cond": {
                    "if": {"$gt": [{"$size": "$reviews"}, 0]},
                    "then": {"$avg": "$reviews.rating"},
                    "else": 0
                }
            },
            "completed_tasks_count": {"$size": "$completed_tasks"}
        }},
        {"$project": {"_id": 0, "password_hash": 0, "reviews": 0, "completed_tasks": 0, "profile._id": 0, "availability_slots._id": 0}},
        {"$sort": {"created_at": -1}}
    ]
    result = await db.users.aggregate(pipeline).to_list(1000)
    for r in result:
        if r.get("average_rating"):
            r["average_rating"] = round(r["average_rating"], 2)
    return JSONResponse(content=clean_bson(result))


# Admin Settings Routes
@api_router.get("/admin/settings")
async def get_admin_settings(current_user: User = Depends(require_admin)):
    """Get app settings"""
    settings = await db.settings.find_one({"setting_id": "app_settings"}, {"_id": 0})
    if not settings:
        default_settings = Settings()
        await db.settings.insert_one(default_settings.dict())
        return default_settings.dict()
    return settings

@api_router.put("/admin/settings/features")
async def update_feature_settings(
    settings_update: SettingsUpdate,
    current_user: User = Depends(require_admin)
):
    """Admin updates feature toggles and commission settings"""
    update_dict = settings_update.dict(exclude_unset=True)

    if not update_dict:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Validate commission percentage
    if settings_update.admin_commission_percentage is not None:
        if settings_update.admin_commission_percentage < 0 or settings_update.admin_commission_percentage > 100:
            raise HTTPException(
                status_code=400,
                detail="Commission percentage must be between 0 and 100"
            )

    update_dict["updated_at"] = datetime.now(timezone.utc)

    # Upsert settings
    await db.settings.update_one(
        {"setting_id": "app_settings"},
        {"$set": update_dict},
        upsert=True
    )

    updated_settings = await db.settings.find_one({"setting_id": "app_settings"}, {"_id": 0})
    return updated_settings

@api_router.get("/admin/availability/{user_id}")
async def admin_get_executor_availability(user_id: str, current_user: User = Depends(require_admin)):
    """Admin views executor's availability"""
    slots = await db.availability_slots.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("day_of_week", 1).to_list(100)

    # Get executor info
    executor = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})

    return {
        "executor": executor,
        "slots": slots
    }



@api_router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, current_user: User = Depends(require_admin)):
    """Delete a user and all their data"""
    if user_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    # Check if user exists
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")

    # Delete user and all related data
    await db.users.delete_one({"user_id": user_id})
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.bookings.delete_many({"$or": [{"client_id": user_id}, {"provider_id": user_id}]})
    await db.tasks.delete_many({"provider_id": user_id})
    await db.messages.delete_many({"$or": [{"from_user_id": user_id}, {"to_user_id": user_id}]})
    await db.reviews.delete_many({"$or": [{"client_id": user_id}, {"provider_id": user_id}]})

    return {
        "message": "User and all related data deleted successfully",
        "user_id": user_id,
        "deleted_user": user_doc["email"]
    }

@api_router.put("/admin/users/{user_id}/profile")
async def update_user_profile(
    user_id: str,
    name: Optional[str] = None,
    email: Optional[EmailStr] = None,
    phone: Optional[str] = None,
    role: Optional[UserRole] = None,
    current_user: User = Depends(require_admin)
):
    """Update user profile (admin can edit any field)"""
    update_data = {}
    if name:
        update_data["name"] = name
    if email:
        # Check if email already exists
        existing = await db.users.find_one({"email": email, "user_id": {"$ne": user_id}})
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")
        update_data["email"] = email
    if phone:
        update_data["phone"] = phone
    if role:
        update_data["role"] = role

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = await db.users.update_one(
        {"user_id": user_id},
        {"$set": update_data}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

    updated_user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    return updated_user

# Settings Routes
@api_router.get("/settings")
async def get_app_settings(current_user: User = Depends(require_admin)):
    settings = await get_settings()
    # Don't expose full API keys, only show if they exist
    return {
        "stripe_configured": bool(settings.stripe_api_key),
        "telegram_configured": bool(settings.telegram_bot_token),
        "ai_enabled": settings.ai_enabled
    }

@api_router.get("/settings/public")
async def get_public_settings():
    """Get public settings for frontend (no auth required)"""
    settings = await get_settings()
    return {
        # Language settings
        "default_language": settings.default_language or "en",
        "available_languages": settings.available_languages or ["en", "es", "uk"],
        "enable_geolocation_language": settings.enable_geolocation_language or False,
        # Currency
        "currency": settings.currency or "USD",
        "currency_symbol": settings.currency_symbol or "$",
        # Payment methods
        "payment_methods": {
            "stripe": settings.payment_methods_enabled.get("stripe", False) if settings.payment_methods_enabled else False,
            "zelle": settings.payment_methods_enabled.get("zelle", False) if settings.payment_methods_enabled else False,
            "venmo": settings.payment_methods_enabled.get("venmo", False) if settings.payment_methods_enabled else False
        },
        "stripe_public_key": settings.stripe_public_key if settings.payment_methods_enabled and settings.payment_methods_enabled.get("stripe") else None,
        "zelle_instructions": settings.zelle_instructions if settings.payment_methods_enabled and settings.payment_methods_enabled.get("zelle") else None,
        "venmo_instructions": settings.venmo_instructions if settings.payment_methods_enabled and settings.payment_methods_enabled.get("venmo") else None,
        # Push notifications
        "push_notifications_enabled": settings.send_push_notifications or False
    }

@api_router.put("/settings")
async def update_app_settings(settings_data: SettingsUpdate, current_user: User = Depends(require_admin)):
    update_dict = settings_data.dict(exclude_unset=True)
    update_dict["updated_at"] = datetime.now(timezone.utc)

    await db.settings.update_one(
        {"setting_id": "app_settings"},
        {"$set": update_dict},
        upsert=True
    )

    return {"message": "Settings updated successfully"}

async def _get_stripe_secret_key() -> Optional[str]:
    """Resolve Stripe secret key from (1) admin Integration Keys, (2) legacy settings, (3) env."""
    keys = await _get_integration_keys()
    k = keys.get("stripe_secret_key")
    if k:
        return k
    try:
        st = await get_settings()
        if getattr(st, "stripe_api_key", None):
            return st.stripe_api_key
    except Exception:
        pass
    return os.environ.get("STRIPE_API_KEY") or os.environ.get("STRIPE_SECRET_KEY")


async def _stripe_init() -> bool:
    """Initialize the stripe SDK with the resolved secret key. Returns True on success."""
    import stripe as _stripe
    key = await _get_stripe_secret_key()
    if not key:
        return False
    _stripe.api_key = key
    return True


def _normalize_frontend_origin(request: Request) -> str:
    """Pick where to send the user after Stripe checkout. Prefer the Origin/Referer
    header from the calling browser (e.g. https://handycl.netlify.app) so we don't
    redirect to the Railway backend host."""
    origin = request.headers.get("origin") or ""
    if origin and origin.startswith("http"):
        return origin.rstrip("/")
    ref = request.headers.get("referer") or ""
    if ref.startswith("http"):
        # strip path
        from urllib.parse import urlparse
        u = urlparse(ref)
        return f"{u.scheme}://{u.netloc}"
    # last-resort fallback (will point to backend; rarely correct but better than nothing)
    return str(request.base_url).rstrip("/")


# ==================== STRIPE CONNECT EXPRESS ====================

@api_router.post("/tasker/stripe-connect/onboard")
async def stripe_connect_onboard(request: Request, current_user: User = Depends(get_current_user)):
    """Create (or reuse) a Stripe Express Connected Account for the executor and
    return a one-time Account Link URL to send them to Stripe-hosted onboarding."""
    if current_user.role not in [UserRole.PROVIDER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only providers can onboard")
    if not await _stripe_init():
        raise HTTPException(status_code=500, detail="Stripe is not configured — add a Secret Key in Admin → Integrations")
    import stripe as _stripe
    # Look up existing connected account
    user = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0, "stripe_account_id": 1, "email": 1, "country": 1})
    acct_id = (user or {}).get("stripe_account_id")
    try:
        if not acct_id:
            account = await asyncio.to_thread(
                _stripe.Account.create,
                type="express",
                country=(user or {}).get("country") or "US",
                email=(user or {}).get("email") or current_user.email,
                capabilities={"transfers": {"requested": True}, "card_payments": {"requested": True}},
                business_type="individual",
                metadata={"user_id": current_user.user_id, "platform": "handyhub"},
            )
            acct_id = account.id
            await db.users.update_one(
                {"user_id": current_user.user_id},
                {"$set": {"stripe_account_id": acct_id, "stripe_connect_status": "pending"}},
            )
        frontend = _normalize_frontend_origin(request)
        link = await asyncio.to_thread(
            _stripe.AccountLink.create,
            account=acct_id,
            refresh_url=f"{frontend}/payout-setup?stripe_refresh=1",
            return_url=f"{frontend}/payout-setup?stripe_return=1",
            type="account_onboarding",
        )
        return {"url": link.url, "account_id": acct_id}
    except Exception as e:
        logger.error("Stripe Connect onboard failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Stripe error: {e}")


@api_router.get("/tasker/stripe-connect/status")
async def stripe_connect_status(current_user: User = Depends(get_current_user)):
    """Return the executor's Stripe Connect account status (charges_enabled, payouts_enabled)."""
    if current_user.role not in [UserRole.PROVIDER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only providers")
    user = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0, "stripe_account_id": 1})
    acct_id = (user or {}).get("stripe_account_id")
    if not acct_id:
        return {"connected": False, "charges_enabled": False, "payouts_enabled": False, "details_submitted": False}
    if not await _stripe_init():
        return {"connected": False, "error": "stripe_not_configured"}
    import stripe as _stripe
    try:
        acct = await asyncio.to_thread(_stripe.Account.retrieve, acct_id)
        status_doc = {
            "connected": True,
            "account_id": acct_id,
            "charges_enabled": bool(getattr(acct, "charges_enabled", False)),
            "payouts_enabled": bool(getattr(acct, "payouts_enabled", False)),
            "details_submitted": bool(getattr(acct, "details_submitted", False)),
            "requirements": (acct.requirements.to_dict() if getattr(acct, "requirements", None) else None),
        }
        # Sync our local mirror
        await db.users.update_one(
            {"user_id": current_user.user_id},
            {"$set": {
                "stripe_connect_status": "active" if status_doc["charges_enabled"] and status_doc["payouts_enabled"] else "pending",
                "stripe_charges_enabled": status_doc["charges_enabled"],
                "stripe_payouts_enabled": status_doc["payouts_enabled"],
            }},
        )
        return status_doc
    except Exception as e:
        logger.warning("Stripe status check failed: %s", e)
        return {"connected": False, "error": str(e)}


@api_router.post("/tasker/stripe-connect/dashboard-link")
async def stripe_connect_dashboard_link(current_user: User = Depends(get_current_user)):
    """Generate a one-time Stripe Express dashboard login link for the connected executor."""
    if current_user.role not in [UserRole.PROVIDER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only providers")
    user = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0, "stripe_account_id": 1})
    acct_id = (user or {}).get("stripe_account_id")
    if not acct_id:
        raise HTTPException(status_code=404, detail="Stripe Connect is not connected yet")
    if not await _stripe_init():
        raise HTTPException(status_code=500, detail="Stripe is not configured")
    import stripe as _stripe
    try:
        link = await asyncio.to_thread(_stripe.Account.create_login_link, acct_id)
        return {"url": link.url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== END STRIPE CONNECT ====================

# Payment Routes
@api_router.post("/payments/checkout")
async def create_checkout_session(
    request: Request,
    booking_id: Optional[str] = None,
    payload: Optional[Dict[str, Any]] = Body(default=None),
    current_user: User = Depends(get_current_user),
):
    """Create a Stripe Checkout session for the given booking.
    Accepts booking_id as a query param OR in JSON body {"booking_id": "..."}."""
    if payload and not booking_id:
        booking_id = payload.get("booking_id")
    if not booking_id:
        raise HTTPException(status_code=422, detail="booking_id is required")

    # Get booking
    booking = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking["client_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Resolve Stripe secret key (Integration Keys -> legacy settings -> env)
    api_key = await _get_stripe_secret_key()
    if not api_key:
        raise HTTPException(status_code=500, detail="Stripe is not configured — add a Secret Key in Admin → Integrations")

    # Compute final amount client should pay (commission already snapshotted on booking).
    # If snapshot missing/zero — recompute from category commission rate.
    amount = booking.get("total_price") or booking.get("client_total") or 0
    platform_take = float(booking.get("platform_take") or 0)
    executor_take = float(booking.get("executor_take") or 0)
    if platform_take <= 0 or executor_take <= 0:
        executor_rate = (
            float(booking.get("executor_rate") or 0)
            or float(booking.get("provider_hourly_rate") or 0)
            or float(booking.get("estimated_price") or 0)
            or float(amount or 0)
        )
        category_id = booking.get("category")
        pricing = await compute_client_pricing(executor_rate, category_id)
        amount = pricing["client_total"]
        platform_take = pricing["platform_take"]
        executor_take = pricing["executor_take"]
        try:
            await db.bookings.update_one(
                {"booking_id": booking_id},
                {"$set": {
                    "total_price": amount,
                    "executor_rate": pricing["executor_rate"],
                    "commission_rate_snapshot": pricing["commission_rate"],
                    "commission_amount": pricing["commission_amount"],
                    "platform_take": platform_take,
                    "executor_take": executor_take,
                }}
            )
            await db.tasks.update_many(
                {"booking_id": booking_id},
                {"$set": {
                    "total_price": amount,
                    "executor_take": executor_take,
                    "platform_take": platform_take,
                    "commission_rate_snapshot": pricing["commission_rate"],
                }}
            )
        except Exception as _e:
            logging.warning(f"checkout: failed to backfill booking split: {_e}")

    if not amount or amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid booking amount")

    # Default currency: USD. Override via integration_keys.stripe_currency (uah/eur/etc).
    keys = await _get_integration_keys()
    currency = (keys.get("stripe_currency") or "usd").lower()

    frontend_url = _normalize_frontend_origin(request)
    success_url = f"{frontend_url}/payment-success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{frontend_url}/payment-cancelled"

    # Look up provider's Stripe Connect account (if any) to enable auto-split
    provider_id = booking.get("provider_id")
    provider_acct_id = None
    provider_charges_enabled = False
    if provider_id:
        prov = await db.users.find_one(
            {"user_id": provider_id},
            {"_id": 0, "stripe_account_id": 1, "stripe_charges_enabled": 1},
        ) or {}
        provider_acct_id = prov.get("stripe_account_id")
        provider_charges_enabled = bool(prov.get("stripe_charges_enabled"))

    # Use native stripe SDK so we can pass transfer_data / application_fee_amount / statement_descriptor
    import stripe as _stripe
    _stripe.api_key = api_key

    # Stripe amounts are in the smallest currency unit (cents)
    amount_cents = int(round(float(amount) * 100))
    app_fee_cents = int(round(platform_take * 100)) if platform_take > 0 else 0

    pi_data: Dict[str, Any] = {
        "metadata": {"booking_id": booking_id, "user_id": current_user.user_id, "platform": "handyhub"},
        # Statement descriptor on customer's bank statement — keeps HandyHub charges
        # distinct from any other site sharing the same Stripe account (e.g. finscan.store).
        "statement_descriptor_suffix": "HANDYHUB",
    }
    enable_split = bool(provider_acct_id and provider_charges_enabled and app_fee_cents > 0 and app_fee_cents < amount_cents)
    if enable_split:
        pi_data["application_fee_amount"] = app_fee_cents
        pi_data["transfer_data"] = {"destination": provider_acct_id}

    session_params: Dict[str, Any] = {
        "mode": "payment",
        "payment_method_types": ["card"],
        "line_items": [{
            "price_data": {
                "currency": currency,
                "product_data": {
                    "name": booking.get("title") or "HandyHub — task payment",
                    "description": (booking.get("description") or "")[:200] or "HandyHub task payment",
                },
                "unit_amount": amount_cents,
            },
            "quantity": 1,
        }],
        "success_url": success_url,
        "cancel_url": cancel_url,
        "metadata": {"booking_id": booking_id, "user_id": current_user.user_id, "platform": "handyhub"},
        "payment_intent_data": pi_data,
    }

    try:
        session = await asyncio.to_thread(_stripe.checkout.Session.create, **session_params)
    except Exception as e:
        logger.error("Stripe Checkout create failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Stripe error: {e}")

    # Create payment transaction
    transaction_id = f"txn_{uuid.uuid4().hex[:12]}"
    transaction = PaymentTransaction(
        transaction_id=transaction_id,
        booking_id=booking_id,
        user_id=current_user.user_id,
        amount=float(amount),
        currency=currency,
        session_id=session.id,
        payment_status="pending",
        metadata={
            "booking_id": booking_id,
            "split_enabled": enable_split,
            "destination_account": provider_acct_id if enable_split else None,
            "application_fee_amount": app_fee_cents if enable_split else 0,
        }
    )

    await db.payment_transactions.insert_one(transaction.dict())

    # Update booking
    await db.bookings.update_one(
        {"booking_id": booking_id},
        {"$set": {"payment_session_id": session.id}}
    )

    return {"url": session.url, "session_id": session.id, "split_enabled": enable_split}

@api_router.get("/payments/status/{session_id}")
async def get_payment_status(session_id: str, current_user: User = Depends(get_current_user)):
    """Poll Stripe for the latest checkout session status and reflect it locally."""
    transaction = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if not await _stripe_init():
        raise HTTPException(status_code=500, detail="Stripe not configured")
    import stripe as _stripe
    try:
        session = await asyncio.to_thread(_stripe.checkout.Session.retrieve, session_id)
    except Exception as e:
        logger.error("Stripe Session.retrieve failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Stripe error: {e}")

    payment_status = session.get("payment_status") or "unpaid"
    amount_total = session.get("amount_total") or 0
    currency = session.get("currency") or transaction.get("currency", "usd")

    if transaction["payment_status"] != payment_status:
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"payment_status": payment_status, "updated_at": datetime.now(timezone.utc)}},
        )
        if payment_status == "paid" and transaction.get("booking_id"):
            await db.bookings.update_one(
                {"booking_id": transaction["booking_id"]},
                {"$set": {"payment_status": "paid", "paid_at": datetime.now(timezone.utc)}},
            )

    return {
        "payment_status": payment_status,
        "amount": amount_total / 100 if amount_total else 0,
        "currency": currency,
    }


async def _resolve_booking_commission(booking: Dict[str, Any]) -> float:
    """Return the platform commission (platform_take) for a booking, recomputing
    from the category rate if the snapshot is missing/zero. Commission is added
    ON TOP of the executor's price (the platform's cut the client pays us)."""
    platform_take = float(booking.get("platform_take") or 0)
    if platform_take > 0:
        return platform_take
    executor_rate = (
        float(booking.get("executor_rate") or 0)
        or float(booking.get("provider_hourly_rate") or 0)
        or float(booking.get("estimated_price") or 0)
        or float(booking.get("total_price") or 0)
    )
    pricing = await compute_client_pricing(executor_rate, booking.get("category"))
    return float(pricing["platform_take"])


@api_router.post("/payments/commission-wallet-intent")
async def create_commission_wallet_intent(
    payload: Dict[str, Any] = Body(default={}),
    current_user: User = Depends(get_current_user),
):
    """Create a Stripe PaymentIntent for the PLATFORM COMMISSION only (no Connect).
    Used by the inline Apple Pay / Google Pay (Payment Request Button) flow on web.
    The executor's portion is paid directly to the executor via manual methods."""
    booking_id = payload.get("booking_id")
    if not booking_id:
        raise HTTPException(status_code=422, detail="booking_id is required")
    booking = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking["client_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    api_key = await _get_stripe_secret_key()
    if not api_key:
        raise HTTPException(status_code=500, detail="Stripe is not configured — add a Secret Key in Admin → Integrations")

    keys = await _get_integration_keys()
    publishable_key = keys.get("stripe_publishable_key")
    if not publishable_key:
        raise HTTPException(status_code=500, detail="Stripe Publishable Key is not set in Admin → Integrations")
    currency = (keys.get("stripe_currency") or "usd").lower()

    commission = await _resolve_booking_commission(booking)
    if not commission or commission <= 0:
        raise HTTPException(status_code=400, detail="Commission is zero — nothing to pay via Stripe")
    amount_cents = int(round(float(commission) * 100))

    import stripe as _stripe
    _stripe.api_key = api_key
    try:
        intent = await asyncio.to_thread(
            _stripe.PaymentIntent.create,
            amount=amount_cents,
            currency=currency,
            automatic_payment_methods={"enabled": True, "allow_redirects": "never"},
            description=f"HandyHub commission — {booking.get('title') or booking_id}",
            statement_descriptor_suffix="HANDYHUB",
            metadata={
                "booking_id": booking_id,
                "user_id": current_user.user_id,
                "kind": "platform_commission",
                "platform": "handyhub",
            },
        )
    except Exception as e:
        logger.error("Stripe PaymentIntent create failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Stripe error: {e}")

    transaction_id = f"txn_{uuid.uuid4().hex[:12]}"
    await db.payment_transactions.insert_one(PaymentTransaction(
        transaction_id=transaction_id,
        booking_id=booking_id,
        user_id=current_user.user_id,
        amount=float(commission),
        currency=currency,
        session_id=intent.id,  # store the PaymentIntent id in session_id slot
        payment_status="pending",
        metadata={"kind": "platform_commission", "payment_intent_id": intent.id},
    ).dict())

    return {
        "client_secret": intent.client_secret,
        "publishable_key": publishable_key,
        "payment_intent_id": intent.id,
        "amount": float(commission),
        "currency": currency,
    }


@api_router.post("/payments/commission-wallet-confirm")
async def confirm_commission_wallet(
    payload: Dict[str, Any] = Body(...),
    current_user: User = Depends(get_current_user),
):
    """After the wallet confirms the PaymentIntent client-side, verify it server-side
    and mark the platform commission as paid on the booking."""
    pi_id = payload.get("payment_intent_id")
    if not pi_id:
        raise HTTPException(status_code=422, detail="payment_intent_id is required")

    api_key = await _get_stripe_secret_key()
    if not api_key:
        raise HTTPException(status_code=500, detail="Stripe is not configured")
    import stripe as _stripe
    _stripe.api_key = api_key
    try:
        intent = await asyncio.to_thread(_stripe.PaymentIntent.retrieve, pi_id)
    except Exception as e:
        logger.error("Stripe PaymentIntent.retrieve failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Stripe error: {e}")

    status = intent.get("status")
    txn = await db.payment_transactions.find_one({"session_id": pi_id}, {"_id": 0})
    booking_id = (txn or {}).get("booking_id") or (intent.get("metadata") or {}).get("booking_id")

    if status == "succeeded":
        await db.payment_transactions.update_one(
            {"session_id": pi_id},
            {"$set": {"payment_status": "paid", "updated_at": datetime.now(timezone.utc)}},
        )
        if booking_id:
            await db.bookings.update_one(
                {"booking_id": booking_id},
                {"$set": {"commission_paid": True, "commission_paid_at": datetime.now(timezone.utc)}},
            )
    return {"status": status, "paid": status == "succeeded", "booking_id": booking_id}


# ==================== FINIX (US marketplace split payments) ====================

FINIX_VERSION = "2022-02-01"


def _finix_base_url(env: Optional[str]) -> str:
    return ("https://finix.live-payments-api.com"
            if (env or "sandbox").lower() == "live"
            else "https://finix.sandbox-payments-api.com")


async def _finix_cfg() -> Optional[Dict[str, Any]]:
    """Resolve Finix config from admin Integration Keys. None when disabled/unconfigured."""
    keys = await _get_integration_keys()
    if not keys.get("enable_finix"):
        return None
    username = keys.get("finix_api_username")
    password = keys.get("finix_api_password")
    app_id = keys.get("finix_application_id")
    platform_merchant = keys.get("finix_platform_merchant_id")
    if not (username and password and app_id and platform_merchant):
        return None
    env = (keys.get("finix_environment") or "sandbox").lower()
    return {
        "base_url": _finix_base_url(env),
        "env": env,
        "auth": (username, password),
        "app_id": app_id,
        "platform_merchant": platform_merchant,
        "platform_identity": keys.get("finix_platform_identity_id"),
    }


def _finix_headers() -> Dict[str, str]:
    return {"Finix-Version": FINIX_VERSION, "Content-Type": "application/json"}


def _finix_err(resp) -> str:
    try:
        errs = resp.json().get("_embedded", {}).get("errors", [])
        if errs:
            return "; ".join(e.get("message") or e.get("code") or "error" for e in errs)
    except Exception:
        pass
    return resp.text[:300]


@api_router.post("/payments/finix/onboard-executor")
async def finix_onboard_executor(
    payload: Dict[str, Any] = Body(default={}),
    current_user: User = Depends(get_current_user),
):
    """Onboard an executor as a Finix sub-merchant (Identity + bank + Merchant).
    Provider onboards self; admin may pass {"user_id": "..."}. In sandbox the merchant
    is auto-verified so it can immediately receive split funds."""
    cfg = await _finix_cfg()
    if not cfg:
        raise HTTPException(status_code=503, detail="Finix is not configured or is disabled")

    target_id = payload.get("user_id") if current_user.role == "admin" else current_user.user_id
    target = await db.users.find_one({"user_id": target_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.get("finix_merchant_id"):
        return {"ok": True, "already_onboarded": True,
                "merchant_id": target["finix_merchant_id"],
                "onboarding_state": target.get("finix_onboarding_state")}

    full_name = (target.get("name") or "Tasker User").strip()
    parts = full_name.split(" ", 1)
    first_name = payload.get("first_name") or parts[0]
    last_name = payload.get("last_name") or (parts[1] if len(parts) > 1 else "Tasker")
    addr = payload.get("address") or {"line1": "741 Douglass St", "city": "San Mateo",
                                      "region": "CA", "postal_code": "94114", "country": "USA"}
    dob = payload.get("dob") or {"year": 1990, "month": 1, "day": 1}
    tax_id = payload.get("tax_id") or "123456789"
    # Bank account where the executor will receive payouts
    bank_account = payload.get("bank_account_number") or "123123123"
    bank_routing = payload.get("bank_routing_number") or "122105155"

    identity_payload = {"entity": {
        "first_name": first_name, "last_name": last_name,
        "email": target.get("email"), "phone": target.get("phone") or "+14155551234",
        "personal_address": addr, "dob": dob,
        "principal_percentage_ownership": 100, "title": "OWNER", "tax_id": tax_id,
        "business_name": payload.get("business_name") or f"{first_name} {last_name}",
        "business_type": payload.get("business_type") or "INDIVIDUAL_SOLE_PROPRIETORSHIP",
        "doing_business_as": payload.get("business_name") or f"{first_name} {last_name}",
        "business_phone": target.get("phone") or "+14155551234",
        "business_tax_id": tax_id, "ownership_type": "PRIVATE",
        "business_address": addr, "url": "https://hendyhub.netlify.app",
        "incorporation_date": {"year": 2018, "month": 1, "day": 1},
        "default_statement_descriptor": (first_name + " " + last_name)[:20],
        "max_transaction_amount": 1000000, "mcc": "0742", "annual_card_volume": 1000000,
    }}

    import httpx
    async with httpx.AsyncClient(timeout=40.0, auth=cfg["auth"], headers=_finix_headers()) as http:
        r1 = await http.post(f"{cfg['base_url']}/identities", json=identity_payload)
        if r1.status_code >= 400:
            raise HTTPException(status_code=400, detail=f"Finix identity: {_finix_err(r1)}")
        identity_id = r1.json()["id"]

        r2 = await http.post(f"{cfg['base_url']}/payment_instruments", json={
            "type": "BANK_ACCOUNT", "identity": identity_id, "account_type": "CHECKING",
            "name": f"{first_name} {last_name}", "account_number": str(bank_account),
            "bank_code": str(bank_routing),
        })
        if r2.status_code >= 400:
            raise HTTPException(status_code=400, detail=f"Finix bank: {_finix_err(r2)}")
        bank_pi = r2.json()["id"]

        merchant_body: Dict[str, Any] = {}
        if cfg["env"] == "sandbox":
            merchant_body["processor"] = "DUMMY_V1"
        r3 = await http.post(f"{cfg['base_url']}/identities/{identity_id}/merchants", json=merchant_body)
        if r3.status_code >= 400:
            raise HTTPException(status_code=400, detail=f"Finix merchant: {_finix_err(r3)}")
        merchant = r3.json()
        merchant_id = merchant["id"]
        onboarding_state = merchant.get("onboarding_state")

        # Sandbox: force-approve so it can receive splits right away
        if cfg["env"] == "sandbox" and onboarding_state != "APPROVED":
            try:
                await http.post(f"{cfg['base_url']}/merchants/{merchant_id}/verifications",
                                json={"processor": "DUMMY_V1"})
            except Exception:
                pass
            m = await http.get(f"{cfg['base_url']}/merchants/{merchant_id}")
            if m.status_code < 400:
                onboarding_state = m.json().get("onboarding_state") or onboarding_state

    await db.users.update_one({"user_id": target_id}, {"$set": {
        "finix_identity_id": identity_id, "finix_merchant_id": merchant_id,
        "finix_bank_pi": bank_pi, "finix_onboarding_state": onboarding_state,
        "finix_onboarded_at": datetime.now(timezone.utc),
    }})
    return {"ok": True, "identity_id": identity_id, "merchant_id": merchant_id,
            "onboarding_state": onboarding_state}


@api_router.get("/payments/finix/executor-status")
async def finix_executor_status(current_user: User = Depends(get_current_user)):
    """Return the current executor's Finix onboarding state."""
    u = await db.users.find_one({"user_id": current_user.user_id},
                                {"_id": 0, "finix_merchant_id": 1, "finix_onboarding_state": 1})
    return {
        "onboarded": bool(u and u.get("finix_merchant_id")),
        "merchant_id": (u or {}).get("finix_merchant_id"),
        "onboarding_state": (u or {}).get("finix_onboarding_state"),
    }


@api_router.post("/payments/finix/charge")
async def finix_charge(
    payload: Dict[str, Any] = Body(...),
    current_user: User = Depends(get_current_user),
):
    """Charge the client via Finix and split the funds: executor share -> executor's
    sub-merchant, commission -> platform. Amounts come from the booking's EXISTING
    split (no commission recomputation). `source` is a Finix payment-instrument token
    produced by Finix.js tokenization (card / Google Pay / Apple Pay) on the frontend."""
    cfg = await _finix_cfg()
    if not cfg:
        raise HTTPException(status_code=503, detail="Finix is not configured or is disabled")
    booking_id = payload.get("booking_id")
    source = payload.get("source")  # PIxxxx token
    if not booking_id or not source:
        raise HTTPException(status_code=422, detail="booking_id and source are required")

    booking = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking["client_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Use the EXISTING computed split — do not recompute commission.
    platform_take = float(booking.get("platform_take") or 0)
    executor_take = float(booking.get("executor_take") or 0)
    if platform_take <= 0 or executor_take <= 0:
        raise HTTPException(status_code=400, detail="The split amount is not defined for this order")
    exec_cents = int(round(executor_take * 100))
    plat_cents = int(round(platform_take * 100))
    total_cents = exec_cents + plat_cents

    provider_id = booking.get("provider_id")
    prov = await db.users.find_one({"user_id": provider_id},
                                   {"_id": 0, "finix_merchant_id": 1, "finix_onboarding_state": 1}) if provider_id else None
    exec_merchant = (prov or {}).get("finix_merchant_id")
    if not exec_merchant:
        raise HTTPException(status_code=400, detail="The pro has not connected Finix payouts yet")
    if (prov or {}).get("finix_onboarding_state") not in ("APPROVED", None):
        raise HTTPException(status_code=400, detail="The pro's Finix account is not active yet (awaiting APPROVED)")

    keys = await _get_integration_keys()
    currency = "USD"  # Finix is US-only and processes USD regardless of platform display currency

    import httpx
    # If the frontend passed a Finix.js token (TKxxx), exchange it for a PaymentInstrument
    # linked to a buyer Identity (reused per client) before charging.
    if isinstance(source, str) and source.startswith("TK"):
        async with httpx.AsyncClient(timeout=40.0, auth=cfg["auth"], headers=_finix_headers()) as http:
            buyer = await db.users.find_one({"user_id": current_user.user_id},
                                            {"_id": 0, "finix_buyer_identity_id": 1, "name": 1, "email": 1})
            buyer_identity = (buyer or {}).get("finix_buyer_identity_id")
            if not buyer_identity:
                nm = ((buyer or {}).get("name") or "Client User").split(" ", 1)
                ri = await http.post(f"{cfg['base_url']}/identities", json={"entity": {
                    "first_name": nm[0], "last_name": nm[1] if len(nm) > 1 else "Client",
                    "email": (buyer or {}).get("email"),
                }})
                if ri.status_code >= 400:
                    raise HTTPException(status_code=400, detail=f"Finix buyer: {_finix_err(ri)}")
                buyer_identity = ri.json()["id"]
                await db.users.update_one({"user_id": current_user.user_id},
                                          {"$set": {"finix_buyer_identity_id": buyer_identity}})
            rpi = await http.post(f"{cfg['base_url']}/payment_instruments",
                                  json={"type": "TOKEN", "token": source, "identity": buyer_identity})
            if rpi.status_code >= 400:
                raise HTTPException(status_code=400, detail=f"Finix card: {_finix_err(rpi)}")
            source = rpi.json()["id"]

    transfer_body = {
        "merchant": cfg["platform_merchant"], "currency": currency,
        "amount": total_cents, "source": source,
        "tags": {"booking_id": booking_id, "platform": "handyhub"},
        "split_transfers": [
            {"merchant": exec_merchant, "amount": exec_cents},
            {"merchant": cfg["platform_merchant"], "amount": plat_cents},
        ],
    }
    import httpx
    async with httpx.AsyncClient(timeout=40.0, auth=cfg["auth"], headers=_finix_headers()) as http:
        r = await http.post(f"{cfg['base_url']}/transfers", json=transfer_body)
    if r.status_code >= 400:
        logger.error("Finix transfer failed: %s", r.text[:400])
        raise HTTPException(status_code=400, detail=f"Finix: {_finix_err(r)}")
    tr = r.json()
    state = tr.get("state")

    transaction_id = f"txn_{uuid.uuid4().hex[:12]}"
    await db.payment_transactions.insert_one(PaymentTransaction(
        transaction_id=transaction_id, booking_id=booking_id, user_id=current_user.user_id,
        amount=total_cents / 100.0, currency=currency.lower(), session_id=tr.get("id"),
        payment_status="paid" if state in ("SUCCEEDED", "PENDING") else "failed",
        metadata={"gateway": "finix", "transfer_id": tr.get("id"), "state": state,
                  "executor_merchant": exec_merchant, "executor_amount": exec_cents,
                  "platform_amount": plat_cents},
    ).dict())

    if state in ("SUCCEEDED", "PENDING"):
        await db.bookings.update_one({"booking_id": booking_id},
            {"$set": {"payment_status": "paid", "paid_at": datetime.now(timezone.utc),
                      "payment_gateway": "finix"}})
        # Notify all parties that payment arrived
        try:
            title = "Payment received"
            ttl = booking.get("title") or "task"
            await notify_user(current_user.user_id, "payment_received", title,
                              f"Your payment for \"{ttl}\" was successful (${total_cents/100:.2f}).",
                              related_id=booking_id, related_type="booking")
            if provider_id:
                await notify_user(provider_id, "payment_received", title,
                                  f"The client paid for \"{ttl}\". Your share of ${executor_take:.2f} will arrive in your account.",
                                  related_id=booking_id, related_type="booking")
            admins = await db.users.find({"role": "admin"}, {"_id": 0, "user_id": 1}).to_list(50)
            for a in admins:
                await notify_user(a["user_id"], "payment_received", title,
                                  f"New payment (Finix): \"{ttl}\" — ${total_cents/100:.2f} (commission ${platform_take:.2f}).",
                                  related_id=booking_id, related_type="booking", channels=["inapp", "push"])
        except Exception as e:
            logger.warning("payment notify failed: %s", e)

    return {"ok": True, "transfer_id": tr.get("id"), "state": state,
            "amount": total_cents / 100.0,
            "split": {"executor": executor_take, "platform": platform_take}}


@api_router.post("/webhook/finix")
async def finix_webhook(request: Request):
    """Best-effort Finix webhook: update transfer status & merchant onboarding state."""
    try:
        event = await request.json()
    except Exception:
        return {"received": True}
    etype = (event.get("type") or "").lower()
    entity = event.get("entity") or ""
    obj = (event.get("_embedded") or {})
    try:
        if "transfer" in etype:
            for t in obj.get("transfers", []):
                st = t.get("state")
                await db.payment_transactions.update_one(
                    {"session_id": t.get("id")},
                    {"$set": {"payment_status": "paid" if st == "SUCCEEDED" else st,
                              "updated_at": datetime.now(timezone.utc)}})
        elif "merchant" in etype or entity == "merchant":
            for m in obj.get("merchants", []):
                await db.users.update_one(
                    {"finix_merchant_id": m.get("id")},
                    {"$set": {"finix_onboarding_state": m.get("onboarding_state")}})
    except Exception as e:
        logger.warning("Finix webhook handling error: %s", e)
    return {"received": True}




@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events (best-effort signature check if secret configured)."""
    body = await request.body()
    signature = request.headers.get("Stripe-Signature")

    if not await _stripe_init():
        raise HTTPException(status_code=500, detail="Stripe not configured")
    import stripe as _stripe

    keys = await _get_integration_keys()
    webhook_secret = keys.get("stripe_webhook_secret")

    try:
        if webhook_secret and signature:
            event = _stripe.Webhook.construct_event(body, signature, webhook_secret)
        else:
            # No webhook secret configured — accept the body unverified (dev only)
            import json as _json
            event = _json.loads(body)
    except Exception as e:
        logger.error("Stripe webhook verify failed: %s", e)
        raise HTTPException(status_code=400, detail="Invalid signature")

    et = event.get("type") if isinstance(event, dict) else event["type"]
    data = (event.get("data") if isinstance(event, dict) else event["data"])["object"]

    if et == "checkout.session.completed":
        session_id = data.get("id")
        payment_status = data.get("payment_status") or "paid"
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"payment_status": payment_status, "updated_at": datetime.now(timezone.utc)}},
        )
        # Look up the booking and mark paid
        txn = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0, "booking_id": 1, "user_id": 1})
        if txn and txn.get("booking_id"):
            await db.bookings.update_one(
                {"booking_id": txn["booking_id"]},
                {"$set": {"payment_status": "paid", "paid_at": datetime.now(timezone.utc)}},
            )
            # Notify the client
            if txn.get("user_id"):
                await notify_user(
                    txn["user_id"],
                    "payment_received",
                    "Payment received",
                    "Thank you! Your payment was successful. Funds were automatically transferred to the pro.",
                    related_id=txn["booking_id"],
                    related_type="booking",
                )

    return {"received": True}

# ==================== ESCROW / HOLD PAYMENT SYSTEM ====================

class EscrowHold(BaseModel):
    hold_id: str
    booking_id: str
    client_id: str
    tasker_id: Optional[str] = None
    amount: float
    currency: str = "USD"
    status: str = "held"  # held, released, refunded, cancelled
    payment_intent_id: Optional[str] = None
    held_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    released_at: Optional[datetime] = None
    refunded_at: Optional[datetime] = None
    release_reason: Optional[str] = None

@api_router.post("/escrow/hold")
async def create_escrow_hold(
    booking_id: str,
    current_user: User = Depends(get_current_user)
):
    """Create escrow hold for a booking payment"""
    booking = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking["client_id"] != current_user.user_id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Access denied")

    settings = await get_settings()
    if not settings.use_payment_hold:
        raise HTTPException(status_code=400, detail="Payment hold is not enabled")

    # Check if already held
    existing = await db.escrow_holds.find_one({
        "booking_id": booking_id,
        "status": "held"
    })
    if existing:
        raise HTTPException(status_code=400, detail="Payment already held for this booking")

    hold_id = f"hold_{uuid.uuid4().hex[:12]}"

    hold = {
        "hold_id": hold_id,
        "booking_id": booking_id,
        "client_id": booking["client_id"],
        "tasker_id": booking.get("provider_id"),
        "amount": booking["total_price"],
        "currency": "USD",
        "status": "held",
        "held_at": datetime.now(timezone.utc)
    }

    await db.escrow_holds.insert_one(hold)

    # Update booking status
    await db.bookings.update_one(
        {"booking_id": booking_id},
        {"$set": {
            "status": BookingStatus.HOLD_PLACED,
            "payment_hold_placed": True,
            "updated_at": datetime.now(timezone.utc)
        }}
    )

    # Log status change
    await log_status_change(
        booking_id, "booking", booking.get("status"), BookingStatus.HOLD_PLACED,
        current_user.user_id, "Payment hold placed"
    )

    hold.pop("_id", None)
    return hold

@api_router.post("/escrow/release")
async def release_escrow(
    booking_id: str,
    release_reason: str = "Job completed successfully",
    current_user: User = Depends(get_current_user)
):
    """Release escrow funds to tasker after job completion"""
    booking = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Only client or admin can release
    if booking["client_id"] != current_user.user_id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Access denied")

    # Find active hold
    hold = await db.escrow_holds.find_one({
        "booking_id": booking_id,
        "status": "held"
    }, {"_id": 0})

    if not hold:
        raise HTTPException(status_code=404, detail="No active hold found for this booking")

    # Update hold status
    await db.escrow_holds.update_one(
        {"hold_id": hold["hold_id"]},
        {"$set": {
            "status": "released",
            "released_at": datetime.now(timezone.utc),
            "release_reason": release_reason
        }}
    )

    # Update booking
    await db.bookings.update_one(
        {"booking_id": booking_id},
        {"$set": {
            "status": BookingStatus.PAID,
            "payment_captured": True,
            "payment_status": "paid",
            "updated_at": datetime.now(timezone.utc)
        }}
    )

    # Create payout record for tasker
    if booking.get("provider_id"):
        settings = await get_settings()
        commission = hold["amount"] * (settings.admin_commission_percentage / 100)
        net_amount = hold["amount"] - commission

        payout_id = f"payout_{uuid.uuid4().hex[:12]}"
        payout = {
            "payout_id": payout_id,
            "user_id": booking["provider_id"],
            "payout_account_id": None,  # Will be filled when tasker has account
            "amount": hold["amount"],
            "currency": "USD",
            "status": "pending",
            "job_ids": [booking_id],
            "commission_deducted": round(commission, 2),
            "net_amount": round(net_amount, 2),
            "scheduled_date": datetime.now(timezone.utc) + timedelta(days=settings.payout_delay_days),
            "created_at": datetime.now(timezone.utc)
        }
        await db.payouts.insert_one(payout)

    # Log status change
    await log_status_change(
        booking_id, "booking", BookingStatus.HOLD_PLACED, BookingStatus.PAID,
        current_user.user_id, release_reason
    )

    return {"message": "Escrow released successfully", "booking_id": booking_id}

@api_router.post("/escrow/refund")
async def refund_escrow(
    booking_id: str,
    refund_reason: str,
    refund_amount: Optional[float] = None,  # Full refund if None
    current_user: User = Depends(get_current_user)
):
    """Refund escrow funds to client"""
    booking = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Only admin can refund
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can process refunds")

    # Find active hold
    hold = await db.escrow_holds.find_one({
        "booking_id": booking_id,
        "status": "held"
    }, {"_id": 0})

    if not hold:
        raise HTTPException(status_code=404, detail="No active hold found for this booking")

    actual_refund = refund_amount if refund_amount else hold["amount"]

    # Update hold status
    await db.escrow_holds.update_one(
        {"hold_id": hold["hold_id"]},
        {"$set": {
            "status": "refunded",
            "refunded_at": datetime.now(timezone.utc),
            "release_reason": refund_reason
        }}
    )

    # Create refund record
    refund_id = f"refund_{uuid.uuid4().hex[:12]}"
    refund = {
        "refund_id": refund_id,
        "booking_id": booking_id,
        "user_id": booking["client_id"],
        "amount": actual_refund,
        "reason": refund_reason,
        "status": "completed",
        "approved_by": current_user.user_id,
        "approved_at": datetime.now(timezone.utc),
        "processed_at": datetime.now(timezone.utc),
        "created_at": datetime.now(timezone.utc)
    }
    await db.refunds.insert_one(refund)

    # Update booking
    await db.bookings.update_one(
        {"booking_id": booking_id},
        {"$set": {
            "status": BookingStatus.CANCELLED_BY_CLIENT,
            "payment_status": "refunded",
            "updated_at": datetime.now(timezone.utc)
        }}
    )

    return {"message": "Refund processed", "refund_amount": actual_refund}

@api_router.get("/escrow/status/{booking_id}")
async def get_escrow_status(
    booking_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get escrow status for a booking"""
    booking = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Check access
    if current_user.role != UserRole.ADMIN:
        if booking["client_id"] != current_user.user_id and booking.get("provider_id") != current_user.user_id:
            raise HTTPException(status_code=403, detail="Access denied")

    hold = await db.escrow_holds.find_one({"booking_id": booking_id}, {"_id": 0})

    return {
        "booking_id": booking_id,
        "has_hold": hold is not None,
        "hold": hold,
        "booking_status": booking.get("status"),
        "payment_status": booking.get("payment_status")
    }

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    full_name: Optional[str] = None  # alias for name
    phone: Optional[str] = None
    address: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    picture: Optional[str] = None

# User Profile Routes
@api_router.put("/users/profile")
async def update_profile(
    profile_data: ProfileUpdate,
    current_user: User = Depends(get_current_user)
):
    update_data = {}
    # Accept both 'name' and 'full_name'
    new_name = profile_data.full_name or profile_data.name
    if new_name:
        update_data["name"] = new_name
        update_data["full_name"] = new_name
    if profile_data.phone:
        update_data["phone"] = profile_data.phone
    if profile_data.address is not None:
        update_data["address"] = profile_data.address
    if profile_data.telegram_chat_id:
        update_data["telegram_chat_id"] = profile_data.telegram_chat_id
    if profile_data.picture is not None:
        update_data["picture"] = profile_data.picture if profile_data.picture else None

    if update_data:
        await db.users.update_one(
            {"user_id": current_user.user_id},
            {"$set": update_data}
        )

    updated_user = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0, "password_hash": 0})
    return updated_user

# ==================== OFFERS ENDPOINTS ====================

@api_router.post("/offers")
async def create_offer(offer_data: OfferCreate, current_user: User = Depends(get_current_user)):
    """Tasker creates an offer for a task"""
    if current_user.role != UserRole.PROVIDER:
        raise HTTPException(status_code=403, detail="Only taskers can create offers")

    # Check booking exists and allows offers
    booking = await db.bookings.find_one({"booking_id": offer_data.booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if not booking.get("allow_offers"):
        raise HTTPException(status_code=400, detail="This task doesn't accept offers")

    if booking["status"] not in [BookingStatus.POSTED, BookingStatus.OFFERING]:
        raise HTTPException(status_code=400, detail="Cannot send offer for this task status")

    # Check if already sent offer
    existing = await db.offers.find_one({
        "booking_id": offer_data.booking_id,
        "tasker_id": current_user.user_id,
        "status": OfferStatus.PENDING
    })
    if existing:
        raise HTTPException(status_code=400, detail="You already have a pending offer")

    offer_id = f"offer_{uuid.uuid4().hex[:12]}"
    offer = Offer(
        offer_id=offer_id,
        tasker_id=current_user.user_id,
        **offer_data.dict()
    )

    await db.offers.insert_one(offer.dict())

    # Update booking offers count
    await db.bookings.update_one(
        {"booking_id": offer_data.booking_id},
        {"$inc": {"offers_count": 1}, "$set": {"status": BookingStatus.OFFERING}}
    )

    return offer.dict()

@api_router.get("/offers/booking/{booking_id}")
async def get_booking_offers(booking_id: str, current_user: User = Depends(get_current_user)):
    """Get all offers for a booking (client or admin)"""
    booking = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Only client owner or admin
    if current_user.role != UserRole.ADMIN and booking["client_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    offers = await db.offers.find({"booking_id": booking_id}, {"_id": 0}).to_list(100)

    # Enrich with tasker info
    for offer in offers:
        tasker = await db.users.find_one({"user_id": offer["tasker_id"]}, {"_id": 0, "password_hash": 0})
        offer["tasker"] = tasker
        profile = await db.executor_profiles.find_one({"user_id": offer["tasker_id"]}, {"_id": 0})
        offer["tasker_profile"] = profile

    return offers

@api_router.get("/offers/my")
async def get_my_offers(current_user: User = Depends(get_current_user)):
    """Tasker gets their sent offers"""
    if current_user.role != UserRole.PROVIDER:
        raise HTTPException(status_code=403, detail="Only taskers have offers")

    offers = await db.offers.find({"tasker_id": current_user.user_id}, {"_id": 0}).to_list(100)

    for offer in offers:
        booking = await db.bookings.find_one({"booking_id": offer["booking_id"]}, {"_id": 0})
        offer["booking"] = booking

    return offers

@api_router.post("/offers/{offer_id}/accept")
async def accept_offer(offer_id: str, current_user: User = Depends(get_current_user)):
    """Client accepts an offer"""
    offer = await db.offers.find_one({"offer_id": offer_id}, {"_id": 0})
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")

    booking = await db.bookings.find_one({"booking_id": offer["booking_id"]}, {"_id": 0})
    if booking["client_id"] != current_user.user_id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only booking owner can accept offers")

    # Update offer status
    await db.offers.update_one(
        {"offer_id": offer_id},
        {"$set": {"status": OfferStatus.ACCEPTED}}
    )

    # Decline other offers
    await db.offers.update_many(
        {"booking_id": offer["booking_id"], "offer_id": {"$ne": offer_id}},
        {"$set": {"status": OfferStatus.DECLINED}}
    )

    # Update booking
    await db.bookings.update_one(
        {"booking_id": offer["booking_id"]},
        {"$set": {
            "status": BookingStatus.ASSIGNED,
            "provider_id": offer["tasker_id"],
            "final_price": offer["proposed_price"],
            "selected_offer_id": offer_id
        }}
    )

    return {"message": "Offer accepted", "offer_id": offer_id}

@api_router.post("/offers/{offer_id}/decline")
async def decline_offer(offer_id: str, current_user: User = Depends(get_current_user)):
    """Client declines an offer"""
    offer = await db.offers.find_one({"offer_id": offer_id}, {"_id": 0})
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")

    booking = await db.bookings.find_one({"booking_id": offer["booking_id"]}, {"_id": 0})
    if booking["client_id"] != current_user.user_id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only booking owner can decline offers")

    await db.offers.update_one(
        {"offer_id": offer_id},
        {"$set": {"status": OfferStatus.DECLINED}}
    )

    return {"message": "Offer declined"}

@api_router.delete("/offers/{offer_id}")
async def withdraw_offer(offer_id: str, current_user: User = Depends(get_current_user)):
    """Tasker withdraws their offer"""
    offer = await db.offers.find_one({"offer_id": offer_id}, {"_id": 0})
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")

    if offer["tasker_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Can only withdraw your own offers")

    if offer["status"] != OfferStatus.PENDING:
        raise HTTPException(status_code=400, detail="Can only withdraw pending offers")

    await db.offers.update_one(
        {"offer_id": offer_id},
        {"$set": {"status": OfferStatus.WITHDRAWN}}
    )

    await db.bookings.update_one(
        {"booking_id": offer["booking_id"]},
        {"$inc": {"offers_count": -1}}
    )

    return {"message": "Offer withdrawn"}

# ==================== DISPUTES ENDPOINTS ====================

@api_router.post("/disputes")
async def create_dispute(dispute_data: DisputeCreate, current_user: User = Depends(get_current_user)):
    """Create a dispute for a booking"""
    booking = await db.bookings.find_one({"booking_id": dispute_data.booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Check user is part of booking
    if current_user.user_id not in [booking["client_id"], booking.get("provider_id")]:
        raise HTTPException(status_code=403, detail="You're not part of this booking")

    # Determine against whom
    against = booking["provider_id"] if current_user.user_id == booking["client_id"] else booking["client_id"]

    dispute_id = f"dispute_{uuid.uuid4().hex[:12]}"
    dispute = Dispute(
        dispute_id=dispute_id,
        booking_id=dispute_data.booking_id,
        raised_by=current_user.user_id,
        against=against,
        reason=dispute_data.reason,
        description=dispute_data.description
    )

    await db.disputes.insert_one(dispute.dict())

    # Update booking status
    await db.bookings.update_one(
        {"booking_id": dispute_data.booking_id},
        {"$set": {"status": BookingStatus.DISPUTE}}
    )

    return dispute.dict()

@api_router.get("/disputes")
async def get_disputes(current_user: User = Depends(get_current_user)):
    """Get disputes (admin sees all, users see their own)"""
    if current_user.role == UserRole.ADMIN:
        disputes = await db.disputes.find({}, {"_id": 0}).to_list(100)
    else:
        disputes = await db.disputes.find(
            {"$or": [{"raised_by": current_user.user_id}, {"against": current_user.user_id}]},
            {"_id": 0}
        ).to_list(100)

    for dispute in disputes:
        booking = await db.bookings.find_one({"booking_id": dispute["booking_id"]}, {"_id": 0})
        dispute["booking"] = booking

    return disputes

@api_router.put("/admin/disputes/{dispute_id}")
async def resolve_dispute(
    dispute_id: str,
    status: str,
    resolution: Optional[str] = None,
    refund_amount: Optional[float] = None,
    admin_notes: Optional[str] = None,
    current_user: User = Depends(require_admin)
):
    """Admin resolves a dispute"""
    dispute = await db.disputes.find_one({"dispute_id": dispute_id}, {"_id": 0})
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")

    update_data = {
        "status": status,
        "resolution": resolution,
        "admin_notes": admin_notes
    }
    if refund_amount is not None:
        update_data["refund_amount"] = refund_amount
    if status in ["resolved", "closed"]:
        update_data["resolved_at"] = datetime.now(timezone.utc)

    await db.disputes.update_one(
        {"dispute_id": dispute_id},
        {"$set": update_data}
    )

    return {"message": "Dispute updated"}

# ==================== PROMO CODES ENDPOINTS ====================

@api_router.post("/admin/promo-codes")
async def create_promo_code(promo_data: PromoCodeCreate, current_user: User = Depends(require_admin)):
    """Admin creates promo code"""
    # Check code doesn't exist
    existing = await db.promo_codes.find_one({"code": promo_data.code.upper()})
    if existing:
        raise HTTPException(status_code=400, detail="Code already exists")

    code_id = f"promo_{uuid.uuid4().hex[:8]}"
    promo = PromoCode(
        code_id=code_id,
        code=promo_data.code.upper(),
        discount_type=promo_data.discount_type,
        discount_value=promo_data.discount_value,
        min_order_amount=promo_data.min_order_amount,
        max_uses=promo_data.max_uses,
        valid_from=datetime.fromisoformat(promo_data.valid_from) if promo_data.valid_from else None,
        valid_until=datetime.fromisoformat(promo_data.valid_until) if promo_data.valid_until else None
    )

    await db.promo_codes.insert_one(promo.dict())
    return promo.dict()

@api_router.get("/admin/promo-codes")
async def get_promo_codes(current_user: User = Depends(require_admin)):
    """Get all promo codes"""
    codes = await db.promo_codes.find({}, {"_id": 0}).to_list(100)
    return codes

@api_router.delete("/admin/promo-codes/{code_id}")
async def delete_promo_code(code_id: str, current_user: User = Depends(require_admin)):
    """Delete promo code"""
    result = await db.promo_codes.delete_one({"code_id": code_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Code not found")
    return {"message": "Code deleted"}

@api_router.post("/promo-codes/validate")
async def validate_promo_code(code: str, amount: float, current_user: User = Depends(get_current_user)):
    """Validate and calculate discount for promo code"""
    promo = await db.promo_codes.find_one({"code": code.upper(), "is_active": True}, {"_id": 0})
    if not promo:
        raise HTTPException(status_code=404, detail="Invalid or expired code")

    now = datetime.now(timezone.utc)
    if promo.get("valid_from") and promo["valid_from"] > now:
        raise HTTPException(status_code=400, detail="Code not yet valid")
    if promo.get("valid_until") and promo["valid_until"] < now:
        raise HTTPException(status_code=400, detail="Code expired")
    if promo.get("max_uses") and promo["uses_count"] >= promo["max_uses"]:
        raise HTTPException(status_code=400, detail="Code usage limit reached")
    if promo.get("min_order_amount") and amount < promo["min_order_amount"]:
        raise HTTPException(status_code=400, detail=f"Minimum order amount is ${promo['min_order_amount']}")

    # Calculate discount
    if promo["discount_type"] == "percent":
        discount = amount * (promo["discount_value"] / 100)
    else:
        discount = min(promo["discount_value"], amount)

    return {
        "valid": True,
        "discount": round(discount, 2),
        "final_amount": round(amount - discount, 2),
        "code": promo["code"]
    }

# ==================== CATEGORIES ENDPOINTS ====================

class CategoryCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    image: Optional[str] = None  # base64 data URL for cover photo
    parent_id: Optional[str] = None
    commission_rate: Optional[float] = 0.0  # platform commission %
    recommended_price: Optional[float] = None  # recommended price for executor

class CategoryUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    image: Optional[str] = None
    parent_id: Optional[str] = None
    commission_rate: Optional[float] = None
    recommended_price: Optional[float] = None
    is_active: Optional[bool] = None


@api_router.get("/categories")
async def get_categories(include_image: bool = False):
    """Get all active service categories (public).

    The cover image is excluded by default because it's a base64 data URL
    that can be 5-10 MB per category, which makes the home grid request
    timeout on mobile networks. Frontend uses a fallback Unsplash photo
    based on the category id; to fetch the actual cover image pass
    ?include_image=true or call GET /api/categories/{id}.
    """
    projection = {"_id": 0} if include_image else {"_id": 0, "image": 0}
    categories = await db.categories.find({"is_active": True}, projection).to_list(100)
    if not categories:
        # Return enum values if no custom categories
        return [{"id": cat.value, "name": cat.value.replace("_", " ").title()} for cat in ServiceCategory]
    # Flag presence of image so the frontend knows it's available on demand
    if not include_image:
        for c in categories:
            c["has_image"] = False  # placeholder; populated below from a 2nd query
        # One small query to mark which categories have an image — uses
        # projection so it doesn't pull the actual bytes.
        ids_with_image = await db.categories.find(
            {"is_active": True, "image": {"$ne": None, "$exists": True}},
            {"_id": 0, "category_id": 1},
        ).to_list(100)
        with_image_ids = {x["category_id"] for x in ids_with_image if x.get("category_id")}
        for c in categories:
            c["has_image"] = (c.get("category_id") in with_image_ids)
    return categories


@api_router.get("/categories/{category_id}")
async def get_category_one(category_id: str):
    """Get a single category including its cover image (full payload)."""
    c = await db.categories.find_one({"category_id": category_id}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Category not found")
    return c


@api_router.get("/admin/categories")
async def admin_get_categories(
    include_inactive: bool = True,
    include_image: bool = False,
    current_user: User = Depends(require_admin)
):
    """Admin: get all categories. Image excluded by default for performance —
    the edit modal fetches the single category via /admin/categories/{id}.
    """
    query = {} if include_inactive else {"is_active": True}
    projection = {"_id": 0} if include_image else {"_id": 0, "image": 0}
    categories = await db.categories.find(query, projection).sort("created_at", -1).to_list(500)
    if not include_image:
        ids_with_image = await db.categories.find(
            {"image": {"$ne": None, "$exists": True}},
            {"_id": 0, "category_id": 1},
        ).to_list(500)
        with_image_ids = {x["category_id"] for x in ids_with_image if x.get("category_id")}
        for c in categories:
            c["has_image"] = (c.get("category_id") in with_image_ids)
    return categories


@api_router.get("/admin/categories/{category_id}")
async def admin_get_category_one(
    category_id: str,
    current_user: User = Depends(require_admin)
):
    """Admin: fetch a single category with full payload (image included)."""
    c = await db.categories.find_one({"category_id": category_id}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Category not found")
    return c


@api_router.post("/admin/categories")
async def create_category(
    payload: CategoryCreateRequest,
    current_user: User = Depends(require_admin)
):
    """Admin creates a category. Accepts JSON body (supports base64 image)."""
    cat_id = f"cat_{uuid.uuid4().hex[:8]}"
    category = {
        "category_id": cat_id,
        "name": payload.name,
        "description": payload.description,
        "icon": payload.icon,
        "image": payload.image,
        "parent_id": payload.parent_id,
        "commission_rate": float(payload.commission_rate or 0.0),
        "recommended_price": float(payload.recommended_price) if payload.recommended_price is not None else None,
        "is_active": True,
        "created_at": datetime.now(timezone.utc)
    }
    await db.categories.insert_one(category)
    category.pop("_id", None)
    return category


@api_router.put("/admin/categories/{category_id}")
async def update_category(
    category_id: str,
    payload: CategoryUpdateRequest,
    current_user: User = Depends(require_admin)
):
    """Admin updates a category. Accepts JSON body (supports base64 image)."""
    existing = await db.categories.find_one({"category_id": category_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Category not found")

    update_data = {}
    data = payload.model_dump(exclude_unset=True)

    if "name" in data and data["name"] is not None:
        update_data["name"] = data["name"]
    if "description" in data:
        update_data["description"] = data["description"]
    if "icon" in data:
        update_data["icon"] = data["icon"]
    if "image" in data:
        update_data["image"] = data["image"]
    if "parent_id" in data:
        update_data["parent_id"] = data["parent_id"]
    if "commission_rate" in data and data["commission_rate"] is not None:
        update_data["commission_rate"] = float(data["commission_rate"])
    if "recommended_price" in data:
        update_data["recommended_price"] = (
            float(data["recommended_price"]) if data["recommended_price"] is not None else None
        )
    if "is_active" in data and data["is_active"] is not None:
        update_data["is_active"] = bool(data["is_active"])

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    update_data["updated_at"] = datetime.now(timezone.utc)
    await db.categories.update_one({"category_id": category_id}, {"$set": update_data})
    updated = await db.categories.find_one({"category_id": category_id}, {"_id": 0})
    return updated or {"message": "Category updated"}


@api_router.post("/admin/categories/cleanup-oversized-images")
async def cleanup_oversized_category_images(
    max_kb: int = 500,
    current_user: User = Depends(require_admin)
):
    """Clear cover image from categories whose image exceeds `max_kb` KB.

    Used as a one-shot fix after legacy admins uploaded multi-MB phone
    photos before frontend compression existed — those entries make
    GET /api/categories time out for clients.
    """
    threshold_bytes = max_kb * 1024
    docs = await db.categories.find(
        {"image": {"$ne": None, "$exists": True}},
        {"_id": 0, "category_id": 1, "image": 1, "name": 1},
    ).to_list(500)
    cleared = []
    for d in docs:
        img = d.get("image") or ""
        if len(img) > threshold_bytes:
            await db.categories.update_one(
                {"category_id": d["category_id"]},
                {"$set": {"image": None, "updated_at": datetime.now(timezone.utc)}},
            )
            cleared.append({"category_id": d["category_id"], "name": d.get("name"), "size_kb": round(len(img) / 1024, 1)})
    return {"cleared": cleared, "count": len(cleared), "threshold_kb": max_kb}


class ProviderLocationUpdate(BaseModel):
    user_id: str
    city: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    service_radius_km: Optional[float] = None
    service_cities: Optional[List[str]] = None


@api_router.post("/admin/providers/{user_id}/set-location")
async def admin_set_provider_location(
    user_id: str,
    payload: ProviderLocationUpdate,
    current_user: User = Depends(require_admin)
):
    """Admin: manually set a provider's service-area location.

    Used to fix providers whose profile has stale/default coordinates
    (e.g. Chicago defaults instead of Kyiv) so that geo-filtered search
    correctly returns them for nearby clients.
    """
    user = await db.users.find_one({"user_id": user_id, "role": "provider"}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Provider not found")

    profile_update: Dict[str, Any] = {}
    user_update: Dict[str, Any] = {}
    if payload.city is not None:
        profile_update["city"] = payload.city
        user_update["city"] = payload.city
    if payload.latitude is not None:
        profile_update["latitude"] = float(payload.latitude)
        user_update["latitude"] = float(payload.latitude)
    if payload.longitude is not None:
        profile_update["longitude"] = float(payload.longitude)
        user_update["longitude"] = float(payload.longitude)
    if payload.service_radius_km is not None:
        profile_update["service_radius_km"] = float(payload.service_radius_km)
    if payload.service_cities is not None:
        profile_update["service_cities"] = list(payload.service_cities)

    if profile_update:
        profile_update["updated_at"] = datetime.now(timezone.utc)
        await db.executor_profiles.update_one(
            {"user_id": user_id},
            {"$set": profile_update},
            upsert=True,
        )
    if user_update:
        await db.users.update_one({"user_id": user_id}, {"$set": user_update})

    return {"ok": True, "user_id": user_id, "applied": profile_update}


@api_router.delete("/admin/categories/{category_id}")
async def delete_category(
    category_id: str,
    hard: bool = False,
    current_user: User = Depends(require_admin)
):
    """Admin deletes a category. Default: soft-delete (is_active=False). Pass ?hard=true to remove from DB."""
    existing = await db.categories.find_one({"category_id": category_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Category not found")

    if hard:
        await db.categories.delete_one({"category_id": category_id})
        return {"message": "Category deleted", "category_id": category_id, "hard": True}

    await db.categories.update_one(
        {"category_id": category_id},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc)}}
    )
    return {"message": "Category deactivated", "category_id": category_id, "hard": False}

# ==================== TASKER EARNINGS ENDPOINTS ====================

@api_router.get("/earnings")
async def get_my_earnings(current_user: User = Depends(get_current_user)):
    """Tasker gets their earnings summary"""
    if current_user.role != UserRole.PROVIDER:
        raise HTTPException(status_code=403, detail="Only taskers have earnings")

    # Get completed tasks
    pipeline = [
        {"$match": {"provider_id": current_user.user_id, "status": TaskStatus.PAID}},
        {"$group": {
            "_id": None,
            "total_earnings": {"$sum": "$final_price"},
            "total_tips": {"$sum": {"$ifNull": ["$tip_amount", 0]}},
            "total_jobs": {"$sum": 1},
            "total_hours": {"$sum": {"$ifNull": ["$actual_hours", 0]}}
        }}
    ]

    result = await db.tasks.aggregate(pipeline).to_list(1)

    # Get pending payouts
    pending = await db.tasks.find({
        "provider_id": current_user.user_id,
        "status": TaskStatus.COMPLETED_PENDING_PAYMENT
    }, {"_id": 0}).to_list(100)

    pending_amount = sum(t.get("final_price", 0) for t in pending)

    earnings = result[0] if result else {
        "total_earnings": 0,
        "total_tips": 0,
        "total_jobs": 0,
        "total_hours": 0
    }
    earnings["pending_amount"] = pending_amount
    earnings["_id"] = None

    return JSONResponse(content=clean_bson(earnings))

@api_router.get("/earnings/history")
async def get_earnings_history(
    limit: int = 50,
    current_user: User = Depends(get_current_user)
):
    """Get tasker's completed jobs history"""
    if current_user.role != UserRole.PROVIDER:
        raise HTTPException(status_code=403, detail="Only taskers have earnings")

    tasks = await db.tasks.find(
        {"provider_id": current_user.user_id, "status": {"$in": [TaskStatus.PAID, TaskStatus.COMPLETED_PENDING_PAYMENT]}},
        {"_id": 0}
    ).sort("completed_at", -1).limit(limit).to_list(limit)

    for task in tasks:
        client = await db.users.find_one({"user_id": task["client_id"]}, {"_id": 0, "password_hash": 0})
        task["client"] = client

    return tasks

# ==================== EARNINGS PDF REPORT ====================

@api_router.get("/earnings/report")
async def get_earnings_report(
    type: str = Query("monthly", regex="^(monthly|yearly|tax)$"),
    month: Optional[str] = None,  # 'YYYY-MM'
    year: Optional[str] = None,   # 'YYYY'
    current_user: User = Depends(get_current_user)
):
    """Generate PDF earnings report for executor.
    type=monthly: requires month (YYYY-MM). Lists paid tasks for that month.
    type=yearly: requires year (YYYY). Lists all paid tasks for that year, grouped by month.
    type=tax: same as yearly but includes a tax summary block (gross income, platform commission, net).
    """
    if current_user.role != UserRole.PROVIDER:
        raise HTTPException(status_code=403, detail="Only taskers can download earnings reports")

    from io import BytesIO
    from datetime import datetime as _dt
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib import colors
    from reportlab.lib.units import cm
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
    )

    # Register a Unicode-capable font (DejaVu or Liberation) for Ukrainian/Cyrillic chars
    font_name = "Helvetica"
    font_bold = "Helvetica-Bold"
    candidates = [
        ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
        ("/usr/share/fonts/dejavu/DejaVuSans.ttf", "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf"),
        ("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"),
    ]
    for reg_path, bold_path in candidates:
        try:
            if os.path.exists(reg_path):
                pdfmetrics.registerFont(TTFont("UniFont", reg_path))
                font_name = "UniFont"
                if bold_path and os.path.exists(bold_path):
                    pdfmetrics.registerFont(TTFont("UniFont-Bold", bold_path))
                    font_bold = "UniFont-Bold"
                else:
                    font_bold = "UniFont"
                break
        except Exception:
            pass

    # Build date filter
    now = datetime.now(timezone.utc)
    if type == "monthly":
        if not month or not re.match(r"^\d{4}-\d{2}$", month):
            raise HTTPException(status_code=400, detail="Parameter 'month' must be YYYY-MM")
        y, m = int(month.split("-")[0]), int(month.split("-")[1])
        period_start = datetime(y, m, 1, tzinfo=timezone.utc)
        if m == 12:
            period_end = datetime(y + 1, 1, 1, tzinfo=timezone.utc)
        else:
            period_end = datetime(y, m + 1, 1, tzinfo=timezone.utc)
        period_label = f"{['January','February','March','April','May','June','July','August','September','October','November','December'][m-1]} {y}"
        filename = f"earnings_{month}.pdf"
    else:
        if not year or not re.match(r"^\d{4}$", year):
            year = str(now.year)
        y = int(year)
        period_start = datetime(y, 1, 1, tzinfo=timezone.utc)
        period_end = datetime(y + 1, 1, 1, tzinfo=timezone.utc)
        period_label = f"{y}"
        filename = f"{'tax' if type == 'tax' else 'earnings'}_{y}.pdf"

    # Fetch paid tasks for the period
    tasks = await db.tasks.find({
        "provider_id": current_user.user_id,
        "status": TaskStatus.PAID,
    }, {"_id": 0}).to_list(5000)

    def _to_dt(v):
        if not v:
            return None
        if isinstance(v, datetime):
            return v if v.tzinfo else v.replace(tzinfo=timezone.utc)
        try:
            s = str(v)
            if s.endswith("Z"):
                s = s[:-1] + "+00:00"
            return datetime.fromisoformat(s)
        except Exception:
            return None

    filtered = []
    for t in tasks:
        dt = _to_dt(t.get("paid_at") or t.get("completed_at") or t.get("updated_at"))
        if dt and period_start <= dt < period_end:
            t["_dt"] = dt
            filtered.append(t)
    filtered.sort(key=lambda x: x["_dt"])

    # Aggregates
    total_gross = sum(float(t.get("final_price") or 0) for t in filtered)
    total_tips = sum(float(t.get("tip_amount") or 0) for t in filtered)
    total_commission = sum(float(t.get("commission_amount") or 0) for t in filtered)
    # provider_payout is what executor actually received (already excludes platform commission)
    total_net = sum(float(t.get("provider_payout") or t.get("final_price") or 0) for t in filtered)
    total_jobs = len(filtered)
    total_hours = sum(float(t.get("actual_hours") or 0) for t in filtered)

    # Build PDF
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=1.6*cm, rightMargin=1.6*cm, topMargin=1.6*cm, bottomMargin=1.6*cm,
        title=f"HandyHub - {period_label}", author="HandyHub"
    )
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=styles["Heading1"], fontName=font_bold, fontSize=18, leading=22, textColor=colors.HexColor("#111827"))
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], fontName=font_bold, fontSize=13, leading=16, textColor=colors.HexColor("#2563eb"))
    body = ParagraphStyle("body", parent=styles["Normal"], fontName=font_name, fontSize=10, leading=14, textColor=colors.HexColor("#374151"))
    small = ParagraphStyle("small", parent=styles["Normal"], fontName=font_name, fontSize=9, leading=12, textColor=colors.HexColor("#6b7280"))

    story = []

    title_map = {"monthly": "Earnings Report", "yearly": "Annual Earnings Report", "tax": "Tax Report"}
    story.append(Paragraph(title_map[type], h1))
    story.append(Paragraph(f"Period: <b>{period_label}</b>", body))
    story.append(Paragraph(f"Pro: <b>{current_user.name or current_user.email}</b>", body))
    story.append(Paragraph(f"Email: {current_user.email}", small))
    story.append(Paragraph(f"Generated: {now.strftime('%m/%d/%Y %I:%M %p UTC')}", small))
    story.append(Spacer(1, 0.5*cm))

    # Summary
    story.append(Paragraph("Summary", h2))
    summary_rows = [
        ["Tasks completed", str(total_jobs)],
        ["Total amount (gross)", f"${total_gross:.2f}"],
        ["Incl. tips", f"${total_tips:.2f}"],
        ["Platform commission", f"${total_commission:.2f}"],
        ["Net payout", f"${total_net:.2f}"],
        ["Hours worked", f"{total_hours:.1f}"],
    ]
    t_summary = Table(summary_rows, colWidths=[8*cm, 6*cm])
    t_summary.setStyle(TableStyle([
        ("FONTNAME", (0,0), (-1,-1), font_name),
        ("FONTSIZE", (0,0), (-1,-1), 10),
        ("TEXTCOLOR", (0,0), (0,-1), colors.HexColor("#6b7280")),
        ("TEXTCOLOR", (1,0), (1,-1), colors.HexColor("#111827")),
        ("FONTNAME", (1,0), (1,-1), font_bold),
        ("ALIGN", (1,0), (1,-1), "RIGHT"),
        ("BOTTOMPADDING", (0,0), (-1,-1), 6),
        ("LINEBELOW", (0,0), (-1,-2), 0.25, colors.HexColor("#e5e7eb")),
        ("BACKGROUND", (0,-1), (-1,-1), colors.HexColor("#f0fdf4")),
        ("TEXTCOLOR", (1,-1), (1,-1), colors.HexColor("#10b981")),
    ]))
    story.append(t_summary)
    story.append(Spacer(1, 0.6*cm))

    # Tax block (for type=tax)
    if type == "tax":
        story.append(Paragraph("Tax information", h2))
        story.append(Paragraph(
            "This report is intended for income reporting. The gross amount is the base for tax calculations. "
            "Check the exact rate and tax rules with the tax authority in your jurisdiction.",
            body
        ))
        tax_rows = [
            ["Gross income", f"${total_gross:.2f}"],
            ["Platform commission withheld", f"${total_commission:.2f}"],
            ["Actually received", f"${total_net:.2f}"],
        ]
        t_tax = Table(tax_rows, colWidths=[10*cm, 4*cm])
        t_tax.setStyle(TableStyle([
            ("FONTNAME", (0,0), (-1,-1), font_name),
            ("FONTSIZE", (0,0), (-1,-1), 10),
            ("FONTNAME", (1,0), (1,-1), font_bold),
            ("ALIGN", (1,0), (1,-1), "RIGHT"),
            ("BOX", (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
            ("INNERGRID", (0,0), (-1,-1), 0.25, colors.HexColor("#e5e7eb")),
            ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#eff6ff")),
            ("BOTTOMPADDING", (0,0), (-1,-1), 8),
            ("TOPPADDING", (0,0), (-1,-1), 8),
        ]))
        story.append(t_tax)
        story.append(Spacer(1, 0.6*cm))

    # Detail table
    story.append(Paragraph("Detailed task list", h2))
    if not filtered:
        story.append(Paragraph("No tasks found for the selected period.", body))
    else:
        header = ["Date", "Task", "Client", "Hrs", "Gross, $", "Net, $"]
        rows = [header]
        for t in filtered:
            client_doc = await db.users.find_one({"user_id": t.get("client_id")}, {"_id": 0, "name": 1, "email": 1})
            client_name = (client_doc or {}).get("name") or (client_doc or {}).get("email") or "—"
            rows.append([
                t["_dt"].strftime("%m/%d/%Y"),
                Paragraph((t.get("title") or "—")[:60], body),
                Paragraph(str(client_name)[:30], body),
                f"{float(t.get('actual_hours') or 0):.1f}",
                f"{float(t.get('final_price') or 0):.2f}",
                f"{float(t.get('provider_payout') or t.get('final_price') or 0):.2f}",
            ])
        t_detail = Table(rows, colWidths=[2.2*cm, 6.2*cm, 3.4*cm, 1.2*cm, 2.2*cm, 2.2*cm], repeatRows=1)
        t_detail.setStyle(TableStyle([
            ("FONTNAME", (0,0), (-1,-1), font_name),
            ("FONTNAME", (0,0), (-1,0), font_bold),
            ("FONTSIZE", (0,0), (-1,-1), 9),
            ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#2563eb")),
            ("TEXTCOLOR", (0,0), (-1,0), colors.white),
            ("ALIGN", (3,0), (-1,-1), "RIGHT"),
            ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
            ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, colors.HexColor("#f9fafb")]),
            ("GRID", (0,0), (-1,-1), 0.25, colors.HexColor("#e5e7eb")),
            ("BOTTOMPADDING", (0,0), (-1,-1), 5),
            ("TOPPADDING", (0,0), (-1,-1), 5),
        ]))
        story.append(t_detail)

    story.append(Spacer(1, 0.8*cm))
    story.append(Paragraph(
        "This document was generated automatically by HandyHub. No signature is required.",
        small
    ))

    doc.build(story)
    buf.seek(0)

    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
    }
    return StreamingResponse(buf, media_type="application/pdf", headers=headers)


# ==================== CLIENT TASK CREATION ====================

@api_router.post("/client/tasks")
async def client_create_task(
    title: str,
    description: str,
    category: ServiceCategory,
    address: str,
    scheduled_date: str,
    scheduled_time: str,
    estimated_hours: Optional[float] = None,
    photos: Optional[List[str]] = None,
    allow_offers: bool = False,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    current_user: User = Depends(get_current_user)
):
    """Client creates a new task"""
    if current_user.role != UserRole.CLIENT:
        raise HTTPException(status_code=403, detail="Only clients can create tasks")

    # Get settings for pricing
    settings = await db.settings.find_one({"setting_id": "app_settings"}, {"_id": 0})
    min_price = settings.get("minimum_task_price", 20.0) if settings else 20.0

    task_id = f"task_{uuid.uuid4().hex[:12]}"
    task = {
        "task_id": task_id,
        "client_id": current_user.user_id,
        "provider_id": None,
        "title": title,
        "description": description,
        "category": category,
        "status": TaskStatus.POSTED if not allow_offers else TaskStatus.OFFERING,
        "address": address,
        "latitude": latitude,
        "longitude": longitude,
        "scheduled_date": scheduled_date,
        "scheduled_time": scheduled_time,
        "estimated_hours": estimated_hours,
        "photos": photos,
        "allow_offers": allow_offers,
        "estimated_price": min_price,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }

    await db.tasks.insert_one(task)
    task.pop("_id", None)
    return task

@api_router.get("/client/tasks")
async def get_client_tasks(current_user: User = Depends(get_current_user)):
    """Client gets their tasks"""
    if current_user.role != UserRole.CLIENT:
        raise HTTPException(status_code=403, detail="Only clients can view their tasks")

    tasks = await db.tasks.find({"client_id": current_user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(100)

    for task in tasks:
        if task.get("provider_id"):
            provider = await db.users.find_one({"user_id": task["provider_id"]}, {"_id": 0, "password_hash": 0})
            task["provider"] = provider
        # Get offers count if applicable
        if task.get("allow_offers"):
            task["offers"] = await db.offers.find(
                {"booking_id": task["task_id"], "status": OfferStatus.PENDING},
                {"_id": 0}
            ).to_list(50)

    return tasks

# ==================== TASKER TASK ENDPOINTS ====================

@api_router.get("/tasker/available-tasks")
async def get_available_tasks(
    category: Optional[ServiceCategory] = None,
    max_distance_km: Optional[float] = None,
    current_user: User = Depends(get_current_user)
):
    """Tasker gets available tasks they can accept"""
    if current_user.role != UserRole.PROVIDER:
        raise HTTPException(status_code=403, detail="Only taskers can view available tasks")

    result = []

    # 1. Tasks from tasks collection - only truly open tasks (posted/offering with no provider)
    task_query: dict = {
        "status": {"$in": ["posted", "offering"]},
        "$or": [{"provider_id": {"$exists": False}}, {"provider_id": None}, {"provider_id": ""}]
    }
    if category:
        task_query["category"] = category
    tasks_docs = await db.tasks.find(task_query, {"_id": 0}).sort("created_at", -1).to_list(100)
    for task in tasks_docs:
        client = await db.users.find_one({"user_id": task.get("client_id")}, {"_id": 0, "password_hash": 0})
        task["client"] = client
        existing_offer = await db.offers.find_one({
            "booking_id": task.get("task_id"),
            "tasker_id": current_user.user_id
        })
        task["my_offer"] = existing_offer
        task["source"] = "task"
        result.append(task)

    # 2. Bookings from bookings collection with status posted/offering (no provider assigned yet)
    booking_query: dict = {
        "status": {"$in": ["posted", "offering"]},
        "provider_id": {"$in": [None, ""]}
    }
    if category:
        booking_query["category"] = category
    bookings_docs = await db.bookings.find(booking_query, {"_id": 0}).sort("created_at", -1).to_list(100)
    existing_task_booking_ids = {t.get("booking_id") for t in tasks_docs}
    for bk in bookings_docs:
        if bk.get("booking_id") in existing_task_booking_ids:
            continue  # already included via tasks collection
        client = await db.users.find_one({"user_id": bk.get("client_id")}, {"_id": 0, "password_hash": 0})
        bk["client"] = client
        bk["task_id"] = bk["booking_id"]  # alias so frontend works
        bk["scheduled_date"] = bk.get("date", "")
        bk["scheduled_time"] = bk.get("time", "")
        bk["estimated_price"] = bk.get("total_price") or bk.get("estimated_price")
        bk["allow_offers"] = bk.get("allow_offers", True)
        bk["photos"] = bk.get("problem_photos") or []
        bk["my_offer"] = None
        bk["source"] = "booking"
        result.append(bk)

    return result

@api_router.post("/tasker/tasks/{task_id}/accept")
async def tasker_accept_task(task_id: str, current_user: User = Depends(get_current_user)):
    """Tasker accepts a direct task (not offer-based)"""
    if current_user.role != UserRole.PROVIDER:
        raise HTTPException(status_code=403, detail="Only taskers can accept tasks")

    task = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if task["status"] != TaskStatus.ASSIGNED:
        raise HTTPException(status_code=400, detail="Task is not in assignable state")

    if task.get("provider_id") != current_user.user_id:
        raise HTTPException(status_code=403, detail="Task is not assigned to you")

    now = datetime.now(timezone.utc)
    await db.tasks.update_one(
        {"task_id": task_id},
        {"$set": {"status": TaskStatus.ASSIGNED, "accepted_at": now, "updated_at": now}}
    )
    if task.get("booking_id"):
        await db.bookings.update_one(
            {"booking_id": task["booking_id"]},
            {"$set": {"status": BookingStatus.ASSIGNED, "accepted_at": now}}
        )
    return {"message": "Task accepted"}

@api_router.post("/tasker/tasks/{task_id}/on-the-way")
async def tasker_on_the_way(task_id: str, current_user: User = Depends(get_current_user)):
    """Tasker marks they are on the way"""
    if current_user.role != UserRole.PROVIDER:
        raise HTTPException(status_code=403, detail="Only taskers")

    task = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
    if not task or task.get("provider_id") != current_user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    now = datetime.now(timezone.utc)
    await db.tasks.update_one(
        {"task_id": task_id},
        {"$set": {"status": TaskStatus.ON_THE_WAY, "on_the_way_at": now, "updated_at": now}}
    )
    if task.get("booking_id"):
        await db.bookings.update_one(
            {"booking_id": task["booking_id"]},
            {"$set": {"status": BookingStatus.ON_THE_WAY, "on_the_way_at": now}}
        )
    return {"message": "Status updated: On the way"}

@api_router.post("/tasker/tasks/{task_id}/start")
async def tasker_start_task(task_id: str, current_user: User = Depends(get_current_user)):
    """Tasker starts working on task"""
    if current_user.role != UserRole.PROVIDER:
        raise HTTPException(status_code=403, detail="Only taskers")

    task = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
    if not task or task.get("provider_id") != current_user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    if task["status"] not in [TaskStatus.HOLD_PLACED, TaskStatus.ON_THE_WAY, TaskStatus.ASSIGNED]:
        raise HTTPException(status_code=400, detail="Cannot start task in current status")

    now = datetime.now(timezone.utc)
    await db.tasks.update_one(
        {"task_id": task_id},
        {"$set": {
            "status": TaskStatus.STARTED,
            "started_at": now,
            "actual_start_time": now,
            "updated_at": now
        }}
    )
    if task.get("booking_id"):
        await db.bookings.update_one(
            {"booking_id": task["booking_id"]},
            {"$set": {"status": BookingStatus.STARTED, "started_at": now}}
        )
    return {"message": "Task started"}

@api_router.post("/tasker/tasks/{task_id}/complete")
async def tasker_complete_task(
    task_id: str,
    actual_hours: float,
    materials_cost: Optional[float] = None,
    completion_photos: Optional[List[str]] = None,
    provider_notes: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Tasker completes task"""
    if current_user.role != UserRole.PROVIDER:
        raise HTTPException(status_code=403, detail="Only taskers")

    task = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
    if not task or task.get("provider_id") != current_user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    if task["status"] != TaskStatus.STARTED:
        raise HTTPException(status_code=400, detail="Task must be started to complete")

    # Calculate final price
    hourly_rate = task.get("hourly_rate", 25.0)
    labor_cost = hourly_rate * actual_hours
    materials = materials_cost or 0
    final_price = labor_cost + materials

    # Apply platform fee
    settings = await db.settings.find_one({"setting_id": "app_settings"}, {"_id": 0})
    platform_fee = 0
    if settings and settings.get("apply_admin_commission"):
        platform_fee = final_price * (settings.get("admin_commission_percentage", 15) / 100)

    await db.tasks.update_one(
        {"task_id": task_id},
        {"$set": {
            "status": TaskStatus.COMPLETED_PENDING_PAYMENT,
            "actual_end_time": datetime.now(timezone.utc),
            "actual_hours": actual_hours,
            "materials_cost": materials_cost,
            "final_price": final_price,
            "platform_fee": platform_fee,
            "completion_photos": completion_photos,
            "provider_notes": provider_notes,
            "completed_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }}
    )

    return {
        "message": "Task completed, pending client payment",
        "final_price": final_price,
        "platform_fee": platform_fee,
        "tasker_payout": final_price - platform_fee
    }

# ==================== ADMIN PASSWORD & USER MANAGEMENT ====================

class AdminResetPassword(BaseModel):
    new_password: str

@api_router.post("/admin/users/{user_id}/reset-password")
async def admin_reset_password(
    user_id: str,
    data: AdminResetPassword,
    current_user: User = Depends(require_admin)
):
    """Admin resets user password"""
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    new_hash = hash_password(data.new_password)
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "password_hash": new_hash,
            "plain_password": data.new_password  # Store plain password for admin view
        }}
    )

    # Invalidate all sessions
    await db.user_sessions.delete_many({"user_id": user_id})

    return {"message": "Password reset successfully", "user_id": user_id}

@api_router.get("/admin/users/{user_id}/password")
async def admin_view_password(
    user_id: str,
    current_user: User = Depends(require_admin)
):
    """Admin views user password (plain text stored for admin purposes)"""
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "user_id": user_id,
        "email": user.get("email"),
        "password": user.get("plain_password", "Password not stored (legacy user)")
    }

# ==================== BOOKING REASSIGNMENT ====================

class ReassignBooking(BaseModel):
    new_provider_id: str
    notes: Optional[str] = None

@api_router.post("/admin/bookings/{booking_id}/reassign")
async def admin_reassign_booking(
    booking_id: str,
    data: ReassignBooking,
    current_user: User = Depends(require_admin)
):
    """Admin reassigns booking to a different provider"""
    booking = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Check new provider exists
    new_provider = await db.users.find_one({"user_id": data.new_provider_id, "role": "provider"})
    if not new_provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    old_provider_id = booking.get("provider_id")

    # Update booking
    await db.bookings.update_one(
        {"booking_id": booking_id},
        {"$set": {
            "provider_id": data.new_provider_id,
            "status": BookingStatus.ASSIGNED,
            "updated_at": datetime.now(timezone.utc)
        }}
    )

    # Update or create task
    task = await db.tasks.find_one({"booking_id": booking_id})
    if task:
        await db.tasks.update_one(
            {"booking_id": booking_id},
            {"$set": {
                "provider_id": data.new_provider_id,
                "status": TaskStatus.ASSIGNED,
                "assigned_by": current_user.user_id,
                "assigned_at": datetime.now(timezone.utc),
                "notes": data.notes
            }}
        )

    # Send notification to new provider
    if new_provider.get("telegram_chat_id"):
        service = await db.services.find_one({"service_id": booking.get("service_id")}, {"_id": 0})
        message = f"📋 *An order was reassigned to you!*\n\nService: {service['name'] if service else 'Service'}\nDate: {booking['date']} at {booking['time']}\nAddress: {booking['address']}"
        await send_telegram_notification(new_provider["telegram_chat_id"], message)

    return {
        "message": "Booking reassigned successfully",
        "booking_id": booking_id,
        "old_provider_id": old_provider_id,
        "new_provider_id": data.new_provider_id
    }

# ==================== ENHANCED SERVICES WITH GALLERY ====================

class ProjectGalleryItem(BaseModel):
    description: Optional[str] = None
    date: Optional[str] = None
    photos: List[str] = []  # base64 images
    price: Optional[float] = None

class ServiceCreateEnhanced(BaseModel):
    name: str
    category: ServiceCategory
    description: str
    price: float
    duration: int
    image: Optional[str] = None  # main photo base64
    gallery: Optional[List[ProjectGalleryItem]] = []  # project gallery
    available: bool = True

@api_router.post("/admin/services/enhanced")
async def create_service_enhanced(
    service_data: ServiceCreateEnhanced,
    current_user: User = Depends(require_admin)
):
    """Create service with main photo and project gallery"""
    service_id = f"service_{uuid.uuid4().hex[:12]}"

    service_dict = {
        "service_id": service_id,
        "name": service_data.name,
        "category": service_data.category,
        "description": service_data.description,
        "price": service_data.price,
        "duration": service_data.duration,
        "image": service_data.image,
        "gallery": [g.dict() for g in (service_data.gallery or [])],
        "available": service_data.available,
        "created_at": datetime.now(timezone.utc)
    }

    await db.services.insert_one(service_dict)

    # Return without _id
    service_dict.pop("_id", None)
    return service_dict

@api_router.put("/admin/services/{service_id}/enhanced")
async def update_service_enhanced(
    service_id: str,
    service_data: ServiceCreateEnhanced,
    current_user: User = Depends(require_admin)
):
    """Update service with main photo and project gallery"""
    service = await db.services.find_one({"service_id": service_id})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    update_dict = {
        "name": service_data.name,
        "category": service_data.category,
        "description": service_data.description,
        "price": service_data.price,
        "duration": service_data.duration,
        "image": service_data.image,
        "gallery": [g.dict() for g in (service_data.gallery or [])],
        "available": service_data.available,
        "updated_at": datetime.now(timezone.utc)
    }

    await db.services.update_one(
        {"service_id": service_id},
        {"$set": update_dict}
    )

    updated_service = await db.services.find_one({"service_id": service_id}, {"_id": 0})
    return updated_service

@api_router.post("/admin/services/{service_id}/gallery")
async def add_gallery_item(
    service_id: str,
    item: ProjectGalleryItem,
    current_user: User = Depends(require_admin)
):
    """Add item to service project gallery"""
    service = await db.services.find_one({"service_id": service_id})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    await db.services.update_one(
        {"service_id": service_id},
        {"$push": {"gallery": item.dict()}}
    )

    updated_service = await db.services.find_one({"service_id": service_id}, {"_id": 0})
    return updated_service

# ==================== PROVIDER STATISTICS & PROFILE ====================
# IMPORTANT: /provider/me/stats MUST be defined BEFORE /provider/{user_id}/stats
# so FastAPI does not capture "me" as a user_id path parameter.

@api_router.get("/provider/me/stats")
async def get_my_provider_stats(current_user: User = Depends(get_current_user)):
    """Get current provider's own statistics"""
    user_id = current_user.user_id
    profile = await db.executor_profiles.find_one({"user_id": user_id}, {"_id": 0})
    all_tasks = await db.tasks.find({
        "provider_id": user_id
    }, {"_id": 0}).to_list(1000)
    completed_tasks = [t for t in all_tasks if t.get("status") in ["completed_pending_payment", "paid"]]
    total_completed = len(completed_tasks)
    total_earnings = sum(t.get("final_price", 0) or 0 for t in completed_tasks)
    reviews = await db.reviews.find({"provider_id": user_id}, {"_id": 0}).to_list(100)
    avg_rating = round(sum(r["rating"] for r in reviews) / len(reviews), 2) if reviews else 5.0
    archived_tasks = [t for t in all_tasks if t.get("status") in ["cancelled_by_client", "cancelled_by_tasker", "paid"]]
    archived_tasks.sort(key=lambda t: t.get("created_at", ""), reverse=True)
    return JSONResponse(content=clean_bson({
        "user": {k: v for k, v in current_user.dict().items() if k != "password_hash"},
        "profile": profile,
        "stats": {
            "total_tasks": len(all_tasks),
            "total_completed_tasks": total_completed,
            "total_earnings": round(total_earnings, 2),
            "average_rating": avg_rating,
            "total_reviews": len(reviews)
        },
        "reviews": reviews[:10],
        "archived_tasks": archived_tasks[:20]
    }))

@api_router.get("/provider/{user_id}/stats")
async def get_provider_stats(user_id: str):
    """Get provider statistics: completed tasks, hours, earnings, reviews"""
    # Get user
    user = await db.users.find_one({"user_id": user_id, "role": "provider"}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Provider not found")

    # Get profile
    profile = await db.executor_profiles.find_one({"user_id": user_id}, {"_id": 0})

    # Get all tasks for this provider
    all_tasks = await db.tasks.find({
        "provider_id": user_id
    }, {"_id": 0}).to_list(1000)

    # Filter completed tasks
    completed_tasks = [t for t in all_tasks if t.get("status") in [TaskStatus.COMPLETED_PENDING_PAYMENT, TaskStatus.PAID]]

    # Calculate stats
    total_completed = len(completed_tasks)
    total_hours = sum(t.get("actual_hours", 0) or 0 for t in completed_tasks)
    total_earnings = sum(t.get("final_price", 0) or 0 for t in completed_tasks)

    # Get reviews
    reviews = await db.reviews.find({"provider_id": user_id}, {"_id": 0}).to_list(100)
    avg_rating = sum(r["rating"] for r in reviews) / len(reviews) if reviews else 0

    # Get archived tasks (cancelled or old completed)
    archived_tasks = [t for t in all_tasks if t.get("status") in [TaskStatus.CANCELLED_BY_CLIENT, TaskStatus.CANCELLED_BY_TASKER, TaskStatus.PAID]]
    archived_tasks.sort(key=lambda t: t.get("created_at", ""), reverse=True)

    return JSONResponse(content=clean_bson({
        "user": user,
        "profile": profile,
        "stats": {
            "total_tasks": len(all_tasks),
            "total_completed_tasks": total_completed,
            "total_hours_worked": round(total_hours, 1),
            "total_earnings": round(total_earnings, 2),
            "average_rating": round(avg_rating, 2),
            "total_reviews": len(reviews)
        },
        "reviews": reviews[:10],
        "archived_tasks": archived_tasks[:20]
    }))

# ==================== USER PROFILE PHOTO ====================

class ProfilePhotoUpdate(BaseModel):
    picture: str  # base64 image

@api_router.put("/users/profile/photo")
async def update_profile_photo(
    data: ProfilePhotoUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update user profile photo"""
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$set": {"picture": data.picture}}
    )

    updated_user = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0, "password_hash": 0})
    return updated_user

# ==================== PAYMENT METHODS & SAVED ADDRESSES ====================

class PaymentMethodCreate(BaseModel):
    card_number: str
    expiry: str            # "MM/YY" or "MM/YYYY"
    card_holder: str
    type: Optional[str] = "card"


def _luhn_ok(num: str) -> bool:
    digits = [int(d) for d in num if d.isdigit()]
    if len(digits) < 12:
        return False
    checksum = 0
    parity = len(digits) % 2
    for i, d in enumerate(digits):
        if i % 2 == parity:
            d *= 2
            if d > 9:
                d -= 9
        checksum += d
    return checksum % 10 == 0


def _card_brand(num: str) -> str:
    n = "".join(ch for ch in num if ch.isdigit())
    if n.startswith("4"):
        return "Visa"
    if n[:2] in {"34", "37"}:
        return "Amex"
    if n[:2] in {str(x) for x in range(51, 56)} or (len(n) >= 4 and 2221 <= int(n[:4]) <= 2720):
        return "Mastercard"
    if n[:4] == "6011" or n[:2] == "65":
        return "Discover"
    return "Card"


def _parse_expiry(expiry: str) -> Tuple[int, int]:
    """Return (month, year4). Raises ValueError if invalid or in the past."""
    parts = expiry.replace(" ", "").split("/")
    if len(parts) != 2:
        raise ValueError("Invalid expiry format (MM/YY)")
    mm = int(parts[0])
    yy = int(parts[1])
    if yy < 100:
        yy += 2000
    if mm < 1 or mm > 12:
        raise ValueError("Invalid month in expiry date")
    now = datetime.now(timezone.utc)
    if (yy, mm) < (now.year, now.month):
        raise ValueError("The card has expired")
    return mm, yy


class SavedAddressCreate(BaseModel):
    label: Optional[str] = "Home"
    street: str
    city: str
    zip: Optional[str] = None

@api_router.get("/users/payment-methods")
async def get_payment_methods(current_user: User = Depends(get_current_user)):
    """Get saved payment methods for current user"""
    user = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0, "payment_methods": 1})
    return user.get("payment_methods", [])

@api_router.post("/users/payment-methods")
async def add_payment_method(
    data: PaymentMethodCreate,
    current_user: User = Depends(get_current_user)
):
    """Validate a card (Luhn + expiry) and save it to the profile for later selection.
    For PCI safety we store ONLY brand, last4, expiry and holder — never the full PAN."""
    raw = "".join(ch for ch in (data.card_number or "") if ch.isdigit())
    if not _luhn_ok(raw):
        raise HTTPException(status_code=422, detail="Invalid card number")
    if not (data.card_holder or "").strip():
        raise HTTPException(status_code=422, detail="Enter the cardholder name")
    try:
        exp_month, exp_year = _parse_expiry(data.expiry)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    brand = _card_brand(raw)
    new_pm = {
        "id": str(uuid.uuid4()),
        "type": "card",
        "brand": brand,
        "last4": raw[-4:],
        "exp_month": exp_month,
        "exp_year": exp_year,
        "expiry": f"{exp_month:02d}/{str(exp_year)[-2:]}",
        "card_holder": data.card_holder.strip(),
        "card_number": f"•••• •••• •••• {raw[-4:]}",  # masked, for display only
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$push": {"payment_methods": new_pm}}
    )
    return new_pm

@api_router.delete("/users/payment-methods/{pm_id}")
async def delete_payment_method(pm_id: str, current_user: User = Depends(get_current_user)):
    """Remove a payment method"""
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$pull": {"payment_methods": {"id": pm_id}}}
    )
    return {"success": True}

@api_router.get("/users/saved-addresses")
async def get_saved_addresses(current_user: User = Depends(get_current_user)):
    """Get saved addresses for current user"""
    user = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0, "saved_addresses": 1})
    return user.get("saved_addresses", [])

@api_router.post("/users/saved-addresses")
async def add_saved_address(
    data: SavedAddressCreate,
    current_user: User = Depends(get_current_user)
):
    """Add a saved address to user profile"""
    new_addr = {
        "id": str(uuid.uuid4()),
        "label": data.label,
        "street": data.street,
        "city": data.city,
        "zip": data.zip
    }
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$push": {"saved_addresses": new_addr}}
    )
    return new_addr

@api_router.delete("/users/saved-addresses/{addr_id}")
async def delete_saved_address(addr_id: str, current_user: User = Depends(get_current_user)):
    """Remove a saved address"""
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$pull": {"saved_addresses": {"id": addr_id}}}
    )
    return {"success": True}

# ==================== PASSWORD RECOVERY ====================

import secrets
import string

def generate_temp_password(length=12):
    """Generate a random temporary password"""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))

class PasswordRecoveryRequest(BaseModel):
    email: EmailStr

class PasswordRecoveryVerify(BaseModel):
    email: EmailStr
    code: str
    new_password: str

@api_router.post("/auth/password-recovery/request")
async def request_password_recovery(data: PasswordRecoveryRequest):
    """Request password recovery - sends code via email/SMS"""
    user = await db.users.find_one({"email": data.email})
    if not user:
        # Don't reveal if user exists
        return {"message": "If the email exists, a recovery code has been sent."}

    # Generate 6-digit code
    code = ''.join(secrets.choice(string.digits) for _ in range(6))

    # Store recovery request
    await db.password_recovery.delete_many({"email": data.email})  # Remove old requests
    await db.password_recovery.insert_one({
        "email": data.email,
        "code": code,
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=15)
    })

    # Send the recovery code via email (and SMS fallback handled by _send_email config)
    logger.info(f"Password recovery code for {data.email}: {code}")
    user_name = user.get("name") or "there"
    asyncio.create_task(_send_email(
        data.email,
        "HandyHub — Password Reset Code",
        f"Hi {user_name},\n\nYour password reset code is: {code}\n\n"
        f"This code expires in 15 minutes. If you didn't request this, you can ignore this email.\n\n— HandyHub",
    ))

    return {
        "message": "If the email exists, a recovery code has been sent.",
    }

@api_router.post("/auth/password-recovery/verify")
async def verify_password_recovery(data: PasswordRecoveryVerify):
    """Verify recovery code and set new password"""
    recovery = await db.password_recovery.find_one({
        "email": data.email,
        "code": data.code
    })

    if not recovery:
        raise HTTPException(status_code=400, detail="Invalid or expired code")

    # Check expiry
    expires_at = recovery["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at < datetime.now(timezone.utc):
        await db.password_recovery.delete_one({"_id": recovery["_id"]})
        raise HTTPException(status_code=400, detail="Code expired")

    # Update password
    new_hash = hash_password(data.new_password)
    await db.users.update_one(
        {"email": data.email},
        {"$set": {"password_hash": new_hash}}
    )

    # Invalidate all sessions
    user = await db.users.find_one({"email": data.email})
    if user:
        await db.user_sessions.delete_many({"user_id": user["user_id"]})

    # Delete recovery request
    await db.password_recovery.delete_one({"_id": recovery["_id"]})

    return {"message": "Password updated successfully"}

# ==================== CLIENT BOOKING FROM SERVICES ====================

class ClientBookingCreate(BaseModel):
    service_id: str
    date: str
    time: str
    address: str
    city: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    notes: Optional[str] = None
    problem_description: Optional[str] = None
    problem_photos: Optional[List[str]] = None
    provider_id: Optional[str] = None
    provider_hourly_rate: Optional[float] = None
    urgency: Optional[str] = None
    total_price: Optional[float] = None

@api_router.post("/client/bookings")
async def client_create_booking(
    data: ClientBookingCreate,
    current_user: User = Depends(get_current_user)
):
    """Client creates booking from Services tab"""
    if current_user.role not in [UserRole.CLIENT, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only clients can create bookings")

    # Get service
    service = await db.services.find_one({"service_id": data.service_id}, {"_id": 0})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    booking_id = f"booking_{uuid.uuid4().hex[:12]}"

    # Apply per-category commission markup. The executor's rate stays the
    # same (service.price); client_total = service.price * (1 + commission/100)
    executor_rate = float(data.provider_hourly_rate or service.get("price") or 0)
    pricing = await compute_client_pricing(executor_rate, service.get("category"))

    # If frontend already passed a total_price (e.g. pre-computed), prefer it
    # only when it matches our computed client_total within rounding; otherwise
    # the backend is the source of truth to prevent client-side tampering.
    client_total = pricing["client_total"]

    booking = {
        "booking_id": booking_id,
        "client_id": current_user.user_id,
        "service_id": data.service_id,
        "category": service.get("category"),
        "title": service.get("name"),
        "description": data.problem_description or service.get("description", ""),
        "date": data.date,
        "time": data.time,
        "address": data.address,
        "latitude": data.latitude,
        "longitude": data.longitude,
        "notes": data.notes,
        "problem_description": data.problem_description,
        "problem_photos": data.problem_photos,
        "status": BookingStatus.PENDING_ACCEPTANCE if data.provider_id else BookingStatus.DRAFT,
        "estimated_price": service.get("price"),
        "total_price": client_total,
        # Pricing breakdown snapshot (so changes to category commission later
        # don't retroactively alter past bookings)
        "executor_rate": pricing["executor_rate"],
        "commission_rate_snapshot": pricing["commission_rate"],
        "commission_amount": pricing["commission_amount"],
        "platform_take": pricing["platform_take"],
        "executor_take": pricing["executor_take"],
        "provider_id": data.provider_id,
        "provider_hourly_rate": data.provider_hourly_rate,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }

    await db.bookings.insert_one(booking)
    booking.pop("_id", None)

    # If client pre-selected a provider — auto-create task and notify
    if data.provider_id:
        task_id = f"task_{uuid.uuid4().hex[:12]}"
        task_doc = {
            "task_id": task_id,
            "booking_id": booking_id,
            "client_id": current_user.user_id,
            "provider_id": data.provider_id,
            "title": service.get("name", "Service Request"),
            "description": data.problem_description or service.get("description", ""),
            "address": data.address,
            "date": data.date,
            "time": data.time,
            "status": TaskStatus.PENDING_ACCEPTANCE,
            "provider_hourly_rate": data.provider_hourly_rate,
            "total_price": client_total,
            "executor_take": pricing["executor_take"],
            "platform_take": pricing["platform_take"],
            "commission_rate_snapshot": pricing["commission_rate"],
            "photos": data.problem_photos or [],
            "scheduled_date": data.date,
            "scheduled_time": data.time,
            "created_at": datetime.now(timezone.utc),
        }
        await db.tasks.insert_one(task_doc)

        # Send notification to provider
        provider = await db.users.find_one({"user_id": data.provider_id}, {"_id": 0})
        if provider and provider.get("telegram_chat_id"):
            message = f"📋 *New task!*\n\nService: {service.get('name', 'Service')}\nDate: {data.date} at {data.time}\nAddress: {data.address}\nYour rate: ${pricing['executor_take']}"
            await send_telegram_notification(provider["telegram_chat_id"], message)

        booking["task_id"] = task_id

    return booking

class ClientBookingUpdate(BaseModel):
    date: Optional[str] = None
    time: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    problem_description: Optional[str] = None
    problem_photos: Optional[List[str]] = None

@api_router.put("/client/bookings/{booking_id}")
async def client_update_booking(
    booking_id: str,
    data: ClientBookingUpdate,
    current_user: User = Depends(get_current_user)
):
    """Client updates booking before provider accepts"""
    booking = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking["client_id"] != current_user.user_id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Access denied")

    # Can only edit before acceptance
    if booking["status"] not in [BookingStatus.DRAFT, BookingStatus.POSTED, BookingStatus.OFFERING]:
        raise HTTPException(status_code=400, detail="Cannot edit booking after provider accepted")

    update_dict = data.dict(exclude_unset=True)
    if update_dict:
        update_dict["updated_at"] = datetime.now(timezone.utc)
        await db.bookings.update_one(
            {"booking_id": booking_id},
            {"$set": update_dict}
        )

    updated_booking = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    return updated_booking

@api_router.post("/client/bookings/{booking_id}/submit")
async def client_submit_booking(
    booking_id: str,
    current_user: User = Depends(get_current_user)
):
    """Client submits draft booking for processing"""
    booking = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking["client_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    if booking["status"] != BookingStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Booking already submitted")

    await db.bookings.update_one(
        {"booking_id": booking_id},
        {"$set": {
            "status": BookingStatus.POSTED,
            "updated_at": datetime.now(timezone.utc)
        }}
    )

    return {"message": "Booking submitted", "status": BookingStatus.POSTED}

# ==================== COMMISSION SYSTEM ENDPOINTS ====================

async def compute_client_pricing(executor_rate: float, category_id: Optional[str] = None) -> Dict[str, Any]:
    """Apply the category's commission as a percentage of the client's total.

    Business rules (admin spec, Variant B):
      • Executor sets their own price X (their net earnings, what they receive).
      • Admin sets commission_rate (%) per category.
      • commission_rate is the SHARE OF THE CLIENT TOTAL that goes to the
        platform — so for 50% commission, platform and executor each receive
        half of what the client paid.
      • client_total = executor_rate / (1 - commission_rate/100)
      • For 50%: executor=20, client=40, platform=20.
      • For 15%: executor=20, client=23.53, platform=3.53.
      • commission_rate of 100% would divide by zero; capped at 99%.
    """
    try:
        rate = float(executor_rate or 0)
    except Exception:
        rate = 0.0

    commission_rate = 0.0
    category_doc = None
    if category_id:
        category_doc = await db.categories.find_one(
            {"category_id": category_id},
            {"_id": 0, "commission_rate": 1, "name": 1}
        )
        if category_doc and category_doc.get("commission_rate") is not None:
            commission_rate = float(category_doc["commission_rate"])

    if commission_rate >= 100:
        commission_rate = 99.0  # cap to avoid div-by-zero
    if commission_rate < 0:
        commission_rate = 0.0

    if commission_rate > 0 and rate > 0:
        client_total = round(rate / (1 - commission_rate / 100.0), 2)
    else:
        client_total = round(rate, 2)
    commission_amount = round(client_total - rate, 2)

    return {
        "executor_rate": round(rate, 2),
        "commission_rate": round(commission_rate, 2),
        "commission_amount": commission_amount,
        "client_total": client_total,
        "executor_take": round(rate, 2),
        "platform_take": commission_amount,
        "category_id": category_id,
        "category_name": category_doc.get("name") if category_doc else None,
    }


@api_router.get("/pricing-preview")
async def pricing_preview(executor_rate: float, category_id: Optional[str] = None):
    """Public price-preview endpoint.

    Returns the marked-up client total and the platform/executor split based on
    the category's commission_rate. Used by the booking flow on the frontend
    so the client sees the final amount they will be charged.
    """
    return await compute_client_pricing(executor_rate, category_id)


# ==================== TASK ACCEPT / DECLINE (provider workflow) ============

async def _update_booking_and_task_status(booking_id: str, new_status: str, extra: Dict[str, Any] = None):
    """Helper: update both the booking and matching task with same status + timestamp."""
    update = {"status": new_status, "updated_at": datetime.now(timezone.utc)}
    if extra:
        update.update(extra)
    await db.bookings.update_one({"booking_id": booking_id}, {"$set": update})
    await db.tasks.update_one({"booking_id": booking_id}, {"$set": update})


@api_router.post("/bookings/{booking_id}/accept")
async def provider_accept_booking(booking_id: str, current_user: User = Depends(get_current_user)):
    """Provider accepts a pending booking. Sets status -> ASSIGNED."""
    if current_user.role != "provider":
        raise HTTPException(status_code=403, detail="Only providers can accept bookings")
    booking = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.get("provider_id") != current_user.user_id:
        raise HTTPException(status_code=403, detail="This booking is not assigned to you")
    if booking.get("status") not in (BookingStatus.PENDING_ACCEPTANCE.value, "pending_acceptance"):
        raise HTTPException(status_code=400, detail=f"Cannot accept from status {booking.get('status')}")
    await _update_booking_and_task_status(booking_id, BookingStatus.ASSIGNED.value, {"accepted_at": datetime.now(timezone.utc)})
    return {"ok": True, "booking_id": booking_id, "status": "assigned"}


@api_router.post("/bookings/{booking_id}/decline")
async def provider_decline_booking(
    booking_id: str,
    reason: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    """Provider declines a pending booking. Sets status -> DECLINED + clears provider_id so client can reassign."""
    if current_user.role != "provider":
        raise HTTPException(status_code=403, detail="Only providers can decline bookings")
    booking = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.get("provider_id") != current_user.user_id:
        raise HTTPException(status_code=403, detail="This booking is not assigned to you")
    extra = {
        "declined_at": datetime.now(timezone.utc),
        "declined_by": current_user.user_id,
        "decline_reason": reason,
        "previous_provider_id": current_user.user_id,
        "provider_id": None,  # free the booking up
    }
    await _update_booking_and_task_status(booking_id, BookingStatus.DECLINED.value, extra)
    return {"ok": True, "booking_id": booking_id, "status": "declined"}


@api_router.post("/bookings/{booking_id}/en-route")
async def provider_mark_en_route(booking_id: str, current_user: User = Depends(get_current_user)):
    """Provider marks themselves as on the way. Requires status=ASSIGNED."""
    if current_user.role != "provider":
        raise HTTPException(status_code=403, detail="Only providers")
    booking = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not booking or booking.get("provider_id") != current_user.user_id:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.get("status") not in (BookingStatus.ASSIGNED.value, "assigned"):
        raise HTTPException(status_code=400, detail=f"Cannot mark en-route from status {booking.get('status')}")
    await _update_booking_and_task_status(booking_id, BookingStatus.ON_THE_WAY.value)
    return {"ok": True, "booking_id": booking_id, "status": "on_the_way"}


@api_router.post("/bookings/{booking_id}/start")
async def provider_start_work(booking_id: str, current_user: User = Depends(get_current_user)):
    """Provider starts the work. Requires status=ON_THE_WAY (or ASSIGNED)."""
    if current_user.role != "provider":
        raise HTTPException(status_code=403, detail="Only providers")
    booking = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not booking or booking.get("provider_id") != current_user.user_id:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.get("status") not in (BookingStatus.ON_THE_WAY.value, BookingStatus.ASSIGNED.value, "on_the_way", "assigned"):
        raise HTTPException(status_code=400, detail=f"Cannot start from status {booking.get('status')}")
    await _update_booking_and_task_status(booking_id, BookingStatus.STARTED.value, {"started_at": datetime.now(timezone.utc)})
    return {"ok": True, "booking_id": booking_id, "status": "started"}


@api_router.post("/bookings/{booking_id}/complete")
async def provider_complete_work(booking_id: str, current_user: User = Depends(get_current_user)):
    """Provider marks the work as completed."""
    if current_user.role != "provider":
        raise HTTPException(status_code=403, detail="Only providers")
    booking = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not booking or booking.get("provider_id") != current_user.user_id:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.get("status") not in (BookingStatus.STARTED.value, "started"):
        raise HTTPException(status_code=400, detail=f"Cannot complete from status {booking.get('status')}")
    await _update_booking_and_task_status(booking_id, BookingStatus.COMPLETED_PENDING_PAYMENT.value, {"completed_at": datetime.now(timezone.utc)})
    return {"ok": True, "booking_id": booking_id, "status": "completed_pending_payment"}


# ==================== ADMIN INTEGRATION-KEYS ROUTES ========================

class IntegrationKeysUpdate(BaseModel):
    sendgrid_api_key: Optional[str] = None
    sendgrid_from_email: Optional[str] = None
    resend_api_key: Optional[str] = None
    resend_from_email: Optional[str] = None
    email_provider: Optional[str] = None  # "resend" (default) or "sendgrid"
    stripe_secret_key: Optional[str] = None
    stripe_publishable_key: Optional[str] = None
    stripe_webhook_secret: Optional[str] = None
    stripe_currency: Optional[str] = None  # uah, usd, eur — default uah
    # Support / Help center
    support_email: Optional[str] = None  # where contact-form submissions are emailed
    support_phone: Optional[str] = None  # shown on the help page
    # Alternative payment methods — admin enables/disables + platform recipient details
    enable_stripe_method: Optional[bool] = None
    enable_paypal: Optional[bool] = None
    enable_zelle: Optional[bool] = None
    enable_venmo: Optional[bool] = None
    paypal_platform_email: Optional[str] = None
    zelle_platform_handle: Optional[str] = None   # email or phone
    venmo_platform_handle: Optional[str] = None   # username
    paypal_auto_split: Optional[bool] = None  # if True, backend tries Payouts API after charge
    # Direct bank/card transfer — client sends to 2 cards manually
    enable_bank_transfer: Optional[bool] = None
    bank_platform_details: Optional[str] = None  # free-form (card number / bank / IBAN of platform)
    # Who pays the platform commission (default 'client' — added on top)
    commission_paid_by: Optional[str] = None  # "client" or "executor"
    # Finix (US marketplace — split payments + Apple/Google Pay). Admin toggles on/off.
    enable_finix: Optional[bool] = None
    finix_api_username: Optional[str] = None
    finix_api_password: Optional[str] = None  # secret
    finix_application_id: Optional[str] = None      # APxxxx
    finix_platform_merchant_id: Optional[str] = None  # MUxxxx (also used client-side for Google Pay)
    finix_platform_identity_id: Optional[str] = None  # IDxxxx (platform's own identity)
    finix_environment: Optional[str] = None  # "sandbox" (default) or "live"
    twilio_account_sid: Optional[str] = None
    twilio_auth_token: Optional[str] = None
    twilio_from_phone: Optional[str] = None
    vapid_public_key: Optional[str] = None
    vapid_private_key: Optional[str] = None
    vapid_subject_email: Optional[str] = None
    telegram_bot_token: Optional[str] = None
    # admin-controlled feature toggles
    enable_email_notifications: Optional[bool] = None
    enable_sms_notifications: Optional[bool] = None
    enable_push_notifications: Optional[bool] = None
    enable_telegram_notifications: Optional[bool] = None
    enable_stripe_payments: Optional[bool] = None


def _mask(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    if len(value) <= 8:
        return "•" * len(value)
    return value[:4] + "•" * 8 + value[-4:]


# ==================== PAYMENT METHODS (multi-channel) ====================

@api_router.get("/payments/methods")
async def list_payment_methods():
    """Public — returns which payment methods are enabled by admin and how they work.
    Frontend uses this to render the client's payment options."""
    keys = await _get_integration_keys()
    stripe_secret_present = bool(keys.get("stripe_secret_key"))

    methods = []
    # Stripe — show only when admin enabled it (enable_stripe_payments) AND secret is set.
    stripe_enabled = keys.get("enable_stripe_payments")
    if stripe_enabled is None:
        stripe_enabled = keys.get("enable_stripe_method")  # backward compat
    if stripe_secret_present and bool(stripe_enabled):
        methods.append({
            "id": "stripe",
            "label": "Card (Stripe)",
            "icon": "card",
            "mode": "auto",
            "auto_split": True,
            "platform_handle": None,
            "configured": True,
        })
    # PayPal / Zelle / Venmo — always return when enabled; mark not-configured if
    # admin forgot to enter the platform handle. Frontend will display warning then.
    if keys.get("enable_paypal"):
        methods.append({
            "id": "paypal",
            "label": "PayPal",
            "icon": "logo-paypal",
            "mode": "manual",
            "auto_split": False,
            "platform_handle": keys.get("paypal_platform_email"),
            "configured": bool(keys.get("paypal_platform_email")),
        })
    if keys.get("enable_zelle"):
        methods.append({
            "id": "zelle",
            "label": "Zelle",
            "icon": "flash",
            "mode": "manual",
            "auto_split": False,
            "platform_handle": keys.get("zelle_platform_handle"),
            "configured": bool(keys.get("zelle_platform_handle")),
        })
    if keys.get("enable_venmo"):
        methods.append({
            "id": "venmo",
            "label": "Venmo",
            "icon": "logo-venmo",
            "mode": "manual",
            "auto_split": False,
            "platform_handle": keys.get("venmo_platform_handle"),
            "configured": bool(keys.get("venmo_platform_handle")),
        })
    if keys.get("enable_bank_transfer"):
        methods.append({
            "id": "bank_transfer",
            "label": "Card / bank transfer",
            "icon": "wallet",
            "mode": "manual",
            "auto_split": False,
            "platform_handle": keys.get("bank_platform_details"),
            "configured": bool(keys.get("bank_platform_details")),
        })
    # Finix — US marketplace gateway with automatic split + Apple/Google Pay.
    if keys.get("enable_finix"):
        finix_ready = bool(
            keys.get("finix_api_username") and keys.get("finix_api_password")
            and keys.get("finix_application_id") and keys.get("finix_platform_merchant_id")
        )
        methods.append({
            "id": "finix",
            "label": "Card / Apple Pay / Google Pay (Finix)",
            "icon": "card",
            "mode": "auto",
            "auto_split": True,
            "platform_handle": None,
            "configured": finix_ready,
            "application_id": keys.get("finix_application_id"),
            "environment": (keys.get("finix_environment") or "sandbox"),
        })
    return {"methods": methods}


@api_router.get("/payments/manual-instructions")
async def get_manual_instructions(
    booking_id: str,
    method: str,
    current_user: User = Depends(get_current_user),
):
    """Returns the split details + recipient handles a client needs to send money to.
    Used for non-gateway methods (paypal/zelle/venmo)."""
    booking = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking["client_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    keys = await _get_integration_keys()
    if method not in ("paypal", "zelle", "venmo", "bank_transfer"):
        raise HTTPException(status_code=422, detail="Method must be paypal/zelle/venmo/bank_transfer")
    if not keys.get(f"enable_{method}"):
        raise HTTPException(status_code=503, detail="This method is disabled by the admin")

    platform_handle = keys.get({
        "paypal": "paypal_platform_email",
        "zelle": "zelle_platform_handle",
        "venmo": "venmo_platform_handle",
        "bank_transfer": "bank_platform_details",
    }[method])
    if not platform_handle:
        raise HTTPException(status_code=503, detail="The admin has not set up details for this method")

    amount = float(booking.get("total_price") or 0)
    platform_take = float(booking.get("platform_take") or 0)
    executor_take = float(booking.get("executor_take") or 0)
    commission_rate_snapshot = booking.get("commission_rate_snapshot")

    # Fallback: if the split is missing/zero on this booking (older bookings,
    # legacy data, or commission not applied at creation time), recompute it
    # NOW from the category's current commission rate. The executor's set price
    # is treated as authoritative; commission is added ON TOP of it.
    if platform_take <= 0 or executor_take <= 0:
        # Determine executor's set price (in priority order)
        executor_rate = (
            float(booking.get("executor_rate") or 0)
            or float(booking.get("provider_hourly_rate") or 0)
            or float(booking.get("estimated_price") or 0)
            or amount
        )
        category_id = booking.get("category")
        pricing = await compute_client_pricing(executor_rate, category_id)
        client_total = pricing["client_total"]
        platform_take = pricing["platform_take"]
        executor_take = pricing["executor_take"]
        amount = client_total  # client must pay marked-up total
        commission_rate_snapshot = pricing["commission_rate"]

        # Persist back so subsequent reads stay consistent
        try:
            await db.bookings.update_one(
                {"booking_id": booking_id},
                {"$set": {
                    "total_price": client_total,
                    "executor_rate": pricing["executor_rate"],
                    "commission_rate_snapshot": pricing["commission_rate"],
                    "commission_amount": pricing["commission_amount"],
                    "platform_take": platform_take,
                    "executor_take": executor_take,
                }}
            )
            # Mirror to linked task (if exists) so executor / payouts see correct numbers
            await db.tasks.update_many(
                {"booking_id": booking_id},
                {"$set": {
                    "total_price": client_total,
                    "executor_take": executor_take,
                    "platform_take": platform_take,
                    "commission_rate_snapshot": pricing["commission_rate"],
                }}
            )
        except Exception as _e:
            logging.warning(f"manual-instructions: failed to backfill booking split: {_e}")

    # Look up executor's contact for this method
    provider_id = booking.get("provider_id")
    provider_handle = None
    if provider_id:
        if method == "bank_transfer":
            # Pull from saved payout_accounts (card or bank), prefer default
            pa = await db.payout_accounts.find_one(
                {"user_id": provider_id, "is_default": True}, {"_id": 0}
            ) or await db.payout_accounts.find_one({"user_id": provider_id}, {"_id": 0})
            if pa:
                if pa.get("account_type") == "card":
                    provider_handle = f"{(pa.get('card_brand') or 'CARD').upper()} •••• {pa.get('card_last4', '????')} — {pa.get('account_holder_name','')}"
                else:
                    provider_handle = f"{pa.get('bank_name') or 'Bank'} routing {pa.get('routing_number','?')} acct •••• {pa.get('account_number_last4', '????')} — {pa.get('account_holder_name','')}"
        else:
            prov = await db.users.find_one({"user_id": provider_id}, {"_id": 0, "paypal_email": 1, "zelle_handle": 1, "venmo_handle": 1}) or {}
            provider_handle = prov.get({
                "paypal": "paypal_email",
                "zelle": "zelle_handle",
                "venmo": "venmo_handle",
            }[method])

    currency = (keys.get("stripe_currency") or "usd").upper()

    instructions = {
        "method": method,
        "booking_id": booking_id,
        "currency": currency,
        "total": round(amount, 2),
        "commission_rate": float(commission_rate_snapshot) if commission_rate_snapshot is not None else None,
        "splits": [
            {
                "to": "platform",
                "label": "HandyHub (platform)",
                "amount": round(platform_take, 2),
                "handle": platform_handle,
            },
            {
                "to": "executor",
                "label": "Pro",
                "amount": round(executor_take, 2),
                "handle": provider_handle or "(the pro has not provided their account yet)",
                "missing_handle": not provider_handle,
            },
        ],
        "note": "Send both amounts to the respective recipients in the " + method.upper() + " app, then tap \"I sent it\".",
    }
    return instructions


@api_router.post("/payments/manual-confirm")
async def confirm_manual_payment(
    payload: Dict[str, Any] = Body(...),
    current_user: User = Depends(get_current_user),
):
    """Client marks they have sent manual payment (zelle/venmo/paypal). Creates a
    pending payment transaction; admin verifies + marks the booking paid manually."""
    booking_id = payload.get("booking_id")
    method = payload.get("method")
    if not booking_id or method not in ("paypal", "zelle", "venmo", "bank_transfer"):
        raise HTTPException(status_code=422, detail="booking_id + method required")
    booking = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking["client_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Optional tip amount the client decided to include for the executor
    try:
        tip_amount = float(payload.get("tip_amount") or 0)
        if tip_amount < 0:
            tip_amount = 0.0
    except (TypeError, ValueError):
        tip_amount = 0.0

    base_total = float(booking.get("total_price") or 0)
    total_with_tip = round(base_total + tip_amount, 2)

    txn_id = f"txn_{uuid.uuid4().hex[:12]}"
    txn = {
        "transaction_id": txn_id,
        "booking_id": booking_id,
        "user_id": current_user.user_id,
        "amount": total_with_tip,
        "currency": "usd",
        "payment_method": method,
        "payment_status": "pending_verification",
        "metadata": {
            "type": "manual_split",
            "method": method,
            "note": (payload.get("note") or "")[:500],
            "platform_take": float(booking.get("platform_take") or 0),
            "executor_take": round(float(booking.get("executor_take") or 0) + tip_amount, 2),
            "tip_amount": tip_amount,
            "base_total": base_total,
        },
        "created_at": datetime.now(timezone.utc),
    }
    await db.payment_transactions.insert_one(txn)

    booking_update = {
        "payment_status": "pending_verification",
        "payment_method": method,
        "payment_session_id": txn_id,
        "manual_payment_submitted_at": datetime.now(timezone.utc),
    }
    if tip_amount > 0:
        booking_update["tip_amount"] = tip_amount
    await db.bookings.update_one({"booking_id": booking_id}, {"$set": booking_update})

    # Mirror the pending payment status onto the linked task so the client UI
    # immediately reflects "waiting for admin verification" instead of still
    # showing the green "Pay task" button.
    task_update = {
        "payment_status": "pending_verification",
        "payment_method": method,
        "manual_payment_submitted_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    if tip_amount > 0:
        task_update["tip_amount"] = tip_amount
    await db.tasks.update_many({"booking_id": booking_id}, {"$set": task_update})

    # Notify admin to verify
    admin = await db.users.find_one({"role": "admin"}, {"_id": 0, "user_id": 1})
    if admin:
        try:
            await notify_user(
                admin["user_id"],
                "manual_payment_pending",
                "Payment awaiting confirmation",
                f"The client sent a {method.upper()} payment for booking {booking_id}. Check your account and confirm in admin.",
                related_id=booking_id,
                related_type="booking",
                channels=["inapp", "push", "email"],
            )
        except Exception:
            pass
    # Notify provider so they can confirm receipt of their share independently
    provider_id = booking.get("provider_id")
    if provider_id:
        try:
            executor_amt = round(float(booking.get("executor_take") or 0) + tip_amount, 2)
            tip_msg = f" (incl. ${tip_amount:.0f} tip)" if tip_amount > 0 else ""
            await notify_user(
                provider_id,
                "manual_payment_pending",
                "The client sent you a payment",
                f"The client reported sending you ${executor_amt:.2f}{tip_msg} via {method.upper()}. Check your account and confirm receipt in the task details.",
                related_id=booking_id,
                related_type="booking",
                channels=["inapp", "push", "email", "sms"],
            )
        except Exception:
            pass
    return {"ok": True, "transaction_id": txn_id, "status": "pending_verification"}


# ──────────────────────────────────────────────────────────────────────
# Two-step verification: provider self-confirms receipt of their share.
# When BOTH executor_confirmed AND admin_confirmed are true → task becomes
# fully paid. Either party can be first.
# ──────────────────────────────────────────────────────────────────────
async def _finalize_payment_if_both_confirmed(booking_id: str):
    """Bump task.status to PAID iff executor_confirmed AND admin_confirmed are both True.
    Returns the resolved payment status string."""
    b = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not b:
        return None
    exec_ok = bool(b.get("executor_confirmed"))
    admin_ok = bool(b.get("admin_confirmed"))
    if exec_ok and admin_ok:
        now = datetime.now(timezone.utc)
        await db.bookings.update_one(
            {"booking_id": booking_id},
            {"$set": {
                "status": "paid",
                "payment_status": "paid",
                "paid_at": now,
            }},
        )
        await db.tasks.update_many(
            {"booking_id": booking_id},
            {"$set": {"status": TaskStatus.PAID, "payment_status": "paid", "paid_at": now, "updated_at": now}},
        )
        # Notify all participants
        for uid_key, role_label in (("client_id", "client"), ("provider_id", "pro")):
            uid = b.get(uid_key)
            if not uid:
                continue
            try:
                await notify_user(
                    uid,
                    "payment_fully_confirmed",
                    "Task fully paid ✅",
                    "The admin and the pro confirmed receipt of funds. The task is closed.",
                    related_id=booking_id, related_type="booking",
                    channels=["inapp", "push", "email"],
                )
            except Exception:
                pass
        return "paid"
    if exec_ok:
        return "executor_confirmed"
    if admin_ok:
        return "admin_confirmed"
    return b.get("payment_status") or "pending_verification"


@api_router.post("/admin/test/mark-user-paid")
async def admin_test_mark_user_paid(
    payload: Dict[str, Any] = Body(...),
    current_user: User = Depends(require_admin),
):
    """TEST helper — marks ALL bookings/tasks of a given user as fully paid.
    Body: {"email": "client@..."} (matches client or provider role)."""
    email = (payload.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=422, detail="email required")
    u = await db.users.find_one({"email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}}, {"_id": 0, "user_id": 1, "role": 1, "email": 1})
    if not u:
        raise HTTPException(status_code=404, detail=f"User '{email}' not found")
    uid = u["user_id"]
    now = datetime.now(timezone.utc)
    q = {"$or": [{"client_id": uid}, {"provider_id": uid}]}
    set_payload = {
        "status": "paid",
        "payment_status": "paid",
        "executor_confirmed": True,
        "admin_confirmed": True,
        "paid_at": now,
    }
    bookings_res = await db.bookings.update_many(q, {"$set": set_payload})
    task_set = {**set_payload, "status": TaskStatus.PAID, "updated_at": now}
    tasks_res = await db.tasks.update_many(q, {"$set": task_set})
    return {
        "ok": True,
        "user_email": u["email"],
        "role": u.get("role"),
        "bookings_updated": bookings_res.modified_count,
        "tasks_updated": tasks_res.modified_count,
    }


@api_router.post("/admin/payments/backfill-paid-status")
async def backfill_paid_status(current_user: User = Depends(require_admin)):
    """One-time fixer: for bookings where both executor_confirmed AND admin_confirmed
    are True but status is still 'completed_pending_payment', bump them to 'paid'.
    Also mirrors onto tasks."""
    cursor = db.bookings.find(
        {"executor_confirmed": True, "admin_confirmed": True, "status": {"$ne": "paid"}},
        {"_id": 0, "booking_id": 1},
    )
    fixed = 0
    async for b in cursor:
        await _finalize_payment_if_both_confirmed(b["booking_id"])
        fixed += 1
    return {"ok": True, "fixed": fixed}


@api_router.post("/payments/executor-confirm")
async def executor_confirm_manual_payment(
    payload: Dict[str, Any] = Body(...),
    current_user: User = Depends(get_current_user),
):
    """Provider clicks "I received my share" — confirms they received the
    manual payment. Sets executor_confirmed=True on the booking and linked
    task. Final task.status=paid only after admin ALSO confirms."""
    booking_id = payload.get("booking_id")
    action = (payload.get("action") or "confirm").lower()  # confirm | reject
    if not booking_id:
        raise HTTPException(status_code=422, detail="booking_id required")
    if action not in ("confirm", "reject"):
        raise HTTPException(status_code=422, detail="action must be confirm|reject")
    b = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    if b.get("provider_id") != current_user.user_id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Access denied")
    if b.get("payment_status") not in ("pending_verification", "paid", "executor_confirmed", "admin_confirmed"):
        raise HTTPException(status_code=400, detail="Payment not awaiting confirmation")

    now = datetime.now(timezone.utc)
    if action == "confirm":
        await db.bookings.update_one(
            {"booking_id": booking_id},
            {"$set": {"executor_confirmed": True, "executor_confirmed_at": now}},
        )
        await db.tasks.update_many(
            {"booking_id": booking_id},
            {"$set": {"executor_confirmed": True, "executor_confirmed_at": now, "updated_at": now}},
        )
        new_status = await _finalize_payment_if_both_confirmed(booking_id)
        # Notify client + admin
        for uid in [b.get("client_id")]:
            if uid:
                try:
                    await notify_user(
                        uid,
                        "executor_confirmed_payment",
                        "The pro confirmed receipt",
                        "Waiting only for the admin's confirmation." if new_status != "paid" else "Task fully paid.",
                        related_id=booking_id, related_type="booking",
                    )
                except Exception:
                    pass
        admin = await db.users.find_one({"role": "admin"}, {"_id": 0, "user_id": 1})
        if admin and new_status != "paid":
            try:
                await notify_user(
                    admin["user_id"],
                    "executor_confirmed_payment",
                    "The pro confirmed the payment",
                    f"The pro confirmed receipt for booking {booking_id}. Your share still needs confirmation.",
                    related_id=booking_id, related_type="booking",
                )
            except Exception:
                pass
        return {"ok": True, "payment_status": new_status or "executor_confirmed"}
    else:
        # Executor rejects — mark as disputed; admin must intervene
        await db.bookings.update_one(
            {"booking_id": booking_id},
            {"$set": {"payment_status": "disputed", "executor_rejected_at": now}},
        )
        await db.tasks.update_many(
            {"booking_id": booking_id},
            {"$set": {"payment_status": "disputed", "updated_at": now}},
        )
        admin = await db.users.find_one({"role": "admin"}, {"_id": 0, "user_id": 1})
        if admin:
            try:
                await notify_user(
                    admin["user_id"],
                    "payment_disputed",
                    "⚠ Payment dispute",
                    f"The pro reported NOT receiving payment for booking {booking_id}. Contact both parties.",
                    related_id=booking_id, related_type="booking",
                    channels=["inapp", "push", "email", "sms"],
                )
            except Exception:
                pass
        # Notify client too
        if b.get("client_id"):
            try:
                await notify_user(
                    b["client_id"],
                    "payment_disputed",
                    "The pro did not receive payment",
                    "The pro did not see your transfer. The admin will contact you to clarify.",
                    related_id=booking_id, related_type="booking",
                )
            except Exception:
                pass
        return {"ok": True, "payment_status": "disputed"}


@api_router.post("/admin/payments/{transaction_id}/verify")
async def verify_manual_payment(
    transaction_id: str,
    payload: Dict[str, Any] = Body(default=None),
    current_user: User = Depends(require_admin),
):
    """Admin confirms (or rejects) a manual payment."""
    txn = await db.payment_transactions.find_one({"transaction_id": transaction_id}, {"_id": 0})
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    action = (payload or {}).get("action", "approve")  # approve | reject
    if action not in ("approve", "reject"):
        raise HTTPException(status_code=422, detail="action must be approve|reject")
    if action == "approve":
        # Admin confirms their share (commission) was received. Final paid only
        # if executor ALSO confirmed receipt of their share.
        now = datetime.now(timezone.utc)
        await db.payment_transactions.update_one(
            {"transaction_id": transaction_id},
            {"$set": {"payment_status": "admin_confirmed", "verified_by": current_user.user_id, "verified_at": now}},
        )
        await db.bookings.update_one(
            {"booking_id": txn["booking_id"]},
            {"$set": {"admin_confirmed": True, "admin_confirmed_at": now}},
        )
        await db.tasks.update_many(
            {"booking_id": txn["booking_id"]},
            {"$set": {"admin_confirmed": True, "admin_confirmed_at": now, "updated_at": now}},
        )
        final_status = await _finalize_payment_if_both_confirmed(txn["booking_id"])
        # Notify client + provider
        b = await db.bookings.find_one({"booking_id": txn["booking_id"]}, {"_id": 0})
        notify_targets = []
        if b and b.get("client_id"):
            notify_targets.append(b["client_id"])
        if b and b.get("provider_id") and not b.get("executor_confirmed"):
            notify_targets.append(b["provider_id"])
        for uid in notify_targets:
            try:
                await notify_user(
                    uid,
                    "admin_confirmed_payment",
                    "The admin confirmed the commission",
                    "Waiting for the pro's confirmation." if final_status != "paid" else "Task fully paid.",
                    related_id=txn["booking_id"], related_type="booking",
                )
            except Exception:
                pass
        return {"ok": True, "payment_status": final_status or "admin_confirmed"}
    else:
        # Reject — mark txn rejected, booking disputed
        now = datetime.now(timezone.utc)
        await db.payment_transactions.update_one(
            {"transaction_id": transaction_id},
            {"$set": {"payment_status": "rejected", "verified_by": current_user.user_id, "verified_at": now}},
        )
        await db.bookings.update_one(
            {"booking_id": txn["booking_id"]},
            {"$set": {"payment_status": "disputed"}},
        )
        await db.tasks.update_many(
            {"booking_id": txn["booking_id"]},
            {"$set": {"payment_status": "disputed", "updated_at": now}},
        )
        # Notify client
        if txn.get("user_id"):
            try:
                await notify_user(
                    txn["user_id"],
                    "payment_rejected",
                    "Payment rejected",
                    "The admin could not find your payment. Check the details and try again.",
                    related_id=txn["booking_id"], related_type="booking",
                )
            except Exception:
                pass
        return {"ok": True, "payment_status": "rejected"}


@api_router.get("/admin/payment-stats")
async def admin_payment_stats(
    year: Optional[int] = None,
    month: Optional[int] = None,
    sort: str = "date_desc",
    current_user: User = Depends(require_admin),
):
    """Admin payment statistics: who paid, when, for which task, amounts, totals,
    plus a per-month/year breakdown. Optional filters by year and month."""
    query = {"payment_status": {"$in": ["paid", "admin_confirmed"]}}
    txns = await db.payment_transactions.find(query, {"_id": 0}).to_list(2000)

    # Cache lookups
    booking_ids = list({t.get("booking_id") for t in txns if t.get("booking_id")})
    bookings = {b["booking_id"]: b for b in await db.bookings.find(
        {"booking_id": {"$in": booking_ids}}, {"_id": 0}).to_list(2000)} if booking_ids else {}
    user_ids = set()
    for t in txns:
        if t.get("user_id"):
            user_ids.add(t["user_id"])
    for b in bookings.values():
        if b.get("provider_id"):
            user_ids.add(b["provider_id"])
        if b.get("client_id"):
            user_ids.add(b["client_id"])
    users = {u["user_id"]: u for u in await db.users.find(
        {"user_id": {"$in": list(user_ids)}}, {"_id": 0, "user_id": 1, "name": 1, "email": 1}).to_list(2000)} if user_ids else {}

    def uname(uid):
        u = users.get(uid) or {}
        return u.get("name") or u.get("email") or "—"

    payments = []
    total_amount = 0.0
    total_commission = 0.0
    by_month: Dict[str, Dict[str, Any]] = {}

    for t in txns:
        dt = t.get("created_at")
        if isinstance(dt, str):
            try:
                dt = datetime.fromisoformat(dt.replace("Z", "+00:00"))
            except Exception:
                dt = None
        if not isinstance(dt, datetime):
            continue
        if year and dt.year != year:
            continue
        if month and dt.month != month:
            continue
        b = bookings.get(t.get("booking_id"), {})
        meta = t.get("metadata") or {}
        gateway = meta.get("gateway") or b.get("payment_gateway") or ("stripe" if "stripe" in (meta.get("kind") or "") else "manual")
        commission = (meta.get("platform_amount", 0) / 100.0) if meta.get("platform_amount") else float(b.get("platform_take") or 0)
        amount = float(t.get("amount") or 0)
        total_amount += amount
        total_commission += commission
        key = f"{dt.year}-{dt.month:02d}"
        if key not in by_month:
            by_month[key] = {"year": dt.year, "month": dt.month, "total": 0.0, "commission": 0.0, "count": 0}
        by_month[key]["total"] += amount
        by_month[key]["commission"] += commission
        by_month[key]["count"] += 1
        payments.append({
            "transaction_id": t.get("transaction_id"),
            "date": dt.isoformat(),
            "client_name": uname(t.get("user_id") or b.get("client_id")),
            "executor_name": uname(b.get("provider_id")) if b.get("provider_id") else "—",
            "task_title": b.get("title") or "—",
            "category": b.get("category"),
            "amount": round(amount, 2),
            "commission": round(commission, 2),
            "currency": (t.get("currency") or "usd").upper(),
            "method": gateway,
            "status": t.get("payment_status"),
        })

    reverse = not sort.endswith("asc")
    if sort.startswith("amount"):
        payments.sort(key=lambda p: p["amount"], reverse=reverse)
    else:
        payments.sort(key=lambda p: p["date"], reverse=reverse)

    months = sorted(by_month.values(), key=lambda m: (m["year"], m["month"]), reverse=True)
    years = sorted({m["year"] for m in by_month.values()}, reverse=True)

    return {
        "payments": payments,
        "total_amount": round(total_amount, 2),
        "total_commission": round(total_commission, 2),
        "total_count": len(payments),
        "by_month": [{**m, "total": round(m["total"], 2), "commission": round(m["commission"], 2)} for m in months],
        "available_years": years,
        "filters": {"year": year, "month": month, "sort": sort},
    }


@api_router.get("/payments/reminders")
async def get_payment_reminders(current_user: User = Depends(get_current_user)):
    """Return counts of pending payment-related actions for the current user.
    Used by the in-app top reminder banner.
    Client → tasks waiting for payment
    Provider → tasks waiting for executor confirmation
    Admin → all pending payments needing admin verification
    Returns first_pending_id so the banner can deep-link directly to the relevant detail page.
    """
    counts: Dict[str, Any] = {
        "role": current_user.role,
        "needs_pay": 0,
        "needs_executor_confirm": 0,
        "needs_admin_verify": 0,
        "first_pending_id": None,        # booking_id (client/admin) or task_id (executor)
        "first_pending_kind": None,       # 'booking' | 'task'
    }
    if current_user.role == UserRole.CLIENT:
        q = {
            "client_id": current_user.user_id,
            "status": "completed_pending_payment",
            "$or": [{"payment_status": {"$exists": False}}, {"payment_status": "pending"}],
        }
        counts["needs_pay"] = await db.bookings.count_documents(q)
        if counts["needs_pay"] > 0:
            first = await db.bookings.find_one(q, {"_id": 0, "booking_id": 1}, sort=[("created_at", -1)])
            if first:
                # Map booking -> linked task (task-detail is the UI entry point with the Pay button)
                t = await db.tasks.find_one({"booking_id": first["booking_id"]}, {"_id": 0, "task_id": 1})
                counts["first_pending_id"] = (t or {}).get("task_id") or first["booking_id"]
                counts["first_pending_kind"] = "task" if t else "booking"
    elif current_user.role == UserRole.PROVIDER:
        q = {
            "provider_id": current_user.user_id,
            "payment_status": "pending_verification",
            "executor_confirmed": {"$ne": True},
        }
        counts["needs_executor_confirm"] = await db.bookings.count_documents(q)
        if counts["needs_executor_confirm"] > 0:
            first = await db.bookings.find_one(q, {"_id": 0, "booking_id": 1}, sort=[("manual_payment_submitted_at", -1)])
            if first:
                t = await db.tasks.find_one({"booking_id": first["booking_id"]}, {"_id": 0, "task_id": 1})
                counts["first_pending_id"] = (t or {}).get("task_id") or first["booking_id"]
                counts["first_pending_kind"] = "task" if t else "booking"
    elif current_user.role == UserRole.ADMIN:
        counts["needs_admin_verify"] = await db.bookings.count_documents({
            "payment_status": {"$in": ["pending_verification", "executor_confirmed"]},
            "admin_confirmed": {"$ne": True},
        })
        counts["disputed"] = await db.bookings.count_documents({"payment_status": "disputed"})
        if counts["needs_admin_verify"] > 0 or counts.get("disputed", 0) > 0:
            counts["first_pending_id"] = "all"  # link to /admin-payments list
            counts["first_pending_kind"] = "admin_list"
    return counts


@api_router.get("/admin/payments/pending")
async def list_pending_manual_payments(current_user: User = Depends(require_admin)):
    """Admin sees all manual payments awaiting verification (or already partially confirmed)."""
    # Include: payment_status=pending_verification + bookings where executor or admin confirmed but not both
    cursor = db.bookings.find(
        {"payment_status": {"$in": ["pending_verification", "executor_confirmed", "admin_confirmed", "disputed"]}},
        {"_id": 0},
    ).sort("manual_payment_submitted_at", -1).limit(100)
    bookings = await cursor.to_list(100)
    items: List[Dict[str, Any]] = []
    for b in bookings:
        # Last manual txn for this booking
        txn = await db.payment_transactions.find_one(
            {"booking_id": b["booking_id"], "payment_method": {"$in": ["paypal", "zelle", "venmo", "bank_transfer"]}},
            {"_id": 0},
            sort=[("created_at", -1)],
        )
        client = await db.users.find_one({"user_id": b.get("client_id")}, {"_id": 0, "name": 1, "email": 1, "phone": 1})
        provider = await db.users.find_one({"user_id": b.get("provider_id")}, {"_id": 0, "name": 1, "email": 1, "phone": 1, "paypal_email": 1, "zelle_handle": 1, "venmo_handle": 1})
        items.append({
            "booking_id": b["booking_id"],
            "transaction_id": txn.get("transaction_id") if txn else None,
            "title": b.get("title") or b.get("service_name"),
            "category": b.get("category"),
            "payment_status": b.get("payment_status"),
            "payment_method": b.get("payment_method"),
            "total_price": b.get("total_price"),
            "platform_take": b.get("platform_take"),
            "executor_take": b.get("executor_take"),
            "tip_amount": b.get("tip_amount", 0),
            "commission_rate_snapshot": b.get("commission_rate_snapshot"),
            "manual_payment_submitted_at": b.get("manual_payment_submitted_at"),
            "executor_confirmed": bool(b.get("executor_confirmed")),
            "executor_confirmed_at": b.get("executor_confirmed_at"),
            "admin_confirmed": bool(b.get("admin_confirmed")),
            "admin_confirmed_at": b.get("admin_confirmed_at"),
            "client": client,
            "provider": provider,
            "created_at": b.get("created_at"),
        })
    return {"items": items, "count": len(items)}


class ProviderPayoutContacts(BaseModel):
    paypal_email: Optional[str] = None
    zelle_handle: Optional[str] = None
    venmo_handle: Optional[str] = None


@api_router.put("/tasker/payout-contacts")
async def update_tasker_payout_contacts(
    data: ProviderPayoutContacts,
    current_user: User = Depends(get_current_user),
):
    """Executor saves their PayPal/Zelle/Venmo handles so clients can send manual payments."""
    if current_user.role not in [UserRole.PROVIDER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only providers can update payout contacts")
    update: Dict[str, Any] = {}
    if data.paypal_email is not None:
        update["paypal_email"] = data.paypal_email.strip() or None
    if data.zelle_handle is not None:
        update["zelle_handle"] = data.zelle_handle.strip() or None
    if data.venmo_handle is not None:
        update["venmo_handle"] = data.venmo_handle.strip() or None
    if not update:
        return {"ok": True, "updated": []}
    await db.users.update_one({"user_id": current_user.user_id}, {"$set": update})
    return {"ok": True, "updated": list(update.keys())}


@api_router.get("/tasker/payout-contacts")
async def get_tasker_payout_contacts(current_user: User = Depends(get_current_user)):
    if current_user.role not in [UserRole.PROVIDER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only providers")
    u = await db.users.find_one(
        {"user_id": current_user.user_id},
        {"_id": 0, "paypal_email": 1, "zelle_handle": 1, "venmo_handle": 1},
    ) or {}
    return {
        "paypal_email": u.get("paypal_email"),
        "zelle_handle": u.get("zelle_handle"),
        "venmo_handle": u.get("venmo_handle"),
    }


# ==================== END PAYMENT METHODS ====================


# ==================== HELP CENTER / SUPPORT ====================

FAQ_DEFAULT_UK = [
    {
        "category": "General",
        "items": [
            {"q": "What is HandyHub?", "a": "HandyHub is a home services marketplace. Clients find trusted pros nearby, and pros receive orders and payments."},
            {"q": "Is registration free?", "a": "Yes, registering as both a client and a pro is completely free."},
        ],
    },
    {
        "category": "For clients",
        "items": [
            {"q": "How do I book a service?", "a": "On the home screen choose a category → describe the task → enter the address and time → pick a pro → submit the order."},
            {"q": "How do I pay for the work?", "a": "After the pro finishes the work, you'll see a \"Pay\" button. You can pay by card via Stripe — the money is split automatically between the platform and the pro."},
            {"q": "What if I'm not satisfied with the work?", "a": "Contact the pro in the built-in chat. If you can't reach an agreement — write to us via the form below and we'll resolve it."},
            {"q": "Can I cancel an order?", "a": "Yes, before the pro starts the work — with no penalties. After work begins — coordinate directly with the pro."},
        ],
    },
    {
        "category": "For pros",
        "items": [
            {"q": "How do I start receiving orders?", "a": "Register → set your location, schedule, and pricing → wait for a push notification about a new order → tap \"Accept\"."},
            {"q": "How do I get paid?", "a": "Connect Stripe Connect under \"Earnings\" → \"Payout method\". After each client payment, money is automatically transferred to your card/bank."},
            {"q": "What is the platform commission?", "a": "The platform admin sets the commission for each category. You see your rate, and the client sees the total amount including the commission."},
            {"q": "What if I can't take an order?", "a": "Tap \"Decline\" — the order returns to the queue and the client can choose another pro. This does not penalize your rating."},
        ],
    },
    {
        "category": "Payments",
        "items": [
            {"q": "Which payment methods are accepted?", "a": "Currently — bank cards (Visa, Mastercard, Amex) via Stripe Checkout. We'll add Apple Pay and Google Pay in the future."},
            {"q": "Is it safe to enter my card?", "a": "Yes. Payments are processed by Stripe — a certified PCI DSS Level 1 processor. We never see or store your full card number."},
            {"q": "How do I get a receipt?", "a": "Stripe automatically sends a receipt to the email you entered during payment."},
        ],
    },
]


@api_router.get("/help/admin-contact")
async def get_admin_contact():
    """Public — returns the first available admin so users can start a chat with them."""
    admin = await db.users.find_one(
        {"role": "admin"},
        {"_id": 0, "user_id": 1, "full_name": 1, "username": 1, "email": 1, "picture": 1},
    )
    if not admin:
        raise HTTPException(status_code=503, detail="No admin assigned yet")
    return {
        "user_id": admin["user_id"],
        "name": admin.get("full_name") or admin.get("username") or "HandyHub Support",
        "avatar": admin.get("picture"),
    }


@api_router.get("/help/faq")
async def get_faq():
    """Public FAQ list. Returns the canonical Ukrainian FAQ."""
    # could be overridden by db.faq in future
    return {"categories": FAQ_DEFAULT_UK}


@api_router.get("/help/support-info")
async def get_support_info():
    """Public — returns the contact email/phone that should be shown to users."""
    keys = await _get_integration_keys()
    return {
        "support_email": keys.get("support_email") or "Nexus.ss.llc@gmail.com",
        "support_phone": keys.get("support_phone"),
    }


class SupportRequestCreate(BaseModel):
    name: str
    email: str
    subject: Optional[str] = "Contact form request"
    message: str
    category: Optional[str] = None  # bug / feature / billing / other


@api_router.post("/help/support-request")
async def submit_support_request(data: SupportRequestCreate, request: Request):
    """Anyone (incl. guests) can send a support message.
    Persists to db.support_requests and emails the admin via SendGrid (if configured)."""
    name = (data.name or "").strip()
    email = (data.email or "").strip()
    message = (data.message or "").strip()
    if len(name) < 2 or len(name) > 100:
        raise HTTPException(status_code=422, detail="Name: 2–100 characters")
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        raise HTTPException(status_code=422, detail="Invalid email")
    if len(message) < 10 or len(message) > 5000:
        raise HTTPException(status_code=422, detail="Message: 10–5000 characters")

    # Try to attach user_id if request is authenticated
    user_id: Optional[str] = None
    try:
        auth = request.headers.get("authorization", "")
        if auth.startswith("Bearer "):
            sess = await db.sessions.find_one({"session_token": auth[7:]}, {"_id": 0, "user_id": 1})
            if sess:
                user_id = sess.get("user_id")
    except Exception:
        pass

    req_id = f"sup_{uuid.uuid4().hex[:12]}"
    doc = {
        "request_id": req_id,
        "name": name,
        "email": email,
        "subject": (data.subject or "").strip() or "Contact form request",
        "message": message,
        "category": (data.category or "").strip() or "other",
        "user_id": user_id,
        "user_agent": request.headers.get("user-agent"),
        "ip": request.client.host if request.client else None,
        "status": "new",
        "created_at": datetime.now(timezone.utc),
    }
    await db.support_requests.insert_one(doc)

    # Email admin (best-effort)
    keys = await _get_integration_keys()
    admin_email = keys.get("support_email") or "Nexus.ss.llc@gmail.com"
    body = (
        f"New message from the HandyHub form\n\n"
        f"From: {name} <{email}>\n"
        f"Category: {doc['category']}\n"
        f"Subject: {doc['subject']}\n\n"
        f"Message:\n{message}\n\n"
        f"---\n"
        f"User ID: {user_id or 'guest'}\n"
        f"IP: {doc['ip']}\n"
        f"User-Agent: {doc['user_agent']}\n"
        f"Request ID: {req_id}\n"
    )
    asyncio.create_task(
        _send_email(admin_email, f"[HandyHub Support] {doc['subject']}", body)
    )
    return {"ok": True, "request_id": req_id}


@api_router.get("/admin/support-requests")
async def list_support_requests(
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(require_admin_or_support),
):
    q: Dict[str, Any] = {}
    if status:
        q["status"] = status
    cursor = db.support_requests.find(q, {"_id": 0}).sort("created_at", -1).skip(max(0, offset)).limit(min(200, max(1, limit)))
    items = await cursor.to_list(200)
    total = await db.support_requests.count_documents(q)
    return {"items": items, "total": total}


@api_router.put("/admin/support-requests/{request_id}")
async def update_support_request(
    request_id: str,
    payload: Dict[str, Any] = Body(...),
    current_user: User = Depends(require_admin_or_support),
):
    new_status = payload.get("status")
    notes = payload.get("notes")
    update: Dict[str, Any] = {}
    if new_status in ("new", "in_progress", "resolved", "closed"):
        update["status"] = new_status
    if notes is not None:
        update["admin_notes"] = str(notes)
    if not update:
        raise HTTPException(status_code=422, detail="Nothing to update")
    update["updated_at"] = datetime.now(timezone.utc)
    res = await db.support_requests.update_one({"request_id": request_id}, {"$set": update})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


# ==================== END HELP CENTER ====================


# ==================== BLOG / COMMUNITY FEED ROUTES ====================

@api_router.get("/blog/posts")
async def list_blog_posts(
    request: Request,
    limit: int = 20,
    offset: int = 0,
    category: Optional[str] = None,
    author_id: Optional[str] = None,
    author_role: Optional[str] = None,
    pinned_first: bool = True,
):
    """Public feed of blog posts. Auth optional — anonymous users can read."""
    q: Dict[str, Any] = {"is_published": True}
    if category:
        q["category"] = category
    if author_id:
        q["author_id"] = author_id
    if author_role:
        q["author_role"] = author_role

    sort_order = [("is_pinned", -1), ("created_at", -1)] if pinned_first else [("created_at", -1)]
    cursor = db.blog_posts.find(q, {"_id": 0}).sort(sort_order).skip(max(0, offset)).limit(min(50, max(1, limit)))
    posts = await cursor.to_list(50)

    # Add liked_by_me flag for the requesting user (if logged in)
    me_id: Optional[str] = None
    try:
        auth = request.headers.get("authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
            sess = await db.sessions.find_one({"session_token": token}, {"_id": 0, "user_id": 1})
            if sess:
                me_id = sess.get("user_id")
    except Exception:
        me_id = None

    if me_id and posts:
        post_ids = [p["post_id"] for p in posts]
        liked = await db.blog_likes.find(
            {"user_id": me_id, "post_id": {"$in": post_ids}}, {"_id": 0, "post_id": 1}
        ).to_list(len(post_ids))
        liked_set = {l["post_id"] for l in liked}
        for p in posts:
            p["liked_by_me"] = p["post_id"] in liked_set
    else:
        for p in posts:
            p["liked_by_me"] = False

    total = await db.blog_posts.count_documents(q)
    return {"posts": posts, "total": total, "offset": offset, "limit": limit}


@api_router.post("/blog/posts")
async def create_blog_post(data: BlogPostCreate, current_user: User = Depends(get_current_user)):
    """Any logged-in user (client/provider/admin) can create a post."""
    title = (data.title or "").strip()
    description = (data.description or "").strip()
    if len(title) < 3 or len(title) > 200:
        raise HTTPException(status_code=422, detail="Title: 3–200 characters")
    if len(description) < 10 or len(description) > 5000:
        raise HTTPException(status_code=422, detail="Description: 10–5000 characters")
    if data.images and len(data.images) > 10:
        raise HTTPException(status_code=422, detail="No more than 10 images")

    post = BlogPost(
        post_id=f"post_{uuid.uuid4().hex[:12]}",
        author_id=current_user.user_id,
        author_role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
        author_name=getattr(current_user, "full_name", None) or getattr(current_user, "username", None) or current_user.email,
        author_avatar=getattr(current_user, "picture", None),
        title=title,
        description=description,
        images=[img for img in (data.images or []) if isinstance(img, str)],
        tags=[t.strip().lower() for t in (data.tags or []) if t and t.strip()][:10],
        category=(data.category or "").strip() or None,
        booking_id=data.booking_id,
    )
    await db.blog_posts.insert_one(post.dict())
    return post.dict()


@api_router.get("/blog/posts/{post_id}")
async def get_blog_post(post_id: str, request: Request):
    post = await db.blog_posts.find_one({"post_id": post_id, "is_published": True}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    # Pull last 50 comments
    comments = await db.blog_comments.find({"post_id": post_id}, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    # liked_by_me
    try:
        auth = request.headers.get("authorization", "")
        if auth.startswith("Bearer "):
            sess = await db.sessions.find_one({"session_token": auth[7:]}, {"_id": 0, "user_id": 1})
            if sess:
                liked = await db.blog_likes.find_one(
                    {"post_id": post_id, "user_id": sess["user_id"]}, {"_id": 0}
                )
                post["liked_by_me"] = bool(liked)
    except Exception:
        pass
    post["comments"] = comments
    return post


@api_router.post("/blog/posts/{post_id}/like")
async def toggle_blog_like(post_id: str, current_user: User = Depends(get_current_user)):
    """Toggle like. Returns the new state and updated counter."""
    post = await db.blog_posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    existing = await db.blog_likes.find_one({"post_id": post_id, "user_id": current_user.user_id})
    if existing:
        await db.blog_likes.delete_one({"_id": existing["_id"]})
        new_count = max(0, int(post.get("likes_count", 0)) - 1)
        await db.blog_posts.update_one({"post_id": post_id}, {"$set": {"likes_count": new_count}})
        return {"liked": False, "likes_count": new_count}
    else:
        await db.blog_likes.insert_one({
            "post_id": post_id,
            "user_id": current_user.user_id,
            "created_at": datetime.now(timezone.utc),
        })
        new_count = int(post.get("likes_count", 0)) + 1
        await db.blog_posts.update_one({"post_id": post_id}, {"$set": {"likes_count": new_count}})
        # Notify author (skip if author == liker)
        if post.get("author_id") and post["author_id"] != current_user.user_id:
            try:
                liker = getattr(current_user, "full_name", None) or getattr(current_user, "username", None) or "Someone"
                await notify_user(
                    post["author_id"],
                    "blog_like",
                    "New like",
                    f"{liker} liked your post \"{post.get('title','')[:80]}\"",
                    related_id=post_id,
                    related_type="blog_post",
                    channels=["inapp", "push"],
                )
            except Exception:
                pass
        return {"liked": True, "likes_count": new_count}


@api_router.post("/blog/posts/{post_id}/comments")
async def add_blog_comment(
    post_id: str,
    data: BlogCommentCreate,
    current_user: User = Depends(get_current_user),
):
    post = await db.blog_posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    text = (data.text or "").strip()
    if len(text) < 1 or len(text) > 2000:
        raise HTTPException(status_code=422, detail="Comment: 1–2000 characters")
    comment = BlogComment(
        comment_id=f"cmt_{uuid.uuid4().hex[:12]}",
        post_id=post_id,
        author_id=current_user.user_id,
        author_name=getattr(current_user, "full_name", None) or getattr(current_user, "username", None) or current_user.email,
        author_avatar=getattr(current_user, "picture", None),
        text=text,
    )
    await db.blog_comments.insert_one(comment.dict())
    new_count = int(post.get("comments_count", 0)) + 1
    await db.blog_posts.update_one({"post_id": post_id}, {"$set": {"comments_count": new_count}})
    # Notify author
    if post.get("author_id") and post["author_id"] != current_user.user_id:
        try:
            await notify_user(
                post["author_id"],
                "blog_comment",
                "New comment",
                f"{comment.author_name}: {text[:80]}",
                related_id=post_id,
                related_type="blog_post",
                channels=["inapp", "push"],
            )
        except Exception:
            pass
    return comment.dict()


@api_router.delete("/blog/posts/{post_id}")
async def delete_blog_post(post_id: str, current_user: User = Depends(get_current_user)):
    post = await db.blog_posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if post["author_id"] != current_user.user_id and role != "admin":
        raise HTTPException(status_code=403, detail="Only the author or an admin can delete")
    await db.blog_posts.delete_one({"post_id": post_id})
    await db.blog_likes.delete_many({"post_id": post_id})
    await db.blog_comments.delete_many({"post_id": post_id})
    return {"ok": True}


# ==================== END BLOG ====================


@api_router.get("/push/vapid-public-key")
async def get_vapid_public_key():
    """Public endpoint — browsers fetch this to subscribe to push.
    Returns the VAPID public key set by admin in Integration Keys."""
    doc = await db.integration_keys.find_one({"setting_id": "integration_keys"}, {"_id": 0}) or {}
    pub = doc.get("vapid_public_key")
    if not pub:
        raise HTTPException(status_code=503, detail="Push notifications not configured")
    return {"public_key": pub}


@api_router.post("/push/subscribe")
async def push_subscribe(
    payload: Dict[str, Any] = Body(...),
    current_user: User = Depends(get_current_user)
):
    """Browser registers its PushSubscription. Idempotent by endpoint."""
    endpoint = payload.get("endpoint")
    keys = payload.get("keys") or {}
    p256dh = keys.get("p256dh")
    auth = keys.get("auth")
    if not endpoint or not p256dh or not auth:
        raise HTTPException(status_code=422, detail="endpoint, keys.p256dh, keys.auth are required")
    doc = {
        "user_id": current_user.user_id,
        "endpoint": endpoint,
        "p256dh": p256dh,
        "auth": auth,
        "user_agent": payload.get("user_agent"),
        "updated_at": datetime.now(timezone.utc),
    }
    await db.push_subscriptions.update_one(
        {"endpoint": endpoint},
        {"$set": doc, "$setOnInsert": {"created_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    return {"ok": True}


@api_router.delete("/push/subscribe")
async def push_unsubscribe(
    payload: Dict[str, Any] = Body(...),
    current_user: User = Depends(get_current_user)
):
    endpoint = payload.get("endpoint")
    if not endpoint:
        raise HTTPException(status_code=422, detail="endpoint is required")
    await db.push_subscriptions.delete_one({"endpoint": endpoint, "user_id": current_user.user_id})
    return {"ok": True}


@api_router.post("/push/test")
async def push_test_self(current_user: User = Depends(get_current_user)):
    """Send a test push to the current user — useful for diagnosing setup."""
    sent = await _send_web_push(
        current_user.user_id,
        "HandyHub — test",
        "If you see this — push works ✅",
        "/",
    )
    subs = await db.push_subscriptions.count_documents({"user_id": current_user.user_id})
    return {"sent": sent, "subscriptions": subs}


@api_router.get("/admin/integration-keys")
async def get_integration_keys(current_user: User = Depends(require_admin)):
    """Admin: return masked integration keys + feature toggles."""
    doc = await db.integration_keys.find_one({"setting_id": "integration_keys"}, {"_id": 0}) or {}
    out = {}
    secret_fields = {
        "sendgrid_api_key", "resend_api_key", "stripe_secret_key", "stripe_webhook_secret",
        "twilio_auth_token", "vapid_private_key", "telegram_bot_token", "finix_api_password",
    }
    for k in IntegrationKeysUpdate.model_fields.keys():
        v = doc.get(k)
        if k in secret_fields and isinstance(v, str):
            out[k] = _mask(v)
            out[k + "_set"] = bool(v)
        else:
            out[k] = v
    # Sensible defaults so the UI shows "usd" instead of an empty input
    if not out.get("stripe_currency"):
        out["stripe_currency"] = "usd"
    if not out.get("support_email"):
        out["support_email"] = "Nexus.ss.llc@gmail.com"
    if not out.get("email_provider"):
        out["email_provider"] = "resend"
    return out


@api_router.put("/admin/integration-keys")
async def set_integration_keys(payload: IntegrationKeysUpdate, current_user: User = Depends(require_admin)):
    """Admin: update integration keys & feature toggles. Empty-string fields are ignored
    so admins can clear with explicit null but not accidentally with blank input."""
    data = payload.model_dump(exclude_unset=True)
    update = {}
    for k, v in data.items():
        if v == "":
            continue  # skip empties — must set None explicitly to clear
        if isinstance(v, str) and "•" in v:
            continue  # skip masked values so re-saving the form never corrupts a secret
        update[k] = v
    if not update:
        return {"ok": True, "updated": []}
    update["updated_at"] = datetime.now(timezone.utc)
    update["updated_by"] = current_user.user_id
    await db.integration_keys.update_one(
        {"setting_id": "integration_keys"},
        {"$set": update, "$setOnInsert": {"setting_id": "integration_keys", "created_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    return {"ok": True, "updated": list(update.keys())}


# ==================== END NEW BLOCK ===================

async def calculate_commission(booking_id: str, base_price: float) -> Dict[str, Any]:
    """Calculate commission based on rules hierarchy"""
    booking = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})    # Get settings for default commission
    settings = await get_settings()
    default_commission_percent = settings.admin_commission_percentage
    service_fee = settings.fixed_booking_fee

    # Find applicable commission rule (most specific wins)
    query = {"is_active": True}
    rules = await db.commission_rules.find(query, {"_id": 0}).sort("priority", -1).to_list(100)

    commission_percent = default_commission_percent
    commission_type = "percentage"
    applied_rule = None

    for rule in rules:
        # Check if rule applies
        if rule.get("is_global"):
            commission_percent = rule["commission_value"]
            commission_type = rule["commission_type"]
            applied_rule = rule
        elif booking and rule.get("category") == booking.get("category"):
            commission_percent = rule["commission_value"]
            commission_type = rule["commission_type"]
            applied_rule = rule
            break  # More specific rule found
        elif booking and rule.get("city") == booking.get("city"):
            commission_percent = rule["commission_value"]
            commission_type = rule["commission_type"]
            applied_rule = rule

    # Calculate amounts
    if commission_type == "percentage":
        commission_amount = base_price * (commission_percent / 100)
    else:
        commission_amount = commission_percent  # Fixed amount

    total = base_price + commission_amount + service_fee
    tasker_payout = base_price - commission_amount if commission_type == "percentage" else base_price

    return {
        "base_price": round(base_price, 2),
        "commission_percent": commission_percent if commission_type == "percentage" else 0,
        "commission_amount": round(commission_amount, 2),
        "commission_type": commission_type,
        "service_fee": round(service_fee, 2),
        "total_client_pays": round(total, 2),
        "tasker_payout": round(tasker_payout, 2),
        "applied_rule": applied_rule.get("name") if applied_rule else "default"
    }

@api_router.get("/commission/calculate")
async def get_commission_breakdown(
    base_price: float,
    category: Optional[str] = None,
    city: Optional[str] = None
):
    """Calculate commission breakdown for given price"""
    settings = await get_settings()
    default_commission_percent = settings.admin_commission_percentage
    service_fee = settings.fixed_booking_fee

    # Find applicable rule
    query = {"is_active": True}
    if category:
        query["$or"] = [{"is_global": True}, {"category": category}]
    if city:
        query["$or"] = query.get("$or", []) + [{"city": city}]

    rules = await db.commission_rules.find({"is_active": True}, {"_id": 0}).sort("priority", -1).to_list(100)

    commission_percent = default_commission_percent
    commission_type = "percentage"

    for rule in rules:
        if rule.get("is_global"):
            commission_percent = rule["commission_value"]
            commission_type = rule["commission_type"]
        if category and rule.get("category") == category:
            commission_percent = rule["commission_value"]
            commission_type = rule["commission_type"]
            break

    if commission_type == "percentage":
        commission_amount = base_price * (commission_percent / 100)
    else:
        commission_amount = commission_percent

    total = base_price + service_fee  # Client pays base + service fee
    tasker_gets = base_price - commission_amount  # Tasker gets base minus commission

    return {
        "base_price": round(base_price, 2),
        "commission_percent": commission_percent if commission_type == "percentage" else 0,
        "commission_amount": round(commission_amount, 2),
        "service_fee": round(service_fee, 2),
        "total_client_pays": round(total, 2),
        "tasker_payout": round(tasker_gets, 2)
    }

@api_router.get("/admin/commission-rules")
async def get_commission_rules(current_user: User = Depends(require_admin)):
    """Get all commission rules"""
    rules = await db.commission_rules.find({}, {"_id": 0}).sort("priority", -1).to_list(100)
    return rules

@api_router.post("/admin/commission-rules")
async def create_commission_rule(
    data: CommissionRuleCreate,
    current_user: User = Depends(require_admin)
):
    """Create new commission rule"""
    rule_id = f"rule_{uuid.uuid4().hex[:12]}"

    rule = {
        "rule_id": rule_id,
        **data.dict(),
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }

    if data.valid_from:
        rule["valid_from"] = datetime.fromisoformat(data.valid_from)
    if data.valid_until:
        rule["valid_until"] = datetime.fromisoformat(data.valid_until)

    await db.commission_rules.insert_one(rule)
    rule.pop("_id", None)

    return rule

@api_router.put("/admin/commission-rules/{rule_id}")
async def update_commission_rule(
    rule_id: str,
    data: CommissionRuleCreate,
    current_user: User = Depends(require_admin)
):
    """Update commission rule"""
    update_dict = data.dict(exclude_unset=True)
    update_dict["updated_at"] = datetime.now(timezone.utc)

    if data.valid_from:
        update_dict["valid_from"] = datetime.fromisoformat(data.valid_from)
    if data.valid_until:
        update_dict["valid_until"] = datetime.fromisoformat(data.valid_until)

    result = await db.commission_rules.update_one(
        {"rule_id": rule_id},
        {"$set": update_dict}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Rule not found")

    updated = await db.commission_rules.find_one({"rule_id": rule_id}, {"_id": 0})
    return updated

@api_router.delete("/admin/commission-rules/{rule_id}")
async def delete_commission_rule(
    rule_id: str,
    current_user: User = Depends(require_admin)
):
    """Delete commission rule"""
    result = await db.commission_rules.delete_one({"rule_id": rule_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Rule not found")
    return {"message": "Rule deleted"}

# ==================== TASKER VERIFICATION ENDPOINTS ====================

@api_router.post("/tasker/documents")
async def upload_tasker_document(
    data: TaskerDocumentCreate,
    current_user: User = Depends(get_current_user)
):
    """Tasker uploads verification document"""
    if current_user.role not in [UserRole.PROVIDER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only providers can upload documents")

    document_id = f"doc_{uuid.uuid4().hex[:12]}"

    document = {
        "document_id": document_id,
        "user_id": current_user.user_id,
        "document_type": data.document_type,
        "file_data": data.file_data,
        "status": "pending",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }

    if data.expiry_date:
        document["expiry_date"] = datetime.fromisoformat(data.expiry_date)

    await db.tasker_documents.insert_one(document)
    document.pop("_id", None)

    # Update profile verification status
    await db.executor_profiles.update_one(
        {"user_id": current_user.user_id},
        {"$set": {"verification_status": "pending", "updated_at": datetime.now(timezone.utc)}}
    )

    return document

@api_router.get("/tasker/documents")
async def get_my_documents(current_user: User = Depends(get_current_user)):
    """Get current tasker's documents"""
    if current_user.role not in [UserRole.PROVIDER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only providers can view documents")

    documents = await db.tasker_documents.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).to_list(50)

    return documents

@api_router.get("/admin/documents/pending")
async def get_pending_documents(current_user: User = Depends(require_admin)):
    """Get all pending documents for review"""
    documents = await db.tasker_documents.find(
        {"status": "pending"},
        {"_id": 0}
    ).to_list(100)

    # Add user info
    for doc in documents:
        user = await db.users.find_one({"user_id": doc["user_id"]}, {"_id": 0, "password_hash": 0, "plain_password": 0})
        doc["user"] = user

    return documents

@api_router.put("/admin/documents/{document_id}/verify")
async def verify_document(
    document_id: str,
    approved: bool,
    rejection_reason: Optional[str] = None,
    current_user: User = Depends(require_admin)
):
    """Admin approves or rejects document"""
    document = await db.tasker_documents.find_one({"document_id": document_id}, {"_id": 0})
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    update_data = {
        "status": "approved" if approved else "rejected",
        "verified_by": current_user.user_id,
        "verified_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }

    if not approved and rejection_reason:
        update_data["rejection_reason"] = rejection_reason

    await db.tasker_documents.update_one(
        {"document_id": document_id},
        {"$set": update_data}
    )

    # Check if all required documents are approved
    user_docs = await db.tasker_documents.find(
        {"user_id": document["user_id"]},
        {"_id": 0}
    ).to_list(50)

    all_approved = all(d["status"] == "approved" for d in user_docs if d["document_type"] in ["id_card", "passport"])

    if all_approved and user_docs:
        await db.executor_profiles.update_one(
            {"user_id": document["user_id"]},
            {"$set": {
                "verification_status": "approved",
                "is_verified": True,
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        # Award verified badge
        badge = {
            "badge_id": f"badge_{uuid.uuid4().hex[:12]}",
            "user_id": document["user_id"],
            "badge_type": "verified",
            "awarded_at": datetime.now(timezone.utc),
            "awarded_by": current_user.user_id,
            "is_active": True
        }
        await db.tasker_badges.insert_one(badge)

    return {"message": "Document verified", "approved": approved}

# ==================== BADGES ENDPOINTS ====================

@api_router.get("/tasker/{user_id}/badges")
async def get_tasker_badges(user_id: str):
    """Get badges for a tasker"""
    badges = await db.tasker_badges.find(
        {"user_id": user_id, "is_active": True},
        {"_id": 0}
    ).to_list(50)
    return badges

@api_router.post("/admin/badges")
async def award_badge(
    data: TaskerBadgeCreate,
    current_user: User = Depends(require_admin)
):
    """Admin awards badge to tasker"""
    badge_id = f"badge_{uuid.uuid4().hex[:12]}"

    badge = {
        "badge_id": badge_id,
        "user_id": data.user_id,
        "badge_type": data.badge_type,
        "awarded_at": datetime.now(timezone.utc),
        "awarded_by": current_user.user_id,
        "is_active": True
    }

    if data.expires_at:
        badge["expires_at"] = datetime.fromisoformat(data.expires_at)

    await db.tasker_badges.insert_one(badge)
    badge.pop("_id", None)

    # Update profile badges
    await db.executor_profiles.update_one(
        {"user_id": data.user_id},
        {"$addToSet": {"badges": data.badge_type}}
    )

    return badge

@api_router.delete("/admin/badges/{badge_id}")
async def revoke_badge(
    badge_id: str,
    current_user: User = Depends(require_admin)
):
    """Admin revokes badge"""
    badge = await db.tasker_badges.find_one({"badge_id": badge_id}, {"_id": 0})
    if not badge:
        raise HTTPException(status_code=404, detail="Badge not found")

    await db.tasker_badges.update_one(
        {"badge_id": badge_id},
        {"$set": {"is_active": False}}
    )

    # Remove from profile
    await db.executor_profiles.update_one(
        {"user_id": badge["user_id"]},
        {"$pull": {"badges": badge["badge_type"]}}
    )

    return {"message": "Badge revoked"}

# ==================== PAYOUT ENDPOINTS ====================

def _luhn_check(card_number: str) -> bool:
    """Validate credit/debit card number via Luhn algorithm."""
    digits = [int(c) for c in card_number if c.isdigit()]
    if len(digits) < 12 or len(digits) > 19:
        return False
    checksum = 0
    for i, d in enumerate(reversed(digits)):
        if i % 2 == 1:
            d *= 2
            if d > 9:
                d -= 9
        checksum += d
    return checksum % 10 == 0


def _detect_card_brand(card_number: str) -> str:
    n = "".join(c for c in card_number if c.isdigit())
    if n.startswith("4"):
        return "visa"
    if n[:2] in ("34", "37"):
        return "amex"
    if n[:2] in ("51", "52", "53", "54", "55") or (n[:4].isdigit() and 2221 <= int(n[:4]) <= 2720):
        return "mastercard"
    if n.startswith("6011") or n.startswith("65"):
        return "discover"
    return "unknown"


@api_router.post("/tasker/payout-accounts")
async def create_payout_account(
    data: PayoutAccountCreate,
    current_user: User = Depends(get_current_user)
):
    """Tasker adds a payout account (bank or debit card). Only last4 digits are stored —
    full numbers are validated then discarded, awaiting Stripe Connect tokenization."""
    if current_user.role not in [UserRole.PROVIDER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only providers can add payout accounts")

    if data.account_type not in ("bank", "card"):
        raise HTTPException(status_code=422, detail="account_type must be 'bank' or 'card'")
    if not data.account_holder_name or len(data.account_holder_name.strip()) < 2:
        raise HTTPException(status_code=422, detail="Account holder name is required")

    account_id = f"acc_{uuid.uuid4().hex[:12]}"
    account = {
        "account_id": account_id,
        "user_id": current_user.user_id,
        "account_type": data.account_type,
        "account_holder_name": data.account_holder_name.strip(),
        "is_default": True,
        "is_verified": False,
        "verification_status": "pending",
        "created_at": datetime.now(timezone.utc),
    }

    if data.account_type == "bank":
        if not data.account_number or not data.routing_number:
            raise HTTPException(status_code=422, detail="Routing and account number are required for a bank")
        acc_num = "".join(c for c in data.account_number if c.isdigit())
        rt_num = "".join(c for c in data.routing_number if c.isdigit())
        if len(acc_num) < 4 or len(acc_num) > 17:
            raise HTTPException(status_code=422, detail="Invalid account number length")
        if len(rt_num) != 9:
            raise HTTPException(status_code=422, detail="Routing number must be 9 digits")
        account["bank_name"] = (data.bank_name or "").strip() or None
        account["account_number_last4"] = acc_num[-4:]
        account["routing_number"] = rt_num  # ABA routing numbers are public, OK to store
    else:  # card
        if not data.card_number or not data.card_exp_month or not data.card_exp_year:
            raise HTTPException(status_code=422, detail="Card number and expiry are required")
        card_num = "".join(c for c in data.card_number if c.isdigit())
        if not _luhn_check(card_num):
            raise HTTPException(status_code=422, detail="Invalid card number")
        if not (1 <= int(data.card_exp_month) <= 12):
            raise HTTPException(status_code=422, detail="Invalid month")
        exp_year = int(data.card_exp_year)
        if exp_year < 100:
            exp_year += 2000
        if exp_year < datetime.now(timezone.utc).year:
            raise HTTPException(status_code=422, detail="The card has expired")
        account["card_brand"] = _detect_card_brand(card_num)
        account["card_last4"] = card_num[-4:]
        account["card_exp_month"] = int(data.card_exp_month)
        account["card_exp_year"] = exp_year

    # Mark older accounts as non-default
    await db.payout_accounts.update_many(
        {"user_id": current_user.user_id},
        {"$set": {"is_default": False}}
    )

    await db.payout_accounts.insert_one(account)
    account.pop("_id", None)

    return account

@api_router.get("/tasker/payout-accounts")
async def get_payout_accounts(current_user: User = Depends(get_current_user)):
    """Get tasker's payout accounts"""
    if current_user.role not in [UserRole.PROVIDER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only providers can view payout accounts")

    accounts = await db.payout_accounts.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).to_list(10)

    return accounts

@api_router.get("/tasker/payouts")
async def get_tasker_payouts(current_user: User = Depends(get_current_user)):
    """Get tasker's payout history"""
    if current_user.role not in [UserRole.PROVIDER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only providers can view payouts")

    payouts = await db.payouts.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)

    return payouts


@api_router.delete("/tasker/payout-accounts/{account_id}")
async def delete_payout_account(account_id: str, current_user: User = Depends(get_current_user)):
    """Tasker removes their payout account."""
    if current_user.role not in [UserRole.PROVIDER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only providers can modify payout accounts")
    res = await db.payout_accounts.delete_one(
        {"account_id": account_id, "user_id": current_user.user_id}
    )
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Payout account not found")
    # Promote some other account to default
    remaining = await db.payout_accounts.find_one({"user_id": current_user.user_id}, {"_id": 0})
    if remaining:
        await db.payout_accounts.update_one(
            {"account_id": remaining["account_id"]},
            {"$set": {"is_default": True}},
        )
    return {"ok": True}


@api_router.post("/tasker/payout-accounts/{account_id}/default")
async def set_default_payout_account(account_id: str, current_user: User = Depends(get_current_user)):
    """Mark this account as the default for the current tasker."""
    if current_user.role not in [UserRole.PROVIDER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only providers can modify payout accounts")
    found = await db.payout_accounts.find_one(
        {"account_id": account_id, "user_id": current_user.user_id}, {"_id": 0}
    )
    if not found:
        raise HTTPException(status_code=404, detail="Payout account not found")
    await db.payout_accounts.update_many(
        {"user_id": current_user.user_id}, {"$set": {"is_default": False}}
    )
    await db.payout_accounts.update_one(
        {"account_id": account_id}, {"$set": {"is_default": True}}
    )
    return {"ok": True}


@api_router.post("/admin/payouts/release")
async def release_payout(
    data: PayoutCreate,
    current_user: User = Depends(require_admin)
):
    """Admin releases payout to tasker"""
    # Get default payout account
    account = await db.payout_accounts.find_one(
        {"user_id": data.user_id, "is_default": True},
        {"_id": 0}
    )

    if not account:
        raise HTTPException(status_code=400, detail="Tasker has no payout account")

    # Get settings for commission
    settings = await get_settings()
    commission_percent = settings.admin_commission_percentage
    commission_deducted = data.amount * (commission_percent / 100)
    net_amount = data.amount - commission_deducted

    payout_id = f"payout_{uuid.uuid4().hex[:12]}"

    payout = {
        "payout_id": payout_id,
        "user_id": data.user_id,
        "payout_account_id": account["account_id"],
        "amount": data.amount,
        "currency": "USD",
        "status": "processing",
        "job_ids": data.job_ids,
        "commission_deducted": round(commission_deducted, 2),
        "net_amount": round(net_amount, 2),
        "scheduled_date": datetime.now(timezone.utc),
        "created_at": datetime.now(timezone.utc)
    }

    await db.payouts.insert_one(payout)
    payout.pop("_id", None)

    return payout

@api_router.get("/admin/payouts/pending")
async def get_pending_payouts(current_user: User = Depends(require_admin)):
    """Get all pending payouts"""
    # Get completed tasks that haven't been paid out
    pipeline = [
        {"$match": {"status": {"$in": [TaskStatus.COMPLETED_PENDING_PAYMENT, TaskStatus.PAID]}}},
        {"$group": {
            "_id": "$provider_id",
            "total_amount": {"$sum": "$final_price"},
            "task_count": {"$sum": 1},
            "task_ids": {"$push": "$task_id"}
        }}
    ]

    pending = await db.tasks.aggregate(pipeline).to_list(100)

    # Add user info
    for item in pending:
        user = await db.users.find_one({"user_id": item["_id"]}, {"_id": 0, "password_hash": 0, "plain_password": 0})
        item["user"] = user

    return JSONResponse(content=clean_bson(pending))

# ==================== REFUND ENDPOINTS ====================

@api_router.post("/refunds")
async def request_refund(
    data: RefundCreate,
    current_user: User = Depends(get_current_user)
):
    """Request a refund"""
    booking = await db.bookings.find_one({"booking_id": data.booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Only client or admin can request
    if booking["client_id"] != current_user.user_id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Access denied")

    refund_id = f"refund_{uuid.uuid4().hex[:12]}"

    refund = {
        "refund_id": refund_id,
        "booking_id": data.booking_id,
        "user_id": current_user.user_id,
        "amount": data.amount,
        "reason": data.reason,
        "status": "requested",
        "created_at": datetime.now(timezone.utc)
    }

    await db.refunds.insert_one(refund)
    refund.pop("_id", None)

    return refund

@api_router.get("/admin/refunds")
async def get_refunds(
    status: Optional[str] = None,
    current_user: User = Depends(require_admin)
):
    """Get all refunds"""
    query = {}
    if status:
        query["status"] = status

    refunds = await db.refunds.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)

    # Add booking and user info
    for refund in refunds:
        booking = await db.bookings.find_one({"booking_id": refund["booking_id"]}, {"_id": 0})
        refund["booking"] = booking
        user = await db.users.find_one({"user_id": refund["user_id"]}, {"_id": 0, "password_hash": 0, "plain_password": 0})
        refund["user"] = user

    return refunds

@api_router.put("/admin/refunds/{refund_id}/approve")
async def approve_refund(
    refund_id: str,
    approved: bool,
    rejection_reason: Optional[str] = None,
    current_user: User = Depends(require_admin)
):
    """Admin approves or rejects refund"""
    refund = await db.refunds.find_one({"refund_id": refund_id}, {"_id": 0})
    if not refund:
        raise HTTPException(status_code=404, detail="Refund not found")

    update_data = {
        "status": "approved" if approved else "rejected",
        "approved_by": current_user.user_id,
        "approved_at": datetime.now(timezone.utc)
    }

    if not approved and rejection_reason:
        update_data["rejection_reason"] = rejection_reason

    await db.refunds.update_one(
        {"refund_id": refund_id},
        {"$set": update_data}
    )

    return {"message": "Refund processed", "approved": approved}

# ==================== INVOICE ENDPOINTS ====================

@api_router.get("/invoices/{invoice_id}")
async def get_invoice(
    invoice_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get invoice details"""
    invoice = await db.invoices.find_one({"invoice_id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    # Check access
    if current_user.role != UserRole.ADMIN:
        if invoice["client_id"] != current_user.user_id and invoice["tasker_id"] != current_user.user_id:
            raise HTTPException(status_code=403, detail="Access denied")

    # Add related info
    booking = await db.bookings.find_one({"booking_id": invoice["booking_id"]}, {"_id": 0})
    invoice["booking"] = booking

    return invoice

@api_router.get("/client/invoices")
async def get_client_invoices(current_user: User = Depends(get_current_user)):
    """Get client's invoices"""
    invoices = await db.invoices.find(
        {"client_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)

    return invoices

@api_router.post("/admin/invoices/generate")
async def generate_invoice(
    booking_id: str,
    current_user: User = Depends(require_admin)
):
    """Generate invoice for completed booking"""
    booking = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Get commission breakdown
    settings = await get_settings()
    base_price = booking.get("total_price", 0)
    commission_percent = settings.admin_commission_percentage
    service_fee = settings.fixed_booking_fee

    commission_amount = base_price * (commission_percent / 100)
    total = base_price + service_fee

    invoice_id = f"inv_{uuid.uuid4().hex[:12]}"
    invoice_number = f"INV-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

    invoice = {
        "invoice_id": invoice_id,
        "booking_id": booking_id,
        "client_id": booking["client_id"],
        "tasker_id": booking.get("provider_id"),
        "base_price": base_price,
        "platform_commission": round(commission_amount, 2),
        "service_fee": service_fee,
        "tax_amount": 0,
        "tip_amount": booking.get("tip_amount", 0),
        "discount_amount": 0,
        "total_amount": round(total, 2),
        "payment_status": booking.get("payment_status", "pending"),
        "invoice_number": invoice_number,
        "invoice_date": datetime.now(timezone.utc),
        "created_at": datetime.now(timezone.utc)
    }

    await db.invoices.insert_one(invoice)
    invoice.pop("_id", None)

    return invoice

# ==================== PROVIDER INVOICE ENDPOINTS ====================

@api_router.get("/provider/invoices")
async def get_provider_invoices(current_user: User = Depends(get_current_user)):
    """Get provider's invoices"""
    if current_user.role not in [UserRole.PROVIDER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only providers can view their invoices")

    invoices = await db.invoices.find(
        {"tasker_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)

    return invoices

@api_router.post("/provider/invoices/create")
async def provider_create_invoice(
    data: InvoiceCreate,
    current_user: User = Depends(get_current_user)
):
    """Provider creates invoice for completed booking"""
    if current_user.role not in [UserRole.PROVIDER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only providers can create invoices")

    # Get booking
    booking = await db.bookings.find_one({"booking_id": data.booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Verify this booking belongs to this provider
    if booking.get("provider_id") != current_user.user_id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized to invoice this booking")

    # Check if invoice already exists
    existing = await db.invoices.find_one({"booking_id": data.booking_id})
    if existing:
        raise HTTPException(status_code=400, detail="Invoice already exists for this booking")

    # Get settings for commission
    settings = await get_settings()

    # Calculate price based on hours worked OR booking price
    hourly_rate = booking.get("provider_hourly_rate") or booking.get("total_price", 0) / max(booking.get("estimated_hours", 1), 1)
    if data.hours_worked and data.hours_worked > 0:
        base_price = round(hourly_rate * data.hours_worked, 2)
    else:
        base_price = booking.get("total_price", 0)

    materials = data.materials_cost or 0
    additional = data.additional_charges or 0
    subtotal = base_price + materials + additional

    # Commission is NOT shown to provider - they see their own rate
    commission_percent = settings.admin_commission_percentage
    commission_amount = base_price * (commission_percent / 100)
    service_fee = settings.fixed_booking_fee
    total_for_client = round(subtotal + service_fee, 2)
    provider_earnings = round(base_price - commission_amount + materials + additional, 2)

    invoice_id = f"inv_{uuid.uuid4().hex[:12]}"
    invoice_number = f"INV-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

    # Get client info
    client = await db.users.find_one(
        {"user_id": booking["client_id"]},
        {"_id": 0, "name": 1, "email": 1, "phone": 1, "address": 1}
    )

    # Get provider info
    provider = await db.users.find_one(
        {"user_id": current_user.user_id},
        {"_id": 0, "name": 1, "email": 1, "phone": 1}
    )

    invoice = {
        "invoice_id": invoice_id,
        "booking_id": data.booking_id,
        "client_id": booking["client_id"],
        "tasker_id": current_user.user_id,
        "client_info": client,
        "provider_info": provider,
        # Hours & pricing
        "hours_worked": data.hours_worked,
        "hourly_rate": hourly_rate,
        "base_price": base_price,
        "materials_cost": materials,
        "materials_description": data.materials_description,
        "additional_charges": additional,
        "additional_charges_description": data.additional_charges_description,
        # Totals
        "subtotal": subtotal,
        "platform_commission": round(commission_amount, 2),
        "service_fee": service_fee,
        "tax_amount": 0,
        "tip_amount": booking.get("tip_amount", 0),
        "discount_amount": 0,
        "total_amount": total_for_client,
        "provider_earnings": provider_earnings,
        # Content
        "notes": data.notes,
        "closing_message": data.closing_message,
        "ongoing_job": data.ongoing_job or False,
        # Status
        "payment_status": "pending",
        "invoice_number": invoice_number,
        "invoice_date": datetime.now(timezone.utc),
        "due_date": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc),
        "line_items": [
            {"description": booking.get("title", "Labor"), "quantity": data.hours_worked or 1, "unit_price": hourly_rate, "total": base_price}
        ]
    }

    if materials > 0:
        invoice["line_items"].append({
            "description": data.materials_description or "Materials & Supplies",
            "quantity": 1, "unit_price": materials, "total": materials
        })
    if additional > 0:
        invoice["line_items"].append({
            "description": data.additional_charges_description or "Additional charges",
            "quantity": 1, "unit_price": additional, "total": additional
        })

    await db.invoices.insert_one(invoice)
    invoice.pop("_id", None)

    # Save provider's review of client (if provided)
    if data.client_review_rating:
        review_id = f"rev_{uuid.uuid4().hex[:12]}"
        client_review = {
            "review_id": review_id,
            "reviewer_id": current_user.user_id,
            "reviewer_name": provider.get("name", "Tasker"),
            "reviewer_role": "provider",
            "reviewee_id": booking["client_id"],
            "reviewee_role": "client",
            "booking_id": data.booking_id,
            "rating": data.client_review_rating,
            "comment": data.client_review_comment or "",
            "created_at": datetime.now(timezone.utc)
        }
        await db.reviews.insert_one(client_review)

    # Update booking status to completed_pending_payment
    await db.bookings.update_one(
        {"booking_id": data.booking_id},
        {"$set": {"status": "completed_pending_payment", "invoice_id": invoice_id}}
    )

    # Notify client
    await create_notification(
        user_id=booking["client_id"],
        notification_type="payment_received",
        title="New invoice",
        message=f"Pro {provider.get('name', 'Pro')} created invoice #{invoice_number} for ${total:.2f}",
        related_id=invoice_id,
        related_type="invoice"
    )

    return invoice

@api_router.post("/provider/invoices/{invoice_id}/send")
async def send_invoice(
    invoice_id: str,
    current_user: User = Depends(get_current_user)
):
    """Send invoice to client (mark as sent)"""
    if current_user.role not in [UserRole.PROVIDER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only providers can send invoices")

    invoice = await db.invoices.find_one({"invoice_id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice["tasker_id"] != current_user.user_id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")

    await db.invoices.update_one(
        {"invoice_id": invoice_id},
        {"$set": {"sent_at": datetime.now(timezone.utc), "status": "sent"}}
    )

    return {"message": "Invoice sent successfully", "invoice_id": invoice_id}


# ─── CLIENT: Confirm invoice + pay + review ───────────────────────────────────

class InvoiceConfirm(BaseModel):
    payment_method: str = "card"   # card | stripe | zelle | venmo | cash
    tip_amount: Optional[float] = 0.0
    provider_review_rating: Optional[float] = None
    provider_review_comment: Optional[str] = None
    add_to_favorites: Optional[bool] = False
    task_comment: Optional[str] = None

@api_router.post("/client/invoices/{invoice_id}/confirm")
async def client_confirm_invoice(
    invoice_id: str,
    data: InvoiceConfirm,
    current_user: User = Depends(get_current_user)
):
    """Client confirms and pays invoice"""
    invoice = await db.invoices.find_one({"invoice_id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if invoice["client_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    if invoice.get("payment_status") == "paid":
        raise HTTPException(status_code=400, detail="Invoice already paid")

    tip = data.tip_amount or 0
    total_paid = round(invoice["total_amount"] + tip, 2)

    await db.invoices.update_one(
        {"invoice_id": invoice_id},
        {"$set": {
            "payment_status": "paid",
            "payment_method": data.payment_method,
            "tip_amount": tip,
            "total_paid": total_paid,
            "task_comment": data.task_comment,
            "paid_at": datetime.now(timezone.utc)
        }}
    )

    # Update booking status
    await db.bookings.update_one(
        {"booking_id": invoice["booking_id"]},
        {"$set": {"status": "paid", "payment_status": "paid"}}
    )

    # Save review of provider
    if data.provider_review_rating:
        review_id = f"rev_{uuid.uuid4().hex[:12]}"
        client = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0, "name": 1})
        await db.reviews.insert_one({
            "review_id": review_id,
            "reviewer_id": current_user.user_id,
            "reviewer_name": client.get("name", "Client"),
            "reviewer_role": "client",
            "provider_id": invoice["tasker_id"],
            "booking_id": invoice["booking_id"],
            "rating": data.provider_review_rating,
            "comment": data.provider_review_comment or "",
            "created_at": datetime.now(timezone.utc)
        })

    # Add to favorites
    if data.add_to_favorites:
        await db.users.update_one(
            {"user_id": current_user.user_id},
            {"$addToSet": {"favorite_providers": invoice["tasker_id"]}}
        )

    # Notify provider
    await create_notification(
        user_id=invoice["tasker_id"],
        notification_type="payment_received",
        title="Payment Received",
        message=f"Invoice #{invoice['invoice_number']} paid! ${total_paid:.2f}",
        related_id=invoice_id,
        related_type="invoice"
    )

    return {"message": "Invoice paid successfully", "total_paid": total_paid}


@api_router.get("/client/payment-stats")
async def client_payment_stats(current_user: User = Depends(get_current_user)):
    """Client payment statistics"""
    invoices = await db.invoices.find(
        {"client_id": current_user.user_id}, {"_id": 0}
    ).to_list(1000)

    total_paid = sum(i.get("total_amount", 0) for i in invoices if i.get("payment_status") == "paid")
    total_pending = sum(i.get("total_amount", 0) for i in invoices if i.get("payment_status") == "pending")
    paid_count = len([i for i in invoices if i.get("payment_status") == "paid"])
    pending_count = len([i for i in invoices if i.get("payment_status") == "pending"])

    return {
        "total_invoices": len(invoices),
        "paid_count": paid_count,
        "pending_count": pending_count,
        "total_paid": round(total_paid, 2),
        "total_pending": round(total_pending, 2),
        "invoices": invoices
    }


# ─── TASKER: Reschedule + Cancel with reason ─────────────────────────────────

class TaskReschedule(BaseModel):
    new_date: str
    new_time: str
    reason: Optional[str] = None

class TaskCancelByProvider(BaseModel):
    reason: str
    details: Optional[str] = None

@api_router.post("/tasks/{task_id}/reschedule")
async def reschedule_task(
    task_id: str,
    data: TaskReschedule,
    current_user: User = Depends(get_current_user)
):
    """Provider proposes a new time for a task"""
    task = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
    if not task and True:
        # Try bookings
        task = await db.bookings.find_one({"booking_id": task_id}, {"_id": 0})
        collection = "bookings"
        id_field = "booking_id"
    else:
        collection = "tasks"
        id_field = "task_id"

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    provider_id = task.get("provider_id") or task.get("tasker_id")
    if provider_id != current_user.user_id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")

    await getattr(db, collection).update_one(
        {id_field: task_id},
        {"$set": {
            "reschedule_requested": True,
            "proposed_date": data.new_date,
            "proposed_time": data.new_time,
            "reschedule_reason": data.reason,
            "updated_at": datetime.now(timezone.utc)
        }}
    )

    # Notify client
    client_id = task.get("client_id") or task.get("user_id")
    if client_id:
        provider = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0, "name": 1})
        await create_notification(
            user_id=client_id,
            notification_type="task_updated",
            title="Reschedule Requested",
            message=f"{provider.get('name','Tasker')} wants to reschedule to {data.new_date} at {data.new_time}",
            related_id=task_id,
            related_type=collection[:-1]
        )

    return {"message": "Reschedule proposed", "proposed_date": data.new_date, "proposed_time": data.new_time}


@api_router.post("/tasks/{task_id}/cancel-by-provider")
async def cancel_task_by_provider(
    task_id: str,
    data: TaskCancelByProvider,
    current_user: User = Depends(get_current_user)
):
    """Provider cancels a task with a reason"""
    if current_user.role not in [UserRole.PROVIDER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only providers can cancel tasks")

    # Try tasks first, then bookings
    task = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
    if task:
        collection, id_field = "tasks", "task_id"
    else:
        task = await db.bookings.find_one({"booking_id": task_id}, {"_id": 0})
        collection, id_field = "bookings", "booking_id"

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    provider_id = task.get("provider_id") or task.get("tasker_id")
    if provider_id != current_user.user_id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")

    await getattr(db, collection).update_one(
        {id_field: task_id},
        {"$set": {
            "status": "cancelled_by_tasker",
            "cancellation_reason": data.reason,
            "cancellation_details": data.details,
            "cancelled_at": datetime.now(timezone.utc),
            "cancelled_by": current_user.user_id
        }}
    )

    client_id = task.get("client_id") or task.get("user_id")
    if client_id:
        provider = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0, "name": 1})
        await create_notification(
            user_id=client_id,
            notification_type="task_cancelled",
            title="Task Cancelled",
            message=f"{provider.get('name','Tasker')} cancelled the task. Reason: {data.reason}",
            related_id=task_id,
            related_type=collection[:-1]
        )

    return {"message": "Task cancelled", "reason": data.reason}


# ─── ADMIN: Force charge + extended block + give promo ───────────────────────

class AdminBlockUser(BaseModel):
    reason: str
    duration_hours: Optional[int] = None   # None = permanent
    details: Optional[str] = None

class AdminGivePromo(BaseModel):
    user_id: str
    discount_type: str = "percent"   # percent | fixed
    discount_value: float
    expires_days: int = 30
    note: Optional[str] = None

@api_router.post("/admin/invoices/{invoice_id}/force-charge")
async def admin_force_charge(
    invoice_id: str,
    current_user: User = Depends(require_admin)
):
    """Admin forces payment charge when client hasn't confirmed"""
    invoice = await db.invoices.find_one({"invoice_id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if invoice.get("payment_status") == "paid":
        raise HTTPException(status_code=400, detail="Already paid")

    # Check if client has a saved payment method
    client = await db.users.find_one({"user_id": invoice["client_id"]}, {"_id": 0})
    payment_methods = client.get("payment_methods") or []
    has_card = any(pm.get("type") in ["card", "stripe"] for pm in payment_methods)

    if not has_card:
        # Mark as pending_admin_charge — needs manual processing
        await db.invoices.update_one(
            {"invoice_id": invoice_id},
            {"$set": {
                "payment_status": "pending_admin_charge",
                "admin_charge_attempted_at": datetime.now(timezone.utc),
                "admin_charge_note": "No card on file — manual follow-up required"
            }}
        )
        return {"message": "No payment method on file — marked for follow-up", "status": "pending_admin_charge"}

    # Simulate charge (real Stripe charge would go here)
    await db.invoices.update_one(
        {"invoice_id": invoice_id},
        {"$set": {
            "payment_status": "paid",
            "payment_method": "admin_forced",
            "paid_at": datetime.now(timezone.utc),
            "charged_by_admin": current_user.user_id
        }}
    )
    await db.bookings.update_one(
        {"booking_id": invoice["booking_id"]},
        {"$set": {"status": "paid", "payment_status": "paid"}}
    )

    # Notify client
    await create_notification(
        user_id=invoice["client_id"],
        notification_type="payment_received",
        title="Payment Processed",
        message=f"Admin charged your card for invoice #{invoice.get('invoice_number')} — ${invoice['total_amount']:.2f}",
        related_id=invoice_id,
        related_type="invoice"
    )

    return {"message": "Payment charged successfully", "total_amount": invoice["total_amount"]}


@api_router.post("/admin/users/{user_id}/block-extended")
async def block_user_extended(
    user_id: str,
    data: AdminBlockUser,
    current_user: User = Depends(require_admin)
):
    """Admin blocks user — permanently or for a duration"""
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    blocked_until = None
    if data.duration_hours:
        blocked_until = datetime.now(timezone.utc) + timedelta(hours=data.duration_hours)

    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "is_blocked": True,
            "blocked_reason": data.reason,
            "blocked_details": data.details,
            "blocked_by": current_user.user_id,
            "blocked_at": datetime.now(timezone.utc),
            "blocked_until": blocked_until
        }}
    )

    duration_str = f"for {data.duration_hours}h" if data.duration_hours else "permanently"
    await create_notification(
        user_id=user_id,
        notification_type="account_blocked",
        title="Account Blocked",
        message=f"Your account has been blocked {duration_str}. Reason: {data.reason}",
        related_id=user_id,
        related_type="user"
    )

    return {
        "message": f"User blocked {duration_str}",
        "user_id": user_id,
        "blocked_until": blocked_until.isoformat() if blocked_until else "permanent"
    }


@api_router.post("/admin/users/{user_id}/give-promo")
async def admin_give_promo(
    user_id: str,
    data: AdminGivePromo,
    current_user: User = Depends(require_admin)
):
    """Admin gives a personal promo code to a user"""
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "name": 1, "email": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    code = f"GIFT{uuid.uuid4().hex[:8].upper()}"
    code_id = f"promo_{uuid.uuid4().hex[:12]}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=data.expires_days)

    promo = {
        "code_id": code_id,
        "code": code,
        "discount_type": data.discount_type,
        "discount_value": data.discount_value,
        "max_uses": 1,
        "current_uses": 0,
        "is_active": True,
        "assigned_user_id": user_id,
        "expires_at": expires_at,
        "note": data.note,
        "created_by": current_user.user_id,
        "created_at": datetime.now(timezone.utc)
    }
    await db.promo_codes.insert_one(promo)

    discount_str = f"{data.discount_value}%" if data.discount_type == "percent" else f"${data.discount_value}"
    await create_notification(
        user_id=user_id,
        notification_type="promo_received",
        title="🎁 You got a promo!",
        message=f"Admin gave you a {discount_str} discount code: {code}. Valid for {data.expires_days} days.",
        related_id=code_id,
        related_type="promo"
    )

    return {"message": "Promo sent", "code": code, "discount": discount_str, "expires_at": expires_at.isoformat()}


@api_router.get("/admin/invoices/pending")
async def get_pending_invoices(current_user: User = Depends(require_admin)):
    """Get all invoices pending client confirmation"""
    invoices = await db.invoices.find(
        {"payment_status": {"$in": ["pending", "pending_admin_charge"]}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    return invoices


# ==================== PHOTO STORAGE SYSTEM ====================
# Photos saved as: {storage_path}/{task_id}/{YYYY-MM-DD}/{uuid}.jpg
# MongoDB collection: task_photos — stores metadata + base64 for quick access
# Disk: actual files for archiving/download

import base64 as b64mod
import zipfile as zipmod
import io

def _photo_disk_path(storage_path: str, task_id: str, photo_id: str, created_at: datetime) -> Path:
    date_str = created_at.strftime("%Y-%m-%d")
    folder = Path(storage_path) / task_id / date_str
    folder.mkdir(parents=True, exist_ok=True)
    return folder / f"{photo_id}.jpg"

async def _save_photo_to_disk(storage_path: str, task_id: str, photo_id: str,
                               created_at: datetime, base64_data: str) -> str:
    """Save base64 photo to disk, return relative path."""
    try:
        # Strip data URI prefix if present
        if "," in base64_data:
            base64_data = base64_data.split(",", 1)[1]
        raw = b64mod.b64decode(base64_data)
        path = _photo_disk_path(storage_path, task_id, photo_id, created_at)
        path.write_bytes(raw)
        return str(path)
    except Exception as e:
        logging.warning(f"Could not save photo to disk: {e}")
        return ""


class PhotoUpload(BaseModel):
    task_id: str
    photos: List[str]          # list of base64 strings
    uploader_role: str = "provider"   # provider | client
    description: Optional[str] = None

class PhotoCleanupRequest(BaseModel):
    older_than_days: Optional[int] = None   # override settings value
    action: Optional[str] = None            # override: delete | archive
    dry_run: bool = False                   # just count, don't act


@api_router.post("/tasks/{task_id}/photos")
async def upload_task_photos(
    task_id: str,
    data: PhotoUpload,
    current_user: User = Depends(get_current_user)
):
    """Upload work-proof photos for a task (provider or client)."""
    settings = await get_settings()
    storage_path = settings.photo_storage_path
    max_mb = settings.photo_max_size_mb or 5.0

    # Verify task exists (bookings or tasks)
    task = await db.bookings.find_one({"booking_id": task_id}, {"_id": 0}) \
        or await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    saved = []
    now = datetime.now(timezone.utc)

    for b64 in data.photos:
        # Size check
        raw_size = len(b64) * 3 / 4 / (1024 * 1024)
        if raw_size > max_mb:
            continue  # skip oversized

        photo_id = f"ph_{uuid.uuid4().hex[:16]}"
        disk_path = await _save_photo_to_disk(storage_path, task_id, photo_id, now, b64)

        doc = {
            "photo_id": photo_id,
            "task_id": task_id,
            "uploader_id": current_user.user_id,
            "uploader_role": data.uploader_role,
            "uploader_name": current_user.name if hasattr(current_user, 'name') else "",
            "description": data.description,
            "base64_data": b64,          # stored for quick preview
            "disk_path": disk_path,
            "size_kb": round(raw_size * 1024, 1),
            "created_at": now,
            "date_folder": now.strftime("%Y-%m-%d"),
        }
        await db.task_photos.insert_one(doc)
        doc.pop("_id", None)
        doc.pop("base64_data", None)   # don't return raw data in list
        saved.append({"photo_id": photo_id, "disk_path": disk_path, "size_kb": doc["size_kb"]})

    # Also attach photo_ids to the task/booking record
    await db.bookings.update_one(
        {"booking_id": task_id},
        {"$push": {"completion_photo_ids": {"$each": [s["photo_id"] for s in saved]}}}
    )

    return {"uploaded": len(saved), "photos": saved, "task_id": task_id}


@api_router.get("/tasks/{task_id}/photos")
async def get_task_photos(
    task_id: str,
    include_data: bool = False,
    current_user: User = Depends(get_current_user)
):
    """Get all photos for a task. include_data=true returns base64."""
    projection = {"_id": 0}
    if not include_data:
        projection["base64_data"] = 0

    photos = await db.task_photos.find(
        {"task_id": task_id}, projection
    ).sort("created_at", 1).to_list(200)
    return {"task_id": task_id, "count": len(photos), "photos": photos}


@api_router.delete("/tasks/{task_id}/photos/{photo_id}")
async def delete_task_photo(
    task_id: str,
    photo_id: str,
    current_user: User = Depends(require_admin)
):
    """Admin deletes a specific photo."""
    photo = await db.task_photos.find_one({"photo_id": photo_id, "task_id": task_id}, {"_id": 0})
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    # Remove from disk
    if photo.get("disk_path"):
        try:
            Path(photo["disk_path"]).unlink(missing_ok=True)
        except Exception:
            pass

    await db.task_photos.delete_one({"photo_id": photo_id})
    return {"message": "Photo deleted", "photo_id": photo_id}


# ─── Admin: Browse all photos ─────────────────────────────────────────────────

@api_router.get("/admin/photos")
async def admin_list_photos(
    task_id: Optional[str] = None,
    uploader_role: Optional[str] = None,
    date_from: Optional[str] = None,   # YYYY-MM-DD
    date_to: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
    current_user: User = Depends(require_admin)
):
    """Admin: paginated list of all task photos with filters."""
    query: dict = {}
    if task_id:
        query["task_id"] = task_id
    if uploader_role:
        query["uploader_role"] = uploader_role
    if date_from or date_to:
        dt_filter = {}
        if date_from:
            dt_filter["$gte"] = datetime.fromisoformat(date_from).replace(tzinfo=timezone.utc)
        if date_to:
            dt_filter["$lte"] = datetime.fromisoformat(date_to).replace(tzinfo=timezone.utc)
        query["created_at"] = dt_filter

    total = await db.task_photos.count_documents(query)
    skip = (page - 1) * page_size
    photos = await db.task_photos.find(
        query, {"_id": 0, "base64_data": 0}
    ).sort("created_at", -1).skip(skip).limit(page_size).to_list(page_size)

    # Group by task_id for UI convenience
    grouped: dict = {}
    for p in photos:
        tid = p["task_id"]
        grouped.setdefault(tid, []).append(p)

    # Total storage estimate
    total_kb = await db.task_photos.aggregate([
        {"$match": query},
        {"$group": {"_id": None, "total_kb": {"$sum": "$size_kb"}}}
    ]).to_list(1)
    total_mb = round((total_kb[0]["total_kb"] if total_kb else 0) / 1024, 2)

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, (total + page_size - 1) // page_size),
        "total_mb": total_mb,
        "grouped_by_task": grouped,
        "photos": photos
    }


@api_router.get("/admin/photos/{photo_id}/data")
async def admin_get_photo_data(
    photo_id: str,
    current_user: User = Depends(require_admin)
):
    """Admin: get full base64 data for a photo."""
    photo = await db.task_photos.find_one({"photo_id": photo_id}, {"_id": 0})
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    return photo


@api_router.get("/admin/photos/download/archive")
async def admin_download_photo_archive(
    task_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: User = Depends(require_admin)
):
    """Admin: download ZIP archive of photos matching filter."""
    from fastapi.responses import StreamingResponse

    query: dict = {}
    if task_id:
        query["task_id"] = task_id
    if date_from or date_to:
        dt_filter = {}
        if date_from:
            dt_filter["$gte"] = datetime.fromisoformat(date_from).replace(tzinfo=timezone.utc)
        if date_to:
            dt_filter["$lte"] = datetime.fromisoformat(date_to).replace(tzinfo=timezone.utc)
        query["created_at"] = dt_filter

    photos = await db.task_photos.find(query, {"_id": 0}).to_list(1000)
    if not photos:
        raise HTTPException(status_code=404, detail="No photos found for this filter")

    buf = io.BytesIO()
    with zipmod.ZipFile(buf, "w", zipmod.ZIP_DEFLATED) as zf:
        for p in photos:
            b64_data = p.get("base64_data", "")
            if not b64_data:
                # Try reading from disk
                disk = p.get("disk_path", "")
                if disk and Path(disk).exists():
                    raw = Path(disk).read_bytes()
                else:
                    continue
            else:
                if "," in b64_data:
                    b64_data = b64_data.split(",", 1)[1]
                try:
                    raw = b64mod.b64decode(b64_data)
                except Exception:
                    continue
            date_str = p.get("date_folder", "unknown")
            fname = f"{p['task_id']}/{date_str}/{p['photo_id']}.jpg"
            zf.writestr(fname, raw)

    buf.seek(0)
    filename = f"photos_{task_id or 'all'}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@api_router.delete("/admin/photos/bulk")
async def admin_bulk_delete_photos(
    task_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: User = Depends(require_admin)
):
    """Admin: bulk delete photos by filter."""
    query: dict = {}
    if task_id:
        query["task_id"] = task_id
    if date_from or date_to:
        dt_filter = {}
        if date_from:
            dt_filter["$gte"] = datetime.fromisoformat(date_from).replace(tzinfo=timezone.utc)
        if date_to:
            dt_filter["$lte"] = datetime.fromisoformat(date_to).replace(tzinfo=timezone.utc)
        query["created_at"] = dt_filter

    photos = await db.task_photos.find(query, {"_id": 0, "disk_path": 1, "photo_id": 1}).to_list(10000)
    deleted_disk = 0
    for p in photos:
        if p.get("disk_path"):
            try:
                Path(p["disk_path"]).unlink(missing_ok=True)
                deleted_disk += 1
            except Exception:
                pass

    result = await db.task_photos.delete_many(query)
    return {
        "deleted_db": result.deleted_count,
        "deleted_disk": deleted_disk,
        "message": f"Deleted {result.deleted_count} photos from DB, {deleted_disk} from disk"
    }


# ─── Auto-cleanup: run on startup + can be triggered manually ─────────────────

async def run_photo_cleanup(dry_run: bool = False) -> dict:
    """Core cleanup logic: archive or delete photos older than retention period."""
    settings = await get_settings()

    if not settings.photo_auto_cleanup_enabled and not dry_run:
        return {"skipped": True, "reason": "Auto cleanup disabled"}

    retention_days = settings.photo_retention_days or 180
    cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
    action = settings.photo_cleanup_action or "delete"
    archive_path = settings.photo_archive_path or "./task_photos_archive"

    query = {"created_at": {"$lt": cutoff}}
    photos = await db.task_photos.find(query, {"_id": 0}).to_list(100000)

    result = {
        "dry_run": dry_run,
        "retention_days": retention_days,
        "cutoff_date": cutoff.isoformat(),
        "action": action,
        "photos_found": len(photos),
        "processed": 0,
        "errors": 0
    }

    if dry_run:
        total_kb = sum(p.get("size_kb", 0) for p in photos)
        result["total_mb_to_clean"] = round(total_kb / 1024, 2)
        return result

    if action == "archive":
        # Group into one ZIP per task+date
        groups: dict = {}
        for p in photos:
            key = f"{p['task_id']}_{p.get('date_folder','unknown')}"
            groups.setdefault(key, []).append(p)

        arch_root = Path(archive_path)
        arch_root.mkdir(parents=True, exist_ok=True)

        for key, group_photos in groups.items():
            zip_path = arch_root / f"{key}_{datetime.now().strftime('%Y%m%d')}.zip"
            try:
                with zipmod.ZipFile(zip_path, "w", zipmod.ZIP_DEFLATED) as zf:
                    for p in group_photos:
                        b64_data = p.get("base64_data", "")
                        if not b64_data and p.get("disk_path") and Path(p["disk_path"]).exists():
                            raw = Path(p["disk_path"]).read_bytes()
                        elif b64_data:
                            if "," in b64_data:
                                b64_data = b64_data.split(",", 1)[1]
                            try:
                                raw = b64mod.b64decode(b64_data)
                            except Exception:
                                result["errors"] += 1
                                continue
                        else:
                            result["errors"] += 1
                            continue
                        zf.writestr(f"{p['photo_id']}.jpg", raw)
                result["processed"] += len(group_photos)
            except Exception as e:
                logging.error(f"Archive error for {key}: {e}")
                result["errors"] += len(group_photos)

    # Delete from disk and DB regardless of archive action
    for p in photos:
        if p.get("disk_path"):
            try:
                Path(p["disk_path"]).unlink(missing_ok=True)
            except Exception:
                pass

    del_result = await db.task_photos.delete_many(query)
    result["deleted_from_db"] = del_result.deleted_count
    if action == "delete":
        result["processed"] = del_result.deleted_count

    # Update last run timestamp
    await db.settings.update_one(
        {"setting_id": "app_settings"},
        {"$set": {"photo_cleanup_last_run": datetime.now(timezone.utc)}},
        upsert=True
    )

    logging.info(f"Photo cleanup done: {result}")
    return result


@api_router.post("/admin/photos/cleanup")
async def admin_trigger_cleanup(
    data: PhotoCleanupRequest,
    current_user: User = Depends(require_admin)
):
    """Admin manually triggers photo cleanup."""
    # Allow per-request overrides
    settings = await get_settings()
    if data.older_than_days:
        settings.photo_retention_days = data.older_than_days
    if data.action:
        settings.photo_cleanup_action = data.action
    # Temporarily force enable for this run
    settings.photo_auto_cleanup_enabled = True

    result = await run_photo_cleanup(dry_run=data.dry_run)
    return result


@api_router.get("/admin/photos/storage-stats")
async def admin_photo_storage_stats(current_user: User = Depends(require_admin)):
    """Admin: storage usage statistics."""
    settings = await get_settings()

    pipeline = [
        {"$group": {
            "_id": None,
            "total_photos": {"$sum": 1},
            "total_kb": {"$sum": "$size_kb"},
            "by_role": {"$push": "$uploader_role"},
        }},
    ]
    agg = await db.task_photos.aggregate(pipeline).to_list(1)
    stats = agg[0] if agg else {"total_photos": 0, "total_kb": 0}

    # Count by role
    role_counts = {}
    for r in stats.get("by_role", []):
        role_counts[r] = role_counts.get(r, 0) + 1

    # Count old photos
    retention_days = settings.photo_retention_days or 180
    cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
    old_count = await db.task_photos.count_documents({"created_at": {"$lt": cutoff}})
    old_kb_agg = await db.task_photos.aggregate([
        {"$match": {"created_at": {"$lt": cutoff}}},
        {"$group": {"_id": None, "kb": {"$sum": "$size_kb"}}}
    ]).to_list(1)
    old_mb = round((old_kb_agg[0]["kb"] if old_kb_agg else 0) / 1024, 2)

    # Photos per task (top 10)
    by_task = await db.task_photos.aggregate([
        {"$group": {"_id": "$task_id", "count": {"$sum": 1}, "kb": {"$sum": "$size_kb"}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]).to_list(10)

    return JSONResponse(content=clean_bson({
        "total_photos": stats.get("total_photos", 0),
        "total_mb": round(stats.get("total_kb", 0) / 1024, 2),
        "by_uploader_role": role_counts,
        "old_photos_count": old_count,
        "old_photos_mb": old_mb,
        "retention_days": retention_days,
        "auto_cleanup_enabled": settings.photo_auto_cleanup_enabled,
        "cleanup_action": settings.photo_cleanup_action,
        "last_cleanup": settings.photo_cleanup_last_run,
        "top_tasks_by_photos": by_task,
        "storage_path": settings.photo_storage_path,
    }))


# ─── Background auto-cleanup task (runs hourly, acts on schedule) ─────────────

async def _auto_cleanup_loop():
    """Background loop: checks daily if cleanup should run."""
    await asyncio.sleep(30)   # wait for app startup
    while True:
        try:
            settings = await get_settings()
            if settings.photo_auto_cleanup_enabled:
                last = settings.photo_cleanup_last_run
                # Run once per day
                if last is None or (datetime.now(timezone.utc) - last).total_seconds() > 86400:
                    logging.info("Running scheduled photo cleanup...")
                    result = await run_photo_cleanup(dry_run=False)
                    logging.info(f"Scheduled cleanup result: {result}")
        except Exception as e:
            logging.error(f"Auto cleanup error: {e}")
        await asyncio.sleep(3600)   # check every hour


# ==================== SERVICE ZONES / GEOFENCING ====================

@api_router.get("/admin/service-zones")
async def get_service_zones(current_user: User = Depends(require_admin)):
    """Get all service zones"""
    zones = await db.service_zones.find({}, {"_id": 0}).to_list(100)
    return zones

@api_router.get("/service-zones/active")
async def get_active_service_zones():
    """Get active service zones (public)"""
    zones = await db.service_zones.find(
        {"is_active": True},
        {"_id": 0}
    ).to_list(100)
    return zones

@api_router.post("/admin/service-zones")
async def create_service_zone(
    data: ServiceZoneCreate,
    current_user: User = Depends(require_admin)
):
    """Create new service zone"""
    zone_id = f"zone_{uuid.uuid4().hex[:12]}"

    zone = {
        "zone_id": zone_id,
        "name": data.name,
        "description": data.description,
        "coordinates": data.coordinates,
        "center_lat": data.center_lat,
        "center_lng": data.center_lng,
        "is_active": True,
        "service_fee_multiplier": data.service_fee_multiplier,
        "min_order_amount": data.min_order_amount,
        "max_distance_km": data.max_distance_km,
        "active_taskers": 0,
        "color": data.color,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }

    await db.service_zones.insert_one(zone)
    zone.pop("_id", None)

    return zone

@api_router.put("/admin/service-zones/{zone_id}")
async def update_service_zone(
    zone_id: str,
    data: ServiceZoneUpdate,
    current_user: User = Depends(require_admin)
):
    """Update service zone"""
    zone = await db.service_zones.find_one({"zone_id": zone_id})
    if not zone:
        raise HTTPException(status_code=404, detail="Service zone not found")

    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)

    await db.service_zones.update_one(
        {"zone_id": zone_id},
        {"$set": update_data}
    )

    updated = await db.service_zones.find_one({"zone_id": zone_id}, {"_id": 0})
    return updated

@api_router.delete("/admin/service-zones/{zone_id}")
async def delete_service_zone(
    zone_id: str,
    current_user: User = Depends(require_admin)
):
    """Delete service zone"""
    result = await db.service_zones.delete_one({"zone_id": zone_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Service zone not found")

    return {"message": "Service zone deleted"}

@api_router.get("/admin/service-zones/{zone_id}/taskers")
async def get_zone_taskers(
    zone_id: str,
    current_user: User = Depends(require_admin)
):
    """Get taskers in a service zone"""
    zone = await db.service_zones.find_one({"zone_id": zone_id}, {"_id": 0})
    if not zone:
        raise HTTPException(status_code=404, detail="Service zone not found")

    # Get taskers who work in this zone
    taskers = await db.executor_profiles.find(
        {"service_zones": zone_id},
        {"_id": 0}
    ).to_list(100)

    # Enrich with user info
    for tasker in taskers:
        user = await db.users.find_one(
            {"user_id": tasker["user_id"]},
            {"_id": 0, "password_hash": 0, "plain_password": 0}
        )
        tasker["user"] = user

    return taskers

@api_router.post("/provider/service-zones/join")
async def join_service_zone(
    zone_id: str,
    current_user: User = Depends(get_current_user)
):
    """Provider joins a service zone"""
    if current_user.role not in [UserRole.PROVIDER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only providers can join zones")

    zone = await db.service_zones.find_one({"zone_id": zone_id})
    if not zone:
        raise HTTPException(status_code=404, detail="Service zone not found")

    if not zone.get("is_active"):
        raise HTTPException(status_code=400, detail="This zone is not active")

    # Add zone to provider's profile
    await db.executor_profiles.update_one(
        {"user_id": current_user.user_id},
        {"$addToSet": {"service_zones": zone_id}},
        upsert=True
    )

    # Increment active taskers count
    await db.service_zones.update_one(
        {"zone_id": zone_id},
        {"$inc": {"active_taskers": 1}}
    )

    return {"message": f"Joined zone: {zone['name']}"}

@api_router.post("/provider/service-zones/leave")
async def leave_service_zone(
    zone_id: str,
    current_user: User = Depends(get_current_user)
):
    """Provider leaves a service zone"""
    if current_user.role not in [UserRole.PROVIDER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only providers can leave zones")

    # Remove zone from provider's profile
    result = await db.executor_profiles.update_one(
        {"user_id": current_user.user_id},
        {"$pull": {"service_zones": zone_id}}
    )

    if result.modified_count > 0:
        # Decrement active taskers count
        await db.service_zones.update_one(
            {"zone_id": zone_id},
            {"$inc": {"active_taskers": -1}}
        )

    return {"message": "Left zone successfully"}

# ==================== JOB STATUS HISTORY ====================

async def log_status_change(
    job_id: str,
    job_type: str,
    old_status: Optional[str],
    new_status: str,
    changed_by: str,
    reason: Optional[str] = None,
    metadata: Dict[str, Any] = {}
):
    """Log job status change for audit trail"""
    history = {
        "history_id": f"hist_{uuid.uuid4().hex[:12]}",
        "job_id": job_id,
        "job_type": job_type,
        "old_status": old_status,
        "new_status": new_status,
        "changed_by": changed_by,
        "change_reason": reason,
        "metadata": metadata,
        "created_at": datetime.now(timezone.utc)
    }
    await db.job_status_history.insert_one(history)

@api_router.get("/admin/job-history/{job_id}")
async def get_job_history(
    job_id: str,
    current_user: User = Depends(require_admin)
):
    """Get status history for a job"""
    history = await db.job_status_history.find(
        {"job_id": job_id},
        {"_id": 0}
    ).sort("created_at", 1).to_list(100)

    # Add user info for each change
    for item in history:
        user = await db.users.find_one({"user_id": item["changed_by"]}, {"_id": 0, "password_hash": 0, "plain_password": 0})
        item["changed_by_user"] = user

    return history

# ==================== CMS ENDPOINTS ====================

@api_router.get("/cms/content")
async def get_cms_content(
    content_type: Optional[str] = None,
    category: Optional[str] = None,
    is_published: bool = True,
    language: str = "en",
    limit: int = 50
):
    """Get CMS content (public)"""
    query = {}
    if content_type:
        query["content_type"] = content_type
    if category:
        query["category"] = category
    if is_published:
        query["is_published"] = True

    content = await db.cms_content.find(query, {"_id": 0}).sort("sort_order", 1).to_list(limit)

    # Return localized content based on language
    if language == "uk":
        for item in content:
            if item.get("title_uk"):
                item["title"] = item["title_uk"]
            if item.get("content_uk"):
                item["content"] = item["content_uk"]

    return content

@api_router.get("/cms/content/{slug}")
async def get_cms_content_by_slug(slug: str, language: str = "en"):
    """Get single content by slug (public)"""
    content = await db.cms_content.find_one({"slug": slug, "is_published": True}, {"_id": 0})
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    # Increment view count
    await db.cms_content.update_one(
        {"slug": slug},
        {"$inc": {"view_count": 1}}
    )

    # Localize
    if language == "uk":
        if content.get("title_uk"):
            content["title"] = content["title_uk"]
        if content.get("content_uk"):
            content["content"] = content["content_uk"]

    return content

@api_router.post("/admin/cms/content")
async def create_cms_content(
    data: CMSContentCreate,
    current_user: User = Depends(require_admin)
):
    """Admin creates CMS content"""
    # Check slug uniqueness
    existing = await db.cms_content.find_one({"slug": data.slug})
    if existing:
        raise HTTPException(status_code=400, detail="Slug already exists")

    content_id = f"cms_{uuid.uuid4().hex[:12]}"

    content = {
        "content_id": content_id,
        **data.dict(),
        "author_id": current_user.user_id,
        "view_count": 0,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }

    if data.is_published:
        content["published_at"] = datetime.now(timezone.utc)

    await db.cms_content.insert_one(content)
    content.pop("_id", None)

    return content

@api_router.get("/admin/cms/content")
async def admin_get_all_cms_content(
    content_type: Optional[str] = None,
    current_user: User = Depends(require_admin)
):
    """Admin gets all CMS content including drafts"""
    query = {}
    if content_type:
        query["content_type"] = content_type

    content = await db.cms_content.find(query, {"_id": 0}).sort("updated_at", -1).to_list(200)
    return content

@api_router.put("/admin/cms/content/{content_id}")
async def update_cms_content(
    content_id: str,
    data: CMSContentUpdate,
    current_user: User = Depends(require_admin)
):
    """Admin updates CMS content"""
    update_dict = data.dict(exclude_unset=True)
    update_dict["updated_at"] = datetime.now(timezone.utc)

    # Set published_at if publishing
    if data.is_published:
        existing = await db.cms_content.find_one({"content_id": content_id}, {"_id": 0})
        if existing and not existing.get("published_at"):
            update_dict["published_at"] = datetime.now(timezone.utc)

    result = await db.cms_content.update_one(
        {"content_id": content_id},
        {"$set": update_dict}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Content not found")

    updated = await db.cms_content.find_one({"content_id": content_id}, {"_id": 0})
    return updated

@api_router.delete("/admin/cms/content/{content_id}")
async def delete_cms_content(
    content_id: str,
    current_user: User = Depends(require_admin)
):
    """Admin deletes CMS content"""
    result = await db.cms_content.delete_one({"content_id": content_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Content not found")
    return {"message": "Content deleted"}

# ==================== FAQ ENDPOINTS ====================

@api_router.get("/faq")
async def get_faqs(
    category: Optional[str] = None,
    language: str = "en"
):
    """Get published FAQs (public)"""
    query = {"is_published": True}
    if category:
        query["category"] = category

    faqs = await db.faqs.find(query, {"_id": 0}).sort("sort_order", 1).to_list(100)

    # Localize
    if language == "uk":
        for faq in faqs:
            if faq.get("question_uk"):
                faq["question"] = faq["question_uk"]
            if faq.get("answer_uk"):
                faq["answer"] = faq["answer_uk"]

    return faqs

@api_router.post("/admin/faq")
async def create_faq(
    data: FAQCreate,
    current_user: User = Depends(require_admin)
):
    """Admin creates FAQ"""
    faq_id = f"faq_{uuid.uuid4().hex[:12]}"

    faq = {
        "faq_id": faq_id,
        **data.dict(),
        "created_at": datetime.now(timezone.utc)
    }

    await db.faqs.insert_one(faq)
    faq.pop("_id", None)

    return faq

@api_router.get("/admin/faq")
async def admin_get_faqs(current_user: User = Depends(require_admin)):
    """Admin gets all FAQs"""
    faqs = await db.faqs.find({}, {"_id": 0}).sort("sort_order", 1).to_list(200)
    return faqs

@api_router.put("/admin/faq/{faq_id}")
async def update_faq(
    faq_id: str,
    data: FAQCreate,
    current_user: User = Depends(require_admin)
):
    """Admin updates FAQ"""
    update_dict = data.dict()

    result = await db.faqs.update_one(
        {"faq_id": faq_id},
        {"$set": update_dict}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="FAQ not found")

    updated = await db.faqs.find_one({"faq_id": faq_id}, {"_id": 0})
    return updated

@api_router.delete("/admin/faq/{faq_id}")
async def delete_faq(
    faq_id: str,
    current_user: User = Depends(require_admin)
):
    """Admin deletes FAQ"""
    result = await db.faqs.delete_one({"faq_id": faq_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="FAQ not found")
    return {"message": "FAQ deleted"}

# ── Self-service account management ──────────────────────────────────────────

@api_router.delete("/users/me")
async def delete_my_account(current_user: User = Depends(get_current_user)):
    """User deletes their own account"""
    user_id = current_user.user_id
    await db.users.delete_one({"user_id": user_id})
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.bookings.delete_many({"$or": [{"client_id": user_id}, {"provider_id": user_id}]})
    await db.tasks.delete_many({"provider_id": user_id})
    await db.reviews.delete_many({"$or": [{"client_id": user_id}, {"provider_id": user_id}]})
    await db.executor_profiles.delete_one({"user_id": user_id})
    return {"message": "Account deleted"}


class SupportMessage(BaseModel):
    email: str
    message: str


@api_router.post("/support/message")
async def send_support_message(data: SupportMessage):
    """Store support message"""
    await db.support_messages.insert_one({
        "email": data.email,
        "message": data.message,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"ok": True}


# ---------------------------------------------------------------------------
# AI: identify a service from a photo (public — works for guests)
# ---------------------------------------------------------------------------
class AnalyzePhotoRequest(BaseModel):
    image_base64: str
    city: Optional[str] = None


@api_router.post("/ai/analyze-task-photo")
async def analyze_task_photo(req: AnalyzePhotoRequest):
    """Use GPT-4o vision to detect the likely home service, estimated hours and price from a photo."""
    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        raise HTTPException(status_code=503, detail="AI photo analysis is not configured")

    img = (req.image_base64 or "").strip()
    if not img:
        raise HTTPException(status_code=400, detail="image_base64 is required")
    if img.startswith("data:") and "," in img:
        img = img.split(",", 1)[1]

    cats = await db.categories.find({"is_active": True}).to_list(100)
    if not cats:
        cats = await db.categories.find({}).to_list(100)
    cat_lines = "\n".join(f'- {c.get("category_id")}: {c.get("name")}' for c in cats)
    valid_ids = [c.get("category_id") for c in cats]

    system_message = (
        "You are a dispatcher for HandyHub, a US home-services marketplace. "
        "Given a photo from a client, identify which single service category best fits the work shown, "
        "suggest a concrete service/skill, estimate how many hours the job typically takes for a pro, "
        "and write one short client-facing task description. "
        "Use ONLY these category ids:\n" + cat_lines + "\n\n"
        "Respond with STRICT JSON only (no markdown, no prose), with exactly these keys: "
        '{"category_id": string (one of the ids above), "category_name": string, '
        '"skill": string (short, e.g. "Faucet repair"), "confidence": number (0-1), '
        '"estimated_hours_min": number, "estimated_hours_max": number, '
        '"summary": string (one sentence describing the task)}. '
        "If the photo is unclear or unrelated to home services, use category_id \"other\" with a low confidence."
    )

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        chat = LlmChat(
            api_key=key,
            session_id=f"vision-{uuid.uuid4().hex[:12]}",
            system_message=system_message,
        ).with_model("openai", "gpt-4o")
        message = UserMessage(
            text="Analyze this photo and return the JSON described in the system message.",
            file_contents=[ImageContent(image_base64=img)],
        )
        raw = await chat.send_message(message)
    except Exception as e:
        logging.error(f"[AI] analyze-task-photo failed: {e}")
        raise HTTPException(status_code=502, detail="AI analysis failed. Please try again.")

    text = raw if isinstance(raw, str) else str(raw)
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if not m:
        raise HTTPException(status_code=502, detail="Could not interpret the AI response")
    try:
        parsed = json.loads(m.group(0))
    except Exception:
        raise HTTPException(status_code=502, detail="Could not parse the AI response")

    category_id = parsed.get("category_id")
    if category_id not in valid_ids:
        category_id = "other" if "other" in valid_ids else (valid_ids[0] if valid_ids else "other")
    cat = next((c for c in cats if c.get("category_id") == category_id), None)
    category_name = (cat or {}).get("name") or parsed.get("category_name") or "Other"

    def _f(v, d):
        try:
            return float(v)
        except Exception:
            return d
    h_min = max(0.5, min(12.0, _f(parsed.get("estimated_hours_min"), 1.0)))
    h_max = max(h_min, min(12.0, _f(parsed.get("estimated_hours_max"), h_min + 1.0)))

    rate = _f((cat or {}).get("recommended_price"), 0) or 50.0
    commission = _f((cat or {}).get("commission_rate"), 0) or 15.0
    mult = 1.0 + commission / 100.0
    price_min = round(rate * h_min * mult)
    price_max = round(rate * h_max * mult)

    def _hours_label(a, b):
        fa = f"{a:g}"
        fb = f"{b:g}"
        return f"~{fa}–{fb} hr" if fa != fb else f"~{fa} hr"

    return {
        "detection": {
            "category_id": category_id,
            "category_name": category_name,
            "skill": parsed.get("skill") or category_name,
            "confidence": round(_f(parsed.get("confidence"), 0.7), 2),
            "summary": parsed.get("summary") or "",
        },
        "estimate": {
            "hours_min": h_min,
            "hours_max": h_max,
            "hours_label": _hours_label(h_min, h_max),
            "price_min": price_min,
            "price_max": price_max,
            "currency": "USD",
            "hourly_rate": round(rate),
        },
    }


# Include the router in the main app
app.include_router(api_router)

# Test endpoint for connectivity
@app.get("/api/test")
async def test_connection():
    return {
        "status": "ok",
        "message": "Backend is working!",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# Build/version marker — bumps on every deploy so we can confirm what's live.
BUILD_VERSION = os.environ.get("BUILD_VERSION", "dev")
BUILD_SHA = os.environ.get("BUILD_SHA", "unknown")
BUILD_TIME = os.environ.get("BUILD_TIME", "unknown")

@app.get("/api/version")
async def get_version():
    return {
        "version": BUILD_VERSION,
        "sha": BUILD_SHA,
        "build_time": BUILD_TIME,
        # known-feature flags so we can verify the deployed code surface
        "features": {
            "pending_acceptance": True,
            "integration_keys": True,
            "category_optional_str": True,
            "stripe_connect_payouts": True,
        },
    }

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event():
    """Start background tasks on app startup."""
    asyncio.create_task(_auto_cleanup_loop())
    asyncio.create_task(_create_seed_accounts())
    asyncio.create_task(_seed_default_categories())


async def _seed_default_categories():
    """Seed the built-in service categories on first startup so admins can edit
    them (commission %, recommended price, cover image, etc.).

    Idempotent: a category is only inserted if no category with the same
    `category_id` already exists. Safe to run on every startup.
    """
    await asyncio.sleep(3)  # give DB connection time to come up

    DEFAULT_CATEGORIES = [
        {
            "category_id": "assembly",
            "name": "Furniture Assembly",
            "description": "IKEA, office furniture, beds, wardrobes, shelf mounting, and appliance installation",
            "icon": "cube-outline",
            "commission_rate": 15.0,
            "recommended_price": 30.0,
        },
        {
            "category_id": "cleaning",
            "name": "Cleaning",
            "description": "House, deep, and office cleaning, window washing, and carpet cleaning",
            "icon": "sparkles-outline",
            "commission_rate": 15.0,
            "recommended_price": 25.0,
        },
        {
            "category_id": "home_improvements",
            "name": "Home Repair",
            "description": "Appliance installation, door repair, painting, tiling, plumbing, and electrical",
            "icon": "hammer-outline",
            "commission_rate": 15.0,
            "recommended_price": 40.0,
        },
        {
            "category_id": "moving",
            "name": "Moving & Delivery",
            "description": "Moving help, packing, furniture moving, delivery, and junk removal",
            "icon": "car-outline",
            "commission_rate": 15.0,
            "recommended_price": 35.0,
        },
        {
            "category_id": "outdoor",
            "name": "Outdoor Work",
            "description": "Lawn care, snow removal, gardening, pressure washing, and fence installation",
            "icon": "leaf-outline",
            "commission_rate": 15.0,
            "recommended_price": 30.0,
        },
        {
            "category_id": "personal",
            "name": "Personal Assistance",
            "description": "Errands, shopping assistant, pet care, and senior care",
            "icon": "person-outline",
            "commission_rate": 15.0,
            "recommended_price": 20.0,
        },
        {
            "category_id": "it_tech",
            "name": "IT & Tech",
            "description": "Computer and Smart TV setup, phone repair, networking, and data recovery",
            "icon": "laptop-outline",
            "commission_rate": 15.0,
            "recommended_price": 35.0,
        },
        {
            "category_id": "events",
            "name": "Events & Parties",
            "description": "Event setup, photography, kitchen help, and bartending",
            "icon": "balloon-outline",
            "commission_rate": 15.0,
            "recommended_price": 30.0,
        },
        {
            "category_id": "other",
            "name": "Other",
            "description": "Handyman, tutoring, translation, and driving",
            "icon": "ellipsis-horizontal-outline",
            "commission_rate": 15.0,
            "recommended_price": 25.0,
        },
    ]

    try:
        created = 0
        healed = 0
        for c in DEFAULT_CATEGORIES:
            existing = await db.categories.find_one({"category_id": c["category_id"]})
            if existing:
                # Heal legacy/default rows so copy changes (e.g. localization) propagate.
                if existing.get("is_default"):
                    updates = {}
                    for field in ("name", "description", "icon", "color", "emoji"):
                        if field in c and existing.get(field) != c[field]:
                            updates[field] = c[field]
                    if updates:
                        await db.categories.update_one(
                            {"category_id": c["category_id"]}, {"$set": updates}
                        )
                        healed += 1
                continue
            doc = {
                **c,
                "image": None,
                "parent_id": None,
                "is_active": True,
                "created_at": datetime.now(timezone.utc),
                "is_default": True,
            }
            await db.categories.insert_one(doc)
            created += 1
        if created:
            print(f"[SEED] Seeded {created} default categories.")
        if healed:
            print(f"[SEED] Healed {healed} default category copies (localization).")
        if not created and not healed:
            print("[SEED] Default categories already present.")
    except Exception as e:
        print(f"[SEED] Failed to seed default categories: {e}")

async def _create_seed_accounts():
    """Create default seed accounts (admin, provider, client) if they don't exist."""
    await asyncio.sleep(2)  # Wait for DB connection to be ready

    seed_users = [
        {
            "email": "admin@handyhub.com",
            "password": "Admin2024!",
            "name": "Administrator",
            "role": UserRole.ADMIN,
            "phone": "+380000000001",
        },
        {
            "email": "provider@handyhub.com",
            "password": "Provider2024!",
            "name": "Test Pro",
            "role": UserRole.PROVIDER,
            "phone": "+380000000002",
        },
        {
            "email": "client@handyhub.com",
            "password": "Client2024!",
            "name": "Test Client",
            "role": UserRole.CLIENT,
            "phone": "+380000000003",
        },
    ]

    for seed in seed_users:
        existing = await db.users.find_one({"email": seed["email"]})
        if not existing:
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            user = User(
                user_id=user_id,
                email=seed["email"],
                name=seed["name"],
                role=seed["role"],
                phone=seed["phone"],
                password_hash=hash_password(seed["password"])
            )
            user_dict = user.dict()
            user_dict["plain_password"] = seed["password"]
            await db.users.insert_one(user_dict)
            print(f"[SEED] Created {seed['role']} account: {seed['email']}")
        else:
            print(f"[SEED] Account already exists: {seed['email']}")

    print("[SEED] Seed accounts check complete.")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
