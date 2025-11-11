import React, { useEffect, useState } from "react";

const roomTypeMap = {
  "Dormitory Room": 1,
  "Superior Queen": 2,
  "Superior Twin": 3,
  "Deluxe Queen": 4,
  "Deluxe Twin": 5,
  "Presidential Queen": 6,
  "Presidential Twin": 7,
  "Family Room": 8,
};

export default function RoomFormModal({ isOpen, onClose, initialData = null, onAdd, onUpdate, onSaveBookingNotes }) {
  const [loading, setLoading] = useState(false); 

  const isBookingView = initialData && initialData.booking !== undefined;


  const [form, setForm] = useState({
    roomNumber: "",
    roomType: "Dormitory Room",
    roomTypeId: roomTypeMap["Dormitory Room"],
    pricePerNight: "",
    capacityAdults: 1,
    capacityChildren: 0,
    status: "available",
  });

  useEffect(() => {
    if (!initialData) {
      setForm({
        roomNumber: "",
        roomType: "Dormitory Room",
        roomTypeId: roomTypeMap["Dormitory Room"],
        pricePerNight: "",
        capacityAdults: 1,
        capacityChildren: 0,
        status: "available",
      });
    } else if (isBookingView) {
      // booking view - keep data separate; form unused
    } else {
      setForm({
        roomNumber: initialData.roomNumber || "",
        roomType: initialData.roomType || "Dormitory Room",
        roomTypeId: initialData.roomTypeId || roomTypeMap[initialData.roomType] || roomTypeMap["Dormitory Room"],
        pricePerNight: initialData.pricePerNight ?? "",
        capacityAdults: initialData.capacityAdults ?? 1,
        capacityChildren: initialData.capacityChildren ?? 0,
        status: initialData.status || "available",
      });
    }
  }, [initialData]);

 const handleSubmit = async () => {
  if (isBookingView) {
    onClose();
    return;
  }

  if (!form.roomNumber.trim()) {
    alert("Please enter a room number");
    return;
  }

  const payload = {
    room_number: form.roomNumber.trim(),
    room_type: form.roomType,
    room_type_id: form.roomTypeId || roomTypeMap[form.roomType],
    price_per_night: Number(form.pricePerNight) || 0,
    capacity_adults: Number(form.capacityAdults) || 0,
    capacity_children: Number(form.capacityChildren) || 0,
    status: form.status || "Available",
  };

  console.log("🧾 handleSubmit payload:", payload); 

  setLoading(true);
  try {
    let ok;
    if (initialData && initialData.room_id) {
      
      ok = await onUpdate(initialData.room_id, payload);
    } else {
      
      ok = await onAdd(payload);
    }

    if (ok) onClose();
  } finally {
    setLoading(false); 
  }
};




  const saveNotes = async () => {
    if (!initialData?.booking?.booking_id) {
      onClose();
      return;
    }
    // send notes via parent's handler
    if (onSaveBookingNotes) {
      await onSaveBookingNotes(initialData.booking.booking_id, initialData.booking.notes ?? "");
      onClose();
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">{isBookingView ? "Reservation Details" : initialData ? "Edit Room" : "Add New Room"}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {isBookingView ? (
            <>
              {initialData.booking ? (
                <div className="space-y-4">
                  <div className="text-sm text-gray-600">Reservation Details</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><div className="text-xs text-gray-500">Name</div><div className="font-medium">{initialData.booking.guest_name}</div></div>
                    <div><div className="text-xs text-gray-500">Email</div><div className="font-medium">{initialData.booking.email}</div></div>
                    <div><div className="text-xs text-gray-500">Phone</div><div className="font-medium">{initialData.booking.phone ?? "—"}</div></div>
                    <div><div className="text-xs text-gray-500">Room Type</div><div className="font-medium">{initialData.booking.room_type}</div></div>
                    <div><div className="text-xs text-gray-500">Adults</div><div className="font-medium">{initialData.booking.adults ?? initialData.booking.capacity_adults ?? 1}</div></div>
                    <div><div className="text-xs text-gray-500">Children</div><div className="font-medium">{initialData.booking.children ?? initialData.booking.capacity_children ?? 0}</div></div>
                    <div><div className="text-xs text-gray-500">Check-in</div><div className="font-medium">{initialData.booking.check_in ? new Date(initialData.booking.check_in).toLocaleDateString() : (initialData.booking.check_in_date || "—")}</div></div>
                    <div><div className="text-xs text-gray-500">Check-out</div><div className="font-medium">{initialData.booking.check_out ? new Date(initialData.booking.check_out).toLocaleDateString() : (initialData.booking.check_out_date || "—")}</div></div>
                    <div><div className="text-xs text-gray-500">Price / night</div><div className="font-medium">₱{Number(initialData.booking.price_per_night ?? 0).toLocaleString()}</div></div>
                    <div><div className="text-xs text-gray-500">Total price</div><div className="font-semibold">₱{Number(initialData.booking.total_price ?? 0).toLocaleString()}</div></div>
                    <div><div className="text-xs text-gray-500">Status</div><div className="font-medium">{initialData.booking.status}</div></div>
                    <div><div className="text-xs text-gray-500">Payment Status</div><div className="font-medium">{initialData.booking.payment_status || "Not Paid"}</div></div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500 mb-2">Note</div>
                    <textarea rows={4} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" defaultValue={initialData.booking.notes ?? ""} onChange={(e) => (initialData.booking.notes = e.target.value)} />
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-600">No reservation found for this room.</div>
              )}
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Room Number</label>
                  <input type="text" value={form.roomNumber} onChange={(e) => setForm((p) => ({ ...p, roomNumber: e.target.value }))} placeholder="Enter room number" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Room Type</label>
                  <select value={form.roomType} onChange={(e) => setForm((p) => ({ ...p, roomType: e.target.value, roomTypeId: roomTypeMap[e.target.value] }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white">
                    {Object.keys(roomTypeMap).map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Price per Night</label>
                  <input type="number" value={form.pricePerNight} onChange={(e) => setForm((p) => ({ ...p, pricePerNight: e.target.value }))} placeholder="0" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white">
                    <option value="available">Available</option>
                    <option value="booked">Booked</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Capacity (Adults)</label>
                  <select value={form.capacityAdults} onChange={(e) => setForm((p) => ({ ...p, capacityAdults: Number(e.target.value) }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white">
                    {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Capacity (Children)</label>
                  <select value={form.capacityChildren} onChange={(e) => setForm((p) => ({ ...p, capacityChildren: Number(e.target.value) }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white">
                    {[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end p-6 border-t border-gray-200 gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>

          {isBookingView ? (
            <button onClick={saveNotes} className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 font-semibold">Save Notes</button>
          ) : (
           <button
  onClick={handleSubmit}
  disabled={loading}
  className={`px-4 py-2 rounded-lg font-semibold transition-all duration-200 text-white ${
    loading
      ? "bg-gray-400 cursor-not-allowed"
      : "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
  }`}
>
  {loading ? (
    <span className="flex items-center justify-center gap-2">
      <svg
        className="animate-spin h-5 w-5 text-white"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        ></circle>
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8v8H4z"
        ></path>
      </svg>
      Saving...
    </span>
  ) : initialData && initialData.room_id ? (
    "Update Room"
  ) : (
    "Save Room"
  )}
</button>


          )}
        </div>
      </div>
    </div>
  );
}
