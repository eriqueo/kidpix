/**
 * Tiny event bus for player → UI state updates. Not generic-on-the-wire; just
 * enough to decouple the player loop from the editor's status text.
 */
export type Listener<T> = (payload: T) => void;

export class EventBus<EventMap extends Record<string, unknown>> {
  private listeners = new Map<keyof EventMap, Set<Listener<unknown>>>();

  on<K extends keyof EventMap>(event: K, fn: Listener<EventMap[K]>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(fn as Listener<unknown>);
    return () => set!.delete(fn as Listener<unknown>);
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const fn of [...set]) (fn as Listener<EventMap[K]>)(payload);
  }

  clear(): void {
    this.listeners.clear();
  }
}

export interface PlayerEvents extends Record<string, unknown> {
  start: { slideshowId: string };
  slide: { index: number; slideId: string };
  progress: { index: number; t: number };
  end: { slideshowId: string };
  error: { message: string };
}
