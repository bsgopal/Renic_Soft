import express from 'express';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import Application from '../models/Application.js';
import ApplicationSyncLog from '../models/ApplicationSyncLog.js';
import Client from '../models/Client.js';
import PlanTier from '../models/PlanTier.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

export const SYSTEM_APPLICATIONS = [
  {
    name: 'Textile & Garment POS',
    appCode: 'TEXTILE_POS',
    urlSlug: 'pos',
    category: 'Retail POS',
    defaultPort: 5174,
    description: 'Modern POS, Floor Billing, Inventory, and Supplier Order Management for Textile & Garment Showrooms',
    icon: 'Storefront',
    isSystem: true,
    githubUrl: 'https://github.com/bsgopal/TextilePOS.git',
    localRepoPath: 'D:/Development/TextilePOS',
    screens: [
      { key: 'posBilling', label: 'POS Billing Desk', defaultEnabled: true },
      { key: 'inventory', label: 'Inventory & Barcode Stock', defaultEnabled: true },
      { key: 'customerOrders', label: 'Customer Custom Orders', defaultEnabled: true },
      { key: 'customers', label: 'Customer Registry & Loyalty', defaultEnabled: true },
      { key: 'suppliers', label: 'Suppliers & Vendors', defaultEnabled: true },
      { key: 'purchaseEntry', label: 'Purchase Inward & GRN', defaultEnabled: true },
      { key: 'damageEntry', label: 'Damage & Return Entry', defaultEnabled: true },
      { key: 'salesReturn', label: 'Sales Return & Credit Notes', defaultEnabled: true },
      { key: 'floors', label: 'Floor & Rack Setup', defaultEnabled: true },
      { key: 'expenses', label: 'Store Expenses', defaultEnabled: true },
      { key: 'hsnSetup', label: 'HSN & Tax Setup', defaultEnabled: true },
      { key: 'printTemplates', label: 'Thermal & A4 Print Templates', defaultEnabled: true },
      { key: 'reports', label: 'Sales & Financial Reports', defaultEnabled: true },
      { key: 'roles', label: 'Staff Roles & Access Control', defaultEnabled: false },
      { key: 'auditLogs', label: 'Audit & Security Logs', defaultEnabled: true },
      { key: 'settings', label: 'Showroom & Store Preferences', defaultEnabled: true }
    ],
    features: [
      { key: 'thermalPrint', label: 'Direct Thermal Receipt Printing', defaultEnabled: true },
      { key: 'barcodeScanner', label: 'High-Speed Barcode Scanner', defaultEnabled: true },
      { key: 'discountOverride', label: 'Manager Discount Override', defaultEnabled: false }
    ],
    featureMappings: [
      { customDisplayName: 'POS Counter Billing Desk', folderCategory: 'Sales & Billing', technicalTarget: 'posBilling', screenPath: '/billing', description: 'Counter checkout with barcode scanning and instant bill printing', defaultEnabled: true },
      { customDisplayName: 'Inventory & Fabric Stock Ledger', folderCategory: 'Inventory Master', technicalTarget: 'inventory', screenPath: '/inventory', description: 'Track rolls, sizes, colors, and stock movements', defaultEnabled: true },
      { customDisplayName: 'Customer Custom Orders & Alterations', folderCategory: 'Sales & Billing', technicalTarget: 'customerOrders', screenPath: '/custom-orders', description: 'Tailoring, alterations, and custom garment booking', defaultEnabled: true },
      { customDisplayName: 'Customer Registry & Loyalty', folderCategory: 'CRM & Loyalty', technicalTarget: 'customers', screenPath: '/customers', description: 'Customer profiles, purchase history, and loyalty points', defaultEnabled: true },
      { customDisplayName: 'Suppliers & Vendor Master', folderCategory: 'Procurement', technicalTarget: 'suppliers', screenPath: '/suppliers', description: 'Manage fabric mills, suppliers, and vendor ledgers', defaultEnabled: true },
      { customDisplayName: 'Purchase Inward & GRN', folderCategory: 'Procurement', technicalTarget: 'purchaseEntry', screenPath: '/purchases', description: 'Goods received notes, purchase bills, and batch inward', defaultEnabled: true },
      { customDisplayName: 'Damage & Return Entry', folderCategory: 'Inventory Master', technicalTarget: 'damageEntry', screenPath: '/damage-entry', description: 'Record damaged fabric, defect log and vendor returns', defaultEnabled: true },
      { customDisplayName: 'Sales Return & Credit Notes', folderCategory: 'Sales & Billing', technicalTarget: 'salesReturn', screenPath: '/sales-return', description: 'Customer bill return and credit voucher issuance', defaultEnabled: true },
      { customDisplayName: 'Floor & Display Racks Setup', folderCategory: 'Showroom Setup', technicalTarget: 'floors', screenPath: '/floors', description: 'Map sales counters and showroom floor sections', defaultEnabled: true },
      { customDisplayName: 'Sales, GST & Profit Reports', folderCategory: 'Analytics & Audit', technicalTarget: 'reports', screenPath: '/reports', description: 'Comprehensive financial, GST, and profit audit statements', defaultEnabled: true },
      { customDisplayName: 'Store Expenses & Outflow', folderCategory: 'Accounting', technicalTarget: 'expenses', screenPath: '/expenses', description: 'Track petty cash, utilities, and daily shop expenses', defaultEnabled: true },
      { customDisplayName: 'HSN Tax & Barcode Setup', folderCategory: 'Tax & Compliance', technicalTarget: 'hsnSetup', screenPath: '/hsn-setup', description: 'Configure GST slabs, HSN codes, and barcode printer layouts', defaultEnabled: true },
      { customDisplayName: 'Thermal & A4 Print Templates', folderCategory: 'Printing', technicalTarget: 'printTemplates', screenPath: '/print-templates', description: 'Customize thermal receipt and A4 invoice layouts', defaultEnabled: true },
      { customDisplayName: 'Staff Roles & Permissions', folderCategory: 'Administration', technicalTarget: 'roles', screenPath: '/roles', description: 'Manage cashier, floor staff, and manager privileges', defaultEnabled: false },
      { customDisplayName: 'Audit & Security Logs', folderCategory: 'Administration', technicalTarget: 'auditLogs', screenPath: '/audit-logs', description: 'Track cashier actions, price overrides, and sensitive operations', defaultEnabled: true },
      { customDisplayName: 'Store Settings & Preferences', folderCategory: 'Administration', technicalTarget: 'settings', screenPath: '/settings', description: 'Shop details, invoice numbering prefix, and receipt footer', defaultEnabled: true }
    ]
  },
  {
    name: 'WhatsApp & Instagram Automation',
    appCode: 'WA_INSTA_AUTOMATION',
    urlSlug: 'wa',
    category: 'Marketing SaaS',
    defaultPort: 5173,
    description: 'Meta Cloud API, Broadcasts, Chatbot Workflows, and AI Sales Agent for High-Conversion Retail',
    icon: 'Chat',
    isSystem: true,
    githubUrl: 'https://github.com/bsgopal/WA_INSTA_AUTOMATION.git',
    localRepoPath: 'D:/Development/WhatsApp Automation/WA_INSTA_AUTOMATION',
    screens: [
      { key: 'dashboard', label: 'Overview Dashboard', defaultEnabled: true },
      { key: 'appointments', label: 'Appointment Booking Hub', defaultEnabled: true },
      { key: 'appointmentSettings', label: 'Schedule & Terminology Setup', defaultEnabled: true },
      { key: 'appointmentServices', label: 'Services Master Catalog', defaultEnabled: true },
      { key: 'appointmentStaff', label: 'Doctors & Specialists Directory', defaultEnabled: true },
      { key: 'appointmentCustomers', label: 'Patient & Client History Ledger', defaultEnabled: true },
      { key: 'conversations', label: 'Unified Inbox', defaultEnabled: true },
      { key: 'customers', label: 'Contacts & Leads', defaultEnabled: true },
      { key: 'campaigns', label: 'Bulk Broadcast Campaigns', defaultEnabled: true },
      { key: 'campaignHistory', label: 'Broadcast Delivery Analytics', defaultEnabled: true },
      { key: 'templates', label: 'WhatsApp HSM Templates', defaultEnabled: true },
      { key: 'catalog', label: 'Product Catalog', defaultEnabled: true },
      { key: 'quickReplies', label: 'Quick Replies', defaultEnabled: true },
      { key: 'workflows', label: 'Visual Workflow Builder', defaultEnabled: true },
      { key: 'responseRules', label: 'Automated Response Rules', defaultEnabled: true },
      { key: 'aiFeatures', label: 'AI Sales Assistant & Auto-Pilot', defaultEnabled: false },
      { key: 'quotations', label: 'Commercial Quotations', defaultEnabled: true },
      { key: 'analytics', label: 'Omnichannel Analytics', defaultEnabled: true },
      { key: 'settings', label: 'Account & System Settings', defaultEnabled: true }
    ],
    features: [
      { key: 'appointmentBooking', label: 'WhatsApp Appointment Booking Engine', defaultEnabled: true },
      { key: 'bulkBroadcast', label: 'Bulk Broadcast Engine', defaultEnabled: true },
      { key: 'metaCloudApi', label: 'Meta Cloud Direct Graph API', defaultEnabled: true },
      { key: 'aiAgent', label: 'Gemini AI Intelligent Responses', defaultEnabled: false }
    ],
    solutionModes: [
      {
        modeKey: 'APPOINTMENT_BOOKING',
        displayName: 'Appointment Booking Suite',
        icon: 'Calendar',
        badgeColor: '#84cc16',
        description: 'Clinics, Doctors, Salons, Spas, and Professional Consultants with interactive WhatsApp slot booking',
        defaultScreenKeys: ['dashboard', 'appointments', 'appointmentSettings', 'appointmentServices', 'appointmentStaff', 'appointmentCustomers', 'conversations', 'settings'],
        defaultFeatures: { appointmentBooking: true, autoReplies: true, bulkBroadcast: false },
        isDefault: false
      },
      {
        modeKey: 'BULK_OUTREACH',
        displayName: 'Bulk Broadcast & Campaigns',
        icon: 'Send',
        badgeColor: '#0284c7',
        description: 'Marketing teams, Showrooms, and E-commerce running high-speed targeted WhatsApp campaigns',
        defaultScreenKeys: ['dashboard', 'campaigns', 'campaignHistory', 'templates', 'customers', 'conversations', 'analytics', 'settings'],
        defaultFeatures: { bulkBroadcast: true, metaCloudApi: true, appointmentBooking: false },
        isDefault: false
      },
      {
        modeKey: 'CHATBOT_AUTOMATION',
        displayName: 'Chatbot & Workflow Automation',
        icon: 'Bot',
        badgeColor: '#8b5cf6',
        description: 'Automated support bots, visual workflow journeys, FAQ keywords, and AI Sales agents',
        defaultScreenKeys: ['dashboard', 'workflows', 'responseRules', 'aiFeatures', 'quickReplies', 'conversations', 'customers', 'settings'],
        defaultFeatures: { workflowBuilder: true, responseRules: true, aiAgent: true, appointmentBooking: false },
        isDefault: false
      },
      {
        modeKey: 'ALL_IN_ONE',
        displayName: 'All-in-One Full Suite',
        icon: 'Sparkles',
        badgeColor: '#10b981',
        description: 'Complete enterprise access across all appointment desks, bulk campaigns, bots, and AI capabilities',
        defaultScreenKeys: ['dashboard', 'appointments', 'appointmentSettings', 'appointmentServices', 'appointmentStaff', 'appointmentCustomers', 'conversations', 'customers', 'campaigns', 'campaignHistory', 'templates', 'catalog', 'quickReplies', 'workflows', 'responseRules', 'aiFeatures', 'quotations', 'analytics', 'settings'],
        defaultFeatures: { appointmentBooking: true, bulkBroadcast: true, metaCloudApi: true, workflowBuilder: true, responseRules: true, aiAgent: true },
        isDefault: true
      }
    ],
    featureMappings: [
      { customDisplayName: 'Executive Marketing Dashboard', folderCategory: 'Analytics', technicalTarget: 'dashboard', screenPath: '/dashboard', description: 'High-level metrics, campaign performance, and response rate graphs', defaultEnabled: true },
      { customDisplayName: 'Appointment Booking Hub & Calendar', folderCategory: 'Appointments', technicalTarget: 'appointments', screenPath: '/appointments', description: 'Interactive calendar, slot status manager, token lookup, and walk-in booking desk', defaultEnabled: true },
      { customDisplayName: 'Schedule & Terminology Setup', folderCategory: 'Appointments', technicalTarget: 'appointmentSettings', screenPath: '/appointment-settings', description: 'Custom terminology labels, operating hours, morning/evening shifts, and buffer intervals', defaultEnabled: true },
      { customDisplayName: 'Services Master Catalog', folderCategory: 'Appointments', technicalTarget: 'appointmentServices', screenPath: '/appointment-services', description: 'Catalog of services, prices, durations, instructions, and assigned doctor/staff mapping', defaultEnabled: true },
      { customDisplayName: 'Doctors & Specialists Directory', folderCategory: 'Appointments', technicalTarget: 'appointmentStaff', screenPath: '/appointment-staff', description: 'Staff profiles, WhatsApp alert phone numbers, and individual shift schedules', defaultEnabled: true },
      { customDisplayName: 'Patient & Client History Ledger', folderCategory: 'Appointments', technicalTarget: 'appointmentCustomers', screenPath: '/appointment-customers', description: 'Complete record of past visits, attendance rates, and direct WhatsApp chat links', defaultEnabled: true },
      { customDisplayName: 'Live Unified Customer Inbox', folderCategory: 'Omnichannel Chat', technicalTarget: 'conversations', screenPath: '/conversations', description: 'Direct 2-way chat with WhatsApp and Instagram customers', defaultEnabled: true },
      { customDisplayName: 'Customer Leads & Segmentation', folderCategory: 'CRM & Audiences', technicalTarget: 'customers', screenPath: '/customers', description: 'Contact lists, tags, and targeted broadcast audiences', defaultEnabled: true },
      { customDisplayName: 'WhatsApp Bulk Broadcast Engine', folderCategory: 'Outreach & Campaigns', technicalTarget: 'campaigns', screenPath: '/campaigns', description: 'Schedule high-speed bulk broadcasts via Meta or Docker WAHA', defaultEnabled: true },
      { customDisplayName: 'Broadcast Delivery Analytics', folderCategory: 'Outreach & Campaigns', technicalTarget: 'campaignHistory', screenPath: '/campaign-history', description: 'Delivery rates, read receipts, and campaign audit logs', defaultEnabled: true },
      { customDisplayName: 'Meta HSM Approved Templates', folderCategory: 'Templates & Content', technicalTarget: 'templates', screenPath: '/templates', description: 'Design pre-approved marketing and utility message templates', defaultEnabled: true },
      { customDisplayName: 'Interactive Product Catalog', folderCategory: 'E-Commerce', technicalTarget: 'catalog', screenPath: '/catalog', description: 'Showcase shop products directly in customer chat', defaultEnabled: true },
      { customDisplayName: 'Quick Replies & Shortcuts', folderCategory: 'Omnichannel Chat', technicalTarget: 'quickReplies', screenPath: '/quick-replies', description: 'Saved answers and rapid dispatch snippets', defaultEnabled: true },
      { customDisplayName: 'Visual Workflow Builder', folderCategory: 'Automation Bots', technicalTarget: 'workflows', screenPath: '/workflows', description: 'Drag-and-drop conversational branching and automated journeys', defaultEnabled: true },
      { customDisplayName: 'Keyword Auto-Response Rules', folderCategory: 'Automation Bots', technicalTarget: 'responseRules', screenPath: '/response-rules', description: 'Instant auto-replies triggered by customer messages', defaultEnabled: true },
      { customDisplayName: 'Gemini AI Intelligent Sales Agent', folderCategory: 'AI Capabilities', technicalTarget: 'aiFeatures', screenPath: '/ai-features', description: 'Self-learning AI sales assistant answering product queries 24/7', defaultEnabled: true },
      { customDisplayName: 'Commercial Quotations & Invoices', folderCategory: 'Sales & Billing', technicalTarget: 'quotations', screenPath: '/quotations', description: 'Generate and send PDF estimates and invoices in chat', defaultEnabled: true },
      { customDisplayName: 'Omnichannel Analytics & Reports', folderCategory: 'Analytics', technicalTarget: 'analytics', screenPath: '/analytics', description: 'Detailed message volume and customer engagement stats', defaultEnabled: true },
      { customDisplayName: 'System & Gateway Settings', folderCategory: 'Settings', technicalTarget: 'settings', screenPath: '/settings', description: 'Configure Meta credentials, Docker WAHA tokens, and webhooks', defaultEnabled: true }
    ]
  },
  {
    name: 'Delivery Challan & Dispatch Suite',
    appCode: 'DELIVERY_CHALLAN',
    urlSlug: 'challan',
    category: 'Logistics',
    defaultPort: 5176,
    description: 'B2B Packaging, Barcode Scanning, Delivery Challan Printing, and Dispatch Reconciliation',
    icon: 'LocalShipping',
    isSystem: true,
    githubUrl: 'https://github.com/bsgopal/Delivary_Challan.git',
    localRepoPath: 'D:/Development/Delivary_Challan',
    screens: [
      { key: 'dashboard', label: 'Dispatch Dashboard', defaultEnabled: true },
      { key: 'createChallan', label: 'Create Delivery Challan', defaultEnabled: true },
      { key: 'challanList', label: 'Delivery Challans History', defaultEnabled: true },
      { key: 'challanReturnTracking', label: 'Returnable Goods & Gatepass', defaultEnabled: true },
      { key: 'vendorManagement', label: 'Vendors & Transporters', defaultEnabled: true },
      { key: 'packagingCategories', label: 'Packaging Categories', defaultEnabled: true },
      { key: 'products', label: 'Item Master & Goods Catalog', defaultEnabled: true },
      { key: 'stockManagement', label: 'Stock & Inventory Ledger', defaultEnabled: true },
      { key: 'barcodeGenerator', label: 'Barcode Generation & Print', defaultEnabled: true },
      { key: 'quotations', label: 'Material Movement Quotations', defaultEnabled: true },
      { key: 'createBilling', label: 'Create GST Invoices', defaultEnabled: true },
      { key: 'billingList', label: 'Invoices & Billing History', defaultEnabled: true },
      { key: 'reports', label: 'Dispatch & Financial Reports', defaultEnabled: true },
      { key: 'settings', label: 'Tenant & PDF Preferences', defaultEnabled: true }
    ],
    features: [
      { key: 'eWayBill', label: 'E-Way Bill Integration', defaultEnabled: true },
      { key: 'batchPrint', label: 'Batch Label Printing', defaultEnabled: true }
    ],
    featureMappings: [
      { customDisplayName: 'Dispatch & Logistics Dashboard', folderCategory: 'Logistics Overview', technicalTarget: 'dashboard', screenPath: '/dashboard', description: 'Track pending dispatches, loaded trucks, and delivered goods', defaultEnabled: true },
      { customDisplayName: 'Create Delivery Challan', folderCategory: 'Challans & Dispatch', technicalTarget: 'createChallan', screenPath: '/create-challan', description: 'Generate dispatch challan with multi-item packing details', defaultEnabled: true },
      { customDisplayName: 'Delivery Challan Logs & History', folderCategory: 'Challans & Dispatch', technicalTarget: 'challanList', screenPath: '/challans', description: 'Search, filter, and reprint delivery challans and lorry receipts', defaultEnabled: true },
      { customDisplayName: 'Returnable Material & Gatepass', folderCategory: 'Challans & Dispatch', technicalTarget: 'challanReturnTracking', screenPath: '/return-tracking', description: 'Track borrowed goods, returnable containers, and gate passes', defaultEnabled: true },
      { customDisplayName: 'Vendors & Transporters Directory', folderCategory: 'CRM & Master', technicalTarget: 'vendorManagement', screenPath: '/vendors', description: 'Manage logistics carriers, client destinations, and supplier directories', defaultEnabled: true },
      { customDisplayName: 'Packaging Categories Master', folderCategory: 'Inventory Master', technicalTarget: 'packagingCategories', screenPath: '/packaging-categories', description: 'Manage carton, roll, bundle, and box classifications', defaultEnabled: true },
      { customDisplayName: 'Item Master & Goods Catalog', folderCategory: 'Inventory Master', technicalTarget: 'products', screenPath: '/products', description: 'SKU registry with HSN codes, weight metrics, and unit conversions', defaultEnabled: true },
      { customDisplayName: 'Stock & Inventory Ledger', folderCategory: 'Inventory Master', technicalTarget: 'stockManagement', screenPath: '/stock', description: 'Real-time stock balance, inward receipts, and outward delivery logs', defaultEnabled: true },
      { customDisplayName: 'Barcode Generation & Printing', folderCategory: 'Operations', technicalTarget: 'barcodeGenerator', screenPath: '/barcodes', description: 'Box and bundle barcode labels for transport scanning', defaultEnabled: true },
      { customDisplayName: 'Material Movement Quotations', folderCategory: 'Financials', technicalTarget: 'quotations', screenPath: '/quotations', description: 'Generate preliminary cost and movement proposals', defaultEnabled: true },
      { customDisplayName: 'Create GST Tax Invoice', folderCategory: 'Financials', technicalTarget: 'createBilling', screenPath: '/create-billing', description: 'Convert delivered challans into formal GST invoices', defaultEnabled: true },
      { customDisplayName: 'B2B Transport Invoices Ledger', folderCategory: 'Financials', technicalTarget: 'billingList', screenPath: '/billing', description: 'Outstanding balances, payment tracking, and ledger records', defaultEnabled: true },
      { customDisplayName: 'Dispatch, Tax & Financial Reports', folderCategory: 'Analytics', technicalTarget: 'reports', screenPath: '/reports', description: 'Movement summaries, monthly tax audit, and transport volume graphs', defaultEnabled: true },
      { customDisplayName: 'Tenant & PDF Print Preferences', folderCategory: 'Administration', technicalTarget: 'settings', screenPath: '/settings', description: 'Company GSTIN, vehicle declaration text, and thermal slip layout', defaultEnabled: true }
    ]
  },
  {
    name: 'PawnBook Pro — Pawn Broking ERP',
    appCode: 'PAWN_BROKING',
    urlSlug: 'pb',
    category: 'Gold Loan & Pawn Broking',
    defaultPort: 5177,
    description: 'Gold Valuation, Collateral Storage Vaults, Flexible Interest Slabs, RBI Loan Compliance, Auctions, and Thermal Vouchers',
    icon: 'MonetizationOn',
    isSystem: true,
    githubUrl: 'https://github.com/bsgopal/pawn_broking.git',
    localRepoPath: 'D:/Development/pawn_broking',
    screens: [
      { key: 'dashboard', label: 'Executive Pawn Dashboard', defaultEnabled: true },
      { key: 'newPawn', label: 'New Pawn & Gold Valuation', defaultEnabled: true },
      { key: 'pawnList', label: 'Loan Registry & Pawn Ledger', defaultEnabled: true },
      { key: 'repayments', label: 'Interest & Principal Collection', defaultEnabled: true },
      { key: 'redemption', label: 'Loan Redemption & Gold Release', defaultEnabled: true },
      { key: 'vaultManager', label: 'Security Vaults & Compartments', defaultEnabled: true },
      { key: 'overdueManager', label: 'Overdue Aging & Legal Notices', defaultEnabled: true },
      { key: 'auctions', label: 'Unclaimed Loan Auctions', defaultEnabled: true },
      { key: 'customers', label: 'Customer KYC & Credit Rating', defaultEnabled: true },
      { key: 'daybook', label: 'Day Book & Cash Reconcile', defaultEnabled: true },
      { key: 'dailyRates', label: 'Live Metal Market Rates', defaultEnabled: true },
      { key: 'reports', label: 'Regulatory Form A/B/C/D Registers', defaultEnabled: true },
      { key: 'printTemplates', label: 'Thermal & A4 Ticket Designer', defaultEnabled: true },
      { key: 'auditLogs', label: 'Staff Audit & Security Trail', defaultEnabled: true },
      { key: 'settings', label: 'RBI Limits & Pawn Preferences', defaultEnabled: true }
    ],
    features: [
      { key: 'quickPawn', label: '3-Minute Quick Pawn Fast Track', defaultEnabled: true },
      { key: 'webcamKyc', label: 'Live Webcam KYC & Photo Proof', defaultEnabled: true },
      { key: 'thermalVoucher', label: 'Direct Thermal Slip Printing', defaultEnabled: true },
      { key: 'rbiCompliance', label: 'Automated RBI 75% LTV Shield', defaultEnabled: true }
    ],
    featureMappings: [
      { customDisplayName: 'Executive Pawn Dashboard', folderCategory: 'Core Operations', technicalTarget: 'dashboard', screenPath: '/dashboard', description: 'Active loans, portfolio exposure, overdue interest, and vault utilization', defaultEnabled: true },
      { customDisplayName: 'New Pawn & Gold Valuation Desk', folderCategory: 'Pledge Desk', technicalTarget: 'newPawn', screenPath: '/new-pawn', description: 'Multi-metal valuation, carat purity calculator, 75% LTV, packet tagging, and receipt generation', defaultEnabled: true },
      { customDisplayName: 'Loan Registry & Pawn Ledger', folderCategory: 'Pledge Desk', technicalTarget: 'pawnList', screenPath: '/pawn-list', description: 'Searchable ledger with status filters, barcode scanner search, and loan renewals', defaultEnabled: true },
      { customDisplayName: 'Interest & Principal Repayments', folderCategory: 'Collections', technicalTarget: 'repayments', screenPath: '/repayments', description: 'Flexible interest collection (Flat/Compound/Reducing), penalty waivers, and partial principal repayment', defaultEnabled: true },
      { customDisplayName: 'Loan Redemption & Collateral Release', folderCategory: 'Collections', technicalTarget: 'redemption', screenPath: '/redemption', description: 'Full loan settlement, digital signature, and safe ornament handover', defaultEnabled: true },
      { customDisplayName: 'Security Vaults & Compartment Map', folderCategory: 'Vault & Inventory', technicalTarget: 'vaultManager', screenPath: '/vaults', description: 'Physical locker capacity, shelf allocation, and safety pouch barcode tracking', defaultEnabled: true },
      { customDisplayName: 'Overdue Aging & Legal Notices', folderCategory: 'Recovery & Legal', technicalTarget: 'overdueManager', screenPath: '/overdue', description: 'Overdue loan aging buckets, Form 1 & Form 2 legal notice generation, and WhatsApp alerts', defaultEnabled: true },
      { customDisplayName: 'Unclaimed Collateral Auctions', folderCategory: 'Recovery & Legal', technicalTarget: 'auctions', screenPath: '/auctions', description: 'Statutory public auction listing, bidder registration, lotting, and final recovery closure', defaultEnabled: true },
      { customDisplayName: 'Customer KYC & Credit Directory', folderCategory: 'CRM & KYC', technicalTarget: 'customers', screenPath: '/customers', description: 'Aadhaar, PAN, voter ID verification, webcam photo, active loan exposure, and credit rating', defaultEnabled: true },
      { customDisplayName: 'Day Book & Counter Reconciliation', folderCategory: 'Financials', technicalTarget: 'daybook', screenPath: '/daybook', description: 'Daily cash in hand, bank deposits, interest collected, and principal disbursed tally', defaultEnabled: true },
      { customDisplayName: 'Live Metal Market Rates', folderCategory: 'Valuation Master', technicalTarget: 'dailyRates', screenPath: '/daily-rates', description: 'Daily 22K/24K Gold, Silver, and Platinum rate updates with trend analysis', defaultEnabled: true },
      { customDisplayName: 'Pawn Brokers Act Compliance Reports', folderCategory: 'Analytics & Audit', technicalTarget: 'reports', screenPath: '/reports', description: 'Statutory Form A/B/C/D registers, interest income report, and loan portfolio health', defaultEnabled: true },
      { customDisplayName: 'Staff Activity & Security Audit', folderCategory: 'Administration', technicalTarget: 'auditLogs', screenPath: '/audit-logs', description: 'Complete audit trail of all loan disbursements, rate overrides, and vault movements', defaultEnabled: true }
    ]
  },
  {
    name: 'Simple Retail & Petti Shop Billing',

    appCode: 'SIMPLE_BILLING',
    urlSlug: 'billing',
    category: 'Retail POS',
    defaultPort: 5178,
    description: 'Fast Billing (<10s), Barcode & Quick Items, Weight Calculator, Udhar Credit Ledger, Stock Adjustment, and Day Close for Petti Shops & General Stores',
    icon: 'ShoppingCart',
    isSystem: true,
    localRepoPath: 'D:/Development/Simple_Billing',
    screens: [
      { key: 'billingDesk', label: 'Fast Billing Desk', defaultEnabled: true },
      { key: 'billsList', label: 'Sales Bills History', defaultEnabled: true },
      { key: 'items', label: 'Items & Price Master', defaultEnabled: true },
      { key: 'stock', label: 'Stock & Adjustments', defaultEnabled: true },
      { key: 'customers', label: 'Customers & Udhar Credit', defaultEnabled: true },
      { key: 'suppliers', label: 'Suppliers & Vendors', defaultEnabled: true },
      { key: 'purchases', label: 'Purchase Inward', defaultEnabled: true },
      { key: 'expenses', label: 'Daily Expenses', defaultEnabled: true },
      { key: 'reports', label: 'Sales & Profit Reports', defaultEnabled: true },
      { key: 'dayClose', label: 'Day Close Cash Tally', defaultEnabled: true },
      { key: 'settings', label: 'Printer & Shop Settings', defaultEnabled: true }
    ],
    features: [
      { key: 'quickItems', label: 'Quick Item Touch Buttons', defaultEnabled: true },
      { key: 'weightBilling', label: 'Weight & Price Based Calculation', defaultEnabled: true },
      { key: 'thermalReceipt', label: '58mm/80mm Direct Thermal Slip', defaultEnabled: true },
      { key: 'udharLedger', label: 'Credit (Udhar) WhatsApp Statement', defaultEnabled: true }
    ],
    featureMappings: [
      { customDisplayName: 'Counter Fast Billing Desk', folderCategory: 'Sales & Billing', technicalTarget: 'billingDesk', screenPath: '/billing', description: 'Under 10s counter checkout with barcode, quick items, and mixed payments', defaultEnabled: true },
      { customDisplayName: 'Sales Bills & Returns History', folderCategory: 'Sales & Billing', technicalTarget: 'billsList', screenPath: '/bills', description: 'Bill search, reprint duplicate copy, cancel bill, and returns', defaultEnabled: true },
      { customDisplayName: 'Items, Units & Pricing Master', folderCategory: 'Inventory Master', technicalTarget: 'items', screenPath: '/items', description: 'Manage items, weight/count units, categories, and selling prices', defaultEnabled: true },
      { customDisplayName: 'Stock Ledger & Damage Adjustments', folderCategory: 'Inventory Master', technicalTarget: 'stock', screenPath: '/stock', description: 'Track stock balances, low-stock alerts, and spoil/damage adjustments', defaultEnabled: true },
      { customDisplayName: 'Customers & Udhar Credit Ledger', folderCategory: 'Credit & CRM', technicalTarget: 'customers', screenPath: '/customers', description: 'Credit balances, debit/credit ledger, payment receipts, and WhatsApp reminders', defaultEnabled: true },
      { customDisplayName: 'Suppliers & Vendor Master', folderCategory: 'Procurement', technicalTarget: 'suppliers', screenPath: '/suppliers', description: 'Manage wholesale suppliers, purchase bills, and vendor payables', defaultEnabled: true },
      { customDisplayName: 'Purchase Entry & Stock Inward', folderCategory: 'Procurement', technicalTarget: 'purchases', screenPath: '/purchases', description: 'Record goods inward from wholesalers with automatic stock updates', defaultEnabled: true },
      { customDisplayName: 'Daily Shop Petty Expenses', folderCategory: 'Accounting', technicalTarget: 'expenses', screenPath: '/expenses', description: 'Track tea, transport, rent, electricity, and daily cash outflow', defaultEnabled: true },
      { customDisplayName: 'Sales, Profit & GST Reports', folderCategory: 'Analytics', technicalTarget: 'reports', screenPath: '/reports', description: 'Daily sales, item-wise breakdown, net profit & loss, and GST summary', defaultEnabled: true },
      { customDisplayName: 'Day Close Drawer Cash Reconciliation', folderCategory: 'Counter Close', technicalTarget: 'dayClose', screenPath: '/day-close', description: 'End-of-day expected vs counted cash tally, difference note, and closing slip', defaultEnabled: true },
      { customDisplayName: 'Bill Format & Thermal Printer Setup', folderCategory: 'Administration', technicalTarget: 'settings', screenPath: '/settings', description: '58mm/80mm thermal printer, header text, round-off, and negative stock rules', defaultEnabled: true }
    ]
  },
  {
    name: 'Renic Soft Master HQ',
    appCode: 'RENIC_SOFT',
    urlSlug: 'hq',
    category: 'Enterprise ERP',
    defaultPort: 5050,
    // The operator console is never offered as a customer product.
    assignable: false,
    description: 'Master PaaS HQ, Multi-Tenant Fleet Control, Plan Permissions, Invoicing & OAuth Security Gateway',
    icon: 'Layers',
    isSystem: true,
    githubUrl: 'https://github.com/bsgopal/Renic_Soft.git',
    localRepoPath: 'D:/Development/Renic_Soft',
    screens: [
      { key: 'dashboard', label: 'Master HQ Multi-Tenant Dashboard', defaultEnabled: true },
      { key: 'applications', label: 'Application Hub & Repositories', defaultEnabled: true },
      { key: 'licenses', label: 'Tenant Licenses & Fleet Control', defaultEnabled: true },
      { key: 'planTiers', label: 'Plan Tiers & Screen Permissions', defaultEnabled: true },
      { key: 'billing', label: 'Master Invoices & Subscriptions', defaultEnabled: true },
      { key: 'quotes', label: 'Commercial Proposal Generator', defaultEnabled: true },
      { key: 'apiCredentialsHub', label: 'API Credentials & OAuth Gateway', defaultEnabled: true },
      { key: 'networkManager', label: 'Network & Domain Forwarding', defaultEnabled: true },
      { key: 'notifications', label: 'System Notification Dispatcher', defaultEnabled: true },
      { key: 'reports', label: 'Global Tenant Analytics & Telemetry', defaultEnabled: true },
      { key: 'settings', label: 'Master HQ System Settings', defaultEnabled: true }
    ],
    features: [
      { key: 'fleetControl', label: 'Multi-Tenant Fleet Control', defaultEnabled: true },
      { key: 'oauthGateway', label: 'OAuth 2.0 Security Gateway', defaultEnabled: true }
    ],
    featureMappings: [
      { customDisplayName: 'Master HQ Overview Dashboard', folderCategory: 'Core', technicalTarget: 'dashboard', screenPath: '/dashboard', description: 'Global tenant metrics, revenue stats, and system health telemetry', defaultEnabled: true },
      { customDisplayName: 'Application Hub & PaaS Repositories', folderCategory: 'PaaS', technicalTarget: 'applications', screenPath: '/applications', description: 'Manage connected software products, local git repos, and dynamic modules', defaultEnabled: true },
      { customDisplayName: 'Tenant Licenses & Fleet Control', folderCategory: 'Fleet', technicalTarget: 'licenses', screenPath: '/licenses', description: 'Provision customer instances, manage URLs, and push OTA updates', defaultEnabled: true },
      { customDisplayName: 'Plan Tiers & Screen Permissions', folderCategory: 'SaaS', technicalTarget: 'planTiers', screenPath: '/plan-tiers', description: 'Create subscription plans, assign allowed screens, and set quotas', defaultEnabled: true },
      { customDisplayName: 'Master Invoices & Subscriptions', folderCategory: 'Billing', technicalTarget: 'billing', screenPath: '/billing', description: 'Master billing ledger, client payments, and renewal invoices', defaultEnabled: true },
      { customDisplayName: 'Commercial Proposals & Quotations', folderCategory: 'Sales', technicalTarget: 'quotes', screenPath: '/quotes', description: 'Generate enterprise proposals and quotation estimates', defaultEnabled: true },
      { customDisplayName: 'API Credentials & OAuth Gateway', folderCategory: 'Security', technicalTarget: 'apiCredentialsHub', screenPath: '/credentials', description: 'Issue OAuth client IDs, secrets, and monitor unauthorized auth attempts', defaultEnabled: true },
      { customDisplayName: 'Network & Domain Forwarding', folderCategory: 'Infrastructure', technicalTarget: 'networkManager', screenPath: '/network', description: 'Router port forwarding, target IP routes, and domain management', defaultEnabled: true },
      { customDisplayName: 'System Notifications & Audit', folderCategory: 'Communications', technicalTarget: 'notifications', screenPath: '/notifications', description: 'System alerts, critical security notices, and dispatch logs', defaultEnabled: true },
      { customDisplayName: 'Global Tenant Analytics & Telemetry', folderCategory: 'Analytics', technicalTarget: 'reports', screenPath: '/reports', description: 'Audit trails, activity logs, and customer utilization reports', defaultEnabled: true },
      { customDisplayName: 'Master HQ System Settings', folderCategory: 'System', technicalTarget: 'settings', screenPath: '/settings', description: 'Platform branding, admin credentials, and database settings', defaultEnabled: true }
    ]
  }
];

const seedSystemApplications = async () => {
  for (const appData of SYSTEM_APPLICATIONS) {
    const existing = await Application.findOne({ appCode: appData.appCode });
    if (!existing) {
      await Application.create(appData);
    } else {
      const updates = {};
      if (existing.assignable === undefined) updates.assignable = appData.assignable !== false;
      if (!existing.solutionModes || existing.solutionModes.length === 0) updates.solutionModes = appData.solutionModes || [];
      if (!existing.featureMappings || existing.featureMappings.length === 0) updates.featureMappings = appData.featureMappings || [];
      if (!existing.screens || existing.screens.length === 0) updates.screens = appData.screens || [];
      if (!existing.features || existing.features.length === 0) updates.features = appData.features || [];

      if (Object.keys(updates).length > 0) {
        await Application.updateOne({ appCode: appData.appCode }, { $set: updates });
      }
    }
  }
};

router.get('/', async (req, res) => {
  try {
    await seedSystemApplications();
    const apps = await Application.find().sort({ isSystem: -1, createdAt: 1 });
    res.json({ success: true, count: apps.length, applications: apps });
  } catch (error) {
    console.error('Error fetching applications:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve applications', error: error.message });
  }
});

router.get('/sync-history', protect, authorize('admin', 'platform_owner'), async (req, res) => {
  try {
    const { appCode, limit = 50 } = req.query;
    const filter = {};
    if (appCode && appCode !== 'ALL') {
      filter.appCode = appCode.toUpperCase();
    }

    const history = await ApplicationSyncLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    res.json({ success: true, count: history.length, history });
  } catch (error) {
    console.error('Error retrieving sync history:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:idOrCode/sync-history', protect, authorize('admin', 'platform_owner'), async (req, res) => {
  try {
    const { idOrCode } = req.params;
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(idOrCode);
    const app = isObjectId 
      ? await Application.findById(idOrCode)
      : await Application.findOne({ appCode: idOrCode.toUpperCase() });

    if (!app) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    const history = await ApplicationSyncLog.find({ appCode: app.appCode })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ success: true, appCode: app.appCode, appName: app.name, history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/ai-extract', protect, authorize('admin', 'platform_owner'), async (req, res) => {
  try {
    const { repoPath, appCode } = req.body;
    const targetDir = repoPath || (appCode === 'TEXTILE_POS' ? 'D:/Development/TextilePOS' : 'd:/Development/WhatsApp Automation/WA_INSTA_AUTOMATION');

    const discoveredScreens = [];
    const featureMappings = [];

    const candidates = [
      path.join(targetDir, 'frontend', 'src', 'pages'),
      path.join(targetDir, 'src', 'pages'),
      path.join(targetDir, 'pages')
    ];

    let pagesDir = candidates.find(p => fs.existsSync(p));

    if (pagesDir) {
      const files = fs.readdirSync(pagesDir, { withFileTypes: true });
      for (const f of files) {
        if (f.isFile() && (f.name.endsWith('.jsx') || f.name.endsWith('.tsx') || f.name.endsWith('.js'))) {
          const rawName = f.name.replace(/\.[^/.]+$/, '');
          const cleanKey = rawName.charAt(0).toLowerCase() + rawName.slice(1);
          const screenPath = '/' + rawName.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
          const spacedName = rawName.replace(/([A-Z])/g, ' $1').trim();
          let folderCategory = 'General Operations';

          if (/billing|pos|invoice|order|sales|counter/i.test(rawName)) {
            folderCategory = 'Sales & Billing';
          } else if (/inventory|stock|product|catalog|item/i.test(rawName)) {
            folderCategory = 'Inventory & Goods';
          } else if (/campaign|message|chat|template|whatsapp|broadcast/i.test(rawName)) {
            folderCategory = 'Outreach & Messaging';
          } else if (/report|analytics|stat|audit/i.test(rawName)) {
            folderCategory = 'Analytics & Audit';
          } else if (/customer|supplier|vendor|contact/i.test(rawName)) {
            folderCategory = 'CRM & Relationships';
          } else if (/setting|config|security|auth|network/i.test(rawName)) {
            folderCategory = 'System & Governance';
          }

          discoveredScreens.push({
            key: cleanKey,
            label: spacedName,
            defaultEnabled: true
          });

          featureMappings.push({
            customDisplayName: spacedName + ' Hub',
            folderCategory,
            technicalTarget: cleanKey,
            screenPath,
            description: 'Full access to ' + spacedName + ' module and related operations',
            defaultEnabled: true
          });
        }
      }
    }

    res.json({
      success: true,
      repoPath: targetDir,
      discoveredCount: featureMappings.length,
      screens: discoveredScreens,
      featureMappings
    });
  } catch (error) {
    console.error('AI Extract error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:id/git-sync', protect, authorize('admin', 'platform_owner'), async (req, res) => {
  const startTime = Date.now();
  try {
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(req.params.id);
    const app = isObjectId ? await Application.findById(req.params.id) : await Application.findOne({ appCode: req.params.id.toUpperCase() });
    if (!app) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    const localPath = app.localRepoPath || (app.appCode === 'TEXTILE_POS' ? 'D:/Development/TextilePOS' : 'd:/Development/WhatsApp Automation/WA_INSTA_AUTOMATION');

    let commitHash = 'manual-' + Math.random().toString(36).substring(2, 9);
    let commitMessage = 'Application features synchronized with platform catalog';
    let commitAuthor = req.user?.name || 'Platform Admin';
    let commitDate = new Date();

    if (fs.existsSync(localPath)) {
      try {
        const gitInfo = execSync('git log -1 --pretty=format:"%h||%an||%ad||%s"', { cwd: localPath, encoding: 'utf8', timeout: 5000 });
        const parts = gitInfo.split('||');
        if (parts.length >= 4) {
          commitHash = parts[0].trim();
          commitAuthor = parts[1].trim();
          commitDate = new Date(parts[2].trim());
          commitMessage = parts[3].trim();
        }
      } catch (gitErr) {
        // Git command skipped or not a repo
      }
    }

    const durationMs = Date.now() - startTime;

    const syncLog = await ApplicationSyncLog.create({
      applicationId: app._id,
      appCode: app.appCode,
      appName: app.name,
      commitHash,
      commitMessage,
      commitAuthor,
      commitDate,
      triggerType: 'MANUAL',
      status: 'SUCCESS',
      durationMs,
      newRoutesFound: []
    });

    app.lastCommitHash = commitHash;
    app.lastCommitMessage = commitMessage;
    app.lastCommitAuthor = commitAuthor;
    app.lastSyncedAt = new Date();
    await app.save();

    res.json({
      success: true,
      message: 'Successfully synchronized ' + app.name + ' with latest commit [' + commitHash + '] (0s downtime)',
      syncLog,
      application: app
    });
  } catch (error) {
    console.error('Git sync error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/github-webhook', async (req, res) => {
  try {
    const payload = req.body;
    const repoName = payload.repository?.name || '';
    const commit = payload.head_commit || (payload.commits && payload.commits[0]) || {};

    const commitHash = (commit.id || '').substring(0, 7) || 'webhook';
    const commitMessage = commit.message || 'Auto-deployed via GitHub Push Webhook';
    const commitAuthor = commit.author?.name || 'GitHub CI';

    const app = await Application.findOne({
      $or: [
        { githubUrl: new RegExp(repoName, 'i') },
        { appCode: new RegExp(repoName, 'i') }
      ]
    });

    if (app) {
      await ApplicationSyncLog.create({
        applicationId: app._id,
        appCode: app.appCode,
        appName: app.name,
        commitHash,
        commitMessage,
        commitAuthor,
        commitDate: new Date(),
        triggerType: 'WEBHOOK',
        status: 'SUCCESS',
        durationMs: 150
      });

      app.lastCommitHash = commitHash;
      app.lastCommitMessage = commitMessage;
      app.lastCommitAuthor = commitAuthor;
      app.lastSyncedAt = new Date();
      await app.save();
    }

    res.json({ success: true, message: 'Webhook processed successfully' });
  } catch (error) {
    console.error('GitHub Webhook error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id/feature-mappings', protect, authorize('admin', 'platform_owner'), async (req, res) => {
  try {
    const { urlSlug, featureMappings } = req.body;
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(req.params.id);
    const app = isObjectId ? await Application.findById(req.params.id) : await Application.findOne({ appCode: req.params.id.toUpperCase() });
    if (!app) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    if (urlSlug) {
      app.urlSlug = urlSlug.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    }
    if (Array.isArray(featureMappings)) {
      app.featureMappings = featureMappings;
    }

    await app.save();
    res.json({ success: true, message: 'Feature mappings saved successfully', application: app });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:idOrCode', async (req, res) => {
  try {
    const { idOrCode } = req.params;
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(idOrCode);
    const app = isObjectId 
      ? await Application.findById(idOrCode)
      : await Application.findOne({ appCode: idOrCode.toUpperCase() });

    if (!app) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }
    res.json({ success: true, application: app });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', protect, authorize('admin', 'platform_owner'), async (req, res) => {
  try {
    const { name, appCode, urlSlug, category, defaultPort, description, icon, githubUrl, frontendUrl, productionFrontendUrl, screens = [], features = [], featureMappings = [] } = req.body;

    if (!name || !appCode || !defaultPort) {
      return res.status(400).json({ success: false, message: 'App Name, App Code, and Default Port are required' });
    }

    const cleanCode = appCode.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
    const cleanSlug = (urlSlug || cleanCode).toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const cleanFrontendUrl = (frontendUrl || productionFrontendUrl || '').trim();

    const existing = await Application.findOne({ appCode: cleanCode });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Application with code ' + cleanCode + ' already exists' });
    }

    const newApp = await Application.create({
      name: name.trim(),
      appCode: cleanCode,
      urlSlug: cleanSlug,
      category: category || 'General',
      defaultPort: Number(defaultPort),
      description: description || '',
      icon: icon || 'Layers',
      githubUrl: githubUrl || '',
      frontendUrl: cleanFrontendUrl,
      productionFrontendUrl: cleanFrontendUrl,
      screens,
      features,
      featureMappings,
      isSystem: false
    });

    res.status(201).json({
      success: true,
      message: 'Application ' + newApp.name + ' registered successfully',
      application: newApp
    });
  } catch (error) {
    console.error('Error creating application:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', protect, authorize('admin', 'platform_owner'), async (req, res) => {
  try {
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(req.params.id);
    const app = isObjectId ? await Application.findById(req.params.id) : await Application.findOne({ appCode: req.params.id.toUpperCase() });
    if (!app) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    const { name, appCode, urlSlug, category, defaultPort, description, icon, githubUrl, frontendUrl, productionFrontendUrl, localRepoPath, screens, features, featureMappings, solutionModes } = req.body;

    if (appCode) {
      const cleanCode = appCode.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
      if (cleanCode && cleanCode !== app.appCode) {
        const existing = await Application.findOne({ appCode: cleanCode, _id: { $ne: app._id } });
        if (existing) {
          return res.status(400).json({ success: false, message: `Application code '${cleanCode}' is already in use by another application` });
        }
        const oldCode = app.appCode;
        app.appCode = cleanCode;

        // Cascade update references
        try {
          await Client.updateMany({ softwareProduct: oldCode }, { $set: { softwareProduct: cleanCode } });
          await PlanTier.updateMany({ appCode: oldCode }, { $set: { appCode: cleanCode } });
          await ApplicationSyncLog.updateMany({ appCode: oldCode }, { $set: { appCode: cleanCode } });
        } catch (cascadeErr) {
          console.warn('Cascade update warning:', cascadeErr.message);
        }
      }
    }

    if (name) app.name = name.trim();
    if (urlSlug) app.urlSlug = urlSlug.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (category) app.category = category;
    if (defaultPort) app.defaultPort = Number(defaultPort);
    if (description !== undefined) app.description = description;
    if (icon) app.icon = icon;
    if (githubUrl !== undefined) app.githubUrl = githubUrl;
    if (frontendUrl !== undefined || productionFrontendUrl !== undefined) {
      const fUrl = (frontendUrl !== undefined ? frontendUrl : productionFrontendUrl || '').trim();
      app.frontendUrl = fUrl;
      app.productionFrontendUrl = fUrl;
    }
    if (localRepoPath !== undefined) app.localRepoPath = localRepoPath;
    if (screens) app.screens = screens;
    if (features) app.features = features;
    if (featureMappings) app.featureMappings = featureMappings;
    if (Array.isArray(solutionModes)) app.solutionModes = solutionModes;

    await app.save();

    res.json({
      success: true,
      message: 'Application ' + app.name + ' updated successfully',
      application: app
    });
  } catch (error) {
    console.error('Error updating application:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Update all Solution Modes for an application
// @route   PUT /api/applications/:id/solution-modes
// @access  Private (Admin)
router.put('/:id/solution-modes', protect, authorize('admin', 'platform_owner'), async (req, res) => {
  try {
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(req.params.id);
    const app = isObjectId ? await Application.findById(req.params.id) : await Application.findOne({ appCode: req.params.id.toUpperCase() });
    if (!app) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    const { solutionModes } = req.body;
    if (!Array.isArray(solutionModes)) {
      return res.status(400).json({ success: false, message: 'solutionModes must be an array' });
    }

    app.solutionModes = solutionModes;
    await app.save();

    res.json({
      success: true,
      message: 'Solution modes updated successfully',
      solutionModes: app.solutionModes,
      application: app
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Add single Solution Mode to an application
// @route   POST /api/applications/:id/solution-modes
// @access  Private (Admin)
router.post('/:id/solution-modes', protect, authorize('admin', 'platform_owner'), async (req, res) => {
  try {
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(req.params.id);
    const app = isObjectId ? await Application.findById(req.params.id) : await Application.findOne({ appCode: req.params.id.toUpperCase() });
    if (!app) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    const { modeKey, displayName, icon, badgeColor, description, defaultScreenKeys, defaultFeatures, isDefault } = req.body;
    if (!modeKey || !displayName) {
      return res.status(400).json({ success: false, message: 'Mode Key and Display Name are required' });
    }

    const cleanKey = modeKey.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
    if (app.solutionModes && app.solutionModes.some(m => m.modeKey === cleanKey)) {
      return res.status(400).json({ success: false, message: `Solution mode '${cleanKey}' already exists for this app` });
    }

    app.solutionModes.push({
      modeKey: cleanKey,
      displayName: displayName.trim(),
      icon: icon || 'Layers',
      badgeColor: badgeColor || '#84cc16',
      description: description || '',
      defaultScreenKeys: Array.isArray(defaultScreenKeys) ? defaultScreenKeys : [],
      defaultFeatures: defaultFeatures || {},
      isDefault: Boolean(isDefault)
    });

    await app.save();

    res.status(201).json({
      success: true,
      message: `Solution mode '${displayName}' added successfully`,
      solutionModes: app.solutionModes,
      application: app
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Delete single Solution Mode
// @route   DELETE /api/applications/:id/solution-modes/:modeKey
// @access  Private (Admin)
router.delete('/:id/solution-modes/:modeKey', protect, authorize('admin', 'platform_owner'), async (req, res) => {
  try {
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(req.params.id);
    const app = isObjectId ? await Application.findById(req.params.id) : await Application.findOne({ appCode: req.params.id.toUpperCase() });
    if (!app) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    const { modeKey } = req.params;
    app.solutionModes = app.solutionModes.filter(m => m.modeKey !== modeKey && String(m._id) !== modeKey);
    await app.save();

    res.json({
      success: true,
      message: 'Solution mode removed successfully',
      solutionModes: app.solutionModes,
      application: app
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Add Business Type to a Solution Mode
// @route   POST /api/applications/:id/solution-modes/:modeKey/business-types
// @access  Private (Admin)
router.post('/:id/solution-modes/:modeKey/business-types', protect, authorize('admin', 'platform_owner'), async (req, res) => {
  try {
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(req.params.id);
    const app = isObjectId ? await Application.findById(req.params.id) : await Application.findOne({ appCode: req.params.id.toUpperCase() });
    if (!app) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    const { modeKey } = req.params;
    const mode = app.solutionModes.find(m => m.modeKey === modeKey || String(m._id) === modeKey);
    if (!mode) {
      return res.status(404).json({ success: false, message: 'Solution mode not found' });
    }

    const {
      typeKey, displayName, icon, badgeColor, description,
      staffLabel, staffPluralLabel, serviceLabel, servicePluralLabel,
      clientLabel, clientPluralLabel, bookingActionLabel,
      addServiceBtnText, addStaffBtnText, defaultSlotDuration, defaultBookingBuffer,
      isDefault
    } = req.body;

    if (!typeKey || !displayName) {
      return res.status(400).json({ success: false, message: 'Business Type Key and Display Name are required' });
    }

    const cleanKey = typeKey.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
    mode.businessTypes = mode.businessTypes || [];
    if (mode.businessTypes.some(bt => bt.typeKey === cleanKey)) {
      return res.status(400).json({ success: false, message: `Business type '${cleanKey}' already exists in this mode` });
    }

    mode.businessTypes.push({
      typeKey: cleanKey,
      displayName: displayName.trim(),
      icon: icon || 'Building',
      badgeColor: badgeColor || '#3b82f6',
      description: description || '',
      staffLabel: staffLabel || 'Staff',
      staffPluralLabel: staffPluralLabel || 'Staff Members',
      serviceLabel: serviceLabel || 'Service',
      servicePluralLabel: servicePluralLabel || 'Services',
      clientLabel: clientLabel || 'Customer',
      clientPluralLabel: clientPluralLabel || 'Customers',
      bookingActionLabel: bookingActionLabel || 'Book Appointment',
      addServiceBtnText: addServiceBtnText || 'Add Service',
      addStaffBtnText: addStaffBtnText || 'Add Staff',
      defaultSlotDuration: Number(defaultSlotDuration) || 30,
      defaultBookingBuffer: Number(defaultBookingBuffer) || 0,
      isDefault: Boolean(isDefault)
    });

    await app.save();

    res.status(201).json({
      success: true,
      message: `Business Type '${displayName}' added to mode '${mode.displayName}'`,
      solutionModes: app.solutionModes,
      businessTypes: mode.businessTypes,
      application: app
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Update Business Type in a Solution Mode
// @route   PUT /api/applications/:id/solution-modes/:modeKey/business-types/:typeKey
// @access  Private (Admin)
router.put('/:id/solution-modes/:modeKey/business-types/:typeKey', protect, authorize('admin', 'platform_owner'), async (req, res) => {
  try {
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(req.params.id);
    const app = isObjectId ? await Application.findById(req.params.id) : await Application.findOne({ appCode: req.params.id.toUpperCase() });
    if (!app) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    const { modeKey, typeKey } = req.params;
    const mode = app.solutionModes.find(m => m.modeKey === modeKey || String(m._id) === modeKey);
    if (!mode) {
      return res.status(404).json({ success: false, message: 'Solution mode not found' });
    }

    mode.businessTypes = mode.businessTypes || [];
    const bt = mode.businessTypes.find(b => b.typeKey === typeKey || String(b._id) === typeKey);
    if (!bt) {
      return res.status(404).json({ success: false, message: 'Business type not found' });
    }

    const updates = req.body;
    if (updates.displayName) bt.displayName = updates.displayName.trim();
    if (updates.icon) bt.icon = updates.icon;
    if (updates.badgeColor) bt.badgeColor = updates.badgeColor;
    if (updates.description !== undefined) bt.description = updates.description;
    if (updates.staffLabel) bt.staffLabel = updates.staffLabel.trim();
    if (updates.staffPluralLabel) bt.staffPluralLabel = updates.staffPluralLabel.trim();
    if (updates.serviceLabel) bt.serviceLabel = updates.serviceLabel.trim();
    if (updates.servicePluralLabel) bt.servicePluralLabel = updates.servicePluralLabel.trim();
    if (updates.clientLabel) bt.clientLabel = updates.clientLabel.trim();
    if (updates.clientPluralLabel) bt.clientPluralLabel = updates.clientPluralLabel.trim();
    if (updates.bookingActionLabel) bt.bookingActionLabel = updates.bookingActionLabel.trim();
    if (updates.addServiceBtnText) bt.addServiceBtnText = updates.addServiceBtnText.trim();
    if (updates.addStaffBtnText) bt.addStaffBtnText = updates.addStaffBtnText.trim();
    if (updates.defaultSlotDuration !== undefined) bt.defaultSlotDuration = Number(updates.defaultSlotDuration) || 30;
    if (updates.defaultBookingBuffer !== undefined) bt.defaultBookingBuffer = Number(updates.defaultBookingBuffer) || 0;
    if (updates.isDefault !== undefined) bt.isDefault = Boolean(updates.isDefault);

    await app.save();

    res.json({
      success: true,
      message: `Business Type '${bt.displayName}' updated successfully`,
      solutionModes: app.solutionModes,
      businessTypes: mode.businessTypes,
      application: app
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Delete Business Type from a Solution Mode
// @route   DELETE /api/applications/:id/solution-modes/:modeKey/business-types/:typeKey
// @access  Private (Admin)
router.delete('/:id/solution-modes/:modeKey/business-types/:typeKey', protect, authorize('admin', 'platform_owner'), async (req, res) => {
  try {
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(req.params.id);
    const app = isObjectId ? await Application.findById(req.params.id) : await Application.findOne({ appCode: req.params.id.toUpperCase() });
    if (!app) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    const { modeKey, typeKey } = req.params;
    const mode = app.solutionModes.find(m => m.modeKey === modeKey || String(m._id) === modeKey);
    if (!mode) {
      return res.status(404).json({ success: false, message: 'Solution mode not found' });
    }

    mode.businessTypes = (mode.businessTypes || []).filter(b => b.typeKey !== typeKey && String(b._id) !== typeKey);
    await app.save();

    res.json({
      success: true,
      message: 'Business type removed successfully',
      solutionModes: app.solutionModes,
      businessTypes: mode.businessTypes,
      application: app
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', protect, authorize('admin', 'platform_owner'), async (req, res) => {
  try {
    const app = await Application.findById(req.params.id);
    if (!app) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    if (app.isSystem) {
      return res.status(403).json({ success: false, message: 'Built-in system applications cannot be deleted' });
    }

    const clientCount = await Client.countDocuments({ softwareProduct: app.appCode });
    if (clientCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete ' + app.name + '. It is currently assigned to ' + clientCount + ' active client(s).'
      });
    }

    await app.deleteOne();
    res.json({ success: true, message: 'Application ' + app.name + ' removed from PaaS Hub' });
  } catch (error) {
    console.error('Error deleting application:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
