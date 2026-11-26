# promptfoo · Guía técnica de uso seguro

**ID de catálogo:** AT-SEC-002  
**Categoría Atlas:** IA · Evaluación de LLM  
**Versión de referencia verificada:** 0.126.0  
**Fecha de verificación documental:** 2026-11-25  
**Estado en este Atlas:** documentado, no instalado ni ejecutado por la PWA.

> Esta guía es documentación estática. El Atlas no descarga, instala ni ejecuta promptfoo. Los comandos
> proceden de la documentación oficial citada y no se presentan como probados en este repositorio salvo
> que exista un registro de evidencia con estado PASS en `evidencias.json`.

## 1. Introducción

promptfoo es un framework para evaluar prompts, agentes y aplicaciones LLM con casos reproducibles. Permite definir prompts, proveedores y aserciones en un archivo de configuración, ejecutar evaluaciones y comparar resultados.

En EVOL se propone para regresiones de prompts y para pruebas controladas de defensas de agentes. No es una herramienta de análisis estático ni un escáner de seguridad completo.

## 2. Instalación manual

La vía documentada es npm/npx. Revisar la versión fijada y el proveedor de modelos antes de ejecutar; una evaluación puede enviar prompts y datos a servicios externos.

### Linux

```bash
npm install -g promptfoo
```

```bash
npx promptfoo@latest --version
```


### macOS

```bash
npm install -g promptfoo
```

También puede usarse `npx promptfoo@latest`.


### Windows

```powershell
npm install -g promptfoo
```

La alternativa `npx promptfoo@latest` evita una instalación global.


### Verificación básica de la instalación

```bash
promptfoo --version
```

```bash
npx promptfoo@latest --help | head
```

## 3. Configuración

La configuración se define en `promptfooconfig.yaml`. Un esqueleto mínimo con un proveedor remoto y una aserción es:

```yaml
prompts:
  - "Responde solo con la palabra OK"
providers:
  - openai:gpt-4o-mini
tests:
  - assert:
      - type: contains
        value: OK
```

Usar un proveedor remoto implica enviar el prompt y el contexto al proveedor. Para datos sensibles, revisar primero las opciones de ejecución local y la política de retención del proveedor.

## 4. Primer uso

```bash
promptfoo init
```

```bash
promptfoo eval
```

```bash
promptfoo view
```

`promptfoo init` crea una configuración de ejemplo. Revisarla antes de ejecutar y sustituir cualquier proveedor o credencial de ejemplo por un entorno autorizado.

## 5. Uso avanzado

Evaluación con configuración explícita y salida JSON:

```bash
promptfoo eval -c promptfooconfig.yaml --output resultados.json
```

Red teaming (requiere revisar alcance, proveedor y datos antes de ejecutar):

```bash
promptfoo redteam init
promptfoo redteam run
promptfoo redteam report
```

Las evaluaciones de agentes pueden implicar herramientas externas; aislar el entorno y limitar el acceso a red y secretos.

## 6. Seguridad, alcance y limitaciones

- Configurar explícitamente el uso offline o local para evitar envío no deseado de datos a proveedores.
- No incluir claves de API en archivos de configuración versionados; usar variables de entorno o un gestor de secretos.
- Los resultados de red teaming pueden contener contenido sensible o reproducir ataques; tratarlos como material restringido.
- Las aserciones automáticas no demuestran seguridad: requieren revisión y casos de prueba bien diseñados.


### Evidencia disponible

Registro EV-AT-SEC-002-01: PASS limitado a `--version` (0.125.1); no demuestra evaluación funcional.


## 7. Solución de problemas

### Node.js demasiado antiguo

El paquete actual declara Node.js 22.22 o superior. Actualizar Node o usar un entorno con la versión requerida.

### Error de autenticación con un proveedor

Revisar la variable de entorno correspondiente y no pegar la clave en la configuración ni en la evidencia.

### La evaluación tarda o consume cuota

Reducir el número de casos, fijar un proveedor local o ejecutar un subconjunto con configuración explícita.

## 8. Referencias oficiales

- [Repositorio oficial](https://github.com/promptfoo/promptfoo)
- [Documentación oficial](https://www.promptfoo.dev/docs/)
- [Paquete npm](https://www.npmjs.com/package/promptfoo)
- [Guía de Red Teaming](https://www.promptfoo.dev/docs/red-team/quickstart/)

## 9. Registro de verificación de esta ficha

- Fuentes y versiones consultadas el 2026-11-25.
- No se realizó instalación, compilación ni ejecución como parte de la actualización del Atlas.
- Las pruebas ajenas al Atlas se registran en `evidencias.json` con su procedencia, hash y limitaciones.
- Cualquier adopción requiere revisión de licencia, análisis de dependencias, prueba aislada y aprobación del propietario.
