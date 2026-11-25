# MCP Inspector · Guía técnica de uso seguro

**ID de catálogo:** AT-SEC-004  
**Categoría Atlas:** Pruebas y auditoría técnica · MCP  
**Versión de referencia verificada:** 2.16.0  
**Fecha de verificación documental:** 2026-11-25  
**Estado en este Atlas:** documentado, no instalado ni ejecutado por la PWA.

> Esta guía es documentación estática. El Atlas no descarga, instala ni ejecuta MCP Inspector. Los comandos
> proceden de la documentación oficial citada y no se presentan como probados en este repositorio salvo
> que exista un registro de evidencia con estado PASS en `evidencias.json`.

## 1. Introducción

MCP Inspector ofrece una interfaz web, una TUI y un cliente CLI para conectarse a servidores Model Context Protocol, listar herramientas, recursos y prompts, y ejecutar llamadas de prueba.

En EVOL se propone para verificar el contrato observable de servidores MCP propios antes de exponerlos a agentes, con especial atención a herramientas que modifican estado.

## 2. Instalación manual

Se ejecuta mediante npx; no requiere una instalación global, aunque puede fijarse una versión concreta. Revisar la versión de Node.js exigida por el paquete.

### Linux

```bash
npx @modelcontextprotocol/inspector@2.16.0 --help
```

```bash
npx @modelcontextprotocol/inspector node build/index.js
```


### macOS

```bash
npx @modelcontextprotocol/inspector@2.16.0 --help
```

La interfaz web se abre indicando el servidor como argumento, igual que en Linux.


### Windows

```powershell
npx @modelcontextprotocol/inspector@2.16.0 --help
```

El comando del servidor debe adaptarse a la sintaxis de PowerShell.


### Verificación básica de la instalación

```bash
node --version
```

```bash
npx @modelcontextprotocol/inspector@2.16.0 --help | head
```

## 3. Configuración

El Inspector puede conectarse a un comando local (stdio) o a una URL remota (HTTP/SSE). Para servidores remotos, la documentación indica que el transporte se infiere de rutas `/mcp` o `/sse`; en otros casos debe indicarse `--transport`.

La configuración persistente puede residir en un catálogo o archivo de configuración, pero su formato no se reproduce aquí para no inventar un esquema. Usar la documentación oficial del proyecto.

No guardar secretos en argumentos de shell ni en archivos versionados. Si se usan cabeceras, revisar el manejo de `--header` y el historial del shell.

## 4. Primer uso

```bash
npx @modelcontextprotocol/inspector --cli node build/index.js --method initialize
```

```bash
npx @modelcontextprotocol/inspector --cli node build/index.js --method tools/list
```

```bash
npx @modelcontextprotocol/inspector --cli node build/index.js --method resources/list
```

Empezar por métodos de solo lectura (`initialize`, `tools/list`, `resources/list`, `prompts/list`). No invocar `tools/call` hasta revisar qué efectos tiene la herramienta.

## 5. Uso avanzado

Salida JSON limpia para automatización:

```bash
npx @modelcontextprotocol/inspector --cli node build/index.js --method tools/list --format json
```

Llamada a una herramienta con argumentos:

```bash
npx @modelcontextprotocol/inspector --cli node build/index.js --method tools/call --tool-name mytool --tool-arg key=value
```

Conexión remota por Streamable HTTP:

```bash
npx @modelcontextprotocol/inspector --cli https://my-mcp-server.example.com --transport http --method tools/list
```

Antes de usar `--load` o `tools/call`, confirmar que el servidor es de pruebas y que las herramientas no escriben en datos reales.

## 6. Seguridad, alcance y limitaciones

- Un servidor MCP puede exponer herramientas con efectos destructivos; inspeccionar primero el contrato y usar un servidor de pruebas.
- Las cabeceras y variables de entorno pueden contener credenciales; no incluirlas en capturas, informes ni evidencia.
- La inspección remota puede enviar datos al servidor y a proxies intermedios; revisar la política de red.
- El Inspector no certifica la seguridad del servidor: solo muestra su contrato y comportamiento observable.
- Revisar la licencia en transición (MIT/Apache-2.0) antes de redistribuir.



## 7. Solución de problemas

### Node.js no cumple la versión mínima

El paquete declara Node.js ^22.23.4, ^24.22.1 o >=26.12.1. Actualizar Node o usar una imagen autorizada.

### El servidor no responde al initialize

Verificar el comando, el directorio de trabajo, las variables de entorno y los logs del servidor; probar primero en local.

### Error de transporte en una URL remota

Indicar explícitamente `--transport http` o `--transport sse` cuando la ruta no termine en `/mcp` o `/sse`.

## 8. Referencias oficiales

- [Repositorio oficial](https://github.com/modelcontextprotocol/inspector)
- [Paquete npm](https://www.npmjs.com/package/@modelcontextprotocol/inspector)
- [Documentación MCP](https://modelcontextprotocol.io/)

## 9. Registro de verificación de esta ficha

- Fuentes y versiones consultadas el 2026-11-25.
- No se realizó instalación, compilación ni ejecución como parte de la actualización del Atlas.
- Las pruebas ajenas al Atlas se registran en `evidencias.json` con su procedencia, hash y limitaciones.
- Cualquier adopción requiere revisión de licencia, análisis de dependencias, prueba aislada y aprobación del propietario.
