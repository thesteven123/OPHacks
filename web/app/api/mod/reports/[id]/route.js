import { moderatorProxy } from '@/lib/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const notFound = () => Response.json({ error: 'not found' }, { status: 404 });

export async function GET(request, { params }) {
  const { id } = await params;
  return UUID.test(id) ? moderatorProxy(`/api/reports/${id}`) : notFound();
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  return UUID.test(id) ? moderatorProxy(`/api/reports/${id}`, { method: 'PATCH', body: await request.text() }) : notFound();
}
