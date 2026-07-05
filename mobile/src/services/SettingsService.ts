/**
 * SettingsService — AsyncStorage wrapper for persisting AppSettings locally.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AppSettings,
  DEFAULT_SETTINGS,
} from "../types/settings";

const STORAGE_KEY = "@honjang/settings";

export class SettingsService {
  /**
   * Load settings from AsyncStorage, falling back to defaults.
   * Missing fields are merged from DEFAULT_SETTINGS so the app stays
   * forward-compatible when new settings are added.
   */
  static async load(): Promise<AppSettings> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      const parsed = JSON.parse(raw) as Partial<AppSettings>;
      return { ...DEFAULT_SETTINGS, ...parsed, vad: { ...DEFAULT_SETTINGS.vad, ...(parsed.vad ?? {}) } };
    } catch (err) {
      console.warn("[SettingsService] load failed, using defaults:", err);
      return { ...DEFAULT_SETTINGS };
    }
  }

  /**
   * Persist settings to AsyncStorage. Merges with existing settings.
   */
  static async save(settings: AppSettings): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (err) {
      console.warn("[SettingsService] save failed:", err);
    }
  }

  /**
   * Patch a subset of settings and persist.
   */
  static async update(patch: Partial<AppSettings>): Promise<AppSettings> {
    const current = await SettingsService.load();
    const next: AppSettings = {
      ...current,
      ...patch,
      vad: { ...current.vad, ...(patch.vad ?? {}) },
    };
    await SettingsService.save(next);
    return next;
  }

  /**
   * Reset to defaults.
   */
  static async reset(): Promise<AppSettings> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
    return { ...DEFAULT_SETTINGS };
  }
}