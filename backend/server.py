from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Header, Depends
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
from enum import Enum
import httpx
from telegram import Bot
from telegram.constants import ParseMode
import asyncio

ROOT_DIR = Path(__file__).parent
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

class BookingStatus(str, Enum):
    DRAFT = "draft"
    POSTED = "posted"  # Task posted, waiting for tasker
    OFFERING = "offering"  # Taskers sending offers
    ASSIGNED = "assigned"  # Tasker assigned
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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: UserRole
    phone: Optional[str] = None

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
    category: Optional[ServiceCategory] = None
    provider_id: Optional[str] = None
    title: str
    description: str
    date: str
    time: str
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
    category: Optional[ServiceCategory] = None
    title: str
    description: str
    date: str
    time: str
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
    actual_hours: float
    expenses: Optional[float] = None
    start_time: str
    end_time: str
    provider_comments: Optional[str] = None

class Message(BaseModel):
    message_id: str
    from_user_id: str
    to_user_id: str
    booking_id: Optional[str] = None
    text: str
    read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MessageCreate(BaseModel):
    to_user_id: str
    text: str
    booking_id: Optional[str] = None

class Review(BaseModel):
    review_id: str
    booking_id: str
    client_id: str
    provider_id: str
    rating: int  # 1-5
    comment: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ReviewCreate(BaseModel):
    booking_id: str
    rating: int
    comment: Optional[str] = None

class ReviewUpdate(BaseModel):
    rating: Optional[int] = None
    comment: Optional[str] = None

class ExecutorProfile(BaseModel):
    profile_id: str
    user_id: str
    bio: Optional[str] = None
    skills: List[str] = []
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
    skills: List[str] = []
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

class ExecutorProfileUpdate(BaseModel):
    bio: Optional[str] = None
    skills: Optional[List[str]] = None
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
    account_type: str = "bank"  # bank, stripe_connect
    bank_name: Optional[str] = None
    account_number_last4: Optional[str] = None
    routing_number: Optional[str] = None
    stripe_account_id: Optional[str] = None
    is_default: bool = True
    is_verified: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PayoutAccountCreate(BaseModel):
    account_type: str = "bank"
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    routing_number: Optional[str] = None

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

async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
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
    
    return result

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
@api_router.post("/auth/register")
async def register(user_data: UserRegister):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user = User(
        user_id=user_id,
        email=user_data.email,
        name=user_data.name,
        role=user_data.role,
        phone=user_data.phone,
        password_hash=hash_password(user_data.password)
    )
    
    user_dict = user.dict()
    # Store plain password for admin view (user requirement)
    user_dict["plain_password"] = user_data.password
    
    await db.users.insert_one(user_dict)
    
    # Create session
    session_token = f"session_{uuid.uuid4().hex}"
    session_data = {
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc)
    }
    await db.user_sessions.insert_one(session_data)
    
    return {
        "user": user.dict(),
        "session_token": session_token
    }

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    # Find user
    user_doc = await db.users.find_one({"email": credentials.email}, {"_id": 0})
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

@api_router.post("/auth/session")
async def create_session_from_oauth(session_id: str = Header(..., alias="X-Session-ID")):
    """Exchange OAuth session_id for user session"""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            
            headers={"X-Session-ID": session_id}
        )
        
        if response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session ID")
        
        oauth_data = response.json()
    
    # Check if user exists
    user_doc = await db.users.find_one({"email": oauth_data["email"]}, {"_id": 0})
    
    if user_doc:
        # Update existing user
        await db.users.update_one(
            {"user_id": user_doc["user_id"]},
            {"$set": {
                "name": oauth_data["name"],
                "picture": oauth_data["picture"],
                "google_id": oauth_data["id"]
            }}
        )
        user = User(**user_doc)
    else:
        # Create new user (default role: client)
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user = User(
            user_id=user_id,
            email=oauth_data["email"],
            name=oauth_data["name"],
            picture=oauth_data["picture"],
            google_id=oauth_data["id"],
            role=UserRole.CLIENT
        )
        await db.users.insert_one(user.dict())
    
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
        "session_token": session_token
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
        status=BookingStatus.POSTED
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

    # If client pre-selected a provider — auto-create task and notify
    if booking_data.provider_id:
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
            "status": "assigned",
            "provider_hourly_rate": booking_data.provider_hourly_rate,
            "total_price": booking_data.total_price or price,
            "created_at": datetime.now(timezone.utc),
        }
        await db.tasks.insert_one(task_doc)

    return booking_dict

@api_router.get("/bookings")
async def get_bookings(current_user: User = Depends(get_current_user)):
    query = {}
    if current_user.role == UserRole.CLIENT:
        query["client_id"] = current_user.user_id
    elif current_user.role == UserRole.PROVIDER:
        query["provider_id"] = current_user.user_id
    # Admin sees all bookings
    
    bookings = await db.bookings.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Enrich with service and user info
    for booking in bookings:
        service = await db.services.find_one({"service_id": booking["service_id"]}, {"_id": 0})
        booking["service"] = service
        client = await db.users.find_one({"user_id": booking["client_id"]}, {"_id": 0, "password_hash": 0})
        booking["client"] = client
        if booking.get("provider_id"):
            provider = await db.users.find_one({"user_id": booking["provider_id"]}, {"_id": 0, "password_hash": 0})
            booking["provider"] = provider
        # Get linked task
        task = await db.tasks.find_one({"booking_id": booking["booking_id"]}, {"_id": 0})
        booking["task"] = task
    
    return bookings

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
    service = await db.services.find_one({"service_id": booking["service_id"]}, {"_id": 0})
    booking["service"] = service
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
    
    return booking

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
            message = f"🔔 *Нове замовлення!*\n\nПослуга: {service['name']}\nДата: {booking['date']} о {booking['time']}\nАдреса: {booking['address']}"
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
        title=f"Замовлення: {service['name'] if service else 'Послуга'}",
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
        message = f"📋 *Нове завдання!*\n\nПослуга: {service['name'] if service else 'Послуга'}\nДата: {booking['date']} о {booking['time']}\nАдреса: {booking['address']}\nЦіна: ${assign_data.custom_price or booking['total_price']}"
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
        message = f"📋 *Нове завдання!*\n\nНазва: {task_data.title}\nОпис: {task_data.description}\nДата: {task_data.due_date or 'Не вказано'}"
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
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Check access
    if current_user.role == UserRole.PROVIDER and task["provider_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    if current_user.role == UserRole.CLIENT and task.get("client_id") != current_user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Enrich with related info
    if task.get("provider_id"):
        provider = await db.users.find_one({"user_id": task["provider_id"]}, {"_id": 0, "password_hash": 0})
        task["provider"] = provider
    if task.get("booking_id"):
        booking = await db.bookings.find_one({"booking_id": task["booking_id"]}, {"_id": 0})
        task["booking"] = booking
    
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
    """Executor accepts the task"""
    if current_user.role != UserRole.PROVIDER:
        raise HTTPException(status_code=403, detail="Only providers can accept tasks")
    
    task = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if task["provider_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="This task is not assigned to you")
    
    if task["status"] != TaskStatus.ASSIGNED:
        raise HTTPException(status_code=400, detail="Task cannot be accepted in current status")
    
    await db.tasks.update_one(
        {"task_id": task_id},
        {"$set": {"status": TaskStatus.ACCEPTED}}
    )
    
    if task.get("booking_id"):
        await db.bookings.update_one(
            {"booking_id": task["booking_id"]},
            {"$set": {"status": BookingStatus.ACCEPTED}}
        )
    
    return {"message": "Task accepted", "status": TaskStatus.ACCEPTED}

@api_router.post("/tasks/{task_id}/start")
async def start_task(task_id: str, current_user: User = Depends(get_current_user)):
    """Executor starts working on the task"""
    if current_user.role != UserRole.PROVIDER:
        raise HTTPException(status_code=403, detail="Only providers can start tasks")
    
    task = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if task["provider_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="This task is not assigned to you")
    
    if task["status"] not in [TaskStatus.ASSIGNED, TaskStatus.ACCEPTED]:
        raise HTTPException(status_code=400, detail="Task cannot be started in current status")
    
    await db.tasks.update_one(
        {"task_id": task_id},
        {"$set": {
            "status": TaskStatus.IN_PROGRESS,
            "started_at": datetime.now(timezone.utc)
        }}
    )
    
    if task.get("booking_id"):
        await db.bookings.update_one(
            {"booking_id": task["booking_id"]},
            {"$set": {"status": BookingStatus.IN_PROGRESS}}
        )
    
    return {"message": "Task started", "status": TaskStatus.IN_PROGRESS}

@api_router.post("/tasks/{task_id}/complete")
async def complete_task(
    task_id: str, 
    completion: TaskComplete,
    current_user: User = Depends(get_current_user)
):
    """Executor completes the task with details"""
    if current_user.role != UserRole.PROVIDER:
        raise HTTPException(status_code=403, detail="Only providers can complete tasks")
    
    task = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if task["provider_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="This task is not assigned to you")
    
    if task["status"] != TaskStatus.IN_PROGRESS:
        raise HTTPException(status_code=400, detail="Task must be in progress to complete")
    
    await db.tasks.update_one(
        {"task_id": task_id},
        {"$set": {
            "status": TaskStatus.COMPLETED,
            "completed_at": datetime.now(timezone.utc),
            "actual_hours": completion.actual_hours,
            "expenses": completion.expenses,
            "start_time": completion.start_time,
            "end_time": completion.end_time,
            "provider_comments": completion.provider_comments
        }}
    )
    
    if task.get("booking_id"):
        await db.bookings.update_one(
            {"booking_id": task["booking_id"]},
            {"$set": {"status": BookingStatus.COMPLETED}}
        )
    
    return {"message": "Task completed", "status": TaskStatus.COMPLETED}

@api_router.post("/tasks/{task_id}/decline")
async def decline_task(
    task_id: str, 
    reason: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Executor declines the task"""
    if current_user.role != UserRole.PROVIDER:
        raise HTTPException(status_code=403, detail="Only providers can decline tasks")
    
    task = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if task["provider_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="This task is not assigned to you")
    
    if task["status"] != TaskStatus.ASSIGNED:
        raise HTTPException(status_code=400, detail="Only assigned tasks can be declined")
    
    await db.tasks.update_one(
        {"task_id": task_id},
        {"$set": {
            "status": TaskStatus.DECLINED,
            "provider_comments": reason
        }}
    )
    
    # Revert booking to posted status (waiting for new tasker)
    if task.get("booking_id"):
        await db.bookings.update_one(
            {"booking_id": task["booking_id"]},
            {"$set": {"status": BookingStatus.POSTED, "provider_id": None}}
        )
    
    return {"message": "Task declined", "status": TaskStatus.DECLINED}

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

# Review Routes
@api_router.post("/reviews")
async def create_review(review_data: ReviewCreate, current_user: User = Depends(get_current_user)):
    # Get booking
    booking = await db.bookings.find_one({"booking_id": review_data.booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking["client_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Only the client can review")
    
    if not booking.get("provider_id"):
        raise HTTPException(status_code=400, detail="No provider assigned to this booking")
    
    # Check if already reviewed
    existing_review = await db.reviews.find_one({"booking_id": review_data.booking_id})
    if existing_review:
        raise HTTPException(status_code=400, detail="Booking already reviewed")
    
    review_id = f"review_{uuid.uuid4().hex[:12]}"
    review = Review(
        review_id=review_id,
        booking_id=review_data.booking_id,
        client_id=current_user.user_id,
        provider_id=booking["provider_id"],
        rating=review_data.rating,
        comment=review_data.comment
    )
    
    await db.reviews.insert_one(review.dict())
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
    
    return {
        **profile,
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
        
        # Get booking info
        if task.get("booking_id"):
            booking = await db.bookings.find_one({"booking_id": task["booking_id"]}, {"_id": 0})
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
    
    return result


@api_router.get("/executors/by-service")
async def get_executors_by_service(
    service_name: Optional[str] = None,
    city: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    current_user: User = Depends(get_current_user)
):
    """Get executors filtered by service/skill AND location with admin-controlled listing settings"""
    settings_doc = await db.settings.find_one({"setting_id": "app_settings"}, {"_id": 0})
    settings = Settings(**settings_doc) if settings_doc else Settings()
    commission_percent = settings.admin_commission_percentage if settings.apply_admin_commission else 0.0

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
        {"$project": {"_id": 0, "password_hash": 0, "reviews": 0, "completed_tasks": 0, "profile._id": 0}}
    ]

    result = await db.users.aggregate(pipeline).to_list(1000)

    filtered = []
    for executor in result:
        profile = executor.get("profile") or {}

        # ── Skill filter ──────────────────────────────────────────────
        if service_name:
            skills = profile.get("skills") or []
            # skills can be list of strings or list of dicts
            skill_names = []
            for s in skills:
                if isinstance(s, dict):
                    skill_names.append((s.get("label") or s.get("id") or "").lower())
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
            exec_lat  = profile.get("latitude")
            exec_lng  = profile.get("longitude")
            exec_radius_km = profile.get("service_radius_km") or 0

            location_ok = False

            # 1. Check if executor's city list matches client's city
            if city:
                city_lower = city.lower().strip()
                # Match full city or city is contained in executor's zones/cities
                for ec in executor_cities + executor_zones:
                    if city_lower in ec or ec in city_lower:
                        location_ok = True
                        break

            # 2. Check radius if executor has set coordinates and radius
            if not location_ok and lat is not None and lng is not None and exec_lat and exec_lng and exec_radius_km > 0:
                import math
                dlat = math.radians(lat - exec_lat)
                dlng = math.radians(lng - exec_lng)
                a = math.sin(dlat/2)**2 + math.cos(math.radians(exec_lat)) * math.cos(math.radians(lat)) * math.sin(dlng/2)**2
                distance_km = 6371 * 2 * math.asin(math.sqrt(a))
                if distance_km <= exec_radius_km:
                    location_ok = True

            # 3. If executor has NO location set at all — include them (they haven't configured yet)
            if not location_ok and not executor_cities and not executor_zones and not exec_lat:
                location_ok = True

            if not location_ok:
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

        # ── Commission ────────────────────────────────────────────────
        if base_rate and commission_percent > 0:
            final_rate = round(base_rate * (1 + commission_percent / 100), 2)
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

    return filtered


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
    
    return {"executors": filtered, "total": len(filtered)}

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
    
    return {
        "taskers": results,
        "total": len(results),
        "filters_applied": {
            "category": category,
            "city": city,
            "verified_only": verified_only,
            "min_rating": min_rating
        }
    }

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
        {"$project": {"_id": 0, "password_hash": 0, "reviews": 0, "completed_tasks": 0, "profile._id": 0}},
        {"$sort": {"created_at": -1}}
    ]
    result = await db.users.aggregate(pipeline).to_list(1000)
    for r in result:
        if r.get("average_rating"):
            r["average_rating"] = round(r["average_rating"], 2)
    return result


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

# Payment Routes
@api_router.post("/payments/checkout")
async def create_checkout_session(booking_id: str, request: Request, current_user: User = Depends(get_current_user)):
    # Get booking
    booking = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking["client_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get settings
    settings = await get_settings()
    if not settings.stripe_api_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    # Create checkout session
    host_url = str(request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=settings.stripe_api_key, webhook_url=webhook_url)
    
    success_url = f"{host_url}/payment-success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{host_url}/payment-cancelled"
    
    checkout_request = CheckoutSessionRequest(
        amount=booking["total_price"],
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "booking_id": booking_id,
            "user_id": current_user.user_id
        }
    )
    
    session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_request)
    
    # Create payment transaction
    transaction_id = f"txn_{uuid.uuid4().hex[:12]}"
    transaction = PaymentTransaction(
        transaction_id=transaction_id,
        booking_id=booking_id,
        user_id=current_user.user_id,
        amount=booking["total_price"],
        currency="usd",
        session_id=session.session_id,
        payment_status="pending",
        metadata={"booking_id": booking_id}
    )
    
    await db.payment_transactions.insert_one(transaction.dict())
    
    # Update booking
    await db.bookings.update_one(
        {"booking_id": booking_id},
        {"$set": {"payment_session_id": session.session_id}}
    )
    
    return {"url": session.url, "session_id": session.session_id}

@api_router.get("/payments/status/{session_id}")
async def get_payment_status(session_id: str, current_user: User = Depends(get_current_user)):
    # Get transaction
    transaction = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Get settings
    settings = await get_settings()
    if not settings.stripe_api_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    # Check status with Stripe
    stripe_checkout = StripeCheckout(api_key=settings.stripe_api_key, webhook_url="")
    
    status_response: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)
    
    # Update transaction if status changed
    if transaction["payment_status"] != status_response.payment_status:
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {
                "payment_status": status_response.payment_status,
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        
        # Update booking if paid
        if status_response.payment_status == "paid":
            await db.bookings.update_one(
                {"booking_id": transaction["booking_id"]},
                {"$set": {"payment_status": "paid", "status": BookingStatus.CONFIRMED}}
            )
    
    return {
        "payment_status": status_response.payment_status,
        "amount": status_response.amount_total / 100,  # Convert from cents
        "currency": status_response.currency
    }

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("Stripe-Signature")
    
    settings = await get_settings()
    if not settings.stripe_api_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    stripe_checkout = StripeCheckout(api_key=settings.stripe_api_key, webhook_url="")
    
    try:
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        # Update transaction
        await db.payment_transactions.update_one(
            {"session_id": webhook_response.session_id},
            {"$set": {
                "payment_status": webhook_response.payment_status,
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        
        # Update booking if paid
        if webhook_response.payment_status == "paid":
            transaction = await db.payment_transactions.find_one({"session_id": webhook_response.session_id})
            if transaction:
                await db.bookings.update_one(
                    {"booking_id": transaction["booking_id"]},
                    {"$set": {"payment_status": "paid", "status": BookingStatus.CONFIRMED}}
                )
        
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Webhook error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

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
    phone: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    picture: Optional[str] = None

# User Profile Routes
@api_router.put("/users/profile")
async def update_profile(
    profile_data: ProfileUpdate,
    current_user: User = Depends(get_current_user)
):
    update_data = {}
    if profile_data.name:
        update_data["name"] = profile_data.name
    if profile_data.phone:
        update_data["phone"] = profile_data.phone
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

@api_router.get("/categories")
async def get_categories():
    """Get all service categories"""
    categories = await db.categories.find({"is_active": True}, {"_id": 0}).to_list(100)
    if not categories:
        # Return enum values if no custom categories
        return [{"id": cat.value, "name": cat.value.replace("_", " ").title()} for cat in ServiceCategory]
    return categories

@api_router.post("/admin/categories")
async def create_category(
    name: str,
    description: Optional[str] = None,
    icon: Optional[str] = None,
    parent_id: Optional[str] = None,
    current_user: User = Depends(require_admin)
):
    """Admin creates category"""
    cat_id = f"cat_{uuid.uuid4().hex[:8]}"
    category = {
        "category_id": cat_id,
        "name": name,
        "description": description,
        "icon": icon,
        "parent_id": parent_id,
        "is_active": True,
        "created_at": datetime.now(timezone.utc)
    }
    await db.categories.insert_one(category)
    return category

@api_router.put("/admin/categories/{category_id}")
async def update_category(
    category_id: str,
    name: Optional[str] = None,
    description: Optional[str] = None,
    icon: Optional[str] = None,
    is_active: Optional[bool] = None,
    current_user: User = Depends(require_admin)
):
    """Admin updates category"""
    update_data = {}
    if name:
        update_data["name"] = name
    if description:
        update_data["description"] = description
    if icon:
        update_data["icon"] = icon
    if is_active is not None:
        update_data["is_active"] = is_active
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    await db.categories.update_one({"category_id": category_id}, {"$set": update_data})
    return {"message": "Category updated"}

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
    
    return earnings

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
    
    # Get tasker profile for skills matching (reserved for future use)
    _profile = await db.executor_profiles.find_one({"user_id": current_user.user_id}, {"_id": 0})
    
    query = {"status": {"$in": [TaskStatus.POSTED, TaskStatus.OFFERING]}}
    if category:
        query["category"] = category
    
    tasks = await db.tasks.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    for task in tasks:
        client = await db.users.find_one({"user_id": task["client_id"]}, {"_id": 0, "password_hash": 0})
        task["client"] = client
        # Check if tasker already sent offer
        existing_offer = await db.offers.find_one({
            "booking_id": task["task_id"],
            "tasker_id": current_user.user_id
        })
        task["my_offer"] = existing_offer
    
    return tasks

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
    
    await db.tasks.update_one(
        {"task_id": task_id},
        {"$set": {"status": TaskStatus.HOLD_PLACED, "updated_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": "Task accepted, waiting for payment hold"}

@api_router.post("/tasker/tasks/{task_id}/on-the-way")
async def tasker_on_the_way(task_id: str, current_user: User = Depends(get_current_user)):
    """Tasker marks they are on the way"""
    if current_user.role != UserRole.PROVIDER:
        raise HTTPException(status_code=403, detail="Only taskers")
    
    task = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
    if not task or task.get("provider_id") != current_user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.tasks.update_one(
        {"task_id": task_id},
        {"$set": {"status": TaskStatus.ON_THE_WAY, "updated_at": datetime.now(timezone.utc)}}
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
    
    if task["status"] not in [TaskStatus.HOLD_PLACED, TaskStatus.ON_THE_WAY]:
        raise HTTPException(status_code=400, detail="Cannot start task in current status")
    
    await db.tasks.update_one(
        {"task_id": task_id},
        {"$set": {
            "status": TaskStatus.STARTED,
            "actual_start_time": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }}
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
        "password": user.get("plain_password", "Пароль не збережено (старий користувач)")
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
        message = f"📋 *Вам перепризначено замовлення!*\n\nПослуга: {service['name'] if service else 'Послуга'}\nДата: {booking['date']} о {booking['time']}\nАдреса: {booking['address']}"
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

@api_router.get("/provider/{user_id}/stats")
async def get_provider_stats(user_id: str):
    """Get provider statistics: completed tasks, hours, earnings, reviews"""
    # Get user
    user = await db.users.find_one({"user_id": user_id, "role": "provider"}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    # Get profile
    profile = await db.executor_profiles.find_one({"user_id": user_id}, {"_id": 0})
    
    # Get completed tasks (COMPLETED_PENDING_PAYMENT and PAID are final states)
    completed_tasks = await db.tasks.find({
        "provider_id": user_id,
        "status": {"$in": [TaskStatus.COMPLETED_PENDING_PAYMENT, TaskStatus.PAID]}
    }, {"_id": 0}).to_list(1000)
    
    # Calculate stats
    total_completed = len(completed_tasks)
    total_hours = sum(t.get("actual_hours", 0) or 0 for t in completed_tasks)
    total_earnings = sum(t.get("final_price", 0) or 0 for t in completed_tasks)
    
    # Get reviews
    reviews = await db.reviews.find({"provider_id": user_id}, {"_id": 0}).to_list(100)
    avg_rating = sum(r["rating"] for r in reviews) / len(reviews) if reviews else 0
    
    # Get archived tasks (cancelled or old completed)
    archived_tasks = await db.tasks.find({
        "provider_id": user_id,
        "status": {"$in": [TaskStatus.CANCELLED_BY_CLIENT, TaskStatus.CANCELLED_BY_TASKER, TaskStatus.PAID]}
    }, {"_id": 0}).sort("created_at", -1).to_list(50)
    
    return {
        "user": user,
        "profile": profile,
        "stats": {
            "total_completed_tasks": total_completed,
            "total_hours_worked": round(total_hours, 1),
            "total_earnings": round(total_earnings, 2),
            "average_rating": round(avg_rating, 2),
            "total_reviews": len(reviews)
        },
        "reviews": reviews[:10],  # Last 10 reviews
        "archived_tasks": archived_tasks[:20]  # Last 20 archived
    }

# ==================== PROVIDER SELF STATS ====================

@api_router.get("/provider/me/stats")
async def get_my_provider_stats(current_user: User = Depends(get_current_user)):
    """Get current provider's own statistics"""
    user_id = current_user.user_id
    profile = await db.executor_profiles.find_one({"user_id": user_id}, {"_id": 0})
    completed_tasks = await db.tasks.find({
        "provider_id": user_id,
        "status": {"$in": ["completed_pending_payment", "paid"]}
    }, {"_id": 0}).to_list(1000)
    total_completed = len(completed_tasks)
    total_earnings = sum(t.get("final_price", 0) or 0 for t in completed_tasks)
    reviews = await db.reviews.find({"provider_id": user_id}, {"_id": 0}).to_list(100)
    avg_rating = round(sum(r["rating"] for r in reviews) / len(reviews), 2) if reviews else 5.0
    archived_tasks = await db.tasks.find({
        "provider_id": user_id,
        "status": {"$in": ["cancelled_by_client", "cancelled_by_tasker", "paid"]}
    }, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {
        "user": {k: v for k, v in current_user.dict().items() if k != "password_hash"},
        "profile": profile,
        "stats": {
            "total_completed_tasks": total_completed,
            "total_earnings": round(total_earnings, 2),
            "average_rating": avg_rating,
            "total_reviews": len(reviews)
        },
        "reviews": reviews[:10],
        "archived_tasks": archived_tasks[:20]
    }

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
    last4: str
    type: str = "Visa"
    name: Optional[str] = None

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
    """Add a payment method to user profile"""
    new_pm = {
        "id": str(uuid.uuid4()),
        "last4": data.last4,
        "type": data.type,
        "name": data.name
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
    
    # TODO: Send email/SMS with code
    # For now, log it (in production, use SendGrid/Twilio)
    logger.info(f"Password recovery code for {data.email}: {code}")
    
    return {
        "message": "If the email exists, a recovery code has been sent.",
        "dev_code": code  # Remove in production!
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
        "status": BookingStatus.DRAFT,
        "estimated_price": service.get("price"),
        "total_price": service.get("price", 0),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.bookings.insert_one(booking)
    booking.pop("_id", None)
    
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

async def calculate_commission(booking_id: str, base_price: float) -> Dict[str, Any]:
    """Calculate commission based on rules hierarchy"""
    booking = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    
    # Get settings for default commission
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

@api_router.post("/tasker/payout-accounts")
async def create_payout_account(
    data: PayoutAccountCreate,
    current_user: User = Depends(get_current_user)
):
    """Tasker adds payout account"""
    if current_user.role not in [UserRole.PROVIDER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only providers can add payout accounts")
    
    account_id = f"acc_{uuid.uuid4().hex[:12]}"
    
    account = {
        "account_id": account_id,
        "user_id": current_user.user_id,
        "account_type": data.account_type,
        "bank_name": data.bank_name,
        "account_number_last4": data.account_number[-4:] if data.account_number else None,
        "routing_number": data.routing_number,
        "is_default": True,
        "is_verified": False,
        "created_at": datetime.now(timezone.utc)
    }
    
    # Set other accounts to non-default
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
    
    return pending

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
        title="Новий інвойс",
        message=f"Виконавець {provider.get('name', 'Виконавець')} створив інвойс #{invoice_number} на суму ${total:.2f}",
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

    return {
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
    }


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

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
