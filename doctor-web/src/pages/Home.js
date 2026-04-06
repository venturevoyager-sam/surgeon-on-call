/**
 * HOME PAGE — Doctor Web
 * Shows availability toggle, incoming requests (sorted: emergency first,
 * then by expires_at ascending), and upcoming confirmed cases.
 * Auto-refreshes every 60 seconds.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getSurgeonId } from '../lib/auth';
import { formatFee, formatDate, getTimeRemaining, REQUEST_TYPE_STYLES } from '../lib/helpers';

const API_URL = process.env.REACT_APP_API_URL;

export default function Home() {
  const navigate  = useNavigate();
  const surgeonId = getSurgeonId();

  const [surgeon, setSurgeon]       = useState(null);
  const [available, setAvailable]   = useState(false);
  const [requests, setRequests]     = useState([]);
  const [upcoming, setUpcoming]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [toggling, setToggling]     = useState(false);

  // Fetch profile + requests
  const fetchData = useCallback(async () => {
    try {
      const [profRes, reqRes] = await Promise.all([
        axios.get(`${API_URL}/api/surgeons/${surgeonId}`),
        axios.get(`${API_URL}/api/surgeons/${surgeonId}/requests`),
      ]);
      setSurgeon(profRes.data.surgeon);
      setAvailable(profRes.data.surgeon.available);

      // Sort: emergency first, then by most recent (notified_at descending)
      const sorted = [...(reqRes.data.incoming_requests || [])].sort((a, b) => {
        const aE = a.request_type === 'emergency';
        const bE = b.request_type === 'emergency';
        if (aE && !bE) return -1;
        if (!aE && bE) return 1;
        const aTime = a.notified_at ? new Date(a.notified_at).getTime() : 0;
        const bTime = b.notified_at ? new Date(b.notified_at).getTime() : 0;
        return bTime - aTime;
      });
      setRequests(sorted);

      // Sort upcoming: emergency first, then by most recent (surgery_date descending)
      const sortedUpcoming = [...(reqRes.data.upcoming_cases || [])].sort((a, b) => {
        const aE = a.request_type === 'emergency';
        const bE = b.request_type === 'emergency';
        if (aE && !bE) return -1;
        if (!aE && bE) return 1;
        return new Date(b.surgery_date) - new Date(a.surgery_date);
      });
      setUpcoming(sortedUpcoming);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally { setLoading(false); }
  }, [surgeonId]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Toggle availability
  const handleToggle = async () => {
    setToggling(true);
    try {
      const newVal = !available;
      await axios.patch(`${API_URL}/api/surgeons/${surgeonId}/availability`, { available: newVal });
      setAvailable(newVal);
    } catch (err) { console.error('Toggle failed:', err); }
    finally { setToggling(false); }
  };

  if (loading) {
    return <div className="p-8 text-center" style={{ color: '#8B8B8B' }}>Loading...</div>;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">

      {/* ── Availability toggle ── */}
      <div className="flex items-center justify-between mb-8 p-5 rounded-xl bg-white"
        style={{ border: '1px solid #E8E0D8' }}>
        <div>
          <h2 className="text-lg font-bold" style={{ color: '#444444' }}>
            Welcome, {surgeon?.name?.split(' ').slice(0, 2).join(' ')}
          </h2>
          <p className="text-sm" style={{ color: '#8B8B8B' }}>
            {available ? 'You are currently available for cases' : 'You are currently unavailable'}
          </p>
        </div>
        <button onClick={handleToggle} disabled={toggling}
          className="w-14 h-8 rounded-full transition-colors relative"
          style={{ backgroundColor: available ? '#16a34a' : '#E8E0D8' }}>
          <span className="block w-6 h-6 bg-white rounded-full absolute top-1 transition-all shadow"
            style={{ left: available ? '30px' : '4px' }} />
        </button>
      </div>

      {/* ── Incoming Requests ── */}
      <div className="mb-8">
        <h3 className="text-sm font-bold uppercase tracking-wide mb-3" style={{ color: '#8B8B8B' }}>
          Incoming Requests {requests.length > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: '#E56717', color: '#fff' }}>
              {requests.length}
            </span>
          )}
        </h3>

        {requests.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-xl" style={{ border: '1px solid #E8E0D8' }}>
            <p className="text-sm" style={{ color: '#8B8B8B' }}>No pending requests</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {requests.map(req => {
              const rt = REQUEST_TYPE_STYLES[req.request_type] || REQUEST_TYPE_STYLES.elective;
              const isEmergency = req.request_type === 'emergency';
              return (
                <div key={req.case_id}
                  onClick={() => navigate(`/request/${req.case_id}`)}
                  className="bg-white rounded-xl p-4 cursor-pointer transition hover:shadow-md"
                  style={{ border: isEmergency ? '2px solid #DC2626' : '1px solid #E8E0D8' }}>
                  <div className="flex items-center gap-2 mb-2">
                    {/* Pulsing red dot for emergency */}
                    {isEmergency && (
                      <span className="w-2.5 h-2.5 rounded-full inline-block"
                        style={{ backgroundColor: '#DC2626', animation: 'pulse 1.5s infinite' }} />
                    )}
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{ backgroundColor: rt.bg, color: rt.color }}>
                      {rt.label}
                    </span>
                    <span className="text-xs font-mono ml-auto" style={{ color: '#E56717' }}>
                      {getTimeRemaining(req.expires_at)}
                    </span>
                  </div>
                  <p className="font-semibold text-sm" style={{ color: '#444444' }}>{req.procedure}</p>
                  <p className="text-xs" style={{ color: '#8B8B8B' }}>{req.specialty_required}</p>
                  <div className="flex gap-4 mt-2 text-xs" style={{ color: '#8B8B8B' }}>
                    <span>{formatDate(req.surgery_date)}</span>
                    <span>{req.surgery_time}</span>
                    <span className="font-semibold" style={{ color: '#E56717' }}>
                      {formatFee(req.fee || req.fee_max)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Upcoming Confirmed Cases ── */}
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wide mb-3" style={{ color: '#8B8B8B' }}>
          Upcoming Cases
        </h3>
        {upcoming.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-xl" style={{ border: '1px solid #E8E0D8' }}>
            <p className="text-sm" style={{ color: '#8B8B8B' }}>No upcoming cases</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {upcoming.map(c => (
              <div key={c.id} onClick={() => navigate(`/case/${c.id}`)}
                className="bg-white rounded-xl p-4 cursor-pointer transition hover:shadow-md"
                style={{ border: '1px solid #E8E0D8' }}>
                <p className="font-semibold text-sm" style={{ color: '#444444' }}>{c.procedure}</p>
                <div className="flex gap-4 mt-1 text-xs" style={{ color: '#8B8B8B' }}>
                  <span>{formatDate(c.surgery_date)}</span>
                  <span>{c.surgery_time}</span>
                  <span>{c.ot_number}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pulse animation for emergency dot */}
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </div>
  );
}
