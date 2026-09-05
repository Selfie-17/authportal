# AuthPortal — React Frontend

A clean, modern React + Vite frontend for the **AuthPortal** institutional authentication system.

---

## Features

* **Vite + React (JavaScript)**: Fast development and lightweight production bundling.
* **React Router**: Client-side routing for `/login` and `/register`, with automatic redirection from `/` to `/login`.
* **Zero Role Selection**: Form contains no role input; roles (`STUDENT`, `TEACHER`, `ADMIN`) are strictly determined server-side from institutional email.
* **UI-Only "Continue with Google"**: Branded Google button with SVG logo and clean in-UI informational notice.
* **Environment-Driven Configuration**: Configured via `VITE_API_BASE_URL` in `.env` and `src/config/api.js`.
* **Zero Backend Coupling (For Now)**: Fully functional UI layer ready to be connected to the Spring Boot REST API.

---

## Project Structure

```text
frontend/
├── public/
│   └── vite.svg             # Application favicon
├── src/
│   ├── components/
│   │   ├── AuthLayout.jsx   # Centered card, institutional branding, switch links
│   │   ├── GoogleButton.jsx # Google branded button + in-UI notice
│   │   ├── InputField.jsx   # Reusable form field with validation and helper text
│   │   ├── LoginForm.jsx    # Email & password form with validation and loading state
│   │   └── RegisterForm.jsx # Name, email, password, confirm password form
│   ├── config/
│   │   └── api.js           # Environment-driven API endpoints configuration
│   ├── pages/
│   │   ├── LoginPage.jsx    # Login page view
│   │   └── RegisterPage.jsx # Register page view
│   ├── styles/
│   │   ├── auth.css         # Card, input, button, and notice styling
│   │   └── index.css        # Design tokens, typography, and global resets
│   ├── App.jsx              # Router setup
│   └── main.jsx             # React entry point
├── .env                     # Local environment config (git-ignored)
├── .env.example             # Example environment template
├── .gitignore
├── index.html
├── package.json
└── vite.config.js
```

---

## Running Locally

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Local Development Server
```bash
npm run dev
```
Access the application in your browser at:
`http://localhost:5173/login`

---

## Building for Production

To create an optimized production bundle in `dist/`:
```bash
npm run build
```

To preview the production build locally:
```bash
npm run preview
```
