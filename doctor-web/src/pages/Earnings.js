/**
 * EARNINGS PAGE — Doctor Web
 * Shows payment history and summary cards: This Month, All Time, Pending.
 * Fetches from GET /api/surgeons/:id/earnings.
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getSurgeonId } from '../lib/auth';
import { formatFee, formatDate } from '../lib/helpers';

const API_URL = process.env.REACT_APP_API_URL;

export default function Earnings() {
  const surgeonId = getSurgeonId();
  const [cases, setCases]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API_URL}/api/surgeons/${surgeonId}/earnings`)
      .then(res => setCases(res.data.cases || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [surgeonId]);

  // Compute summaries
  const now = new Date();
  const thisMonth = cases
    .filter(c => c.surgery_date && new Date(c.surgery_date).getMonth() === now.getMonth()
      && new Date(c.surgery_date).getFullYear() === now.getFullYear());

  const allTimePayout = cases.reduce((sum, c) => {
    const fee = c.fee || c.fee_max || 0;
    return sum + Math.round(fee * 0.90); // 10% commission deducted
  }, 0);

  const thisMonthPayout = thisMonth.reduce((sum, c) => {
    const fee = c.fee || c.fee_max || 0;
    return sum + Math.round(fee * 0.90);
  }, 0);

  const pending = cases.filter(c => c.payment_status === 'pending');
  const pendingAmount = pending.reduce((sum, c) => {
    const fee = c.fee || c.fee_max || 0;
    return sum + Math.round(fee * 0.90);
  }, 0);

  if (loading) return <div className="p-8 text-center" style={{ color: '#8B8B8B' }}>Loading...</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold mb-6" style={{ color: '#444444' }}>Earnings</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          ['This Month', formatFee(thisMonthPayout), '#E56717'],
          ['All Time', formatFee(allTimePayout), '#16a34a'],
          ['Pending', formatFee(pendingAmount), '#B45309'],
        ].map(([label, value, color]) => (
          <div key={label} className="bg-white rounded-xl p-5 text-center"
            style={{ border: '1px solid #E8E0D8' }}>
            <p className="text-xs font-semibold uppercase" style={{ color: '#8B8B8B' }}>{label}</p>
            <p className="text-xl font-bold mt-1" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Payment history table */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8E0D8' }}>
        {cases.length === 0 ? (
          <div className="p-12 text-center" style={{ color: '#8B8B8B' }}>No earnings yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead style={{ backgroundColor: '#FDF8F5' }}>
              <tr>
                {['Case', 'Procedure', 'Date', 'Gross Fee', 'Commission', 'Net Payout', 'Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: '#8B8B8B' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cases.map(c => {
                const fee = c.fee || c.fee_max || 0;
                const comm = Math.round(fee * 0.10);
                const net = fee - comm;
                return (
                  <tr key={c.id} style={{ borderTop: '1px solid #F3F0EC' }}>
                    <td className="px-4 py-3 font-semibold" style={{ color: '#444' }}>
                      SOC-{String(c.case_number).padStart(3, '0')}
                    </td>
                    <td className="px-4 py-3" style={{ color: '#444' }}>{c.procedure}</td>
                    <td className="px-4 py-3" style={{ color: '#8B8B8B' }}>{formatDate(c.surgery_date)}</td>
                    <td className="px-4 py-3" style={{ color: '#444' }}>{formatFee(fee)}</td>
                    <td className="px-4 py-3" style={{ color: '#DC2626' }}>-{formatFee(comm)}</td>
                    <td className="px-4 py-3 font-bold" style={{ color: '#E56717' }}>{formatFee(net)}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{
                          backgroundColor: c.payment_status === 'paid' ? '#F0FDF4' : '#FFFBEB',
                          color: c.payment_status === 'paid' ? '#16a34a' : '#B45309',
                        }}>
                        {c.payment_status === 'paid' ? 'Paid' : 'Pending'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
