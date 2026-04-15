/**
 * SHARED HELPERS — Doctor Web
 * Formatting and utility functions used across pages.
 */

/** Convert paise to formatted INR string: 7500000 → "₹75,000" */
export const formatFee = (paise) => {
  if (!paise) return '—';
  return '₹' + (paise / 100).toLocaleString('en-IN');
};

/** Format date string to Indian locale: "2026-03-30" → "Mon, 30 Mar 2026" */
export const formatDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  });
};

/** Request type badge config — color-coded by type */
export const REQUEST_TYPE_STYLES = {
  emergency: { bg: '#FEF2F2', color: '#DC2626', label: 'Emergency' },
  opd:       { bg: '#EFF6FF', color: '#1D4ED8', label: 'OPD' },
  reconsult: { bg: '#F5F3FF', color: '#7C3AED', label: 'Cross Consult' },
  elective:  { bg: '#F3F4F6', color: '#6B7280', label: 'Elective' },
};

/** Time remaining as "Xh Ym" or "expired" */
export const getTimeRemaining = (expiresAt) => {
  if (!expiresAt) return '';
  const diff = new Date(expiresAt) - new Date();
  if (diff <= 0) return 'Expired';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
};
