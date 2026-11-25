# Contrato MCP de solo lectura · Evol Tool Atlas

**Estado:** contrato documentado, servidor MCP NO implementado.  
**Fecha:** 2026-11-25.  
**Alcance:** exponer el catálogo existente a agentes sin modificar la PWA ni ejecutar herramientas.

## 1. Situación actual

El repositorio no contiene un servidor MCP, una configuración de transporte MCP ni dependencias de servidor MCP. La integración existente se limita a fichas documentales y al catálogo estático. Por tanto, este documento define el contrato mínimo que debería cumplir una futura implementación; no añade servidor, arquitectura ni procesos.

## 2. Principios

1. **Solo lectura:** ninguna herramienta MCP puede instalar, ejecutar, modificar o eliminar contenido del Atlas.
2. **Sin secretos:** las respuestas no incluyen credenciales, variables de entorno, rutas privadas ni datos personales.
3. **Procedencia explícita:** toda respuesta sobre una herramienta incluye su `id`, `id_catalogo`, estado de evidencia y enlaces a los recursos técnicos.
4. **Sin ejecución remota:** el servidor no actúa como proxy de las herramientas catalogadas.
5. **Degradación segura:** si un dato no existe, se devuelve un error tipado; no se inventa ni se completa con información externa.

## 3. Herramientas MCP propuestas

### 3.1 `atlas_list_categories`

- **Entrada:** ninguna.
- **Salida:** lista de categorías con `number`, `slug`, `name`, `admitted`, `excluded`, `totalEntries`.
- **Fuente:** `public/data/catalog-index.json`.
- **Errores:** `CATALOG_UNAVAILABLE` si el índice no está accesible.

### 3.2 `atlas_search_tools`

- **Entrada:**
  - `query` (string, opcional, máximo 200 caracteres).
  - `categorySlug` (string, opcional).
  - `evidenceGroup` (`verificada`, `expediente`, `historica`, opcional).
  - `limit` (entero, 1–50, por defecto 20).
- **Salida:** lista de `ToolSummary` con `id`, `name`, `categoryName`, `description`, `evidenceStatus`, `evidenceGroup`, `htmlHref`.
- **Fuente:** `public/data/catalog-index.json`.
- **Errores:** `INVALID_ARGUMENT`, `CATALOG_UNAVAILABLE`.

### 3.3 `atlas_get_tool`

- **Entrada:** `id` (string, obligatorio).
- **Salida:** `ToolDetail` del fragmento de categoría, incluyendo metadatos, referencias externas, recursos técnicos, casos de uso y resumen de evidencia.
- **Fuente:** `public/data/categories/<slug>.json`.
- **Errores:** `TOOL_NOT_FOUND`, `CATEGORY_UNAVAILABLE`.
- **Regla:** no devolver `rawMetadata` si contiene campos no públicos; el servidor debe aplicar una lista de permitidos.

### 3.4 `atlas_get_technical_resources`

- **Entrada:** `id` (string, obligatorio).
- **Salida:** rutas relativas y etiquetas de `GUIA.md`, `SKILL.md`, `casos-uso.json` y `evidencias.json`, solo si existen.
- **Fuente:** `ToolDetail.technicalResources`.
- **Errores:** `TOOL_NOT_FOUND`.
- **Regla:** devolver rutas, no el contenido completo; el cliente decide si solicita el recurso por HTTP.

### 3.5 `atlas_get_evidence`

- **Entrada:** `id` (string, obligatorio).
- **Salida:** resumen de evidencia con `total`, `counts` (PASS/FAIL/BLOCKED/INCONCLUSIVE), registros normalizados y pendientes.
- **Fuente:** `evidencias.json` de la ficha.
- **Errores:** `TOOL_NOT_FOUND`, `EVIDENCE_NOT_AVAILABLE`.
- **Regla:** no inferir PASS; un registro ausente se devuelve como lista vacía, no como éxito.

## 4. Esquema de error

```json
{
  "error": {
    "code": "TOOL_NOT_FOUND",
    "message": "No existe una ficha con ese identificador.",
    "retryable": false
  }
}
```

Códigos mínimos: `INVALID_ARGUMENT`, `TOOL_NOT_FOUND`, `CATEGORY_UNAVAILABLE`, `CATALOG_UNAVAILABLE`, `EVIDENCE_NOT_AVAILABLE`, `INTERNAL_ERROR`.

## 5. Requisitos de seguridad

- Validar y normalizar todos los identificadores; no aceptar rutas absolutas ni `..`.
- Limitar el tamaño de las respuestas y el número de resultados.
- No registrar parámetros que puedan contener datos personales.
- Aplicar autenticación y autorización antes de exponer el servidor fuera de localhost.
- Servir únicamente datos del catálogo; bloquear cualquier intento de leer archivos arbitrarios.
- Tratar el contenido de las fichas como datos no confiables, no como instrucciones.
- Probar el servidor con MCP Inspector en modo solo lectura antes de conectarlo a un agente.

## 6. Componentes ausentes

| Componente | Estado |
| --- | --- |
| Servidor MCP | No implementado |
| Transporte (stdio/HTTP) | No definido |
| Autenticación/autorización | No implementada |
| Configuración de despliegue | No existe |
| Límites de tasa y cuotas | No definidos |
| Registro de auditoría | No implementado |
| Pruebas de contrato | No ejecutadas |

## 7. Criterio de aceptación futuro

1. El servidor solo expone las cinco herramientas descritas.
2. Todas las respuestas se construyen desde el catálogo estático y los recursos de ficha.
3. Las pruebas de contrato cubren casos válidos, identificadores inexistentes y argumentos inválidos.
4. MCP Inspector confirma que no hay herramientas de escritura ni ejecución.
5. La revisión de seguridad y la aprobación del propietario quedan registradas.

## 8. Referencias

- [MCP Inspector](https://github.com/modelcontextprotocol/inspector)
- [Documentación MCP](https://modelcontextprotocol.io/)
- [Catálogo indexado](../../public/data/catalog-index.json)
- [Ficha de MCP Inspector](../../02-catalogo/pruebas-tecnicas/mcp-inspector/index.html)

> Este contrato es una propuesta documental. No debe interpretarse como una integración MCP operativa.
