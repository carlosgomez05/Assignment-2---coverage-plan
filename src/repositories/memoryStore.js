// In-memory storage behind a tiny repository interface (insert / get / update / where).
// To move to a real database later, implement the same interface and pass it to
// createServices(); nothing in services/ or routes/ needs to change.

class Collection {
  #items = new Map();

  insert(item) {
    this.#items.set(item.id, item);
    return item;
  }

  get(id) {
    return this.#items.get(id);
  }

  update(id, patch) {
    const current = this.#items.get(id);
    if (!current) return undefined;
    const next = { ...current, ...patch };
    this.#items.set(id, next);
    return next;
  }

  where(predicate = () => true) {
    return [...this.#items.values()].filter(predicate);
  }
}

class Settings {
  #values = { requireRegistration: false };

  get() {
    return { ...this.#values };
  }

  update(patch) {
    this.#values = { ...this.#values, ...patch };
    return this.get();
  }
}

export function createMemoryStore() {
  return {
    users: new Collection(),
    providers: new Collection(),
    appointments: new Collection(),
    sessions: new Collection(),
    settings: new Settings(),
  };
}
