import { Outlet } from 'react-router'
import TabNav from './TabNav'

export default function Layout() {
  return (
    <>
      <Outlet />
      <TabNav />
    </>
  )
}
