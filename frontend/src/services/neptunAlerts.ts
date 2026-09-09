/**
 * Neptun Air Alerts Realtime Service (neptun.in.ua)
 * Provides WebSocket stream with automatic REST fallback to track active air alarms in Ukraine.
 * Attribution: "Карта повітряних тривог — NEPTUN (neptun.in.ua)"
 */

export interface NeptunAlertItem {
  key: string;
  name: string;
  oblast?: string;
  since?: string;
}

export interface NeptunAlertsResponse {
  raions: NeptunAlertItem[];
  oblasts: NeptunAlertItem[];
}

export interface NeptunRegion {
  id: string;
  nameUk: string;
  nameEn: string;
}

export const UKRAINIAN_REGIONS: NeptunRegion[] = [
  { id: 'kyiv_city', nameUk: 'м. Київ', nameEn: 'Kyiv City' },
  { id: 'kyiv', nameUk: 'Київська область', nameEn: 'Kyiv Oblast' },
  { id: 'vinnytsia', nameUk: 'Вінницька область', nameEn: 'Vinnytsia Oblast' },
  { id: 'volyn', nameUk: 'Волинська область', nameEn: 'Volyn Oblast' },
  { id: 'dnipro', nameUk: 'Дніпропетровська область', nameEn: 'Dnipropetrovsk Oblast' },
  { id: 'donetsk', nameUk: 'Донецька область', nameEn: 'Donetsk Oblast' },
  { id: 'zhytomyr', nameUk: 'Житомирська область', nameEn: 'Zhytomyr Oblast' },
  { id: 'zakarpattia', nameUk: 'Закарпатська область', nameEn: 'Zakarpattia Oblast' },
  { id: 'zaporizhzhia', nameUk: 'Запорізька область', nameEn: 'Zaporizhzhia Oblast' },
  { id: 'ivano_frankivsk', nameUk: 'Івано-Франківська область', nameEn: 'Ivano-Frankivsk Oblast' },
  { id: 'kirovohrad', nameUk: 'Кіровоградська область', nameEn: 'Kirovohrad Oblast' },
  { id: 'luhansk', nameUk: 'Луганська область', nameEn: 'Luhansk Oblast' },
  { id: 'lviv', nameUk: 'Львівська область', nameEn: 'Lviv Oblast' },
  { id: 'mykolaiv', nameUk: 'Миколаївська область', nameEn: 'Mykolaiv Oblast' },
  { id: 'odesa', nameUk: 'Одеська область', nameEn: 'Odesa Oblast' },
  { id: 'poltava', nameUk: 'Полтавська область', nameEn: 'Poltava Oblast' },
  { id: 'rivne', nameUk: 'Рівненська область', nameEn: 'Rivne Oblast' },
  { id: 'sumy', nameUk: 'Сумська область', nameEn: 'Sumy Oblast' },
  { id: 'ternopil', nameUk: 'Тернопільська область', nameEn: 'Ternopil Oblast' },
  { id: 'kharkiv', nameUk: 'Харківська область', nameEn: 'Kharkiv Oblast' },
  { id: 'kherson', nameUk: 'Херсонська область', nameEn: 'Kherson Oblast' },
  { id: 'khmelnytskyi', nameUk: 'Хмельницька область', nameEn: 'Khmelnytskyi Oblast' },
  { id: 'cherkasy', nameUk: 'Черкаська область', nameEn: 'Cherkasy Oblast' },
  { id: 'chernivtsi', nameUk: 'Чернівецька область', nameEn: 'Chernivtsi Oblast' },
  { id: 'chernihiv', nameUk: 'Чернігівська область', nameEn: 'Chernihiv Oblast' },
  { id: 'crimea', nameUk: 'АР Крим', nameEn: 'Autonomous Republic of Crimea' },
];

/**
 * Canonical stem keywords for each Ukrainian region to ensure robust, unambiguous matching.
 * Differentiates Kyiv City from Kyiv Oblast and eliminates false alarms from empty strings.
 */
const REGION_STEMS: Record<string, string[]> = {
  kyiv_city: ['м. київ', 'м.київ'],
  kyiv: ['київськ', 'київщин'],
  vinnytsia: ['вінницьк'],
  volyn: ['волинськ'],
  dnipro: ['дніпро', 'дніпропетровськ'],
  donetsk: ['донецьк'],
  zhytomyr: ['житомир'],
  zakarpattia: ['закарпат'],
  zaporizhzhia: ['запорізьк'],
  ivano_frankivsk: ['івано-франківськ', 'прикарпатт'],
  kirovohrad: ['кіровоград'],
  luhansk: ['луганськ'],
  lviv: ['львів'],
  mykolaiv: ['миколаїв'],
  odesa: ['одес'],
  poltava: ['полтав'],
  rivne: ['рівнен'],
  sumy: ['сумськ', 'м. суми'],
  ternopil: ['тернопіль'],
  kharkiv: ['харків'],
  kherson: ['херсон'],
  khmelnytskyi: ['хмельницьк'],
  cherkasy: ['черкас'],
  chernivtsi: ['чернівецьк', 'буковин'],
  chernihiv: ['чернігів'],
  crimea: ['крим', 'севастополь'],
};

type AlertListener = (activeOblasts: string[], rawResponse: NeptunAlertsResponse | null) => void;

class NeptunAlertsManager {
  private ws: WebSocket | null = null;
  private listeners: Set<AlertListener> = new Set();
  private activeOblasts: string[] = [];
  private lastData: NeptunAlertsResponse | null = null;
  private reconnectTimeout: number | null = null;
  private reconnectDelay: number = 15000;
  private disconnectTimeout: number | null = null;
  private pollInterval: number | null = null;
  private isConnecting: boolean = false;
  private lastFetchTime: number = 0;
  private lastDataReceivedTime: number = 0;
  private watchdogInterval: number | null = null;
  private visibilityBound: boolean = false;

  constructor() {
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
  }

  public subscribe(listener: AlertListener): () => void {
    // If a disconnect was scheduled due to grace period, cancel it
    if (this.disconnectTimeout) {
      window.clearTimeout(this.disconnectTimeout);
      this.disconnectTimeout = null;
    }

    this.listeners.add(listener);
    // Call immediately with existing data if available
    listener(this.activeOblasts, this.lastData);

    if (!this.visibilityBound && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
      this.visibilityBound = true;
    }

    if (!this.ws && !this.isConnecting) {
      this.connect();
    }
    // Immediate REST fetch for fast initial data even before WS connects
    if (!this.lastData) {
      this.fetchRestAlerts();
    }

    // Start background watchdog: checks for stalled WS and ensures data stays fresh
    if (!this.watchdogInterval) {
      this.watchdogInterval = window.setInterval(() => {
        if (typeof document !== 'undefined' && document.hidden) return;
        const now = Date.now();
        if (now - this.lastDataReceivedTime >= 35000) {
          this.fetchRestAlerts();
        }
        if (this.ws && now - this.lastDataReceivedTime >= 90000) {
          try {
            this.ws.close();
          } catch {
            // ignore
          }
        }
      }, 25000);
    }

    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        // Grace period (10s): delay disconnect so fast page changes or React effect re-runs
        // do not tear down and immediately reconnect the WebSocket, preventing HTTP 429 rate limits.
        if (this.disconnectTimeout) {
          window.clearTimeout(this.disconnectTimeout);
        }
        this.disconnectTimeout = window.setTimeout(() => {
          if (this.listeners.size === 0) {
            this.disconnect();
          }
          this.disconnectTimeout = null;
        }, 10000);
      }
    };
  }

  private handleVisibilityChange() {
    if (typeof document === 'undefined') return;

    if (document.hidden) {
      // Tab in background: stop polling to conserve network and battery
      if (this.pollInterval) {
        window.clearInterval(this.pollInterval);
        this.pollInterval = null;
      }
    } else {
      // Tab returned to foreground: refresh only if at least 15s passed or no data
      if (this.listeners.size > 0 && !this.ws) {
        if (Date.now() - this.lastFetchTime >= 15000 || !this.lastData) {
          this.fetchRestAlerts();
        }
        this.startFallbackPolling();
      }
    }
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.activeOblasts, this.lastData);
    }
  }

  private connect() {
    if (typeof WebSocket === 'undefined') {
      this.startFallbackPolling();
      return;
    }

    this.isConnecting = true;
    try {
      this.ws = new WebSocket('wss://neptun.in.ua/api/v1/stream');

      this.ws.onopen = () => {
        this.isConnecting = false;
        this.reconnectDelay = 15000;
        if (this.pollInterval) {
          clearInterval(this.pollInterval);
          this.pollInterval = null;
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          // Accept snapshot, alerts, or raw top-level response objects
          const data: NeptunAlertsResponse = payload.data || payload;
          if (data && (Array.isArray(data.oblasts) || Array.isArray(data.raions))) {
            this.handleAlertsData(data);
          }
        } catch (e) {
          console.warn('Failed to parse Neptun WS frame:', e);
        }
      };

      this.ws.onerror = () => {
        this.startFallbackPolling();
      };

      this.ws.onclose = (event) => {
        this.ws = null;
        this.isConnecting = false;
        this.startFallbackPolling();
        // If HTTP 429 rate limit was encountered, back off to at least 60s
        if (event.code === 1008 || event.reason?.includes('429')) {
          this.reconnectDelay = Math.max(this.reconnectDelay, 60000);
        }
        // Try reconnecting with exponential backoff (15s -> 30s -> 60s -> max 120s)
        if (!this.reconnectTimeout && this.listeners.size > 0) {
          this.reconnectTimeout = window.setTimeout(() => {
            this.reconnectTimeout = null;
            this.connect();
          }, this.reconnectDelay);
          this.reconnectDelay = Math.min(120000, this.reconnectDelay * 1.5);
        }
      };
    } catch {
      this.startFallbackPolling();
    }
  }

  private startFallbackPolling() {
    if (this.pollInterval) return;
    // Only poll if tab is visible
    if (typeof document !== 'undefined' && document.hidden) return;

    this.fetchRestAlerts();
    // Responsive 30s polling interval for timely alert detection
    this.pollInterval = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      this.fetchRestAlerts();
    }, 30000);
  }

  public async fetchRestAlerts(): Promise<void> {
    // Throttle: don't make requests if fetched less than 20s ago
    const now = Date.now();
    if (now - this.lastFetchTime < 20000 && this.lastData) {
      return;
    }

    try {
      this.lastFetchTime = now;
      const res = await fetch('https://neptun.in.ua/api/v1/alerts');
      if (res.ok) {
        const data: NeptunAlertsResponse = await res.json();
        this.handleAlertsData(data);
      }
    } catch (e) {
      console.warn('Neptun REST fallback check failed:', e);
    }
  }

  private handleAlertsData(data: NeptunAlertsResponse) {
    this.lastData = data;
    this.lastDataReceivedTime = Date.now();
    const oblasts = (data.oblasts || []).map((o) => o.name || o.key);
    this.activeOblasts = oblasts;
    this.notify();
  }

  private disconnect() {
    if (this.disconnectTimeout) {
      window.clearTimeout(this.disconnectTimeout);
      this.disconnectTimeout = null;
    }
    if (this.watchdogInterval) {
      window.clearInterval(this.watchdogInterval);
      this.watchdogInterval = null;
    }
    if (this.reconnectTimeout) {
      window.clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.pollInterval) {
      window.clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.visibilityBound && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      this.visibilityBound = false;
    }
    this.isConnecting = false;
  }

  /**
   * Helper to check if a given region ID is currently alarmed.
   * Uses canonical region stems and minimum-length guards to prevent false alarms from empty strings.
   */
  public isRegionAlarmed(regionId: string): boolean {
    if (!regionId || !this.lastData) return false;

    const stems = REGION_STEMS[regionId];
    const isKyivCity = regionId === 'kyiv_city';

    const matchesRegion = (text: string | undefined): boolean => {
      if (!text) return false;
      const clean = text.trim().toLowerCase();
      // Guard against empty strings or fragments matching everything
      if (clean.length < 3) return false;

      // When matching Kyiv City, exclude general "київська область" / "київщина"
      if (isKyivCity && (clean.includes('київськ') || clean.includes('київщин'))) {
        return false;
      }

      if (stems && stems.length > 0) {
        return stems.some((stem) => clean.includes(stem));
      }

      // Fallback: match against UKRAINIAN_REGIONS nameUk
      const regionObj = UKRAINIAN_REGIONS.find((r) => r.id === regionId);
      if (!regionObj) return false;
      const ukName = regionObj.nameUk.trim().toLowerCase();
      return ukName.length >= 3 && (clean.includes(ukName) || ukName.includes(clean));
    };

    // Check oblasts - compare against key, name, and parent oblast fields
    const inOblasts = (this.lastData.oblasts || []).some((o) => {
      if (!o) return false;
      return matchesRegion(o.key) || matchesRegion(o.name) || matchesRegion(o.oblast);
    });
    if (inOblasts) return true;

    // Check raions - if any raion belongs to our oblast, consider it alarmed
    const inRaions = (this.lastData.raions || []).some((r) => {
      if (!r) return false;
      return matchesRegion(r.oblast) || matchesRegion(r.name) || matchesRegion(r.key);
    });

    return inRaions;
  }
}

export const neptunAlertsService = new NeptunAlertsManager();
