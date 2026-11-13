'use client';
import { useOnline } from '@/components/OfflineStatus';

export default function OfflineDataNotice() {
  return useOnline() ? null : <p className="status" role="status">Viewing cached status. Reconnect for updates.</p>;
}
