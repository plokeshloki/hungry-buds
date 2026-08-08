'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

export default function MenuManager() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push('/admin');
        return;
      }
      setChecking(false);
      loadItems();
    }
    init();
  }, [router]);

  async function loadItems() {
    setLoadingItems(true);
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true });
    if (!error) setItems(data);
    setLoadingItems(false);
  }

  function updateField(id, field, value) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  }

  async function saveItem(item) {
    setSavingId(item.id);
    setMessage('');
    const { error } = await supabase
      .from('menu_items')
      .update({
        name: item.name,
        category: item.category,
        veg: item.veg,
        price: item.price,
        mrp: item.mrp,
        photo_url: item.photo_url,
        description: item.description,
        in_stock: item.in_stock,
        available_morning: item.available_morning,
        available_evening: item.available_evening,
        available_start_time: item.available_start_time || null,
        available_end_time: item.available_end_time || null,
      })
      .eq('id', item.id);
    setSavingId(null);
    if (error) {
      setMessage('Failed to save: ' + error.message);
    } else {
      setMessage(`Saved "${item.name}"`);
      setTimeout(() => setMessage(''), 2500);
    }
  }

  async function deleteItem(id, name) {
    const confirmed = window.confirm(`Delete "${name}"? This cannot be undone.`);
    if (!confirmed) return;
    const { error } = await supabase.from('menu_items').delete().eq('id', id);
    if (!error) {
      setItems((prev) => prev.filter((item) => item.id !== id));
    } else {
      setMessage('Failed to delete: ' + error.message);
    }
  }

  async function addNewItem() {
    const { data, error } = await supabase
      .from('menu_items')
      .insert({
        name: 'New Item',
        category: 'Uncategorized',
        veg: true,
        price: 0,
        mrp: null,
        photo_url: '',
        description: '',
        in_stock: true,
        available_morning: true,
        available_evening: true,
        available_start_time: null,
        available_end_time: null,
      })
      .select()
      .single();
    if (!error) {
      setItems((prev) => [...prev, data]);
    } else {
      setMessage('Failed to add: ' + error.message);
    }
  }

  if (checking || loadingItems) {
    return (
      <div style={{ maxWidth: 600, margin: '60px auto', fontFamily: 'sans-serif', padding: 24, textAlign: 'center' }}>
        <p>Loading menu...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 700, margin: '30px auto', fontFamily: 'sans-serif', padding: 16 }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Manage Menu</h1>
      <p style={{ color: '#888', marginBottom: 16, fontSize: 13 }}>
        Edit any field, then tap "Save" for that item.
      </p>

      {message && (
        <div style={{ padding: 10, background: '#fff3e6', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
          {message}
        </div>
      )}

      <button
        onClick={addNewItem}
        style={{
          padding: 10, background: '#2e7d32', color: '#fff',
          border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', marginBottom: 20,
        }}
      >
        + Add New Item
      </button>

      {items.map((item) => (
        <div
          key={item.id}
          style={{
            border: '1px solid #ddd', borderRadius: 12, padding: 16, marginBottom: 16,
            background: item.in_stock ? '#fff' : '#f7f7f7',
          }}
        >
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Name</label>
          <input
            type="text"
            value={item.name || ''}
            onChange={(e) => updateField(item.id, 'name', e.target.value)}
            style={inputStyle}
          />

          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Category</label>
          <input
            type="text"
            value={item.category || ''}
            onChange={(e) => updateField(item.id, 'category', e.target.value)}
            style={inputStyle}
          />

          <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Price (₹)</label>
              <input
                type="number"
                value={item.price ?? ''}
                onChange={(e) => updateField(item.id, 'price', Number(e.target.value))}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>MRP (₹, optional)</label>
              <input
                type="number"
                value={item.mrp ?? ''}
                onChange={(e) => updateField(item.id, 'mrp', e.target.value === '' ? null : Number(e.target.value))}
                style={inputStyle}
              />
            </div>
          </div>

          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Photo URL</label>
          <input
            type="text"
            value={item.photo_url || ''}
            onChange={(e) => updateField(item.id, 'photo_url', e.target.value)}
            style={inputStyle}
          />
          {item.photo_url && (
            <img
              src={item.photo_url}
              alt={item.name}
              style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, marginBottom: 10 }}
            />
          )}

          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Description</label>
          <textarea
            value={item.description || ''}
            onChange={(e) => updateField(item.id, 'description', e.target.value)}
            style={{ ...inputStyle, minHeight: 60 }}
          />

          <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
            <label style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox"
                checked={!!item.veg}
                onChange={(e) => updateField(item.id, 'veg', e.target.checked)}
              />
              Veg
            </label>
            <label style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox"
                checked={!!item.in_stock}
                onChange={(e) => updateField(item.id, 'in_stock', e.target.checked)}
              />
              In stock
            </label>
          </div>

          <div style={{ border: '1px dashed #D9642B', borderRadius: 8, padding: 10, marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6, color: '#D9642B' }}>
              Custom Time Restriction (optional — leave both blank to show all the time)
            </label>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Available From</label>
                <input
                  type="time"
                  value={item.available_start_time || ''}
                  onChange={(e) => updateField(item.id, 'available_start_time', e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Available Until</label>
                <input
                  type="time"
                  value={item.available_end_time || ''}
                  onChange={(e) => updateField(item.id, 'available_end_time', e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => saveItem(item)}
              disabled={savingId === item.id}
              style={{
                flex: 1, padding: 10, background: '#D9642B', color: '#fff',
                border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer',
              }}
            >
              {savingId === item.id ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => deleteItem(item.id, item.name)}
              style={{
                padding: 10, background: '#fff', color: '#a33c26',
                border: '1px solid #a33c26', borderRadius: 8, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: 8, marginBottom: 10, borderRadius: 6,
  border: '1px solid #ccc', boxSizing: 'border-box', fontSize: 14,
};
