# Nexus Frontend — Auth & Network
> **Owner: You**

## Your files

```
├── auth.html           ← Login / Register page
├── network.html        ← Network contacts page
├── css/
│   ├── shared.css      ← Design system (variables, sidebar, modals, buttons…)
│   ├── auth.css        ← Auth-specific styles
│   └── network.css     ← Network-specific styles
└── js/
    ├── api.js          ← Shared fetch helpers, auth guard, toast, formatters
    ├── auth.js         ← Login + register logic
    └── network.js      ← Contacts CRUD logic
```

## Your friend's file
`tracker.html` (+ `css/tracker.css` + `js/tracker.js`) lives in their repo.
The "Applications" nav link in `network.html` is intentionally left as `#`
until both repos are merged / deployed together.

## Getting started

1. Make sure the backend is running on `http://localhost:3000`
2. Open `auth.html` in a browser (or serve the folder with a static server)
3. Register / log in → you'll be redirected to `network.html`

## ⚠️ Coordination note with your friend

`shared.css` and `api.js` are **duplicated** in both repos on purpose so you
can each work independently without import issues. If you make a change to
either of these files, **tell your friend** so they can apply the same change
to their copy before merging.

## API base URL

Both `api.js` files point to:
```
const API = 'http://localhost:3000/api';
```
Change this in `js/api.js` when deploying to production.
