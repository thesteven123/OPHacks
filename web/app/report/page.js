'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { addToQueue, flushQueue } from '@/lib/queue';
import { ISSUE_LABELS } from '@/lib/config';

const PinPicker = dynamic(() => import('@/components/PinPicker'), { ssr: false, loading: () => <div className="pickmap" /> });
const MAX_PHOTO_PX = 1280;
const JPEG_QUALITY = 0.7;

const QUESTIONS = [
  { name: 'severity', legend: 'How bad is it?', options: [['1', 'Minor'], ['2', 'Moderate'], ['3', 'Severe']], initial: '2' },
  { name: 'duration', legend: 'How long has it lasted?', options: [['today', 'Today'], ['few_days', 'A few days'], ['week_plus', 'A week or more']], initial: 'today' },
  { name: 'water_usable', legend: 'Can you use the water right now?', options: [['yes', 'Yes'], ['no', 'No'], ['unsure', 'Not sure']], initial: 'unsure' },
];
const initialAnswers = () => Object.fromEntries(QUESTIONS.map((q) => [q.name, q.initial]));

// Re-encoding through a canvas drops EXIF/GPS metadata and keeps photos around 100-300 KB.
async function resizePhoto(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_PHOTO_PX / Math.max(bitmap.width, bitmap.height));
  const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(bitmap.width * scale), height: Math.round(bitmap.height * scale) });
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}

export default function ReportPage() {
  const [issueType, setIssueType] = useState('discoloration');
  const [answers, setAnswers] = useState(initialAnswers);
  const [coords, setCoords] = useState(null);
  const [where, setWhere] = useState('No location yet.');
  const [photo, setPhoto] = useState(null);
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');
  const [fileKey, setFileKey] = useState(0);
  const [saving, setSaving] = useState(false);

  const pick = (lat, lng, label) => { setCoords({ lat, lng }); setWhere(label); };
  const locate = () =>
    navigator.geolocation.getCurrentPosition(
      (p) => pick(p.coords.latitude, p.coords.longitude, 'Location captured.'),
      () => setWhere('Could not get your location. Allow location access, or tap the map.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );

  async function onPhoto(e) {
    setPhoto(null);
    const file = e.target.files[0];
    if (!file) return;
    try { setPhoto(await resizePhoto(file)); } catch { setStatus('That photo could not be read. Try another one or send without a photo.'); }
  }

  async function submit(e) {
    e.preventDefault();
    if (!coords) return setStatus('Add your location first: use your location or tap the map.');
    setSaving(true);
    const saved = await addToQueue({
      id: crypto.randomUUID(), issue_type: issueType, severity: Number(answers.severity), duration: answers.duration,
      water_usable: answers.water_usable, description, contact_email: email, photo, ...coords,
    });
    const { offline, limited, remaining } = navigator.onLine ? await flushQueue() : { offline: 1 };
    setSaving(false);
    setStatus(
      limited ? "You reached today's report limit. Your report is saved and will send automatically tomorrow."
      : offline ? `Saved on this device${saved.photoDropped ? ' without the photo (storage is full)' : ''}. It will send when you are back online.`
      : remaining === 1 ? 'Report sent. Thank you. You can send 1 more report today.'
      : 'Report sent. Thank you.',
    );
    setIssueType('discoloration'); setAnswers(initialAnswers()); setCoords(null); setWhere('No location yet.');
    setPhoto(null); setDescription(''); setEmail(''); setFileKey((k) => k + 1);
  }

  return (
    <main>
      <p className="disclaimer">This is not a substitute for official water testing. For emergencies, contact your local authority.</p>
      <form onSubmit={submit}>
        <label htmlFor="issue_type">What is the problem?</label>
        <select id="issue_type" value={issueType} onChange={(e) => setIssueType(e.target.value)}>
          {Object.entries(ISSUE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>

        {QUESTIONS.map((q) => (
          <fieldset key={q.name}>
            <legend>{q.legend}</legend>
            {q.options.map(([value, label]) => (
              <label key={value} className="inline">
                <input type="radio" name={q.name} value={value} checked={answers[q.name] === value} onChange={() => setAnswers((a) => ({ ...a, [q.name]: value }))} /> {label}
              </label>
            ))}
          </fieldset>
        ))}

        <label>Where?</label>
        <button type="button" className="secondary" onClick={locate}>Use my location</button>
        <p className="hint">Or tap the map to drop a pin.</p>
        <PinPicker coords={coords} onPick={pick} />
        <p aria-live="polite">{where}</p>

        <label htmlFor="photo">Photo (optional)</label>
        <input key={fileKey} id="photo" type="file" accept="image/*" onChange={onPhoto} />
        {photo && <img className="thumb" src={photo} alt="Photo preview" />}

        <label htmlFor="description">Details (optional, 280 characters)</label>
        <textarea id="description" maxLength={280} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />

        <label htmlFor="contact_email">Email for follow-up (optional, never shown publicly)</label>
        <input id="contact_email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />

        <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Send report'}</button>
      </form>
      <p className="status" role="status">{status}</p>
    </main>
  );
}
