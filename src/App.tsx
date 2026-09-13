import { useState, useEffect, useCallback } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { unstable_batchedUpdates } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { useWorkspaceStore } from './store';
import { authService } from './services/authService';
import { sessionService } from './services/sessionService';
import { settingsService } from './services/settingsService';
import { serviceItemService } from './services/serviceItemService';
import { bookingService } from './services/bookingService';
import { subscriptionService } from './services/subscriptionService';
import { packageService } from './services/packageService';
import { expenseService } from './services/expenseService';
import { customerService } from './services/customerService';
import { inventoryService } from './services/inventoryService';
import { visitService } from './services/visitService';
import { paymentService } from './services/paymentService';
import { roomService } from './services/roomService';
import { useAutoStartBookings } from './hooks/useAutoStartBookings';
import { useExpenses } from './hooks/useExpenses';
import './i18n/config';

// Static ES6 imports to bypass file:// protocol lazy-loading microtask lag in Electron
import MainLayout from './layout/MainLayout';
import Dashboard from './pages/Dashboard';
import ActiveSessions from './pages/ActiveSessions';
import SessionHistory from './pages/SessionHistory';
import Expenses from './pages/Expenses';
import Reports from './pages/Reports';
import RoomBookings from './pages/RoomBookings';
import Subscriptions from './pages/Subscriptions';
import Settings from './pages/Settings';
import Customers from './pages/Customers';
import Inventory from './pages/Inventory';
import Login from './pages/Login';

const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0F172A]">
    <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
  </div>
);

export default function App() {
  const [isAuthReady, setIsAuthReady] = useState(false);
  useAutoStartBookings();
  useExpenses();

  const {
    user, setUser,
    setSessions,
    setCompletedSessions,
    setSettings,
    setAvailableServices,
    setBookings,
    setRooms,
    setSubscriptions,
    setPackages,
    setCustomers,
    setInventoryItems,
    setInventoryMovements,
    setVisits,
    setPayments,
  } = useWorkspaceStore();

  // ── Real-Time Active & Completed Sessions, Master Data configuration Listeners ──
  useEffect(() => {
    if (!user) return;

    // Proactively guarantee Firestore default rooms exist
    roomService.ensureDefaultRooms().then(rooms => {
      unstable_batchedUpdates(() => setRooms(rooms));
    }).catch(console.error);

    const unsubs = [
      roomService.subscribeToRooms((rooms) => {
        unstable_batchedUpdates(() => setRooms(rooms));
      }),
      sessionService.subscribeToActiveSessions((sessions) => {
        unstable_batchedUpdates(() => setSessions(sessions));
      }),
      sessionService.subscribeToRecentSessions((sessions) => {
        unstable_batchedUpdates(() => setCompletedSessions(sessions));
      }),
      settingsService.subscribeToSettings((settings) => {
        unstable_batchedUpdates(() => setSettings(settings));
      }),
      serviceItemService.subscribeToServices((services) => {
        unstable_batchedUpdates(() => setAvailableServices(services));
      }),
      bookingService.subscribeToBookings((bookings) => {
        unstable_batchedUpdates(() => setBookings(bookings));
      }),
      subscriptionService.subscribeToSubscriptions((subs) => {
        unstable_batchedUpdates(() => setSubscriptions(subs));
      }),
      packageService.subscribeToPackages((packages) => {
        unstable_batchedUpdates(() => setPackages(packages));
      }),
      customerService.subscribeToCustomers((customers) => {
        unstable_batchedUpdates(() => setCustomers(customers));
      }),
      inventoryService.subscribeToInventoryItems((items) => {
        unstable_batchedUpdates(() => setInventoryItems(items));
      }),
      inventoryService.subscribeToMovements((movements) => {
        unstable_batchedUpdates(() => setInventoryMovements(movements));
      }),
      visitService.subscribeToVisits((visits) => {
        unstable_batchedUpdates(() => setVisits(visits));
      }),
      paymentService.subscribeToPayments((payments) => {
        unstable_batchedUpdates(() => setPayments(payments));
      })
    ];

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [
    user, 
    setSessions, 
    setCompletedSessions, 
    setSettings, 
    setAvailableServices, 
    setBookings, 
    setRooms,
    setSubscriptions, 
    setPackages,
    setCustomers,
    setInventoryItems,
    setInventoryMovements,
    setVisits,
    setPayments
  ]);

  // ── Auth Listener ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = authService.onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        let profile = await authService.getUserProfile(firebaseUser.uid);
        const isMainAdmin = firebaseUser.email === 'ali.blal0102@gmail.com';

        if (!profile) {
          const role = isMainAdmin ? 'owner' : 'staff';
          profile = await authService.createUserProfile(
            firebaseUser.uid,
            firebaseUser.email || '',
            role,
          );
        } else if (isMainAdmin && profile.role !== 'owner') {
          profile.role = 'owner';
          await authService.createUserProfile(
            firebaseUser.uid,
            firebaseUser.email || '',
            'owner',
          );
        }

        unstable_batchedUpdates(() => {
          setUser(profile);
        });
      } else {
        unstable_batchedUpdates(() => {
          setUser(null);
        });
      }

      unstable_batchedUpdates(() => {
        setIsAuthReady(true);
      });
    });

    return () => unsubscribe();
  }, [setUser]);

  if (!isAuthReady) return <LoadingScreen />;

  return (
    <HashRouter>
      <Routes>
        {user ? (
          <Route element={<MainLayout />}>
            <Route path="/"              element={<Dashboard />} />
            <Route path="/sessions"      element={<ActiveSessions />} />
            <Route path="/history"       element={<SessionHistory />} />
            <Route path="/expenses"      element={<Expenses />} />
            <Route path="/reports"       element={<Reports />} />
            <Route path="/rooms"         element={<RoomBookings />} />
            <Route path="/subscriptions" element={<Subscriptions />} />
            <Route path="/customers"     element={<Customers />} />
            <Route path="/inventory"     element={<Inventory />} />
            <Route path="/settings"      element={<Settings />} />
            <Route path="*"             element={<Navigate to="/" replace />} />
          </Route>
        ) : (
          <Route path="*" element={<Login />} />
        )}
      </Routes>
    </HashRouter>
  );
}