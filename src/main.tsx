import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

// Purge legacy permanent localStorage auth tokens so session is strictly session-based
if (typeof window !== 'undefined') {
  try {
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith('sb-') && k.endsWith('-auth-token')) {
        localStorage.removeItem(k);
      }
    });
    localStorage.removeItem('lextria_litigator_active_profile');
    localStorage.removeItem('lextria_litigator_view_as_role');
  } catch {}
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
