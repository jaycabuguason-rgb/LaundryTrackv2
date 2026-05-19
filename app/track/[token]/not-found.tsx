export default function TrackingNotFound() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] px-4 py-10">
      <div className="mx-auto max-w-xl rounded-3xl border border-border bg-background p-8 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Laundry Tracking
        </p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">Tracking link not found</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          The QR code may be invalid, expired, or copied incorrectly. Please contact the shop and provide your receipt ticket number.
        </p>
      </div>
    </main>
  );
}
