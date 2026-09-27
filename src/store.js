// Persistence: your Claude account (artifact db, private per user) with localStorage as the instant cache.
import { migrate, compact } from './state.js';

const LS_KEY = 'guitar-lazy-state-v1';

function readLocal() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY));
  } catch {
    return null;
  }
}
function writeLocal(s) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch {
    /* private mode or blocked storage: the account copy still works */
  }
}

export function createStore(day) {
  let state = migrate(readLocal(), day);
  let ref = null;
  let status = 'local'; // local | syncing | synced | local-only
  let writing = false;
  let dirty = false;
  let timer = null;
  const listeners = new Set();
  const emitStatus = () => listeners.forEach((fn) => fn(status));

  async function flush() {
    if (!ref || writing) return;
    writing = true;
    dirty = false;
    status = 'syncing';
    emitStatus();
    try {
      await ref.set({ state: compact(state, day), updatedAt: state.updatedAt || Date.now() });
      status = 'synced';
    } catch (e) {
      status = e && (e.code === 'invalid_argument' || e.code === 'revoked' || e.code === 'not_granted') ? 'local-only' : 'local';
      if (status === 'local-only') ref = null;
    }
    writing = false;
    emitStatus();
    if (dirty) schedule();
  }
  function schedule() {
    dirty = true;
    clearTimeout(timer);
    timer = setTimeout(flush, 1500);
  }

  const api = {
    get: () => state,
    set(next) {
      state = { ...next, updatedAt: Date.now() };
      writeLocal(state);
      if (ref) schedule();
    },
    update(fn) {
      api.set(fn(state));
    },
    status: () => status,
    onStatus(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    // Connect to the account copy. Resolves true when syncing is live.
    async connect(onRemoteNewer) {
      const c = typeof window !== 'undefined' ? window.claude : null;
      if (!c || typeof c.use !== 'function') return false;
      try {
        const [db, user] = await Promise.all([c.use('db'), c.use('user')]);
        if (!db || !user) return false;
        const uid = await user.id();
        if (!uid) return false;
        ref = db.doc('data/users/' + uid + '/state');
        const snap = await ref.get();
        if (snap.exists) {
          const body = snap.data();
          const remote = body && body.state ? migrate(JSON.parse(JSON.stringify(body.state)), day) : null;
          if (remote && (remote.updatedAt || 0) > (state.updatedAt || 0)) {
            state = remote;
            writeLocal(state);
            onRemoteNewer && onRemoteNewer(state);
          } else if (remote && (remote.updatedAt || 0) < (state.updatedAt || 0)) schedule();
        } else schedule();
        status = 'synced';
        emitStatus();
        return true;
      } catch {
        ref = null;
        status = 'local';
        emitStatus();
        return false;
      }
    },
    exportJSON: () => JSON.stringify(state),
    importJSON(text) {
      const parsed = JSON.parse(text);
      const m = migrate(parsed, day);
      if (m.v !== parsed.v) throw new Error('That file is not a Guitar Lazy backup.');
      api.set(m);
    },
  };
  return api;
}
