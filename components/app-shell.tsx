"use client";

import { useState, useEffect } from "react";
import Sidebar, { type Page } from "@/components/sidebar";
import TopNav from "@/components/topnav";
import MobileBottomNav from "@/components/mobile-bottom-nav";
import OfflineAccessNotice from "@/components/offline-access-notice";
import { TransactionDetailModal } from "@/components/transaction-detail-modal";
import { type Transaction, type Notification } from "@/lib/data";
import { loadLoyaltySettings, loadBusinessProfile, type BusinessProfile } from "@/lib/settings-store";
import DashboardPage from "@/components/pages/dashboard";
import ProcessingPage from "@/components/pages/processing";
import TransactionsPage from "@/components/pages/transactions";
import ClaimVerificationPage from "@/components/pages/claim-verification";
import ReportsPage from "@/components/pages/reports";
import SettingsPage from "@/components/pages/settings";
import LoyaltyPage from "@/components/pages/loyalty";
import ProfilePage from "@/components/pages/profile";
import ChangePasswordPage from "@/components/pages/change-password";
import DataImportPage from "@/components/pages/data-import";
import StaffManagementPage from "@/components/pages/staff-management";
import AuditLogsPage from "@/components/pages/audit-logs";
import type { UserProfile } from "@/lib/auth";
import { useTransactions } from "@/hooks/use-transactions";
import { toast } from "@/hooks/use-toast";
import { processSettingsQueue } from "@/lib/offline-settings-sync";
import { getBrowserAccessToken } from "@/lib/supabase/browser-session";
import { isOnline, subscribeNetworkStatus } from "@/lib/network-status";

interface AppShellProps {
  onSignOut: () => void;
  adminProfile: UserProfile;
  onProfileUpdate: (updates: Partial<UserProfile>) => void;
}

export default function AppShell({ onSignOut, adminProfile, onProfileUpdate }: AppShellProps) {
  const [activePage, setActivePage] = useState<Page>("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [detailTxn, setDetailTxn] = useState<Transaction | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editTxn, setEditTxn] = useState<Transaction | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [loyaltyEnabled, setLoyaltyEnabled] = useState<boolean>(() => loadLoyaltySettings().enabled);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>(() => loadBusinessProfile());
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const {
    transactions: txns,
    loading: transactionsLoading,
    error: transactionsError,
    syncStatus,
    pendingChangesCount,
    lastSyncError,
    retrySync,
    createTransaction,
    updateTransaction,
    resolveScannedValue,
  } = useTransactions();

  // Generate notifications from actual transactions
  useEffect(() => {
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    
    const newNotifications: Notification[] = [];
    
    txns.forEach((txn) => {
      // Skip voided and claimed transactions
      if (txn.status === 'Voided' || txn.status === 'Claimed') return;
      
      const arrivalDate = new Date(txn.arrivalDateTime);
      const timeDiff = now.getTime() - arrivalDate.getTime();
      const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
      const daysAgo = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
      
      let timeStr = '';
      if (hoursAgo < 1) {
        const minutesAgo = Math.floor(timeDiff / (1000 * 60));
        timeStr = minutesAgo <= 1 ? 'Just now' : `${minutesAgo} min ago`;
      } else if (hoursAgo < 24) {
        timeStr = hoursAgo === 1 ? '1 hour ago' : `${hoursAgo} hours ago`;
      } else {
        timeStr = daysAgo === 1 ? '1 day ago' : `${daysAgo} days ago`;
      }
      
      // READY notifications - for items that just became ready
      if (txn.status === 'Ready' && hoursAgo < 24) {
        newNotifications.push({
          id: `ready-${txn.id}`,
          type: 'ready',
          ticketId: txn.ticketId,
          customerName: txn.customerName,
          time: timeStr,
          createdAt: txn.arrivalDateTime,
        });
      }
      
      // UNCLAIMED notifications - for items ready for more than 2 days
      if (txn.status === 'Ready' && arrivalDate < twoDaysAgo) {
        newNotifications.push({
          id: `unclaimed-${txn.id}`,
          type: 'unclaimed',
          ticketId: txn.ticketId,
          customerName: txn.customerName,
          time: timeStr,
          createdAt: txn.arrivalDateTime,
        });
      }
    });
    
    setNotifications(newNotifications);
  }, [txns]);

  const handleTransactionDetail = (ticketId: string) => {
    const txn = txns.find((t) => t.ticketId === ticketId) ?? null;
    setDetailTxn(txn);
    setDetailOpen(true);
  };

  const handleEditTransaction = (ticketId: string) => {
    const txn = txns.find((t) => t.ticketId === ticketId) ?? null;
    if (!txn) return;
    setEditTxn(txn);
    setEditOpen(true);
    setDetailOpen(false);
    // Always route edits through the Transactions page inline modal
    setActivePage("transactions");
    setMobileMenuOpen(false);
  };

  const handleEditComplete = () => {
    setEditTxn(null);
    setEditOpen(false);
  };

  const renderPage = () => {
    switch (activePage) {
      case "dashboard": return <DashboardPage transactions={txns} loyaltyEnabled={loyaltyEnabled} role={adminProfile.role} onNavigate={handleNavigate} />;
      case "processing":
        return (
          <ProcessingPage
            transactions={txns}
            loading={transactionsLoading}
            error={transactionsError}
            onUpdateTransaction={async (ticketId, updates) => {
              return await updateTransaction(ticketId, updates);
            }}
            onViewTransaction={handleTransactionDetail}
            adminName={adminProfile.name}
          />
        );
      case "transactions":
        return (
          <TransactionsPage
            transactions={txns}
            loading={transactionsLoading}
            error={transactionsError}
            loyaltyEnabled={loyaltyEnabled}
            onCreateTransaction={createTransaction}
            onUpdateTransaction={updateTransaction}
            editTicketId={editOpen ? editTxn?.ticketId : undefined}
            onEditComplete={handleEditComplete}
          />
        );
      case "claim-verification":
        return (
          <ClaimVerificationPage
            transactions={txns}
            loading={transactionsLoading}
            error={transactionsError}
            onUpdateTransaction={updateTransaction}
            onResolveScannedValue={resolveScannedValue}
          />
        );
      case "reports": return <ReportsPage transactions={txns} />;
      case "settings-pricing":
      case "settings-service-types":
      case "settings-backup":
        return <SettingsPage page={activePage} />;
      case "settings-business-profile":
        return <SettingsPage page={activePage} onBusinessProfileChange={setBusinessProfile} />;
      case "settings-loyalty":
        return <SettingsPage page={activePage} loyaltyEnabled={loyaltyEnabled} onLoyaltyEnabledChange={setLoyaltyEnabled} />;
      case "settings-data-import":
        return <DataImportPage onViewTransactions={() => handleNavigate("transactions")} />;
      case "staff-management": return <StaffManagementPage />;
      case "audit-logs": return <AuditLogsPage />;
      case "loyalty": return <LoyaltyPage loyaltyEnabled={loyaltyEnabled} />;
      case "profile": return <ProfilePage userProfile={adminProfile} shopName={businessProfile.shopName} contactNumber={businessProfile.contactNumber} onAvatarUpdate={(url) => onProfileUpdate({ avatarUrl: url })} />;
      case "change-password": return <ChangePasswordPage adminProfile={adminProfile} onProfileUpdate={onProfileUpdate} />;
      default: return <DashboardPage transactions={txns} loyaltyEnabled={loyaltyEnabled} />;
    }
  };

  // Pages staff are NOT allowed to access at all
  const STAFF_BLOCKED: Page[] = [
    "reports",
    "settings-backup",
    "settings-data-import",
    "staff-management",
    "audit-logs",
  ];
  const OFFLINE_BLOCKED: Page[] = ["reports", "staff-management", "audit-logs", "settings-data-import"];
  const showOfflineNotice = !noticeDismissed && syncStatus !== "online";

  useEffect(() => {
    if (syncStatus === "online") {
      setNoticeDismissed(false);
    }
  }, [syncStatus]);

  useEffect(() => {
    const process = async () => {
      await processSettingsQueue(async () => {
        const token = await getBrowserAccessToken();
        const headers: Record<string, string> = {};
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
        return headers;
      });
    };

    if (isOnline()) {
      void process();
    }

    return subscribeNetworkStatus((online) => {
      if (online) {
        void process();
        toast({
          title: "Back Online",
          description: "Queued changes are syncing in the background.",
        });
      }
    });
  }, []);

  const handleNavigate = (page: Page) => {
    if (adminProfile.role === "staff" && STAFF_BLOCKED.includes(page)) {
      // Redirect to dashboard and notify
      setActivePage("dashboard");
      setMobileMenuOpen(false);
      toast({
        title: "Access Denied",
        description: "You don't have permission to access this page.",
        variant: "destructive",
      });
      return;
    }
    if (syncStatus !== "online" && OFFLINE_BLOCKED.includes(page)) {
      setActivePage("dashboard");
      setMobileMenuOpen(false);
      toast({
        title: "Offline Mode",
        description: "This page requires internet connectivity.",
        variant: "destructive",
      });
      return;
    }
    setActivePage(page);
    setMobileMenuOpen(false);
  };

  return (
    <>
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar — hidden on mobile unless menu is open */}
      <div
        className={`
          fixed inset-y-0 left-0 z-40 lg:static lg:z-auto lg:flex
          transition-transform duration-300
          ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        <Sidebar activePage={activePage} onNavigate={handleNavigate} loyaltyEnabled={loyaltyEnabled} role={adminProfile.role} processingCount={txns.filter((t) => ["Received","Washing","Drying","Processing","Ready"].includes(t.status)).length} />
      </div>

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopNav
          activePage={activePage}
          onNavigate={handleNavigate}
          onSignOut={onSignOut}
          adminProfile={adminProfile}
          syncStatus={syncStatus}
          pendingChangesCount={pendingChangesCount}
          lastSyncError={lastSyncError}
          onRetrySync={() => void retrySync()}
          transactions={txns}
          notifications={notifications}
          onMenuToggle={() => setMobileMenuOpen((v) => !v)}
          onTransactionDetail={handleTransactionDetail}
          onEditTransaction={handleEditTransaction}
        />
        <main className="flex-1 overflow-y-auto p-4 pb-20 md:p-6">
          {showOfflineNotice && (
            <OfflineAccessNotice
              syncStatus={syncStatus}
              pendingChangesCount={pendingChangesCount}
              lastSyncError={lastSyncError}
              onRetrySync={() => void retrySync()}
              onDismiss={() => setNoticeDismissed(true)}
            />
          )}
          {renderPage()}
        </main>
      </div>
    </div>
    <MobileBottomNav activePage={activePage} onNavigate={handleNavigate} />

    <TransactionDetailModal
      open={detailOpen}
      onOpenChange={setDetailOpen}
      transaction={detailTxn}
      onEditStatus={handleEditTransaction}
    />
    </>
  );
}
