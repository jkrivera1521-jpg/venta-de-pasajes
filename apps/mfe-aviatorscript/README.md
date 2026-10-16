# MFE AviatorScript: constructor visual de reglas

Micro-frontend para que analistas de negocio creen reglas de negocio con bloques visuales AND/OR, validen el AST y prueben el resultado con un payload JSON.

## Ejecutar de forma independiente

Desde `C:\VENTA-DE-PASAJES`:

```powershell
npm run dev:mfe-aviatorscript
```

Luego abre `http://localhost:3006/rules/embedded`.

La interfaz se adapta a escritorio, tabletas y moviles; en pantallas estrechas el esquema y el sandbox se abren como paneles superpuestos y las condiciones se organizan verticalmente.

El MFE funciona sin backend usando estas rutas mock:

- `GET /api/v1/rules/schema`
- `POST /api/v1/rules/validate`
- `POST /api/v1/rules/test`

Para conectarlo al servicio Java, define `NEXT_PUBLIC_RULES_API_BASE_URL` con la base que exponga esos tres endpoints. Si la variable queda vacia, se usan las rutas mock locales.

## Integracion con el shell

El shell de este monorepo descubre los MFE mediante el contrato existente de manifest:

- Manifest: `/mfe/manifest`
- Entrada: `/rules/embedded`
- Health: `/api/health`
- Puerto local: `3006`

El arranque completo (`npm run dev:frontend`) ya registra el manifest como `NEXT_PUBLIC_MFE_AVIATORSCRIPT_MANIFEST_URL`. En el menu dinamico de identidad puede registrarse la entrada usando el manifest del MFE.

El componente principal tambien se exporta desde `components/index.ts` para una integracion directa:

```tsx
<RuleBuilderMFE schema={schemaData} onSave={handleSave} />
```

En el shell actual, el manifest + iframe es la implementacion remota compatible con la arquitectura del proyecto. La exportacion tipada deja el mismo punto de montaje disponible si el shell migra mas adelante a Module Federation o Single-SPA.

## Estructura

- `components/RuleBuilder.tsx`: orquestacion de estado, validacion y guardado.
- `components/RuleGroup.tsx`: grupos AND/OR anidados.
- `components/RuleCondition.tsx`: campo, operador y editor de valor adaptativo.
- `components/SchemaSidebar.tsx`: esquema de contexto con busqueda, insercion y drag & drop.
- `components/SandboxTester.tsx`: editor JSON y ejecucion de prueba.
- `lib/types.ts`: contratos TypeScript del AST y respuestas API.
- `lib/rules.ts`: operaciones inmutables, validacion, serializacion y mock evaluator seguro.
