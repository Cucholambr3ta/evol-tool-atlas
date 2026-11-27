export interface ConsistencyTool { id: string; name: string; categorySlug: string; htmlHref: string }
export function compareCatalogIndexShards(input: {
  catalog: { categorias: Array<{ numero: number | string; slug: string }>; herramientas: Array<{ id: string; cat: number | string; href: string }> };
  index: { categories: Array<{ number: number; slug: string; admitted: number }>; tools: ConsistencyTool[] };
  shards: Map<string, { category: { slug: string }; tools: ConsistencyTool[] }>;
}): string[];
export function verifyManifestAgainstDist(input: { manifest: { items: Array<{ url: string; sha256: string }> }; distDir: string }): string[];
