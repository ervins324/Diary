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
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private isConnecting: boolean = false;

  public subscribe(listener: AlertListener): () => void {
    this.listeners.add(listener);
    // Call immediately with existing data if available
    listener(this.activeOblasts, this.lastData);

    if (!this.ws && !this.isConnecting) {
      this.connect();
    }

    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.disconnect();
      }
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.activeOblasts, this.lastData);
    }
  }

  private connect() {
    this.isConnecting = true;
    try {
      this.ws = new WebSocket('wss://neptun.in.ua/api/v1/stream');

      this.ws.onopen = () => {
        this.isConnecting = false;
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
        // Try reconnecting in 15 seconds
        if (!this.reconnectTimeout && this.listeners.size > 0) {
          this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            this.connect();
          }, 15000);
        }
      };
    } catch {
      this.startFallbackPolling();
    }
  }

  private startFallbackPolling() {
    if (this.pollInterval) return;
    this.fetchRestAlerts();
    this.pollInterval = setInterval(() => {
      this.fetchRestAlerts();
    }, 20000);
  }

  public async fetchRestAlerts(): Promise<void> {
    try {
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
    const oblasts = (data.oblasts || []).map((o) => o.name || o.key);
    this.activeOblasts = oblasts;
    this.notify();
  }

  private disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
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
    const enName = regionObj.nameEn.toLowerCase();

    // Check oblasts
    const inOblasts = (this.lastData.oblasts || []).some((o) => {
      const oName = (o.name || o.key || '').toLowerCase();
      return (
        ukName.includes(oName) ||
        oName.includes(ukName) ||
        enName.includes(oName) ||
        o.key === regionId
      );
    });
    if (inOblasts) return true;

    // Check raions
    const inRaions = (this.lastData.raions || []).some((r) => {
      const rOblast = (r.oblast || '').toLowerCase();
      return (
        ukName.includes(rOblast) ||
        rOblast.includes(ukName) ||
        enName.includes(rOblast)
      );
    });

    return inRaions;
  }
}

export const neptunAlertsService = new NeptunAlertsManager();
