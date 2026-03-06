CREATE TABLE "admin_settings" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"value" text,
	"value_type" text DEFAULT 'string' NOT NULL,
	"description" text,
	"updated_by" text,
	"updated_at" text DEFAULT now() NOT NULL,
	CONSTRAINT "admin_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "analytics_snapshots" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period_type" text NOT NULL,
	"period_start" text NOT NULL,
	"period_end" text NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"total_revenue" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_expenses" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_payroll" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_bills_paid" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_invoices_issued" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_invoices_paid" numeric(14, 2) DEFAULT '0' NOT NULL,
	"gross_profit" numeric(14, 2) DEFAULT '0' NOT NULL,
	"profit_margin" numeric(6, 2) DEFAULT '0' NOT NULL,
	"net_cash_flow" numeric(14, 2) DEFAULT '0' NOT NULL,
	"expense_count" integer DEFAULT 0 NOT NULL,
	"transaction_count" integer DEFAULT 0 NOT NULL,
	"top_category" text,
	"top_vendor" text,
	"category_breakdown" jsonb DEFAULT '{}'::jsonb,
	"department_breakdown" jsonb DEFAULT '{}'::jsonb,
	"company_id" text,
	"created_at" text DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"user_name" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"details" jsonb DEFAULT '{}'::jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" text DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bills" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"provider" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"due_date" text NOT NULL,
	"category" text NOT NULL,
	"status" text DEFAULT 'Unpaid' NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"logo" text,
	"user_id" varchar(36),
	"company_id" text,
	"recurring" boolean DEFAULT false,
	"frequency" text DEFAULT 'monthly',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"budget_limit" numeric(12, 2) NOT NULL,
	"spent" numeric(12, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"period" text DEFAULT 'monthly' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_insights" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"category" text NOT NULL,
	"severity" text DEFAULT 'info' NOT NULL,
	"source" text DEFAULT 'system' NOT NULL,
	"recommendation" text,
	"metric" text,
	"metric_value" numeric(14, 2),
	"metric_change" numeric(8, 2),
	"related_entity_type" text,
	"related_entity_id" text,
	"period_start" text,
	"period_end" text,
	"company_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" text DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "card_transactions" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"merchant" text NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"date" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"owner_id" text,
	"logo" text,
	"industry" text,
	"size" text,
	"website" text,
	"country" text DEFAULT 'US',
	"currency" text DEFAULT 'USD',
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" text DEFAULT now() NOT NULL,
	"updated_at" text DEFAULT now() NOT NULL,
	CONSTRAINT "companies_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "company_balances" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"local" numeric(12, 2) DEFAULT '0' NOT NULL,
	"usd" numeric(12, 2) DEFAULT '0' NOT NULL,
	"escrow" numeric(12, 2) DEFAULT '0' NOT NULL,
	"local_currency" text DEFAULT 'USD' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_invitations" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'EMPLOYEE' NOT NULL,
	"department" text,
	"token" text NOT NULL,
	"invited_by" text,
	"invited_by_name" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" text NOT NULL,
	"accepted_at" text,
	"created_at" text DEFAULT now() NOT NULL,
	CONSTRAINT "company_invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "company_members" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" text NOT NULL,
	"user_id" text,
	"email" text NOT NULL,
	"role" text DEFAULT 'EMPLOYEE' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"invited_at" text DEFAULT now() NOT NULL,
	"joined_at" text
);
--> statement-breakpoint
CREATE TABLE "company_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"company_name" text DEFAULT 'Spendly' NOT NULL,
	"company_email" text DEFAULT 'finance@spendlymanager.com' NOT NULL,
	"company_phone" text DEFAULT '+1 (555) 123-4567' NOT NULL,
	"company_address" text DEFAULT '123 Business Ave, San Francisco, CA 94105' NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"timezone" text DEFAULT 'America/Los_Angeles' NOT NULL,
	"fiscal_year_start" text DEFAULT 'January' NOT NULL,
	"date_format" text DEFAULT 'MM/DD/YYYY' NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"notifications_enabled" boolean DEFAULT true NOT NULL,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"auto_approve_below" numeric(12, 2) DEFAULT '100' NOT NULL,
	"require_receipts" boolean DEFAULT true NOT NULL,
	"expense_categories" jsonb DEFAULT '["Software","Travel","Office","Marketing","Food","Equipment","Utilities","Legal","Other"]'::jsonb,
	"country_code" text DEFAULT 'US' NOT NULL,
	"region" text DEFAULT 'North America' NOT NULL,
	"payment_provider" text DEFAULT 'stripe' NOT NULL,
	"paystack_enabled" boolean DEFAULT true NOT NULL,
	"stripe_enabled" boolean DEFAULT true NOT NULL,
	"company_logo" text,
	"company_tagline" text,
	"primary_color" text DEFAULT '#4f46e5',
	"secondary_color" text DEFAULT '#10b981',
	"industry" text,
	"company_size" text,
	"tax_id" text,
	"registration_number" text,
	"website" text,
	"invoice_prefix" text DEFAULT 'INV',
	"invoice_footer" text,
	"invoice_terms" text DEFAULT 'Payment due within 30 days',
	"show_logo_on_invoice" boolean DEFAULT true NOT NULL,
	"show_logo_on_receipts" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"head_id" text,
	"budget" numeric(12, 2),
	"color" text DEFAULT '#6366f1' NOT NULL,
	"member_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'Active' NOT NULL,
	"company_id" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exchange_rate_settings" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"buy_markup_percent" numeric(5, 2) DEFAULT '10.00' NOT NULL,
	"sell_markup_percent" numeric(5, 2) DEFAULT '10.00' NOT NULL,
	"last_updated_by" text,
	"updated_at" text DEFAULT now() NOT NULL,
	"created_at" text DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exchange_rates" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"base_currency" text NOT NULL,
	"target_currency" text NOT NULL,
	"rate" numeric(16, 6) NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"valid_from" text NOT NULL,
	"valid_to" text,
	"created_at" text DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"date" text NOT NULL,
	"category" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"user_name" text NOT NULL,
	"user_id" text NOT NULL,
	"company_id" text,
	"department" text DEFAULT 'General' NOT NULL,
	"note" text,
	"receipt_url" text,
	"expense_type" text DEFAULT 'request' NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb,
	"tagged_reviewers" jsonb DEFAULT '[]'::jsonb,
	"vendor_id" text,
	"payout_status" text DEFAULT 'not_started',
	"payout_id" text
);
--> statement-breakpoint
CREATE TABLE "funding_sources" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"card_last4" text,
	"card_brand" text,
	"bank_name" text,
	"account_last4" text,
	"provider_source_id" text,
	"is_default" boolean DEFAULT false,
	"is_verified" boolean DEFAULT false,
	"metadata" jsonb,
	"created_at" text DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_number" text NOT NULL,
	"client" text NOT NULL,
	"client_email" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"due_date" text NOT NULL,
	"issued_date" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb
);
--> statement-breakpoint
CREATE TABLE "kyc_submissions" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_profile_id" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"middle_name" text,
	"date_of_birth" text NOT NULL,
	"gender" text,
	"nationality" text NOT NULL,
	"phone_number" text NOT NULL,
	"alternate_phone" text,
	"address_line_1" text NOT NULL,
	"address_line_2" text,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"country" text NOT NULL,
	"postal_code" text NOT NULL,
	"id_type" text NOT NULL,
	"id_number" text NOT NULL,
	"id_expiry_date" text,
	"id_front_url" text,
	"id_back_url" text,
	"selfie_url" text,
	"proof_of_address_url" text,
	"is_business_account" boolean DEFAULT false NOT NULL,
	"business_name" text,
	"business_type" text,
	"business_registration_number" text,
	"business_address" text,
	"business_document_url" text,
	"status" text DEFAULT 'pending_review' NOT NULL,
	"review_notes" text,
	"reviewed_by" text,
	"reviewed_at" text,
	"submitted_at" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"email_enabled" boolean DEFAULT true NOT NULL,
	"sms_enabled" boolean DEFAULT false NOT NULL,
	"push_enabled" boolean DEFAULT true NOT NULL,
	"in_app_enabled" boolean DEFAULT true NOT NULL,
	"email" text,
	"phone" text,
	"push_token" text,
	"expense_notifications" boolean DEFAULT true NOT NULL,
	"payment_notifications" boolean DEFAULT true NOT NULL,
	"bill_notifications" boolean DEFAULT true NOT NULL,
	"budget_notifications" boolean DEFAULT true NOT NULL,
	"security_notifications" boolean DEFAULT true NOT NULL,
	"marketing_notifications" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "notification_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"data" jsonb,
	"channels" jsonb DEFAULT '["in_app"]'::jsonb,
	"read" boolean DEFAULT false NOT NULL,
	"read_at" text,
	"email_sent" boolean DEFAULT false,
	"sms_sent" boolean DEFAULT false,
	"push_sent" boolean DEFAULT false,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_settings" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text DEFAULT 'My Organization' NOT NULL,
	"logo" text,
	"website" text,
	"email" text,
	"phone" text,
	"address" text,
	"city" text,
	"state" text,
	"country" text DEFAULT 'US',
	"postal_code" text,
	"tax_id" text,
	"currency" text DEFAULT 'USD',
	"timezone" text DEFAULT 'UTC',
	"fiscal_year_start" text DEFAULT 'January',
	"industry" text,
	"size" text,
	"created_at" text DEFAULT now() NOT NULL,
	"updated_at" text DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payout_destinations" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"vendor_id" text,
	"type" text DEFAULT 'bank_account' NOT NULL,
	"provider" text NOT NULL,
	"bank_name" text,
	"bank_code" text,
	"account_number" text,
	"account_name" text,
	"routing_number" text,
	"swift_code" text,
	"currency" text DEFAULT 'USD' NOT NULL,
	"country" text DEFAULT 'US' NOT NULL,
	"is_default" boolean DEFAULT false,
	"is_verified" boolean DEFAULT false,
	"provider_recipient_id" text,
	"metadata" jsonb,
	"created_at" text DEFAULT now() NOT NULL,
	"updated_at" text DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"amount" numeric(16, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"recipient_type" text NOT NULL,
	"recipient_id" text NOT NULL,
	"recipient_name" text,
	"destination_id" text,
	"provider" text NOT NULL,
	"provider_transfer_id" text,
	"provider_reference" text,
	"related_entity_type" text,
	"related_entity_id" text,
	"fee_amount" numeric(12, 2) DEFAULT '0',
	"fee_currency" text DEFAULT 'USD',
	"exchange_rate" numeric(16, 6),
	"failure_reason" text,
	"metadata" jsonb,
	"initiated_by" text,
	"approved_by" text,
	"first_approved_by" text,
	"approval_status" text DEFAULT 'none',
	"processed_at" text,
	"recurring" boolean DEFAULT false,
	"frequency" text DEFAULT 'monthly',
	"next_run_date" text,
	"created_at" text DEFAULT now() NOT NULL,
	"updated_at" text DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_entries" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" text NOT NULL,
	"employee_name" text NOT NULL,
	"department" text NOT NULL,
	"salary" numeric(12, 2) NOT NULL,
	"bonus" numeric(12, 2) DEFAULT '0' NOT NULL,
	"deductions" numeric(12, 2) DEFAULT '0' NOT NULL,
	"net_pay" numeric(12, 2) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"pay_date" text NOT NULL,
	"bank_name" text,
	"account_number" text,
	"account_name" text,
	"recurring" boolean DEFAULT false,
	"frequency" text DEFAULT 'monthly',
	"next_pay_date" text,
	"company_id" text,
	"email" text
);
--> statement-breakpoint
CREATE TABLE "push_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"platform" text NOT NULL,
	"device_id" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"date_range" text NOT NULL,
	"created_at" text NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"file_size" text DEFAULT '0 KB' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" text NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb,
	"description" text,
	"is_system" boolean DEFAULT false,
	"created_at" text DEFAULT now() NOT NULL,
	"updated_at" text DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_payments" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"amount" numeric(16, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"frequency" text DEFAULT 'monthly' NOT NULL,
	"next_run_date" text NOT NULL,
	"last_run_date" text,
	"status" text DEFAULT 'active' NOT NULL,
	"recipient_type" text,
	"recipient_id" text,
	"recipient_name" text,
	"metadata" jsonb,
	"company_id" text,
	"created_by" text,
	"created_at" text DEFAULT now() NOT NULL,
	"updated_at" text DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"value" text,
	"category" text DEFAULT 'general' NOT NULL,
	"description" text,
	"is_public" boolean DEFAULT false,
	"updated_by" text,
	"updated_at" text DEFAULT now() NOT NULL,
	CONSTRAINT "system_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'EMPLOYEE' NOT NULL,
	"department" text DEFAULT 'General' NOT NULL,
	"department_id" text,
	"avatar" text,
	"status" text DEFAULT 'Active' NOT NULL,
	"company_id" text,
	"user_id" text,
	"joined_at" text NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"fee" numeric(12, 2) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'Pending' NOT NULL,
	"date" text NOT NULL,
	"description" text NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firebase_uid" text NOT NULL,
	"email" text NOT NULL,
	"company_id" text,
	"display_name" text,
	"photo_url" text,
	"phone_number" text,
	"date_of_birth" text,
	"nationality" text,
	"address" text,
	"city" text,
	"state" text,
	"country" text,
	"postal_code" text,
	"kyc_status" text DEFAULT 'not_started' NOT NULL,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"onboarding_step" integer DEFAULT 1 NOT NULL,
	"transaction_pin_hash" text,
	"transaction_pin_enabled" boolean DEFAULT false NOT NULL,
	"email_notifications" boolean DEFAULT true NOT NULL,
	"push_notifications" boolean DEFAULT true NOT NULL,
	"sms_notifications" boolean DEFAULT false NOT NULL,
	"expense_alerts" boolean DEFAULT true NOT NULL,
	"budget_warnings" boolean DEFAULT true NOT NULL,
	"payment_reminders" boolean DEFAULT true NOT NULL,
	"weekly_digest" boolean DEFAULT true NOT NULL,
	"preferred_currency" text DEFAULT 'USD',
	"preferred_language" text DEFAULT 'en',
	"preferred_timezone" text DEFAULT 'America/Los_Angeles',
	"preferred_date_format" text DEFAULT 'MM/DD/YYYY',
	"dark_mode" boolean DEFAULT false NOT NULL,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"two_factor_secret" text,
	"session_timeout" integer DEFAULT 30,
	"last_login_at" text,
	"last_login_ip" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "user_profiles_firebase_uid_unique" UNIQUE("firebase_uid")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'EMPLOYEE' NOT NULL,
	"department" text DEFAULT 'General' NOT NULL,
	"avatar" text,
	"permissions" jsonb DEFAULT '[]'::jsonb,
	"company_id" text,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"address" text NOT NULL,
	"category" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"total_paid" numeric(12, 2) DEFAULT '0' NOT NULL,
	"pending_payments" numeric(12, 2) DEFAULT '0' NOT NULL,
	"last_payment" text
);
--> statement-breakpoint
CREATE TABLE "virtual_accounts" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"company_id" text,
	"name" text NOT NULL,
	"account_number" text NOT NULL,
	"account_name" text,
	"bank_name" text NOT NULL,
	"bank_code" text NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"balance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"type" text DEFAULT 'collection' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"provider" text DEFAULT 'stripe' NOT NULL,
	"provider_account_id" text,
	"provider_customer_code" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "virtual_cards" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"last4" text NOT NULL,
	"balance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"card_limit" numeric(12, 2) NOT NULL,
	"type" text DEFAULT 'Visa' NOT NULL,
	"color" text DEFAULT 'indigo' NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" text DEFAULT 'Active' NOT NULL,
	"stripe_card_id" text,
	"stripe_cardholder_id" text
);
--> statement-breakpoint
CREATE TABLE "wallet_transactions" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_id" text NOT NULL,
	"type" text NOT NULL,
	"amount" numeric(16, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"direction" text NOT NULL,
	"balance_before" numeric(16, 2) NOT NULL,
	"balance_after" numeric(16, 2) NOT NULL,
	"description" text,
	"reference" text NOT NULL,
	"related_entity_type" text,
	"related_entity_id" text,
	"metadata" jsonb,
	"status" text DEFAULT 'completed' NOT NULL,
	"created_at" text DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"company_id" text,
	"type" text DEFAULT 'personal' NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"balance" numeric(16, 2) DEFAULT '0' NOT NULL,
	"available_balance" numeric(16, 2) DEFAULT '0' NOT NULL,
	"pending_balance" numeric(16, 2) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"virtual_account_id" text,
	"created_at" text DEFAULT now() NOT NULL,
	"updated_at" text DEFAULT now() NOT NULL
);
