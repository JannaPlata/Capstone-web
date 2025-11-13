import React from "react";
import { Pencil, Trash2 } from "lucide-react";

const sliceId = (id) => `#${String(id).slice(-6)}`;
const formatPrice = (v) => `₱${Number(v || 0).toLocaleString()}`;

const getStatusConfig = (status) => {
  switch ((status || "").toLowerCase()) {
    case "available":
      return { color: "bg-green-100 text-green-700 border-green-200", label: "Available" };
    case "booked":
      return { color: "bg-blue-100 text-blue-700 border-blue-200", label: "Booked" };
    case "occupied":
      return { color: "bg-orange-100 text-orange-700 border-orange-200", label: "Occupied" };
    case "maintenance":
      return { color: "bg-yellow-100 text-yellow-700 border-yellow-200", label: "Maintenance" };
    default:
      return { color: "bg-gray-100 text-gray-700 border-gray-200", label: "Unknown" };
  }
};

export default function RoomTable({
  rooms,
  loading,
  selectedIds,
  toggleSelectAll,
  toggleSelectOne,
  isAllSelected,
  onEdit,
  onDelete,
  currentPage,
  pageCount,
  onPageChange,
  totalCount = 0,
  ITEMS_PER_PAGE, 
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <div className="p-4 border-b border-gray-200 text-gray-700 font-medium">
          Rooms
        </div>

        <table className="w-full border border-gray-200">
          <thead className="bg-gray-50">
            <tr className="border-b border-gray-200">
              <th className="py-4 px-6 text-left text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-blue-600"
                  checked={!!isAllSelected}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="py-4 px-6 text-left text-sm font-medium text-gray-700">Room ID</th>
              <th className="py-4 px-6 text-left text-sm font-medium text-gray-700">Room Number</th>
              <th className="py-4 px-6 text-left text-sm font-medium text-gray-700">Room Type</th>
              <th className="py-4 px-6 text-left text-sm font-medium text-gray-700">Price per Night</th>
              <th className="py-4 px-6 text-left text-sm font-medium text-gray-700">Capacity</th>
              <th className="py-4 px-6 text-left text-sm font-medium text-gray-700">Status</th>
              <th className="py-4 px-6 text-left text-sm font-medium text-gray-700">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <svg className="animate-spin w-8 h-8 text-gray-400" viewBox="0 0 24 24" fill="none">
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        strokeOpacity="0.2"
                      />
                      <path
                        d="M22 12a10 10 0 00-10-10"
                        stroke="currentColor"
                        strokeWidth="4"
                        strokeLinecap="round"
                      />
                    </svg>
                    <div>Loading rooms...</div>
                  </div>
                </td>
              </tr>
            ) : rooms.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16"
                      />
                    </svg>
                    <p className="text-lg font-medium">No rooms found</p>
                    <p className="text-sm">Try adjusting your search or filter criteria</p>
                  </div>
                </td>
              </tr>
            ) : (
              rooms.map((room) => {
                const statusConfig = getStatusConfig(room.status);
                return (
                  <tr key={room.room_id} className="hover:bg-blue-50 transition-colors">
                    <td className="py-4 px-6">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-blue-600"
                        checked={selectedIds.includes(room.room_id)}
                        onChange={() => toggleSelectOne(room.room_id)}
                      />
                    </td>

                    <td className="py-4 px-6 text-sm font-medium">{sliceId(room.room_id)}</td>
                    <td className="py-4 px-6 text-sm font-medium">{room.roomNumber}</td>
                    <td className="py-4 px-6 text-sm font-medium">{room.roomType}</td>
                    <td className="py-4 px-6 text-sm font-medium">{formatPrice(room.pricePerNight)}</td>
                    <td className="py-4 px-6 text-sm">
                      {room.capacityAdults || 1} Adults, {room.capacityChildren || 0} Children
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${statusConfig.color}`}
                      >
                        {statusConfig.label}
                      </span>
                    </td>

                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onEdit(room)}
                          className="w-8 h-8 inline-flex items-center justify-center rounded hover:bg-blue-100 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4 text-blue-600" />
                        </button>

                        <button
                          onClick={() => onDelete(room.room_id)}
                          className="w-8 h-8 inline-flex items-center justify-center rounded hover:bg-red-100 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
  <div className="flex justify-between items-center px-5 py-3 bg-white border-t border-gray-200">
    <div className="text-sm text-gray-600">
      Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} of {totalCount} rooms
    </div>
    <div className="flex items-center gap-2">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-1.5 border rounded-md text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
      >
        Prev
      </button>

      {/* Calculate page range to display */}
      {Array.from({ length: Math.min(4, pageCount - Math.floor((currentPage - 1) / 4) * 4) }, (_, i) => i + Math.floor((currentPage - 1) / 4) * 4 + 1).map((num) => (
        <button
          key={num}
          onClick={() => onPageChange(num)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium ${num === currentPage ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
        >
          {num}
        </button>
      ))}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= pageCount}
        className="px-3 py-1.5 border rounded-md text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
      >
        Next
      </button>
    </div>
  </div>
)}

    </div>
  );
}
