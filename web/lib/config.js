export const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
export const MAP_CENTER = [37.8716, -122.2727];
export const SEVERITY = { 1: 'Minor', 2: 'Moderate', 3: 'Severe' };
export const STATUS_COLORS = { open: '#DC2626', verified: '#D97706', forwarded: '#2563EB', resolved: '#16A34A', rejected: '#9CA3AF' };
export const ISSUE_LABELS = {
  discoloration: 'Discolored water',
  odor: 'Bad smell or taste',
  outage: 'No water',
  broken_infrastructure: 'Broken tap, pipe or standpipe',
  sanitation_gap: 'Sanitation problem',
  other: 'Other',
};
