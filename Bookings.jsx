import React, { useEffect, useState } from 'react';
import Title from '../../components/Title';
import { assets } from '../../assets/assets';
import '../../styles/dashboard.css';

/* Normalize status from database format to lowercase with underscores */
const normalizeStatus = (status) => {
  if (!status) return 'confirmed';
  const normalized = status.toLowerCase().replace(/-/g, '_');
  // Map database values to normalized values
  if (normalized === 'checked_in' || normalized === 'checked-in') return 'checked_in';
  if (normalized === 'checked_out' || normalized === 'checked-out') return 'checked_out';
  if (normalized === 'cancelled') return 'cancelled';
  if (normalized === 'confirmed') return 'confirmed';
  return 'confirmed'; // default
};

/* Normalize payment status */
const normalizePaymentStatus = (paymentStatus) => {
  if (!paymentStatus) return 'pending';
  const normalized = paymentStatus.toLowerCase().replace(/\s+/g, '_');
  if (normalized === 'not_paid') return 'pending';
  if (normalized === 'pending') return 'pending';
  if (normalized === 'paid') return 'partial_payment';
  if (normalized === 'partial_payment') return 'partial_payment';
  if (normalized === 'payment_complete' || normalized === 'completed') return 'payment_complete';
  return 'pending';
};

const PAYMENT_STATUS_LABELS = {
  pending: 'Pending',
  partial_payment: 'Partial Payment',
  payment_complete: 'Payment Complete',
};

/* Map booking */
const mapBookingData = (b) => {
  // Only use check_in_time/check_out_time if they exist (actual check-in/out was performed)
  // Don't use check_in/check_out dates as they are just booking dates (default to midnight)
  // check_in_time and check_out_time contain the actual datetime when check-in/out was performed
  const checkInTime = b.check_in_time || null; // Only use if check-in was actually performed
  const checkOutTime = b.check_out_time || null; // Only use if check-out was actually performed
  
  const normalizedPaymentStatus = normalizePaymentStatus(b.payment_status);
  const displayPaymentStatus = PAYMENT_STATUS_LABELS[normalizedPaymentStatus] || 'Pending';
  
  return {
    _id: String(b.booking_id ?? ''),
    bookingId: b.booking_id ?? '',
    guestName: b.guest_name ?? 'Guest',
    email: b.email ?? '',
    roomType: b.room_type ?? '—',
    roomNumber: b.room_number ?? '—',
    checkInDate: b.check_in ? new Date(b.check_in).toISOString().split('T')[0] : '',
    checkOutDate: b.check_out ? new Date(b.check_out).toISOString().split('T')[0] : '',
    checkInTime: checkInTime,
    checkOutTime: checkOutTime,
    guests: b.guests ?? '—',
    totalPrice: Number(b.total_price ?? 0),
    paymentStatus: displayPaymentStatus,
    status: normalizeStatus(b.booking_status),
    normalizedPaymentStatus,
    createdAt: b.created_at ?? '',
  };
};


const Bookings = () => {
  const [bookings, setBookings] = useState([]);
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roomTypeFilter, setRoomTypeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [checkOutFilter, setCheckOutFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Paid modal state
  const [paidModal, setPaidModal] = useState({ open: false, booking: null, pendingConfirm: false });
  
  // Checkout modal state
  const [checkoutModal, setCheckoutModal] = useState({ open: false, booking: null, pendingConfirm: false });
  
  // Check-in modal state
  const [checkinModal, setCheckinModal] = useState({ open: false, booking: null, pendingConfirm: false });
  
  // Cancel confirmation modal state
  const [cancelModal, setCancelModal] = useState({ open: false, booking: null });

  // API endpoints
  const BOOKINGS_API = 'http://localhost:8000/api/bookings/getBookings.php';
  const UPDATE_STATUS_API = 'http://localhost:8000/api/bookings/updateBookingStatus.php';

  // fetch bookings
  const refetch = async () => {
  try {
    setLoading(true);
    const res = await fetch(BOOKINGS_API);
    const json = await res.json();
    const arr = Array.isArray(json) ? json : (json.data ?? []);
    const mapped = arr.map(mapBookingData);
    // Filter out checked-out and cancelled bookings (they go to booking logs)
    setBookings(mapped.filter(b => b.status !== 'checked_out' && b.status !== 'cancelled'));
  } catch (err) {
    console.error('Failed to fetch bookings', err);
    setBookings([]);
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
    refetch();
  }, []);

  // filters
  useEffect(() => {
    const filtered = (bookings || []).filter(b => {
      const q = searchTerm.trim().toLowerCase();
      const matchesSearch = !q || b.guestName.toLowerCase().includes(q) || b.roomType.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
      const matchesRoomType = roomTypeFilter === 'all' || b.roomType === roomTypeFilter;
      const matchesDate = !dateFilter || b.checkInDate === dateFilter;
      const matchesCheckOut = !checkOutFilter || b.checkOutDate === checkOutFilter;
      return matchesSearch && matchesStatus && matchesRoomType && matchesDate && matchesCheckOut;
    });
    setFilteredBookings(filtered);
    setPage(1);
  }, [bookings, searchTerm, statusFilter, roomTypeFilter, dateFilter, checkOutFilter]);

  // api action handler
 const handleBookingAction = async (booking, action, options = {}) => {
  try {
    setActionLoading(true);
    let response;
    const datetime = options.datetime || null;

    // Handle Paid action - just show confirmation
    if (action === 'paid') {
      // Open paid confirmation modal
      setPaidModal({ open: true, booking: booking, pendingConfirm: true });
      setActionLoading(false);
      return;
    }

    // Handle Cancel action
    if (action === 'cancel') {
      // Open cancel confirmation modal
      setCancelModal({ open: true, booking: booking });
      setActionLoading(false);
      return;
    }

    // Handle Check-in action - show confirmation modal (user must confirm)
    if (action === 'checkin') {
      // Open check-in confirmation modal
      setCheckinModal({ open: true, booking: booking, pendingConfirm: true });
      setActionLoading(false);
      return;
    }

    // Handle Check-out action - just show confirmation
    if (action === 'checkout') {
      // Open checkout confirmation modal
      setCheckoutModal({ open: true, booking: booking, pendingConfirm: true });
      setActionLoading(false);
      return;
    }

    if (response) {
      const result = await response.json();
      if (result.success) {
        await refetch(); // Refresh bookings after action
      } else {
        alert(`${action.charAt(0).toUpperCase() + action.slice(1)} failed: ` + (result.message || result.error));
      }
    }
  } catch (err) {
    console.error('Action error', err);
    alert('An error occurred. Check console.');
  } finally {
    setActionLoading(false);
  }
};

  // Handle cancel confirmation
  const handleCancelConfirm = async () => {
    if (!cancelModal.booking) return;
    try {
      setActionLoading(true);
      const response = await fetch(UPDATE_STATUS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: cancelModal.booking.bookingId,
          action: 'cancel',
        }),
      });
      const result = await response.json();
      if (result.success) {
        setCancelModal({ open: false, booking: null });
        await refetch();
      } else {
        alert('Cancel failed: ' + (result.message || result.error));
      }
    } catch (err) {
      console.error('Cancel error', err);
      alert('An error occurred. Check console.');
    } finally {
      setActionLoading(false);
    }
  };



  const roomTypes = Array.from(new Set(bookings.map(b => b.roomType))).filter(Boolean);


  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / pageSize));
  const paginatedBookings = (filteredBookings || []).slice((page - 1) * pageSize, page * pageSize);
  
  // Status Config
const STATUS_CONFIG = {
    confirmed: { color: 'bg-green-100 text-green-800 border-green-200', label: 'Confirmed' },
    cancelled: { color: 'bg-red-100 text-red-800 border-red-200', label: 'Cancelled' },
    'no-show': { color: 'bg-gray-100 text-gray-700 border-gray-200', label: 'No-Show' },
    checked_in: { color: 'bg-blue-100 text-blue-800 border-blue-200', label: 'Checked-In' },
    checked_out: { color: 'bg-gray-100 text-gray-700 border-gray-200', label: 'Checked-Out' },
    'Checked-in': { color: 'bg-blue-100 text-blue-800 border-blue-200', label: 'Checked-In' },
    'Checked-out': { color: 'bg-gray-100 text-gray-700 border-gray-200', label: 'Checked-Out' },
    'Cancelled': { color: 'bg-red-100 text-red-800 border-red-200', label: 'Cancelled' },
    'Confirmed': { color: 'bg-green-100 text-green-800 border-green-200', label: 'Confirmed' }
};


const getStatusConfig = (b) => STATUS_CONFIG[b.status] || STATUS_CONFIG.confirmed;  

// Subtle row background highlights by status
const ROW_BG = {
  confirmed: 'bg-green-50',
  checked_in: 'bg-blue-50',
  checked_out: 'bg-gray-50',
  cancelled: 'bg-red-50',
};

const getRowBgClass = (status) => ROW_BG[status] || '';


  return (
    <div className="w-full bg-white min-h-screen font-['Poppins']">
      <div className="max-w-7x2 mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-800">Bookings Management</h1>
          <p className="text-gray-600 mt-1">Manage and track all booking activities</p>
        </div>

        {/* Filters */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 my-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <input
                type="text"
                placeholder="Search by guest name or room type..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none text-sm text-gray-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white">
                <option value="all">All Status</option>
                <option value="confirmed">Confirmed</option>
                <option value="checked_in">Checked-In</option>
                <option value="checked_out">Checked-Out</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Room Type</label>
              <select value={roomTypeFilter} onChange={(e) => setRoomTypeFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white">
                <option value="all">All Room Types</option>
                {roomTypes.map(rt => <option key={rt} value={rt}>{rt}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Check-in Date</label>
              <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700"/>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Check-out Date</label>
              <input type="date" value={checkOutFilter} onChange={(e) => setCheckOutFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700"/>
            </div>
          </div>
        </div>

        {/* Table */}
<div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
  {loading ? (
    <div className="py-16 text-center">
      <div className="inline-block w-8 h-8 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
      <p className="mt-3 text-gray-500 text-sm">Loading bookings...</p>
    </div>
  ) : (
    <div className="overflow-x-auto">
      <table className="w-full">

              <thead className="bg-gray-50">
                <tr>
                  <th className="py-4 px-4 text-center text-sm font-medium text-gray-700">Booking ID</th>
                  <th className="py-4 px-4 text-left text-sm font-medium text-gray-700">Guest Name</th>
                  <th className="py-4 px-4 text-left text-sm font-medium text-gray-700">Room Type</th>
                  <th className="py-4 px-4 text-center text-sm font-medium text-gray-700">Room No.</th>
                  <th className="py-4 px-4 text-center text-sm font-medium text-gray-700">Check-in</th>
                  <th className="py-4 px-4 text-center text-sm font-medium text-gray-700">Check-out</th>
                  <th className="py-4 px-4 text-center text-sm font-medium text-gray-700">Guests</th>
                  <th className="py-4 px-4 text-center text-sm font-medium text-gray-700">Total</th>
                  <th className="py-4 px-4 text-center text-sm font-medium text-gray-700">Payment</th>
                  <th className="py-4 px-4 text-center text-sm font-medium text-gray-700">Status</th>
                  <th className="py-4 px-4 text-center text-sm font-medium text-gray-700">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200">
                {paginatedBookings.map(b => {
                  const sConf = getStatusConfig(b);
                  const rowBg = getRowBgClass(b.status);
                  return (
                    <tr key={b._id} className={`${rowBg} hover:bg-gray-50 transition-colors`}>
                      <td className="py-4 px-4 text-center text-sm text-gray-900 font-mono">#{String(b._id).slice(-6)}</td>
                      <td className="py-4 px-4 text-left text-sm text-gray-900">
                        <div className="font-medium">{b.guestName}</div>
                        {b.email && (
                          <div className="text-xs text-gray-500 mt-0.5">{b.email}</div>
                        )}
                      </td>
                      <td className="py-4 px-4 text-left text-sm text-gray-900">{b.roomType}</td>

                      <td className="py-4 px-4 text-center text-sm text-gray-900">{b.roomNumber || '—'}</td>
                      <td className="py-4 px-4 text-center text-sm text-gray-900">
                        {b.checkInDate ? (
                          <>
                            <div>{new Date(b.checkInDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })}</div>
                            {b.checkInTime ? (
                              <div className="text-xs text-gray-600 mt-0.5 font-medium">
                                {new Date(b.checkInTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                              </div>
                            ) : (
                              <div className="text-xs text-gray-500 mt-0.5">—</div>
                            )}
                          </>
                        ) : (
                          <>
                            <div></div>
                            <div className="text-xs text-gray-500 mt-0.5"></div>
                          </>
                        )}
                      </td>
                      <td className="py-4 px-4 text-center text-sm text-gray-900">
                        {b.checkOutDate ? (
                          <>
                            <div>{new Date(b.checkOutDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })}</div>
                            {b.checkOutTime ? (
                              <div className="text-xs text-gray-600 mt-0.5 font-medium">
                                {new Date(b.checkOutTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                              </div>
                            ) : (
                              <div className="text-xs text-gray-500 mt-0.5">—</div>
                            )}
                          </>
                        ) : (
                          <>
                            <div></div>
                            <div className="text-xs text-gray-500 mt-0.5"></div>
                          </>
                        )}
                      </td>
                      <td className="py-4 px-4 text-center text-sm text-gray-900">{b.guests}</td>
                      <td className="py-4 px-4 text-center text-sm text-gray-900 font-semibold">₱{(b.totalPrice || 0).toLocaleString()}</td>
                      <td className="py-4 px-4 text-center text-sm text-gray-900">{b.paymentStatus}</td>
                      <td className="py-4 px-4 text-center">
                        <span className={`inline-flex px-3 py-1 text-xs font-medium rounded-full border ${sConf.color}`}>{sConf.label}</span>
                      </td>

                      <td className="py-4 px-4 text-center">
  <div className="flex flex-row gap-2 items-center justify-center flex-nowrap">
    {/* Flow 1: Pending + Confirmed -> Mark as Paid & Cancel */}
    {b.status === 'confirmed' && b.normalizedPaymentStatus === 'pending' && (
      <>
        <button
          onClick={() => handleBookingAction(b, 'paid')}
          disabled={actionLoading}
          className="inline-flex items-center px-5 h-9 border border-green-400 text-xs font-medium rounded-lg text-green-700 bg-white hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Mark as Paid
        </button>
        <button
          onClick={() => handleBookingAction(b, 'cancel')}
          disabled={actionLoading}
          className="inline-flex items-center px-5 h-9 border border-transparent text-xs font-medium rounded-lg text-white bg-red-700 hover:bg-red-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
      </>
    )}
    {/* Flow 2: Partial Payment + Confirmed -> Check-in & Cancel */}
    {b.status === 'confirmed' && b.normalizedPaymentStatus === 'partial_payment' && (
      <>
        <button
          onClick={() => handleBookingAction(b, 'checkin')}
          disabled={actionLoading}
          className="inline-flex items-center px-5 h-9 border border-blue-400 text-xs font-medium rounded-lg text-blue-700 bg-white hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Check-in
        </button>
        <button
          onClick={() => handleBookingAction(b, 'cancel')}
          disabled={actionLoading}
          className="inline-flex items-center px-5 h-9 border border-transparent text-xs font-medium rounded-lg text-white bg-red-700 hover:bg-red-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
      </>
    )}
    {/* Flow 3: Partial Payment + Checked-in -> Check-out & Cancel */}
    {b.status === 'checked_in' && b.normalizedPaymentStatus === 'partial_payment' && (
      <>
        <button
          onClick={() => handleBookingAction(b, 'checkout')}
          disabled={actionLoading}
          className="inline-flex items-center px-5 h-9 border border-orange-400 text-xs font-medium rounded-lg text-orange-700 bg-white hover:bg-orange-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Check-out
        </button>
        <button
          onClick={() => handleBookingAction(b, 'cancel')}
          disabled={actionLoading}
          className="inline-flex items-center px-5 h-9 border border-transparent text-xs font-medium rounded-lg text-white bg-red-700 hover:bg-red-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
      </>
    )}
    {/* Flow 4: Payment Complete + Checked-out -> No actions (finished) */}
    {b.status === 'checked_out' && b.normalizedPaymentStatus === 'payment_complete' && (
      <span className="text-sm text-gray-500">—</span>
    )}
    {/* Cancelled -> No actions */}
    {b.status === 'cancelled' && (
      <span className="text-sm text-gray-500">—</span>
    )}
  </div>
</td>

                    </tr>
                  );
                })}
              </tbody>
                  </table>
    </div>
  )}
</div>


        {/* Pagination */}
        {filteredBookings.length > 0 && (
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6">
            <div className="text-sm text-gray-600">
              Showing {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, filteredBookings.length)} of {filteredBookings.length} bookings
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-2 rounded-lg bg-gray-200 text-gray-700 disabled:opacity-50">Previous</button>

              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                  if (pageNum > totalPages) return null;
                  return (
                    <button key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium ${pageNum === page ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}>
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-2 rounded-lg bg-gray-200 text-gray-700 disabled:opacity-50">Next</button>
            </div>
          </div>
        )}

        {/* Paid Modal - Confirmation */}
        {paidModal.open && paidModal.pendingConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-[2px] bg-black/50">
            <div className="bg-white rounded-xl p-8 w-full max-w-md shadow-2xl border text-center">
              <div className="mb-5">
                <h3 className="text-lg font-semibold mb-2">Mark as Paid</h3>
                <div className="mb-1 text-gray-700">
                  <span className="font-semibold">{paidModal.booking?.guestName || ''}</span>
                  {paidModal.booking?.roomNumber && (
                    <>
                      <span> • Room {paidModal.booking.roomNumber}</span>
                      {paidModal.booking?.roomType && (
                        <span> ({paidModal.booking.roomType})</span>
                      )}
                    </>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-2">Are you sure you want to mark this booking as paid?</p>
              </div>
              <div className="flex justify-center gap-4">
                <button
                  onClick={async () => {
                    setActionLoading(true);
                    try {
                      const response = await fetch(UPDATE_STATUS_API, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          booking_id: paidModal.booking.bookingId,
                          action: 'paid',
                        }),
                      });
                      const result = await response.json();
                      if (result.success) {
                        await refetch();
                        setPaidModal({ open: false, booking: null, pendingConfirm: false });
                      } else {
                        alert(`Paid failed: ${result.message}`);
                      }
                    } catch (error) {
                      console.error('Error:', error);
                      alert(`Paid failed: ${error.message}`);
                    } finally {
                      setActionLoading(false);
                    }
                  }}
                  className={`min-w-[120px] h-10 px-4 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center`}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </>
                  ) : 'Confirm'}
                </button>
                <button
                  onClick={() => setPaidModal({ open: false, booking: null, pendingConfirm: false })}
                  className="min-w-[100px] h-10 px-4 border border-gray-300 text-gray-700 text-sm rounded-lg bg-white hover:bg-gray-100 transition-colors"
                  disabled={actionLoading}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Checkout Modal - Confirmation */}
        {checkoutModal.open && checkoutModal.pendingConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-[2px] bg-black/50">
            <div className="bg-white rounded-xl p-8 w-full max-w-md shadow-2xl border text-center">
              <div className="mb-5">
                <h3 className="text-lg font-semibold mb-2">Check-out</h3>
                <div className="mb-1 text-gray-700">
                  <span className="font-semibold">{checkoutModal.booking?.guestName || ''}</span>
                  {checkoutModal.booking?.roomNumber && (
                    <>
                      <span> • Room {checkoutModal.booking.roomNumber}</span>
                      {checkoutModal.booking?.roomType && (
                        <span> ({checkoutModal.booking.roomType})</span>
                      )}
                    </>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-2">Are you sure you want to check-out this guest?</p>
              </div>
              <div className="flex justify-center gap-4">
                <button
                  onClick={async () => {
                    setActionLoading(true);
                    try {
                      const now = new Date();
                      const autoDatetime = now.toISOString().slice(0, 19);
                      const response = await fetch(UPDATE_STATUS_API, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          booking_id: checkoutModal.booking.bookingId,
                          action: 'checkout',
                          datetime: autoDatetime,
                        }),
                      });
                      const result = await response.json();
                      if (result.success) {
                        await refetch();
                        setCheckoutModal({ open: false, booking: null, pendingConfirm: false });
                      } else {
                        alert(`Check-out failed: ${result.message}`);
                      }
                    } catch (error) {
                      console.error('Error:', error);
                      alert(`Check-out failed: ${error.message}`);
                    } finally {
                      setActionLoading(false);
                    }
                  }}
                  className={`min-w-[120px] h-10 px-4 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center`}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </>
                  ) : 'Confirm'}
                </button>
                <button
                  onClick={() => setCheckoutModal({ open: false, booking: null, pendingConfirm: false })}
                  className="min-w-[100px] h-10 px-4 border border-gray-300 text-gray-700 text-sm rounded-lg bg-white hover:bg-gray-100 transition-colors"
                  disabled={actionLoading}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Check-in Modal - Confirmation */}
        {checkinModal.open && checkinModal.pendingConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-[2px] bg-black/50">
            <div className="bg-white rounded-xl p-8 w-full max-w-md shadow-2xl border text-center">
              <div className="mb-5">
                <h3 className="text-lg font-semibold mb-2">Check-in</h3>
                <div className="mb-1 text-gray-700">
                  <span className="font-semibold">{checkinModal.booking?.guestName || ''}</span>
                  {checkinModal.booking?.roomNumber && (
                    <>
                      <span> • Room {checkinModal.booking.roomNumber}</span>
                      {checkinModal.booking?.roomType && (
                        <span> ({checkinModal.booking.roomType})</span>
                      )}
                    </>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-2">Are you sure you want to check-in this guest?</p>
              </div>
              <div className="flex justify-center gap-4">
                <button
                  onClick={async () => {
                    setActionLoading(true);
                    try {
                      const now = new Date();
                      const bookingDate = checkinModal.booking?.checkInDate ? new Date(checkinModal.booking.checkInDate) : now;
                      bookingDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), 0);
                      const autoDatetime = bookingDate.toISOString().slice(0, 19);

                      const response = await fetch(UPDATE_STATUS_API, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          booking_id: checkinModal.booking.bookingId,
                          action: 'checkin',
                          datetime: autoDatetime,
                        }),
                      });
                      const result = await response.json();
                      if (result.success) {
                        await refetch();
                        setCheckinModal({ open: false, booking: null, pendingConfirm: false });
                      } else {
                        alert(`Check-in failed: ${result.message}`);
                      }
                    } catch (error) {
                      console.error('Error:', error);
                      alert(`Check-in failed: ${error.message}`);
                    } finally {
                      setActionLoading(false);
                    }
                  }}
                  className={`min-w-[120px] h-10 px-4 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center`}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </>
                  ) : 'Confirm'}
                </button>
                <button
                  onClick={() => setCheckinModal({ open: false, booking: null, pendingConfirm: false })}
                  className="min-w-[100px] h-10 px-4 border border-gray-300 text-gray-700 text-sm rounded-lg bg-white hover:bg-gray-100 transition-colors"
                  disabled={actionLoading}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cancel Confirmation Modal */}
        {cancelModal.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-[2px] bg-black/50">
            <div className="bg-white rounded-xl p-8 w-full max-w-md shadow-2xl border text-center">
              <div className="mb-5">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                  <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-2">Cancel Booking</h3>
                <p className="text-sm text-gray-600 mb-4">Are you sure you want to cancel this booking?</p>
                <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                  <div className="font-semibold">{cancelModal.booking?.guestName || ''}</div>
                  {cancelModal.booking?.roomNumber && (
                    <div className="text-xs text-gray-500 mt-1">
                      Room {cancelModal.booking.roomNumber} • {cancelModal.booking.roomType}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-center gap-4">
                <button
                  onClick={handleCancelConfirm}
                  className={`min-w-[120px] h-10 px-4 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center`}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Cancelling...
                    </>
                  ) : 'Yes, Cancel'}
                </button>
                <button
                  onClick={() => setCancelModal({ open: false, booking: null })}
                  className="min-w-[100px] h-10 px-4 border border-gray-300 text-gray-700 text-sm rounded-lg bg-white hover:bg-gray-100 transition-colors"
                  disabled={actionLoading}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}


      </div>
    </div>
  );
};

export default Bookings;