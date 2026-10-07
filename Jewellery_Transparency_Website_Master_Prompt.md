# Jewellery Transparency & Verification System — Master Development Prompt

## Role

You are a senior full-stack engineer, UI/UX designer, database architect, and product designer.

Build a complete production-quality web application called:

**Jewellery Transparency & Verification System**

The purpose of this platform is to give jewellery buyers an easy way to verify the information associated with a jewellery item through a unique QR code.

> **IMPORTANT:** This is a scoped college/client project. Do **not** over-engineer it.

The current project scope is the reduced version. Do **not** implement AI/ML, OCR, blockchain, advanced cryptography, complex audit trails, external certification APIs, native mobile apps, advanced analytics, or multi-language support.

The application should feel like a polished commercial product despite having a relatively simple backend.

---

## 1. Core Product Concept

A jeweller/admin registers a jewellery item in the system.

The system creates:

- A unique Jewellery ID
- A digital jewellery record
- A unique QR code

The QR code points to a public verification page.

A buyer scans the QR code using their phone camera and sees:

- Jewellery ID
- Jewellery type
- Description
- Gold purity / karat
- Gross weight
- Net weight
- Certificate ID
- Verification status
- Transparent price breakdown

### Core Product Flow

```text
JEWELLERY
    ↓
DIGITAL IDENTITY
    ↓
QR CODE
    ↓
BUYER SCANS
    ↓
VERIFICATION PAGE
    ↓
TRANSPARENT INFORMATION
```

The system does **not** physically test gold purity.

It only verifies that the QR code corresponds to a registered digital record.

---

## 2. Technology Stack

Use this stack unless there is a strong technical reason not to.

### Frontend

- React
- TypeScript
- Tailwind CSS
- shadcn/ui or similarly polished component system
- Lucide icons

### Backend

- Python
- FastAPI

### Database

- PostgreSQL

### QR

- Python QR-code generation library OR a reliable frontend QR library

### Authentication

- JWT or secure session authentication

### File Handling

- Basic certificate/document upload only
- No OCR

### Development

- Docker support if practical
- `.env` configuration
- Clean separation between frontend/backend

Do not introduce unnecessary frameworks or dependencies.

---

## 3. Design Direction

The website should look like a premium jewellery technology platform.

### Do NOT make it look like

- A generic admin template
- A student CRUD project
- A cryptocurrency website
- An AI dashboard
- A colorful SaaS template

### Visual Direction

- Premium
- Elegant
- Minimal
- Trustworthy
- Modern
- Luxury
- Professional

### Color Palette

**Primary — Deep Emerald / Dark Green**

`#173F35`

**Secondary — Dark Charcoal**

`#24312E`

**Accent — Muted Champagne Gold**

`#B08D57`

**Background — Warm White / Ivory**

`#FAF9F6`

**Cards**

White

**Borders**

Very subtle warm gray

### Design Rules

- Avoid excessive gradients.
- Avoid excessive shadows.
- Avoid excessive rounded cards.
- Avoid bright green.
- Avoid neon colors.
- Typography should feel premium and highly readable.
- Use generous whitespace.
- Use subtle gold accents rather than making the entire website gold.

---

## 4. Application Structure

Build these main areas.

### Public

1. Landing page
2. Public QR verification page
3. Invalid QR page

### Admin

4. Login
5. Dashboard
6. Jewellery list
7. Add jewellery
8. Edit jewellery
9. Jewellery details
10. QR generation / QR display

---

## 5. Landing Page

Create a professional landing page.

### Hero

**Headline:**

> Know What You're Buying.

**Subheading:**

> Verify your jewellery's registered details, certification information and price breakdown through one simple QR scan.

### Primary CTA

> Verify Jewellery

### Secondary CTA

> Jeweller Login

The hero should visually communicate:

```text
Jewellery → QR → Verification
```

Do not make the hero overly complicated.

Include a subtle premium jewellery-related visual treatment.

### Sections

1. How It Works
2. What You Can Verify
3. Price Transparency
4. Why Digital Verification
5. CTA

### How It Works

#### Step 01 — Register

> Every jewellery item receives a unique digital identity.

#### Step 02 — Scan

> Scan the QR code attached to the jewellery.

#### Step 03 — Verify

> View the registered details and price breakdown.

### What's Verified

- Jewellery ID
- Gold purity
- Weight
- Certificate reference
- Price breakdown
- Verification status

### Disclaimer

> This platform verifies the information associated with a registered digital record. It does not independently perform physical gold purity testing.

---

## 6. Admin Login

Create a professional login screen.

### Fields

- Email
- Password

### Button

> Sign In

### Features

- Form validation
- Loading state
- Error state
- Password visibility toggle
- Remember session where appropriate
- Logout

Do not implement social login.

---

## 7. Admin Dashboard

Create a clean dashboard.

### Header

Logo / brand

### Navigation

- Dashboard
- Jewellery
- Add Jewellery
- Logout

### Dashboard Cards

- Total Jewellery
- Active Records
- Verified Records
- Inactive Records

### Main Section

**Recent Jewellery**

Show:

- Jewellery ID
- Type
- Purity
- Weight
- Price
- Status
- Created date
- Actions

### Actions

- View
- Edit
- Deactivate

Add a prominent:

> + Add Jewellery

button.

Keep dashboard analytics simple.

Do **not** create graphs unless they provide actual value.

---

## 8. Jewellery Management

Create a jewellery management page.

### Features

- Search
- Filter
- Sort
- Pagination if required
- Add
- Edit
- View
- Deactivate

### Search By

- Jewellery ID
- Certificate ID
- Jewellery type

### Table Columns

- Jewellery ID
- Type
- Purity
- Net Weight
- Certificate ID
- Price
- Status
- Actions

### Status Badges

- Active
- Inactive

Use clear visual hierarchy.

---

## 9. Add Jewellery

Create a professional form.

### Section 1 — Basic Information

Fields:

- Jewellery Type
- Description

Jewellery types:

- Ring
- Necklace
- Bracelet
- Chain
- Earrings
- Bangle
- Pendant
- Other

### Section 2 — Gold Information

- Purity / Karat
- Gross Weight
- Net Gold Weight

### Section 3 — Certification

- Certificate ID
- Issuing Authority
- Certificate Date
- Certificate Document

The certificate document is **optional**.

Allow:

- PDF
- JPG
- PNG

Do **not** perform OCR.

### Section 4 — Pricing

- Gold Value
- Making Charges
- Stone / Other Component Value
- Tax
- Total Price

The total should preferably be calculated automatically:

```text
Gold Value
+
Making Charges
+
Other Component Value
+
Tax
=
Total Price
```

Allow manual correction only if necessary.

### Section 5 — Generate QR

After successful creation, show:

> Jewellery Registered Successfully

Then show:

- Jewellery ID
- QR Code

Buttons:

- Download QR
- View Verification Page
- Back to Jewellery

---

## 10. Jewellery Details Page

Create a premium detail page.

### Header

- Jewellery ID
- Status

### Information Cards

#### Jewellery Information

- Type
- Description

#### Gold Information

- Purity
- Gross Weight
- Net Weight

#### Certification

- Certificate ID
- Issuing Authority
- Certificate Date

#### Price Transparency

- Gold Value
- Making Charges
- Other Components
- Tax
- Total

#### QR Code

Display the QR prominently.

### Actions

- Download QR
- Edit
- Deactivate

---

## 11. QR System

Every jewellery item must have a unique public verification identifier.

**Do NOT expose raw sequential database IDs in the public URL.**

Use something like:

```text
/verify/JWL-26-A8F72K
```

or a secure random public token.

Example:

```text
https://yourdomain.com/verify/JWL-26-A8F72K
```

The QR code should point to this public URL.

Requirements:

- QR must be downloadable as PNG.
- Buyer must not need to install an app.
- Phone camera should be able to scan it normally.
- QR should be high enough resolution for printing.

---

## 12. Public Verification Page

This is the **most important page in the entire application**.

When a buyer scans a QR code, show a premium, trustworthy verification page.

### Verification Result

```text
✓ VERIFIED RECORD

This jewellery item is registered in the digital verification system.
```

### Jewellery Details

```text
Jewellery ID
JWL-26-A8F72K

Type:
Diamond Ring

Description:
22K gold diamond ring
```

### Gold Information

```text
Purity:
22K / 91.6%

Gross Weight:
16.02 g

Net Gold Weight:
15.42 g
```

### Certification

```text
Certificate ID:
CERT-XXXXXX

Issuing Authority:
[Authority]

Certificate Date:
[Date]
```

### Price Transparency

```text
Gold Value:
₹98,500

Making Charges:
₹12,000

Stone / Other Components:
₹4,000

Tax:
₹10,500

TOTAL:
₹1,25,000
```

### Verification Status

```text
Verification Status:
VERIFIED

Record Status:
ACTIVE
```

### Disclaimer

> This page verifies the information associated with the registered digital record. It does not independently perform physical testing of the jewellery.

### Important UX Requirement

Make this page extremely mobile-friendly.

The buyer may open it directly from a phone camera.

---

## 13. Invalid QR Page

If the QR does not exist, show:

> **Verification Record Not Found**

> This QR code does not correspond to a registered jewellery record.

Do not display fake or partial jewellery information.

If the record is inactive, show:

> **Record Inactive**

> This jewellery record is no longer active in the verification system.

Do **not** show it as verified.

---

## 14. Database

Create a clean relational database.

### Table: `users`

```text
id
name
email
password_hash
role
status
created_at
```

### Table: `jewellery`

```text
id
jewellery_id
type
description
purity
gross_weight
net_weight
certificate_id
issuing_authority
certificate_date
certificate_document
gold_value
making_charges
other_component_value
tax
total_price
verification_token
status
created_at
updated_at
```

You may normalize pricing/certificates into separate tables if technically justified, but do not overcomplicate the database.

---

## 15. API Design

Create clean REST APIs.

### Authentication

```http
POST /api/auth/login
POST /api/auth/logout
GET /api/auth/me
```

### Jewellery

```http
GET /api/jewellery
POST /api/jewellery
GET /api/jewellery/{id}
PUT /api/jewellery/{id}
DELETE /api/jewellery/{id}
```

### Public Verification

```http
GET /api/verify/{token}
```

### QR

```http
GET /api/jewellery/{id}/qr
```

Search/filter should be handled efficiently by the backend.

---

## 16. Security

Implement reasonable basic security.

Requirements:

- Password hashing
- Authentication
- Protected admin routes
- Input validation
- Authorization
- CORS configuration
- Environment variables for secrets
- Never expose password hashes
- Never expose internal database IDs publicly
- Validate uploaded files
- Limit certificate file types
- Never expose private admin data through the public verification page

Do **not** implement blockchain.

Do **not** implement complex cryptographic infrastructure.

---

## 17. Responsive Design

The application must work properly on:

- Desktop
- Laptop
- Tablet
- Mobile

The public verification page should be designed **mobile-first**.

Admin dashboard should be responsive but desktop-first.

Do not simply shrink the desktop UI.

Actually redesign layouts for smaller screens.

---

## 18. UX Details

Include:

- Loading states
- Empty states
- Error states
- Success notifications
- Confirmation dialogs
- Form validation
- Skeleton loaders where useful

Examples:

> Jewellery registered successfully.

> Changes saved successfully.

> Jewellery record deactivated.

> Verification record not found.

Avoid `alert()`.

Use polished toast notifications/dialogs.

---

## 19. QR Download

The admin should be able to download the QR code.

The generated QR should be high enough resolution for printing.

Provide:

> Download QR

Optionally show the Jewellery ID under the QR.

---

## 20. Important Product Limitations

Do **not** claim that the application:

- Physically verifies gold purity
- Detects counterfeit jewellery
- Independently validates government certification
- Guarantees authenticity

The system only verifies the registered digital record.

Use accurate terminology:

- Registered
- Verified Record
- Certificate Reference
- Digital Verification

---

## 21. Features That Must NOT Be Implemented

Do **not** add:

- ❌ AI chatbot
- ❌ OCR
- ❌ Machine learning
- ❌ Blockchain
- ❌ Cryptocurrency
- ❌ Complex analytics
- ❌ Advanced audit trails
- ❌ Hash-based tamper detection
- ❌ Government API integrations
- ❌ Native Android/iOS app
- ❌ Multi-language support
- ❌ Complex recommendation systems

These are intentionally outside the current scope.

---

## 22. Code Quality

Write clean, maintainable code.

Requirements:

- TypeScript where applicable
- Proper component structure
- Reusable UI components
- Reusable form components
- Clean API service layer
- Reusable hooks where appropriate
- Environment variables
- Proper error handling
- Database migrations
- Clear naming conventions
- No hardcoded secrets
- No unnecessary dependencies
- No duplicated code

Do not generate one enormous frontend file.

Separate appropriately into:

```text
components/
pages/
services/
hooks/
types/
utils/
```

---

## 23. Development Approach

Do **not** try to build everything blindly at once.

Follow this order:

1. Set up project structure
2. Set up database
3. Implement authentication
4. Implement jewellery CRUD
5. Implement public verification endpoint
6. Implement QR generation
7. Implement admin UI
8. Implement buyer verification UI
9. Add responsive design
10. Test the complete flow
11. Polish UI

### Critical End-to-End Flow

```text
ADMIN LOGIN
    ↓
ADD JEWELLERY
    ↓
SAVE
    ↓
GENERATE QR
    ↓
SCAN QR
    ↓
PUBLIC VERIFICATION PAGE
    ↓
VIEW JEWELLERY + PRICE INFORMATION
```

---

## 24. Demo Data

Seed the database with realistic demo jewellery.

Create approximately 8–10 records.

Examples:

- Diamond Ring
- Gold Necklace
- Gold Bracelet
- Gold Chain
- Gold Earrings
- Gold Bangle
- Gold Pendant

Use realistic but clearly fictional certificate IDs.

Do not use real people's personal information.

---

## 25. Final Quality Standard

The final website should look like something a small jewellery technology company could actually present to a client.

It should **NOT** look like:

> "AI-generated website"

It should **NOT** look like:

> "college CRUD project"

It should feel:

- Premium
- Trustworthy
- Minimal
- Professional
- Modern
- Easy to use

The most important user journey is:

### Jeweller

```text
Login
  ↓
Add Jewellery
  ↓
Generate QR
```

### Buyer

```text
Scan QR
  ↓
Verify
  ↓
Understand Jewellery
  ↓
Understand Price
```

Prioritize making this journey extremely polished.

---

## 26. Final Testing Checklist

Before considering the project complete, test:

- [ ] Login
- [ ] Logout
- [ ] Jewellery creation
- [ ] Jewellery editing
- [ ] Jewellery search
- [ ] Jewellery deactivation
- [ ] QR generation
- [ ] QR download
- [ ] QR scanning
- [ ] Valid QR verification
- [ ] Invalid QR handling
- [ ] Inactive record handling
- [ ] Price calculation
- [ ] Certificate upload
- [ ] Mobile layout
- [ ] Desktop layout
- [ ] Protected admin routes
- [ ] API validation
- [ ] Database persistence

Do not stop after generating the UI.

The backend, database and frontend must actually work together.

---

## 27. Final Deliverables

After implementation, provide:

1. Complete project structure
2. Setup instructions
3. Required environment variables
4. Database setup instructions
5. Frontend run instructions
6. Backend run instructions
7. Demo login credentials
8. API endpoint summary
9. QR verification flow explanation
10. Testing instructions

Build the application according to this specification.
