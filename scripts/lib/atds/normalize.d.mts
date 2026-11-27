import type { ToolType } from './types.d.mts';

export const ROOT: string;
export const UNVERIFIED_VALUES: ReadonlySet<string>;
export const UNVERIFIED_PREFIXES: readonly string[];
export const VAGUE_PATTERNS: readonly RegExp[];
export function isHttpUrl(v: unknown): boolean;
export function isVerifiedValue(v: unknown): boolean;
export function isPlaceholderUrl(v: unknown): boolean;
export function isIsoDate(v: unknown): boolean;
export function collectUrls(meta: Record<string, unknown>): string[];
export function extractTypeFromMeta(meta: Record<string, unknown>): ToolType;

export interface ToolIdentity {
  id: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  tipo: string;
  problema_que_resuelve: string;
  funciones_principales: string;
  fuentes_oficiales: Record<string, unknown>;
  fuentes_consultadas: unknown[];
  referencias_oficiales: Array<{ url?: string }>;
  sitio_oficial: string;
  repositorio: string;
  upstream: string;
  sitio_web: string;
  licencia: string;
  sistema_operativo: string | string[];
  dependencias: string;
  requisitos: string;
  fecha_verificacion: string;
  estado_fuente: string;
  limites: unknown[];
  id_catalogo: string;
  toolDir: string;
  rawTipo: string;
}
export function extractToolIdentity(meta: Record<string, unknown>, toolDir: string): ToolIdentity;

export interface NormalizedMetadata extends ToolIdentity {
  urls: string[];
  toolType: ToolType;
  raw: Record<string, unknown> | null | undefined;
  VAGUE_PATTERNS?: readonly RegExp[];
}
export function normalizeMetadata(rawMeta: Record<string, unknown> | null | undefined, toolDir: string): NormalizedMetadata;
