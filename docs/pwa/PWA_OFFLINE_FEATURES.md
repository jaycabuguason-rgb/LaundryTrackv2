# PWA & Offline Features Implementation

## Overview
LaundryTrack is a fully offline-capable Progressive Web App (PWA) that allows staff to continue working even without internet connectivity. All critical operations are queued locally and automatically sync when the connection is restored.

## Completed Features

### 1. Offline Fallback Page ✅
- **Location**: `/app/offline/page.tsx`
- **Features**:
  - Dedicated offline page with clear messaging
  - Auto-detection of network status
  - Quick action buttons to navigate to cached pages
  - List of available offline features
  - Auto-redirect to home when connection restored

### 2. Service Worker Cache Strategy ✅
- **Location**: `/public/sw.js`
- **Cache Version**: v2
- **Strategies**:
  - **Navigation requests**: Network-first with fallback to cache, then offline page
  - **API GET requests**: Stale-while-revalidate (cache-first with background update)
  - **Static assets**: Cache-first with network fallback
  - **API mutations**: Handled by app-level offline queue (not cached)

### 3. Offline Data Persistence ✅

#### Transactions Module
- **Location**: `/lib/offline-transactions.ts`
- **Storage**: IndexedDB with localStorage fallback
- **Features**:
  - Create transactions offline
  - Update transaction status offline
  - Queue mutations for sync
  - Automatic retry with exponential backoff
  - Merge protection (local edits not overwritten by server)

#### Settings Module
- **Location**: `/lib/offline-settings-sync.ts`
- **Supported Settings**:
  - Pricing configuration (per-kg, per-load, tiers)
  - Service types
  - Add-ons
  - Business profile
  - Loyalty program settings
- **Features**:
  - Queue settings changes offline
  - Automatic sync when online
  - Toast notifications for offline saves

#### Reusable Storage Adapter
- **Location**: `/lib/offline-storage-adapter.ts`
- **Purpose**: Generic offline storage for any module
- **Features**:
  - IndexedDB with localStorage fallback
  - Type-safe storage interface
  - Queue management utilities
  - Batch processing support

### 4. Theme Toggle ✅
- **Location**: `/components/topnav.tsx`
- **Features**:
  - Dark/Light mode toggle in user dropdown
  - Persisted preference using next-themes
  - System theme detection
  - No hydration mismatch

### 5. Mobile Bottom Navigation ✅
- **Location**: `/components/mobile-bottom-nav.tsx`
- **Features**:
  - Fixed bottom navigation for mobile devices
  - 5 core actions: Dashboard, Processing, Transactions, Claim, Profile
  - Hidden on desktop/tablet (lg breakpoint)
  - Active state indication
  - Touch-optimized (44px minimum touch target)

### 6. Sync Status Indicators ✅
- **Locations**:
  - `/components/topnav.tsx` - Compact status badge
  - `/components/offline-access-notice.tsx` - Dismissible banner
  - `/components/sync-status-detail.tsx` - Detailed sync status card
- **Features**:
  - Real-time online/offline detection
  - Pending changes counter (transactions + settings)
  - Manual retry sync button
  - Visual status indicators (online/offline/syncing/error)
  - Breakdown by module (transactions, settings)

### 7. Access Control ✅
- **Staff Restrictions**: Reports, Backup, Data Import, Staff Management, Audit Logs
- **Offline Restrictions**: Reports, Staff Management, Audit Logs, Data Import
- **Implementation**: Enforced in `app-shell.tsx` with toast notifications

## Architecture

### Offline Queue Flow
```
User Action (Offline)
    ↓
Local Storage/IndexedDB
    ↓
Queue Item Created
    ↓
[Network Restored]
    ↓
Auto Sync Triggered
    ↓
API Request with Auth
    ↓
Success: Remove from Queue
Failure: Increment Retry Count
```

### Cache Strategy Decision Tree
```
Request Type?
├─ Navigation → Network-first → Cache → Offline Page
├─ API GET → Cache-first → Network Update in Background
├─ API Mutation → App Queue (not cached)
└─ Static Asset → Cache-first → Network Fallback
```

## Usage Examples

### Creating Offline Storage for a New Module
```typescript
import { createOfflineStorage, createOfflineQueue } from "@/lib/offline-storage-adapter";

// Simple data storage
const storage = createOfflineStorage<MyDataType>("my-module-data", defaultValue);
const data = await storage.read();
await storage.write(updatedData);

// Mutation queue
const queue = createOfflineQueue("my-module-queue");
await queue.enqueue({
  endpoint: "/api/my-endpoint",
  method: "POST",
  body: { data: "value" },
});

// Process queue when online
await queue.process(async (item) => {
  const response = await fetch(item.endpoint, {
    method: item.method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item.body),
  });
  if (!response.ok) throw new Error("Sync failed");
});
```

### Adding Offline Support to a Form
```typescript
import { isOnline } from "@/lib/network-status";
import { enqueueSettingsMutation } from "@/lib/offline-settings-sync";
import { toast } from "@/hooks/use-toast";

const handleSave = async () => {
  if (!isOnline()) {
    // Queue for later sync
    await enqueueSettingsMutation({
      endpoint: "/api/my-endpoint",
      method: "PUT",
      body: formData,
    });
    toast({
      title: "Saved Offline",
      description: "Changes will sync when online.",
    });
  } else {
    // Direct API call
    await fetch("/api/my-endpoint", {
      method: "PUT",
      body: JSON.stringify(formData),
    });
  }
};
```

## Testing Offline Functionality

### Chrome DevTools
1. Open DevTools (F12)
2. Go to Network tab
3. Select "Offline" from throttling dropdown
4. Test creating/editing transactions
5. Check Application > IndexedDB for queued items
6. Switch back to "Online"
7. Verify auto-sync occurs

### Manual Testing Checklist
- [ ] Create transaction offline → goes to queue
- [ ] Update transaction status offline → queued
- [ ] Edit pricing settings offline → queued
- [ ] Edit business profile offline → queued
- [ ] Refresh page offline → data persists
- [ ] Close browser offline → data persists on reopen
- [ ] Go online → all queued items sync automatically
- [ ] Sync error → retry button works
- [ ] Theme toggle → persists across sessions
- [ ] Mobile nav → visible on mobile, hidden on desktop
- [ ] Offline page → shows when navigating to uncached route

## Performance Considerations

### Cache Size Management
- Service worker automatically cleans old cache versions
- Runtime cache grows with usage (navigation + API responses)
- Consider implementing cache size limits for production

### IndexedDB vs localStorage
- IndexedDB: Used by default (better performance, larger storage)
- localStorage: Fallback for older browsers (5-10MB limit)
- Both support same API via adapter pattern

### Sync Optimization
- Batch processing: Queue items processed sequentially
- Retry logic: Exponential backoff prevents server overload
- Background sync: Triggered on network restore + app startup

## Browser Support

### Required Features
- Service Workers (all modern browsers)
- IndexedDB (fallback to localStorage)
- Fetch API
- Promises/async-await

### Tested Browsers
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile Safari (iOS 14+)
- Chrome Mobile (Android 5+)

## Known Limitations

### Excluded from Scope (as per plan)
- ❌ JWT auth hardening changes
- ❌ User registration work
- ❌ Background Sync API (SyncManager)

### Current Limitations
- Cross-device sync: Unsynced edits are device-local
- Conflict resolution: Last-write-wins (no CRDT)
- Large file uploads: Not optimized for offline
- Real-time features: Disabled when offline

## Future Enhancements

### Potential Improvements
1. Background Sync API for better reliability
2. Periodic Background Sync for auto-refresh
3. Push notifications for sync completion
4. Conflict resolution UI for merge conflicts
5. Offline analytics tracking
6. Service worker update notifications
7. Cache size monitoring and cleanup

## Troubleshooting

### Service Worker Not Updating
```bash
# Clear cache and hard reload
Ctrl+Shift+R (Windows/Linux)
Cmd+Shift+R (Mac)

# Or via DevTools
Application > Service Workers > Unregister
Application > Storage > Clear site data
```

### Queue Items Not Syncing
1. Check network status indicator
2. Open DevTools Console for errors
3. Verify auth token is valid
4. Check IndexedDB for queue items
5. Try manual "Retry Sync" button

### Data Not Persisting
1. Check browser storage quota
2. Verify IndexedDB is enabled
3. Check for private/incognito mode
4. Clear corrupted storage and retry

## Maintenance

### Updating Cache Version
When deploying breaking changes to cached assets:
1. Increment `CACHE_VERSION` in `/public/sw.js`
2. Old caches automatically cleaned on activation
3. Users get fresh assets on next visit

### Monitoring Queue Health
```typescript
import { readOfflineQueue } from "@/lib/offline-transactions";
import { getSettingsQueueCount } from "@/lib/offline-settings-sync";

// Check queue sizes
const txnQueue = await readOfflineQueue();
const settingsQueue = getSettingsQueueCount();

console.log(`Pending: ${txnQueue.length + settingsQueue} items`);
```

## Security Considerations

- All queued mutations include auth tokens
- Tokens refreshed before sync attempts
- Failed auth triggers re-login flow
- Sensitive data encrypted in IndexedDB (future enhancement)
- Queue items cleared on logout

## Compliance

- GDPR: Local data cleared on user request
- Data retention: Queue items expire after 30 days (future)
- Audit trail: All synced changes logged to audit_logs table
