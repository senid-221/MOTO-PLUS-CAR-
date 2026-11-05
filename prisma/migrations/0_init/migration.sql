-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'RIDER', 'MERCHANT', 'GARAGE', 'COOPERATIVE_MANAGER', 'BUSINESS_CLIENT', 'SUPPORT', 'MODERATOR', 'FINANCE', 'OPERATIONS', 'VERIFICATION_OFFICER', 'CONTENT_MANAGER', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'BLOCKED', 'DELETED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RiderStatus" AS ENUM ('OFFLINE', 'ONLINE', 'BUSY', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('RIDE', 'CARGO', 'SHOPPING', 'MONTHLY', 'BUSINESS_DELIVERY');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('REQUESTED', 'MATCHING', 'ACCEPTED', 'ARRIVING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('MTN_MOMO');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('NATIONAL_ID', 'DRIVING_LICENSE', 'MOTORCYCLE_REGISTRATION', 'INSURANCE', 'BUSINESS_LICENSE', 'OTHER');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PROCESSING', 'READY', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'OUT_OF_STOCK', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'READ');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('CREDIT', 'DEBIT', 'REFUND', 'COMMISSION', 'SETTLEMENT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('REGISTER', 'LOGIN', 'PASSWORD_RESET', 'PHONE_CHANGE');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('REQUESTED', 'PROCESSING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ComplaintCategory" AS ENUM ('BOOKING', 'DELIVERY', 'PAYMENT', 'RIDER_CONDUCT', 'MARKETPLACE', 'DOCUMENT', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT,
    "preferredLanguage" TEXT NOT NULL DEFAULT 'rw',
    "status" "AccountStatus" NOT NULL DEFAULT 'PENDING',
    "phoneVerifiedAt" TIMESTAMPTZ(6),
    "emailVerifiedAt" TIMESTAMPTZ(6),
    "suspendedAt" TIMESTAMPTZ(6),
    "suspensionReason" TEXT,
    "lastLoginAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "roles" "UserRole"[],

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpChallenge" (
    "id" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "consumedAt" TIMESTAMPTZ(6),
    "invalidatedAt" TIMESTAMPTZ(6),
    "deliveryChannel" TEXT NOT NULL DEFAULT 'sms',
    "deliveryReference" TEXT,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "deviceLabel" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "issuedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "revokedAt" TIMESTAMPTZ(6),
    "revokedReason" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "avatarUrl" TEXT,
    "defaultAddress" TEXT,
    "homeLat" DECIMAL(10,7),
    "homeLng" DECIMAL(10,7),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "CustomerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiderProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "RiderStatus" NOT NULL DEFAULT 'OFFLINE',
    "verification" "VerificationStatus" NOT NULL DEFAULT 'DRAFT',
    "profileImageUrl" TEXT,
    "licenceNumber" TEXT,
    "licenceExpiry" TIMESTAMPTZ(6),
    "nationality" TEXT,
    "district" TEXT,
    "sector" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "cooperativeId" UUID,
    "motorcycleId" UUID,
    "rating" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "completedJobs" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMPTZ(6),
    "approvedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "RiderProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Motorcycle" (
    "id" UUID NOT NULL,
    "plateNumber" TEXT NOT NULL,
    "make" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "color" TEXT,
    "motorcycleType" TEXT,
    "isElectric" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Motorcycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiderDocument" (
    "id" UUID NOT NULL,
    "riderId" UUID NOT NULL,
    "type" "DocumentType" NOT NULL,
    "fileKey" TEXT NOT NULL,
    "documentNumber" TEXT,
    "issuedAt" TIMESTAMPTZ(6),
    "expiresAt" TIMESTAMPTZ(6),
    "status" "VerificationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "reviewNote" TEXT,
    "reviewedBy" UUID,
    "reviewedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiderDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cooperative" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "registrationNo" TEXT,
    "description" TEXT,
    "district" TEXT NOT NULL,
    "sector" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "verification" "VerificationStatus" NOT NULL DEFAULT 'DRAFT',
    "verifiedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Cooperative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CooperativeMembership" (
    "id" UUID NOT NULL,
    "cooperativeId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "position" TEXT,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "requestedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMPTZ(6),
    "terminatedAt" TIMESTAMPTZ(6),

    CONSTRAINT "CooperativeMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CooperativeDocument" (
    "id" UUID NOT NULL,
    "cooperativeId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "uploadedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CooperativeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "customerId" UUID NOT NULL,
    "riderId" UUID,
    "serviceType" "ServiceType" NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'REQUESTED',
    "pickupAddress" TEXT NOT NULL,
    "pickupLat" DECIMAL(10,7) NOT NULL,
    "pickupLng" DECIMAL(10,7) NOT NULL,
    "destinationAddress" TEXT,
    "destinationLat" DECIMAL(10,7),
    "destinationLng" DECIMAL(10,7),
    "distanceKm" DECIMAL(10,2),
    "estimatedFare" DECIMAL(12,2),
    "finalFare" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "commissionRateBps" INTEGER,
    "note" TEXT,
    "passengerCount" INTEGER NOT NULL DEFAULT 1,
    "cargoCategory" TEXT,
    "cargoDescription" TEXT,
    "packageWeightKg" DECIMAL(6,2),
    "declaredValue" DECIMAL(12,2),
    "recipientName" TEXT,
    "recipientPhone" TEXT,
    "specialHandling" TEXT,
    "pickupConfirmedAt" TIMESTAMPTZ(6),
    "proofOfDeliveryKey" TEXT,
    "recipientConfirmedAt" TIMESTAMPTZ(6),
    "acceptedAt" TIMESTAMPTZ(6),
    "startedAt" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),
    "cancelledAt" TIMESTAMPTZ(6),
    "cancelledBy" TEXT,
    "cancellationReason" TEXT,
    "expiresAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingStatusEvent" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "fromStatus" "BookingStatus",
    "toStatus" "BookingStatus" NOT NULL,
    "reason" TEXT,
    "actorId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiderLocation" (
    "id" UUID NOT NULL,
    "riderId" UUID NOT NULL,
    "bookingId" UUID,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "accuracyM" DECIMAL(8,2),
    "recordedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiderLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyContract" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "customerId" UUID NOT NULL,
    "riderId" UUID NOT NULL,
    "pickupAddress" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "schedule" JSONB,
    "beneficiaries" JSONB,
    "monthlyPrice" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "startDate" TIMESTAMPTZ(6) NOT NULL,
    "endDate" TIMESTAMPTZ(6) NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'PENDING',
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "MonthlyContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "bookingId" UUID,
    "productOrderId" UUID,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'MTN_MOMO',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "providerReference" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "payerPhone" TEXT,
    "failureReason" TEXT,
    "verifiedAt" TIMESTAMPTZ(6),
    "paidAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentWebhookEvent" (
    "id" UUID NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "paymentId" UUID,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "signatureValid" BOOLEAN NOT NULL DEFAULT false,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processingError" TEXT,
    "receivedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMPTZ(6),

    CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "paymentId" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "status" "RefundStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT NOT NULL,
    "requestedBy" UUID,
    "providerReference" TEXT,
    "completedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "ownerType" TEXT NOT NULL DEFAULT 'USER',
    "balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "ownerUserId" UUID,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletEntry" (
    "id" UUID NOT NULL,
    "walletId" UUID NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "reference" TEXT NOT NULL,
    "description" TEXT,
    "relatedPaymentId" UUID,
    "relatedBookingId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingRule" (
    "id" UUID NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "zone" TEXT NOT NULL DEFAULT 'NATIONWIDE',
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "baseFare" DECIMAL(12,2) NOT NULL,
    "perKmFare" DECIMAL(12,2) NOT NULL,
    "minimumFare" DECIMAL(12,2) NOT NULL,
    "waitingRatePerMin" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "commissionRateBps" INTEGER NOT NULL DEFAULT 1500,
    "platformFeeBps" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMPTZ(6),
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PricingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceArea" (
    "id" UUID NOT NULL,
    "district" TEXT NOT NULL,
    "sector" TEXT,
    "serviceTypes" "ServiceType"[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ServiceArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "businessName" TEXT NOT NULL,
    "description" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "district" TEXT,
    "sector" TEXT,
    "address" TEXT,
    "logoKey" TEXT,
    "verification" "VerificationStatus" NOT NULL DEFAULT 'DRAFT',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "MerchantProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "stock" INTEGER NOT NULL DEFAULT 0,
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "imageKey" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "fileKey" TEXT NOT NULL,
    "altText" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductOrder" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "merchantId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "deliveryFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "commission" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ProductOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductOrderItem" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RWF',

    CONSTRAINT "ProductOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "riderId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "language" TEXT NOT NULL DEFAULT 'rw',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'rw',
    "category" TEXT,
    "metadata" JSONB,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "readAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "inApp" BOOLEAN NOT NULL DEFAULT true,
    "push" BOOLEAN NOT NULL DEFAULT true,
    "sms" BOOLEAN NOT NULL DEFAULT false,
    "email" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" UUID NOT NULL,
    "cooperativeId" UUID,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'rw',
    "kind" TEXT NOT NULL DEFAULT 'COOPERATIVE',
    "sourceOrg" TEXT,
    "sourceUrl" TEXT,
    "effectiveDate" TIMESTAMPTZ(6),
    "verifiedAt" TIMESTAMPTZ(6),
    "publishedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Complaint" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "category" "ComplaintCategory" NOT NULL,
    "status" "ComplaintStatus" NOT NULL DEFAULT 'OPEN',
    "description" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'rw',
    "reporterId" UUID NOT NULL,
    "customerId" UUID,
    "bookingId" UUID,
    "reportedRiderId" UUID,
    "resolution" TEXT,
    "resolvedBy" UUID,
    "resolvedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Complaint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_phone_status_idx" ON "User"("phone", "status");

-- CreateIndex
CREATE INDEX "OtpChallenge_phone_purpose_createdAt_idx" ON "OtpChallenge"("phone", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "OtpChallenge_expiresAt_idx" ON "OtpChallenge"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_refreshTokenHash_key" ON "Session"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_status_idx" ON "Session"("userId", "status");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "ConsentRecord_userId_idx" ON "ConsentRecord"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentRecord_userId_key_version_key" ON "ConsentRecord"("userId", "key", "version");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerProfile_userId_key" ON "CustomerProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RiderProfile_userId_key" ON "RiderProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RiderProfile_motorcycleId_key" ON "RiderProfile"("motorcycleId");

-- CreateIndex
CREATE INDEX "RiderProfile_status_verification_idx" ON "RiderProfile"("status", "verification");

-- CreateIndex
CREATE INDEX "RiderProfile_cooperativeId_idx" ON "RiderProfile"("cooperativeId");

-- CreateIndex
CREATE INDEX "RiderProfile_district_sector_idx" ON "RiderProfile"("district", "sector");

-- CreateIndex
CREATE UNIQUE INDEX "Motorcycle_plateNumber_key" ON "Motorcycle"("plateNumber");

-- CreateIndex
CREATE INDEX "RiderDocument_riderId_status_idx" ON "RiderDocument"("riderId", "status");

-- CreateIndex
CREATE INDEX "RiderDocument_expiresAt_idx" ON "RiderDocument"("expiresAt");

-- CreateIndex
CREATE INDEX "RiderDocument_status_expiresAt_idx" ON "RiderDocument"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Cooperative_registrationNo_key" ON "Cooperative"("registrationNo");

-- CreateIndex
CREATE INDEX "CooperativeMembership_userId_idx" ON "CooperativeMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CooperativeMembership_cooperativeId_userId_key" ON "CooperativeMembership"("cooperativeId", "userId");

-- CreateIndex
CREATE INDEX "CooperativeDocument_cooperativeId_status_idx" ON "CooperativeDocument"("cooperativeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_reference_key" ON "Booking"("reference");

-- CreateIndex
CREATE INDEX "Booking_status_createdAt_idx" ON "Booking"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Booking_customerId_createdAt_idx" ON "Booking"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "Booking_riderId_status_idx" ON "Booking"("riderId", "status");

-- CreateIndex
CREATE INDEX "Booking_serviceType_status_idx" ON "Booking"("serviceType", "status");

-- CreateIndex
CREATE INDEX "Booking_status_expiresAt_idx" ON "Booking"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "BookingStatusEvent_bookingId_createdAt_idx" ON "BookingStatusEvent"("bookingId", "createdAt");

-- CreateIndex
CREATE INDEX "RiderLocation_riderId_recordedAt_idx" ON "RiderLocation"("riderId", "recordedAt");

-- CreateIndex
CREATE INDEX "RiderLocation_bookingId_recordedAt_idx" ON "RiderLocation"("bookingId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyContract_reference_key" ON "MonthlyContract"("reference");

-- CreateIndex
CREATE INDEX "MonthlyContract_status_endDate_idx" ON "MonthlyContract"("status", "endDate");

-- CreateIndex
CREATE INDEX "MonthlyContract_riderId_status_idx" ON "MonthlyContract"("riderId", "status");

-- CreateIndex
CREATE INDEX "MonthlyContract_customerId_status_idx" ON "MonthlyContract"("customerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_reference_key" ON "Payment"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_bookingId_key" ON "Payment"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_productOrderId_key" ON "Payment"("productOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerReference_key" ON "Payment"("providerReference");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_paymentId_idx" ON "PaymentWebhookEvent"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_processed_receivedAt_idx" ON "PaymentWebhookEvent"("processed", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentWebhookEvent_provider_providerEventId_key" ON "PaymentWebhookEvent"("provider", "providerEventId");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_reference_key" ON "Refund"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_providerReference_key" ON "Refund"("providerReference");

-- CreateIndex
CREATE INDEX "Refund_paymentId_status_idx" ON "Refund"("paymentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_ownerId_key" ON "Wallet"("ownerId");

-- CreateIndex
CREATE INDEX "Wallet_ownerType_idx" ON "Wallet"("ownerType");

-- CreateIndex
CREATE UNIQUE INDEX "WalletEntry_reference_key" ON "WalletEntry"("reference");

-- CreateIndex
CREATE INDEX "WalletEntry_walletId_createdAt_idx" ON "WalletEntry"("walletId", "createdAt");

-- CreateIndex
CREATE INDEX "PricingRule_serviceType_active_idx" ON "PricingRule"("serviceType", "active");

-- CreateIndex
CREATE UNIQUE INDEX "PricingRule_serviceType_zone_validFrom_key" ON "PricingRule"("serviceType", "zone", "validFrom");

-- CreateIndex
CREATE INDEX "ServiceArea_active_idx" ON "ServiceArea"("active");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceArea_district_sector_key" ON "ServiceArea"("district", "sector");

-- CreateIndex
CREATE UNIQUE INDEX "MerchantProfile_userId_key" ON "MerchantProfile"("userId");

-- CreateIndex
CREATE INDEX "MerchantProfile_verification_idx" ON "MerchantProfile"("verification");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "Product_category_status_idx" ON "Product"("category", "status");

-- CreateIndex
CREATE INDEX "Product_merchantId_status_idx" ON "Product"("merchantId", "status");

-- CreateIndex
CREATE INDEX "Product_featured_status_idx" ON "Product"("featured", "status");

-- CreateIndex
CREATE INDEX "ProductImage_productId_position_idx" ON "ProductImage"("productId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ProductOrder_reference_key" ON "ProductOrder"("reference");

-- CreateIndex
CREATE INDEX "ProductOrder_customerId_createdAt_idx" ON "ProductOrder"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "ProductOrder_merchantId_status_idx" ON "ProductOrder"("merchantId", "status");

-- CreateIndex
CREATE INDEX "ProductOrderItem_orderId_idx" ON "ProductOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "Review_riderId_createdAt_idx" ON "Review"("riderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Review_bookingId_customerId_key" ON "Review"("bookingId", "customerId");

-- CreateIndex
CREATE INDEX "Notification_userId_status_createdAt_idx" ON "Notification"("userId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_category_key" ON "NotificationPreference"("userId", "category");

-- CreateIndex
CREATE INDEX "Announcement_publishedAt_idx" ON "Announcement"("publishedAt");

-- CreateIndex
CREATE INDEX "Announcement_kind_publishedAt_idx" ON "Announcement"("kind", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Complaint_reference_key" ON "Complaint"("reference");

-- CreateIndex
CREATE INDEX "Complaint_status_createdAt_idx" ON "Complaint"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Complaint_reporterId_createdAt_idx" ON "Complaint"("reporterId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerProfile" ADD CONSTRAINT "CustomerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiderProfile" ADD CONSTRAINT "RiderProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiderProfile" ADD CONSTRAINT "RiderProfile_motorcycleId_fkey" FOREIGN KEY ("motorcycleId") REFERENCES "Motorcycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiderProfile" ADD CONSTRAINT "RiderProfile_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiderDocument" ADD CONSTRAINT "RiderDocument_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "RiderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiderDocument" ADD CONSTRAINT "RiderDocument_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CooperativeMembership" ADD CONSTRAINT "CooperativeMembership_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CooperativeMembership" ADD CONSTRAINT "CooperativeMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CooperativeDocument" ADD CONSTRAINT "CooperativeDocument_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "RiderProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingStatusEvent" ADD CONSTRAINT "BookingStatusEvent_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiderLocation" ADD CONSTRAINT "RiderLocation_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "RiderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiderLocation" ADD CONSTRAINT "RiderLocation_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyContract" ADD CONSTRAINT "MonthlyContract_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyContract" ADD CONSTRAINT "MonthlyContract_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "RiderProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_productOrderId_fkey" FOREIGN KEY ("productOrderId") REFERENCES "ProductOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentWebhookEvent" ADD CONSTRAINT "PaymentWebhookEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletEntry" ADD CONSTRAINT "WalletEntry_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantProfile" ADD CONSTRAINT "MerchantProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "MerchantProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOrder" ADD CONSTRAINT "ProductOrder_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "MerchantProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOrder" ADD CONSTRAINT "ProductOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOrderItem" ADD CONSTRAINT "ProductOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ProductOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOrderItem" ADD CONSTRAINT "ProductOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "RiderProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_reportedRiderId_fkey" FOREIGN KEY ("reportedRiderId") REFERENCES "RiderProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

