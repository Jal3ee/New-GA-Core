import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// The public service has its own entry, styles and data requests; it never mounts GA Core auth/layout.
const publicService = /^\/cek-reimb(?:ursement|uresement)\/?$/.test(window.location.pathname)
const component = publicService
  ? import('./pages/public/PublicReimbursementPage.jsx')
  : Promise.all([import('./App.jsx'), import('./index.css')]).then(([app]) => app)

component.then(({ default: Page }) => {
  createRoot(document.getElementById('root')).render(<StrictMode><Page /></StrictMode>)
})
