# Quick Reference: PWA/Offline Features

## 🚀 Quick Start

### Check if User is Online
```typescript
import { isOnline } from "@/lib/network-status";

if (isOnline()) {
  // Make API call
} else {
  // Queue for later
}
```

### Add Offline Support to Any Module

#### 1. Create Storage Adapter
```typescript
import { createOfflineStorage, createOfflineQueue } from "@/lib/offline-storage-adapter";

// For simple data storage
const storage = createOfflineStorage<MyDataType>(
  "my-module-cache-key",
  defaultValue
);

// For mutation queue
const queue = createOfflineQueue("my-module-queue-key");
```

#### 2. Save Data Offline
```typescript
// Read data
const data = await storage.read();

// Write data
await storage.write(updatedData);
```

#### 3. Queue Mutations
```typescript
import { enqueueSettingsMutation } from "@/lib/offline-settings-sync";
import { toast } from "@/hooks/use-toast";

const handleSave = async () => {
  if (!isOnline()) {
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });
  }
};
```

#### 4. Process Queue When Online
```typescript
import { processSettingsQueue } from "@/lib/offline-settings-sync";
import { getBrowserAccessToken } from "@/lib/supabase/browser-session";

// Auto-sync on network restore
useEffect(() => {
  const handleOnline = async () => {
    await processSettingsQueue(async () => {
      const token = await getBrowserAccessToken();
      return token ? { Authorization: `Bearer ${token}` } : {};
    });
  };

  window.addEventListener("online", handleOnline);
  return () => window.removeEventListener("online", handleOnline);
}, []);
```

## 📁 Key Files

### Core Infrastructure
- `/lib/offline-storage-adapter.ts` - Reusable storage utilities
- `/lib/offline-transactions.ts` - Transaction offline support
- `/lib/offline-settings-sync.ts` - Settings offline support
- `/lib/network-status.ts` - Online/offline detection
- `/public/sw.js` - Service worker with cache strategies

### UI Components
- `/components/sync-status-detail.tsx` - Detailed sync status card
- `/components/offline-access-notice.tsx` - Dismissible sync banner
- `/components/mobile-bottom-nav.tsx` - Mobile navigation
- `/app/offline/page.tsx` - Offline fallback page

### Integration Points
- `/components/app-shell.tsx` - Main app with sync logic
- `/components/topnav.tsx` - Sync status + theme toggle

## 🎨 UI Components Usage

### Sync Status Detail Card
```typescript
import SyncStatusDetail from "@/components/sync-status-detail";

<SyncStatusDetail onRetrySync={handleRetrySync} />
```

### Offline Access Notice Banner
```typescript
import OfflineAccessNotice from "@/components/offline-access-notice";

<OfflineAccessNotice
  syncStatus={syncStatus}
  pendingChangesCount={pendingCount}
  lastSyncError={error}
  onRetrySync={handleRetry}
  onDismiss={() => setDismissed(true)}
/>
```

### Mobile Bottom Navigation
```typescript
import MobileBottomNav from "@/components/mobile-bottom-nav";

<MobileBottomNav
  activePage={currentPage}
  onNavigate={handleNavigate}
/>
```

## 🔧 Service Worker Cache Strategies

### Navigation Requests
- Strategy: Network-first
- Fallback: Cache → Offline page → Root
- Use case: Page navigation

### API GET Requests
- Strategy: Stale-while-revalidate
- Behavior: Return cache immediately, update in background
- Use case: Data fetching

### API Mutations (POST/PUT/DELETE)
- Strategy: Not cached (app-level queue)
- Behavior: Queued when offline, synced when online
- Use case: Data modifications

### Static Assets
- Strategy: Cache-first
- Fallback: Network
- Use case: JS, CSS, images

## 🧪 Testing Offline Mode

### Chrome DevTools Method
1. Open DevTools (F12)
2. Network tab → Throttling dropdown → "Offline"
3. Test your feature
4. Check Application → IndexedDB for queued items
5. Switch back to "Online"
6. Verify auto-sync

### Manual Testing
```typescript
// Simulate offline
window.dispatchEvent(new Event("offline"));

// Simulate online
window.dispatchEvent(new Event("online"));
```

## 📊 Check Queue Status

### Get Pending Counts
```typescript
import { getSettingsQueueCount } from "@/lib/offline-settings-sync";
import { readOfflineQueue } from "@/lib/offline-transactions";

const settingsCount = getSettingsQueueCount();
const txnQueue = await readOfflineQueue();
const txnCount = txnQueue.length;

console.log(`Pending: ${settingsCount + txnCount} items`);
```

### Inspect Queue Items
```typescript
const queue = await readOfflineQueue();
queue.forEach(item => {
  console.log(`${item.type} - Retry: ${item.retryCount}`, item);
});
```

## 🎯 Common Patterns

### Pattern 1: Form with Offline Support
```typescript
const [saving, setSaving] = useState(false);

const handleSubmit = async (data: FormData) => {
  setSaving(true);
  
  try {
    if (!isOnline()) {
      await enqueueSettingsMutation({
        endpoint: "/api/endpoint",
        method: "POST",
        body: data,
      });
      toast({ title: "Saved Offline" });
    } else {
      const response = await fetch("/api/endpoint", {
        method: "POST",
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed");
      toast({ title: "Saved" });
    }
  } catch (error) {
    toast({ title: "Error", variant: "destructive" });
  } finally {
    setSaving(false);
  }
};
```

### Pattern 2: Data Fetching with Cache
```typescript
const [data, setData] = useState<MyData[]>([]);

useEffect(() => {
  const loadData = async () => {
    // Try cache first
    const cached = await storage.read();
    setData(cached);
    
    // Update from network if online
    if (isOnline()) {
      const response = await fetch("/api/data");
      const fresh = await response.json();
      setData(fresh);
      await storage.write(fresh);
    }
  };
  
  void loadData();
}, []);
```

### Pattern 3: Network Status Listener
```typescript
useEffect(() => {
  const handleOnline = () => {
    console.log("Back online!");
    // Trigger sync
  };
  
  const handleOffline = () => {
    console.log("Gone offline!");
    // Show notice
  };
  
  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
  
  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
}, []);
```

## 🚨 Troubleshooting

### Queue Not Syncing
1. Check network status: `navigator.onLine`
2. Verify auth token is valid
3. Check console for errors
4. Try manual retry button

### Data Not Persisting
1. Check browser storage quota
2. Verify IndexedDB is enabled (not private mode)
3. Check for storage errors in console

### Service Worker Not Updating
```bash
# Hard refresh
Ctrl+Shift+R (Windows/Linux)
Cmd+Shift+R (Mac)

# Or unregister SW
DevTools → Application → Service Workers → Unregister
```

### Clear All Offline Data
```typescript
// Clear transaction queue
import { writeOfflineQueue } from "@/lib/offline-transactions";
await writeOfflineQueue([]);

// Clear settings queue
localStorage.removeItem("laundrytrack_settings_queue_v1");

// Clear cached data
localStorage.clear();
indexedDB.deleteDatabase("laundrytrack-offline-db");
```

## 📱 Mobile-Specific Features

### Bottom Navigation
- Visible: Mobile/tablet (< lg breakpoint)
- Hidden: Desktop (≥ lg breakpoint)
- Touch targets: 44px minimum

### Theme Toggle
- Location: User dropdown menu
- Persists across sessions
- Respects system preference

## 🔐 Security Notes

- All queued mutations include auth tokens
- Tokens refreshed before sync
- Failed auth triggers re-login
- Queue cleared on logout

## 📈 Performance Tips

1. **Batch Updates**: Queue multiple changes, sync together
2. **Cache Wisely**: Don't cache large files offline
3. **Monitor Queue Size**: Alert if queue grows too large
4. **Cleanup Old Data**: Implement TTL for cached data

## 🔗 Related Documentation

- Full guide: `/PWA_OFFLINE_FEATURES.md`
- Completion summary: `/PWA_COMPLETION_SUMMARY.md`
- Settings persistence: `/SETTINGS_PERSISTENCE.md`
