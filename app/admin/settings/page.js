'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

export default function SettingsManager() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [windows, setWindows] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [savingWindowId, setSavingWindowId] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push('/admin');
        return;
      }
      setChecking(false);
      loadData();
    }
    init();
  }, [router]);

  async function loadData() {
    setLoadingData(true);
    const { data: windowData } = await supabase
      .from('order_windows')
      .select('*')
      .order('id', { ascending: true });
    const { data: settingsData } = await supabase
      .from('app_settings')
      .select('*')
      .limit(1)
      .single();
    if (windowData) setWindows(windowData);
    if (settingsData) setSettings(settingsData);
    setLoadingData(false);
  }

  function updateWindowField(id, field, value) {
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, [field]: value } : w))
    );
  }

  async function saveWindow(w) {
    setSavingWindowId(w.id);
    setMessage('');
    const { error } = await supabase
      .from('order_windows')
      .update({
        label: w.label,
        order_open: w.order_open,
        order_close: w.order_close,
        pickup_start: w.pickup_start,
        pickup_end: w.pickup_end,
        is_active: w.is_active,
      })
      .eq('id', w.id);
    setSavingWindowId(null);
    if (error) {
      setMessage('Failed to save window: ' + error.message);
    } else {
      setMessage(`Saved "${w.label}"`);
      setTimeout(() => setMessage(''), 2500);
    }
  }

  function updateSettingsField(field, value) {
    setSettings((prev) => ({ ...prev, [field]: value }));
  }

  async function saveSettings() {
    setSavingSettings(true);
    setMessage('');
    const { error } = await supabase
      .from('app_settings')
      .update({
        closed_message: settings.closed_message,
        handling_fee: settings.handling_fee,
        delivery_message: settings.delivery_message,
        delivery_time: settings.delivery_time,
      })
      .eq('id', settings.id);
    setSavingSettings(false);
    if (error) {
      setMessage('Failed to save settings: ' + error.message);
    } else {
      setMessage('Saved settings');
      setTimeout(() => setMessage(''), 2500);
    }
  }

  if (checking || loadingData) {
    return (
      <div style={{ maxWidth: 600, margin: '60px auto', fontFamily: 'sans-serif', padding: 24, textAlign: 'center' }}>
        <p>Loading settings...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 700, margin: '30px auto', fontFamily: 'sans-serif', padding: 16 }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Order Windows & Settings</h1>
      <p style={{ color: '#888', marginBottom: 16, fontSize: 13 }}>
        Edit any field, then tap "Save" for that section.
      </p>

      {message && (
        <div style={{ padding: 10, background: '#fff3e6', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
          {message}
        </div>
      )}

      {windows.map((w) => (
        <div
          key={w.id}
          style={{ border: '1px solid #ddd', borderRadius: 12, padding: 16, marginBottom: 16 }}
        >
          <label style={labelStyle}>Window name</label>
          <input
            type="text"
            value={w.label || ''}
            onChange={(e) => updateWindowField(w.id, 'label', e.target.value)}
            style={inputStyle}
          />

          <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Order opens</label>
              <input
                type="time"
                value={w.order_open || ''}
                onChange={(e) => updateWindowField(w.id, 'order_open', e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Order closes</label>
              <input
                type="time"
                value={w.order_close || ''}
                onChange={(e) => updateWindowField(w.id, 'order_close', e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Pickup starts</label>
              <input
                type="time"
                value={w.pickup_start || ''}
                onChange={(e) => updateWindowField(w.id, 'pickup_start', e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Pickup ends</label>
              <input
                type="time"
                value={w.pickup_end || ''}
                onChange={(e) => updateWindowField(w.id, 'pickup_end', e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <label style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
            <input
              type="checkbox"
              checked={!!w.is_active}
              onChange={(e) => updateWindowField(w.id, 'is_active', e.target.checked)}
            />
            Active
          </label>

          <button
            onClick={() => saveWindow(w)}
            disabled={savingWindowId === w.id}
            style={{
              padding: 10, background: '#D9642B', color: '#fff',
              border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', width: '100%',
            }}
          >
            {savingWindowId === w.id ? 'Saving...' : 'Save'}
          </button>
        </div>
      ))}

      {settings && (
        <div style={{ border: '1px solid #ddd', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>General Settings</h2>

          <label style={labelStyle}>Closed message (shown when no window is open)</label>
          <textarea
            value={settings.closed_message || ''}
            onChange={(e) => updateSettingsField('closed_message', e.target.value)}
            style={{ ...inputStyle, minHeight: 60 }}
          />

          <label style={labelStyle}>Handling fee (₹)</label>
          <input
            type="number"
            value={settings.handling_fee ?? ''}
            onChange={(e) => updateSettingsField('handling_fee', Number(e.target.value))}
            style={inputStyle}
          />

          <label style={labelStyle}>Delivery message (shown on order confirmation page)</label>
          <textarea
            value={settings.delivery_message || ''}
            onChange={(e) => updateSettingsField('delivery_message', e.target.value)}
            style={{ ...inputStyle, minHeight: 60 }}
          />

          <label style={labelStyle}>Delivery time (shown on order confirmation page, e.g. "8:00 PM")</label>
          <input
            type="text"
            value={settings.delivery_time || ''}
            onChange={(e) => updateSettingsField('delivery_time', e.target.value)}
            style={inputStyle}
            placeholder="e.g. 8:00 PM"
          />

          <button
            onClick={saveSettings}
            disabled={savingSettings}
            style={{
              padding: 10, background: '#D9642B', color: '#fff',
              border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', width: '100%',
            }}
          >
            {savingSettings ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      )}
    </div>
  );
}

const labelStyle = { fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 };
const inputStyle = {
  width: '100%', padding: 8, marginBottom: 10, borderRadius: 6,
  border: '1px solid #ccc', boxSizing: 'border-box', fontSize: 14,
};
