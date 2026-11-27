export function parseLotId(id: string): { number: number; letter: string } | null;
export function suffixToIndex(suffix: string): number;
export function indexToSuffix(index: number): string;
export function formatLotId(number: number, letter?: string): string;
export interface PlanTool { id: string; ruta: string }
export interface PlanCategory { numero: number; slug: string; nombre: string; efectivas: number; completadas: number; pendientes: number }
export type PlanProposal =
  | { lote: string; tipo: 'lote'; categorias: Array<{ numero: number; slug: string; nombre: string; herramientas: number }>; herramientas: PlanTool[]; total: number }
  | {
      lote: string;
      tipo: 'sublote';
      categoria: { numero: number; slug: string; nombre: string; herramientas: number };
      herramientas: PlanTool[];
      total: number;
      restantes_en_categoria: number;
      completa_la_categoria: boolean;
    };
export interface BatchPlan {
  errors: string[];
  discrepancies: string[];
  lotes_aprobados: Array<{ lote: string; politica: string | null; herramientas: string[] }>;
  herramientas_completadas: number;
  herramientas_pendientes: number;
  categorias_completadas: string[];
  categorias_pendientes_en_orden: PlanCategory[];
  propuesta: PlanProposal | null;
}
export function planNextBatch(input: {
  catalog: {
    categorias: Array<{ numero: number | string; slug: string; nombre: string; admitidas: number | string }>;
    herramientas: Array<{ id: string; cat: number | string; href: string }>;
  };
  lots: Array<{ id: string; file?: string; targets: Record<string, string> }>;
  maxTools?: number;
}): BatchPlan;
