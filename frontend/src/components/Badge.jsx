import React from 'react';

const styles = {
  active: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  pending_activation: 'bg-lime-50 text-blue-700 ring-1 ring-blue-200',
  grace_period: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  trial: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200',
  locked: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  cancelled: 'bg-gray-100 text-gray-600 ring-1 ring-gray-200',
  draft: 'bg-gray-100 text-gray-600 ring-1 ring-gray-200',
  sent: 'bg-lime-50 text-blue-700 ring-1 ring-blue-200',
  accepted: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  converted: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
  rejected: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  expired: 'bg-gray-100 text-gray-600 ring-1 ring-gray-200',
  Paid: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  Unpaid: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  'Partially Paid': 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  Overdue: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  Draft: 'bg-gray-100 text-gray-600 ring-1 ring-gray-200',
  Cancelled: 'bg-gray-100 text-gray-600 ring-1 ring-gray-200'
};

export default function Badge({ value }) {
  const cls = styles[value] || 'bg-gray-100 text-gray-600 ring-1 ring-gray-200';
  return <span className={`badge capitalize ${cls}`}>{String(value).replace('_', ' ')}</span>;
}