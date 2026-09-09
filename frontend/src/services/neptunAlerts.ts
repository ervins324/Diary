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

type AlertListener = (activeOblasts: string[], rawResponse: NeptunAlertsResponse | null) => void;

class NeptunAlertsManager {
  private ws: WebSocket | null = null;
  private listeners: Set<AlertListener> = new Set();
  private activeOblasts: string[] = [];
  private lastData: NeptunAlertsResponse | null = null;
  private reconnectTimeout: number | null = null;
  private reconnectDelay: number = 15000;
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
        this.disconnect();
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
          const payload = JSON.parse(event.data);
          if (payload.type === 'snapshot' || payload.type === 'alerts') {
            const data: NeptunAlertsResponse = payload.data || payload;
            this.handleAlertsData(data);
          }
        } catch (e) {
          console.warn('Failed to parse Neptun WS frame:', e);
        }
      };

      this.ws.onerror = () => {
        this.startFallbackPolling();
      };

      this.ws.onclose = () => {
        this.ws = null;
        this.isConnecting = false;
        this.startFallbackPolling();
        // Try reconnecting with exponential backoff (15s -> 30s -> 60s)
        if (!this.reconnectTimeout && this.listeners.size > 0) {
          this.reconnectTimeout = window.setTimeout(() => {
            this.reconnectTimeout = null;
            this.connect();
          }, this.reconnectDelay);
          this.reconnectDelay = Math.min(60000, this.reconnectDelay * 1.5);
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
   * Helper to check if a given region ID is currently alarmed
   */
  public isRegionAlarmed(regionId: string): boolean {
    if (!regionId || !this.lastData) return false;
    const regionObj = UKRAINIAN_REGIONS.find((r) => r.id === regionId);
    if (!regionObj) return false;

    const ukName = regionObj.nameUk.toLowerCase();

    // Check oblasts - compare against both key and name fields
    const inOblasts = (this.lastData.oblasts || []).some((o) => {
      const oKey = (o.key || '').toLowerCase();
      const oName = (o.name || '').toLowerCase();
      // Exact key match (e.g. "м. київ" === "м. київ")
      if (oKey === ukName || oName === ukName) return true;
      // Partial match: check if oblast key is contained in our region name or vice versa
      if (ukName.includes(oKey) || oKey.includes(ukName)) return true;
      if (ukName.includes(oName) || oName.includes(ukName)) return true;
      // ID-based match (e.g. o.key could directly be our regionId)
      if (oKey === regionId) return true;
      return false;
    });
    if (inOblasts) return true;

    // Check raions - if any raion belongs to our oblast, consider it alarmed
    const inRaions = (this.lastData.raions || []).some((r) => {
      const rOblast = (r.oblast || '').toLowerCase();
      // Compare raion's parent oblast with our region name
      return ukName.includes(rOblast) || rOblast.includes(ukName);
    });

    return inRaions;
  }
}

export const neptunAlertsService = new NeptunAlertsManager();
