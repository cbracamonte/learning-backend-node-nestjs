# Retry Strategy - Sistema de Facturación Electrónica Masiva

## Tabla de Contenidos
1. [Introducción](#introducción)
2. [Teoría](#teoría)
3. [Caso de Uso Real](#caso-de-uso-real)
4. [Implementación](#implementación)
5. [Arquitectura](#arquitectura)
6. [Cómo Ejecutar](#cómo-ejecutar)
7. [Resultados Esperados](#resultados-esperados)
8. [Mejores Prácticas](#mejores-prácticas)

---

## Introducción

La comunicación con sistemas externos es inherentemente impredecible. Las fallos pueden ocurrir por razones transitorias (latencia de red, sobrecarga temporal) o permanentes (validación incorrecta, recurso no encontrado). 

**Retry Strategy** es un patrón fundamental para construir sistemas resilientes que:
- ✅ No pierdan datos ante fallos transitorios
- ✅ Reduzcan la presión sobre APIs saturadas
- ✅ Eviten duplicación de operaciones
- ✅ Registren auditoria completa de intentos

---

## Teoría

### 1. El Problema

#### 1.1 Causas Comunes de Fallo en Sistemas Distribuidos

**Fallos de Red:**
- Pérdida de paquetes
- Latencia inesperada
- Conexión cerrada inesperadamente (`ECONNRESET`, `ENOTFOUND`)
- Timeouts en la comunicación

**Fallos de API:**
- Errores internos del servidor (500, 502, 503)
- Saturación temporal (demasiadas solicitudes)
- Actualización de código mientras se procesa
- Fallos de base de datos (deadlocks, conexiones agotadas)

**Fallos de Infraestructura:**
- Reinicio de servidores
- Cambio de DNS
- Cambios en balanceadores de carga
- Fallas de hardware

#### 1.2 Impacto de No Manejar Fallos

Sin retry strategy:
```
❌ PÉRDIDA DE DATOS: Factura no llega a la API reguladora
❌ INCONSISTENCIAS: Base de datos local tiene dato que nunca se envió
❌ PROCESOS INCOMPLETOS: Workflows interrumpidos sin finalizar
❌ CONFIABILIDAD BAJA: Solo ~70-80% de operaciones exitosas
```

### 2. Tipos de Errores

Es crítico diferenciar entre errores **transitorios** (temporales) y **permanentes** (definitivos):

#### 2.1 Errores Transitorios ✅ REINTENTAR

```
HTTP 408   → Request Timeout
HTTP 429   → Too Many Requests (rate limiting)
HTTP 503   → Service Unavailable
HTTP 504   → Gateway Timeout
TCP ECONNREFUSED → El servidor está redespegando
TCP ECONNRESET → La conexión se reinició
TCP ETIMEDOUT  → Timeout de conexión
```

**Estrategia:** Reintentar después de esperar

#### 2.2 Errores Permanentes ❌ NO REINTENTAR

```
HTTP 400   → Bad Request (datos inválidos)
HTTP 401   → Unauthorized (credenciales)
HTTP 403   → Forbidden (sin permisos)
HTTP 404   → Not Found (recurso no existe)
HTTP 422   → Unprocessable Entity (validación)
```

**Estrategia:** Fallar inmediatamente y registrar en Dead Letter Queue

### 3. Estrategias de Retry

#### 3.1 Fixed Delay (Simple, pero Malo)

```
Intento 1: Falla inmediatamente
Espera:    5 segundos
Intento 2: Falla inmediatamente  
Espera:    5 segundos
Intento 3: Falla inmediatamente
→ FALLO TOTAL después de 15 segundos
```

**Problemas:**
- Si 1000 clientes reintenta simultáneamente → "Thundering Herd"
- La API recibe tormenta de solicitudes al mismo tiempo
- La API nunca se recupera, solo empeora
- Todos los reintentadores se sincronizan en fallos

#### 3.2 Exponential Backoff (Bueno)

```
Intento 1: Falla
Espera:    1000ms (base)
Intento 2: Falla
Espera:    2000ms (base * 2¹)
Intento 3: Falla
Espera:    4000ms (base * 2²)
→ FALLO después de 7 segundos (pero la API se recuperó)
```

**Beneficios:**
- Aumenta delay exponencialmente
- Reduce presión sobre API
- Da tiempo para recuperación

**Matemática:**
```
delay = baseDelay × 2^(attempt - 1)

Intento 1: 500ms × 2⁰ = 500ms
Intento 2: 500ms × 2¹ = 1000ms  
Intento 3: 500ms × 2² = 2000ms
Total:     3500ms
```

#### 3.3 Exponential Backoff + Jitter (Profesional) ⭐

```
Intento 1: Falla
Espera:    1000ms + ALEATORIO(0-300ms) = ~1150ms ← DISTINTO en cada cliente
Intento 2: Falla
Espera:    2000ms + ALEATORIO(0-600ms) = ~2290ms ← DISTINTO en cada cliente
Intento 3: Falla
Espera:    4000ms + ALEATORIO(0-1200ms) = ~4840ms ← DISTINTO en cada cliente
→ Las solicitudes se distribuyen, no sincronizadas
```

**¿Por qué Jitter?**

Sin jitter:
```
Cliente A: |████| (espera 1s) |████| (espera 2s) |████|
Cliente B: |████| (espera 1s) |████| (espera 2s) |████|
Cliente C: |████| (espera 1s) |████| (espera 2s) |████|
Resultado: TODA mandan reintento al mismo tiempo → "Thundering Herd"
```

Con jitter:
```
Cliente A: |████| (espera 1.15s) |████| (espera 2.29s) |████|
Cliente B: |████| (espera 1.08s) |████| (espera 2.18s) |████|
Cliente C: |████| (espera 1.23s) |████| (espera 2.45s) |████|
Resultado: Las solicitudes se distribuyen en el tiempo → Recuperación
```

**Implementación en el código:**
```typescript
private calculateBackoff(attempt: number, baseDelayMs: number): number {
  const exponentialBackoff = baseDelayMs * 2 ** (attempt - 1);
  const jitter = exponentialBackoff * 0.3 * Math.random(); // ±30%
  return exponentialBackoff + jitter;
}
```

---

## Caso de Uso Real

### Escenario: Sistema de Facturación Electrónica Masiva

#### Contexto

En muchos países, las facturas deben ser registradas en una API del ente regulador (como SUNAT en Perú, SAT en México, DIAN en Colombia). Este es un sistema real con restricciones severas:

**Arquitectura:**
```
┌─────────────────────────────────────────────────────────────┐
│ 🏢 Sistema ERP / Facturador Electrónico                     │
│   Genera 20,000 facturas por hora                           │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ↓ (API REST HTTPS)
┌─────────────────────────────────────────────────────────────┐
│ 🌐 API del Ente Regulador                                   │
│   - Disponibilidad: 99.5% (30 min/mes de downtime)          │
│   - Rate limit: 1000 req/min                                │
│   - Response time: 100-500ms (normal)                       │
│   - Puede devolver: 500, 502, 503 en sobrecargas            │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────────────┐
│ 📊 Base de Datos Reguladora                                 │
│   - Millones de transacciones por minuto                    │
│   - Connection pool exhausto en picos                       │
│   - Deadlocks ocasionales                                   │
└─────────────────────────────────────────────────────────────┘
```

#### Requisitos Críticos

1. **🔴 No perder ninguna factura**
   - Si no llega a la API reguladora, es ilegal
   - Multas por incumplimiento regulatorio
   - Pérdida de ingresos

2. **🔴 No duplicar facturas**
   - La API rechazará duplicados con error 409
   - Pero podría procesar parcialmente antes de rechazar
   - Necesita idempotencia garantizada

3. **🔴 Reintentar inteligentemente**
   - No sobrecargar la API saturada
   - Exponential backoff evita "thundering herd"
   - Máximo 3 intentos (regulación típica)

4. **🔴 Auditoría completa**
   - Cada intento debe registrarse
   - Cuándo, qué errores, qué causó el fallo
   - Cumplimiento legal y debugging

#### Escenarios de Fallo Reales

**Escenario A:** Timeout temporal
```
13:45:02 → Envío factura INV-00001
13:45:03 → ⏱️ TIMEOUT (30s esperando respuesta)
         → Retry Service reintenta
13:45:04 → Espera 500ms
13:45:04.5 → Intento 2: 💚 ÉXITO
13:45:05 → INV-00001 registrada legalmente
```

**Escenario B:** API saturada (503)
```
14:10:00 → Envío 5000 facturas simultáneamente
14:10:02 → ❌ 503 Service Unavailable (API sobrecargada)
         → Exponential backoff: espera 1s + jitter
14:10:03 → Intento 2: ❌ 503 Service Unavailable
         → Exponential backoff: espera 2s + jitter
14:10:05 → Intento 3: 💚 ÉXITO
14:10:06 → Factura registrada después del pico
```

**Escenario C:** Fallo permanente (400)
```
14:30:00 → Envío factura con datos inválidos
14:30:01 → ❌ 400 Bad Request (datos truncados)
         → NO DEBE REINTENTAR
         → Fallida inmediatamente
14:30:02 → Registrada en Dead Letter Queue para investigación
```

---

## Implementación

### Arquitectura de Solución

```
┌────────────────────────────────────────────────────────────┐
│                    index.ts (Main)                          │
│  - Genera facturas simuladas                               │
│  - Orquesta el flujo completo                              │
│  - Reporta estadísticas finales                            │
└──────────────────────────┬─────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ↓                 ↓                 ↓
    ┌─────────────┐  ┌──────────────┐ ┌──────────────┐
    │ SendInvoice │  │ RetryService │ │ LoggerService│
    │ UseCase     │  │              │ │              │
    │             │  │ - Execute    │ │ - Log events │
    │ Orquesta    │  │ - Backoff    │ │ - Audit      │
    │ todo        │  │ - Jitter     │ │ - Reports    │
    └─────────────┘  └──────────────┘ └──────────────┘
         │                                   │
         └──────────────────┬────────────────┘
                            ↓
              ┌──────────────────────────┐
              │ InvoiceApiClient         │
              │ (Simula API Externa)     │
              │ - 60% de fallos (503)    │
              │ - 40% de éxitos          │
              └──────────────────────────┘
                            │
         ┌──────────────────┼─────────────────┐
         ↓                  ↓                  ↓
    ┌────────────┐  ┌───────────────┐  ┌────────────────┐
    │ Logs JSON  │  │ Persistence   │  │ Console Output │
    │            │  │ Service       │  │                │
    │ Auditoría  │  │ failed-       │  │ Estadísticas   │
    │ completa   │  │ invoices.json │  │ en tiempo real │
    └────────────┘  └───────────────┘  └────────────────┘
```

### Servicios Implementados

#### 1. RetryService ⭐
```typescript
execute<T>(
  operation: () => Promise<T>,
  options: RetryOptions
): Promise<T>
```
- Ejecuta operación
- Si falla, verifica si es retryable
- Calcula backoff exponencial con jitter
- Reintenta hasta maxAttempts
- Registra cada intento en LoggerService
- Persiste fallos finales en PersistenceService

#### 2. LoggerService 📋
```typescript
log(invoiceId: string, attempt: number, status, message, error?)
```
- Registra cada intento con timestamp
- Diferencia: attempt, success, failed
- Genera auditoría completa
- Permite debugging de fallos

#### 3. PersistenceService 💾
```typescript
- saveFailed(invoiceId, data, error, attempts, maxAttempts)
- markAsSuccess(invoiceId)
- getPendingInvoices()
- printFailedInvoicesReport()
```
- Guarda facturas fallidas en `failed-invoices.json`
- Permite reintentos posteriores
- Garantiza cero pérdida de datos
- Permite recuperación ante caídas del proceso

#### 4. SendInvoiceUseCase 🎯
- Orquesta RetryService, LoggerService, PersistenceService
- Decide qué errores son retryables
- Aplica política de reintentos

---

## Arquitectura

### Flujo de Procesamiento

```
FACTURA INGRESA
      │
      ├─→ SendInvoiceUseCase.execute()
      │         │
      │         ├─→ RetryService.execute()
      │         │      │
      │         │      ├─1. Intento 1
      │         │      │      │
      │         │      │      ├─→ InvoiceApiClient.sendInvoice()
      │         │      │      │      │
      │         │      │      │      ├─✅ ÉXITO
      │         │      │      │      │   LoggerService.log("success")
      │         │      │      │      │   PersistenceService.markAsSuccess()
      │         │      │      │      │   ↓
      │         │      │      │      │   RETORNA
      │         │      │      │      │
      │         │      │      │      └─❌ ERROR
      │         │      │      │         LoggerService.log("attempt")
      │         │      │      │         ¿Es retryable? ✅
      │         │      │      │         │
      │         │      │      │         ├─→ Calcula backoff
      │         │      │      │         └─→ ESPERA
      │         │      │      │
      │         │      │      ├─2. Intento 2
      │         │      │      │      (igual que arriba)
      │         │      │      │
      │         │      │      ├─3. Intento 3
      │         │      │      │      │
      │         │      │      │      └─❌ ERROR (maxAttempts alcanzado)
      │         │      │      │         LoggerService.log("failed")
      │         │      │      │         PersistenceService.saveFailed()
      │         │      │      │         ↓
      │         │      │      └──→ LANZA EXCEPCIÓN
      │         │      └─────→ CATCH EXCEPTION
      │         │
      │         └─→ InvoiceProcessingSystem
      │              │
      │              ├─✅ Exitosa → stats.successfulInvoices++
      │              └─❌ Fallida → stats.failedInvoices++
      │
      └─→ SIGUIENTE FACTURA
```

### Ciclo de Reintentos

```
INTENTO 1
├─ Operación
├─ ¿Éxito? ✅ → RETORNA ÉXITO
└─ ¿Fallo? ❌
   ├─ ¿Es retryable? ✅
   ├─ ¿attempt < maxAttempts? ✅
   └─ Espera: 500ms × 2^0 + jitter(0-150ms) = ~500-650ms

INTENTO 2
├─ Operación (después de espera)
├─ ¿Éxito? ✅ → RETORNA ÉXITO
└─ ¿Fallo? ❌
   ├─ ¿Es retryable? ✅
   ├─ ¿attempt < maxAttempts? ✅
   └─ Espera: 500ms × 2^1 + jitter(0-300ms) = ~1000-1300ms

INTENTO 3
├─ Operación (después de espera)
├─ ¿Éxito? ✅ → RETORNA ÉXITO
└─ ¿Fallo? ❌
   ├─ ¿Es retryable? ✅
   ├─ ¿attempt < maxAttempts? ❌ (Ya es intento 3 de 3)
   └─ GUARDA EN PERSISTENCIA y LANZA EXCEPCIÓN

TOTAL DE ESPERA EN CASO DE 3 FALLOS:
~500-650ms + ~1000-1300ms + 0ms = ~1.5-2s
(Sin jitter sería exactamente: 500ms + 1000ms = 1.5s)
```

---

## Cómo Ejecutar

### Instalación

```bash
cd /Users/cbracamonte/Workspace/learning/backend/node/mid-senior/01-retry-strategy

# Instalar dependencias
npm install

# Compilar TypeScript a JavaScript
npm run build

# Ejecutar el programa
npm start

# O modo desarrollo (directo con ts-node, sin compilar)
npm run dev

# Limpiar archivos compilados
npm run clean
```

### Scripts Disponibles

```json
{
  "build": "tsc",              // Compila TypeScript
  "start": "node dist/index.js", // Ejecuta versión compilada
  "dev": "ts-node index.ts",   // Ejecuta directo sin compilar
  "clean": "rm -rf dist"       // Limpia compilación
}
```

---

## Resultados Esperados

### Ejecución Típica

```
🗑️  Archivos de persistencia limpiados

📊 SISTEMA DE FACTURACIÓN ELECTRÓNICA MASIVA
═══════════════════════════════════════════
📄 Total de facturas a procesar: 20

[01/20] Enviando INV-00001... ✅ ENVIADA
[02/20] Enviando INV-00002... ✅ ENVIADA
[03/20] Enviando INV-00003... ✅ ENVIADA
[04/20] Enviando INV-00004... ✅ ENVIADA
[05/20] Enviando INV-00005... ✅ ENVIADA
[06/20] Enviando INV-00006... ✅ ENVIADA
[07/20] Enviando INV-00007... ✅ ENVIADA
[08/20] Enviando INV-00008... ✅ ENVIADA
[09/20] Enviando INV-00009... ✅ ENVIADA
[10/20] Enviando INV-00010... ❌ FALLÓ (guardada para reintentar)
[11/20] Enviando INV-00011... ✅ ENVIADA
[12/20] Enviando INV-00012... ✅ ENVIADA
[13/20] Enviando INV-00013... ✅ ENVIADA
[14/20] Enviando INV-00014... ✅ ENVIADA
[15/20] Enviando INV-00015... ✅ ENVIADA
[16/20] Enviando INV-00016... ✅ ENVIADA
[17/20] Enviando INV-00017... ✅ ENVIADA
[18/20] Enviando INV-00018... ✅ ENVIADA
[19/20] Enviando INV-00019... ✅ ENVIADA
[20/20] Enviando INV-00020... ✅ ENVIADA

📌 FACTURAS FALLIDAS (PENDIENTES DE REINTENTAR)
═══════════════════════════════════════════
🔴 INV-00010
   Intentos: 3/3
   Último error: Service Unavailable
   Último intento: 2/25/2026, 3:45:30 PM

═══════════════════════════════════════════
📈 RESUMEN DE RESULTADOS
═══════════════════════════════════════════
Total procesado:     20 facturas
✅ Exitosas:         19
❌ Fallidas inicial: 1
🔄 Reintentadas:     0
📊 Tasa de éxito:    95.0%
═══════════════════════════════════════════

⏳ Esperando 2 segundos antes de reintentar...

🔄 REINTENTANDO FACTURAS FALLIDAS
═══════════════════════════════════════════
📌 Total de facturas para reintentar: 1

Reintentando INV-00010... ✅ ENVIADA

✅ No hay facturas fallidas pendientes de reintentar

📋 LOG DE AUDITORÍA COMPLETO
═══════════════════════════════════════════
🔄 [2026-02-25T15:45:29.123Z] INV-00010 (Intento 1): Iniciando intento...
❌ [2026-02-25T15:45:29.245Z] INV-00010 (Intento 1): Error (Service Unavailable). Reintentando en 523ms...
🔄 [2026-02-25T15:45:29.768Z] INV-00010 (Intento 2): Iniciando intento...
❌ [2026-02-25T15:45:29.890Z] INV-00010 (Intento 2): Error (Service Unavailable). Reintentando en 1245ms...
🔄 [2026-02-25T15:45:31.135Z] INV-00010 (Intento 3): Iniciando intento...
❌ [2026-02-25T15:45:31.257Z] INV-00010 (Intento 3): Fallo final después de 3 intentos
🔄 [2026-02-25T15:45:33.890Z] INV-00010 (Intento 1): Iniciando intento...
✅ [2026-02-25T15:45:34.012Z] INV-00010 (Intento 1): Factura enviada exitosamente
═══════════════════════════════════════════
```

### Archivo de Persistencia

El programa genera `failed-invoices.json` con todas las facturas pendientes:

```json
[
  {
    "invoiceId": "INV-00010",
    "invoiceData": null,
    "attempts": 3,
    "maxAttempts": 3,
    "lastError": "Service Unavailable",
    "lastAttemptTime": "2026-02-25T15:45:31.257Z",
    "createdAt": "2026-02-25T15:45:29.123Z",
    "status": "pending"
  }
]
```

---

## Mejores Prácticas

### ✅ Lo Que Está Bien en Esta Implementación

1. **Diferenciación de Errores**
   ```typescript
   shouldRetry: (error: any) => error.code === 503
   ```
   - Solo reintenta errores transitorios (503)
   - Falla inmediatamente en errores permanentes

2. **Exponential Backoff + Jitter**
   ```typescript
   const exponentialBackoff = baseDelayMs * 2 ** (attempt - 1);
   const jitter = exponentialBackoff * 0.3 * Math.random();
   ```
   - Previene "thundering herd problem"
   - Cada cliente reintenta en tiempo distinto

3. **Auditoría Completa**
   - Cada intento registrado con timestamp
   - Trazabilidad completa para debugging
   - Cumplimiento regulatorio

4. **Persistencia de Fallos**
   ```typescript
   persistence.saveFailed(invoiceId, data, error, attempts, maxAttempts)
   ```
   - Cero pérdida de datos
   - Recuperación ante caída del proceso

5. **Idempotencia**
   - ID único por factura
   - No se duplican aunque se reintente

### ⚠️ Límites y Mejoras Futuras

**Límites Actuales:**
- Max 3 intentos (configurar según caso de uso)
- Solo simula API con 60% de fallos
- En memoria (real: base de datos)

**Mejoras Futuras:**
```typescript
// 1. Dead Letter Queue para errores permanentes
if (!shouldRetry(error)) {
  await deadLetterQueue.push(invoice);
  return; // No reintentar
}

// 2. Circuit Breaker (evita bombardear API rota)
if (failureRate > 50%) {
  return; // Wait before trying again
}

// 3. Exponential Backoff con máximo
const maxDelay = 30000; // 30 segundos máximo
const delay = Math.min(exponentialBackoff + jitter, maxDelay);

// 4. Métricas y alertas
metrics.recordRetry(invoiceId, attempt, delayMs);
if (failureRate > 25%) {
  alerting.sendSlackAlert("High retry rate detected");
}

// 5. Configuración dinámica
const retryPolicy = await config.getRetryPolicy(serviceType);
```

### 📚 Referencias

- **Bulkhead Pattern:** Aísla fallos de servicio
- **Circuit Breaker:** Detiene intentos cuando servicio está caído
- **Timeout:** Evita esperar infinitamente
- **Rate Limiting:** Respeta límites de API
- **Idempotency Keys:** Previene duplicados

---

## Conclusión

Esta implementación demuestra cómo un **Retry Strategy** profesional:
1. **Previene pérdida de datos** → Persistencia
2. **Evita sobrecargar APIs** → Exponential backoff + jitter
3. **Permite debugging** → Auditoría completa
4. **Mantiene integridad** → Idempotencia
5. **Es resiliente** → Manejo de fallos transitorios vs permanentes

El sistema está listo para producción con pequeños ajustes según los requisitos específicos de cada API.