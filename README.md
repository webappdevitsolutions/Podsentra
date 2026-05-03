# Simple Store with Cashfree

Simple e-commerce storefront using:

- `localStorage` for products, cart, users, and order history
- Node.js + Express backend only for Cashfree order create/verify

No Supabase. No MongoDB. No UI rebuild.

## Project Structure

- `frontend/` static multi-page store
- `backend/` Cashfree API backend
- `render.yaml` backend deployment blueprint
- `netlify.toml` frontend deployment config

## Environment Files

`backend/.env` should remain local only and is gitignored.

Use `backend/.env.example` as the template:

```env
PORT=5000
CLIENT_URL=http://localhost:5500,http://127.0.0.1:5500
CASHFREE_APP_ID=your_cashfree_app_id
CASHFREE_SECRET_KEY=your_cashfree_secret_key
CASHFREE_ENV=sandbox
```

## Local Run

### Backend

```powershell
cd "C:\Users\ashis\Desktop\New folder\backend"
npm.cmd install
npm.cmd start
```

Health check:

```txt
http://localhost:5000/api/health
```

### Frontend

```powershell
cd "C:\Users\ashis\Desktop\New folder\frontend"
python -m http.server 5500
```

Open:

```txt
http://localhost:5500/index.html
```

## Deploy Backend to Render

1. Push this repo to GitHub.
2. In Render, create a new Blueprint/Web Service from this repo.
3. Ensure service uses `backend` root directory (`render.yaml` already sets this).
4. Set env vars in Render:

```env
CASHFREE_APP_ID=your_real_app_id
CASHFREE_SECRET_KEY=your_real_secret_key
CASHFREE_ENV=sandbox
PORT=5000
CLIENT_URL=https://your-netlify-site.netlify.app
```

5. Deploy and verify:

```txt
https://your-render-backend.onrender.com/api/health
```

## Deploy Frontend to Netlify

1. Create Netlify site from this same repo.
2. Publish directory should be `frontend` (`netlify.toml` already sets this).
3. After Render deploy, update:

- `frontend/script.js` default production API URL placeholder
- `netlify.toml` redirect target URL placeholder

to your real Render URL, then redeploy Netlify.

## Payment Flow

1. Add items to cart
2. Go to checkout
3. Submit checkout form
4. Cashfree hosted checkout opens
5. Redirect returns to `checkout.html?order_id={order_id}`
6. Frontend calls `/api/cashfree/verify-payment`
7. On `PAID`, order is stored in localStorage and cart is cleared
