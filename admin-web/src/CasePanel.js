/**
 * CASE PANEL - Admin Web
 * Vaidhya Healthcare Pvt Ltd
 *
 * A slide-out panel that opens from the right when admin clicks a case ID.
 * Shows full case details including clinical documents uploaded by the hospital.
 *
 * UPDATED (Migration 001): Shows single fee field instead of fee_min/fee_max.
 * UPDATED (Migration 004): Shows request_type badge, parent_case_id link,
 *   and surgery recommendation if one exists.
 *
 * Usage in admin App.js Cases tab:
 *   import CasePanel from './CasePanel';
 *   <CasePanel case={selectedCase} onClose={() => setSelectedCase(null)} />
 *
 * Props:
 *   case    — the full case object from Supabase (or null to hide panel)
 *   onClose — callback to clear the selected case and close the panel
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL;

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

// ── REQUEST TYPE BADGE CONFIG (Migration 001) ─────────────────────────────────
// Color-coded badges for each request type
const REQUEST_TYPE_STYLES = {
  emergency:  { bg: '#FEF2F2', color: '#DC2626', label: 'Emergency' },
  opd:        { bg: '#EFF6FF', color: '#1D4ED8', label: 'OPD' },
  reconsult:  { bg: '#F5F3FF', color: '#7C3AED', label: 'Re-consult' },
  elective:   { bg: '#F3F4F6', color: '#6B7280', label: 'Elective' },
};

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────────
export default function CasePanel({ case: c, onClose }) {

  // Don't render if no case is selected
  if (!c) return null;

  return <CasePanelInner c={c} onClose={onClose} />;
}

/**
 * Inner component — separated so we can use hooks (useEffect) inside it.
 * The outer component returns null early when no case is selected, which
 * would violate the rules of hooks if we put useEffect there.
 */
function CasePanelInner({ c, onClose }) {

  // ── SURGERY RECOMMENDATION STATE (Migration 004) ────────────────────────────
  // Fetched on mount for re-consult cases. Shows the surgeon's recommendation
  // (suggested procedure, urgency, notes) if one exists.
  const [recommendation, setRecommendation] = useState(null);
  const [recLoading, setRecLoading]         = useState(false);

  useEffect(() => {
    // Only fetch recommendation for re-consult cases
    if (c.request_type !== 'reconsult') return;

    const fetchRec = async () => {
      setRecLoading(true);
      try {
        const res = await axios.get(`${API_URL}/api/cases/${c.id}/recommendation`);
        setRecommendation(res.data.recommendation || null);
      } catch (err) {
        console.error('Failed to fetch recommendation:', err);
      } finally {
        setRecLoading(false);
      }
    };
    fetchRec();
  }, [c.id, c.request_type]);

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
    converted:   { bg: '#F5F3FF', color: '#7C3AED' },
  };
  const statusLabels = {
    active:      'Active',
    cascading:   'Awaiting Response',
    confirmed:   'Confirmed',
    in_progress: 'In Progress',
    completed:   'Completed',
    cancelled:   'Cancelled',
    unfilled:    'Unfilled',
    converted:   'Converted',
  };
  const st = statusStyles[c.status] || { bg: '#F3F4F6', color: '#6B7280' };

  // Request type badge styling (Migration 001)
  const rt = REQUEST_TYPE_STYLES[c.request_type] || REQUEST_TYPE_STYLES.elective;

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Request type badge (Migration 001) */}
            <span style={{
              padding: '4px 10px',
              borderRadius: '999px',
              fontSize: '11px',
              fontWeight: '600',
              backgroundColor: rt.bg,
              color: rt.color,
            }}>
              {rt.label}
            </span>
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

          {/* ── PARENT CASE LINK (Migration 004) ────────────────────────────────
              If this case was converted from a re-consult, show the parent case ID
              as a subtle info banner at the top of the panel body. */}
          {c.parent_case_id && (
            <div style={{
              padding: '10px 14px',
              backgroundColor: '#F5F3FF',
              border: '1px solid #DDD6FE',
              borderRadius: '10px',
              marginBottom: '16px',
              fontSize: '12px',
              color: '#7C3AED',
            }}>
              <span style={{ fontWeight: '600' }}>Converted from re-consult</span>
              <span style={{ marginLeft: '6px', opacity: 0.7 }}>
                (parent: {c.parent_case_id.slice(0, 8)}...)
              </span>
            </div>
          )}

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

          {/* ── FEE (Updated Migration 001) ────────────────────────────────────
              Shows single flat fee instead of old fee_min/fee_max range.
              Falls back to fee_max for backward compatibility with older cases. */}
          <Section title="Fee">
            <Row label="Surgeon Fee" value={formatFee(c.fee || c.fee_max)} />
            {/* Show legacy range if fee is absent and fee_min exists (old cases) */}
            {!c.fee && c.fee_min && (
              <Row label="Fee Range" value={`${formatFee(c.fee_min)} – ${formatFee(c.fee_max)}`} />
            )}
          </Section>

          {/* ── SURGERY RECOMMENDATION (Migration 004) ──────────────────────────
              For re-consult cases, show the surgeon's recommendation if one exists.
              Fetched on panel open via GET /api/cases/:caseId/recommendation. */}
          {c.request_type === 'reconsult' && (
            <div style={{ marginBottom: '20px' }}>
              <p style={{
                fontSize: '11px', fontWeight: '600',
                color: '#8B8B8B', textTransform: 'uppercase',
                letterSpacing: '0.06em', marginBottom: '8px',
              }}>
                Surgery Recommendation
              </p>

              {recLoading && (
                <p style={{ fontSize: '13px', color: '#8B8B8B', fontStyle: 'italic' }}>
                  Loading recommendation...
                </p>
              )}

              {!recLoading && !recommendation && (
                <p style={{ fontSize: '13px', color: '#8B8B8B', fontStyle: 'italic' }}>
                  No recommendation submitted yet
                </p>
              )}

              {!recLoading && recommendation && (
                <div style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #E8E0D8',
                  borderRadius: '10px',
                  overflow: 'hidden',
                }}>
                  <Row label="Procedure" value={recommendation.suggested_procedure} />
                  <Row label="Urgency" value={
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '999px',
                      fontSize: '11px',
                      fontWeight: '600',
                      backgroundColor: recommendation.urgency === 'urgent' ? '#FEF2F2' : '#F3F4F6',
                      color: recommendation.urgency === 'urgent' ? '#DC2626' : '#6B7280',
                    }}>
                      {recommendation.urgency === 'urgent' ? 'Urgent' : 'Elective'}
                    </span>
                  } />
                  {recommendation.recommendation_notes && (
                    <Row label="Notes" value={recommendation.recommendation_notes} />
                  )}
                  {recommendation.surgeons && (
                    <Row label="By" value={recommendation.surgeons.name} />
                  )}
                </div>
              )}
            </div>
          )}

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
