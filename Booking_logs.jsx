import React, { useState, useMemo, useEffect } from 'react';
import Title from '../../components/Title';

// Load logs from backend

const STATUS_CONFIG = {
  'Confirmed': { 
    color: 'bg-green-100 text-green-700 border-green-200',
    icon: '✅',
    label: 'Confirmed'
  },
  'Cancelled': { 
    color: 'bg-red-100 text-red-700 border-red-200',
    icon: '❌',
    label: 'Cancelled'
  },
  'Checked-in': { 
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: '🔵',
    label: 'Checked-in'
  },
  'Checked-out': { 
    color: 'bg-gray-100 text-gray-700 border-gray-200',
    icon: '✓',
    label: 'Checked-out'
  },
};

const PAYMENT_STATUS_CONFIG = {
  'Pending': {
    color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    label: 'Pending'
  },
  'Partial Payment': {
    color: 'bg-orange-100 text-orange-700 border-orange-200',
    label: 'Partial Payment'
  },
  'Payment Complete': {
    color: 'bg-green-100 text-green-700 border-green-200',
    label: 'Payment Complete'
  },
  // Legacy support for old values (will be migrated)
  'Paid': {
    color: 'bg-orange-100 text-orange-700 border-orange-200',
    label: 'Partial Payment'
  },
  'Completed': {
    color: 'bg-green-100 text-green-700 border-green-200',
    label: 'Payment Complete'
  },
  'Not Paid': {
    color: 'bg-red-100 text-red-700 border-red-200',
    label: 'Not Paid'
  },
};

const ROOM_TYPES = ['All', 'Dormitory Room', 'Superior Queen', 'Superior Twin', 'Deluxe Queen', 'Deluxe Twin', 'Presidential Queen', 'Presidential Twin', 'Family Room'];
const STATUS_OPTIONS = ['All', 'Confirmed', 'Checked-in', 'Checked-out', 'Cancelled'];
const PAYMENT_STATUS_OPTIONS = ['All', 'Pending', 'Partial Payment', 'Payment Complete'];

const BookingLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const res = await fetch('http://localhost:8000/api/logs/getBookingLogs.php');
        const data = await res.json();
        const mapped = (Array.isArray(data.data) ? data.data : []).map((l, idx) => {
          const rawCheckIn = l.check_in;
          const rawCheckOut = l.check_out;
          const sanitizeDate = (value) => {
            if (!value) return '';
            const trimmed = String(value).trim();
            if (!trimmed || trimmed === '0000-00-00 00:00:00' || trimmed === '0000-00-00') {
              return '';
            }
            return trimmed;
          };
          
          // Normalize guest name: collapse whitespace/newlines so it appears on a single line
          const rawGuest = l.guest_name ?? 'Guest';
          const normalizedGuest = String(rawGuest).replace(/\s+/g, ' ').trim();

          return {
            id: l.log_id ?? idx,
            logId: String(l.log_id ?? idx),
            bookingId: String(l.booking_id ?? ''),
            guestName: normalizedGuest,
            email: l.email ?? '',
            room: l.room ?? '-',
            roomNumber: l.room_number ?? '',
            roomType: l.room_type ?? l.type_name ?? '',
            checkIn: sanitizeDate(rawCheckIn),
            checkOut: sanitizeDate(rawCheckOut),
            status: l.status ?? 'Confirmed',
            paymentStatus: l.payment_status ?? 'Pending',
            lastAction: l.last_action ?? '',
            timestamp: l.action_timestamp ?? '',
            performedBy: l.performed_by || 'System',
          };
        });
        setLogs(mapped);
      } catch (e) {
        console.error('Failed to load logs', e);
        setLogs([]);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('All');
  const [roomTypeFilter, setRoomTypeFilter] = useState('All');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const pageSize = 10; // Fixed at 10
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState('action_timestamp');
  const [sortDirection, setSortDirection] = useState('desc');
  const [exporting, setExporting] = useState(false);

  // Filtered and sorted logs
  const filteredLogs = useMemo(() => {
    let filtered = logs.filter(log => {
      const searchLower = search.toLowerCase();
      const matchesSearch = 
        log.logId.toLowerCase().includes(searchLower) ||
        log.bookingId.toLowerCase().includes(searchLower) ||
        log.guestName.toLowerCase().includes(searchLower) ||
  log.room.toLowerCase().includes(searchLower) ||
  (log.roomType || '').toString().toLowerCase().includes(searchLower) ||
        (log.roomNumber || '').toString().toLowerCase().includes(searchLower);
      
      const matchesStatus = statusFilter === 'All' || log.status === statusFilter;
      const matchesPaymentStatus = paymentStatusFilter === 'All' || log.paymentStatus === paymentStatusFilter;
  const matchesRoomType = roomTypeFilter === 'All' || (log.roomType || '').includes(roomTypeFilter);
      
      const matchesDateRange = 
        (!dateRange.start && !dateRange.end) ||
        (!dateRange.start && new Date(log.checkIn) <= new Date(dateRange.end)) ||
        (!dateRange.end && new Date(log.checkIn) >= new Date(dateRange.start)) ||
        (new Date(log.checkIn) >= new Date(dateRange.start) && new Date(log.checkIn) <= new Date(dateRange.end));
      
      return matchesSearch && matchesStatus && matchesPaymentStatus && matchesRoomType && matchesDateRange;
    });

    // Sorting
    filtered.sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];
      
      if (sortField === 'timestamp' || sortField === 'action_timestamp' || sortField === 'checkIn' || sortField === 'checkOut') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [logs, search, statusFilter, paymentStatusFilter, roomTypeFilter, dateRange, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredLogs.length / pageSize);
  const paginatedLogs = filteredLogs.slice((page - 1) * pageSize, page * pageSize);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) setPage(newPage);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setPage(1);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      // Build query parameters
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter !== 'All') params.append('status', statusFilter);
      if (paymentStatusFilter !== 'All') params.append('payment_status', paymentStatusFilter);
      if (roomTypeFilter !== 'All') params.append('room_type', roomTypeFilter);
      if (dateRange.start) params.append('date_from', dateRange.start);
      if (dateRange.end) params.append('date_to', dateRange.end);
      
      console.log('Exporting with params:', params.toString());
      
      // Fetch the CSV file
      const response = await fetch(`http://localhost:8000/api/logs/exportBookingLogs.php?${params.toString()}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Export response error:', response.status, errorText);
        throw new Error(`Export failed: ${response.status} ${response.statusText}`);
      }
      
      // Check if response is actually CSV
      const contentType = response.headers.get('content-type');
      console.log('Response content-type:', contentType);
      
      // Get the blob data
      const blob = await response.blob();
      console.log('Blob size:', blob.size, 'bytes');
      
      if (blob.size === 0) {
        throw new Error('Export file is empty');
      }
      
      // Default filename
      const defaultFilename = `booking_logs_${new Date().toISOString().split('T')[0]}.csv`;
      
      // Helper function to trigger download (fallback method)
      const triggerDownload = () => {
        try {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = defaultFilename;
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          
          // Clean up after a short delay
          setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
          }, 100);
        } catch (downloadError) {
          console.error('Download trigger failed:', downloadError);
          throw downloadError;
        }
      };
      
      // Try File System Access API first (Chrome, Edge, Opera)
      // This requires HTTPS or localhost and must be called from a user gesture
      const useFileSystemAPI = 'showSaveFilePicker' in window;
      
      if (useFileSystemAPI) {
        try {
          console.log('Attempting to use File System Access API');
          
          // Show file picker dialog - this will open the file explorer
          const fileHandle = await window.showSaveFilePicker({
            suggestedName: defaultFilename,
            types: [{
              description: 'CSV Files',
              accept: {
                'text/csv': ['.csv'],
                'application/vnd.ms-excel': ['.csv'],
              },
            }],
          });
          
          console.log('File handle obtained, writing file...');
          
          // Write the blob to the selected file
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();
          
          console.log('File saved successfully using File System Access API');
          // Success - don't trigger download
          return;
        } catch (filePickerError) {
          console.log('File System Access API error:', filePickerError.name, filePickerError.message);
          
          // User cancelled the dialog - this is fine, just return
          if (filePickerError.name === 'AbortError') {
            console.log('User cancelled file picker');
            return;
          }
          
          // Security error, permission denied, or other error - fall back to download
          console.warn('File System Access API failed, falling back to download method. Error:', filePickerError);
          // Continue to download fallback below
        }
      } else {
        console.log('File System Access API not available in this browser');
      }
      
      // Fallback: Use standard download method
      // This will download to the default download folder
      // In most browsers, users can change the download location in browser settings
      console.log('Using standard download method');
      triggerDownload();
    } catch (error) {
      console.error('Export failed:', error);
      alert(`Failed to export booking logs: ${error.message || 'Unknown error'}\n\nPlease check the browser console for more details.`);
    } finally {
      setExporting(false);
    }
  };


  const formatDate = (dateString) => {
    if (!dateString || dateString === '0000-00-00 00:00:00' || dateString === '0000-00-00') return '—';
    const date = new Date(dateString);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${month}/${day}/${year}`;
  };

  // formatTime removed because the UI no longer shows the time portion under dates

  const formatDateTime = (dateString) => {
    if (!dateString || dateString === '0000-00-00 00:00:00' || dateString === '0000-00-00') return '—';
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="w-full flex justify-center">
      <div className="w-full max-w-7xl px-4">
        {/* Page Header */}
        <div className="mb-8">
          {/* Title and Action Buttons */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-800">Booking Logs</h1>
              <p className="text-gray-600 mt-1">Manage and track all booking activities</p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleExport}
                disabled={exporting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exporting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Exporting...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Search Box */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <input
                type="text"
                placeholder="Search by log ID, booking ID, guest name, or room..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {STATUS_OPTIONS.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            {/* Payment Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Status</label>
              <select
                value={paymentStatusFilter}
                onChange={e => { setPaymentStatusFilter(e.target.value); setPage(1); }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {PAYMENT_STATUS_OPTIONS.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            {/* Room Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Room Type</label>
              <select
                value={roomTypeFilter}
                onChange={e => { setRoomTypeFilter(e.target.value); setPage(1); }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {ROOM_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Date Range Filter */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Check-in Date Range</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={e => { setDateRange(prev => ({ ...prev, start: e.target.value })); setPage(1); }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <span className="flex items-center text-gray-500">to</span>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={e => { setDateRange(prev => ({ ...prev, end: e.target.value })); setPage(1); }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Results Count */}
            <div className="flex items-end">
              <p className="text-sm text-gray-600">
                {loading ? (
                  'Loading...'
                ) : (
                  `Showing ${filteredLogs.length === 0 ? 0 : ((page - 1) * pageSize) + 1}–${Math.min(page * pageSize, filteredLogs.length)} of ${filteredLogs.length} logs`
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
          <table className="w-full table-auto min-w-0">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-4 px-6 text-center text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 whitespace-nowrap" onClick={() => handleSort('logId')}>
                  <div className="flex items-center justify-center gap-2">
                    Log ID
                    {sortField === 'logId' && (
                      <svg className={`w-4 h-4 ${sortDirection === 'asc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    )}
                  </div>
                </th>
                <th className="py-4 px-6 text-left text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 whitespace-nowrap" onClick={() => handleSort('bookingId')}>
                  <div className="flex items-center gap-2">
                    Booking ID
                    {sortField === 'bookingId' && (
                      <svg className={`w-4 h-4 ${sortDirection === 'asc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    )}
                  </div>
                </th>
                <th className="py-4 px-6 text-left text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('guestName')}>
                  <div className="flex items-center gap-2">
                    Guest Name
                    {sortField === 'guestName' && (
                      <svg className={`w-4 h-4 ${sortDirection === 'asc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    )}
                  </div>
                </th>
                <th className="py-4 px-6 text-center text-sm font-semibold text-gray-900 whitespace-nowrap">Payment Status</th>
                <th className="py-4 px-6 text-center text-sm font-semibold text-gray-900 whitespace-nowrap">Status</th>
                <th className="py-4 px-6 text-center text-sm font-semibold text-gray-900 whitespace-nowrap">Room No#</th>
                <th className="py-4 px-6 text-left text-sm font-semibold text-gray-900">Room Type</th>
                <th className="py-4 px-4 text-left text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('checkIn')}>
                  <div className="flex items-center gap-2">
                    Check-In
                    {sortField === 'checkIn' && (
                      <svg className={`w-4 h-4 ${sortDirection === 'asc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    )}
                  </div>
                </th>
                <th className="py-4 px-4 text-left text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('checkOut')}>
                  <div className="flex items-center gap-2">
                    Check-Out
                    {sortField === 'checkOut' && (
                      <svg className={`w-4 h-4 ${sortDirection === 'asc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    )}
                  </div>
                </th>
                <th className="py-4 px-4 text-left text-sm font-semibold text-gray-900">Last Action</th>
                <th className="py-4 px-4 text-left text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('action_timestamp')}>
                  <div className="flex items-center gap-2">
                    Timestamp
                    {sortField === 'action_timestamp' && (
                      <svg className={`w-4 h-4 ${sortDirection === 'asc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                      <p className="text-sm text-gray-500">Loading logs...</p>
                    </div>
                  </td>
                </tr>
              ) : paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-lg font-medium">No logs found</p>
                      <p className="text-sm">Try adjusting your search or filter criteria</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedLogs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6 text-sm text-gray-600 font-mono text-center whitespace-nowrap">{log.logId}</td>
                    <td className="py-4 px-6">
                      <span className="text-sm font-medium text-blue-600 hover:text-blue-800 cursor-pointer">
                        {log.bookingId}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-semibold text-gray-900">{log.guestName}</div>
                      {log.email && (
                        <div className="text-xs text-gray-500 mt-0.5">{log.email}</div>
                      )}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${PAYMENT_STATUS_CONFIG[log.paymentStatus]?.color || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                        {PAYMENT_STATUS_CONFIG[log.paymentStatus]?.label || log.paymentStatus}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${STATUS_CONFIG[log.status]?.color || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                        <span>{STATUS_CONFIG[log.status]?.icon}</span>
                        {STATUS_CONFIG[log.status]?.label || log.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center whitespace-nowrap">
                      <div className="font-medium text-gray-900">{log.roomNumber || '—'}</div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-medium text-gray-900">{log.roomType || '—'}</div>
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-900 text-center">
                      {log.checkIn && log.checkIn.trim() !== '' ? (
                        <div>{formatDate(log.checkIn)}</div>
                      ) : (
                        <div>—</div>
                      )}
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-900 text-center">
                      {log.checkOut && log.checkOut.trim() !== '' ? (
                        <div>{formatDate(log.checkOut)}</div>
                      ) : (
                        <div>—</div>
                      )}
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-900">{log.lastAction || '—'}</td>
                    <td className="py-4 px-6 text-sm text-gray-600">{formatDateTime(log.timestamp)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && (
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6">
            <div className="text-sm text-gray-600">
              Showing {filteredLogs.length === 0 ? 0 : ((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, filteredLogs.length)} of {filteredLogs.length} logs
            </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1}
              className="px-3 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            
            <div className="flex items-center gap-1">
              {(() => {
                const maxVisible = 4;
                let startPage, endPage;
                
                if (totalPages <= maxVisible) {
                  // Show all pages if total is 4 or less
                  startPage = 1;
                  endPage = totalPages;
                } else {
                  // Calculate sliding window of 4 pages
                  // Start from the first page of the current group of 4
                  startPage = Math.floor((page - 1) / maxVisible) * maxVisible + 1;
                  endPage = Math.min(startPage + maxVisible - 1, totalPages);
                }
                
                const pages = [];
                for (let i = startPage; i <= endPage; i++) {
                  pages.push(i);
                }
                
                return pages.map(pageNum => (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      pageNum === page
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {pageNum}
                  </button>
                ));
              })()}
            </div>
            
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page === totalPages || totalPages === 0}
              className="px-3 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
        )}
      </div>
    </div>
  );
};

export default BookingLogs;

