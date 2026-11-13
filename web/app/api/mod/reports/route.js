import { moderatorProxy } from '@/lib/server';

export const GET = () => moderatorProxy('/api/mod/reports');
