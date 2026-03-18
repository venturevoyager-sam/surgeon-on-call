/**
 * CASE PANEL - Admin Web
 * Vaidhya Healthcare Pvt Ltd
 *
 * A slide-out panel that opens from the right when admin clicks a case ID.
 * Shows full case details including clinical documents uploaded by the hospital.
 *
 * Usage in admin App.js Cases tab:
 *   import CasePanel from './CasePanel';
 *   <CasePanel case={selectedCase} onClose={() => setSelectedCase(null)} />
 *
 * Props:
 *   case    — the full case object from Supabase (or null to hide panel)
 *   onClose — callback to clear the selected case and close the panel
 */

import React from 'react';

// ── FILE ICON ──────────────────────────────────────────────────────────────────
// Returns an emoji based on MIME type
function fileIcon(type) {
  if (!type) return '📎';
  if (type === 'application/pdf')  return '📄';
  if (type.startsWith('image/'))   return '🖼️';
  return '📎';
}

// ── FORMAT HELPERS ─────────────────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}

function formatFee(paise) {
  if (!paise) return '—';
  return '₹' + (paise / 100).toLocaleString('en-IN');
}

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────────
export default function CasePanel({ case: c, onClose }) {

  // Don't render if no case is selected
  if (!c) return null;

  // Parse documents — stored as JSONB array, each: { name, url, type }
  const documents = Array.isArray(c.documents) ? c.documents : [];

  // ── STATUS BADGE ──
  const statusStyles = {
    active:      { bg: '#FFF7ED', color: '#C2410C' },
    cascading:   { bg: '#FFFBEB', color: '#B45309' },
    confirmed:   { bg: '#F0FDF4', color: '#15803D' },
    in_progress: { bg: '#EFF6FF', color: '#1D4ED8' },
    completed:   { bg: '#F0FDFA', color: '#0F766E' },
    cancelled:   { bg: '#FEF2F2', color: '#DC2626' },
    unfilled:    { bg: '#FEF2F2', color: '#DC2626' },
  };
  const statusLabels = {
    active:      'Active',
    cascading:   'Awaiting Response',
    confirmed:   'Confirmed',
    in_progress: 'In Progress',
    completed:   'Completed',
    cancelled:   'Cancelled',
    unfilled:    'Unfilled',
  };
  const st = statusStyles[c.status] || { bg: '#F3F4F6', color: '#6B7280' };

  return (
    <>
      {/* ── BACKDROP — click to close ── */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          backgroundColor: 'rgba(0,0,0,0.35)',
          zIndex: 40,
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* ── PANEL ── */}
      <div style={{
        position: 'fixed',
        top: 0, right: 0, bottom: 0,
        width: '480px',
        maxWidth: '95vw',
        backgroundColor: '#ffffff',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
        animation: 'slideIn 0.2s ease-out',
        fontFamily: '"DM Sans", ui-sans-serif, sans-serif',
      }}>

        {/* ── PANEL HEADER ── */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #E8E0D8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#444444',
          flexShrink: 0,
        }}>
          <div>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginBottom: '4px' }}>
              Case Details
            </p>
            <h2 style={{ color: '#ffffff', fontSize: '20px', fontWeight: '700', letterSpacing: '-0.02em' }}>
              SOC-{String(c.case_number).padStart(3, '0')}
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Status badge */}
            <span style={{
              padding: '4px 12px',
              borderRadius: '999px',
              fontSize: '12px',
              fontWeight: '600',
              backgroundColor: st.bg,
              color: st.color,
            }}>
              {statusLabels[c.status] || c.status}
            </span>
            {/* Close button */}
            <button
              onClick={onClose}
              style={{
                width: '32px', height: '32px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'rgba(255,255,255,0.1)',
                color: '#ffffff',
                fontSize: '18px',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* ── SCROLLABLE BODY ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* ── SURGERY DETAILS ── */}
          <Section title="Surgery Details">
            <Row label="Procedure"  value={c.procedure} />
            <Row label="Specialty"  value={c.specialty_required} />
            <Row label="Date"       value={formatDate(c.surgery_date)} />
            <Row label="Time"       value={c.surgery_time} />
            <Row label="Duration"   value={`${c.duration_hours} hrs`} />
            <Row label="OT Number"  value={c.ot_number} />
          </Section>

          {/* ── PATIENT DETAILS ── */}
          <Section title="Patient Details">
            <Row label="Name"   value={c.patient_name} />
            <Row label="Age"    value={`${c.patient_age} years`} />
            <Row label="Gender" value={c.patient_gender
              ? c.patient_gender.charAt(0).toUpperCase() + c.patient_gender.slice(1)
              : '—'
            } />
            {c.notes && <Row label="Notes" value={c.notes} />}
          </Section>

          {/* ── FEE ── */}
          <Section title="Fee Budget">
            <Row label="Min Fee" value={formatFee(c.fee_min)} />
            <Row label="Max Fee" value={formatFee(c.fee_max)} />
          </Section>

          {/* ── CLINICAL DOCUMENTS ────────────────────────────────────────────
              Shows all files uploaded by the hospital when posting the case.
              Each file opens in a new browser tab on click.
          ──────────────────────────────────────────────────────────────────── */}
          <div style={{ marginBottom: '20px' }}>
            <p style={{
              fontSize: '11px', fontWeight: '600',
              color: '#8B8B8B', textTransform: 'uppercase',
              letterSpacing: '0.06em', marginBottom: '12px',
            }}>
              Clinical Documents
            </p>

            {documents.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#8B8B8B', fontStyle: 'italic' }}>
                No documents attached
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {documents.map((doc, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 14px',
                    backgroundColor: '#FDF8F5',
                    border: '1px solid #E8E0D8',
                    borderRadius: '10px',
                  }}>
                    {/* File type icon */}
                    <span style={{ fontSize: '20px', flexShrink: 0 }}>
                      {fileIcon(doc.type)}
                    </span>

                    {/* File name */}
                    <span style={{
                      flex: 1,
                      fontSize: '13px',
                      fontWeight: '500',
                      color: '#444444',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {doc.name || `Document ${i + 1}`}
                    </span>

                    {/* Open in new tab */}
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: '5px 12px',
                        backgroundColor: '#E56717',
                        color: '#ffffff',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '600',
                        textDecoration: 'none',
                        flexShrink: 0,
                        transition: 'background-color 0.15s',
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = '#CD4D00'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = '#E56717'}
                    >
                      Open ↗
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* ── Slide-in animation ── */}
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  );
}

// ── REUSABLE SUB-COMPONENTS ────────────────────────────────────────────────────

// Section wrapper with a title
function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <p style={{
        fontSize: '11px', fontWeight: '600',
        color: '#8B8B8B', textTransform: 'uppercase',
        letterSpacing: '0.06em', marginBottom: '8px',
      }}>
        {title}
      </p>
      <div style={{
        backgroundColor: '#ffffff',
        border: '1px solid #E8E0D8',
        borderRadius: '10px',
        overflow: 'hidden',
      }}>
        {children}
      </div>
    </div>
  );
}

// Label + value row inside a section
function Row({ label, value }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      padding: '10px 14px',
      borderBottom: '1px solid #F3F0EC',
      gap: '16px',
    }}>
      <span style={{ fontSize: '13px', color: '#8B8B8B', flexShrink: 0 }}>
        {label}
      </span>
      <span style={{
        fontSize: '13px', fontWeight: '600',
        color: '#444444', textAlign: 'right',
      }}>
        {value || '—'}
      </span>
    </div>
  );
}