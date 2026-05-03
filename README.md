# Podsecntra Store (Cashfree + Supabase)

Podsecntra is a simple multi-page e-commerce store with:

- static frontend in `docs/` (HTML/CSS/JS)
- Node.js backend in `backend/`
- Cashfree payment flow
- Supabase-backed products, cart sessions, abandoned-cart tracking, and orders
- separate admin dashboard (`docs/admin-dashboard.html`)

No MongoDB. No Razorpay.

## Project Structure

- `docs/` store frontend + admin dashboard
- `backend/` Express API + Cashfree integration
- `backend/supabase-schema.sql` Supabase table schema
- `render.yaml` Render service blueprint
- `netlify.toml` Netlify publish config (if needed)

## Required Backend Environment

Use `backend/.env.example`:

```env
PORT=5000
CLIENT_URL=http://localhost:5500,http://127.0.0.1:5500,https://webappdevitsolutions.github.io,https://podscentra.store

CASHFREE_APP_ID=your_cashfree_app_id
CASHFREE_SECRET_KEY=your_cashfree_secret_key
CASHFREE_ENV=sandbox

SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

ADMIN_EMAIL=admin@podsecntra.com
ADMIN_PASSWORD=change_this_admin_password
ADMIN_JWT_SECRET=change_this_admin_jwt_secret
```

## Supabase Setup

1. Open Supabase SQL Editor.
2. Run `backend/supabase-schema.sql`.
3. Copy `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` into backend env.

## Local Run

### Backend

```powershell
cd "C:\Users\ashis\Desktop\New folder\backend"
npm.cmd install
npm.cmd start
```

Health:

```txt
http://localhost:5000/api/health
```

### Frontend

```powershell
cd "C:\Users\ashis\Desktop\New folder\docs"
python -m http.server 5500
```

Open:

```txt
http://localhost:5500/index.html
```

Admin dashboard:

```txt
http://localhost:5500/admin-dashboard.html
```

## Render Deploy (Backend)

- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `npm run start`

Set env vars in Render from `.env.example`.

## GitHub Pages / Custom Domain (Frontend)

Frontend is static in `docs/` and works with GitHub Pages.

Current API base is in:

- `docs/script.js`
- `docs/admin-dashboard.js`

Both point to:

```txt
https://podsentra.onrender.com/api
```

## Admin Dashboard Features

`docs/admin-dashboard.html` includes:

- admin login (env-based credentials via backend)
- overview metrics (products, successful checkouts, revenue, active carts, abandoned carts)
- product CRUD
- orders list
- active carts list
- abandoned carts list

## Implemented API Endpoints

### Public

- `GET /api/health`
- `GET /api/products`
- `POST /api/cart/session`
- `PUT /api/cart/session/:id`
- `POST /api/cashfree/create-order`
- `POST /api/cashfree/verify-payment`

### Admin (JWT protected)

- `POST /api/admin/login`
- `GET /api/admin/me`
- `POST /api/admin/products`
- `PUT /api/admin/products/:id`
- `DELETE /api/admin/products/:id`
- `GET /api/admin/orders`
- `GET /api/admin/carts`
- `GET /api/admin/abandoned-carts`
- `GET /api/admin/dashboard`

## Cart and Checkout Tracking

- cart updates sync to backend sessions
- sessions inactive for 30+ minutes are marked abandoned
- successful payments mark sessions completed
- successful payment records are persisted as backend orders

## Notes

- Keep valid Cashfree sandbox keys in Render for test payments.
- Ensure `CLIENT_URL` includes your real frontend origin to avoid CORS errors.
- Legacy `docs/admin.html` is preserved and points users to the new admin dashboard.
