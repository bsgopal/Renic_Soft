# 📘 Renic Soft: End-to-End Customer Onboarding & SaaS Multi-Tenancy Master Guide

Welcome to the complete, step-by-step operational guide for onboarding new customers, linking software applications, and managing dedicated tenant URLs in **Renic Soft**.

---

## 🧭 System Architecture at a Glance (Zero Paid Overhead)

```
                       ┌────────────────────────────────────────┐
                       │          Single Server / VPS           │
                       │           (Node.js + Nginx)            │
                       └───────────────────┬────────────────────┘
                                           │
             ┌─────────────────────────────┼─────────────────────────────┐
             ▼                             ▼                             ▼
┌─────────────────────────┐   ┌─────────────────────────┐   ┌─────────────────────────┐
│  WhatsApp & Insta App   │   │   Textile Retail POS    │   │  Renic Soft Platform    │
│       (Port 5173)       │   │       (Port 5174)       │   │       (Port 5050)       │
└────────────┬────────────┘   └────────────┬────────────┘   └────────────┬────────────┘
             │                             │                             │
             ▼                             ▼                             ▼
┌─────────────────────────┐   ┌─────────────────────────┐   ┌─────────────────────────┐
│ DB: renic_tenant_ss01_wa│   │DB: renic_tenant_ss01_pos│   │   DB: renic_soft        │
│  (Isolated DB per App)  │   │  (Isolated DB per App)  │   │   (Master & Telemetry)  │
└─────────────────────────┘   └─────────────────────────┘   └─────────────────────────┘
```

- **Single Host / Single IP**: 1 server hosts all customer web portals and backend microservices.
- **Physical Database Isolation**: Every customer gets their own database (`renic_tenant_<code`). Zero data crossover.
- **Dynamic Reverse Proxy**: The subdomain or URL Key determines which application and database loads.

---

## 📑 Renic Soft Sidebar Menu Structure (Exact UI Order)

In the Renic Soft Admin Portal, the navigation menu is laid out as follows:

| Menu Item | URL Path | Primary Purpose |
| :--- | :--- | :--- |
| **1. Dashboard** | `/` | Overall platform revenue, active customer count, and license expiration alerts. |
| **2. Licenses & Fleet** | `/licenses` | **Step 1: Where you create new customers and provision software licenses.** |
| **3. API & OAuth Hub** | `/credentials` | **Step 2: Inspect Client IDs, Secret Keys, edit custom domains, generate live tokens, and Share WhatsApp kit.** |
| **4. Customer Screen Audit** | `/activity-report` | **Step 3: Central screen usage logs, customer page visits, and session durations.** |
| **5. Port Forwarding & Router** | `/network` | Monitor live microservice ports (5173, 5174, 5176) and network ping latencies. |
| **6. Quotations** | `/quotes` | Create professional client pricing quotations and proposals. |
| **7. Billing** | `/billing` | Generate GST-compliant invoices for subscription renewals. |
| **8. Payment Reports** | `/reports` | Export customer payment records and revenue reports. |

---

## 🚀 The Complete Step-by-Step Onboarding Workflow

---

### Step 1: Navigate to "Licenses & Fleet"
1. Open Renic Soft Admin at **[http://localhost:5175/licenses](http://localhost:5175/licenses)**.
2. Click the green button in the top right: **`+ Onboard Customer`**.
3. The **"Provision New SaaS Client / Showroom"** modal will appear.

---

### Step 2: Fill the Onboarding Modal (Input-by-Input Guide)

Here is every single field in the modal, why it exists, and the exact recommended value to enter:

| # | Input Field Label | Why It Is Needed | Example Value to Enter |
| :-: | :--- | :--- | :--- |
| **1** | **Shop / Client Name \*** | The customer's legal or showroom business name. Appears in invoice headers, login screen banners, and WhatsApp greetings. | `Saraswathi Silks` |
| **2** | **Customer Code / ID (URL Key) \*** | **Critical Identifier:** The unique slug that forms the customer's dedicated URL. Determines database naming (`renic_tenant_<code`). Use uppercase alphanumeric and hyphens. | `SS01` *(or `SS01-POS` / `SS01-WA`)* |
| **3** | **Software Product (PaaS Application) \*** | **Application Selector:** Determines which application this customer URL points to. If the customer bought POS, choose Textile POS. If they bought WhatsApp marketing, choose WhatsApp Automation. | Select: `Textile & Garment POS` OR `WhatsApp & Instagram Automation` |
| **4** | **Plan Tier** | Enforces hardware and license quotas (e.g. basic: 1 floor, pro: 3 floors, enterprise: unlimited). | `Pro` |
| **5** | **Forwarding Target IP** | The network IP where the application server runs. Leave as local loopback unless pointing to a physical showroom billing PC. | `127.0.0.1` |
| **6** | **Assigned Port** | The internal port of the selected software. Automatically set by your Software Product selection: `5174` (Textile POS) or `5173` (WhatsApp Automation). | `5174` *(Auto-filled)* |
| **7** | **Connection Type** | Network protocol mode for reverse proxy streaming. | `Port Forward Router` |
| **8** | **⚡ Activate License Immediately** | Check this box so the customer can start using the portal immediately without requiring manual OTP activation. | ☑️ **Checked** |
| **9** | **Permitted Screens (Screen-Gate)** | Controls role-based feature gating. Uncheck any screen you do not want this customer to access. | Keep all checked (default) |
| **10** | **Admin Email \*** | The master email the customer will use to log into their portal. | `admin@saraswathisilks.com` |
| **11** | **Admin Mobile \*** | The customer's 10-digit mobile number. Used to send the automated WhatsApp onboarding credentials. | `9345578103` |
| **12** | **Initial Password \*** | The temporary or permanent password the customer will use to log into their store. | `123456` |

---

### Step 3: Click "Provision & Register Client"
When you submit the form, the backend executes the following operations:
1. **Creates Client Record**: Saves master metadata to `renic_soft.clients`.
2. **Auto-Provisions Isolated Database**: Creates database `renic_tenant_<customercode>` (e.g. `renic_tenant_ss01`).
3. **Pre-Seeds Admin Account**: Creates an admin account inside their isolated DB with their email and hashed password.
4. **Generates Enterprise OAuth 2.0 Credentials**:
   - `Renic Client ID`: `RC_ID_SS01_XXXX`
   - `Renic Secret Key`: `RC_SEC_XXXX` (Cryptographically secured)
5. **Registers Reverse Proxy Route**: Binds `ss01.lvh.me:5050` directly to the assigned application port.
6. **Displays Success Modal**: Shows the generated credentials with a copy button.

---

### Step 4: Verify & Customize in "API & OAuth Hub"
1. Click **API & OAuth Hub** in the sidebar menu (or go to [http://localhost:5175/credentials](http://localhost:5175/credentials)).
2. Click the newly created customer (**Saraswathi Silks**) from the left list.
3. You will see:
   - **Dedicated Customer SaaS Hosting URL**: e.g. `http://ss01.lvh.me:5050`
   - **Renic Client ID**: `RC_ID_SS01_...`
   - **Renic Secret Key**: Click **Reveal** to view.
   - **OAuth 2.0 Token Endpoint URL**: `http://localhost:5050/api/v1/oauth/token`
4. **Need to change the URL?**
   - Click the **"Edit URLs"** button on the card.
   - In the modal, you can update the **Dedicated Customer SaaS Hosting URL** to any domain (e.g. `https://ss01.yourdomain.com`).
   - Click **Save Changes**.

---

### Step 5: Test the Customer Portal (Login Verification)

> [!IMPORTANT]
> **Use an Incognito / Private Window**: Because your main browser tab is logged in as the Global Platform Admin, always open the customer's URL in a fresh Incognito window so you can test logging in as the client.

1. Open an **Incognito Window** in Chrome or your browser.
2. Navigate to:
   ```text
   http://ss01.lvh.me:5050
   ```
   *(Note: `lvh.me` is a free public wildcard domain that resolves to your local PC without changing any system hosts files).*
3. The selected software application (Textile POS or WhatsApp Automation) will load.
4. Log in using the customer credentials you set in Step 2:
   - **Email**: `admin@saraswathisilks.com`
   - **Password**: `123456`
5. You are now inside the customer's portal. All data created here is stored exclusively in `renic_tenant_ss01`.

---

### Step 6: 1-Click WhatsApp Onboarding Kit Dispatch
1. Return to the **API & OAuth Hub** ([http://localhost:5175/credentials](http://localhost:5175/credentials)).
2. Select **Saraswathi Silks (SS01)**.
3. Click the green **"Share WhatsApp"** button.
4. WhatsApp Web will open with a formatted welcome message:
   ```text
   *🎉 Welcome to Saraswathi Silks!*
   Your dedicated software portal is ready.

   *Customer Code:* SS01
   *Software:* Textile & Garment POS
   *Dedicated Hosting URL:* http://ss01.lvh.me:5050

   *Your Login Credentials:*
   - Username / Email: admin@saraswathisilks.com
   - Password: Provided separately / Set by Admin

   *API Security Credentials:*
   - Client ID: RC_ID_SS01_AF9E2261
   - OAuth Token URL: http://localhost:5050/api/v1/oauth/token

   Zero crossover database isolation enabled.
   ```
5. Press Send!

---

### Step 7: View Live Telemetry in "Customer Screen Audit"
1. In Renic Soft, click **Customer Screen Audit** in the sidebar (or go to [http://localhost:5175/activity-report](http://localhost:5175/activity-report)).
2. As the customer navigates through their portal (e.g. POS Billing Desk &rarr; Inventory Catalog &rarr; Suppliers), every page view and action is captured in real-time.
3. You can filter by Customer Code (`SS01`), view staff duration, and export audit trails to CSV.

---

## 🏢 Handling One Customer Buying Multiple Software Products

If Saraswathi Silks buys **both** Textile POS and WhatsApp Automation, follow this naming convention:

```
Customer: Saraswathi Silks
├── License 1: Textile POS
│   ├── Customer Code: SS01-POS
│   ├── Software Product: Textile & Garment POS
│   ├── URL: http://ss01-pos.lvh.me:5050 (Live: https://ss01-pos.yourdomain.com)
│   └── Database: renic_tenant_ss01_pos
│
└── License 2: WhatsApp Automation
    ├── Customer Code: SS01-WA
    ├── Software Product: WhatsApp & Instagram Automation
    ├── URL: http://ss01-wa.lvh.me:5050 (Live: https://ss01-wa.yourdomain.com)
    └── Database: renic_tenant_ss01_wa
```

Each license has its own dedicated portal URL, dedicated database, and independent screen activity audit trail.

---

## 🌐 Transitioning from Local Testing to Live Hostinger Production

When moving from your PC to a live Hostinger VPS:

1. **Hostinger DNS**:
   - Add an `A` record with name `*` pointing to your Hostinger VPS IP.
   - Add an `A` record with name `api` pointing to your Hostinger VPS IP.
2. **Wildcard SSL**:
   - Run `certbot certonly --manual --preferred-challenges dns -d "*.yourdomain.com"` for free HTTPS on all customer subdomains.
3. **In Renic Soft**:
   - Go to **API & OAuth Hub** &rarr; Select Client &rarr; Click **Edit URLs**.
   - Change Hosting URL to: `https://ss01.yourdomain.com`.
   - Change Token Endpoint to: `https://api.yourdomain.com/api/v1/oauth/token`.
   - Click **Save Changes**.

---

*Document Generated: 2026-09-17 · Renic Soft Platform Enterprise Edition*
