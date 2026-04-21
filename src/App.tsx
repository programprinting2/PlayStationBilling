import React from "react";
import { Routes, Route } from "react-router-dom";
import Dashboard from "./components/Dashboard";
import AdminDashboard from "./components/AdminDashboard";
import Navigation from "./components/Navigation";
import Cashier from "./components/Cashier";
import CashierSession from "./components/CashierSession";
import ActiveRentals from "./components/ActiveRentals";
import ScheduledBookings from "./components/ScheduledBookings";
import Customers from "./components/Customers";
import Pembelian from "./components/Pembelian";
import Products from "./components/Products";
import Sales from "./components/Sales";
import Payments from "./components/Payments";
import Assembly from "./components/Assembly";
import Bookkeeping from "./components/Bookkeeping";
import Consoles from "./components/Consoles";
import EquipmentManagement from "./components/EquipmentManagement";
import RateManagement from "./components/RateManagement";
import UserManagement from "./components/UserManagement";
import VoucherManagement from "./components/VoucherManagement";
import Settings from "./components/Settings";
import MaintenanceManagement from "./components/MaintenanceManagement";
import RateProfilePage from "./components/RateProfilePage";
import DeviceManagement from "./components/DeviceManagement";
import RFIDCards from "./components/RFIDCards";
import LoginPage from "./pages/LoginPage";
import { useAuth } from "./contexts/AuthContext";
import { TimerProvider } from "./contexts/TimerContext";
import Games from "./components/Games";

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/*" element={<AppLayout />} />
    </Routes>
  );
};

const AppLayout: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = React.useState("dashboard");
  const isAdministrator =
    user?.roles?.name?.toLowerCase() === "administrator" ||
    user?.roles?.id?.toLowerCase() === "admin";

  if (isLoading) {
    // Tampilkan loading spinner
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return isAdministrator ? <AdminDashboard /> : <Dashboard />;
      // case "cashier":
      //   return <Cashier />;
      case "cashier-session":
        return <CashierSession />;
      case "rentals":
        return <ActiveRentals />;
      case "pembelian":
        return <Pembelian />;
      case "bookings":
        return <ScheduledBookings />;
      // case "customers":
      //   return <Customers />;
      case "products":
        return <Products />;
      case "assembly":
        return <Assembly />;
      case "games":
        return <Games />;
      case "sales":
        return <Sales />;
      // case "payments":
      //   return <Payments />;
      case "bookkeeping":
        return <Bookkeeping />;
      case "consoles":
        return <Consoles />;
      case "equipment":
        return <EquipmentManagement />;
      case "rates":
        return <RateManagement />;
      case "vouchers":
        return <VoucherManagement />;
      case "users":
        return <UserManagement />;
      case "rfid-cards":
        return <RFIDCards />;
      case "settings":
        return <Settings />;
      case "maintenance":
        return <MaintenanceManagement />;
      // case "rate-profiles":
      //   return <RateProfilePage />;
      case "device":
        return <DeviceManagement />;
      default:
        return isAdministrator ? <AdminDashboard /> : <Dashboard />;
    }
  };

  return (
    <TimerProvider>
      <div className="flex bg-gray-100 min-h-screen">
        <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
        <main className="flex-1 overflow-y-auto">{renderContent()}</main>
      </div>
    </TimerProvider>
  );
};

export default App;
