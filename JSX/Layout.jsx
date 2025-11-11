import React, { useState } from 'react'
import NavBar from '../../components/hotelOwner/NavBar'
import SideBar from '../../components/hotelOwner/SideBar'
import { Outlet } from 'react-router-dom'

const Layout = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  return (
    <div className='flex flex-col min-h-screen'>
        <NavBar onToggleSidebar={() => setIsSidebarCollapsed((p)=>!p)} isCollapsed={isSidebarCollapsed} isHovered={isSidebarHovered} />
        <div className='flex flex-1'>
          <SideBar isCollapsed={isSidebarCollapsed} onHoverChange={setIsSidebarHovered} />
          <div className='flex-1 p-4 pt-10 md:px-10'>
            <Outlet />
          </div>
        </div>
    </div>
  )
}

export default Layout