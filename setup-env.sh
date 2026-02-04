#!/bin/bash

# ==============================================================================
# Spendly Production Environment Setup Script
# ==============================================================================
# This script helps you configure and validate all required environment
# variables for deploying Spendly to production.
# ==============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Spendly Production Environment Setup  ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to prompt for input with validation
prompt_required() {
    local var_name=$1
    local description=$2
    local example=$3
    local current_value="${!var_name}"

    echo -e "${YELLOW}$description${NC}"
    if [ ! -z "$example" ]; then
        echo -e "${BLUE}Example: $example${NC}"
    fi

    if [ ! -z "$current_value" ] && [ "$current_value" != "PLACEHOLDER"* ]; then
        echo -e "${GREEN}Current value: ${current_value:0:20}...${NC}"
        read -p "Keep this value? (y/n): " keep
        if [ "$keep" = "y" ] || [ "$keep" = "Y" ]; then
            return
        fi
    fi

    read -p "Enter value: " value
    while [ -z "$value" ]; do
        echo -e "${RED}This field is required!${NC}"
        read -p "Enter value: " value
    done

    export $var_name="$value"
    echo ""
}

# Function to check if variable is set
check_variable() {
    local var_name=$1
    local var_value="${!var_name}"

    if [ -z "$var_value" ] || [[ "$var_value" == *"PLACEHOLDER"* ]]; then
        echo -e "${RED}✗ $var_name${NC} - Not configured"
        return 1
    else
        echo -e "${GREEN}✓ $var_name${NC} - Configured"
        return 0
    fi
}

# Load existing .env if it exists
if [ -f .env ]; then
    echo -e "${GREEN}Loading existing .env file...${NC}"
    set -a
    source .env
    set +a
    echo ""
fi

# ==============================================================================
# CRITICAL: Database Configuration
# ==============================================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  1. Database Configuration  ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

prompt_required "DATABASE_URL" \
    "PostgreSQL Database Connection URL" \
    "postgresql://user:password@host:5432/database"

# ==============================================================================
# CRITICAL: Payment Provider Keys
# ==============================================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  2. Payment Provider Configuration  ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${YELLOW}Stripe (for US, Canada, Europe)${NC}"
prompt_required "STRIPE_SECRET_KEY" \
    "Stripe Secret Key (Live)" \
    "sk_live_..."

prompt_required "VITE_STRIPE_PUBLISHABLE_KEY" \
    "Stripe Publishable Key (Live)" \
    "pk_live_..."

echo -e "${YELLOW}Paystack (for Africa)${NC}"
prompt_required "PAYSTACK_SECRET_KEY" \
    "Paystack Secret Key (Live)" \
    "sk_live_..."

prompt_required "VITE_PAYSTACK_PUBLIC_KEY" \
    "Paystack Public Key (Live)" \
    "pk_live_..."

# ==============================================================================
# CRITICAL: Authentication Secrets
# ==============================================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  3. Authentication Configuration  ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ -z "$VITE_JWT_SECRET" ] || [[ "$VITE_JWT_SECRET" == *"PLACEHOLDER"* ]]; then
    echo -e "${YELLOW}Generating JWT Secret (32 characters)...${NC}"
    export VITE_JWT_SECRET=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
    echo -e "${GREEN}Generated: ${VITE_JWT_SECRET}${NC}"
    echo ""
fi

if [ -z "$VITE_JWT_REFRESH_SECRET" ] || [[ "$VITE_JWT_REFRESH_SECRET" == *"PLACEHOLDER"* ]]; then
    echo -e "${YELLOW}Generating JWT Refresh Secret (32 characters)...${NC}"
    export VITE_JWT_REFRESH_SECRET=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
    echo -e "${GREEN}Generated: ${VITE_JWT_REFRESH_SECRET}${NC}"
    echo ""
fi

# ==============================================================================
# CRITICAL: AWS Configuration (for Email & SMS)
# ==============================================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  4. AWS Configuration (Email & SMS)  ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

prompt_required "AWS_REGION" \
    "AWS Region" \
    "us-east-1"

prompt_required "AWS_ACCESS_KEY_ID" \
    "AWS Access Key ID" \
    "AKIAIOSFODNN7EXAMPLE"

prompt_required "AWS_SECRET_ACCESS_KEY" \
    "AWS Secret Access Key" \
    "(Hidden for security)"

prompt_required "AWS_SES_FROM_EMAIL" \
    "AWS SES From Email (must be verified in SES)" \
    "noreply@spendly.app"

# ==============================================================================
# Application Configuration
# ==============================================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  5. Application Configuration  ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

export VITE_APP_ENV=${VITE_APP_ENV:-production}
export NODE_ENV=${NODE_ENV:-production}
export VITE_API_URL=${VITE_API_URL:-https://api.spendly.app/api}
export LOG_LEVEL=${LOG_LEVEL:-info}

echo -e "${GREEN}✓ Application environment set to: $VITE_APP_ENV${NC}"
echo ""

# ==============================================================================
# Generate .env file
# ==============================================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  6. Generating .env File  ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

cat > .env << EOF
# ==============================================
# SPENDLY PRODUCTION ENVIRONMENT
# Generated on: $(date)
# ==============================================

# ==============================================
# DATABASE
# ==============================================
DATABASE_URL=$DATABASE_URL

# ==============================================
# PAYMENT GATEWAYS (LIVE KEYS)
# ==============================================
STRIPE_SECRET_KEY=$STRIPE_SECRET_KEY
VITE_STRIPE_PUBLISHABLE_KEY=$VITE_STRIPE_PUBLISHABLE_KEY
PAYSTACK_SECRET_KEY=$PAYSTACK_SECRET_KEY
VITE_PAYSTACK_PUBLIC_KEY=$VITE_PAYSTACK_PUBLIC_KEY

# ==============================================
# AUTHENTICATION
# ==============================================
VITE_JWT_SECRET=$VITE_JWT_SECRET
VITE_JWT_REFRESH_SECRET=$VITE_JWT_REFRESH_SECRET

# ==============================================
# AWS SERVICES
# ==============================================
AWS_REGION=$AWS_REGION
AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY
AWS_SES_FROM_EMAIL=$AWS_SES_FROM_EMAIL

# ==============================================
# APPLICATION
# ==============================================
VITE_APP_ENV=$VITE_APP_ENV
NODE_ENV=$NODE_ENV
VITE_API_URL=$VITE_API_URL
LOG_LEVEL=$LOG_LEVEL

# ==============================================
# OPTIONAL: Firebase (if still needed)
# ==============================================
${VITE_FIREBASE_API_KEY:+VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY}
${VITE_FIREBASE_AUTH_DOMAIN:+VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN}
${VITE_FIREBASE_PROJECT_ID:+VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID}

EOF

echo -e "${GREEN}✓ .env file created successfully!${NC}"
echo ""

# ==============================================================================
# Validation
# ==============================================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  7. Validating Configuration  ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Reload the new .env
set -a
source .env
set +a

errors=0

check_variable "DATABASE_URL" || ((errors++))
check_variable "STRIPE_SECRET_KEY" || ((errors++))
check_variable "PAYSTACK_SECRET_KEY" || ((errors++))
check_variable "VITE_JWT_SECRET" || ((errors++))
check_variable "AWS_ACCESS_KEY_ID" || ((errors++))
check_variable "AWS_SECRET_ACCESS_KEY" || ((errors++))

echo ""

if [ $errors -eq 0 ]; then
    echo -e "${GREEN}✓ All critical environment variables are configured!${NC}"
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  Next Steps:  ${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "1. Run database migrations:"
    echo "   npm run db:push"
    echo ""
    echo "2. Build the application:"
    echo "   npm run build"
    echo ""
    echo "3. Start the production server:"
    echo "   npm start"
    echo ""
    echo "4. Configure webhook URLs:"
    echo "   - Paystack: https://spendlymanager.com/api/paystack/webhook"
    echo "   - Stripe: https://spendlymanager.com/api/kyc/stripe/webhook"
    echo ""
else
    echo -e "${RED}✗ $errors critical environment variable(s) are missing!${NC}"
    echo -e "${YELLOW}Please run this script again to configure them.${NC}"
    exit 1
fi
