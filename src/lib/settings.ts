import "server-only";
import { cache } from "react";
import { prisma } from "./db";
import { DEFAULT_SETTINGS } from "./settings-defaults";

export { DEFAULT_SETTINGS };

export type Settings = typeof DEFAULT_SETTINGS;
export type SettingKey = keyof Settings;

export const getSettings = cache(async (): Promise<Settings> => {
  const rows = await prisma.setting.findMany();
  const merged: Settings = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    if (row.key in merged) merged[row.key as SettingKey] = row.value;
  }
  return merged;
});

export function isSettingKey(key: string): key is SettingKey {
  return key in DEFAULT_SETTINGS;
}
