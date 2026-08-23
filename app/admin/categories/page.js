'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

export default function CategoryButtonsManager() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [buttons, setButtons] = useState([]);
  const [menuCategories, setMenuCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const [newLabel, setNewLabel] = useState('');
  const [newCategoryValue, setNewCategoryValue] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push('/admin');
        return;
      }
      setChecking(false);
      loadAll();
    }
    init();
  }, [router]);

  async function loadAll() {
    setLoading(true);
    const { data: btns } = await supabase
      .from('category_buttons')
      .select('*')
      .order('sort_order', { ascending: true });
    setButtons(btns || []);

    const { data: items } = await supabase.from('menu_items').select('category');
    const distinctCats = [...new Set((items || []).map((i) => i.category).filter(Boolean))].sort();
    setMenuCategories(distinctCats);

    setLoading(false);
  }

  async function addButton() {
    if (!newLabel.trim() || !newCategoryValue.trim()) {
      setMessage('Please fill in both the button text and the category it should match.');
      return;
    }
    setAdding(true);
    const maxSort = buttons.length > 0 ? Math.max(...buttons.map((b) => b.sort_order)) : 0;
    const { error } = await supabase.from('category_buttons').insert({
      label: newLabel.trim(),
      category_value: newCategoryValue.trim(),
      sort_order: maxSort + 1,
      is_active: true,
    });
    setAdding(false);
    if (error) {
      setMessage('Failed to add: ' + error.message);
    } else {
      setNewLabel('');
      setNewCategoryValue('');
      setMessage('Button added.');
      await loadAll();
      setTimeout(() => setMessage(''), 2000);
    }
  }

  function updateLocalField(id, field, value) {
    setButtons((prev) => prev.map((b) => (b.id === id ? { ...b, [field]: value } : b)));
  }

  async function saveButton(btn) {
    const { error } = await supabase
      .from('category_buttons')
      .update({
        label: btn.label,
        category_value: btn.category_value,
        is_active: btn.is_active,
      })
      .eq('id', btn.id);
    if (error) {
      setMessage('Failed to save: ' + error.message);
    } else {
      setMessage(`Saved "${btn.label}"`);
      setTimeout(() => setMessage(''), 2000);
    }
  }

  async function deleteButton(id, label) {
    const confirmed = window.confirm(`Delete the "${label}" button?`);
    if (!confirmed) return;
    const { error } = await supabase.from('category_buttons').delete().eq('id', id);
    if (!error) {
      setButtons((prev) => prev.filter((b) => b.id !== id));
    } else {
      setMessage('Failed to delete: ' + error.message);
    }
  }

  async function moveButton(index, direction) {
    const otherIndex = index + direction;
    if (otherIndex < 0 || otherIndex >= buttons.length) return;

    const current = buttons[index];
    const other = buttons[otherIndex];

    const { error: err1 } = await supabase
      .from('category_buttons')
      .update({ sort_order: other.sort_order })
      .eq('id', current.id);
    const { error: err2 } = await supabase
      .from('category_buttons')
      .update({ sort_order: current.sort_order })
      .eq('id', other.id);

    if (err1 || err2) {
      setMessage('Failed to reorder.');
    } else {
      await loadAll();
    }
  }

  if (checking || loading) {
    return (
      <div style={{ maxWidth: 600, margin: '60px auto', fontFamily: 'sans-serif', padding: 24, textAlign: 'center' }}>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 700, margin: '30px auto', fontFamily: 'sans-serif', padding: 16 }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Category Buttons</h1>
      <p style={{ color: '#888', marginBottom: 16, fontSize: 13 }}>
        Manage the quick-filter buttons students see on your menu page (e.g. "Biryani", "Fast Food").
      </p>

      {message && (
        <div style={{ padding: 10, background: '#fff3e6', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
          {message}
        </div>
      )}

      <div style={{ border: '1px dashed #D9642B', borderRadius: 8, padding: 12, marginBottom: 24 }}>
        <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 8, color: '#D9642B' }}>
          Add a new button
        </label>

        <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
          Button text (what students see)
        </label>
        <input
          type="text"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="e.g. Biryani"
          style={inputStyle}
        />

        <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
          Which category should it show? (must match exactly)
        </label>
        <input
          type="text"
          list="menu-categories"
          value={newCategoryValue}
          onChange={(e) => setNewCategoryValue(e.target.value)}
          placeholder="e.g. Biryanis"
          style={inputStyle}
        />
        <datalist id="menu-categories">
          {menuCategories.map((cat) => (
            <option key={cat} value={cat} />
          ))}
        </datalist>
        <p style={{ fontSize: 11, color: '#999', marginTop: -6, marginBottom: 10 }}>
          Your current item categories: {menuCategories.join(', ') || 'none yet'}
        </p>

        <button
          onClick={addButton}
          disabled={adding}
          style={{
            width: '100%', padding: 10, background: '#2e7d32', color: '#fff',
            border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer',
          }}
        >
          {adding ? 'Adding...' : '+ Add Button'}
        </button>
      </div>

      <h2 style={{ fontSize: 16, marginBottom: 12 }}>Your buttons (in order)</h2>

      {buttons.length === 0 && <p style={{ color: '#888' }}>No category buttons yet — add one above.</p>}

      {buttons.map((btn, index) => (
        <div
          key={btn.id}
          style={{ border: '1px solid #ddd', borderRadius: 12, padding: 14, marginBottom: 12 }}
        >
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button
              onClick={() => moveButton(index, -1)}
              disabled={index === 0}
              style={reorderBtnStyle}
            >
              ↑ Move up
            </button>
            <button
              onClick={() => moveButton(index, 1)}
              disabled={index === buttons.length - 1}
              style={reorderBtnStyle}
            >
              ↓ Move down
            </button>
          </div>

          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Button text</label>
          <input
            type="text"
            value={btn.label}
            onChange={(e) => updateLocalField(btn.id, 'label', e.target.value)}
            style={inputStyle}
          />

          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Matches category</label>
          <input
            type="text"
            list="menu-categories"
            value={btn.category_value}
            onChange={(e) => updateLocalField(btn.id, 'category_value', e.target.value)}
            style={inputStyle}
          />

          <label style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <input
              type="checkbox"
              checked={!!btn.is_active}
              onChange={(e) => updateLocalField(btn.id, 'is_active', e.target.checked)}
            />
            Active (show this button to students)
          </label>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => saveButton(btn)}
              style={{
                flex: 1, padding: 10, background: '#D9642B', color: '#fff',
                border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Save
            </button>
            <button
              onClick={() => deleteButton(btn.id, btn.label)}
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

const reorderBtnStyle = {
  flex: 1, padding: 8, background: '#eee', color: '#333',
  border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: 13,
};
