# Order Manager

A simple web app to manage business orders, built with Next.js and MongoDB.

---

## Project Structure

```
order-manager/
├── lib/
│   ├── dbConnect.js       # MongoDB connection helper
│   └── Order.js           # Mongoose order model
├── pages/
│   ├── api/
│   │   ├── orders.js      # GET all orders / POST new order
│   │   └── orders/[id].js # PATCH order status
│   ├── _app.js
│   └── index.js           # Main UI
├── styles/
│   ├── globals.css
│   └── Home.module.css
├── .env                   # ← Put your MongoDB URI here (never commit this)
├── .env.example
├── .gitignore
├── next.config.js
└── package.json
```

---

## Setup (Local Development)

### 1. Install dependencies
```bash
npm install
```

### 2. Configure MongoDB
Open the `.env` file and replace the placeholder with your real MongoDB connection string:
```
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/orders?retryWrites=true&w=majority
```

> **Getting a free MongoDB URI:**
> 1. Go to [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) and sign up free.
> 2. Create a free M0 cluster.
> 3. Under **Database Access**, create a user with read/write access.
> 4. Under **Network Access**, allow access from anywhere (`0.0.0.0/0`) for Vercel compatibility.
> 5. Click **Connect → Drivers** and copy the connection string.

### 3. Run the dev server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Deploying to Vercel

### 1. Push to GitHub
Create a new GitHub repository and push this project to it:
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

> **Note:** The `.gitignore` already excludes `.env` so your connection string won't be uploaded.

### 2. Import to Vercel
1. Go to [vercel.com](https://vercel.com) and sign in.
2. Click **Add New → Project**.
3. Import your GitHub repository.
4. Click **Deploy** (Vercel auto-detects Next.js — no build config needed).

### 3. Add Environment Variable on Vercel
1. After deploying, go to your project on Vercel.
2. Click **Settings → Environment Variables**.
3. Add a new variable:
   - **Name:** `MONGODB_URI`
   - **Value:** your MongoDB connection string
4. Click **Save**, then go to **Deployments** and **Redeploy** for the variable to take effect.

---

## How It Works

| Feature | Details |
|---|---|
| **Add order** | Click "+ New Order", fill in the form, click "Add Order" |
| **Auto timestamp** | Date & Time is recorded automatically when the order is created |
| **Default status** | Every new order starts as **Pending** |
| **Approve order** | Tick the checkbox next to an order's status to change it to **Approved** |
| **Undo approval** | Untick the checkbox to set it back to **Pending** |

---

## Tech Stack

- **Frontend:** Next.js (React) with CSS Modules
- **Backend:** Next.js API Routes (serverless)
- **Database:** MongoDB via Mongoose
- **Hosting:** Vercel
