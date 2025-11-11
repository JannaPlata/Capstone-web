import React, { useEffect } from 'react'
import Navbar from './components/Navbar'
import { data, Route, Routes, useLocation } from 'react-router-dom'
import Home from './pages/Home'
import Footer from './components/Footer'
import AllRooms from './pages/AllRooms'
import RoomDetails from './pages/RoomDetails'
import MyBookings from './pages/hotelOwner/MyBookings'
import Layout from './pages/hotelOwner/Layout'
import Dashboard from './pages/hotelOwner/Dashboard'
import AddRoom from './pages/hotelOwner/AddRoom'
import ListRoom from './pages/hotelOwner/AddRoom'
import Bookings from './pages/hotelOwner/Bookings'
import BookingLogs from './pages/hotelOwner/Booking_logs'
import Events from './pages/Events'
import Dining from './pages/Dining'
import AddEvent from './pages/hotelOwner/AddEvent'
import LoginForm from './components/LoginForm'
import About from './pages/About'
import {Toaster} from 'react-hot-toast'
import { useAppContext } from './context/AppContext'
import HotelReg from './components/HotelReg'
import Guests from './pages/hotelOwner/Guests';



const App = () => {
  
  const isOwnerPath = useLocation().pathname.includes("owner");
  const {showHotelReg} = useAppContext();


  return (
    <div>
      <Toaster />
      {!isOwnerPath && <Navbar />}
      {showHotelReg && <HotelReg />}
    <div className='min-h-[70vh]'>
      <Routes>
        <Route path='/' element={<Home/>} />
        <Route path='/rooms' element={<AllRooms/>} />
        <Route path='/events' element={<Events />} />
        <Route path='/dining' element={<Dining/>}/>
        <Route path='/about' element={<About/>}/>
        
        <Route path='/rooms/:id' element={<RoomDetails/>} />
        <Route path='/my-bookings' element={<MyBookings/>} />
        <Route path='/login' element={<LoginForm/>}/>
        
        <Route path='/owner' element={<Layout/>}>
            <Route index element={<Dashboard />} />
            <Route path="add-room" element={<AddRoom />} />
            <Route path="list-room" element={<ListRoom />} />
            <Route path="bookings" element={<Bookings />} />
            <Route path="booking_logs" element={<BookingLogs />} />
            <Route path="guest" element={<Guests />} />
            <Route path="add-event" element={<AddEvent />} />
        </Route>
      </Routes>
    </div>
    {!isOwnerPath && <Footer />}
    </div>
  )
}

export default App